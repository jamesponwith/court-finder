# Court Finder — Data Schema & Pipeline

## Regions

Regions are configured in `scripts/regions.mjs` (single source of truth for
`fetch-osm.mjs`, `normalize.mjs`, and `geocode.mjs`). Coverage is all 50 US
states plus DC — one region per state, slug = lowercase USPS code. The slug
names both the raw files (`data/raw/osm-<slug>.json`, `osm-<slug>-places.json`)
and the output (`public/data/courts-<slug>.json`), and is the contract with
the app. Sanity bounds are state bounding boxes with ~0.05° margin.

| Slug | Region | State | Overpass scope | Sanity bounds (lat / lng) |
|------|--------|-------|----------------|---------------------------|
| `ak` | Alaska (statewide)¹ | AK | area `ISO3166-2=US-AK` | 51–71.5 / −180..−129 |
| `al` | Alabama (statewide) | AL | area `ISO3166-2=US-AL` | 30.1–35.05 / −88.55..−84.85 |
| `ar` | Arkansas (statewide) | AR | area `ISO3166-2=US-AR` | 32.95–36.55 / −94.7..−89.6 |
| `az` | Arizona (statewide) | AZ | area `ISO3166-2=US-AZ` | 31–37.1 / −115..−109 |
| `ca` | California (statewide) | CA | area `ISO3166-2=US-CA` | 32.5–42.1 / −124.5..−114.1 |
| `co` | Colorado (statewide) | CO | area `ISO3166-2=US-CO` | 36.95–41.05 / −109.1..−102 |
| `ct` | Connecticut (statewide) | CT | area `ISO3166-2=US-CT` | 40.9–42.1 / −73.8..−71.75 |
| `dc` | District of Columbia | DC | area `ISO3166-2=US-DC` | 38.74–39.05 / −77.17..−76.86 |
| `de` | Delaware (statewide) | DE | area `ISO3166-2=US-DE` | 38.4–39.9 / −75.85..−75 |
| `fl` | Florida (statewide) | FL | area `ISO3166-2=US-FL` | 24.4–31.1 / −87.7..−79.9 |
| `ga` | Georgia (statewide) | GA | area `ISO3166-2=US-GA` | 30.3–35.05 / −85.65..−80.78 |
| `hi` | Hawaii (statewide)² | HI | area `ISO3166-2=US-HI` | 18.85–22.3 / −160.3..−154.75 |
| `ia` | Iowa (statewide) | IA | area `ISO3166-2=US-IA` | 40.33–43.55 / −96.7..−90.1 |
| `id` | Idaho (statewide) | ID | area `ISO3166-2=US-ID` | 41.95–49.05 / −117.3..−111 |
| `il` | Illinois (statewide) | IL | area `ISO3166-2=US-IL` | 36.92–42.56 / −91.57..−87 |
| `in` | Indiana (statewide) | IN | area `ISO3166-2=US-IN` | 37.72–41.81 / −88.15..−84.73 |
| `ks` | Kansas (statewide) | KS | area `ISO3166-2=US-KS` | 36.95–40.05 / −102.1..−94.55 |
| `ky` | Kentucky (statewide) | KY | area `ISO3166-2=US-KY` | 36.44–39.2 / −89.62..−81.9 |
| `la` | Louisiana (statewide) | LA | area `ISO3166-2=US-LA` | 28.85–33.07 / −94.1..−88.75 |
| `ma` | Massachusetts (statewide) | MA | area `ISO3166-2=US-MA` | 41.18–42.94 / −73.56..−69.87 |
| `md` | Maryland (statewide) | MD | area `ISO3166-2=US-MD` | 37.86–39.77 / −79.54..−74.98 |
| `me` | Maine (statewide) | ME | area `ISO3166-2=US-ME` | 42.95–47.51 / −71.14..−66.9 |
| `mi` | Michigan (statewide) | MI | area `ISO3166-2=US-MI` | 41.65–48.36 / −90.47..−82.07 |
| `mn` | Minnesota (statewide) | MN | area `ISO3166-2=US-MN` | 43.45–49.45 / −97.29..−89.44 |
| `mo` | Missouri (statewide) | MO | area `ISO3166-2=US-MO` | 35.95–40.67 / −95.82..−89.05 |
| `ms` | Mississippi (statewide) | MS | area `ISO3166-2=US-MS` | 30.1–35.05 / −91.7..−88.03 |
| `mt` | Montana (statewide) | MT | area `ISO3166-2=US-MT` | 44.31–49.05 / −116.1..−103.99 |
| `nc` | North Carolina (statewide) | NC | area `ISO3166-2=US-NC` | 33.79–36.64 / −84.37..−75.4 |
| `nd` | North Dakota (statewide) | ND | area `ISO3166-2=US-ND` | 45.89–49.05 / −104.1..−96.5 |
| `ne` | Nebraska (statewide) | NE | area `ISO3166-2=US-NE` | 39.95–43.05 / −104.1..−95.26 |
| `nh` | New Hampshire (statewide) | NH | area `ISO3166-2=US-NH` | 42.65–45.36 / −72.62..−70.55 |
| `nj` | New Jersey (statewide) | NJ | area `ISO3166-2=US-NJ` | 38.87–41.41 / −75.61..−73.84 |
| `nm` | New Mexico (statewide) | NM | area `ISO3166-2=US-NM` | 31.3–37.1 / −109.1..−103 |
| `nv` | Nevada (statewide) | NV | area `ISO3166-2=US-NV` | 34.95–42.05 / −120.06..−113.99 |
| `ny` | New York (statewide) | NY | area `ISO3166-2=US-NY` | 40.4–45.05 / −79.9..−71.8 |
| `oh` | Ohio (statewide) | OH | area `ISO3166-2=US-OH` | 38.35–42.03 / −84.87..−80.47 |
| `ok` | Oklahoma (statewide) | OK | area `ISO3166-2=US-OK` | 33.57–37.05 / −103.05..−94.38 |
| `or` | Oregon (statewide) | OR | area `ISO3166-2=US-OR` | 41.95–46.35 / −124.62..−116.41 |
| `pa` | Pennsylvania (statewide) | PA | area `ISO3166-2=US-PA` | 39.67–42.32 / −80.57..−74.64 |
| `ri` | Rhode Island (statewide) | RI | area `ISO3166-2=US-RI` | 41.1–42.07 / −71.95..−71.07 |
| `sc` | South Carolina (statewide) | SC | area `ISO3166-2=US-SC` | 31.99–35.27 / −83.4..−78.49 |
| `sd` | South Dakota (statewide) | SD | area `ISO3166-2=US-SD` | 42.43–46 / −104.11..−96.39 |
| `tn` | Tennessee (statewide) | TN | area `ISO3166-2=US-TN` | 34.93–36.73 / −90.36..−81.6 |
| `tx` | Texas (statewide) | TX | area `ISO3166-2=US-TX` | 25.79–36.55 / −106.7..−93.46 |
| `ut` | Utah (statewide) | UT | area `ISO3166-2=US-UT` | 36.95–42.05 / −114.1..−109 |
| `va` | Virginia (statewide) | VA | area `ISO3166-2=US-VA` | 36.49–39.52 / −83.73..−75.18 |
| `vt` | Vermont (statewide) | VT | area `ISO3166-2=US-VT` | 42.68–45.07 / −73.49..−71.41 |
| `wa` | Washington (statewide) | WA | area `ISO3166-2=US-WA` | 45.49–49.05 / −124.9..−116.87 |
| `wi` | Wisconsin (statewide) | WI | area `ISO3166-2=US-WI` | 42.44–47.35 / −92.94..−86.2 |
| `wv` | West Virginia (statewide) | WV | area `ISO3166-2=US-WV` | 37.15–40.69 / −82.69..−77.67 |
| `wy` | Wyoming (statewide) | WY | area `ISO3166-2=US-WY` | 40.95–45.06 / −111.11..−104 |

