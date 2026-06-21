# Jotos

Jotos is an open-source, free service concept for public trails, personal activities and GPX/FIT/TCX sharing.

The goal is to replace the everyday need for closed platforms such as trail catalogues, sport activity networks and waypoint-sharing services without copying their lock-in model.

## Product Direction

- Import and export GPX, FIT, TCX, KML and GeoJSON.
- Publish routes, tracks, segments and waypoint collections with clear visibility settings.
- Support hikes, runs, bike rides, ski tracks, paddling routes and scenic drives.
- Keep public trail knowledge open while keeping private activity logs private by default.
- Make every public route exportable and mirrorable.
- Let communities maintain trail conditions, closures, access notes and route versions.

## Data Principles

- User-owned data: users can export everything they upload.
- License-aware sharing: every public item should declare a license.
- Open public metadata: trail names, surfaces, hazards, access notes and maintenance history should be usable by the community.
- Privacy first: exact home starts, repeated personal patterns and private logs should not be public by accident.
- Federation-ready: the long-term architecture should allow self-hosted instances and mirrored public data.

## Suggested Architecture

- Web client: TypeScript, map UI, offline-first imports and route editing.
- API: PostGIS-backed service for tracks, routes, activities, waypoints and comments.
- Storage: object storage for original GPS files plus normalized geometry in PostGIS.
- Workers: GPS parsing, simplification, elevation enrichment, privacy trimming and export generation.
- Identity: local accounts first, optional OAuth later.
- Federation: ActivityPub or a lighter signed-feed model for public route mirroring.

## Current Prototype

This first version is a browser prototype. It includes:

- a public route library UI
- activity filtering
- local GPX import
- automatic distance and ascent summary
- GPX elevation profile with minimum, maximum, ascent and descent
- an interactive MapLibre route map
- animated route playback and browser-side H.264/MP4 export presets
- independent start and finish privacy trimming in metres
- a draggable elevation profile with adjustable background opacity
- an offline-ready PMTiles basemap direction
- MML-based `Maasto` and `Topo` basemap paths
- product principles and service framing

## Map And Data Direction

The map stack is intentionally open-source:

- MapLibre GL JS renders the interactive map.
- GPX uploads become local GeoJSON route layers.
- PMTiles is the planned offline basemap package format.
- `Maasto` is designed to load either a self-hosted PMTiles pack or the official National Land Survey WMTS when an API key is present.
- OpenStreetMap is the preferred source for public basemap and route data, with ODbL attribution and share-alike obligations.

See [docs/data-sources.md](docs/data-sources.md) for the import strategy and recommended public data sources.

See [docs/social-video.md](docs/social-video.md) for route animation and social video export direction.

See [docs/agentic-ecosystem-architecture.md](docs/agentic-ecosystem-architecture.md) for the MCP/A2A/AG-UI target architecture, Garmin and Intervals.icu integration plan, open-source reuse map and commercialization strategy.

## Run Locally

```bash
npm install
npm run dev
```

## Roadmap

1. Add a local PMTiles basemap package for the first pilot region.
2. Add OpenStreetMap route discovery through Overpass and imported extracts.
3. Add FIT, TCX, KML and GeoJSON import support.
4. Add route editing and waypoint collections.
5. Build a backend with PostGIS and original-file storage.
6. Add accounts, privacy zones and share links.
7. Add moderation, trail version history and community maintenance reports.
8. Add native/mobile-friendly recording and offline maps.

## License

Code: AGPL-3.0-or-later.

Public trail data: uploader chooses a compatible open license such as CC BY 4.0, ODbL or CC0 depending on the data type and source.
