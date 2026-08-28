/**
 * Data contract for the /data/courts-<region>.json files.
 *
 * This module is pure TypeScript — no React, no DOM — so it can be ported
 * to React Native (or any other runtime) as-is.
 */

export type Region = 'az' | 'ny' | 'ca' | 'fl' | 'nm' | 'elp';

export type Surface = 'hard' | 'clay' | 'grass' | 'unknown';

export type Access = 'public' | 'customers' | 'private' | 'unknown';

export type StateCode = 'AZ' | 'NY' | 'CA' | 'FL' | 'NM' | 'TX';

export type DataSource = 'osm' | 'nycparks' | 'merged';

/** Extra, loosely-typed metadata carried through from the source datasets. */
export interface FacilityTags {
  permitRequired?: boolean;
  hours?: string;
  phone?: string;
  website?: string;
  [key: string]: unknown;
}

export interface Facility {
  /** Stable id, e.g. "osm-w123456" or "nycparks-M010". */
  id: string;
  /** Facility/park name; falls back to "Public Tennis Courts". */
  name: string;
  /** WGS84 centroid of the facility. */
  lat: number;
  lng: number;
  /** Number of courts at the facility, >= 1. */
  courtCount: number;
  surface: Surface;
  lighted: boolean | null;
  indoor: boolean | null;
  access: Access;
  fee: boolean | null;
  address: string | null;
  city: string | null;
  state: StateCode;
  source: DataSource;
  tags: FacilityTags;
}

export interface CourtsFile {
  region: Region;
  attribution: string;
  facilities: Facility[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RegionConfig {
  region: Region;
  label: string;
  center: LatLng;
  zoom: number;
}

export const REGIONS: Record<Region, RegionConfig> = {
  az: {
    region: 'az',
    label: 'Arizona',
    center: { lat: 33.45, lng: -112.07 },
    zoom: 10,
  },
  ny: {
    region: 'ny',
    label: 'New York',
    // Statewide data, but the default view centers on NYC.
    center: { lat: 40.73, lng: -73.98 },
    zoom: 11,
  },
  ca: {
    region: 'ca',
    label: 'California',
    center: { lat: 34.05, lng: -118.24 },
    zoom: 9,
  },
  fl: {
    region: 'fl',
    label: 'Florida',
    center: { lat: 27.6, lng: -81.5 },
    zoom: 7,
  },
  nm: {
    region: 'nm',
    label: 'New Mexico',
    center: { lat: 34.5, lng: -106.1 },
    zoom: 7,
  },
  elp: {
    region: 'elp',
    label: 'El Paso, TX',
    center: { lat: 31.78, lng: -106.42 },
    zoom: 11,
  },
};

export const DEFAULT_REGION: Region = 'az';

/** Region slugs that shipped in earlier releases, mapped to their replacements. */
const LEGACY_REGION_SLUGS: Record<string, Region> = {
  nyc: 'ny',
};

/**
 * Resolve a possibly-stale region slug (e.g. one persisted in storage by an
 * older release) to a current Region. Returns null for unknown values so the
 * caller can pick its own fallback.
 */
export function resolveRegionSlug(value: string): Region | null {
  if (Object.prototype.hasOwnProperty.call(REGIONS, value)) {
    return value as Region;
  }
  return LEGACY_REGION_SLUGS[value] ?? null;
}
