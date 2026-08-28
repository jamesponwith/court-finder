import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { Facility, LatLng } from '../lib/types';

interface MapViewProps {
  center: LatLng;
  zoom: number;
  facilities: Facility[];
  selectedId: string | null;
  userLocation: LatLng | null;
  onSelectFacility: (id: string) => void;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function tennisMarkerHtml(): string {
  return `
    <svg viewBox="0 0 34 42" width="34" height="42" aria-hidden="true">
      <path d="M17 41 C 13 33, 6 29, 6 19 a 11 11 0 1 1 22 0 c 0 10 -7 14 -11 22 z"
            fill="#12463b"/>
      <circle cx="17" cy="18" r="9.5" fill="#d4e157"/>
      <path d="M9.6 14 C 14.5 15.8, 14.5 20.2, 9.6 22" fill="none"
            stroke="#ffffff" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M24.4 14 C 19.5 15.8, 19.5 20.2, 24.4 22" fill="none"
            stroke="#ffffff" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`;
}

function makeTennisIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: `tennis-marker${selected ? ' is-selected' : ''}`,
    html: tennisMarkerHtml(),
    iconSize: [34, 42],
    iconAnchor: [17, 41],
  });
}

function makeClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count >= 100 ? 52 : count >= 25 ? 46 : 40;
  return L.divIcon({
    className: 'cluster-icon',
    html: `<div class="cluster-bubble">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const YOU_ARE_HERE_ICON = L.divIcon({
  className: 'you-are-here',
  html: '<div class="you-are-here-dot"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/**
 * Thin imperative wrapper around plain Leaflet. The map instance is created
 * once and mutated in effects — no react-leaflet involved.
 */
export function MapView({
  center,
  zoom,
  facilities,
  selectedId,
  userLocation,
  onSelectFacility,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelectFacility);
  onSelectRef.current = onSelectFacility;

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: false,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 52,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: makeClusterIcon,
    });
    map.addLayer(cluster);

    mapRef.current = map;
    clusterRef.current = cluster;

    // Leaflet only listens for window resizes, but the bottom sheet changes
    // the map area's height on every snap — keep the map's size in sync so
    // tiles render and coordinates stay correct after the sheet moves.
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      markersRef.current.clear();
      userMarkerRef.current = null;
    };
    // Initial center/zoom only; later changes handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when the region (center/zoom) changes.
  useEffect(() => {
    mapRef.current?.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center.lat, center.lng, zoom]);

  // Rebuild markers when facilities change.
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    cluster.clearLayers();
    markersRef.current.clear();

    for (const facility of facilities) {
      const marker = L.marker([facility.lat, facility.lng], {
        icon: makeTennisIcon(facility.id === selectedId),
        title: facility.name,
        alt: facility.name,
      });
      marker.on('click', () => onSelectRef.current(facility.id));
      markersRef.current.set(facility.id, marker);
      cluster.addLayer(marker);
    }
    // selectedId intentionally excluded: selection changes are handled below
    // without rebuilding every marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilities]);

  // Highlight the selected marker and pan to it.
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      marker.setIcon(makeTennisIcon(id === selectedId));
    }
    if (selectedId) {
      const marker = markersRef.current.get(selectedId);
      const map = mapRef.current;
      if (marker && map) {
        map.panTo(marker.getLatLng(), { animate: true });
      }
    }
  }, [selectedId]);

  // "You are here" dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: YOU_ARE_HERE_ICON,
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(map);
    }
    map.setView([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), 12), {
      animate: true,
    });
  }, [userLocation]);

  return <div ref={containerRef} className="map-root" role="application" aria-label="Court map" />;
}
