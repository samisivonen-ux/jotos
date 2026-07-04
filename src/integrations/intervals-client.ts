import type { TrackPoint } from '../main';

const BASE_URL = 'https://intervals.icu/api/v1';

export interface IntervalsActivitySummary {
  id: string;
  name: string;
  startDateLocal?: string;
  type?: string;
  source?: string;
  deviceName?: string;
}

function authHeader(apiKey: string): string {
  // Intervals.icu uses HTTP Basic auth with the literal username "API_KEY".
  return 'Basic ' + btoa(`API_KEY:${apiKey}`);
}

async function intervalsFetch(url: string, apiKey: string): Promise<Response> {
  const response = await fetch(url, { headers: { Authorization: authHeader(apiKey) } });
  if (response.status === 401 || response.status === 403) {
    throw new Error('Intervals.icu rejected this API key. Check it and try again.');
  }
  if (!response.ok) {
    throw new Error(`Intervals.icu request failed (${response.status}).`);
  }
  return response;
}

/**
 * Lists the athlete's last 28 days of activities. `athleteId` defaults to
 * "0", which Intervals.icu resolves to the API key's own athlete.
 */
export async function listRecentActivities(
  apiKey: string,
  athleteId = '0',
  limit = 20
): Promise<IntervalsActivitySummary[]> {
  const oldest = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const newest = new Date().toISOString().slice(0, 10);
  const url = `${BASE_URL}/athlete/${encodeURIComponent(athleteId)}/activities?oldest=${oldest}&newest=${newest}`;
  const response = await intervalsFetch(url, apiKey);
  const activities = (await response.json()) as Array<Record<string, unknown>>;

  return activities
    .filter((activity) => typeof activity.id !== 'undefined')
    .slice(0, limit)
    .map((activity) => ({
      id: String(activity.id),
      name: typeof activity.name === 'string' && activity.name ? activity.name : 'Untitled activity',
      startDateLocal: typeof activity.start_date_local === 'string' ? activity.start_date_local : undefined,
      type: typeof activity.type === 'string' ? activity.type : undefined,
      source: typeof activity.source === 'string' ? activity.source : undefined,
      deviceName: typeof activity.device_name === 'string' ? activity.device_name : undefined
    }));
}

/** Fetches the GPS route for one activity as TrackPoints, ready to hand to addImportedTrail. */
export async function importActivityRoute(apiKey: string, activityId: string): Promise<TrackPoint[]> {
  const url = `${BASE_URL}/activity/${encodeURIComponent(activityId)}/streams?types=latlng,altitude,time`;
  const response = await intervalsFetch(url, apiKey);
  const streams = (await response.json()) as Array<{ type?: string; data?: unknown }>;

  const latlng = streams.find((stream) => stream.type === 'latlng')?.data as [number, number][] | undefined;
  const altitude = streams.find((stream) => stream.type === 'altitude')?.data as number[] | undefined;
  const elapsed = streams.find((stream) => stream.type === 'time')?.data as number[] | undefined;

  if (!Array.isArray(latlng) || latlng.length < 2) {
    throw new Error('This activity has no GPS route to display.');
  }

  const startedAt = Date.now();
  return latlng.map(([lat, lon], index) => ({
    lat,
    lon,
    ele: Array.isArray(altitude) ? altitude[index] : undefined,
    time: Array.isArray(elapsed) ? new Date(startedAt + elapsed[index] * 1000).toISOString() : undefined
  }));
}
