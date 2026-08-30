/**
 * Data contract for the /data/courts-<region>.json files.
 *
 * This module is pure TypeScript — no React, no DOM — so it can be ported
 * to React Native (or any other runtime) as-is.
 */

/** Region slug: the lowercase USPS code of a US state (or 'dc'). */
export type Region =
  | 'al'
  | 'ak'
  | 'az'
  | 'ar'
  | 'ca'
  | 'co'
  | 'ct'
  | 'de'
  | 'dc'
  | 'fl'
  | 'ga'
  | 'hi'
  | 'id'
  | 'il'
  | 'in'
  | 'ia'
  | 'ks'
  | 'ky'
  | 'la'
  | 'me'
  | 'md'
  | 'ma'
  | 'mi'
  | 'mn'
  | 'ms'
  | 'mo'
  | 'mt'
  | 'ne'
  | 'nv'
  | 'nh'
  | 'nj'
  | 'nm'
  | 'ny'
  | 'nc'
  | 'nd'
  | 'oh'
  | 'ok'
  | 'or'
  | 'pa'
  | 'ri'
  | 'sc'
  | 'sd'
  | 'tn'
  | 'tx'
  | 'ut'
  | 'vt'
  | 'va'
  | 'wa'
  | 'wv'
  | 'wi'
  | 'wy';

export type Surface = 'hard' | 'clay' | 'grass' | 'unknown';

export type Access = 'public' | 'customers' | 'private' | 'unknown';

/**
 * Two-letter USPS state/district code (e.g. "AZ", "DC"). With national
 * coverage this is any USPS code; a plain string keeps the data contract
 * permissive (the loader only checks it is a string).
 */
export type StateCode = string;

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

/** Approximate WGS84 bounding box (degrees). */
export interface LatLngBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface RegionConfig {
  region: Region;
  label: string;
  center: LatLng;
  zoom: number;
  /**
   * Approximate bounding box of the region, used to decide which region a
   * geolocation fix falls in (see regionForLocation in geo.ts). Boxes may
   * overlap at state borders; the smallest containing box wins.
   */
  bounds: LatLngBounds;
}

