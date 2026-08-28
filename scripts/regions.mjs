/**
 * regions.mjs — Court Finder region configuration.
 *
 * Single source of truth for the data pipeline's regions, shared by
 * scripts/fetch-osm.mjs, scripts/normalize.mjs, and scripts/geocode.mjs.
 * Adding a region = adding one entry here, running fetch-osm.mjs for it,
 * then normalize.mjs (and optionally geocode.mjs + normalize.mjs again).
 *
 * Fields:
 *   slug        region id; also names the raw/output files
 *               (data/raw/osm-<slug>.json, public/data/courts-<slug>.json).
 *               The slug is the contract with the app — do not rename casually.
 *   name        human-readable label (docs/logs only).
 *   state       2-letter state code stamped on every facility.
 *   bounds      rough sanity-check bounds; every facility must fall inside.
 *   overpass    how fetch-osm.mjs scopes the Overpass queries:
 *                 { iso: "US-XX" }              -> area["ISO3166-2"="US-XX"]["admin_level"="4"]
 *                 { bbox: [s, w, n, e] }        -> plain bounding-box query
 *               (elp uses a bbox: resolving "El Paso County" by name is
 *               ambiguous — Colorado has one too.)
 *   placeFiles  ordered list of `out tags bb` extracts consumed by the
 *               containment-name enrichment stage (missing files are skipped).
 *               az keeps its historical two-file split (-parks + -places);
 *               newer regions use a single combined -places extract.
 *   nycParksMerge  true -> merge data/raw/nyc-parks-tennis.json (NYC Parks
 *               open-data directory) into this region's facilities and set
 *               tags.permitRequired on outdoor public Parks courts. Proximity
 *               matching (150 m) only ever touches facilities near the city,
 *               so this is safe on the statewide ny region.
 */

export const REGIONS = [
  {
    slug: "az",
    name: "Arizona",
    state: "AZ",
    bounds: { latMin: 31, latMax: 37.1, lngMin: -115, lngMax: -109 },
    overpass: { iso: "US-AZ" },
    placeFiles: ["osm-az-parks.json", "osm-az-places.json"],
    nycParksMerge: false,
  },
  {
    slug: "ny",
    name: "New York (statewide; replaces the old nyc region)",
    state: "NY",
    bounds: { latMin: 40.4, latMax: 45.05, lngMin: -79.9, lngMax: -71.8 },
    overpass: { iso: "US-NY" },
    placeFiles: ["osm-ny-places.json"],
    nycParksMerge: true,
  },
  {
    slug: "ca",
    name: "California",
    state: "CA",
    bounds: { latMin: 32.5, latMax: 42.1, lngMin: -124.5, lngMax: -114.1 },
    overpass: { iso: "US-CA" },
    placeFiles: ["osm-ca-places.json"],
    nycParksMerge: false,
  },
  {
    slug: "fl",
    name: "Florida",
    state: "FL",
    bounds: { latMin: 24.4, latMax: 31.1, lngMin: -87.7, lngMax: -79.9 },
    overpass: { iso: "US-FL" },
    placeFiles: ["osm-fl-places.json"],
    nycParksMerge: false,
  },
  {
    slug: "nm",
    name: "New Mexico",
    state: "NM",
    bounds: { latMin: 31.3, latMax: 37.1, lngMin: -109.1, lngMax: -103.0 },
    overpass: { iso: "US-NM" },
    placeFiles: ["osm-nm-places.json"],
    nycParksMerge: false,
  },
  {
    slug: "elp",
    name: "El Paso, TX (metro)",
    state: "TX",
    bounds: { latMin: 31.2, latMax: 32.2, lngMin: -106.8, lngMax: -105.4 },
    overpass: { bbox: [31.2, -106.8, 32.2, -105.4] },
    placeFiles: ["osm-elp-places.json"],
    nycParksMerge: false,
    // The fetch bbox unavoidably spans the border; these facilities are in
    // Ciudad Juárez, MX (country verified via Nominatim reverse geocoding).
    excludeIds: [
      "osm-w302630082", // San Miguel Tennis Club
      "osm-w614122244", // UACJ CU gym
      "osm-w666735413", // Universidad Interamericana del Norte
      "osm-w756121443", // Parque Ignacio Allende
      "osm-w1419447342", // south Juárez public courts
      "osm-w1419447343", // south Juárez public courts (adjacent)
      "osm-w1467132743", // Preparatoria El Chamizal
      "osm-w1529424254", // Pradera Dorada, Juárez
      "osm-w1529425790", // Unidad Deportiva Oriente Siglo XXI
    ],
  },
];
