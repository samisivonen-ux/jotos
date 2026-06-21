# Open Trail Data Sources

Jotos should prefer sources that are openly licensed, exportable and legally reusable. The safest default source is OpenStreetMap data, plus user uploads where the uploader explicitly chooses a public license.

## Recommended Sources

### OpenStreetMap

Use OpenStreetMap for:

- basemap features
- paths, tracks, footways and cycleways
- named hiking, cycling and walking route relations
- public amenities, shelters, viewpoints and trailheads

License: Open Data Commons Open Database License (ODbL).

Important tags:

- `type=route`
- `route=hiking`
- `route=foot`
- `route=bicycle`
- `route=mtb`
- `network=lwn|rwn|nwn|iwn`
- `name=*`
- `operator=*`
- `distance=*`
- `osmc:symbol=*`

Best access paths:

- Overpass API for small regional queries and discovery.
- Geofabrik extracts for country or regional imports.
- Planet OSM for full global imports.

### National Open Data Portals

Many countries publish trails, land-use, elevation, park boundaries and topographic data. Each dataset must be checked separately. Finland is especially relevant because OSM already incorporates National Land Survey of Finland data under the NLSFI license.

Use these sources for:

- elevation enrichment
- protected area boundaries
- official trail networks
- land ownership and access notes where available

### User Uploads

Use user uploads for:

- GPX/FIT/TCX activity tracks
- local route variants
- waypoint collections
- comments, photos and condition reports

Every public upload should require:

- visibility: public, unlisted or private
- license: CC0, CC BY 4.0, ODbL-compatible or private
- privacy trimming before publishing
- provenance note for imported data

## Sources To Avoid

- Scraped data from closed route platforms.
- GPX files with unclear authorship or unclear license.
- Google Maps, commercial map screenshots or proprietary map-derived coordinates.
- User activity logs published as public routes without explicit consent.

## Import Strategy

1. Start with Overpass queries around the current map viewport.
2. Cache normalized GeoJSON locally for offline browsing.
3. Promote stable public route data into PostGIS.
4. Store original uploaded files separately from normalized route geometry.
5. Package offline basemaps as PMTiles archives for regions the user chooses.

## Example Overpass Query

This finds hiking route relations in a bounding box:

```overpass
[out:json][timeout:60];
(
  relation["type"="route"]["route"="hiking"](60.10,24.70,60.40,25.20);
  relation["type"="route"]["route"="foot"](60.10,24.70,60.40,25.20);
);
out tags geom;
```

## Offline Map Direction

The preferred offline stack is:

- MapLibre GL JS for rendering.
- PMTiles for single-file vector tile archives.
- OpenStreetMap-derived vector tiles for basemaps.
- GeoJSON for user tracks, imported routes and waypoints.

This avoids requiring a proprietary map SDK, a paid tile API or an always-online tile server.

## Production Basemap Direction

Jotos should support multiple basemaps from day one:

- `Maasto`: offline-first, navigation-oriented terrain map inspired by Finnish outdoor maps. Production should generate this from National Land Survey of Finland open topographic data, typically the `Topographic map (raster)`, `Background map (raster)`, `Topographic Database` and related open products. The app should consume the result as a PMTiles package or similar self-hosted tile archive.
- `Topo`: online topographic reference map. In production this should come from the National Land Survey background map or our own cached/hosted tiles. OpenTopoMap is useful only as a temporary fallback.
- `Satellite`: satellite imagery for terrain context. Sentinel-derived imagery is the preferred open-data direction; production use needs clear attribution and a tile service/cache strategy.

Do not depend on unofficial Retkikartta tile scraping. If the visual target is Retkikartta-like, reproduce the cartography from licensed open datasets instead of copying a closed service endpoint.

## Finland Sources To Start With

Maanmittauslaitos explicitly publishes its topographic data as open data under CC BY 4.0 and documents the product families that can be used to build a terrain basemap. The key products for a `Maasto` style are:

- `Topographic map (raster)`
- `Background map (raster)`
- `Topographic Database`
- `Theme rasters`
- `Elevation model 10 m` and `Elevation model 2 m`

Implementation plan:

1. Download the chosen open products from MapSite.
2. Convert or tile them into a self-hosted package, preferably PMTiles.
3. Host the PMTiles file in S3 or another static object store.
4. Point `VITE_MAASTO_PMTILES_URL` at that package so MapLibre can use it through the `pmtiles://` protocol.
5. If you prefer not to host tiles yet, set `VITE_MML_API_KEY` and let the app use the official MML WMTS templates, or override them with `VITE_MML_MAASTO_WMTS_TEMPLATE` and `VITE_MML_TOPO_WMTS_TEMPLATE` if needed.

The National Land Survey documents its open map image service at [Map interface services](https://www.maanmittauslaitos.fi/en/maps-and-spatial-data/datasets-and-interfaces/map-interface-services/map-image-service-wms-wmts), including the open WMTS service address and the fact that topographic and background maps are available as open data. The product pages for [Topographic map (raster)](https://www.maanmittauslaitos.fi/en/maps-and-spatial-data/datasets-and-interfaces/product-descriptions/topographic-map-series-raster), [Background map (raster)](https://www.maanmittauslaitos.fi/en/maps-and-spatial-data/datasets-and-interfaces/product-descriptions/background-map-series-raster) and [Topographic Database](https://www.maanmittauslaitos.fi/en/maps-and-spatial-data/datasets-and-interfaces/product-descriptions/topographic-database) explain the available data families.
