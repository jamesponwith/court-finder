/**
 * Data contract for /data/courts-az.json and /data/courts-nyc.json.
 *
 * This module is pure TypeScript — no React, no DOM — so it can be ported
 * to React Native (or any other runtime) as-is.
 */

export type Region = 'az' | 'nyc';

export type Surface = 'hard' | 'clay' | 'grass' | 'unknown';

export type Access = 'public' | 'customers' | 'private' | 'unknown';

export type StateCode = 'AZ' | 'NY';

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
  nyc: {
    region: 'nyc',
    label: 'New York City',
    center: { lat: 40.73, lng: -73.98 },
    zoom: 11,
  },
};

export const DEFAULT_REGION: Region = 'az';
