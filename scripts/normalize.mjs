#!/usr/bin/env node
/**
 * normalize.mjs — Court Finder data pipeline (stage 2: normalize).
 *
 * Reads:  data/raw/osm-az.json, data/raw/osm-nyc.json  (Overpass JSON)
 *         data/raw/nyc-parks-tennis.json               (optional; NYC Parks directory)
 *         data/raw/osm-az-parks.json, osm-nyc-parks.json (optional; named park/
 *           sports-centre bounding boxes from Overpass `out tags bb`, used to
 *           name facilities that would otherwise fall back to a generic name)
 * Writes: public/data/courts-az.json, public/data/courts-nyc.json
 *
 * Re-run: node scripts/normalize.mjs
 * Plain Node (>=16), no npm dependencies.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data", "raw");
const OUT = join(ROOT, "public", "data");

const ATTRIBUTION = "© OpenStreetMap contributors (ODbL); NYC Parks Open Data";
const CLUSTER_RADIUS_M = 120; // OSM element -> facility clustering
const MERGE_RADIUS_M = 150; // NYC Parks record -> OSM facility matching
const MAX_COURTS = 60;
const FALLBACK_NAME = "Public Tennis Courts";

const BOUNDS = {
  az: { latMin: 31, latMax: 37.1, lngMin: -115, lngMax: -109 },
  nyc: { latMin: 40.4, latMax: 41, lngMin: -74.3, lngMax: -73.6 },
};

// ---------------------------------------------------------------- helpers

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** sport tag contains "tennis" as an exact token (not table_tennis etc.) */
function isTennis(sport) {
  if (!sport) return false;
  return sport
    .split(";")
    .map((s) => s.trim().toLowerCase())
    .includes("tennis");
}

function mapSurface(raw) {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();
  if (/(clay|earth|dirt|har.?tru|fast.?dry)/.test(s)) return "clay";
  if (/grass/.test(s)) return "grass";
  if (/(hard|asphalt|acrylic|concrete|paved|tartan|all.?weather)/.test(s))
    return "hard";
  return "unknown";
}

function yesNo(v) {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).toLowerCase();
  if (s === "yes" || s === "true" || s === "1") return true;
  if (s === "no" || s === "false" || s === "0") return false;
  return null;
}

/** true if the element looks like it sits in a public-park context */
function parkContext(tags) {
  const name = (tags.name || "").toLowerCase();
  const operator = (tags.operator || "").toLowerCase();
  return (
    /\b(park|playground|recreation|rec center|schoolyard)\b/.test(name) ||
    /parks?\b|city of|county|recreation/.test(operator) ||
    tags["operator:type"] === "government" ||
    tags.ownership === "public" ||
    tags.owner === "public"
  );
}

// ---------------------------------------------------------------- OSM load

function loadOsmElements(file) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  const kept = [];
  const stats = { total: data.elements.length, notTennis: 0, noCoord: 0, nonCourt: 0, private: 0 };
  for (const el of data.elements) {
    const tags = el.tags || {};
    if (!isTennis(tags.sport)) {
      stats.notTennis++;
      continue;
    }
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") {
      stats.noCoord++;
      continue;
    }
    // Exclude clearly non-court elements: shop/club without a court-ish leisure value.
    const leisure = tags.leisure || "";
    const courtish = ["pitch", "sports_centre", "court", "track", "stadium", "sports_hall", "recreation_ground"].includes(leisure);
    if ((tags.shop || tags.club) && !courtish) {
      stats.nonCourt++;
      continue;
    }
    // Exclude private facilities.
    if (tags.access === "private" || tags.access === "no") {
      stats.private++;
      continue;
    }
    kept.push({ type: el.type, id: el.id, lat, lon, tags });
  }
  return { kept, stats };
}

// ------------------------------------------------------------- clustering

/** Greedy union of elements within CLUSTER_RADIUS_M using union-find + grid buckets. */
function clusterElements(elements) {
  const n = elements.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // Grid-bucket by ~CLUSTER_RADIUS_M cells so we only compare neighbors.
  const cellDeg = CLUSTER_RADIUS_M / 111000; // ~degrees latitude per cell
  const grid = new Map();
  const keyOf = (r, c) => r + ":" + c;
  elements.forEach((el, i) => {
    const r = Math.floor(el.lat / cellDeg);
    const c = Math.floor((el.lon * Math.cos((el.lat * Math.PI) / 180)) / cellDeg);
    const k = keyOf(r, c);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
    el._cell = [r, c];
  });
  elements.forEach((el, i) => {
    const [r, c] = el._cell;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const bucket = grid.get(keyOf(r + dr, c + dc));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          const o = elements[j];
          if (haversineM(el.lat, el.lon, o.lat, o.lon) <= CLUSTER_RADIUS_M) union(i, j);
        }
      }
    }
  });

  const clusters = new Map();
  elements.forEach((el, i) => {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(el);
  });
  return [...clusters.values()];
}

