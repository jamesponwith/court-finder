#!/usr/bin/env node
/**
 * geocode.mjs — Court Finder data pipeline (stage 3: reverse-geocode).
 *
 * Reverse-geocodes facilities that are still fallback-named ("Public Tennis
 * Courts") after normalize.mjs's containment enrichment, across every region
 * configured in scripts/regions.mjs, using the public Nominatim API. Responses are cached verbatim in
 * data/raw/geocode-cache.json keyed by facility id; normalize.mjs consumes
 * that cache on its next run to derive names/addresses/cities.
 *
 * Usage:   node scripts/geocode.mjs [--max=N] [--retry-errors]
 *   --max=N         stop after N new lookups (default: unlimited)
 *   --retry-errors  re-request ids whose cached entry is an error record
 *
 * Resumable: every response (including errors) is cached and flushed to disk
 * as it arrives; already-cached ids are skipped, so re-run until it reports
 * "0 remaining". Then re-run `node scripts/normalize.mjs`.
 *
 * NOMINATIM USAGE POLICY (https://operations.osmfoundation.org/policies/nominatim/):
 * absolute maximum 1 request per second, identify the app via User-Agent.
 * This script waits >= 1.1 s between requests and sends a descriptive UA.
 *
 * Plain Node (>= 18, for global fetch), no npm dependencies.
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REGIONS } from "./regions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "data");
const CACHE_FILE = join(ROOT, "data", "raw", "geocode-cache.json");

const FALLBACK_NAME = "Public Tennis Courts";
const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT =
  "AllAboutTennis-CourtFinder/1.0 (court data enrichment; one-time batch)";
const DELAY_MS = 1100; // policy: absolute max 1 req/s — stay under it

const args = process.argv.slice(2);
const maxArg = args.find((a) => a.startsWith("--max="));
const MAX = maxArg ? parseInt(maxArg.split("=")[1], 10) : Infinity;
const RETRY_ERRORS = args.includes("--retry-errors");

// ------------------------------------------------------------- work list

function loadTargets() {
  const targets = [];
  const perRegion = [];
  for (const { slug } of REGIONS) {
    const file = join(OUT, `courts-${slug}.json`);
    if (!existsSync(file)) {
      console.error(`missing ${file} — run node scripts/normalize.mjs first`);
      process.exit(1);
    }
    const { facilities } = JSON.parse(readFileSync(file, "utf8"));
    let n = 0;
    for (const f of facilities) {
      if (f.name === FALLBACK_NAME) {
        targets.push({ id: f.id, lat: f.lat, lng: f.lng });
        n++;
      }
    }
    perRegion.push(`${slug}: ${n}`);
  }
  console.log(`fallback-named per region: ${perRegion.join(", ")}`);
  return targets;
}

function loadCache() {
  if (!existsSync(CACHE_FILE)) return {};
  return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
}

function saveCache(cache) {
  // Write via a temp file so an interrupt never truncates the cache.
  const tmp = CACHE_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(cache, null, 1) + "\n");
  renameSync(tmp, CACHE_FILE);
}

// ------------------------------------------------------------- main loop

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(lat, lng) {
  const url = `${ENDPOINT}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const body = await res.json();
  if (body.error) return { error: String(body.error) };
  return body;
}

const cache = loadCache();
const targets = loadTargets();
const pending = targets.filter(
  (t) => !(t.id in cache) || (RETRY_ERRORS && cache[t.id]?.error)
);
console.log(
  `${targets.length} fallback-named facilities; ${targets.length - pending.length} cached, ` +
    `${pending.length} remaining` + (Number.isFinite(MAX) ? ` (doing at most ${MAX})` : "")
);

let done = 0;
for (const t of pending) {
  if (done >= MAX) break;
  let result;
  try {
    result = await lookup(t.lat, t.lng);
  } catch (e) {
    result = { error: String(e && e.message ? e.message : e) };
  }
  cache[t.id] = result;
  done++;
  saveCache(cache); // flush every response: safe to kill/re-run at any time
  const label = result.error
    ? `ERROR ${result.error}`
    : result.name || result.display_name?.slice(0, 60) || "(unnamed)";
  console.log(`[${done}/${Math.min(pending.length, MAX)}] ${t.id}: ${label}`);
  await sleep(DELAY_MS);
}

const stillPending = targets.filter((t) => !(t.id in cache)).length;
console.log(
  `done: ${done} lookups this run; cache now covers ${targets.length - stillPending}/` +
    `${targets.length} targets (${stillPending} remaining)` +
    (stillPending ? " — re-run to continue" : " — now re-run node scripts/normalize.mjs")
);
