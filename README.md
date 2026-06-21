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

## License

Code: AGPL-3.0-or-later.