// -------------------------------------------------- cluster -> facility

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null, bestN = 0;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return best;
}

function facilityFromCluster(members, state) {
  const lat = members.reduce((s, m) => s + m.lat, 0) / members.length;
  const lng = members.reduce((s, m) => s + m.lon, 0) / members.length;

  const names = members.map((m) => m.tags.name).filter(Boolean);
  // Prefer a facility-level name (leisure=sports_centre) over individual
  // court/stadium names, e.g. "USTA Billie Jean King National Tennis Center"
  // over its member "Stadium 17".
  const centreNames = members
    .filter((m) => m.tags.leisure === "sports_centre" && m.tags.name)
    .map((m) => m.tags.name);
  // Among sports-centre names, a tennis-specific one beats a generic one
  // ("USTA Billie Jean King National Tennis Center" over "Chase Center").
  const tennisCentreNames = centreNames.filter((n) => /tennis|racquet|racket/i.test(n));
  const name = tennisCentreNames.length
    ? mostCommon(tennisCentreNames)
    : centreNames.length
      ? mostCommon(centreNames)
      : names.length
        ? mostCommon(names)
        : null;

  // courtCount: number of leisure=pitch members, or an explicit courts tag.
  // `capacity` on stadiums is SPECTATOR capacity (Arthur Ashe: 23771), so it
  // is only trusted on leisure=pitch elements with a plausible court count.
  const pitchCount = members.filter((m) => m.tags.leisure === "pitch").length;
  let tagged = 0;
  for (const m of members) {
    for (const k of ["courts", "court:count"]) {
      const v = parseInt(m.tags[k], 10);
      if (Number.isFinite(v) && v > tagged) tagged = v;
    }
    const cap = parseInt(m.tags.capacity, 10);
    if (m.tags.leisure === "pitch" && Number.isFinite(cap) && cap <= 30 && cap > tagged)
      tagged = cap;
  }
  const courtCount = Math.min(Math.max(pitchCount, tagged, 1), MAX_COURTS);

  const surface = mapSurface(
    mostCommon(members.map((m) => m.tags.surface).filter(Boolean)) || null
  );

  const litVals = members.map((m) => yesNo(m.tags.lit)).filter((v) => v !== null);
  const lighted = litVals.length ? litVals.some((v) => v) : null;

  const indoorVals = members.map((m) => {
    if (yesNo(m.tags.covered) === true) return true;
    if (m.tags.indoor && m.tags.indoor !== "no") return true;
    if (yesNo(m.tags.covered) === false || m.tags.indoor === "no") return false;
    if (m.tags.building && m.tags.building !== "no") return true;
    return null;
  }).filter((v) => v !== null);
  const indoor = indoorVals.length ? indoorVals.some((v) => v) : null;

  const feeVals = members.map((m) => yesNo(m.tags.fee)).filter((v) => v !== null);
  const fee = feeVals.length ? feeVals.some((v) => v) : null;

  // access: customers wins if any member says so; unknown -> public inside park context.
  let access;
  if (members.some((m) => m.tags.access === "customers")) access = "customers";
  else if (members.some((m) => m.tags.access === "public" || m.tags.access === "yes" || m.tags.access === "permissive"))
    access = "public";
  else access = members.some((m) => parkContext(m.tags)) ? "public" : "unknown";

  // address / city from addr:* tags on any member.
  let address = null, city = null;
  for (const m of members) {
    const t = m.tags;
    if (!address && t["addr:street"])
      address = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    if (!city && t["addr:city"]) city = t["addr:city"];
  }

  // representative member: named one if any, else lowest id (stable across runs).
  const rep =
    members.find((m) => m.tags.name === name && name) ||
    [...members].sort((a, b) => a.id - b.id)[0];
  const typeChar = { node: "n", way: "w", relation: "r" }[rep.type] || "e";

  const extras = {};
  for (const m of members) {
    const t = m.tags;
    if (t.opening_hours && !extras.hours) extras.hours = t.opening_hours;
    if (t.website && !extras.website) extras.website = t.website;
    if ((t.phone || t["contact:phone"]) && !extras.phone)
      extras.phone = t.phone || t["contact:phone"];
  }

  return {
    id: `osm-${typeChar}${rep.id}`,
    name: name || FALLBACK_NAME,
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    courtCount,
    surface,
    lighted,
    indoor,
    access,
    fee,
    address,
    city,
    state,
    source: "osm",
    tags: extras,
  };
}

