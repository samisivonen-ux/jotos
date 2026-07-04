import maplibregl, { addProtocol, type LngLatBoundsLike, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import './styles.css';
import { attributionForSource } from './integrations/attribution';

/**
 * Set at build time only. The standalone Jotos build (jotos-web) ships with
 * this false and Vite/Rollup dead-code-eliminates the Intervals.icu panel
 * and client entirely, so that deployment has zero third-party API surface.
 * The connected build sets VITE_ENABLE_INTERVALS_CONNECT=true.
 */
const INTERVALS_CONNECT_ENABLED = import.meta.env.VITE_ENABLE_INTERVALS_CONNECT === 'true';

const TELEGRAM_VIDEO_UPLOAD_URL_ENDPOINT = import.meta.env.VITE_TELEGRAM_VIDEO_UPLOAD_URL_ENDPOINT as
  | string
  | undefined;
const TELEGRAM_VIDEO_FINALIZE_ENDPOINT = import.meta.env.VITE_TELEGRAM_VIDEO_FINALIZE_ENDPOINT as string | undefined;

export type TrackPoint = {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
};

export type Trail = {
  id: string;
  title: string;
  region: string;
  activity: string;
  distanceKm: number;
  ascentM: number;
  privacy: 'Public' | 'Unlisted' | 'Private';
  license: string;
  tags: string[];
  points: TrackPoint[];
  /** Device/platform attribution line, set when points came from a connected API rather than a local file. */
  sourceAttribution?: string;
};

type BasemapId = 'retki' | 'topo' | 'satellite';
type PlaybackMode = 'distance' | 'timeline';
type VideoPresetId = 'instagram' | 'whatsapp' | 'facebook' | 'youtube-shorts' | 'youtube' | 'master';
type VideoExportMode = 'map' | 'elevation';
type RoutePointSymbol = 'dot' | 'pin' | 'square' | 'diamond' | 'flag';

type PlaybackState = {
  point: TrackPoint;
  passedPoints: TrackPoint[];
  distanceKm: number;
};

type RoutePlaybackDirection = 'forward' | 'reverse';

type ElevationCursor = {
  x: number;
  y: number;
};

type VideoPreset = {
  label: string;
  detail: string;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  maxDurationSeconds: number;
};

type RouteCoverage = {
  inFinland: boolean;
};

type RouteColorPresetId = 'orange' | 'gold' | 'teal' | 'blue' | 'red' | 'purple';

const desktopViewport = window.matchMedia('(min-width: 721px)');
const defaultEmptyMapCenter: [number, number] = [25.7569014, 62.1074354];
const routeColorPresets: Record<RouteColorPresetId, { label: string; color: string }> = {
  orange: { label: 'Orange', color: '#f28c28' },
  gold: { label: 'Gold', color: '#f0d870' },
  teal: { label: 'Teal', color: '#54d49b' },
  blue: { label: 'Blue', color: '#6aa8ff' },
  red: { label: 'Red', color: '#ff6b6b' },
  purple: { label: 'Purple', color: '#bb86fc' }
};
const maastoPackUrl = import.meta.env.VITE_MAASTO_PMTILES_URL?.trim() ?? '';
const maastoPackEnabled = maastoPackUrl.length > 0;
const maastoWmtsTemplate = import.meta.env.VITE_MAASTO_WMTS_TEMPLATE?.trim() ?? '';
const mmlApiKey = import.meta.env.VITE_MML_API_KEY?.trim() ?? '';
const mmlMaastoWmtsTemplate =
  import.meta.env.VITE_MML_MAASTO_WMTS_TEMPLATE?.trim() ??
  `https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=maastokartta&STYLE=default&TILEMATRIXSET=WGS84_Pseudo-Mercator&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png${mmlApiKey ? `&api-key=${encodeURIComponent(mmlApiKey)}` : ''}`;
const mmlTopoWmtsTemplate =
  import.meta.env.VITE_MML_TOPO_WMTS_TEMPLATE?.trim() ??
  `https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=taustakartta&STYLE=default&TILEMATRIXSET=WGS84_Pseudo-Mercator&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png${mmlApiKey ? `&api-key=${encodeURIComponent(mmlApiKey)}` : ''}`;

addProtocol('pmtiles', new Protocol().tile);

const basemaps: Record<BasemapId, { label: string; description: string }> = {
  topo: {
    label: 'MML Topo',
    description: 'National Land Survey background map'
  },
  satellite: {
    label: 'Satellite',
    description: 'Sentinel imagery'
  },
  retki: {
    label: 'MML Maasto',
    description: maastoPackEnabled || maastoWmtsTemplate || mmlApiKey ? 'National Land Survey topographic map' : 'Connect MML API key'
  }
};

const videoPresets: Record<VideoPresetId, VideoPreset> = {
  instagram: {
    label: 'Instagram Reels',
    detail: 'Vertical · recommended reach',
    width: 1080,
    height: 1920,
    fps: 30,
    bitrate: 8_000_000,
    maxDurationSeconds: 180
  },
  whatsapp: {
    label: 'WhatsApp',
    detail: 'Vertical · compact file',
    width: 720,
    height: 1280,
    fps: 30,
    bitrate: 4_000_000,
    maxDurationSeconds: 90
  },
  facebook: {
    label: 'Facebook Reels',
    detail: 'Vertical · high quality',
    width: 1080,
    height: 1920,
    fps: 30,
    bitrate: 8_000_000,
    maxDurationSeconds: 180
  },
  'youtube-shorts': {
    label: 'YouTube Shorts',
    detail: 'Vertical · up to 3 minutes',
    width: 1080,
    height: 1920,
    fps: 30,
    bitrate: 8_000_000,
    maxDurationSeconds: 180
  },
  youtube: {
    label: 'YouTube',
    detail: 'Landscape · Full HD',
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate: 8_000_000,
    maxDurationSeconds: 15 * 60
  },
  master: {
    label: 'Master / Final Cut',
    detail: 'Landscape · 4K production master',
    width: 3840,
    height: 2160,
    fps: 30,
    bitrate: 45_000_000,
    maxDurationSeconds: 60 * 60
  }
};

const sampleTrails: Trail[] = [];

const state = {
  trails: [...sampleTrails],
  selectedId: undefined as string | undefined,
  menuOpen: desktopViewport.matches,
  playbackSpeed: 1,
  playbackMode: 'distance' as PlaybackMode,
  trimStartMeters: 0,
  trimEndMeters: 0,
  basemap: 'topo' as BasemapId,
  showFullRoute: true,
  routeColorPreset: 'orange' as RouteColorPresetId,
  routeLineThickness: 4.4,
  startPointSymbol: 'dot' as RoutePointSymbol,
  stopPointSymbol: 'pin' as RoutePointSymbol,
  routePlaybackVisible: false,
  elevationBackgroundOpacity: 0.64,
  videoPreset: 'instagram' as VideoPresetId,
  videoExportMode: 'map' as VideoExportMode,
  overlays: {
    details: false,
    mapInfo: false,
    videoBadge: false,
    elevation: true
  },
  videoOverlays: {
    elevation: true
  },
  intervalsPanelOpen: false,
  intervalsApiKey: '',
  intervalsAthleteId: '',
  intervalsActivities: [] as import('./integrations/intervals-client').IntervalsActivitySummary[],
  intervalsStatus: '',
  intervalsBusy: false,
  elevationPosition: {
    x: 0.03,
    y: 0.68
  }
};

const app = document.querySelector<HTMLDivElement>('#app');
let map: maplibregl.Map | undefined;
let mapBasemap: BasemapId | undefined;
let mapTrailId: string | undefined;
let animationFrame: number | undefined;
let elevationDragController: AbortController | undefined;
let trimRenderTimeout: number | undefined;
let animationLastFrameAt = 0;
let animationProgress = 0;
const minimumAnimationDurationMs = 9000;

if (!app) {
  throw new Error('App root was not found.');
}

function parseGpx(xmlText: string): TrackPoint[] {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserError = xml.querySelector('parsererror');

  if (parserError) {
    throw new Error('GPX file could not be read.');
  }

  const trackPoints = [...xml.querySelectorAll('trkpt, rtept, wpt')];

  return trackPoints
    .map((point) => ({
      lat: Number(point.getAttribute('lat')),
      lon: Number(point.getAttribute('lon')),
      ele: point.querySelector('ele') ? Number(point.querySelector('ele')?.textContent) : undefined,
      time: point.querySelector('time')?.textContent ?? undefined
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceBetween(a: TrackPoint, b: TrackPoint): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function interpolateTrackPoint(a: TrackPoint, b: TrackPoint, progress: number): TrackPoint {
  const timestampA = a.time ? Date.parse(a.time) : Number.NaN;
  const timestampB = b.time ? Date.parse(b.time) : Number.NaN;
  const elevation =
    a.ele !== undefined && b.ele !== undefined ? a.ele + (b.ele - a.ele) * progress : a.ele ?? b.ele;
  const timestamp =
    Number.isFinite(timestampA) && Number.isFinite(timestampB)
      ? new Date(timestampA + (timestampB - timestampA) * progress).toISOString()
      : a.time ?? b.time;

  return {
    lat: a.lat + (b.lat - a.lat) * progress,
    lon: a.lon + (b.lon - a.lon) * progress,
    ele: elevation,
    time: timestamp
  };
}

function pointAtDistance(points: TrackPoint[], targetKm: number): TrackPoint {
  let travelledKm = 0;

  for (let index = 1; index < points.length; index += 1) {
    const segmentKm = distanceBetween(points[index - 1], points[index]);
    if (travelledKm + segmentKm >= targetKm) {
      const progress = segmentKm > 0 ? (targetKm - travelledKm) / segmentKm : 0;
      return interpolateTrackPoint(points[index - 1], points[index], Math.min(Math.max(progress, 0), 1));
    }
    travelledKm += segmentKm;
  }

  return points[points.length - 1];
}

function isWithinFinlandBounds(point: TrackPoint): boolean {
  return point.lat >= 59.5 && point.lat <= 70.5 && point.lon >= 19.0 && point.lon <= 32.0;
}

function getRouteCoverage(trail?: Trail): RouteCoverage {
  if (!trail || trail.points.length === 0) {
    return { inFinland: true };
  }

  return {
    inFinland: trail.points.every(isWithinFinlandBounds)
  };
}

function trimPointsByDistance(points: TrackPoint[], startMeters: number, endMeters: number): TrackPoint[] {
  if (points.length < 2) {
    return points;
  }

  const cumulativeKm = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulativeKm.push(cumulativeKm[index - 1] + distanceBetween(points[index - 1], points[index]));
  }

  const totalKm = cumulativeKm[cumulativeKm.length - 1];
  const startKm = Math.min(Math.max(startMeters, 0) / 1000, Math.max(totalKm - 0.001, 0));
  const endKm = Math.min(Math.max(endMeters, 0) / 1000, Math.max(totalKm - startKm - 0.001, 0));
  const finishKm = totalKm - endKm;
  const visible = points.filter((_, index) => cumulativeKm[index] > startKm && cumulativeKm[index] < finishKm);

  return [pointAtDistance(points, startKm), ...visible, pointAtDistance(points, finishKm)];
}

function getRouteLineColor(): string {
  return routeColorPresets[state.routeColorPreset].color;
}

function getRoutePlaybackDurationMs(trail: Trail): number {
  return Math.min(Math.max(minimumAnimationDurationMs, trail.distanceKm * 1_200), 180_000);
}

function createRouteMarkerImage(symbol: RoutePointSymbol, variant: 'start' | 'stop'): ImageData {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Route marker could not be created.');
  }

  const fill = variant === 'start' ? '#56b497' : '#df835e';
  const stroke = '#101917';
  context.fillStyle = fill;
  context.strokeStyle = stroke;
  context.lineWidth = 4;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.beginPath();

  if (symbol === 'pin') {
    context.arc(24, 17, 10, Math.PI * 0.15, Math.PI * 0.85, true);
    context.lineTo(24, 42);
    context.closePath();
  } else if (symbol === 'square') {
    context.rect(13, 13, 22, 22);
  } else if (symbol === 'diamond') {
    context.moveTo(24, 9);
    context.lineTo(39, 24);
    context.lineTo(24, 39);
    context.lineTo(9, 24);
    context.closePath();
  } else if (symbol === 'flag') {
    context.moveTo(14, 40);
    context.lineTo(14, 9);
    context.lineTo(36, 14);
    context.lineTo(14, 23);
    context.closePath();
  } else {
    context.arc(24, 24, 10, 0, Math.PI * 2);
  }

  context.fill();
  context.stroke();
  return context.getImageData(0, 0, size, size);
}

function updateRouteMarkerImages(): void {
  if (!map) {
    return;
  }

  const images = [
    ['route-start-marker', createRouteMarkerImage(state.startPointSymbol, 'start')],
    ['route-stop-marker', createRouteMarkerImage(state.stopPointSymbol, 'stop')]
  ] as const;

  images.forEach(([name, image]) => {
    if (map?.hasImage(name)) {
      map.updateImage(name, image);
    } else {
      map?.addImage(name, image, { pixelRatio: 2 });
    }
  });
}

function applyRouteStyleSettings(): void {
  if (!map) {
    return;
  }

  const fullRouteVisibility = state.showFullRoute ? 'visible' : 'none';
  const playbackVisibility = state.routePlaybackVisible ? 'visible' : 'none';
  ['route-shadow', 'route-line'].forEach((layerId) => {
    if (map?.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', fullRouteVisibility);
  });
  ['route-progress-line', 'route-position-glow', 'route-position-dot'].forEach((layerId) => {
    if (map?.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', playbackVisibility);
  });
  ['route-start-symbol', 'route-stop-symbol'].forEach((layerId) => {
    if (map?.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', state.showFullRoute || state.routePlaybackVisible ? 'visible' : 'none');
    }
  });

  if (map.getLayer('route-shadow')) {
    map.setPaintProperty('route-shadow', 'line-width', state.routeLineThickness + 5.2);
  }
  if (map.getLayer('route-line')) {
    map.setPaintProperty('route-line', 'line-color', getRouteLineColor());
    map.setPaintProperty('route-line', 'line-width', state.routeLineThickness);
  }
  if (map.getLayer('route-progress-line')) {
    map.setPaintProperty('route-progress-line', 'line-color', getRouteLineColor());
    map.setPaintProperty('route-progress-line', 'line-width', state.routeLineThickness + 1.1);
  }
  updateRouteMarkerImages();
}

function syncMapTrailSources(trail?: Trail, profile?: ElevationProfile): void {
  if (!map || !trail) {
    return;
  }

  const trailSource = map.getSource('selected-trail') as maplibregl.GeoJSONSource | undefined;
  const progressSource = map.getSource('route-progress') as maplibregl.GeoJSONSource | undefined;
  const positionSource = map.getSource('route-position') as maplibregl.GeoJSONSource | undefined;

  trailSource?.setData(trailToGeoJson(trail));
  const playback = getPlaybackState(trail.points, animationProgress);
  progressSource?.setData(progressLineGeoJson(playback.passedPoints));
  positionSource?.setData(animatedPositionGeoJson(playback.point));
  updateElevationOverlayProgress(trail, playback, profile);
}

function getVisibleTrail(trail: Trail): Trail {
  const points = trimPointsByDistance(trail.points, state.trimStartMeters, state.trimEndMeters);
  return { ...trail, points, ...summarize(points) };
}

function summarize(points: TrackPoint[]): Pick<Trail, 'distanceKm' | 'ascentM'> {
  let distanceKm = 0;
  let ascentM = 0;

  for (let index = 1; index < points.length; index += 1) {
    distanceKm += distanceBetween(points[index - 1], points[index]);

    const previousEle = points[index - 1].ele;
    const currentEle = points[index].ele;

    if (previousEle !== undefined && currentEle !== undefined && currentEle > previousEle) {
      ascentM += currentEle - previousEle;
    }
  }

  return {
    distanceKm: Number(distanceKm.toFixed(1)),
    ascentM: Math.round(ascentM)
  };
}

function getTrailDistanceKm(points: TrackPoint[]): number {
  let distanceKm = 0;

  for (let index = 1; index < points.length; index += 1) {
    distanceKm += distanceBetween(points[index - 1], points[index]);
  }

  return distanceKm;
}

type ElevationProfile = {
  ascentM: number;
  descentM: number;
  minM: number;
  maxM: number;
  linePath: string;
  areaPath: string;
  coordinates: ReadonlyArray<readonly [number, number]>;
};

function getElevationProfile(points: TrackPoint[]): ElevationProfile | undefined {
  const cumulativeDistances = [0];

  for (let index = 1; index < points.length; index += 1) {
    cumulativeDistances.push(cumulativeDistances[index - 1] + distanceBetween(points[index - 1], points[index]));
  }

  const samples = points.flatMap((point, index) =>
    point.ele !== undefined && Number.isFinite(point.ele)
      ? [{ distance: cumulativeDistances[index], elevation: point.ele }]
      : []
  );

  if (samples.length < 2) {
    return undefined;
  }

  let ascentM = 0;
  let descentM = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1].ele;
    const current = points[index].ele;

    if (previous === undefined || current === undefined) {
      continue;
    }

    const difference = current - previous;
    if (difference > 0) {
      ascentM += difference;
    } else {
      descentM += Math.abs(difference);
    }
  }

  const elevations = samples.map((sample) => sample.elevation);
  const minM = Math.min(...elevations);
  const maxM = Math.max(...elevations);
  const elevationRange = maxM - minM;
  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
  const chartWidth = 320;
  const chartTop = 8;
  const chartBottom = 88;
  const chartHeight = chartBottom - chartTop;
  const coordinates = samples.map((sample, index) => {
    const x = totalDistance > 0 ? (sample.distance / totalDistance) * chartWidth : (index / (samples.length - 1)) * chartWidth;
    const normalizedElevation = elevationRange > 0 ? (sample.elevation - minM) / elevationRange : 0.5;
    const y = chartBottom - normalizedElevation * chartHeight;
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const;
  });
  const linePath = coordinates.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1][0]} ${chartBottom} L ${coordinates[0][0]} ${chartBottom} Z`;

  return {
    ascentM: Math.round(ascentM),
    descentM: Math.round(descentM),
    minM: Math.round(minM),
    maxM: Math.round(maxM),
    linePath,
    areaPath,
    coordinates
  };
}

function getElevationCursor(
  profile: ElevationProfile,
  trailPoints: TrackPoint[],
  playback: PlaybackState
): ElevationCursor | undefined {
  const totalDistanceKm = getTrailDistanceKm(trailPoints);
  const elevation = playback.point.ele;

  if (totalDistanceKm <= 0 || elevation === undefined || !Number.isFinite(elevation)) {
    return undefined;
  }

  const distanceRatio = Math.min(Math.max(playback.distanceKm / totalDistanceKm, 0), 1);
  const elevationRange = profile.maxM - profile.minM;
  const elevationRatio = elevationRange > 0 ? (elevation - profile.minM) / elevationRange : 0.5;

  return {
    x: Number((distanceRatio * 320).toFixed(2)),
    y: Number((88 - elevationRatio * 80).toFixed(2))
  };
}

type Bounds = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

function getBounds(points: TrackPoint[]): Bounds {
  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lon);
  const padding = 0.006;

  return {
    minLat: Math.min(...latitudes) - padding,
    maxLat: Math.max(...latitudes) + padding,
    minLon: Math.min(...longitudes) - padding,
    maxLon: Math.max(...longitudes) + padding
  };
}

function getCenter(points: TrackPoint[]): [number, number] {
  const bounds = getBounds(points);

  return [(bounds.minLon + bounds.maxLon) / 2, (bounds.minLat + bounds.maxLat) / 2];
}

function trailToGeoJson(trail: Trail): GeoJSON.FeatureCollection {
  const coordinates = trail.points.map((point) => [point.lon, point.lat]);
  const start = coordinates[0];
  const finish = coordinates[coordinates.length - 1];

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'route', title: trail.title },
        geometry: {
          type: 'LineString',
          coordinates
        }
      },
      {
        type: 'Feature',
        properties: { kind: 'start', title: 'Start' },
        geometry: {
          type: 'Point',
          coordinates: start
        }
      },
      {
        type: 'Feature',
        properties: { kind: 'finish', title: 'Finish' },
        geometry: {
          type: 'Point',
          coordinates: finish
        }
      }
    ]
  };
}

function emptyLineGeoJson(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'animated-line' },
        geometry: {
          type: 'LineString',
          coordinates: []
        }
      }
    ]
  };
}

function animatedPositionGeoJson(point: TrackPoint): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'animated-position' },
        geometry: {
          type: 'Point',
          coordinates: [point.lon, point.lat]
        }
      }
    ]
  };
}

function interpolatePoint(a: TrackPoint, b: TrackPoint, progress: number): TrackPoint {
  return {
    lat: a.lat + (b.lat - a.lat) * progress,
    lon: a.lon + (b.lon - a.lon) * progress,
    ele: a.ele !== undefined && b.ele !== undefined ? a.ele + (b.ele - a.ele) * progress : undefined
  };
}

function getTimelineTimes(points: TrackPoint[]): number[] | undefined {
  const times = points.map((point) => (point.time ? Date.parse(point.time) : Number.NaN));

  if (times.some((time) => !Number.isFinite(time))) {
    return undefined;
  }

  for (let index = 1; index < times.length; index += 1) {
    if (times[index] < times[index - 1]) {
      return undefined;
    }
  }

  return times[times.length - 1] > times[0] ? times : undefined;
}

function formatElapsedTime(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (minutes > 0) {
    return `${minutes} min ${seconds > 0 ? `${seconds} s` : ''}`.trim();
  }

  return `${seconds} s`;
}

function getRoutePlaybackPoint(points: TrackPoint[], progress: number): { point: TrackPoint; passedPoints: TrackPoint[] } {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const segmentDistances = points.slice(1).map((point, index) => distanceBetween(points[index], point));
  const totalDistance = segmentDistances.reduce((sum, distance) => sum + distance, 0);
  const targetDistance = totalDistance * clampedProgress;
  let travelled = 0;

  for (let index = 1; index < points.length; index += 1) {
    const segmentDistance = segmentDistances[index - 1];

    if (travelled + segmentDistance >= targetDistance) {
      const segmentProgress = segmentDistance === 0 ? 0 : (targetDistance - travelled) / segmentDistance;
      const point = interpolatePoint(points[index - 1], points[index], segmentProgress);

      return {
        point,
        passedPoints: [...points.slice(0, index), point]
      };
    }

    travelled += segmentDistance;
  }

  return {
    point: points[points.length - 1],
    passedPoints: [...points]
  };
}

function getRoutePlaybackState(points: TrackPoint[], progress: number): PlaybackState {
  const cumulativeDistances = [0];

  for (let index = 1; index < points.length; index += 1) {
    cumulativeDistances.push(cumulativeDistances[index - 1] + distanceBetween(points[index - 1], points[index]));
  }

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const targetDistance = totalDistance * clampedProgress;
  let travelled = 0;

  for (let index = 1; index < points.length; index += 1) {
    const segmentDistance = cumulativeDistances[index] - cumulativeDistances[index - 1];

    if (travelled + segmentDistance >= targetDistance) {
      const segmentProgress = segmentDistance === 0 ? 0 : (targetDistance - travelled) / segmentDistance;
      const point = interpolatePoint(points[index - 1], points[index], segmentProgress);

      return {
        point,
        passedPoints: [...points.slice(0, index), point],
        distanceKm: travelled + segmentDistance * segmentProgress
      };
    }

    travelled += segmentDistance;
  }

  return {
    point: points[points.length - 1],
    passedPoints: [...points],
    distanceKm: totalDistance
  };
}

function getTimelinePlaybackState(points: TrackPoint[], progress: number): PlaybackState {
  const times = getTimelineTimes(points);

  if (!times) {
    return getRoutePlaybackState(points, progress);
  }

  const cumulativeDistances = [0];

  for (let index = 1; index < points.length; index += 1) {
    cumulativeDistances.push(cumulativeDistances[index - 1] + distanceBetween(points[index - 1], points[index]));
  }

  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const targetTime = times[0] + (times[times.length - 1] - times[0]) * clampedProgress;

  for (let index = 1; index < points.length; index += 1) {
    if (times[index] >= targetTime) {
      const segmentDuration = times[index] - times[index - 1];
      const segmentProgress = segmentDuration === 0 ? 1 : (targetTime - times[index - 1]) / segmentDuration;
      const point = interpolatePoint(points[index - 1], points[index], segmentProgress);
      const distanceKm =
        cumulativeDistances[index - 1] +
        (cumulativeDistances[index] - cumulativeDistances[index - 1]) * segmentProgress;

      return {
        point,
        passedPoints: [...points.slice(0, index), point],
        distanceKm
      };
    }
  }

  return {
    point: points[points.length - 1],
    passedPoints: [...points],
    distanceKm: cumulativeDistances[cumulativeDistances.length - 1]
  };
}

function getPlaybackState(points: TrackPoint[], progress: number): PlaybackState {
  return state.playbackMode === 'timeline'
    ? getTimelinePlaybackState(points, progress)
    : getRoutePlaybackState(points, progress);
}

function progressLineGeoJson(points: TrackPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'animated-line' },
        geometry: {
          type: 'LineString',
          coordinates: points.map((point) => [point.lon, point.lat])
        }
      }
    ]
  };
}

function updateElevationOverlayProgress(trail: Trail, playback: PlaybackState, profile?: ElevationProfile): void {
  const currentProfile = profile ?? getElevationProfile(trail.points);
  const overlay = document.querySelector<HTMLElement>('[data-elevation-overlay]');
  const cursorLine = overlay?.querySelector<SVGLineElement>('[data-elevation-progress-line]');
  const cursorDot = overlay?.querySelector<SVGCircleElement>('[data-elevation-progress-dot]');

  if (!overlay || !cursorLine || !cursorDot || !currentProfile) {
    return;
  }

  const cursor = getElevationCursor(currentProfile, trail.points, playback);

  if (!cursor) {
    cursorLine.setAttribute('opacity', '0');
    cursorDot.setAttribute('opacity', '0');
    return;
  }

  cursorLine.setAttribute('opacity', '1');
  cursorLine.setAttribute('x1', cursor.x.toFixed(2));
  cursorLine.setAttribute('x2', cursor.x.toFixed(2));
  cursorLine.setAttribute('y1', '8');
  cursorLine.setAttribute('y2', '88');
  cursorDot.setAttribute('opacity', '1');
  cursorDot.setAttribute('cx', cursor.x.toFixed(2));
  cursorDot.setAttribute('cy', cursor.y.toFixed(2));
}

function updatePlaybackSources(trail: Trail, progress: number, profile?: ElevationProfile): PlaybackState {
  if (!map) {
    return getPlaybackState(trail.points, progress);
  }

  const playback = getPlaybackState(trail.points, progress);
  const progressSource = map.getSource('route-progress') as maplibregl.GeoJSONSource | undefined;
  const positionSource = map.getSource('route-position') as maplibregl.GeoJSONSource | undefined;

  progressSource?.setData(progressLineGeoJson(playback.passedPoints));
  positionSource?.setData(animatedPositionGeoJson(playback.point));
  updateElevationOverlayProgress(trail, playback, profile);
  return playback;
}

function stopRouteAnimation(): void {
  if (animationFrame !== undefined) {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = undefined;
  }
}

function animateRoute(
  trail: Trail,
  options: { durationMs?: number; onDone?: () => void; direction?: RoutePlaybackDirection; startProgress?: number } = {}
): void {
  const direction = options.direction ?? 'forward';
  const startProgress = options.startProgress ?? (direction === 'reverse' ? 1 : 0);
  stopRouteAnimation();
  animationLastFrameAt = performance.now();
  animationProgress = Math.min(Math.max(startProgress, 0), 1);
  const durationMs = options.durationMs ?? getRoutePlaybackDurationMs(trail);

  const step = (now: number) => {
    const elapsedMs = now - animationLastFrameAt;
    animationLastFrameAt = now;
    const progressDelta = (elapsedMs * state.playbackSpeed) / durationMs;
    animationProgress = Math.min(
      Math.max(animationProgress + (direction === 'reverse' ? -progressDelta : progressDelta), 0),
      1
    );
    updatePlaybackSources(trail, animationProgress);

    if ((direction === 'forward' && animationProgress < 1) || (direction === 'reverse' && animationProgress > 0)) {
      animationFrame = window.requestAnimationFrame(step);
      return;
    }

    animationFrame = undefined;
    options.onDone?.();
  };

  updatePlaybackSources(trail, startProgress);
  animationFrame = window.requestAnimationFrame(step);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawElevationOverlayToVideo(
  context: CanvasRenderingContext2D,
  profile: ElevationProfile,
  outputCanvas: HTMLCanvasElement,
  playback?: PlaybackState,
  trailPoints?: TrackPoint[],
  elevationOnly = false
): void {
  const scale = outputCanvas.width / 1080;
  const width = elevationOnly ? outputCanvas.width * 0.92 : Math.min(outputCanvas.width * 0.86, 720 * scale);
  const height = elevationOnly ? outputCanvas.height * 0.72 : Math.min(width * 0.34, outputCanvas.height * 0.2);
  const x = elevationOnly
    ? (outputCanvas.width - width) / 2
    : (outputCanvas.width - width) / 2;
  const y = elevationOnly
    ? outputCanvas.height * 0.12
    : outputCanvas.height - height - outputCanvas.height * 0.035;
  const insetX = elevationOnly ? 32 * scale : 24 * scale;
  const chartTop = y + (elevationOnly ? 84 : 68) * scale;
  const chartHeight = Math.max(height - (elevationOnly ? 152 : 128) * scale, 76 * scale);
  const chartBottom = chartTop + chartHeight;
  const chartWidth = width - insetX * 2;

  context.save();
  if (!elevationOnly && state.elevationBackgroundOpacity > 0) {
    roundedRectPath(context, x, y, width, height, 8 * scale);
    context.fillStyle = `rgba(18, 28, 23, ${state.elevationBackgroundOpacity})`;
    context.fill();
    context.strokeStyle = `rgba(255, 255, 255, ${state.elevationBackgroundOpacity * 0.25})`;
    context.lineWidth = Math.max(scale, 1);
    context.stroke();
  }

  const routeColor = getRouteLineColor();
  context.fillStyle = routeColor;
  context.font = `700 ${elevationOnly ? 30 * scale : 22 * scale}px Inter, sans-serif`;
  context.fillText('Elevation', x + insetX, y + (elevationOnly ? 46 : 40) * scale);

  context.beginPath();
  profile.coordinates.forEach(([profileX, profileY], index) => {
    const pointX = x + insetX + (profileX / 320) * chartWidth;
    const pointY = chartTop + ((profileY - 8) / 80) * chartHeight;
    if (index === 0) {
      context.moveTo(pointX, pointY);
    } else {
      context.lineTo(pointX, pointY);
    }
  });
  context.lineTo(x + insetX + chartWidth, chartTop + chartHeight);
  context.lineTo(x + insetX, chartTop + chartHeight);
  context.closePath();
  context.save();
  context.globalAlpha = 0.14;
  context.fillStyle = routeColor;
  context.fill();
  context.restore();

  context.beginPath();
  profile.coordinates.forEach(([profileX, profileY], index) => {
    const pointX = x + insetX + (profileX / 320) * chartWidth;
    const pointY = chartTop + ((profileY - 8) / 80) * chartHeight;
    if (index === 0) {
      context.moveTo(pointX, pointY);
    } else {
      context.lineTo(pointX, pointY);
    }
  });
  context.strokeStyle = routeColor;
  context.lineWidth = 3 * scale;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.stroke();

  if (playback && trailPoints) {
    const cursor = getElevationCursor(profile, trailPoints, playback);

    if (cursor) {
      const cursorX = x + insetX + (cursor.x / 320) * chartWidth;
      const cursorY = chartTop + ((cursor.y - 8) / 80) * chartHeight;

      context.beginPath();
      context.moveTo(cursorX, chartTop);
      context.lineTo(cursorX, chartBottom);
      context.save();
      context.globalAlpha = 0.4;
      context.strokeStyle = routeColor;
      context.lineWidth = 1.4 * scale;
      context.stroke();
      context.restore();

      context.beginPath();
      context.arc(cursorX, cursorY, 5.2 * scale, 0, Math.PI * 2);
      context.fillStyle = '#f5f2ea';
      context.fill();
      context.beginPath();
      context.arc(cursorX, cursorY, 8.4 * scale, 0, Math.PI * 2);
      context.strokeStyle = routeColor;
      context.lineWidth = 3 * scale;
      context.stroke();
    }
  }

  const stats = [
    ['LOW', `${profile.minM} m`],
    ['HIGH', `${profile.maxM} m`],
    ['ASCENT', `+${profile.ascentM} m`],
    ['DESCENT', `-${profile.descentM} m`]
  ];
  const statsTop = y + height - (elevationOnly ? 58 : 42) * scale;
  const columnWidth = (width - insetX * 2) / stats.length;
  stats.forEach(([label, value], index) => {
    const statX = x + insetX + columnWidth * index;
    context.fillStyle = '#bfc9c1';
    context.font = `600 ${elevationOnly ? 14 * scale : 11 * scale}px Inter, sans-serif`;
    context.fillText(label, statX, statsTop);
    context.fillStyle = '#f5f2ea';
    context.font = `700 ${elevationOnly ? 22 * scale : 15 * scale}px Inter, sans-serif`;
    context.fillText(value, statX, statsTop + (elevationOnly ? 30 * scale : 21 * scale));
  });
  context.restore();
}

function drawMapCover(context: CanvasRenderingContext2D, mapCanvas: HTMLCanvasElement, outputCanvas: HTMLCanvasElement): void {
  const sourceRatio = mapCanvas.width / mapCanvas.height;
  const targetRatio = outputCanvas.width / outputCanvas.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = mapCanvas.width;
  let sourceHeight = mapCanvas.height;

  if (sourceRatio > targetRatio) {
    sourceWidth = mapCanvas.height * targetRatio;
    sourceX = (mapCanvas.width - sourceWidth) / 2;
  } else {
    sourceHeight = mapCanvas.width / targetRatio;
    sourceY = (mapCanvas.height - sourceHeight) / 2;
  }

  context.drawImage(
    mapCanvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputCanvas.width,
    outputCanvas.height
  );
}

function projectPointToVideo(
  point: TrackPoint,
  mapCanvas: HTMLCanvasElement,
  outputCanvas: HTMLCanvasElement
): { x: number; y: number } | undefined {
  if (!map) return undefined;
  const projected = map.project([point.lon, point.lat]);
  const cssWidth = mapCanvas.clientWidth || mapCanvas.width;
  const cssHeight = mapCanvas.clientHeight || mapCanvas.height;
  const sourcePointX = projected.x * (mapCanvas.width / cssWidth);
  const sourcePointY = projected.y * (mapCanvas.height / cssHeight);
  const sourceRatio = mapCanvas.width / mapCanvas.height;
  const targetRatio = outputCanvas.width / outputCanvas.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = mapCanvas.width;
  let sourceHeight = mapCanvas.height;

  if (sourceRatio > targetRatio) {
    sourceWidth = mapCanvas.height * targetRatio;
    sourceX = (mapCanvas.width - sourceWidth) / 2;
  } else {
    sourceHeight = mapCanvas.width / targetRatio;
    sourceY = (mapCanvas.height - sourceHeight) / 2;
  }

  return {
    x: ((sourcePointX - sourceX) / sourceWidth) * outputCanvas.width,
    y: ((sourcePointY - sourceY) / sourceHeight) * outputCanvas.height
  };
}

function drawVideoMarker(
  context: CanvasRenderingContext2D,
  point: { x: number; y: number },
  symbol: RoutePointSymbol,
  variant: 'start' | 'stop',
  scale: number
): void {
  const size = 7 * scale;
  context.save();
  context.translate(point.x, point.y);
  context.fillStyle = variant === 'start' ? '#56b497' : '#df835e';
  context.strokeStyle = '#101917';
  context.lineWidth = Math.max(2, 2.3 * scale);
  context.lineJoin = 'round';
  context.beginPath();
  if (symbol === 'pin') {
    context.arc(0, -size * 0.55, size, 0, Math.PI * 2);
    context.moveTo(-size * 0.58, 0);
    context.lineTo(0, size * 1.35);
    context.lineTo(size * 0.58, 0);
  } else if (symbol === 'square') {
    context.rect(-size, -size, size * 2, size * 2);
  } else if (symbol === 'diamond') {
    context.moveTo(0, -size * 1.35);
    context.lineTo(size * 1.35, 0);
    context.lineTo(0, size * 1.35);
    context.lineTo(-size * 1.35, 0);
    context.closePath();
  } else if (symbol === 'flag') {
    context.moveTo(-size * 0.75, size * 1.3);
    context.lineTo(-size * 0.75, -size * 1.3);
    context.lineTo(size, -size * 0.75);
    context.lineTo(-size * 0.75, 0);
    context.closePath();
  } else {
    context.arc(0, 0, size, 0, Math.PI * 2);
  }
  context.fill();
  context.stroke();
  context.restore();
}

function drawRouteToVideo(
  context: CanvasRenderingContext2D,
  trail: Trail,
  playback: PlaybackState,
  mapCanvas: HTMLCanvasElement,
  outputCanvas: HTMLCanvasElement
): void {
  const points = state.showFullRoute ? trail.points : playback.passedPoints;
  const projectedPoints = points
    .map((point) => projectPointToVideo(point, mapCanvas, outputCanvas))
    .filter((point): point is { x: number; y: number } => point !== undefined);
  const scale = outputCanvas.width / 1080;

  if (projectedPoints.length >= 2) {
    const trace = () => {
      context.beginPath();
      projectedPoints.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
    };
    trace();
    context.strokeStyle = 'rgba(7, 16, 13, 0.68)';
    context.lineWidth = (state.routeLineThickness + 5.2) * scale;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();
    trace();
    context.strokeStyle = getRouteLineColor();
    context.lineWidth = state.routeLineThickness * scale;
    context.stroke();
  }

  const start = projectPointToVideo(trail.points[0], mapCanvas, outputCanvas);
  const stop = projectPointToVideo(trail.points[trail.points.length - 1], mapCanvas, outputCanvas);
  const position = projectPointToVideo(playback.point, mapCanvas, outputCanvas);
  if (start) drawVideoMarker(context, start, state.startPointSymbol, 'start', scale);
  if (stop && (state.showFullRoute || playback.passedPoints.length === trail.points.length)) {
    drawVideoMarker(context, stop, state.stopPointSymbol, 'stop', scale);
  }
  if (position) {
    context.beginPath();
    context.arc(position.x, position.y, 7 * scale, 0, Math.PI * 2);
    context.fillStyle = '#f5f2e8';
    context.fill();
    context.strokeStyle = '#56b497';
    context.lineWidth = 4 * scale;
    context.stroke();
  }
}

async function waitForMapFrame(): Promise<void> {
  if (!map) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
      resolve();
    };
    const fallback = window.setTimeout(finish, 100);
    map?.once('render', finish);
    map?.triggerRepaint();
  });
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function waitForMapReady(): Promise<void> {
  if (!map || (map.loaded() && map.areTilesLoaded())) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
      resolve();
    };
    const fallback = window.setTimeout(finish, 8_000);
    map?.once('idle', finish);
    map?.triggerRepaint();
  });
}

function getVideoDurationSeconds(preset: VideoPreset, trail?: Trail): number {
  const activeTrail = trail ?? state.trails.find((candidate) => candidate.id === state.selectedId);
  const baseDurationMs = activeTrail ? getRoutePlaybackDurationMs(getVisibleTrail(activeTrail)) : minimumAnimationDurationMs;
  return Math.min(baseDurationMs / 1000 / state.playbackSpeed, preset.maxDurationSeconds);
}

function estimateVideoSizeMb(preset: VideoPreset, trail?: Trail): number {
  return (preset.bitrate * getVideoDurationSeconds(preset, trail)) / 8 / 1_000_000;
}

async function recordRouteVideo(trail: Trail): Promise<void> {
  if (!map) {
    return;
  }

  const mapCanvas = map.getCanvas();
  const preset = videoPresets[state.videoPreset];
  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeVideo } = await import('mediabunny');
  const videoCanvas = document.createElement('canvas');
  const staticMapCanvas = document.createElement('canvas');
  videoCanvas.width = preset.width;
  videoCanvas.height = preset.height;
  staticMapCanvas.width = mapCanvas.width;
  staticMapCanvas.height = mapCanvas.height;
  const videoContext = videoCanvas.getContext('2d');
  const staticMapContext = staticMapCanvas.getContext('2d');

  if (!videoContext || !staticMapContext) {
    window.alert('Video canvas could not be created.');
    return;
  }

  const elevationProfile = getElevationProfile(trail.points);
  const elevationOnly = state.videoPreset === 'master' && state.videoExportMode === 'elevation';
  const includeElevationOverlay = elevationOnly || state.videoOverlays.elevation;

  if (elevationOnly && !elevationProfile) {
    window.alert('Elevation-only master export requires elevation data in the track.');
    return;
  }

  const drawCompositeFrame = (playbackState: PlaybackState) => {
    videoContext.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
    videoContext.fillStyle = '#dfe7e2';
    videoContext.fillRect(0, 0, videoCanvas.width, videoCanvas.height);

    if (!elevationOnly) {
      drawMapCover(videoContext, staticMapCanvas, videoCanvas);
      drawRouteToVideo(videoContext, trail, playbackState, mapCanvas, videoCanvas);
    }

    if (includeElevationOverlay && elevationProfile) {
      drawElevationOverlayToVideo(
        videoContext,
        elevationProfile,
        videoCanvas,
        playbackState,
        trail.points,
        elevationOnly
      );
    }
  };

  try {
    await waitForMapReady();
    const routeLayerIds = [
      'route-shadow',
      'route-line',
      'route-progress-line',
      'route-start-symbol',
      'route-stop-symbol',
      'route-position-glow',
      'route-position-dot'
    ];
    routeLayerIds.forEach((layerId) => {
      if (map?.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none');
    });
    await waitForMapFrame();
    staticMapContext.drawImage(mapCanvas, 0, 0);
    applyRouteStyleSettings();
    drawCompositeFrame(getPlaybackState(trail.points, 0));
  } catch {
    window.alert('The selected map source cannot be combined into a browser video.');
    return;
  }

  const canEncodeAvc = await canEncodeVideo('avc', {
    width: preset.width,
    height: preset.height,
    bitrate: preset.bitrate
  });

  if (!canEncodeAvc) {
    window.alert(`This device cannot encode ${preset.width} × ${preset.height} H.264 video. Try a smaller preset.`);
    return;
  }

  const button = document.querySelector<HTMLButtonElement>('[data-record-video]');
  button?.setAttribute('disabled', 'true');
  button?.classList.add('recording');
  button && (button.textContent = 'Encoding 0%');
  stopRouteAnimation();

  try {
    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target
    });
    const source = new CanvasSource(videoCanvas, {
      codec: 'avc',
      bitrate: preset.bitrate,
      keyFrameInterval: 2
    });
    output.addVideoTrack(source, { frameRate: preset.fps });
    await output.start();

    const durationSeconds = getVideoDurationSeconds(preset, trail);
    const frameDuration = 1 / preset.fps;
    const frameCount = Math.max(2, Math.round(durationSeconds * preset.fps));

    for (let frame = 0; frame < frameCount; frame += 1) {
      const progress = frame / (frameCount - 1);
      const playbackState = getPlaybackState(trail.points, progress);
      drawCompositeFrame(playbackState);
      await source.add(frame * frameDuration, frameDuration, { keyFrame: frame % (preset.fps * 2) === 0 });

      if (button && frame % Math.max(1, Math.round(preset.fps / 2)) === 0) {
        button.textContent = `Encoding ${Math.round(progress * 100)}%`;
      }
    }

    await output.finalize();
    if (!target.buffer) {
      throw new Error('The MP4 encoder returned an empty file.');
    }

    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    const safeTitle = trail.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (INTERVALS_CONNECT_ENABLED && TELEGRAM_VIDEO_UPLOAD_URL_ENDPOINT && TELEGRAM_VIDEO_FINALIZE_ENDPOINT) {
      const { isInsideTelegram, sendVideoToTelegram } = await import('./integrations/telegram-video');
      if (isInsideTelegram()) {
        await sendVideoToTelegram(
          blob,
          { uploadUrlEndpoint: TELEGRAM_VIDEO_UPLOAD_URL_ENDPOINT, finalizeEndpoint: TELEGRAM_VIDEO_FINALIZE_ENDPOINT },
          (status) => button && (button.textContent = status)
        );
        window.alert('Video sent — check your Telegram chat.');
        return;
      }
    }

    downloadBlob(blob, `${safeTitle || 'jotos-route'}-${state.videoPreset}.mp4`);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'MP4 video creation failed.');
  } finally {
    button?.removeAttribute('disabled');
    button?.classList.remove('recording');
    button && (button.textContent = 'Export MP4');
  }
}

function createOfflineBasemap(trail: Trail): GeoJSON.FeatureCollection {
  const bounds = getBounds(trail.points);
  const latSpan = bounds.maxLat - bounds.minLat;
  const lonSpan = bounds.maxLon - bounds.minLon;
  const features: GeoJSON.Feature[] = [];

  for (let index = 1; index < 8; index += 1) {
    const lat = bounds.minLat + (latSpan * index) / 8;
    const wave = index % 2 === 0 ? 0.0018 : -0.0018;

    features.push({
      type: 'Feature',
      properties: { kind: 'contour', elevation: 40 + index * 20 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [bounds.minLon, lat],
          [bounds.minLon + lonSpan * 0.24, lat + wave],
          [bounds.minLon + lonSpan * 0.5, lat - wave],
          [bounds.minLon + lonSpan * 0.76, lat + wave],
          [bounds.maxLon, lat]
        ]
      }
    });
  }

  for (let index = 1; index < 5; index += 1) {
    const lon = bounds.minLon + (lonSpan * index) / 5;

    features.push({
      type: 'Feature',
      properties: { kind: 'trail' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [lon, bounds.minLat],
          [lon + lonSpan * 0.04, bounds.minLat + latSpan * 0.3],
          [lon - lonSpan * 0.03, bounds.minLat + latSpan * 0.62],
          [lon + lonSpan * 0.02, bounds.maxLat]
        ]
      }
    });
  }

  features.push({
    type: 'Feature',
    properties: { kind: 'water' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [bounds.minLon + lonSpan * 0.08, bounds.minLat + latSpan * 0.12],
          [bounds.minLon + lonSpan * 0.3, bounds.minLat + latSpan * 0.1],
          [bounds.minLon + lonSpan * 0.37, bounds.minLat + latSpan * 0.24],
          [bounds.minLon + lonSpan * 0.2, bounds.minLat + latSpan * 0.33],
          [bounds.minLon + lonSpan * 0.08, bounds.minLat + latSpan * 0.12]
        ]
      ]
    }
  });

  features.push({
    type: 'Feature',
    properties: { kind: 'forest' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [bounds.minLon, bounds.minLat],
          [bounds.maxLon, bounds.minLat],
          [bounds.maxLon, bounds.maxLat],
          [bounds.minLon, bounds.maxLat],
          [bounds.minLon, bounds.minLat]
        ]
      ]
    }
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

function createMapStyle(basemap: BasemapId, trail?: Trail): StyleSpecification {
  const routeCoverage = getRouteCoverage(trail);
  const useMmlFallback = routeCoverage.inFinland && mmlApiKey;
  const baseStyle: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': basemap === 'satellite' ? '#080908' : '#111712'
        }
      }
    ]
  };

  if (basemap === 'retki' && maastoPackEnabled && routeCoverage.inFinland) {
    baseStyle.sources = {
      retki: {
        type: 'raster',
        url: `pmtiles://${maastoPackUrl}`,
        tileSize: 256,
        attribution:
          'Map data: © National Land Survey of Finland, CC BY 4.0'
      }
    };
    baseStyle.layers.push({
      id: 'retki-raster',
      type: 'raster',
      source: 'retki',
      paint: {
        'raster-opacity': 1
      }
    });

    return baseStyle;
  }

  if (basemap === 'retki' && maastoWmtsTemplate && routeCoverage.inFinland) {
    baseStyle.sources = {
      retki: {
        type: 'raster',
        tiles: [maastoWmtsTemplate],
        tileSize: 256,
        attribution: 'Map data: © National Land Survey of Finland, CC BY 4.0'
      }
    };
    baseStyle.layers.push({
      id: 'retki-raster',
      type: 'raster',
      source: 'retki',
      paint: {
        'raster-opacity': 1
      }
    });

    return baseStyle;
  }

  if (basemap === 'retki' && useMmlFallback) {
    baseStyle.sources = {
      maasto: {
        type: 'raster',
        tiles: [mmlMaastoWmtsTemplate],
        tileSize: 256,
        attribution: 'Map data: © National Land Survey of Finland, CC BY 4.0'
      }
    };
    baseStyle.layers.push({
      id: 'maasto-raster',
      type: 'raster',
      source: 'maasto',
      paint: {
        'raster-opacity': 1
      }
    });

    return baseStyle;
  }

  if (basemap === 'topo') {
    baseStyle.sources = {
      topo: {
        type: 'raster',
        tiles: useMmlFallback ? [mmlTopoWmtsTemplate] : ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: useMmlFallback
          ? 'Map data: © National Land Survey of Finland, CC BY 4.0'
          : 'Map data: © OpenStreetMap contributors, SRTM | Style: © OpenTopoMap (CC-BY-SA)'
      }
    };
    baseStyle.layers.push({
      id: 'raster-basemap',
      type: 'raster',
      source: 'topo',
      paint: {
        'raster-opacity': 0.92,
        'raster-saturation': useMmlFallback ? 0 : -0.12,
        'raster-contrast': useMmlFallback ? 0 : 0.06
      }
    });
  }

  if (basemap === 'satellite') {
    baseStyle.sources = {
      satellite: {
        type: 'raster',
        tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
        tileSize: 256,
        attribution: 'Sentinel-2 cloudless imagery by EOX, contains modified Copernicus Sentinel data'
      }
    };
    baseStyle.layers.push({
      id: 'raster-basemap',
      type: 'raster',
      source: 'satellite',
      paint: {
        'raster-opacity': 0.92,
        'raster-saturation': -0.18,
        'raster-contrast': 0.08
      }
    });
  }

  return baseStyle;
}

