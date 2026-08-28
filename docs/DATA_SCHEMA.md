# Court Finder — Data Schema & Pipeline

## Output files

- `public/data/courts-az.json` — Arizona facilities
- `public/data/courts-nyc.json` — New York City facilities

## Re-running the pipeline

```sh
node scripts/normalize.mjs     # raw extracts -> public/data/courts-*.json
node scripts/geocode.mjs       # optional: reverse-geocode still-unnamed facilities
node scripts/normalize.mjs     # re-run to consume the geocode cache
```

Plain Node (>= 18), no npm dependencies. `normalize.mjs` reads the raw inputs
in `data/raw/` (`osm-az.json`, `osm-nyc.json`, and optionally
`nyc-parks-tennis.json`, `osm-*-parks.json`, `osm-*-places.json`,
`geocode-cache.json`) and rewrites both output files. It exits non-zero if
any facility fails its sanity check (coordinates outside the region's rough
bounds, or a courtCount outside 1–60).

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
  "region": "az" | "nyc",
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
| `state`      | `"AZ" \| "NY"`                              | |
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

3. **NYC Parks merge** (NYC only, when `data/raw/nyc-parks-tennis.json`
   exists) — each Parks record with usable coordinates is matched to the
   nearest OSM facility within **150 m**. On match: Parks name, court count,
   surface, and indoor/outdoor win; `source` becomes `"merged"`;
   `tags.permitRequired = true` for outdoor courts. Unmatched Parks records
   are appended as `source: "nycparks"` facilities. Parks records without
   coordinates (22 of 78) are skipped. One known source quirk is corrected:
   some Parks longitudes omit the minus sign.

4. **Containment-name enrichment** (when `data/raw/osm-<region>-parks.json`
   and/or `osm-<region>-places.json` exist) — facilities still carrying the
   fallback name are named after the named OSM place whose bounding box
   contains them. Boxes come from two Overpass `out tags bb` extracts:
   parks/sports centres (`-parks.json`) and schools/colleges/universities,
   `leisure=sports_centre|recreation_ground|golf_course`,
   `landuse=recreation_ground`, and named `landuse=residential` complexes
   (`-places.json`, Overpass areas 3600162018 = AZ, 3600175905 = NYC).
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
   inside the region's rough bounds (AZ: lat 31–37.1, lng −115 to −109;
   NYC: lat 40.4–41, lng −74.3 to −73.6) and courtCount 1–60.

## Surface mapping

| Raw value (OSM or Parks)                                   | Output    |
|------------------------------------------------------------|-----------|
| clay, earth, dirt, Har-Tru, Fast Dry, Hartro               | `clay`    |
| grass                                                      | `grass`   |
| hard, asphalt, acrylic, concrete, paved, tartan, All Weather | `hard`  |
| anything else / missing                                    | `unknown` |

## Current counts (2026-08-28 run, with containment + geocode enrichment)

- **AZ**: 1172 facilities, 3259 courts (all `source: "osm"`). Named 1151
  (98.2%; 21 remain `"Public Tennis Courts"` — their reverse-geocode hits
  unnamed roads); address 34.6%, city 36.7%; 203 school-context.
- **NYC**: 311 facilities, 1212 courts — 255 osm, 52 merged, 4 nycparks-only;
  51 facilities carry `tags.permitRequired`. Named 311 (100%); address
  33.1%, city 31.8%; 88 school-context.

Underlying OSM tag coverage is still sparse (AZ: 11% lights info, 5.6%
surface known; NYC: 8% lights info, 28% surface known), so `unknown`/`null`
values are common and should be handled by consumers.