// -------------------------------------------------- NYC Parks merge

const BOROUGH = { M: "Manhattan", B: "Brooklyn", Q: "Queens", X: "Bronx", R: "Staten Island" };

function mapParksSurface(t) {
  if (!t) return null;
  const s = t.toLowerCase();
  if (s === "hard" || s === "all weather") return "hard";
  if (s === "clay" || s === "fast dry" || s === "hartro") return "clay";
  return null;
}

function mergeNycParks(facilities, parksFile) {
  const records = JSON.parse(readFileSync(parksFile, "utf8"));
  const stats = { total: records.length, noCoord: 0, matched: 0, added: 0 };

  for (const rec of records) {
    const lat = parseFloat(rec.lat);
    let lon = parseFloat(rec.lon);
    // Source data quirk: a few records omit the minus sign on longitude.
    if (Number.isFinite(lon) && lon > 0 && -lon >= BOUNDS.nyc.lngMin && -lon <= BOUNDS.nyc.lngMax)
      lon = -lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      stats.noCoord++;
      continue;
    }
    const courts = Math.min(Math.max(parseInt(rec.Courts, 10) || 1, 1), MAX_COURTS);
    const indoor = rec.Indoor_Outdoor === "Indoor" ? true : rec.Indoor_Outdoor === "Outdoor" ? false : null;
    const surface = mapParksSurface(rec.Tennis_Type);
    // Outdoor public NYC Parks courts need a permit. Records marked "Indoor"
    // (seasonal bubbles) still require Parks permits during the outdoor
    // season — their Info text says so — so check it too.
    const permitRequired = indoor === false || /permit/i.test(String(rec.Info || ""));
    const city = BOROUGH[String(rec.Prop_ID || "").charAt(0)] || null;

    // Match to nearest OSM facility within MERGE_RADIUS_M.
    let best = null, bestD = Infinity;
    for (const f of facilities) {
      if (f.source !== "osm" && f.source !== "merged") continue;
      const d = haversineM(lat, lon, f.lat, f.lng);
      if (d <= MERGE_RADIUS_M && d < bestD) { best = f; bestD = d; }
    }

    if (best) {
      stats.matched++;
      best.name = rec.Name || best.name;
      best.courtCount = courts;
      if (surface) best.surface = surface;
      if (indoor !== null) best.indoor = indoor;
      best.access = "public";
      best.address = best.address || rec.Location || null;
      best.city = best.city || city;
      best.source = "merged";
      if (permitRequired) best.tags.permitRequired = true;
      if (rec.Phone && !best.tags.phone) best.tags.phone = rec.Phone;
      if (rec.Accessible === "Y") best.tags.accessible = true;
    } else {
      stats.added++;
      const tags = {};
      if (permitRequired) tags.permitRequired = true;
      if (rec.Phone) tags.phone = rec.Phone;
      if (rec.Accessible === "Y") tags.accessible = true;
      facilities.push({
        id: `nycparks-${rec.Prop_ID}`,
        name: rec.Name || FALLBACK_NAME,
        lat: +lat.toFixed(6),
        lng: +lon.toFixed(6),
        courtCount: courts,
        surface: surface || "unknown",
        lighted: null,
        indoor,
        access: "public",
        fee: null,
        address: rec.Location || null,
        city,
        state: "NY",
        source: "nycparks",
        tags,
      });
    }
  }
  return stats;
}

// -------------------------------------------------- park-name enrichment

/**
 * Optional stage: name fallback-named facilities after the named park /
 * sports centre whose bounding box contains them (smallest box wins).
 * Reads data/raw/osm-<region>-parks.json (Overpass `out tags bb`); silently
 * skipped when the file is missing.
 */
function loadParkBoxes(file) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  const parks = [];
  for (const el of data.elements || []) {
    const name = el.tags?.name;
    const b = el.bounds;
    if (!name || !b) continue;
    // A bounding box is a poor containment proxy for huge parks/preserves.
    if (haversineM(b.minlat, b.minlon, b.maxlat, b.maxlon) > 4000) continue;
    parks.push({
      name,
      minlat: b.minlat,
      maxlat: b.maxlat,
      minlon: b.minlon,
      maxlon: b.maxlon,
      areaDeg: (b.maxlat - b.minlat) * (b.maxlon - b.minlon),
    });
  }
  return parks;
}

