# Jotos

Jotos is an open-source GPS route viewer and map video tool for GPX files.

The current app focuses on one clear workflow: load a route, view it on an open map, tune the visual presentation, animate the playback and export a shareable MP4.

## Current Features

- local GPX import
- full-screen MapLibre map UI
- MML `Topo`, MML `Maasto` and satellite basemap selection
- automatic route centering after import
- route statistics and elevation summary
- draggable elevation profile overlay on the map
- elevation background opacity control
- route playback forward and reverse
- playback speed control
- start and finish trimming in metres
- route line color and thickness controls
- start and finish marker style controls
- MP4 export presets for social and master use

## Current Stack

- Vite + TypeScript frontend
- MapLibre GL JS for the interactive map
- MediaBunny for browser-side video encoding
- National Land Survey of Finland WMTS basemaps
- local GPX parsing in the browser

See [docs/social-video.md](docs/social-video.md) for the current route animation and export notes.

## Run Locally

```bash
npm install
npm run dev
```

## Intervals.icu-connected variant

Jotos ships as two independent builds from this one codebase:

- **Standalone** (`npm run build`) — local GPX import only, zero network calls beyond map tiles, zero third-party API surface. This is what's deployed at the bucket root today.
- **Connected** (`npm run build:connect`) — adds a panel to import a route directly from Intervals.icu (Garmin/Polar/Suunto/etc. activities synced there) instead of a local file. Deployed separately under `/connect/`.

The connected build is gated by `VITE_ENABLE_INTERVALS_CONNECT=true` at build time; when it's unset the Intervals.icu client code and UI are fully dead-code-eliminated from the standalone bundle (verified — grep the built `dist/` output for `intervals.icu` and it's absent).

A user's Intervals.icu API key is entered by them directly into the panel and used only for `fetch()` calls straight from their browser to `intervals.icu` — it is never sent to, or stored on, any Jotos-controlled server.

When a route's activities carry a recognized device/platform `source` (e.g. `GARMIN_CONNECT`, `POLAR`), the connected build shows a "Route data sourced from &lt;brand&gt; (via Intervals.icu)" line on that route — see `src/integrations/attribution.ts`. This covers text-based data-source attribution; if Garmin's developer terms require additional elements (e.g. a specific wordmark/logo), that hasn't been verified here and should be checked against Garmin's current developer agreement before wider release.

## License

Code: AGPL-3.0-or-later.
