# Mobile App Integration Plan

How to bring the Court Finder into the All About Tennis mobile app.
Written to be picked up cold on a macOS machine set up for mobile
development — everything you need is in this repo plus the live site.

**Live site:** https://jamesponwith.github.io/court-finder/
**Repo:** https://github.com/jamesponwith/court-finder

## Current state (what you're inheriting)

- Web app: Vite + React 18 + TypeScript (strict) + Leaflet. Mobile-first.
- Coverage: all 50 states + DC — ~67k facilities / ~187k courts, 97.7% with
  real names. Data ships as static JSON: `public/data/courts-<slug>.json`
  (slug = lowercase USPS code), served from GitHub Pages like a free CDN.
- **`src/lib/` is the portable core** — pure TypeScript, zero React/DOM/Vite
  imports, by design:
  - `types.ts` — the data contract (Facility, RegionConfig, REGIONS) 
  - `distance.ts` — haversine miles + formatting
  - `filters.ts` — filtering/sorting logic
  - `data.ts` — data loader (takes an injected `fetch` + base URL)
  - `geo.ts` — `regionForLocation()` (state auto-detection from a GPS fix)
  - `config.ts` — feedback email + correction mailto builder
  This folder compiles under React Native / Node / anything as-is.
- Data pipeline (`scripts/`) is independent of the app: `fetch-osm.mjs --all`
  → `normalize.mjs` → optional `geocode.mjs` + `normalize.mjs` again.
  `data/raw/geocode-cache.json` is committed and precious (~30k Nominatim
  lookups); raw OSM extracts are gitignored and regenerable.
- Deploys: push to `main` → GitHub Actions builds → GitHub Pages. No servers.

## Answer these before starting (they pick the path)

1. **What is the existing All About Tennis mobile app built with?**
   - React Native / Expo → Phase 2 is a direct port; `src/lib` drops in.
   - Native Swift/Kotlin → Phase 1 (WebView) is the long-term integration;
     port `src/lib` logic manually only if/when you go fully native.
   - Flutter → Phase 1 (webview_flutter); `src/lib` logic would be a Dart
     rewrite (small: ~500 lines of pure logic).
2. Do you want courts inside the store app, or a separate companion app?
3. Apple Developer account access on the Mac (needed for device builds,
   not for simulator work).

## macOS machine setup (Phase 0)

```sh
# core
git clone https://github.com/jamesponwith/court-finder.git
cd court-finder && npm install && npm run dev   # verify the web app runs
gh auth login                                    # for pushing/deploys

# mobile toolchain (React Native path)
xcode-select --install        # plus full Xcode from the App Store
brew install watchman cocoapods
```

Node ≥ 20 (repo was built on 24). No other secrets or services needed —
the app consumes public static JSON.

## Phase 1 — WebView embed (days, works with any app stack)

Ship the existing web app inside the mobile app as a screen.

1. Add an **embedded mode** to the web app: support `?embedded=1` to hide
   the header/footer chrome (the native app provides navigation). ~1 small
   PR in `src/App.tsx` + CSS.
2. Point a WebView at `https://jamesponwith.github.io/court-finder/?embedded=1`
   (React Native: `react-native-webview`; iOS native: `WKWebView`).
3. Geolocation: grant the WebView location permission from the native layer
   (iOS: `NSLocationWhenInUseUsageDescription` in Info.plist; the web app's
   "Near me" then works, including state auto-switching).
4. Intercept `https://www.google.com/maps/dir/` and `mailto:` navigations in
   the WebView and hand them to the OS (opens native Maps / Mail instead of
   navigating inside the WebView).
5. Optional deep-link bridge: `window.ReactNativeWebView.postMessage(...)`
   on court selection if the native app wants to react to it.

Result: full national court finder in the app with zero logic duplication.
Updates ship by pushing this repo — no app store release needed.

## Phase 2 — Native React Native screens (weeks, best UX)

Only if the mobile app is React Native (see question 1).

1. Extract `src/lib/` into a shared package (`packages/court-core` in a
   monorepo, or a private npm package `@allabouttennis/court-core`). It
   already has no dependencies — this is a file move + package.json.
2. Build native screens reusing the core:
   - Map: `react-native-maps` (Apple Maps on iOS) replaces Leaflet; reuse
     the clustering approach or `react-native-map-clustering`.
   - List/detail: FlatList + native bottom sheet; all filtering/sorting
     comes from `court-core/filters.ts` unchanged.
   - Location: `@react-native-community/geolocation` feeding
     `regionForLocation()` for state auto-detection.
3. Data: keep fetching the same `courts-<slug>.json` files from Pages —
   per-state files are 40KB–2.8MB, cache them on-device (AsyncStorage or
   filesystem) with a last-modified check for offline court browsing.
4. The web app stays live as-is for desktop/social/SEO.

## Phase 3 — Backend, when the product needs it

Static JSON has no per-user state. Add a thin API when you want:
favorites/saved courts, user-submitted corrections stored in a database
instead of email, court photos, "I'm playing here" check-ins, or analytics.
Cloudflare Workers or Supabase over the same JSON is the low-ops path; the
app's `data.ts` loader already takes an injected base URL, so switching
from static files to an API is a config change, not a rewrite.

## Non-negotiables to carry over

- **Attribution**: the data is ODbL — "© OpenStreetMap contributors" (and
  NYC Parks) must be visible wherever the data is shown, including native
  screens. The web footer does this today; replicate it in the app.
- **Nominatim etiquette**: never geocode from the client at scale; the
  committed cache + pipeline is the only place lookups happen.
- Keep `src/lib` pure (no React/DOM imports) — it's the whole reason the
  port is cheap.

## Data freshness (either phase)

Courts change slowly. Re-run the pipeline quarterly (or on demand):
`node scripts/fetch-osm.mjs --all --force`, `node scripts/geocode.mjs`,
`node scripts/normalize.mjs`, commit, push — the site and any app pointing
at the JSON update automatically. This can later become a scheduled GitHub
Action.