function enrichNamesFromParks(region, facilities, parksFile) {
  if (!existsSync(parksFile)) {
    console.log(`[${region}] no park boxes file — skipping park-name enrichment`);
    return;
  }
  const parks = loadParkBoxes(parksFile);
  const MARGIN = 30 / 111000; // ~30 m of bbox slack, in degrees
  let renamed = 0;
  for (const f of facilities) {
    if (f.name !== FALLBACK_NAME) continue;
    let best = null;
    for (const p of parks) {
      if (
        f.lat < p.minlat - MARGIN || f.lat > p.maxlat + MARGIN ||
        f.lng < p.minlon - MARGIN || f.lng > p.maxlon + MARGIN
      ) continue;
      if (!best || p.areaDeg < best.areaDeg) best = p;
    }
    if (best) {
      f.name = /tennis|court/i.test(best.name)
        ? best.name
        : `${best.name} Tennis Courts`;
      renamed++;
    }
  }
  console.log(
    `[${region}] park-name enrichment: named ${renamed} facilities from ${parks.length} park boxes`
  );
}

// ---------------------------------------------------------------- main

function processRegion(region, osmFile, state) {
  const { kept, stats } = loadOsmElements(osmFile);
  const clusters = clusterElements(kept);
  const facilities = clusters.map((c) => facilityFromCluster(c, state));
  console.log(
    `[${region}] OSM: ${stats.total} elements -> kept ${kept.length} ` +
      `(dropped: ${stats.notTennis} non-tennis, ${stats.noCoord} no-coord, ` +
      `${stats.nonCourt} non-court, ${stats.private} private) -> ${facilities.length} facilities`
  );
  return facilities;
}

function sanityCheck(region, facilities) {
  const b = BOUNDS[region];
  const bad = [];
  for (const f of facilities) {
    if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng) ||
        f.lat < b.latMin || f.lat > b.latMax || f.lng < b.lngMin || f.lng > b.lngMax)
      bad.push(`${f.id} out of bounds (${f.lat},${f.lng})`);
    if (!Number.isFinite(f.courtCount) || f.courtCount < 1 || f.courtCount > MAX_COURTS)
      bad.push(`${f.id} bad courtCount ${f.courtCount}`);
  }
  if (bad.length) {
    console.error(`[${region}] SANITY FAILURES:\n  ` + bad.join("\n  "));
    process.exitCode = 1;
  } else {
    console.log(`[${region}] sanity: all ${facilities.length} facilities in bounds, courtCount 1-${MAX_COURTS}`);
  }
}

function writeRegion(region, facilities) {
  mkdirSync(OUT, { recursive: true });
  const out = { region, attribution: ATTRIBUTION, facilities };
  const file = join(OUT, `courts-${region}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`[${region}] wrote ${file} (${facilities.length} facilities)`);
}

function summarize(region, facilities) {
  const n = facilities.length;
  const pct = (k) => ((100 * k) / n).toFixed(1) + "%";
  const named = facilities.filter((f) => f.name !== FALLBACK_NAME).length;
  const lit = facilities.filter((f) => f.lighted !== null).length;
  const surf = facilities.filter((f) => f.surface !== "unknown").length;
  const totalCourts = facilities.reduce((s, f) => s + f.courtCount, 0);
  console.log(
    `[${region}] ${n} facilities, ${totalCourts} courts; named ${named} (${pct(named)}), ` +
      `lights info ${lit} (${pct(lit)}), surface known ${surf} (${pct(surf)})`
  );
}

const azFacilities = processRegion("az", join(RAW, "osm-az.json"), "AZ");
const nycFacilities = processRegion("nyc", join(RAW, "osm-nyc.json"), "NY");

const parksFile = join(RAW, "nyc-parks-tennis.json");
if (existsSync(parksFile)) {
  const s = mergeNycParks(nycFacilities, parksFile);
  console.log(
    `[nyc] Parks merge: ${s.total} records; ${s.matched} matched to OSM (source=merged), ` +
      `${s.added} added as nycparks-only, ${s.noCoord} skipped (no coordinates)`
  );
} else {
  console.log("[nyc] no nyc-parks-tennis.json — skipping Parks merge");
}

// Name remaining fallback-named facilities after their surrounding park
// (runs after the Parks merge so official NYC Parks names win).
enrichNamesFromParks("az", azFacilities, join(RAW, "osm-az-parks.json"));
enrichNamesFromParks("nyc", nycFacilities, join(RAW, "osm-nyc-parks.json"));

sanityCheck("az", azFacilities);
sanityCheck("nyc", nycFacilities);
writeRegion("az", azFacilities);
writeRegion("nyc", nycFacilities);
summarize("az", azFacilities);
summarize("nyc", nycFacilities);
