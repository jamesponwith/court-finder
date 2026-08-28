# Court Finder — Data Schema & Pipeline

## Regions

Regions are configured in `scripts/regions.mjs` (single source of truth for
`fetch-osm.mjs`, `normalize.mjs`, and `geocode.mjs`). The slug names both the
raw files (`data/raw/osm-<slug>.json`, `osm-<slug>-places.json`) and the
output (`public/data/courts-<slug>.json`), and is the contract with the app.

| Slug  | Region                    | State | Overpass scope                | Sanity bounds (lat / lng)        |
|-------|---------------------------|-------|-------------------------------|----------------------------------|
| `az`  | Arizona (statewide)       | AZ    | area `ISO3166-2=US-AZ`        | 31–37.1 / −115..−109             |
| `ny`  | New York (statewide)      | NY    | area `ISO3166-2=US-NY`        | 40.4–45.05 / −79.9..−71.8        |
| `ca`  | California (statewide)    | CA    | area `ISO3166-2=US-CA`        | 32.5–42.1 / −124.5..−114.1       |
| `fl`  | Florida (statewide)       | FL    | area `ISO3166-2=US-FL`        | 24.4–31.1 / −87.7..−79.9         |
| `nm`  | New Mexico (statewide)    | NM    | area `ISO3166-2=US-NM`        | 31.3–37.1 / −109.1..−103.0       |
| `elp` | El Paso, TX (metro)       | TX    | bbox `(31.2,-106.8,32.2,-105.4)` | 31.2–32.2 / −106.8..−105.4    |

`ny` replaced the earlier city-only `nyc` region (`courts-nyc.json` is gone);
facility ids carried over unchanged, since ids derive from OSM element ids.
The `ny` region still merges the NYC Parks directory (see the `nycParksMerge`
flag) — proximity matching only ever touches facilities near the city.
`elp` is scoped by bounding box, not by named area, because "El Paso County"
is ambiguous (Colorado has one too); the box also clips a sliver of NM and
Ciudad Juárez, MX (a handful of facilities), all stamped `state: "TX"`.

## Output files

One `public/data/courts-<slug>.json` per region above.

## Re-running the pipeline

```sh
node scripts/fetch-osm.mjs     # (re)download raw Overpass extracts into data/raw/
                               #   [slug ...] limits to some regions; skips
                               #   existing files unless --force
node scripts/normalize.mjs     # raw extracts -> public/data/courts-*.json
node scripts/geocode.mjs       # optional: reverse-geocode still-unnamed facilities
node scripts/normalize.mjs     # re-run to consume the geocode cache
```

Plain Node (>= 18), no npm dependencies. `fetch-osm.mjs` queries Overpass
(overpass-api.de, falling back to overpass.kumi.systems) strictly one query
at a time with one retry per endpoint; per region it saves the tennis
elements (`nwr["sport"~"tennis"]`, `out center tags`) and the named-place
boxes used for containment naming (`out tags bb`). `normalize.mjs` reads the
raw inputs in `data/raw/` (`osm-<slug>.json`, and optionally
`nyc-parks-tennis.json`, the region's `osm-*-parks.json` / `osm-*-places.json`
extracts, `geocode-cache.json`) and rewrites every region's output file
(regions whose raw extract is missing are skipped with a warning and a
non-zero exit). It exits non-zero if any facility fails its sanity check
(coordinates outside the region's rough bounds, or a courtCount outside
1–60).

`geocode.mjs` reverse-geocodes the facilities that are still named
`"Public Tennis Courts"` in the current outputs, via the public Nominatim API
(1 request/second per its usage policy, with a descriptive User-Agent). Every
raw response is cached in `data/raw/geocode-cache.json` keyed by facility id
and flushed after each lookup, so the script can be interrupted and re-run
until it reports 0 remaining (`--max=N` limits a run; `--retry-errors`
re-requests cached error entries). Facility ids are stable, so the cache
stays valid across normalize runs; it is only consulted, never required.

## File shape

```jsonc
{
  "region": "az" | "ny" | "ca" | "fl" | "nm" | "elp",
  "attribution": "© OpenStreetMap contributors (ODbL); NYC Parks Open Data",
  "facilities": [Facility, ...]
}
```

### Facility

| Field        | Type                                        | Notes |
|--------------|---------------------------------------------|-------|
| `id`         | string                                      | Stable. `osm-<t><id>` where `<t>` is `n`/`w`/`r` and the id is a representative clustered member (the named member if any, else the lowest OSM id); or `nycparks-<Prop_ID>` for Parks-only records. |
| `name`       | string                                      | Most common non-empty name among clustered members; NYC Parks name wins on merge. Otherwise-unnamed facilities are named from the containing named park/school/sports place (`"<Place> Tennis Courts"`), then from the geocode cache (feature name, or `"Tennis Courts · <road/neighbourhood>"`); final fallback `"Public Tennis Courts"`. |
| `lat`, `lng` | number                                      | WGS84 centroid (mean of clustered member points), 6 decimals. |
| `courtCount` | number                                      | 1–60. Count of clustered `leisure=pitch` elements, or the max `capacity`/`courts` tag if larger; NYC Parks `Courts` value wins on merge. Clamped at 60 (the USTA National Tennis Center cluster exceeds it). |
| `surface`    | `"hard" \| "clay" \| "grass" \| "unknown"`  | See mapping below. |
| `lighted`    | boolean \| null                             | From OSM `lit`; true if any member is lit; null = no data. |
| `indoor`     | boolean \| null                             | From OSM `covered`/`indoor`/`building`, or NYC Parks `Indoor_Outdoor`; null = no data. |
| `access`     | `"public" \| "customers" \| "private" \| "unknown"` | `access=private` facilities are excluded at load, so `"private"` does not currently appear. Untagged facilities are `"public"` only in a park context (name/operator heuristic), else `"unknown"`. All NYC Parks facilities are `"public"`. Facilities named from a containing school/college/university are demoted to `"unknown"` unless access came from explicit OSM tags or a NYC Parks record (see `tags.context`). |
| `fee`        | boolean \| null                             | From OSM `fee`; null = no data. |
| `address`    | string \| null                              | From OSM `addr:housenumber` + `addr:street`, or NYC Parks `Location`; else from the geocode cache (`house_number` + `road`). |
| `city`       | string \| null                              | From OSM `addr:city`; for NYC Parks records the borough is derived from the `Prop_ID` prefix (M/B/Q/X/R); else from the geocode cache (`city`/`town`/`village`/`suburb`, else `county`). |
| `state`      | `"AZ" \| "NY" \| "CA" \| "FL" \| "NM" \| "TX"` | The region's configured state code (see the region table). |
| `source`     | `"osm" \| "nycparks" \| "merged"`           | `merged` = OSM cluster enriched with a matching NYC Parks record. |
| `tags`       | object                                      | Optional extras: `permitRequired` (true for outdoor public NYC Parks courts), `hours` (OSM `opening_hours`), `website`, `phone`, `accessible` (NYC Parks `Accessible=Y`), `context: "school"` (facility sits inside a named school/college/university — may not be truly public; UI can badge it). |

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

