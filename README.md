# Court Finder · by All About Tennis

A mobile-first web app for finding public tennis courts, built for the
**All About Tennis** brand. It ships with two regions — **Arizona** and
**New York City** — a full-screen map with clustered tennis-ball markers,
distance-aware search, filters, and per-facility detail pages with
directions.

## Quick start

```bash
npm install
npm run dev        # local dev server (Vite) at http://localhost:5173
npm run build      # typecheck (tsc --noEmit) + production build to dist/
npm run preview    # serve the production build locally
npm run typecheck  # tsc --noEmit only
```

Stack: **Vite + React 18 + TypeScript**, plain **Leaflet** (with
`leaflet.markercluster`) behind a small hand-rolled React wrapper — no
react-leaflet.

## Data pipeline

Court data is produced offline and served as static JSON:

- `scripts/` — pipeline scripts that pull raw source data (OpenStreetMap
  via Overpass, NYC Parks Open Data) into `data/raw/`, then normalize and
  merge it into the app-facing files.
- `data/raw/` — raw source snapshots (not consumed by the app).
- `public/data/courts-az.json` and `public/data/courts-nyc.json` — the
  normalized files the app fetches at runtime from `/data/courts-az.json`
  and `/data/courts-nyc.json`.
- `docs/` — additional pipeline documentation.

The app never talks to Overpass or NYC APIs directly; regenerating the
JSON is a separate offline step.

### Data schema

Each `public/data/courts-<region>.json` file:

```jsonc
{
  "region": "az" | "nyc",
  "attribution": "© OpenStreetMap contributors (ODbL); NYC Parks Open Data",
  "facilities": [
    {
      "id": "osm-w123456",            // stable: "osm-*" or "nycparks-*"
      "name": "Public Tennis Courts", // facility/park name (with fallback)
      "lat": 33.45, "lng": -112.07,   // WGS84 centroid of the facility
      "courtCount": 4,                // >= 1
      "surface": "hard" | "clay" | "grass" | "unknown",
      "lighted": true | false | null,
      "indoor": true | false | null,
      "access": "public" | "customers" | "private" | "unknown",
      "fee": true | false | null,
      "address": "123 Main St" | null,
      "city": "Phoenix" | null,
      "state": "AZ" | "NY",
      "source": "osm" | "nycparks" | "merged",
      "tags": {                       // optional extras
        "permitRequired": true,
        "hours": "...",
        "phone": "...",
        "website": "..."
      }
    }
  ]
}
```

The TypeScript source of truth for this contract is
[`src/lib/types.ts`](src/lib/types.ts).

## Architecture

```
src/
  lib/          Pure, framework-agnostic logic. ZERO React or DOM imports.
    types.ts      Data contract types + region config
    distance.ts   Haversine distance (miles) + formatting
    filters.ts    Filter + distance-sort functions
    data.ts       Region loader taking an injected fetch function
  components/   React UI (Header, FiltersBar, MapView, Sheet,
                CourtList, CourtCard, CourtDetail)
  styles/
    tokens.css    Design tokens — the ONE place the brand palette lives
    app.css       Layout and component styles
  App.tsx       Wires lib + components together
```

`src/lib/` is deliberately portable: it has no React, DOM, or Leaflet
imports, so it can be lifted into a React Native codebase unchanged.
`loadRegion()` takes a `fetch`-like function as an argument rather than
touching a global.

Theming uses CSS custom properties with automatic light/dark via
`prefers-color-scheme`; swap the palette in `src/styles/tokens.css` to
re-brand.

## Features

- Region switcher (Arizona / New York City), persisted in
  `localStorage`, defaulting to Arizona.
- Full-screen OpenStreetMap map with clustered, tennis-ball-styled
  markers and proper attribution.
- "Near me" geolocation: a you-are-here dot, distance in miles on every
  card, and nearest-first sorting. Denial is handled gracefully.
- Filters: lighted only, indoor only, surface, minimum court count, and
  text search over name/city/address.
- Mobile bottom sheet (drag or tap the handle to resize) that becomes a
  left sidebar on desktop.
- Detail view per facility with all fields, an NYC Parks permit note
  when `tags.permitRequired` is set, and a Google Maps Directions link.
- PWA-installable: web manifest + tennis SVG icon (no service worker —
  the app is fully functional online-only and the build stays simple).
- Loading skeletons, empty states, friendly fetch-failure state, and
  data attribution in the footer.

## Crowdsourced corrections

Facility detail pages can show a **"Suggest a correction"** button that
opens the visitor's mail app with a prefilled subject and checklist
(facility name/id/region, wrong location, court count, lights, surface,
permanently closed, other). One-line setup: set `FEEDBACK_EMAIL` in
[`src/lib/config.ts`](src/lib/config.ts) to the All About Tennis support
address. While it is `null` (the default) the button is hidden entirely.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub
Pages on every push to `main` (enable **Settings → Pages → Source:
GitHub Actions** once). The app is served as a project page at
`https://<user>.github.io/court-finder/`, so the workflow builds with
`BASE_PATH=/court-finder/`; Vite's `base` comes from that env var and
all asset/data URLs are resolved relative to it. A plain
`npm run build` still targets the site root for any other static host.

## Integrating into the All About Tennis mobile app

Recommended path, in order of effort:

1. **Embed as a WebView (now).** Deploy this app (any static host — the
   `dist/` folder is fully static) and embed it in the existing mobile
   app via a WebView pointed at the deployed URL. The UI is
   mobile-first, uses safe-area insets, and needs no native code. Pass
   brand overrides by hosting a tweaked `tokens.css` if the app theme
   differs.
2. **Port `src/lib/` to React Native (later).** `src/lib/` compiles
   anywhere TypeScript does: copy the folder as-is, feed `loadRegion()`
   React Native's global `fetch`, and rebuild only the view layer
   (e.g. `react-native-maps` in place of Leaflet). Filters, distance
   math, sorting, and the data contract carry over unchanged.
3. **Move the JSON behind an API (when ready).** The app only depends on
   `GET /data/courts-<region>.json`. Point `loadRegion()`'s `baseUrl`
   argument at an API endpoint that serves the same schema, and add
   server-side features (live court availability, bookings, more
   regions) without touching the client contract.

## Attribution

Court data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors (ODbL) and
[NYC Parks Open Data](https://www.nycgovparks.org/bigapps). Map tiles ©
OpenStreetMap contributors.
