/**
 * Region data loading. Pure TypeScript — the fetch implementation is
 * injected so this module works in the browser, React Native, or Node.
 */

import type { CourtsFile, Facility, FacilityTags, Region } from './types';

/** Minimal fetch shape — satisfied by window.fetch and RN's fetch. */
export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export class DataLoadError extends Error {
  readonly region: Region;

  constructor(region: Region, message: string) {
    super(message);
    this.name = 'DataLoadError';
    this.region = region;
  }
}

export function dataUrlForRegion(region: Region, baseUrl = '/data'): string {
  return `${baseUrl}/courts-${region}.json`;
}

const SURFACES: ReadonlySet<Facility['surface']> = new Set([
  'hard',
  'clay',
  'grass',
  'unknown',
]);
const ACCESS_VALUES: ReadonlySet<Facility['access']> = new Set([
  'public',
  'customers',
  'private',
  'unknown',
]);
const SOURCES: ReadonlySet<Facility['source']> = new Set([
  'osm',
  'nycparks',
  'merged',
]);

function isFacility(value: unknown): value is Facility {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.id === 'string' &&
    typeof f.name === 'string' &&
    typeof f.lat === 'number' &&
    Number.isFinite(f.lat) &&
    typeof f.lng === 'number' &&
    Number.isFinite(f.lng) &&
    typeof f.courtCount === 'number' &&
    Number.isFinite(f.courtCount) &&
    typeof f.state === 'string'
  );
}

/**
 * Coerce a structurally-valid record into the full Facility contract the
 * render path relies on: `tags` is always an object, boolean-or-null fields
 * never hold junk, and the enum-ish fields only hold known values (an
 * unrecognized surface/access/source would otherwise render as an
 * `undefined` label, and a missing `tags` would crash CourtCard/CourtDetail).
 */
function normalizeFacility(f: Facility): Facility {
  const raw = f as Facility & Record<string, unknown>;
  const tags: FacilityTags =
    typeof raw.tags === 'object' && raw.tags !== null && !Array.isArray(raw.tags)
      ? raw.tags
      : {};
  return {
    ...f,
    courtCount: Math.max(1, Math.round(f.courtCount)),
    surface: SURFACES.has(f.surface) ? f.surface : 'unknown',
    lighted: typeof raw.lighted === 'boolean' ? raw.lighted : null,
    indoor: typeof raw.indoor === 'boolean' ? raw.indoor : null,
    access: ACCESS_VALUES.has(f.access) ? f.access : 'unknown',
    fee: typeof raw.fee === 'boolean' ? raw.fee : null,
    address: typeof raw.address === 'string' ? raw.address : null,
    city: typeof raw.city === 'string' ? raw.city : null,
    source: SOURCES.has(f.source) ? f.source : 'osm',
    tags,
  };
}

function parseCourtsFile(region: Region, raw: unknown): CourtsFile {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataLoadError(region, 'Court data is not an object');
  }
  const file = raw as Record<string, unknown>;
  if (!Array.isArray(file.facilities)) {
    throw new DataLoadError(region, 'Court data has no facilities array');
  }
  const facilities = file.facilities.filter(isFacility).map(normalizeFacility);
  return {
    region,
    attribution:
      typeof file.attribution === 'string'
        ? file.attribution
        : '© OpenStreetMap contributors (ODbL)',
    facilities,
  };
}

/**
 * Load and lightly validate the courts file for a region.
 * Throws DataLoadError on network failure or malformed payloads.
 */
export async function loadRegion(
  region: Region,
  fetchFn: FetchLike,
  baseUrl = '/data'
): Promise<CourtsFile> {
  const url = dataUrlForRegion(region, baseUrl);
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchFn(url);
  } catch (cause) {
    throw new DataLoadError(
      region,
      `Network error while loading ${url}: ${String(cause)}`
    );
  }
  if (!response.ok) {
    throw new DataLoadError(
      region,
      `Failed to load ${url} (HTTP ${response.status})`
    );
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new DataLoadError(region, `Court data at ${url} is not valid JSON`);
  }
  return parseCourtsFile(region, raw);
}
