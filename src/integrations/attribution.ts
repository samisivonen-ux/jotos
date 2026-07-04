/**
 * Intervals.icu's `source` field names the device/platform an activity was
 * recorded on. Only genuine third-party device/platform brands go here —
 * MANUAL, UPLOAD, DROPBOX and OAUTH_CLIENT are generic entry mechanisms with
 * no brand to attribute. Mirrors the same mapping used server-side in the
 * piisAmI coaching product, kept independently since this is a separate app.
 */
const BRANDED_SOURCE_NAMES: Record<string, string> = {
  GARMIN_CONNECT: 'Garmin',
  POLAR: 'Polar',
  SUUNTO: 'Suunto',
  COROS: 'Coros',
  WAHOO: 'Wahoo',
  ZWIFT: 'Zwift',
  STRAVA: 'Strava',
  ZEPP: 'Zepp',
  CONCEPT2: 'Concept2',
  HUAWEI: 'Huawei'
};

export function attributionForSource(source: string | undefined | null): string | undefined {
  if (!source) return undefined;
  const brand = BRANDED_SOURCE_NAMES[source];
  if (!brand) return undefined;
  return `Route data sourced from ${brand} (via Intervals.icu).`;
}
