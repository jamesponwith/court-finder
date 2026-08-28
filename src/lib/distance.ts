/**
 * Great-circle distance helpers. Pure TypeScript — portable to React Native.
 */

import type { LatLng } from './types';

const EARTH_RADIUS_MILES = 3958.7613;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Haversine distance between two WGS84 points, in statute miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "0.4 mi", "3.2 mi", "12 mi" — friendly, short distance label. */
export function formatMiles(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return '';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
