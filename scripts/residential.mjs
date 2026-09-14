#!/usr/bin/env node
/**
 * residential.mjs — tag likely backyard courts so consumers can hide them.
 *
 * An OSM tennis pitch with no name of its own (so it carries the pipeline
 * fallback name or a geocode-derived "Tennis Courts · <road>") and only one
 * or two courts, or a small one named only after its subdivision, is in
 * practice a court in someone's yard. Listing it sends
 * players to private property. Sets tags.context = "residential"; both the
 * web app and the mobile app drop those at load. Facilities already flagged
 * with another context (e.g. "school") are left alone.
 *
 * ponytail: name-shape heuristic. OSM building tags near the court were
 * tested (AZ, 40 m) and are too sparse to do better; revisit with parcel data
 * if a real neighborhood court gets hidden.
 *
 * Used by normalize.mjs as the last enrichment stage, and runnable on its own
 * to backfill already-published files (additive: never clears tags normalize.mjs
 * set from raw data, which knows more than the published name does):
 *   node scripts/residential.mjs      # rewrites public/data/courts-*.json
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const FALLBACK_NAME = "Public Tennis Courts";

export function isResidentialGuess(f) {
  // _residentialName: normalize.mjs named it after a containing residential
  // subdivision box ("<Subdivision> Tennis Courts"); a satellite spot check
  // showed those single courts are usually backyards too.
  const unnamed = f.name === FALLBACK_NAME || f.name.includes(" · ") || f._residentialName;
  return unnamed && f.courtCount <= 2 && !f.tags?.context;
}

/** Mutates facilities; returns how many were tagged. */
export function flagResidential(facilities) {
  let n = 0;
  for (const f of facilities) {
    if (!isResidentialGuess(f)) continue;
    f.tags = { ...(f.tags || {}), context: "residential" };
    n++;
  }
  return n;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
  let total = 0, tagged = 0;
  for (const file of readdirSync(dir).filter((f) => /^courts-\w+\.json$/.test(f))) {
    const path = join(dir, file);
    const data = JSON.parse(readFileSync(path, "utf8"));
    const n = flagResidential(data.facilities);
    writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
    total += data.facilities.length; tagged += n;
    console.log(`${file}: tagged ${n} of ${data.facilities.length}`);
  }
  console.log(`total: tagged ${tagged} of ${total} facilities residential`);
  // self-check
  const ok = isResidentialGuess({ name: "Tennis Courts · Elm St", courtCount: 1, tags: {} }) &&
    !isResidentialGuess({ name: "Tennis Courts · Elm St", courtCount: 3, tags: {} }) &&
    !isResidentialGuess({ name: "Elm Park Tennis Courts", courtCount: 1, tags: {} }) &&
    !isResidentialGuess({ name: FALLBACK_NAME, courtCount: 1, tags: { context: "school" } }) &&
    isResidentialGuess({ name: "Telesis Estates Tennis Courts", courtCount: 1, tags: {}, _residentialName: true });
  if (!ok) { console.error("residential self-check FAILED"); process.exit(1); }
}
