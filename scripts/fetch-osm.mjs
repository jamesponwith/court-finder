#!/usr/bin/env node
/**
 * fetch-osm.mjs — Court Finder data pipeline (stage 1: fetch raw extracts).
 *
 * Downloads, per region, two Overpass extracts into data/raw/:
 *   osm-<slug>.json         all sport~tennis elements (`out center tags`)
 *   osm-<slug>-places.json  named park/garden/sports_centre/recreation_ground/
 *                           golf_course, school/college/university, and
 *                           residential-complex ways+relations (`out tags bb`),
 *                           consumed by normalize.mjs containment enrichment
 *
 * Usage:  node scripts/fetch-osm.mjs [slug ...] [--force]
 *   With no slugs, fetches every configured region. Existing files are
 *   skipped unless --force is given. Queries run strictly one at a time
 *   (Overpass fair-use), retrying once per endpoint and falling back from
 *   overpass-api.de to overpass.kumi.systems.
 *
 * State regions are scoped via area["ISO3166-2"="US-XX"]["admin_level"="4"];
 * bbox regions (elp) query a plain bounding box.
 *
 * Plain Node (>= 18, for global fetch), no npm dependencies.
 */

import { writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REGIONS } from "./regions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data", "raw");

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const USER_AGENT =
  "AllAboutTennis-CourtFinder/1.0 (court data pipeline; occasional batch)";
const PAUSE_MS = 5000; // between successive queries
const RETRY_PAUSE_MS = 30000; // before retrying a failed query

// ------------------------------------------------------------- queries

/** Overpass scope: "area(...)->.a;" prefix + per-statement suffix. */
function scopeOf(region) {
  const o = region.overpass;
  if (o.iso) {
    return {
      prefix: `area["ISO3166-2"="${o.iso}"]["admin_level"="4"]->.a;`,
      suffix: "(area.a)",
    };
  }
  const [s, w, n, e] = o.bbox;
  return { prefix: "", suffix: `(${s},${w},${n},${e})` };
}

function courtsQuery(region) {
  const { prefix, suffix } = scopeOf(region);
  return `[out:json][timeout:240];${prefix}nwr["sport"~"tennis"]${suffix};out center tags;`;
}

// Same named-place tag set the containment-enrichment stage already uses
// (see normalize.mjs / docs/DATA_SCHEMA.md): parks & gardens, sports centres,
// recreation grounds, golf courses, schools/colleges/universities, and named
// residential complexes. Ways+relations only — `out tags bb` has no bounds
// for nodes, so nodes would be dead weight.
function placesQuery(region) {
  const { prefix, suffix } = scopeOf(region);
  return (
    `[out:json][timeout:600];${prefix}(` +
    `wr["name"]["leisure"~"^(park|garden|sports_centre|recreation_ground|golf_course)$"]${suffix};` +
    `wr["name"]["landuse"~"^(recreation_ground|residential)$"]${suffix};` +
    `wr["name"]["amenity"~"^(school|college|university)$"]${suffix};` +
    `);out tags bb;`
  );
}

// ------------------------------------------------------------- fetching

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runQuery(query, label) {
  let lastErr;
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`  ${label}: ${endpoint} (attempt ${attempt})...`);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "data=" + encodeURIComponent(query),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const text = await res.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data.elements))
          throw new Error("no elements array in response");
        // Overpass reports runtime errors (e.g. timeouts) via `remark`
        // while still returning HTTP 200 and a (truncated) element list.
        if (data.remark && /error/i.test(data.remark))
          throw new Error(`Overpass remark: ${data.remark}`);
        return { data, text };
      } catch (e) {
        lastErr = e;
        console.warn(`  ${label}: FAILED (${e.message})`);
        if (attempt === 1) await sleep(RETRY_PAUSE_MS);
      }
    }
  }
  throw new Error(`${label}: all endpoints failed: ${lastErr.message}`);
}

async function fetchFile(file, query, label, force) {
  const path = join(RAW, file);
  if (existsSync(path) && !force) {
    console.log(`  ${label}: ${file} exists — skipping (use --force to refetch)`);
    return false;
  }
  const { data, text } = await runQuery(query, label);
  const tmp = path + ".tmp";
  writeFileSync(tmp, text);
  renameSync(tmp, path);
  console.log(
    `  ${label}: wrote ${file} (${data.elements.length} elements, ${(text.length / 1e6).toFixed(1)} MB)`
  );
  return true;
}

// ------------------------------------------------------------- main

const args = process.argv.slice(2);
const force = args.includes("--force");
const slugs = args.filter((a) => !a.startsWith("--"));
const regions = slugs.length
  ? slugs.map((s) => {
      const r = REGIONS.find((r) => r.slug === s);
      if (!r) {
        console.error(`unknown region "${s}" (known: ${REGIONS.map((r) => r.slug).join(", ")})`);
        process.exit(1);
      }
      return r;
    })
  : REGIONS;

mkdirSync(RAW, { recursive: true });
for (const region of regions) {
  console.log(`[${region.slug}] ${region.name}`);
  const didCourts = await fetchFile(
    `osm-${region.slug}.json`,
    courtsQuery(region),
    "courts",
    force
  );
  if (didCourts) await sleep(PAUSE_MS);
  const didPlaces = await fetchFile(
    `osm-${region.slug}-places.json`,
    placesQuery(region),
    "places",
    force
  );
  if (didPlaces) await sleep(PAUSE_MS);
}
console.log("done — next: node scripts/normalize.mjs");