export const REGIONS: Record<Region, RegionConfig> = {
  al: {
    region: 'al',
    label: 'Alabama',
    center: { lat: 32.8, lng: -86.8 },
    zoom: 7,
    bounds: { south: 30.14, west: -88.48, north: 35.01, east: -84.89 },
  },
  ak: {
    region: 'ak',
    label: 'Alaska',
    // Population center — Anchorage.
    center: { lat: 61.22, lng: -149.9 },
    zoom: 5,
    bounds: { south: 51.2, west: -179.15, north: 71.44, east: -129.98 },
  },
  az: {
    region: 'az',
    label: 'Arizona',
    center: { lat: 33.45, lng: -112.07 },
    zoom: 10,
    bounds: { south: 31.33, west: -114.82, north: 37.0, east: -109.04 },
  },
  ar: {
    region: 'ar',
    label: 'Arkansas',
    center: { lat: 34.75, lng: -92.29 },
    zoom: 7,
    // East edge pulled to the Mississippi River near Memphis so a fix in
    // Memphis, TN resolves to Tennessee, not Arkansas.
    bounds: { south: 33.0, west: -94.62, north: 36.5, east: -90.1 },
  },
  ca: {
    region: 'ca',
    label: 'California',
    center: { lat: 34.05, lng: -118.24 },
    zoom: 9,
    bounds: { south: 32.53, west: -124.42, north: 42.01, east: -114.13 },
  },
  co: {
    region: 'co',
    label: 'Colorado',
    center: { lat: 39.74, lng: -104.99 },
    zoom: 7,
    bounds: { south: 36.99, west: -109.06, north: 41.0, east: -102.04 },
  },
  ct: {
    region: 'ct',
    label: 'Connecticut',
    center: { lat: 41.62, lng: -72.73 },
    zoom: 9,
    bounds: { south: 40.98, west: -73.73, north: 42.05, east: -71.79 },
  },
  de: {
    region: 'de',
    label: 'Delaware',
    // Population center — Wilmington (also keeps a Wilmington fix resolving
    // to DE rather than Pennsylvania's overlapping box).
    center: { lat: 39.74, lng: -75.55 },
    zoom: 9,
    bounds: { south: 38.45, west: -75.79, north: 39.84, east: -75.05 },
  },
  dc: {
    region: 'dc',
    label: 'District of Columbia',
    center: { lat: 38.9, lng: -77.03 },
    zoom: 11,
    bounds: { south: 38.79, west: -77.12, north: 39.0, east: -76.91 },
  },
  fl: {
    region: 'fl',
    label: 'Florida',
    center: { lat: 27.6, lng: -81.5 },
    zoom: 7,
    bounds: { south: 24.5, west: -87.63, north: 31.0, east: -80.03 },
  },
  ga: {
    region: 'ga',
    label: 'Georgia',
    center: { lat: 33.75, lng: -84.39 },
    zoom: 7,
    bounds: { south: 30.36, west: -85.61, north: 35.0, east: -80.84 },
  },
  hi: {
    region: 'hi',
    label: 'Hawaii',
    // Centered on Honolulu.
    center: { lat: 21.31, lng: -157.86 },
    zoom: 7,
    bounds: { south: 18.9, west: -160.25, north: 22.24, east: -154.8 },
  },
  id: {
    region: 'id',
    label: 'Idaho',
    center: { lat: 44.07, lng: -114.74 },
    zoom: 6,
    bounds: { south: 41.99, west: -117.24, north: 49.0, east: -111.04 },
  },
  il: {
    region: 'il',
    label: 'Illinois',
    // Population center — Chicago (also keeps a St. Louis fix resolving to
    // Missouri rather than Illinois' overlapping box).
    center: { lat: 41.88, lng: -87.63 },
    zoom: 8,
    bounds: { south: 36.97, west: -91.51, north: 42.51, east: -87.02 },
  },
  in: {
    region: 'in',
    label: 'Indiana',
    center: { lat: 39.77, lng: -86.16 },
    zoom: 7,
    bounds: { south: 37.77, west: -88.1, north: 41.76, east: -84.78 },
  },
  ia: {
    region: 'ia',
    label: 'Iowa',
    center: { lat: 41.88, lng: -93.5 },
    zoom: 7,
    bounds: { south: 40.38, west: -96.64, north: 43.5, east: -90.14 },
  },
  ks: {
    region: 'ks',
    label: 'Kansas',
    center: { lat: 38.5, lng: -96.8 },
    zoom: 7,
    bounds: { south: 36.99, west: -102.05, north: 40.0, east: -94.59 },
  },
  ky: {
    region: 'ky',
    label: 'Kentucky',
    center: { lat: 37.8, lng: -85.3 },
    zoom: 7,
    // North edge stops just south of Cincinnati so a fix there resolves to
    // Ohio (Covington/Newport, KY fall back to Ohio's box — acceptable).
    bounds: { south: 36.5, west: -89.57, north: 39.05, east: -81.96 },
  },
  la: {
    region: 'la',
    label: 'Louisiana',
    center: { lat: 30.5, lng: -91.0 },
    zoom: 7,
    bounds: { south: 28.93, west: -94.04, north: 33.02, east: -88.82 },
  },
  me: {
    region: 'me',
    label: 'Maine',
    center: { lat: 44.7, lng: -69.2 },
    zoom: 7,
    bounds: { south: 42.98, west: -71.08, north: 47.46, east: -66.95 },
  },
  md: {
    region: 'md',
    label: 'Maryland',
    center: { lat: 39.2, lng: -76.8 },
    zoom: 8,
    bounds: { south: 37.91, west: -79.49, north: 39.72, east: -75.05 },
  },
  ma: {
    region: 'ma',
    label: 'Massachusetts',
    center: { lat: 42.3, lng: -71.5 },
    zoom: 8,
    bounds: { south: 41.24, west: -73.51, north: 42.89, east: -69.93 },
  },
  mi: {
    region: 'mi',
    label: 'Michigan',
    center: { lat: 43.9, lng: -84.8 },
    zoom: 6,
    bounds: { south: 41.7, west: -90.42, north: 48.3, east: -82.12 },
  },
  mn: {
    region: 'mn',
    label: 'Minnesota',
    center: { lat: 46.3, lng: -94.3 },
    zoom: 6,
    bounds: { south: 43.5, west: -97.24, north: 49.38, east: -89.48 },
  },
  ms: {
    region: 'ms',
    label: 'Mississippi',
    center: { lat: 32.7, lng: -89.7 },
    zoom: 7,
    bounds: { south: 30.17, west: -91.66, north: 35.0, east: -88.1 },
  },
  mo: {
    region: 'mo',
    label: 'Missouri',
    center: { lat: 38.5, lng: -92.5 },
    zoom: 7,
    bounds: { south: 35.99, west: -95.77, north: 40.61, east: -89.1 },
  },
  mt: {
    region: 'mt',
    label: 'Montana',
    center: { lat: 47.0, lng: -109.6 },
    zoom: 6,
    bounds: { south: 44.36, west: -116.05, north: 49.0, east: -104.04 },
  },
  ne: {
    region: 'ne',
    label: 'Nebraska',
    center: { lat: 41.3, lng: -98.0 },
    zoom: 7,
    bounds: { south: 39.99, west: -104.05, north: 43.0, east: -95.31 },
  },
  nv: {
    region: 'nv',
    label: 'Nevada',
    center: { lat: 38.8, lng: -116.42 },
    zoom: 6,
    bounds: { south: 35.0, west: -120.01, north: 42.0, east: -114.04 },
  },
  nh: {
    region: 'nh',
    label: 'New Hampshire',
    // Population center — Manchester (also keeps a Nashua fix resolving to
    // NH rather than Massachusetts' overlapping box).
    center: { lat: 42.99, lng: -71.46 },
    zoom: 8,
    bounds: { south: 42.7, west: -72.56, north: 45.31, east: -70.6 },
  },
  nj: {
    region: 'nj',
    label: 'New Jersey',
    center: { lat: 40.1, lng: -74.5 },
    zoom: 9,
    bounds: { south: 38.93, west: -75.56, north: 41.36, east: -73.89 },
  },
  nm: {
    region: 'nm',
    label: 'New Mexico',
    center: { lat: 34.5, lng: -106.1 },
    zoom: 7,
    // South edge sits just above El Paso so a fix there resolves to Texas;
    // the (nearly uninhabited) bootheel south of 31.79 falls outside.
    bounds: { south: 31.79, west: -109.05, north: 37.0, east: -103.0 },
  },
  ny: {
    region: 'ny',
    label: 'New York',
    // Statewide data, but the default view centers on NYC.
    center: { lat: 40.73, lng: -73.98 },
    zoom: 11,
    bounds: { south: 40.48, west: -79.76, north: 45.02, east: -71.86 },
  },
  nc: {
    region: 'nc',
    label: 'North Carolina',
    center: { lat: 35.5, lng: -79.4 },
    zoom: 7,
    bounds: { south: 33.84, west: -84.32, north: 36.59, east: -75.46 },
  },
  nd: {
    region: 'nd',
    label: 'North Dakota',
    // Population center — Fargo (also keeps a Fargo fix resolving to ND
    // rather than Minnesota's overlapping box).
    center: { lat: 46.88, lng: -96.79 },
    zoom: 7,
    bounds: { south: 45.94, west: -104.05, north: 49.0, east: -96.55 },
  },
  oh: {
    region: 'oh',
    label: 'Ohio',
    center: { lat: 40.2, lng: -82.7 },
    zoom: 7,
    bounds: { south: 38.4, west: -84.82, north: 41.98, east: -80.52 },
  },
  ok: {
    region: 'ok',
    label: 'Oklahoma',
    center: { lat: 35.5, lng: -97.5 },
    zoom: 7,
    bounds: { south: 33.62, west: -103.0, north: 37.0, east: -94.43 },
  },
  or: {
    region: 'or',
    label: 'Oregon',
    center: { lat: 44.0, lng: -120.55 },
    zoom: 6,
    bounds: { south: 41.99, west: -124.57, north: 46.29, east: -116.46 },
  },
  pa: {
    region: 'pa',
    label: 'Pennsylvania',
    // Population center — Philadelphia (also keeps a Philly fix resolving
    // to PA rather than New Jersey's overlapping box).
    center: { lat: 39.95, lng: -75.17 },
    zoom: 8,
    bounds: { south: 39.72, west: -80.52, north: 42.27, east: -74.69 },
  },
  ri: {
    region: 'ri',
    label: 'Rhode Island',
    center: { lat: 41.7, lng: -71.5 },
    zoom: 10,
    bounds: { south: 41.14, west: -71.86, north: 42.02, east: -71.12 },
  },
  sc: {
    region: 'sc',
    label: 'South Carolina',
    center: { lat: 34.0, lng: -81.0 },
    zoom: 7,
    // South edge stops just north of Savannah so a fix there resolves to
    // Georgia (Hilton Head at 32.16 is still inside).
    bounds: { south: 32.1, west: -83.35, north: 35.22, east: -78.54 },
  },
  sd: {
    region: 'sd',
    label: 'South Dakota',
    center: { lat: 44.4, lng: -100.3 },
    zoom: 7,
    bounds: { south: 42.48, west: -104.06, north: 45.95, east: -96.44 },
  },
  tn: {
    region: 'tn',
    label: 'Tennessee',
    center: { lat: 35.8, lng: -86.4 },
    zoom: 7,
    bounds: { south: 34.98, west: -90.31, north: 36.68, east: -81.65 },
  },
  tx: {
    region: 'tx',
    label: 'Texas',
    center: { lat: 31.0, lng: -99.0 },
    zoom: 6,
    bounds: { south: 25.84, west: -106.65, north: 36.5, east: -93.51 },
  },
  ut: {
    region: 'ut',
    label: 'Utah',
    center: { lat: 39.5, lng: -111.55 },
    zoom: 7,
    bounds: { south: 36.99, west: -114.05, north: 42.0, east: -109.04 },
  },
  vt: {
    region: 'vt',
    label: 'Vermont',
    center: { lat: 44.0, lng: -72.7 },
    zoom: 8,
    bounds: { south: 42.73, west: -73.44, north: 45.02, east: -71.46 },
  },
  va: {
    region: 'va',
    label: 'Virginia',
    center: { lat: 37.5, lng: -78.5 },
    zoom: 7,
    bounds: { south: 36.54, west: -83.68, north: 39.47, east: -75.24 },
  },
  wa: {
    region: 'wa',
    label: 'Washington',
    // Population center — Seattle (also keeps a Vancouver, WA fix resolving
    // to WA rather than Oregon's overlapping box).
    center: { lat: 47.6, lng: -122.33 },
    zoom: 7,
    bounds: { south: 45.54, west: -124.85, north: 49.0, east: -116.92 },
  },
  wv: {
    region: 'wv',
    label: 'West Virginia',
    center: { lat: 38.6, lng: -80.6 },
    zoom: 7,
    // North edge excludes the narrow northern panhandle so a fix in
    // Pittsburgh resolves to Pennsylvania (Wheeling falls back to Ohio's
    // box — acceptable).
    bounds: { south: 37.2, west: -82.64, north: 39.75, east: -77.72 },
  },
  wi: {
    region: 'wi',
    label: 'Wisconsin',
    center: { lat: 44.5, lng: -89.8 },
    zoom: 7,
    bounds: { south: 42.49, west: -92.89, north: 47.08, east: -86.25 },
  },
  wy: {
    region: 'wy',
    label: 'Wyoming',
    center: { lat: 43.0, lng: -107.6 },
    zoom: 7,
    bounds: { south: 40.99, west: -111.06, north: 45.01, east: -104.05 },
  },
};

export const DEFAULT_REGION: Region = 'az';

/** Region slugs that shipped in earlier releases, mapped to their replacements. */
const LEGACY_REGION_SLUGS: Record<string, Region> = {
  nyc: 'ny',
  // The El Paso, TX city region was folded into statewide Texas.
  elp: 'tx',
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