¹ `ak` covers the mainland and eastern Aleutians only; far-Aleutian courts
west of the antimeridian (lng > 0, e.g. Attu) are out of scope.
² `hi` bounds cover the main islands; the uninhabited NW Hawaiian islands
have no tennis courts.

`ny` replaced the earlier city-only `nyc` region (`courts-nyc.json` is gone);
facility ids carried over unchanged, since ids derive from OSM element ids.
The `ny` region still merges the NYC Parks directory (see the `nycParksMerge`
flag) — proximity matching only ever touches facilities near the city.

The former `elp` (El Paso metro, bbox-scoped) region was **removed** when
Texas went statewide: `tx` covers El Paso, and because ISO state areas never
cross the national border, elp's Ciudad Juárez `excludeIds` hack is obsolete.
`courts-elp.json` and the `osm-elp*` raw files are gone; El Paso facility ids
are unchanged inside `courts-tx.json` (ids derive from OSM element ids).

## Output files

One `public/data/courts-<slug>.json` per region above. While the 50-state
fetch is being staged, only the regions fetched + normalized so far have
output files (see “staged fetching” below).

## Re-running the pipeline

```sh
node scripts/fetch-osm.mjs     # (re)download raw Overpass extracts into data/raw/
                               #   no args (or --all) = every configured region;
                               #   [slug ...] limits to some regions; skips
                               #   existing files unless --force
node scripts/normalize.mjs     # raw extracts -> public/data/courts-*.json
                               #   --allow-missing: exit 0 even when some
                               #   regions have no raw extract yet
node scripts/geocode.mjs       # optional: reverse-geocode still-unnamed facilities
node scripts/normalize.mjs     # re-run to consume the geocode cache
```

