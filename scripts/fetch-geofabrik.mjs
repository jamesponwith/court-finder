#!/usr/bin/env node
/**
 * fetch-geofabrik.mjs — build the raw extracts from Geofabrik state PBFs instead of Overpass.
 *
 * Same outputs as fetch-osm.mjs (data/raw/osm-<slug>.json and osm-<slug>-places.json in Overpass
 * JSON shape), so normalize.mjs is unchanged. Why: the public Overpass instances rate-limit
 * (overpass-api.de answered a 50-state batch with a blanket 406 for hours) and mirrors with a
 * stale area index return truncated states. Geofabrik extracts are complete, daily, and free of
 * quotas; osmium filters a state in seconds.
 *
 * Needs osmium-tool (brew install osmium-tool). Each PBF is deleted after use (CA is ~1.1 GB).
 *
 * Usage:  node scripts/fetch-geofabrik.mjs [slug ...] [--force] [--keep-pbf]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REGIONS } from "./regions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data", "raw");
const PBF = join(RAW, "pbf");

const args = process.argv.slice(2);
const force = args.includes("--force");
const keepPbf = args.includes("--keep-pbf");
const slugs = args.filter((a) => !a.startsWith("--"));
const regions = slugs.length
  ? slugs.map((s) => {
      const r = REGIONS.find((r) => r.slug === s);
      if (!r) {
        console.error(`unknown region "${s}"`);
        process.exit(1);
      }
      return r;
    })
  : REGIONS;

// Geofabrik names states by their plain English name: "new-york", "district-of-columbia".
const geofabrikName = (region) =>
  region.name.replace(/\s*\(.*\)$/, "").trim().toLowerCase().replace(/\s+/g, "-");

const run = (cmd, argv) => execFileSync(cmd, argv, { stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1 << 30 });

/** GeoJSON feature -> { type, id, tags, lat/lon or center, bounds } in Overpass's shape. */
function toElement(feature) {
  const props = { ...feature.properties };
  const uid = String(feature.id ?? ""); // "n123" | "w456" | "r789" from --add-unique-id=type_id
  const type = { n: "node", w: "way", r: "relation" }[uid[0]];
  const id = Number(uid.slice(1));
  if (!type || !Number.isFinite(id)) return null;
  let minlat = Infinity, minlon = Infinity, maxlat = -Infinity, maxlon = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === "number") {
      const [lon, lat] = c;
      if (lat < minlat) minlat = lat;
      if (lat > maxlat) maxlat = lat;
      if (lon < minlon) minlon = lon;
      if (lon > maxlon) maxlon = lon;
    } else for (const x of c) walk(x);
  };
  walk(feature.geometry.coordinates);
  if (!Number.isFinite(minlat)) return null;
  const center = { lat: (minlat + maxlat) / 2, lon: (minlon + maxlon) / 2 };
  const el = { type, id, tags: props, bounds: { minlat, minlon, maxlat, maxlon } };
  if (type === "node") {
    el.lat = center.lat;
    el.lon = center.lon;
  } else el.center = center;
  return el;
}

function exportFeatures(pbf, filters, out) {
  const filtered = out + ".pbf";
  const geojson = out + ".geojson";
  // (referenced nodes are kept by default; -R would omit them and leave ways without geometry)
  run("osmium", ["tags-filter", "--overwrite", "-o", filtered, pbf, ...filters]);
  run("osmium", [
    "export",
    "--overwrite",
    "-f",
    "geojson",
    "--add-unique-id=type_id",
    "--geometry-types=point,linestring,polygon",
    "-o",
    geojson,
    filtered,
  ]);
  const features = JSON.parse(readFileSync(geojson, "utf8")).features;
  rmSync(filtered);
  rmSync(geojson);
  return features.map(toElement).filter(Boolean);
}

mkdirSync(PBF, { recursive: true });
const failed = [];
for (const region of regions) {
  const courtsFile = join(RAW, `osm-${region.slug}.json`);
  const placesFile = join(RAW, `osm-${region.slug}-places.json`);
  if (!force && existsSync(courtsFile) && existsSync(placesFile)) {
    console.log(`[${region.slug}] have raw — skipping (use --force)`);
    continue;
  }
  const name = geofabrikName(region);
  const pbf = join(PBF, `${region.slug}.osm.pbf`);
  console.log(`[${region.slug}] ${region.name}`);
  try {
    if (!existsSync(pbf)) {
      const url = `https://download.geofabrik.de/north-america/us/${name}-latest.osm.pbf`;
      console.log(`  downloading ${url}`);
      run("curl", ["-sSL", "--fail", "--retry", "3", "-o", pbf, url]);
    }
    // Courts: any sport value containing our tokens; normalize.mjs re-checks exact tokens.
    const courts = exportFeatures(pbf, ["nwr/sport=*tennis*", "nwr/sport=*pickleball*"], join(PBF, `${region.slug}-courts`));
    writeFileSync(courtsFile, JSON.stringify({ elements: courts }));
    console.log(`  courts: wrote ${courtsFile} (${courts.length} elements)`);
    // Places: same named-place set as fetch-osm.mjs's placesQuery, ways + relations only.
    const places = exportFeatures(
      pbf,
      [
        "wr/leisure=park,garden,sports_centre,recreation_ground,golf_course",
        "wr/landuse=recreation_ground,residential",
        "wr/amenity=school,college,university",
      ],
      join(PBF, `${region.slug}-places`)
    ).filter((el) => el.type !== "node" && el.tags.name);
    writeFileSync(placesFile, JSON.stringify({ elements: places }));
    console.log(`  places: wrote ${placesFile} (${places.length} elements)`);
    if (!keepPbf) rmSync(pbf);
  } catch (e) {
    console.error(`[${region.slug}] FAILED: ${e.message}`);
    failed.push(region.slug);
  }
}
if (failed.length) {
  console.error(`failed: ${failed.join(" ")}`);
  process.exit(2);
}
console.log("done — next: node scripts/normalize.mjs");
