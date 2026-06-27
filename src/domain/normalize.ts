import type { CurrentConditions, HourlyPoint, SkyCover, SkyLayer } from './types';
import { hpaToInHg, mToFt, mToSm } from './units';
import type { RawWindSample } from './windsAloft';

/* ------------------------------------------------------------------ *
 *  METAR (AviationWeather.gov /api/data/metar?format=json)            *
 * ------------------------------------------------------------------ */

export interface RawMetar {
  icaoId: string;
  obsTime: number; // epoch seconds
  rawOb: string;
  temp: number | null;
  dewp: number | null;
  wdir: number | string | null; // number, "VRB", or null
  wspd: number | null; // kt
  wgst: number | null; // kt
  visib: number | string | null; // SM, may be "10+"
  altim: number | null; // hPa
  wxString: string | null;
  clouds?: Array<{ cover: string; base: number | null }>; // base ft AGL
}

const CEILING_COVERS: SkyCover[] = ['BKN', 'OVC', 'VV'];

export function normalizeMetar(m: RawMetar): CurrentConditions {
  const skyLayers: SkyLayer[] = (m.clouds ?? []).map((c) => ({
    cover: (c.cover as SkyCover) ?? 'SKC',
    baseFtAgl: c.base ?? null,
  }));

  const ceiling = skyLayers
    .filter((l) => CEILING_COVERS.includes(l.cover) && l.baseFtAgl != null)
    .reduce<number | null>((min, l) => (min == null ? l.baseFtAgl : Math.min(min, l.baseFtAgl!)), null);

  return {
    station: m.icaoId,
    observedAt: m.obsTime * 1000,
    raw: m.rawOb,
    wind: {
      directionDeg: typeof m.wdir === 'number' ? m.wdir : null,
      speedKt: m.wspd ?? 0,
      gustKt: m.wgst ?? null,
    },
    visibilitySm: parseVisibility(m.visib),
    skyLayers,
    ceilingFtAgl: ceiling,
    tempC: m.temp ?? null,
    dewpointC: m.dewp ?? null,
    altimeterInHg: m.altim != null ? round2(hpaToInHg(m.altim)) : null,
    wxString: m.wxString ?? null,
  };
}

function parseVisibility(v: number | string | null): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(v.replace('+', ''));
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ *
 *  NWS gridpoint forecast (/gridpoints/{office}/{x},{y})              *
 * ------------------------------------------------------------------ */

interface GridValue {
  validTime: string; // e.g. "2026-06-27T12:00:00+00:00/PT3H"
  value: number | null;
}
interface GridProp {
  uom?: string;
  values: GridValue[];
}
export interface RawGridpoint {
  properties: {
    skyCover?: GridProp;
    ceilingHeight?: GridProp;
    visibility?: GridProp;
    windSpeed?: GridProp;
    windGust?: GridProp;
    windDirection?: GridProp;
    probabilityOfPrecipitation?: GridProp;
    temperature?: GridProp;
    [k: string]: unknown;
  };
}

/** Expand NWS gridpoint properties into a contiguous hourly series. */
export function normalizeGridpoint(gp: RawGridpoint, maxHours = 48): HourlyPoint[] {
  const p = gp.properties;
  const sky = expand(p.skyCover);
  const ceil = expand(p.ceilingHeight, (v, uom) => convertLength(v, uom)); // → ft
  const vis = expand(p.visibility, (v, uom) => (isMeters(uom) ? mToSm(v) : v)); // → SM
  const spd = expand(p.windSpeed, (v, uom) => convertSpeed(v, uom)); // → kt
  const gst = expand(p.windGust, (v, uom) => convertSpeed(v, uom));
  const dir = expand(p.windDirection);
  const pop = expand(p.probabilityOfPrecipitation);
  const temp = expand(p.temperature); // °C

  const start = earliestHour([sky, ceil, vis, spd, dir, temp]);
  if (start == null) return [];

  const out: HourlyPoint[] = [];
  for (let i = 0; i < maxHours; i++) {
    const t = start + i * 3600_000;
    out.push({
      time: t,
      skyCoverPct: sky.get(t) ?? null,
      ceilingFtAgl: ceil.get(t) ?? null,
      visibilitySm: vis.get(t) ?? null,
      windSpeedKt: spd.get(t) ?? null,
      windGustKt: gst.get(t) ?? null,
      windDirectionDeg: dir.get(t) ?? null,
      precipProbPct: pop.get(t) ?? null,
      tempC: temp.get(t) ?? null,
    });
  }
  return out;
}