function fitMapToTrail(mapInstance: maplibregl.Map, trail: Trail): void {
  const bounds = getBounds(trail.points);
  const mapBounds: LngLatBoundsLike = [
    [bounds.minLon, bounds.minLat],
    [bounds.maxLon, bounds.maxLat]
  ];

  mapInstance.fitBounds(mapBounds, {
    padding: { top: 72, right: 56, bottom: 56, left: 56 },
    maxZoom: 14,
    duration: 600
  });
}

function initializeMap(trail?: Trail, options: { fitTrail?: boolean } = {}): void {
  const container = document.querySelector<HTMLDivElement>('#route-map');

  if (!container) {
    return;
  }

  const shouldFitTrail = options.fitTrail === true;
  const previousView = map
    ? {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
      }
    : undefined;

  map?.remove();

  map = new maplibregl.Map({
    container,
    style: createMapStyle(state.basemap, trail),
    center:
      shouldFitTrail && trail
        ? getCenter(trail.points)
        : previousView?.center ?? (trail ? getCenter(trail.points) : defaultEmptyMapCenter),
    zoom: shouldFitTrail && trail ? 11 : previousView?.zoom ?? (trail ? 11 : 6),
    bearing: previousView?.bearing ?? 0,
    pitch: previousView?.pitch ?? 0,
    attributionControl: false,
    preserveDrawingBuffer: true,
    cooperativeGestures: true,
    dragRotate: false,
    pitchWithRotate: false
  });
  mapBasemap = state.basemap;
  mapTrailId = trail?.id;

  map.addControl(
    new maplibregl.NavigationControl({
      showCompass: false,
      visualizePitch: false
    }),
    'bottom-right'
  );

  map.addControl(
    new maplibregl.AttributionControl({
      compact: true,
      customAttribution: 'Route preview: local GeoJSON · MapLibre + PMTiles'
    }),
    'bottom-left'
  );

  map.on('load', () => {
    map?.addSource('route-progress', {
      type: 'geojson',
      data: emptyLineGeoJson()
    });

    map?.addSource('route-position', {
      type: 'geojson',
      data: animatedPositionGeoJson(trail.points[0])
    });

    if (trail) {
      map?.addSource('selected-trail', {
        type: 'geojson',
        data: trailToGeoJson(trail)
      });
    }

    if (trail) {
      updateRouteMarkerImages();

      map?.addLayer({
        id: 'route-shadow',
        type: 'line',
        source: 'selected-trail',
        filter: ['==', ['get', 'kind'], 'route'],
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': '#07100d',
          'line-opacity': 0.62,
          'line-width': state.routeLineThickness + 5.2
        }
      });

      map?.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'selected-trail',
        filter: ['==', ['get', 'kind'], 'route'],
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': getRouteLineColor(),
          'line-width': state.routeLineThickness
        }
      });

      map?.addLayer({
        id: 'route-progress-line',
        type: 'line',
        source: 'route-progress',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': getRouteLineColor(),
          'line-width': state.routeLineThickness + 1.1
        }
      });

      map?.addLayer({
        id: 'route-start-symbol',
        type: 'symbol',
        source: 'selected-trail',
        filter: ['==', ['get', 'kind'], 'start'],
        layout: {
          'icon-image': 'route-start-marker',
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });

      map?.addLayer({
        id: 'route-stop-symbol',
        type: 'symbol',
        source: 'selected-trail',
        filter: ['==', ['get', 'kind'], 'finish'],
        layout: {
          'icon-image': 'route-stop-marker',
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });

      map?.addLayer({
        id: 'route-position-glow',
        type: 'circle',
        source: 'route-position',
        paint: {
          'circle-color': '#56b497',
          'circle-opacity': 0.24,
          'circle-radius': 18
        }
      });

      map?.addLayer({
        id: 'route-position-dot',
        type: 'circle',
        source: 'route-position',
        paint: {
          'circle-color': '#f5f2e8',
          'circle-radius': 6.5,
          'circle-stroke-color': '#56b497',
          'circle-stroke-width': 4
        }
      });

      if (shouldFitTrail) {
        fitMapToTrail(map, trail);
      }
      updatePlaybackSources(trail, 0);
      applyRouteStyleSettings();
    }

  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderIntervalsPanel(): string {
  if (!INTERVALS_CONNECT_ENABLED) return '';

  const activityList = state.intervalsActivities.length
    ? `
      <ul class="intervals-activity-list">
        ${state.intervalsActivities
          .map(
            (activity) => `
              <li>
                <span>${escapeHtml(activity.name)}${activity.source ? ` · ${escapeHtml(activity.source)}` : ''}</span>
                <button type="button" class="text-button" data-intervals-import="${escapeHtml(activity.id)}">Import</button>
              </li>
            `
          )
          .join('')}
      </ul>
    `
    : '';

  return `
    <div class="upload-zone intervals-panel">
      <span>Import from Intervals.icu</span>
      <strong>Your API key goes straight to Intervals.icu — never stored or sent anywhere else</strong>
      <button type="button" class="text-button accent" data-intervals-toggle>${state.intervalsPanelOpen ? 'Close' : 'Connect'}</button>
      ${
        state.intervalsPanelOpen
          ? `
        <div class="intervals-form">
          <input id="intervals-api-key" type="password" placeholder="Intervals.icu API key" autocomplete="off" value="${escapeHtml(state.intervalsApiKey)}" />
          <input id="intervals-athlete-id" type="text" placeholder="Athlete ID (optional)" autocomplete="off" value="${escapeHtml(state.intervalsAthleteId)}" />
          <button type="button" class="text-button" data-intervals-load ${state.intervalsBusy ? 'disabled' : ''}>
            ${state.intervalsBusy ? 'Loading…' : 'Load recent activities'}
          </button>
        </div>
        ${state.intervalsStatus ? `<p class="intervals-status">${escapeHtml(state.intervalsStatus)}</p>` : ''}
        ${activityList}
      `
          : ''
      }
    </div>
  `;
}

function renderTrailCard(trail: Trail): string {
  const isSelected = trail.id === state.selectedId;

  return `
    <button class="trail-card ${isSelected ? 'selected' : ''}" data-trail-id="${trail.id}">
      <span>
        <strong>${trail.title}</strong>
        <small>${trail.region}</small>
        ${trail.sourceAttribution ? `<small class="trail-attribution">${trail.sourceAttribution}</small>` : ''}
      </span>
      <span class="trail-meta">${trail.distanceKm} km · ${trail.ascentM} m</span>
    </button>
  `;
}

function render(options: { fitTrail?: boolean } = {}): void {
  const retainedMapContainer = map?.getContainer();
  const sourceTrail = state.trails.find((trail) => trail.id === state.selectedId);
  const totalDistanceMeters = sourceTrail
    ? Math.max(
        1,
        Math.round(
          sourceTrail.points.slice(1).reduce(
            (total, point, index) => total + distanceBetween(sourceTrail.points[index], point) * 1000,
            0
          )
        )
      )
    : 0;

  if (sourceTrail) {
    state.trimStartMeters = Math.min(state.trimStartMeters, Math.max(totalDistanceMeters - state.trimEndMeters - 1, 0));
    state.trimEndMeters = Math.min(state.trimEndMeters, Math.max(totalDistanceMeters - state.trimStartMeters - 1, 0));
  } else {
    state.trimStartMeters = 0;
    state.trimEndMeters = 0;
  }

  const selectedTrail = sourceTrail ? getVisibleTrail(sourceTrail) : undefined;
  const selectedTrailDistanceKm = selectedTrail?.distanceKm ?? 0;
  const selectedTrailActivity = selectedTrail?.activity ?? 'No route loaded';
  const selectedTrailRegion = selectedTrail?.region ?? 'Import a GPX file';
  const timelineTimes = selectedTrail ? getTimelineTimes(selectedTrail.points) : undefined;
  const timelineAvailable = timelineTimes !== undefined;
  const effectivePlaybackMode = state.playbackMode === 'timeline' && timelineAvailable ? 'timeline' : 'distance';
  const elevationProfile = selectedTrail ? getElevationProfile(selectedTrail.points) : undefined;

  if (state.playbackMode !== effectivePlaybackMode) {
    state.playbackMode = effectivePlaybackMode;
  }

  app.innerHTML = `
    <main class="app-shell ${state.menuOpen ? 'menu-open' : ''}">
      <section class="map-workspace">
        <div class="map-stage">
          <div class="map-shell">
            <div id="route-map" class="map-canvas" aria-label="${selectedTrail ? `${selectedTrail.title} interactive map` : 'Interactive map'}"></div>
            ${
              state.overlays.elevation && elevationProfile
                ? `<section
                    class="map-elevation-overlay"
                    data-elevation-overlay
                    style="left: ${state.elevationPosition.x * 100}%; top: ${state.elevationPosition.y * 100}%; --elevation-bg-alpha: ${state.elevationBackgroundOpacity}; --route-color: ${getRouteLineColor()}"
                    aria-label="Movable elevation profile"
                  >
                    <header data-elevation-drag-handle title="Drag to move elevation profile">
                      <span>Elevation</span>
                      <small>Drag to move</small>
                    </header>
                    <div class="elevation-chart-shell">
                      <svg
                        class="elevation-chart"
                        viewBox="0 0 320 96"
                        preserveAspectRatio="none"
                        role="img"
                        aria-label="Elevation profile from ${elevationProfile.minM} to ${elevationProfile.maxM} metres"
                      >
                        <path class="elevation-area" d="${elevationProfile.areaPath}"></path>
                        <path class="elevation-line" d="${elevationProfile.linePath}"></path>
                        <line class="elevation-progress-line" data-elevation-progress-line x1="0" y1="8" x2="0" y2="88"></line>
                        <circle class="elevation-progress-dot" data-elevation-progress-dot r="4.8"></circle>
                      </svg>
                    </div>
                    <div class="elevation-stats">
                      <span><small>Lowest</small><strong>${elevationProfile.minM} m</strong></span>
                      <span><small>Highest</small><strong>${elevationProfile.maxM} m</strong></span>
                      <span><small>Ascent</small><strong>+${elevationProfile.ascentM} m</strong></span>
                      <span><small>Descent</small><strong>-${elevationProfile.descentM} m</strong></span>
                    </div>
                  </section>`
                : ''
            }
            ${
              state.overlays.mapInfo
                ? `<div class="map-status">
              <strong>Jotos</strong>
              <span>Map animator by ssivonen</span>
            </div>`
                : ''
            }
            ${
              state.overlays.videoBadge
                ? `<div class="video-badge">
              <strong>${selectedTrailDistanceKm} km</strong>
              <span>${selectedTrailActivity} · ${selectedTrailRegion}</span>
            </div>`
                : ''
            }
          </div>
        </div>

        <button class="menu-button menu-toggle-fab" data-menu-toggle aria-label="${state.menuOpen ? 'Close menu' : 'Open menu'}" aria-expanded="${state.menuOpen}">
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div class="basemap-switcher" aria-label="Basemap selector">
          ${(Object.keys(basemaps) as BasemapId[])
            .map(
              (basemapId) => `
                <button class="basemap-option ${state.basemap === basemapId ? 'active' : ''}" data-basemap="${basemapId}">
                  <strong>${basemaps[basemapId].label}</strong>
                  <span>${basemaps[basemapId].description}</span>
                </button>
              `
            )
            .join('')}
          <small class="basemap-caption">Jotos, v1.0 ssivonen</small>
        </div>

        <aside class="drawer" aria-label="Trail menu" aria-hidden="${!state.menuOpen}">
          <div class="drawer-header">
            <div>
              <p class="eyebrow">Library</p>
              <h2>Routes and imports</h2>
            </div>
            <button class="icon-button" data-menu-close aria-label="Close menu">×</button>
          </div>

          <label class="upload-zone" for="gpx-upload">
            <span>Import GPX, route or waypoint data</span>
            <strong>Only the loaded file will appear here</strong>
            <button type="button" class="text-button accent" data-gpx-pick>Choose file</button>
            <input id="gpx-upload" type="file" accept=".gpx,.xml,.txt,.fit,.tcx,application/gpx+xml,application/xml,text/xml,*/*" />
          </label>

          ${renderIntervalsPanel()}

          <div class="tool-row">
            <button class="text-button" data-play-route ${selectedTrail ? '' : 'disabled'}>Play route</button>
            <button class="text-button" data-play-route-reverse ${selectedTrail ? '' : 'disabled'}>Play reverse</button>
            <button class="text-button" data-stop-route ${selectedTrail ? '' : 'disabled'}>Stop</button>
          </div>

          <section class="layer-panel privacy-panel" aria-label="Route privacy trim">
            <div class="panel-title">
              <span>Hide start and finish</span>
              <small>Removed locally from the map, profile, playback and export</small>
            </div>
            <div class="distance-inputs">
              <label>
                <span>From start</span>
                <span class="number-field"><input type="number" min="0" max="${Math.max(totalDistanceMeters - state.trimEndMeters - 1, 0)}" step="10" value="${state.trimStartMeters}" data-trim="start" /><small>m</small></span>
              </label>
              <label>
                <span>From finish</span>
                <span class="number-field"><input type="number" min="0" max="${Math.max(totalDistanceMeters - state.trimStartMeters - 1, 0)}" step="10" value="${state.trimEndMeters}" data-trim="end" /><small>m</small></span>
              </label>
            </div>
            <small class="privacy-summary">${
              selectedTrail
                ? `Visible ${selectedTrailDistanceKm} km of ${(totalDistanceMeters / 1000).toFixed(1)} km`
                : 'Import a GPX file to enable trimming'
            }</small>
          </section>

          <label class="playback-speed" for="playback-speed">
            <span>
              <strong>Playback speed</strong>
              <output data-playback-speed-output>${state.playbackSpeed.toFixed(2).replace(/\.00$/, '')}×</output>
            </span>
            <input
              id="playback-speed"
              type="range"
              min="0.1"
              max="4"
              step="0.1"
              value="${state.playbackSpeed}"
              ${selectedTrail ? '' : 'disabled'}
            />
            <span class="speed-scale"><small>0.1× slower</small><small>4× faster</small></span>
          </label>

          <fieldset class="playback-mode">
            <legend>Playback timing</legend>
            <div class="segmented-control">
              <label class="${effectivePlaybackMode === 'distance' ? 'active' : ''}">
                <input
                  type="radio"
                  name="playback-mode"
                  value="distance"
                  data-playback-mode
                  ${effectivePlaybackMode === 'distance' ? 'checked' : ''}
                  ${selectedTrail ? '' : 'disabled'}
                />
                Even pace
              </label>
              <label class="${effectivePlaybackMode === 'timeline' ? 'active' : ''} ${!timelineAvailable ? 'disabled' : ''}">
                <input
                  type="radio"
                  name="playback-mode"
                  value="timeline"
                  data-playback-mode
                  ${effectivePlaybackMode === 'timeline' ? 'checked' : ''}
                  ${!timelineAvailable || !selectedTrail ? 'disabled' : ''}
                />
                GPX timeline
              </label>
            </div>
            <small data-playback-mode-note>${
              !selectedTrail
                ? 'Import a GPX file to enable playback'
                : timelineTimes
                ? `Recorded duration ${formatElapsedTime(timelineTimes[timelineTimes.length - 1] - timelineTimes[0])}`
                : 'This route does not contain a complete GPX timeline'
            }</small>
          </fieldset>

          <section class="layer-panel" aria-label="Route appearance">
            <div class="panel-title">
              <span>Route appearance</span>
              <small>Controls the visible route, its line, and start / stop symbols</small>
            </div>
            <label class="toggle-row">
              <input type="checkbox" data-route-setting="showFullRoute" ${state.showFullRoute ? 'checked' : ''} />
              Show full route
            </label>
            <label class="select-field" for="route-line-color">
              <span>Route line colour</span>
              <select id="route-line-color" data-route-setting="routeColorPreset">
                ${(Object.keys(routeColorPresets) as RouteColorPresetId[])
                  .map(
                      (presetId) =>
                        `<option value="${presetId}" ${state.routeColorPreset === presetId ? 'selected' : ''}>${routeColorPresets[presetId].label}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label class="opacity-control" for="route-line-thickness">
              <span><strong>Route line thickness</strong><output data-route-line-thickness-output>${state.routeLineThickness.toFixed(1)} px</output></span>
              <input id="route-line-thickness" type="range" min="2" max="10" step="0.2" value="${state.routeLineThickness}" data-route-setting="routeLineThickness" />
              <span class="speed-scale"><small>Thin</small><small>Thick</small></span>
            </label>
            <label class="select-field" for="start-point-symbol">
              <span>Start point symbol</span>
              <select id="start-point-symbol" data-route-setting="startPointSymbol">
                ${(['dot', 'pin', 'square', 'diamond', 'flag'] as RoutePointSymbol[])
                  .map(
                    (symbol) =>
                      `<option value="${symbol}" ${state.startPointSymbol === symbol ? 'selected' : ''}>${symbol[0].toUpperCase()}${symbol.slice(1)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label class="select-field" for="stop-point-symbol">
              <span>Stop point symbol</span>
              <select id="stop-point-symbol" data-route-setting="stopPointSymbol">
                ${(['dot', 'pin', 'square', 'diamond', 'flag'] as RoutePointSymbol[])
                  .map(
                    (symbol) =>
                      `<option value="${symbol}" ${state.stopPointSymbol === symbol ? 'selected' : ''}>${symbol[0].toUpperCase()}${symbol.slice(1)}</option>`
                  )
                  .join('')}
              </select>
            </label>
          </section>

          <section class="layer-panel" aria-label="Interface overlays">
            <div class="panel-title">
              <span>Interface overlays</span>
              <small>Clean map by default</small>
            </div>
            <label><input type="checkbox" data-overlay="details" ${state.overlays.details ? 'checked' : ''} /> Route stats</label>
            <label><input type="checkbox" data-overlay="mapInfo" ${state.overlays.mapInfo ? 'checked' : ''} /> Map stack label</label>
            <label><input type="checkbox" data-overlay="videoBadge" ${state.overlays.videoBadge ? 'checked' : ''} /> Video badge</label>
            <label><input type="checkbox" data-overlay="elevation" ${state.overlays.elevation ? 'checked' : ''} ${!elevationProfile ? 'disabled' : ''} /> Elevation profile</label>
            <label class="opacity-control" for="elevation-opacity">
              <span><strong>Elevation background</strong><output data-elevation-opacity-output>${Math.round(state.elevationBackgroundOpacity * 100)}%</output></span>
              <input id="elevation-opacity" type="range" min="0" max="0.9" step="0.05" value="${state.elevationBackgroundOpacity}" ${!elevationProfile ? 'disabled' : ''} />
              <span class="speed-scale"><small>Curve only</small><small>Solid</small></span>
            </label>
          </section>

          <section class="layer-panel export-panel" aria-label="Video export">
            <div class="panel-title">
              <span>Video export</span>
              <small>H.264 MP4 · ready for native sharing</small>
            </div>
            <label><input type="checkbox" data-video-overlay="elevation" ${state.videoOverlays.elevation ? 'checked' : ''} ${!elevationProfile ? 'disabled' : ''} /> Include elevation profile</label>
            <label class="select-field" for="video-preset">
              <span>Destination</span>
              <select id="video-preset" data-video-preset>
                ${(Object.keys(videoPresets) as VideoPresetId[])
                  .map(
                    (presetId) =>
                      `<option value="${presetId}" ${state.videoPreset === presetId ? 'selected' : ''}>${videoPresets[presetId].label}</option>`
                  )
                  .join('')}
              </select>
            </label>
            ${
              state.videoPreset === 'master'
                ? `<label class="select-field" for="master-video-content">
                    <span>Master video content</span>
                    <select id="master-video-content" data-video-export-mode>
                      <option value="map" ${state.videoExportMode === 'map' ? 'selected' : ''}>Map video</option>
                      <option value="elevation" ${state.videoExportMode === 'elevation' ? 'selected' : ''}>Elevation profile only</option>
                    </select>
                  </label>`
                : ''
            }
            <div class="export-spec" data-export-spec>
              <span>${videoPresets[state.videoPreset].detail}</span>
              <strong>${videoPresets[state.videoPreset].width} × ${videoPresets[state.videoPreset].height} · ${videoPresets[state.videoPreset].fps} fps</strong>
              <small>Max ${formatElapsedTime(videoPresets[state.videoPreset].maxDurationSeconds * 1000)} · about ${estimateVideoSizeMb(videoPresets[state.videoPreset], selectedTrail).toFixed(1)} MB for this route</small>
            </div>
            <div class="tool-row export-actions">
              <button class="text-button accent" data-record-video ${selectedTrail ? '' : 'disabled'}>Generate video</button>
            </div>
          </section>

          ${
            state.trails.length
              ? `<div class="trail-list">
            ${state.trails.map(renderTrailCard).join('')}
          </div>`
              : `<div class="empty-library">
            <strong>No file loaded yet</strong>
            <span>Import a GPX file and its metadata will appear here.</span>
          </div>`
          }
        </aside>

        <div class="drawer-backdrop" data-menu-close></div>

        ${
          state.overlays.details && selectedTrail
            ? `<footer class="floating-detail-bar">
            <div>
              <small>Activity</small>
              <strong>${selectedTrail.activity}</strong>
            </div>
            <div>
              <small>Distance</small>
              <strong>${selectedTrail.distanceKm} km</strong>
            </div>
            <div>
              <small>Ascent</small>
              <strong>${selectedTrail.ascentM} m</strong>
            </div>
            <div>
              <small>Visibility</small>
              <strong>${selectedTrail.privacy}</strong>
            </div>
            <div>
              <small>License</small>
              <strong>${selectedTrail.license}</strong>
            </div>
        </footer>`
            : ''
        }
      </section>
    </main>
  `;

  const newMapContainer = document.querySelector<HTMLDivElement>('#route-map');
  if (retainedMapContainer && newMapContainer && mapBasemap === state.basemap && mapTrailId === selectedTrail?.id) {
    retainedMapContainer.className = newMapContainer.className;
    retainedMapContainer.setAttribute('aria-label', newMapContainer.getAttribute('aria-label') ?? 'Interactive map');
    newMapContainer.replaceWith(retainedMapContainer);
    map?.resize();
  }

  bindEvents();
  if (selectedTrail && elevationProfile) {
    updateElevationOverlayProgress(selectedTrail, getPlaybackState(selectedTrail.points, 0), elevationProfile);
  }
  const shouldRebuildMap = !map || mapBasemap !== state.basemap || mapTrailId !== selectedTrail?.id;
  if (shouldRebuildMap) {
    window.requestAnimationFrame(() => initializeMap(selectedTrail, { fitTrail: options.fitTrail === true }));
    return;
  }

  if (selectedTrail) {
    syncMapTrailSources(selectedTrail, elevationProfile);
    if (options.fitTrail) {
      fitMapToTrail(map!, selectedTrail);
    }
  }

  applyRouteStyleSettings();
}

function bindElevationOverlayDrag(): void {
  elevationDragController?.abort();
  elevationDragController = new AbortController();
  const { signal } = elevationDragController;
  const overlay = document.querySelector<HTMLElement>('[data-elevation-overlay]');
  const handle = document.querySelector<HTMLElement>('[data-elevation-drag-handle]');
  const container = document.querySelector<HTMLElement>('.map-shell');

  if (!overlay || !handle || !container) {
    return;
  }

  let activePointer: number | undefined;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener('pointerdown', (event) => {
    const overlayRect = overlay.getBoundingClientRect();
    activePointer = event.pointerId;
    offsetX = event.clientX - overlayRect.left;
    offsetY = event.clientY - overlayRect.top;
    overlay.classList.add('dragging');
    event.preventDefault();
    event.stopPropagation();
  }, { signal });

  window.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointer) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const maxLeft = Math.max(containerRect.width - overlayRect.width, 0);
    const maxTop = Math.max(containerRect.height - overlayRect.height, 0);
    const left = Math.min(Math.max(event.clientX - containerRect.left - offsetX, 0), maxLeft);
    const top = Math.min(Math.max(event.clientY - containerRect.top - offsetY, 0), maxTop);

    state.elevationPosition.x = containerRect.width > 0 ? left / containerRect.width : 0;
    state.elevationPosition.y = containerRect.height > 0 ? top / containerRect.height : 0;
    overlay.style.left = `${state.elevationPosition.x * 100}%`;
    overlay.style.top = `${state.elevationPosition.y * 100}%`;
  }, { signal });

  const finishDrag = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) {
      return;
    }

    activePointer = undefined;
    overlay.classList.remove('dragging');
  };

  window.addEventListener('pointerup', finishDrag, { signal });
  window.addEventListener('pointercancel', finishDrag, { signal });
}

