/**
 * Filtering and sorting for court facilities.
 * Pure TypeScript — no React, no DOM — portable to React Native.
 */

import { haversineMiles } from './distance';
import type { Facility, LatLng, Surface } from './types';

export type SurfaceFilter = Surface | 'all';

export interface CourtFilters {
  /** Only facilities known to have lights. */
  lightedOnly: boolean;
  /** Only facilities known to be indoor. */
  indoorOnly: boolean;
  /** Restrict to a single surface ('all' disables). */
  surface: SurfaceFilter;
  /** Minimum number of courts at the facility. */
  minCourts: number;
  /** Case-insensitive text search over name, city, and address. */
  query: string;
}

export const DEFAULT_FILTERS: CourtFilters = {
  lightedOnly: false,
  indoorOnly: false,
  surface: 'all',
  minCourts: 1,
  query: '',
};

export function isDefaultFilters(filters: CourtFilters): boolean {
  return (
    !filters.lightedOnly &&
    !filters.indoorOnly &&
    filters.surface === 'all' &&
    filters.minCourts <= 1 &&
    filters.query.trim() === ''
  );
}

function matchesQuery(facility: Facility, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  const haystack = [facility.name, facility.city ?? '', facility.address ?? '']
    .join(' ')
    .toLowerCase();
  return q
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

/** Apply all filters; returns a new array, input untouched. */
export function applyFilters(
  facilities: readonly Facility[],
  filters: CourtFilters
): Facility[] {
  return facilities.filter((f) => {
    if (filters.lightedOnly && f.lighted !== true) return false;
    if (filters.indoorOnly && f.indoor !== true) return false;
    if (filters.surface !== 'all' && f.surface !== filters.surface) return false;
    if (f.courtCount < filters.minCourts) return false;
    if (!matchesQuery(f, filters.query)) return false;
    return true;
  });
}

/** A facility annotated with distance from the user, when known. */
export interface FacilityWithDistance {
  facility: Facility;
  /** Miles from `origin`; null when no origin was provided. */
  distanceMiles: number | null;
}

/**
 * Annotate facilities with distance from `origin` and sort:
 * nearest-first when an origin is known, alphabetical otherwise.
 */
export function sortByDistance(
  facilities: readonly Facility[],
  origin: LatLng | null
): FacilityWithDistance[] {
  const annotated: FacilityWithDistance[] = facilities.map((facility) => ({
    facility,
    distanceMiles:
      origin === null
        ? null
        : haversineMiles(origin, { lat: facility.lat, lng: facility.lng }),
  }));

  if (origin === null) {
    annotated.sort((a, b) => a.facility.name.localeCompare(b.facility.name));
  } else {
    annotated.sort(
      (a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity)
    );
  }
  return annotated;
}

/** Convenience: filter, annotate with distance, and sort in one pass. */
export function filterAndSort(
  facilities: readonly Facility[],
  filters: CourtFilters,
  origin: LatLng | null
): FacilityWithDistance[] {
  return sortByDistance(applyFilters(facilities, filters), origin);
}
