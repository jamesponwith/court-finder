# Court Finder — Data Schema & Pipeline

## Output files

- `public/data/courts-az.json` — Arizona facilities
- `public/data/courts-nyc.json` — New York City facilities

## Re-running the pipeline

```sh
node scripts/normalize.mjs
```

Plain Node (>= 16), no npm dependencies. Reads the raw inputs in `data/raw/`
(`osm-az.json`, `osm-nyc.json`, and optionally `nyc-parks-tennis.json`) and
rewrites both output files. The script exits non-zero if any facility fails
its sanity check (coordinates outside the region's rough bounds, or a
courtCount outside 1–60).

## File shape

```jsonc
{
  "region": "az" | "nyc",
  "attribution": "© OpenStreetMap contributors (ODbL); NYC Parks Open Data",
  "facilities": [Facility, ...]
}
```

### Facility

| Field        | Type                                        | Notes |
|--------------|---------------------------------------------|-------|
| `id`         | string                                      | Stable. `osm-<t><id>` where `<t>` is `n`/`w`/`r` and the id is a representative clustered member (the named member if any, else the lowest OSM id); or `nycparks-<Prop_ID>` for Parks-only records. |
| `name`       | string                                      | Most common non-empty name among clustered members; NYC Parks name wins on merge; fallback `"Public Tennis Courts"`. |
| `lat`, `lng` | number                                      | WGS84 centroid (mean of clustered member points), 6 decimals. |
| `courtCount` | number                                      | 1–60. Count of clustered `leisure=pitch` elements, or the max `capacity`/`courts` tag if larger; NYC Parks `Courts` value wins on merge. Clamped at 60 (the USTA National Tennis Center cluster exceeds it). |
| `surface`    | `"hard" \| "clay" \| "grass" \| "unknown"`  | See mapping below. |
| `lighted`    | boolean \| null                             | From OSM `lit`; true if any member is lit; null = no data. |
| `indoor`     | boolean \| null                             | From OSM `covered`/`indoor`/`building`, or NYC Parks `Indoor_Outdoor`; null = no data. |
| `access`     | `"public" \| "customers" \| "private" \| "unknown"` | `access=private` facilities are excluded at load, so `"private"` does not currently appear. Untagged facilities are `"public"` only in a park context (name/operator heuristic), else `"unknown"`. All NYC Parks facilities are `"public"`. |
| `fee`        | boolean \| null                             | From OSM `fee`; null = no data. |
| `address`    | string \| null                              | From OSM `addr:housenumber` + `addr:street`, or NYC Parks `Location`. |
| `city`       | string \| null                              | From OSM `addr:city`; for NYC Parks records the borough is derived from the `Prop_ID` prefix (M/B/Q/X/R). |
| `state`      | `"AZ" \| "NY"`                              | |
| `source`     | `"osm" \| "nycparks" \| "merged"`           | `merged` = OSM cluster enriched with a matching NYC Parks record. |
| `tags`       | object                                      | Optional extras: `permitRequired` (true for outdoor public NYC Parks courts), `hours` (OSM `opening_hours`), `website`, `phone`, `accessible` (NYC Parks `Accessible=Y`). |

## Pipeline stages

1. **Filter** — keep OSM elements whose `sport` contains the exact token
   `tennis` in its semicolon-separated list (so `tennis;pickleball` is kept,
   `table_tennis` / `paddle_tennis` are not). Point = node lat/lon or
   way/relation `.center`; elements without coordinates are skipped.
   Elements with `shop=*` or `club=*` and no court-ish `leisure` value are
   dropped, as are `access=private` / `access=no` elements.

2. **Cluster** — greedy union (union-find over a ~120 m grid) of all kept
   elements within **120 m** of each other. Each cluster becomes one
   facility: centroid = mean of members, name = most common member name,
   courtCount = pitch members (or max capacity tag), attribute values pooled
   across members (any lit member → lighted, etc.).

3. **NYC Parks merge** (NYC only, when `data/raw/nyc-parks-tennis.json`
   exists) — each Parks record with usable coordinates is matched to the
   nearest OSM facility within **150 m**. On match: Parks name, court count,
   surface, and indoor/outdoor win; `source` becomes `"merged"`;
   `tags.permitRequired = true` for outdoor courts. Unmatched Parks records
   are appended as `source: "nycparks"` facilities. Parks records without
   coordinates (22 of 78) are skipped. One known source quirk is corrected:
   some Parks longitudes omit the minus sign.

4. **Sanity check + write** — every facility must have finite coordinates
   inside the region's rough bounds (AZ: lat 31–37.1, lng −115 to −109;
   NYC: lat 40.4–41, lng −74.3 to −73.6) and courtCount 1–60.

## Surface mapping

| Raw value (OSM or Parks)                                   | Output    |
|------------------------------------------------------------|-----------|
| clay, earth, dirt, Har-Tru, Fast Dry, Hartro               | `clay`    |
| grass                                                      | `grass`   |
| hard, asphalt, acrylic, concrete, paved, tartan, All Weather | `hard`  |
| anything else / missing                                    | `unknown` |

## Current counts (2026-08-27 run)

- **AZ**: 1172 facilities, 3259 courts (all `source: "osm"`).
- **NYC**: 311 facilities, 1311 courts — 255 osm, 52 merged, 4 nycparks-only;
  51 facilities carry `tags.permitRequired`.

Tag coverage is sparse in OSM (AZ: 1.4% named, 11% lights info, 5.6% surface
known; NYC: 24% named, 8% lights info, 28% surface known), so `unknown`/`null`
values are common and should be handled by consumers.