/**
 * Shared by local GPX upload and any connected-import source (e.g. Intervals.icu):
 * builds a Trail from points, adds it to the library, and renders it selected.
 */
export function addImportedTrail(
  points: TrackPoint[],
  meta: { id: string; title: string; region: string; activity: string; tags: string[]; sourceAttribution?: string }
): void {
  if (points.length < 2) {
    throw new Error('The route needs at least two GPS points.');
  }

  const summary = summarize(points);
  const importedTrail: Trail = {
    ...meta,
    privacy: 'Private',
    license: 'Not set',
    points,
    ...summary
  };

  state.trails = [importedTrail, ...state.trails];
  state.selectedId = importedTrail.id;
  state.trimStartMeters = 0;
  state.trimEndMeters = 0;
  state.menuOpen = false;
  state.routePlaybackVisible = false;
  render({ fitTrail: true });
}

function bindEvents(): void {
  bindElevationOverlayDrag();
  document.querySelectorAll<HTMLButtonElement>('[data-trail-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedId = button.dataset.trailId ?? state.selectedId;
      state.trimStartMeters = 0;
      state.trimEndMeters = 0;
      state.menuOpen = false;
      state.routePlaybackVisible = false;
      render({ fitTrail: true });
    });
  });

  document.querySelector<HTMLInputElement>('#gpx-upload')?.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];

    if (!file) {
      return;
    }

    try {
      const points = parseGpx(await file.text());
      addImportedTrail(points, {
        id: `imported-${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        region: 'Imported locally',
        activity: 'Imported GPX',
        tags: ['imported']
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'The file could not be imported.');
    }
  });

  document.querySelector<HTMLButtonElement>('[data-gpx-pick]')?.addEventListener('click', () => {
    document.querySelector<HTMLInputElement>('#gpx-upload')?.click();
  });

  if (INTERVALS_CONNECT_ENABLED) {
    document.querySelector<HTMLButtonElement>('[data-intervals-toggle]')?.addEventListener('click', () => {
      state.intervalsPanelOpen = !state.intervalsPanelOpen;
      render();
    });

    document.querySelector<HTMLButtonElement>('[data-intervals-load]')?.addEventListener('click', async () => {
      const apiKey = document.querySelector<HTMLInputElement>('#intervals-api-key')?.value.trim() ?? '';
      const athleteId = document.querySelector<HTMLInputElement>('#intervals-athlete-id')?.value.trim() ?? '';
      state.intervalsApiKey = apiKey;
      state.intervalsAthleteId = athleteId;

      if (!apiKey) {
        state.intervalsStatus = 'Enter your Intervals.icu API key first.';
        render();
        return;
      }

      state.intervalsBusy = true;
      state.intervalsStatus = '';
      render();

      try {
        const { listRecentActivities } = await import('./integrations/intervals-client');
        state.intervalsActivities = await listRecentActivities(apiKey, athleteId || undefined);
        state.intervalsStatus = state.intervalsActivities.length
          ? ''
          : 'No activities found in the last 28 days.';
      } catch (error) {
        state.intervalsActivities = [];
        state.intervalsStatus = error instanceof Error ? error.message : 'Could not load activities.';
      } finally {
        state.intervalsBusy = false;
        render();
      }
    });

    document.querySelectorAll<HTMLButtonElement>('[data-intervals-import]').forEach((button) => {
      button.addEventListener('click', async () => {
        const activityId = button.dataset.intervalsImport;
        const apiKey = state.intervalsApiKey;
        const activity = state.intervalsActivities.find((candidate) => candidate.id === activityId);

        if (!activityId || !apiKey || !activity) {
          return;
        }

        state.intervalsBusy = true;
        state.intervalsStatus = '';
        render();

        try {
          const { importActivityRoute } = await import('./integrations/intervals-client');
          const points = await importActivityRoute(apiKey, activityId);
          state.intervalsPanelOpen = false;
          addImportedTrail(points, {
            id: `intervals-${activityId}`,
            title: activity.name,
            region: 'Intervals.icu',
            activity: activity.type ?? 'Imported activity',
            tags: ['intervals.icu'],
            sourceAttribution: attributionForSource(activity.source)
          });
        } catch (error) {
          state.intervalsBusy = false;
          state.intervalsStatus = error instanceof Error ? error.message : 'Could not import this activity.';
          render();
        }
      });
    });
  }

  document.querySelector<HTMLButtonElement>('[data-play-route]')?.addEventListener('click', () => {
    const selectedTrail = state.trails.find((trail) => trail.id === state.selectedId);

    if (selectedTrail) {
      state.routePlaybackVisible = true;
      applyRouteStyleSettings();
      animateRoute(getVisibleTrail(selectedTrail), {
        onDone: applyRouteStyleSettings,
        direction: 'forward',
        startProgress: 0
      });
    }
  });

  document.querySelector<HTMLButtonElement>('[data-play-route-reverse]')?.addEventListener('click', () => {
    const selectedTrail = state.trails.find((trail) => trail.id === state.selectedId);

    if (selectedTrail) {
      state.routePlaybackVisible = true;
      applyRouteStyleSettings();
      animateRoute(getVisibleTrail(selectedTrail), {
        onDone: applyRouteStyleSettings,
        direction: 'reverse',
        startProgress: 1
      });
    }
  });

  document.querySelector<HTMLButtonElement>('[data-stop-route]')?.addEventListener('click', () => {
    stopRouteAnimation();
    applyRouteStyleSettings();
  });

  document.querySelector<HTMLButtonElement>('[data-record-video]')?.addEventListener('click', () => {
    const selectedTrail = state.trails.find((trail) => trail.id === state.selectedId);

    if (selectedTrail) {
      void recordRouteVideo(getVisibleTrail(selectedTrail));
    }
  });

  document.querySelectorAll<HTMLInputElement>('[data-trim]').forEach((input) => {
    const updateTrim = () => {
      const value = Math.max(0, Math.round(Number(input.value) || 0));
      if (input.dataset.trim === 'start') {
        state.trimStartMeters = value;
      } else {
        state.trimEndMeters = value;
      }
      window.clearTimeout(trimRenderTimeout);
      trimRenderTimeout = window.setTimeout(render, 180);
    };
    input.addEventListener('input', updateTrim);
    input.addEventListener('change', updateTrim);
  });

  document.querySelector<HTMLInputElement>('#playback-speed')?.addEventListener('input', (event) => {
    const input = event.currentTarget as HTMLInputElement;
    state.playbackSpeed = Number(input.value);
    const output = document.querySelector<HTMLOutputElement>('[data-playback-speed-output]');

    if (output) {
      output.value = `${state.playbackSpeed.toFixed(2).replace(/\.00$/, '')}×`;
    }
  });

  document.querySelectorAll<HTMLInputElement>('[data-playback-mode]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked || input.disabled) {
        return;
      }

      state.playbackMode = input.value as PlaybackMode;
      document.querySelectorAll<HTMLElement>('.segmented-control label').forEach((label) => {
        const option = label.querySelector<HTMLInputElement>('[data-playback-mode]');
        label.classList.toggle('active', option?.checked === true);
      });
    });
  });

  document.querySelectorAll<HTMLElement>('[data-menu-toggle]').forEach((element) => {
    element.addEventListener('click', () => {
      state.menuOpen = !state.menuOpen;
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-menu-close]').forEach((element) => {
    element.addEventListener('click', () => {
      state.menuOpen = false;
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>('[data-overlay]').forEach((input) => {
    input.addEventListener('change', () => {
      const overlay = input.dataset.overlay as keyof typeof state.overlays;
      state.overlays[overlay] = input.checked;
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>('[data-video-overlay]').forEach((input) => {
    input.addEventListener('change', () => {
      const overlay = input.dataset.videoOverlay as keyof typeof state.videoOverlays;
      state.videoOverlays[overlay] = input.checked;
    });
  });

  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-route-setting]').forEach((input) => {
    input.addEventListener('change', () => {
      const setting = input.dataset.routeSetting as
        | 'showFullRoute'
        | 'routeColorPreset'
        | 'routeLineThickness'
        | 'startPointSymbol'
        | 'stopPointSymbol';

      if (setting === 'showFullRoute') {
        state.showFullRoute = (input as HTMLInputElement).checked;
        applyRouteStyleSettings();
        return;
      }

      if (setting === 'routeColorPreset') {
        state.routeColorPreset = (input as HTMLSelectElement).value as RouteColorPresetId;
        document
          .querySelector<HTMLElement>('[data-elevation-overlay]')
          ?.style.setProperty('--route-color', getRouteLineColor());
      } else if (setting === 'routeLineThickness') {
        state.routeLineThickness = Number((input as HTMLInputElement).value);
        const output = document.querySelector<HTMLOutputElement>('[data-route-line-thickness-output]');
        if (output) {
          output.value = `${state.routeLineThickness.toFixed(1)} px`;
        }
      } else if (setting === 'startPointSymbol') {
        state.startPointSymbol = (input as HTMLSelectElement).value as RoutePointSymbol;
      } else if (setting === 'stopPointSymbol') {
        state.stopPointSymbol = (input as HTMLSelectElement).value as RoutePointSymbol;
      }

      applyRouteStyleSettings();
    });
  });

  document.querySelector<HTMLInputElement>('#elevation-opacity')?.addEventListener('input', (event) => {
    const input = event.currentTarget as HTMLInputElement;
    state.elevationBackgroundOpacity = Number(input.value);
    document
      .querySelector<HTMLElement>('[data-elevation-overlay]')
      ?.style.setProperty('--elevation-bg-alpha', String(state.elevationBackgroundOpacity));
    const output = document.querySelector<HTMLOutputElement>('[data-elevation-opacity-output]');
    if (output) {
      output.value = `${Math.round(state.elevationBackgroundOpacity * 100)}%`;
    }
  });

  document.querySelector<HTMLSelectElement>('[data-video-preset]')?.addEventListener('change', (event) => {
    state.videoPreset = (event.currentTarget as HTMLSelectElement).value as VideoPresetId;
    if (state.videoPreset !== 'master') {
      state.videoExportMode = 'map';
    }
    render();
  });

  document.querySelector<HTMLSelectElement>('[data-video-export-mode]')?.addEventListener('change', (event) => {
    state.videoExportMode = (event.currentTarget as HTMLSelectElement).value as VideoExportMode;
  });

  document.querySelectorAll<HTMLButtonElement>('[data-basemap]').forEach((button) => {
    button.addEventListener('click', () => {
      state.basemap = button.dataset.basemap as BasemapId;
      render();
    });
  });
}

function handleMapZoomShortcut(event: KeyboardEvent): void {
  if ((!event.metaKey && !event.ctrlKey) || event.altKey) {
    return;
  }

  const zoomDirection =
    event.key === '+' || event.key === '='
      ? 1
      : event.key === '-' || event.key === '_'
        ? -1
        : 0;

  if (!zoomDirection || !map) {
    return;
  }

  event.preventDefault();

  if (zoomDirection > 0) {
    map.zoomIn({ duration: 220 });
  } else {
    map.zoomOut({ duration: 220 });
  }
}

window.addEventListener('keydown', handleMapZoomShortcut);
desktopViewport.addEventListener('change', (event) => {
  state.menuOpen = event.matches;
  render();
});

render();