Plain Node (>= 18), no npm dependencies. `fetch-osm.mjs` queries Overpass
(overpass-api.de, falling back to overpass.kumi.systems) strictly one query
at a time, with a polite 3 s pause between successive queries and one retry
per endpoint; per region it saves the tennis elements
(`nwr["sport"~"tennis"]`, `out center tags`) and the named-place boxes used
for containment naming (`out tags bb`). `normalize.mjs` reads the raw inputs
in `data/raw/` (`osm-<slug>.json`, and optionally `nyc-parks-tennis.json`,
the region's `osm-*-parks.json` / `osm-*-places.json` extracts,
`geocode-cache.json`) and rewrites every region's output file. It exits
non-zero if any facility fails its sanity check (coordinates outside the
region's rough bounds, or a courtCount outside 1–60).

**Staged fetching**: the 50-state Overpass batch takes a while, so the
pipeline tolerates partial raw data at every stage. `fetch-osm.mjs` skips
regions whose raw files already exist, so an interrupted batch resumes where
it left off (`node scripts/fetch-osm.mjs` again, no args). `normalize.mjs`
always skips (with a warning) regions whose raw extract is missing; by
default that makes the exit code non-zero, but with `--allow-missing` the
exit stays 0 when missing raw files are the only issue — use that for staged
deploys while fetches are incomplete (sanity failures still exit non-zero).
`geocode.mjs` simply iterates whatever regions have output files and skips
the rest with a warning.

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
  "region": "<slug>",  // lowercase USPS code from the region table (az, ny, ...)
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
| `state`      | 2-letter USPS code                          | The region's configured state code (see the region table). |
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

## Current counts (2026-08-29 run)

The 50-state expansion is being fetched in stages; the regions normalized so
far are below (`elp` is gone — see the removal note in the Regions section).
Geocode enrichment has completed for the five original regions (their
remaining `"Public Tennis Courts"` hit unnamed roads); the freshly added
regions carry a geocode backlog (fallback-named facilities awaiting
`scripts/geocode.mjs`) — their named % will rise once the geocode batch runs
and `normalize.mjs` is re-run.

- **az**: 1172 facilities, 3259 courts (all `source: "osm"`). Named 1151
  (98.2%); 203 school-context.
- **ca**: 7268 facilities, 19869 courts. Named 7088 (97.5%); 1123
  school-context.
- **de**: 289 facilities, 748 courts. Named 180 (62.3%; geocode backlog
  109); 30 school-context.
- **fl**: 5646 facilities, 14891 courts. Named 5462 (96.7%); 515
  school-context.
- **nm**: 470 facilities, 1162 courts. Named 450 (95.7%); 67 school-context.
- **ny**: 5003 facilities, 12540 courts — 4947 osm, 52 merged, 4
  nycparks-only; 56 facilities carry `tags.permitRequired`. Named 4868
  (97.3%); 587 school-context. Statewide superset of the old `nyc` region:
  all 311 former nyc facility ids are preserved.
- **ri**: 245 facilities, 679 courts. Named 132 (53.9%; geocode backlog
  113); 48 school-context.
- **vt**: 414 facilities, 824 courts. Named 149 (36.0%; geocode backlog
  265); 53 school-context.

Underlying OSM tag coverage is still sparse (3–13% lights info, 4–7% surface
known per region), so `unknown`/`null` values are common and should be
handled by consumers.