type Converter = (value: number, uom?: string) => number;

function expand(prop: GridProp | undefined, convert?: Converter): Map<number, number> {
  const map = new Map<number, number>();
  if (!prop) return map;
  for (const { validTime, value } of prop.values) {
    if (value == null) continue;
    const parsed = parseValidTime(validTime);
    if (!parsed) continue;
    const v = convert ? convert(value, prop.uom) : value;
    for (let h = 0; h < parsed.hours; h++) {
      map.set(hourFloor(parsed.start + h * 3600_000), v);
    }
  }
  return map;
}

/** Parse "<ISO start>/<ISO8601 duration>" into a start epoch and hour count. */
export function parseValidTime(s: string): { start: number; hours: number } | null {
  const slash = s.indexOf('/');
  if (slash < 0) return null;
  const start = Date.parse(s.slice(0, slash));
  if (Number.isNaN(start)) return null;
  return { start, hours: Math.max(1, durationToHours(s.slice(slash + 1))) };
}

/** ISO8601 duration → whole hours (days + hours; minutes rounded up). */
export function durationToHours(d: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(d);
  if (!m) return 1;
  const days = Number(m[1] ?? 0);
  const hours = Number(m[2] ?? 0);
  const mins = Number(m[3] ?? 0);
  return days * 24 + hours + (mins > 0 ? 1 : 0);
}

const hourFloor = (t: number): number => Math.floor(t / 3600_000) * 3600_000;

function earliestHour(maps: Map<number, number>[]): number | null {
  let min: number | null = null;
  for (const m of maps) {
    for (const k of m.keys()) if (min == null || k < min) min = k;
  }
  return min;
}

const isMeters = (uom?: string): boolean => !!uom && /(?:^|:)m$|metre|meter/i.test(uom);

function convertLength(v: number, uom?: string): number {
  return isMeters(uom) ? mToFt(v) : v;
}

/** NWS wind defaults to km/h; handle m/s too. Returns knots. */
function convertSpeed(v: number, uom?: string): number {
  if (uom && /m_s|m\/s/i.test(uom)) return v * 1.943844;
  if (uom && /km|kmh|km_h/i.test(uom)) return v / 1.852;
  return v / 1.852; // default assumption: km/h
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ *
 *  Open-Meteo winds aloft (pressure levels + 10 m)                    *
 * ------------------------------------------------------------------ */

export interface RawOpenMeteo {
  hourly: {
    time: string[]; // ISO local times
    [variable: string]: string[] | number[];
  };
  // wind_speed_unit requested as "kn"
}

const PRESSURE_LEVELS = [1000, 925, 850, 700, 600, 500] as const;

/** Build wind samples (MSL height + kt) for the hour nearest `now`. */
export function normalizeOpenMeteo(data: RawOpenMeteo, now: number): RawWindSample[] {
  const times = data.hourly.time.map((t) => Date.parse(t));
  if (times.length === 0) return [];
  const idx = nearestIndex(times, now);

  const samples: RawWindSample[] = [];
  const num = (key: string): number | null => {
    const arr = data.hourly[key] as number[] | undefined;
    const val = arr?.[idx];
    return typeof val === 'number' && Number.isFinite(val) ? val : null;
  };

  // 10 m AGL surface wind. Open-Meteo elevation is the model surface height (m MSL).
  const surfaceSpd = num('wind_speed_10m');
  const surfaceDir = num('wind_direction_10m');
  const elevM = (data as unknown as { elevation?: number }).elevation;
  if (surfaceSpd != null && surfaceDir != null && typeof elevM === 'number') {
    samples.push({ heightFtMsl: mToFt(elevM + 10), speedKt: surfaceSpd, directionDeg: surfaceDir });
  }

  for (const p of PRESSURE_LEVELS) {
    const spd = num(`wind_speed_${p}hPa`);
    const dir = num(`wind_direction_${p}hPa`);
    const gph = num(`geopotential_height_${p}hPa`); // m MSL
    if (spd != null && dir != null && gph != null) {
      samples.push({ heightFtMsl: mToFt(gph), speedKt: spd, directionDeg: dir });
    }
  }
  return samples;
}

function nearestIndex(times: number[], target: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const d = Math.abs(times[i] - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}