3. **NYC Parks merge** (regions flagged `nycParksMerge` — i.e. `ny` — when
   `data/raw/nyc-parks-tennis.json` exists) — each Parks record with usable
   coordinates is matched to the nearest OSM facility within **150 m**. On match: Parks name, court count,
   surface, and indoor/outdoor win; `source` becomes `"merged"`;
   `tags.permitRequired = true` for outdoor courts. Unmatched Parks records
   are appended as `source: "nycparks"` facilities. Parks records without
   coordinates (22 of 78) are skipped. One known source quirk is corrected:
   some Parks longitudes omit the minus sign.

4. **Containment-name enrichment** (when the region's configured place
   extracts exist) — facilities still carrying the fallback name are named
   after the named OSM place whose bounding box contains them. Boxes come
   from Overpass `out tags bb` extracts (fetched by `fetch-osm.mjs`) of named
   `leisure=park|garden|sports_centre|recreation_ground|golf_course`,
   `landuse=recreation_ground|residential`, and
   `amenity=school|college|university` ways/relations. Most regions use a
   single `osm-<slug>-places.json`; `az` keeps its historical two-file split
   (`osm-az-parks.json` + `osm-az-places.json`).
   Boxes with a > 4 km diagonal are excluded (bad containment proxy);
   the smallest containing box wins, except residential-complex boxes,
   which are used only when no other kind of box contains the facility.
   Names become `"<Place> Tennis Courts"` (no suffix when the place name
   already contains tennis/racquet). When the winning place is a
   school/college/university, `tags.context = "school"` is set and `access`
   is demoted to `"unknown"` unless it came from explicit OSM tags or a
   NYC Parks record.

5. **Geocode enrichment** (when `data/raw/geocode-cache.json` exists — see
   `scripts/geocode.mjs`) — for facilities *still* fallback-named, derive a
   name from the cached Nominatim reverse-geocode response: the feature
   `name` when it's a park/pitch/sports thing (category `leisure` or a
   sporty `type`), else `"Tennis Courts · <road>"`, else
   `"Tennis Courts · <neighbourhood/suburb>"`. For *any* facility with a
   cached response, null `address`/`city` are filled from it (no extra
   requests are made just for this). Existing values are never overwritten.

6. **Sanity check + write** — every facility must have finite coordinates
   inside the region's rough bounds (see the region table above) and
   courtCount 1–60.

## Surface mapping

| Raw value (OSM or Parks)                                   | Output    |
|------------------------------------------------------------|-----------|
| clay, earth, dirt, Har-Tru, Fast Dry, Hartro               | `clay`    |
| grass                                                      | `grass`   |
| hard, asphalt, acrylic, concrete, paved, tartan, All Weather | `hard`  |
| anything else / missing                                    | `unknown` |

## Current counts (2026-08-28 run)

Geocode enrichment has completed for `az` only; the other regions' backlogs
(fallback-named facilities awaiting `scripts/geocode.mjs`) are noted below —
their named % will rise once the geocode batch runs and `normalize.mjs` is
re-run.

- **az**: 1172 facilities, 3259 courts (all `source: "osm"`). Named 1151
  (98.2%; 21 remain `"Public Tennis Courts"` — their reverse-geocode hits
  unnamed roads); 203 school-context.
- **ny**: 5003 facilities, 12540 courts — 4947 osm, 52 merged, 4
  nycparks-only; 56 facilities carry `tags.permitRequired`. Named 2203
  (44.0%; geocode backlog 2800); 587 school-context. Statewide superset of
  the old `nyc` region: all 311 former nyc facility ids are preserved.
- **ca**: 7268 facilities, 19869 courts. Named 3661 (50.4%; geocode backlog
  3607); 1123 school-context.
- **fl**: 5646 facilities, 14891 courts. Named 2791 (49.4%; geocode backlog
  2855); 515 school-context.
- **nm**: 470 facilities, 1162 courts. Named 244 (51.9%; geocode backlog
  226); 67 school-context.
- **elp**: 105 facilities, 493 courts. Named 75 (71.4%; geocode backlog 30);
  47 school-context.

Underlying OSM tag coverage is still sparse (3–13% lights info, 4–7% surface
known per region), so `unknown`/`null` values are common and should be
handled by consumers.
