/**
 * Map a geolocation fix to the region (state) that contains it.
 * Pure TypeScript — no React, DOM, or Leaflet — portable to React Native.
 */

import { haversineMiles } from './distance';
import { REGIONS, type LatLngBounds, type Region, type RegionConfig } from './types';

/** Fallback radius: how close (miles) a fix must be to a region's center to
 * count as "in" that region when no bounding box contains it. */
const NEAREST_CENTER_MAX_MILES = 100;

function contains(bounds: LatLngBounds, lat: number, lng: number): boolean {
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

/**
 * Return the region whose area contains the given point, or null when the
 * point is not plausibly in any region (stay on the current one).
 *
 * State bounding boxes overlap near borders, so when several contain the
 * point the one with the nearest configured center wins (e.g. a fix in DC
 * matches both DC's and Maryland's boxes — DC's center is closer, so DC is
 * chosen; a fix in Manhattan matches both New York's and New Jersey's
 * boxes — NY's NYC center wins). If no box contains the point (offshore,
 * just across a land border), the nearest region center within ~100 miles
 * is used as a fallback.
 */
export function regionForLocation(lat: number, lng: number): Region | null {
  let best: RegionConfig | null = null;
  let bestMiles = Infinity;
  for (const config of Object.values(REGIONS)) {
    if (contains(config.bounds, lat, lng)) {
      const miles = haversineMiles({ lat, lng }, config.center);
      if (miles < bestMiles) {
        best = config;
        bestMiles = miles;
      }
    }
  }
  if (best !== null) return best.region;

  let nearest: Region | null = null;
  let nearestMiles = NEAREST_CENTER_MAX_MILES;
  for (const config of Object.values(REGIONS)) {
    const miles = haversineMiles({ lat, lng }, config.center);
    if (miles < nearestMiles) {
      nearest = config.region;
      nearestMiles = miles;
    }
  }
  return nearest;
}

/**
 * True when a fix is plausibly inside the given region — used to decide
 * whether an auto-switch is needed at all.
 */
export function isLocationInRegion(
  region: Region,
  lat: number,
  lng: number
): boolean {
  return contains(REGIONS[region].bounds, lat, lng);
}
