import { useCallback, useEffect, useMemo, useState } from 'react';
import { CourtDetail } from './components/CourtDetail';
import { CourtList } from './components/CourtList';
import { FiltersBar } from './components/FiltersBar';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { Sheet } from './components/Sheet';
import { loadRegion } from './lib/data';
import {
  DEFAULT_FILTERS,
  filterAndSort,
  isDefaultFilters,
  type CourtFilters,
} from './lib/filters';
import { haversineMiles } from './lib/distance';
import {
  DEFAULT_REGION,
  REGIONS,
  type CourtsFile,
  type Facility,
  type LatLng,
  type Region,
} from './lib/types';

const REGION_STORAGE_KEY = 'courtfinder.region';

// Base-aware data directory so the app works when deployed under a
// sub-path (e.g. GitHub Pages project sites). Vite guarantees BASE_URL
// ends with "/".
const DATA_BASE_URL = `${import.meta.env.BASE_URL}data`;

/** Stable empty list so loading/error states don't churn identities. */
const NO_FACILITIES: Facility[] = [];

function loadStoredRegion(): Region {
  try {
    const stored = window.localStorage.getItem(REGION_STORAGE_KEY);
    if (stored === 'az' || stored === 'nyc') return stored;
  } catch {
    // Storage unavailable (private mode etc.) — fall through.
  }
  return DEFAULT_REGION;
}

type DataState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; file: CourtsFile };

type GeoStatus = 'idle' | 'locating' | 'located' | 'error';

export default function App() {
  const [region, setRegion] = useState<Region>(loadStoredRegion);
  const [data, setData] = useState<DataState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<CourtFilters>({ ...DEFAULT_FILTERS });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);

  // Load region data.
  useEffect(() => {
    let cancelled = false;
    setData({ status: 'loading' });
    setSelectedId(null);
    loadRegion(region, (url) => fetch(url), DATA_BASE_URL)
      .then((file) => {
        if (!cancelled) setData({ status: 'ready', file });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [region, reloadKey]);

  // A fix from the old region is misleading in the new one (distances show as
  // ~2,000 mi) — drop the location until the user taps "Near me" again.
  useEffect(() => {
    setUserLocation(null);
    setGeoStatus('idle');
    setGeoError(null);
  }, [region]);

  const handleRegionChange = useCallback((next: Region) => {
    setRegion(next);
    try {
      window.localStorage.setItem(REGION_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const handleNearMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('error');
      setGeoError('Location is not supported by this browser.');
      return;
    }
    setGeoStatus('locating');
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('located');
      },
      (err) => {
        setGeoStatus('error');
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. You can still browse the map and list.'
            : 'Could not determine your location. Please try again.'
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  }, []);

  const facilities = data.status === 'ready' ? data.file.facilities : NO_FACILITIES;

  const items = useMemo(
    () => filterAndSort(facilities, filters, userLocation),
    [facilities, filters, userLocation]
  );

  // Stable identity for the map's facility list: without the memo, every App
  // render (e.g. a marker click changing selectedId) would hand MapView a new
  // array and force a full marker rebuild.
  const mapFacilities = useMemo(() => items.map((item) => item.facility), [items]);

  // Derive the open detail from the unfiltered list so changing filters or
  // typing in search while the dialog is open doesn't close it.
  const selected = useMemo(() => {
    if (selectedId === null) return null;
    const item = items.find((i) => i.facility.id === selectedId);
    if (item) return item;
    const facility = facilities.find((f) => f.id === selectedId);
    if (!facility) return null;
    return {
      facility,
      distanceMiles:
        userLocation === null
          ? null
          : haversineMiles(userLocation, { lat: facility.lat, lng: facility.lng }),
    };
  }, [items, facilities, selectedId, userLocation]);

  const regionConfig = REGIONS[region];
  const hasActiveFilters = !isDefaultFilters(filters);
  const clearFilters = useCallback(() => setFilters({ ...DEFAULT_FILTERS }), []);

  const attribution =
    data.status === 'ready'
      ? data.file.attribution
      : '© OpenStreetMap contributors (ODbL); NYC Parks Open Data';

  const sheetLabel =
    data.status === 'loading'
      ? 'Loading courts…'
      : data.status === 'error'
        ? 'Court list'
        : `${items.length} ${items.length === 1 ? 'facility' : 'facilities'}`;

  return (
    <div className="app">
      <Header region={region} onRegionChange={handleRegionChange} />
      <FiltersBar filters={filters} onChange={setFilters} />
      <main className="app-main">
        <div className="map-area">
          <MapView
            center={regionConfig.center}
            zoom={regionConfig.zoom}
            facilities={mapFacilities}
            selectedId={selectedId}
            userLocation={userLocation}
            onSelectFacility={setSelectedId}
          />
          <button
            type="button"
            className="near-me-btn"
            onClick={handleNearMe}
            disabled={geoStatus === 'locating'}
          >
            {geoStatus === 'locating' ? 'Locating…' : '📍 Near me'}
          </button>
          {geoStatus === 'error' && geoError && (
            <p className="geo-error" role="alert">
              {geoError}
            </p>
          )}
        </div>
        <Sheet label={sheetLabel}>
          {data.status === 'error' ? (
            <div className="state-block" role="alert">
              <span aria-hidden="true" style={{ fontSize: '1.8rem' }}>
                🎾
              </span>
              <h3>Couldn&rsquo;t load courts</h3>
              <p style={{ margin: 0 }}>
                Something went wrong loading court data for{' '}
                {regionConfig.label}. Check your connection and try again.
              </p>
              <button
                type="button"
                className="btn-accent"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Try again
              </button>
            </div>
          ) : (
            <CourtList
              items={items}
              loading={data.status === 'loading'}
              selectedId={selectedId}
              hasActiveFilters={hasActiveFilters}
              onSelect={setSelectedId}
              onClearFilters={clearFilters}
            />
          )}
        </Sheet>
      </main>
      <footer className="footer">
        Court data: {attribution} · Map ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenStreetMap
        </a>{' '}
        contributors
      </footer>
      {selected && (
        <CourtDetail
          facility={selected.facility}
          regionLabel={regionConfig.label}
          distanceMiles={selected.distanceMiles}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
