/**
 * Surface wind from five sources, side by side: what the log records and the
 * arithmetic that reads it.
 *
 * The question behind it (2026-10-09): Open-Meteo serves a 15-minute
 * (`minutely_15`) and a `current` 10 m wind beside the hourly one this app
 * already requests. Is either updated more often, closer to what KPMV
 * measures, or better for some other reason than the sources the dashboard
 * reads now? The live script `scripts/surfaceWindCompare.live.ts` fetches all
 * five once per run and prints one `@@parity` line in the shape below; this
 * file turns a pile of those lines into counts and spreads.
 *
 * The five:
 *   metar     KPMV's observation, IEM and api.weather.gov, the newer report
 *             (chooseObservation, as the dashboard picks it)
 *   nws       the NWS gridpoint forecast for the drop zone, the app's
 *             `fetchHourly` path, one value per clock hour
 *   omHourly  Open-Meteo's hourly 10 m wind, what the winds-aloft request
 *             already asks for; the app shows the hour nearest `now`
 *   om15      Open-Meteo's `minutely_15` 10 m wind
 *   omCurrent Open-Meteo's `current` 10 m wind
 *
 * What it must not do: grade. The summary says how often a value changed, how
 * old it was when fetched and how far it sat from the METAR; whether any of
 * that is good enough is the reader's call (CLAUDE.md, the governing rule).
 * Medians and 90th percentiles rather than means, for the reason
 * paritySummary.ts gives.
 *
 * Pure: records in, summary out. No clock is read; every time is in a record.
 */
import { spreadOf, type Spread } from './paritySummary';

/** One wind value as a source served it, valid at `t` (ISO). Knots and
 *  degrees true; null where the source served nothing. `gust` null means no
 *  gust was served: a METAR with no G group, or a source with no gust field. */
export interface WindAt {
  t: string;
  dir: number | null;
  spd: number | null;
  gust: number | null;
}

/** The record's version. 1 from 2026-10-09, the first. */
export const SURFACE_WIND_RECORD_VERSION = 1;

/** Model metadata from Open-Meteo's `/data/<domain>/static/meta.json`, the
 *  one place it says which run it has: init time, when its conversion
 *  finished, and when the API had it, all ISO. */
export interface OpenMeteoRunMeta {
  init: string | null;
  modified: string | null;
  avail: string | null;
  /** Seconds between the domain's time steps: 3600 hourly, 900 for 15 min. */
  stepS: number | null;
}

/** One run of the surface-wind comparison. A source that failed carries an
 *  `…Error` and no value; the others are still compared. */
export interface SurfaceWindRecord {
  kind: 'surfacewind';
  v: number;
  /** ISO time the run started. */
  at: string;
  /** The point the forecasts were asked for, "lat,lon". */
  dz: string;
  metar?: {
    source: 'iem' | 'nws';
    obsAt: string;
    /** The wind as the dashboard decodes it: direction null when calm or
     *  variable (SurfaceWind). */
    wind: WindAt;
    /** The METAR's wind group as written, "13005KT", for reading a row. */
    group: string | null;
    iemObsAt: string | null;
    nwsObsAt: string | null;
  } | null;
  metarError?: string;
  nws?: {
    /** When the response arrived. */
    fetchedAt: string;
    /** The gridpoint's own `updateTime`, and the HTTP headers that say when
     *  it was written and how long a cache may keep it. */
    updateTime: string | null;
    lastModified: string | null;
    expires: string | null;
    maxAgeS: number | null;
    /** The same grid's `/forecast/hourly` product, which carries
     *  `generatedAt` and its own `updateTime`; read for the timestamps only,
     *  since the app reads the gridpoint. */
    hourlyUpdateTime: string | null;
    hourlyGeneratedAt: string | null;
    /** Clock hours around the fetch, each valid from `t` for an hour. */
    hours: WindAt[];
  };
  nwsError?: string;
  om?: {
    fetchedAt: string;
    generationMs: number | null;
    /** The grid cell Open-Meteo answered from, and its model elevation (m). */
    gridLat: number | null;
    gridLon: number | null;
    elevationM: number | null;
    /** `current`, valid for `intervalS` seconds from `t`. */
    current: (WindAt & { intervalS: number | null }) | null;
    hourly: WindAt[];
    m15: WindAt[];
    /** Response headers that could carry a time; Open-Meteo sent neither
     *  Last-Modified nor a cache lifetime on 2026-10-09, kept to notice if
     *  it starts. */
    lastModified: string | null;
    cacheControl: string | null;
    /** Whether the same request with `models=ncep_hrrr_conus` returned the
     *  same numbers, every series: the default ("best match") being HRRR
     *  here. null when that request failed or returned no wind series
     *  (omHrrrError says which). */
    sameAsHrrr: boolean | null;
    /** When not the same, the largest gaps between the two over all three
     *  series (maxWindDiff), and `shapeDiffers` when the two did not carry
     *  the same valid times or the same values present (from 2026-10-09; before, a difference in
     *  shape alone would have logged 0/0/0, which no run in the first sample
     *  did). Absent when the same or not compared. */
    hrrrMaxDiff?: HrrrDiff;
  };
  omError?: string;
  /** Why the `models=ncep_hrrr_conus` comparison was not made: the request
   *  failed, or it answered with no wind series to compare. */
  omHrrrError?: string;
  /** Run metadata per Open-Meteo model domain, keyed by its name; null for
   *  a domain whose metadata could not be read, and the reason here. */
  omMeta?: Record<string, OpenMeteoRunMeta | null>;
  omMetaErrors?: Record<string, string>;
}

export interface HrrrDiff {
  dir: number;
  spd: number;
  gust: number;
  shapeDiffers?: boolean;
}

/** Open-Meteo's forecast response, the fields read here, with
 *  `timeformat=unixtime` (seconds). */
export interface RawOpenMeteoWind {
  latitude?: number;
  longitude?: number;
  elevation?: number;
  generationtime_ms?: number;
  current?: {
    time?: number;
    interval?: number;
    wind_speed_10m?: number | null;
    wind_direction_10m?: number | null;
    wind_gusts_10m?: number | null;
  };
  hourly?: RawOpenMeteoSeries;
  minutely_15?: RawOpenMeteoSeries;
}

export interface RawOpenMeteoSeries {
  time?: number[];
  wind_speed_10m?: (number | null)[];
  wind_direction_10m?: (number | null)[];
  wind_gusts_10m?: (number | null)[];
}

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const iso = (ms: number): string => new Date(ms).toISOString();

/** One Open-Meteo series (hourly or minutely_15) as WindAt values, in the
 *  order served. A step whose time is missing is dropped. */
export function openMeteoSeries(s: RawOpenMeteoSeries | undefined): WindAt[] {
  const times = s?.time ?? [];
  const out: WindAt[] = [];
  times.forEach((sec, i) => {
    if (finite(sec) == null) return;
    out.push({
      t: iso(sec * 1000),
      dir: finite(s?.wind_direction_10m?.[i]),
      spd: finite(s?.wind_speed_10m?.[i]),
      gust: finite(s?.wind_gusts_10m?.[i]),
    });
  });
  return out;
}

/** Open-Meteo's `current` block as a WindAt, or null when it is missing. */
export function openMeteoCurrent(raw: RawOpenMeteoWind): (WindAt & { intervalS: number | null }) | null {
  const c = raw.current;
  const t = finite(c?.time);
  if (!c || t == null) return null;
  return {
    t: iso(t * 1000),
    dir: finite(c.wind_direction_10m),
    spd: finite(c.wind_speed_10m),
    gust: finite(c.wind_gusts_10m),
    intervalS: finite(c.interval),
  };
}

/** Open-Meteo's model metadata (meta.json) as ISO times. Unix seconds in. */
export function openMeteoRunMeta(raw: {
  last_run_initialisation_time?: number;
  last_run_modification_time?: number;
  last_run_availability_time?: number;
  temporal_resolution_seconds?: number;
}): OpenMeteoRunMeta {
  const t = (s: unknown): string | null => (finite(s) == null ? null : iso((s as number) * 1000));
  return {
    init: t(raw.last_run_initialisation_time),
    modified: t(raw.last_run_modification_time),
    avail: t(raw.last_run_availability_time),
    stepS: finite(raw.temporal_resolution_seconds),
  };
}

/** `max-age` from a Cache-Control header, seconds; null without one. */
export function maxAgeSeconds(cacheControl: string | null | undefined): number | null {
  const m = cacheControl?.match(/(?:^|[,\s])max-age=(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Whether two responses carried the same numbers: every series, value for
 *  value. Used to tell whether Open-Meteo's default model is HRRR here. */
export function sameWindSeries(a: readonly WindAt[], b: readonly WindAt[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => x.t === b[i].t && x.dir === b[i].dir && x.spd === b[i].spd && x.gust === b[i].gust)
  );
}

/** The METAR's wind group, "13005KT", "VRB03KT", "18012G20KT" or
 *  "00000KT", from the report text; null when it has none. */
export function metarWindGroup(raw: string | null | undefined): string | null {
  const m = raw?.match(/(?:^|\s)((?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?KT)(?=\s|$)/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Reading values back out of a record

/** How a forecast series is read at a moment:
 *   nearest  the step nearest in time, as the app reads Open-Meteo's hourly
 *            winds (normalizeOpenMeteo) and as an instant 15-minute value is
 *            best read;
 *   block    the step whose period [t, t + stepMs) contains the moment, as
 *            the NWS gridpoint's hour values are valid for the whole hour.
 *  `maxGapMs` bounds `nearest`: a step further away than that is no value. */
export type ReadRule = { kind: 'nearest'; maxGapMs: number } | { kind: 'block'; stepMs: number };

export function windAtTime(series: readonly WindAt[], ms: number, rule: ReadRule): WindAt | null {
  let best: WindAt | null = null;
  let bestGap = Infinity;
  for (const w of series) {
    const t = Date.parse(w.t);
    if (!Number.isFinite(t)) continue;
    if (rule.kind === 'block') {
      if (ms >= t && ms < t + rule.stepMs) return w;
      continue;
    }
    const gap = Math.abs(t - ms);
    // Strictly nearer wins, so a moment exactly between two steps reads the
    // earlier one; the series are served in time order.
    if (gap < bestGap) {
      best = w;
      bestGap = gap;
    }
  }
  return rule.kind === 'nearest' && bestGap <= rule.maxGapMs ? best : null;
}

const HOUR_MS = 3_600_000;
const STEP15_MS = 900_000;

/** The forecast sources this file compares, and how each one is read. */
export type ForecastSource = 'nws' | 'omHourly' | 'om15' | 'omCurrent';
export const FORECAST_SOURCES: readonly ForecastSource[] = ['nws', 'omHourly', 'om15', 'omCurrent'];
export type SourceName = 'metar' | ForecastSource;

const RULES: Record<Exclude<ForecastSource, 'omCurrent'>, ReadRule> = {
  nws: { kind: 'block', stepMs: HOUR_MS },
  // Half an hour: every moment has an hour step that near, so a farther one
  // means the hour was not in the record.
  omHourly: { kind: 'nearest', maxGapMs: HOUR_MS / 2 },
  om15: { kind: 'nearest', maxGapMs: STEP15_MS / 2 },
};

function seriesOf(r: SurfaceWindRecord, src: Exclude<ForecastSource, 'omCurrent'>): readonly WindAt[] {
  if (src === 'nws') return r.nws?.hours ?? [];
  if (src === 'omHourly') return r.om?.hourly ?? [];
  return r.om?.m15 ?? [];
}

/** What the source would have shown as "now" at the run's own time: the
 *  METAR as fetched, NWS's hour block, Open-Meteo's nearest hour (as the app
 *  picks it), the nearest 15-minute step, and `current` as served. */
export function shownAt(r: SurfaceWindRecord, src: SourceName): WindAt | null {
  if (src === 'metar') return r.metar?.wind ?? null;
  if (src === 'omCurrent') return r.om?.current ?? null;
  return windAtTime(seriesOf(r, src), Date.parse(r.at), RULES[src]);
}

// ---------------------------------------------------------------------------
// The summary

/** How often the value a source would show "now" changed between runs, and
 *  how often a forecast for one fixed valid time was revised. */
export interface Cadence {
  source: SourceName;
  /** Runs with a value. */
  runs: number;
  /** Consecutive pairs of runs (both with a value) whose "now" value
   *  differed, in any of direction, speed or gust. */
  shownChanges: number;
  shownPairs: number;
  /** The same, leaving out a change that is only a one-degree direction
   *  flap on the same valid time (dirOnlyByOne): on 2026-10-09 Open-Meteo's
   *  servers answered alike requests that way, so counting those would read
   *  as a source updated every few minutes when it was not. */
  shownChangesNet: number;
  /** Minutes between successive changes of the "now" value, every change
   *  and net of the flaps: the median and the range. Measured from run
   *  times, so each is only as sharp as the gap between runs. */
  shownIntervalMin: Interval;
  shownIntervalNetMin: Interval;
  /** Forecasts only: runs at which a value for a valid time already seen in
   *  the previous run had changed. The run time of each, ISO. Includes
   *  runs whose only changes were flaps; `revisionsNet` leaves those out. */
  revisions: string[];
  revisionsNet: string[];
  /** Valid times compared across consecutive runs, and how many of those
   *  comparisons found a different value. */
  revisionPairs: number;
  revisionChanges: number;
  /** The changes, sorted into three kinds that partition them (they sum to
   *  `revisionChanges`), each change in the first kind that fits:
   *    dirByOne  the direction moved by exactly one degree and nothing else.
   *              On 2026-10-09 Open-Meteo answered alike requests with every
   *              direction one degree apart and every speed and gust the
   *              same, alternating from one request to the next, with no new
   *              run in its metadata: a difference between its servers.
   *    revert    back to a value an earlier run had already served for the
   *              same valid time: an answer from a server that had not yet
   *              taken the newer run. Open-Meteo's model-updates page says it
   *              runs "multiple redundant API servers" and that there "may be
   *              slight differences between them while the data is being
   *              copied" (read 2026-10-09).
   *    other     anything else: a value not served before, a revision. */
  revisionKinds: { dirByOne: number; revert: number; other: number };
}

export interface Interval {
  median: number | null;
  min: number | null;
  max: number | null;
}

/** How old each source's information was when fetched, minutes. */
export interface Staleness {
  source: SourceName;
  /** What "age" measures for this source, in words, for the doc. */
  basis: string;
  n: number;
  medianMin: number | null;
  minMin: number | null;
  maxMin: number | null;
}

/** One forecast source against the METAR, every distinct report once. */
export interface VsMetar {
  source: ForecastSource;
  /** Distinct METAR reports in the records, and how many of them this
   *  source had a forecast value for (vsMetarOf says which run is read). */
  reports: number;
  n: number;
  /** Forecast minus observed, kt. */
  spd: Spread | null;
  /** Signed angular difference, forecast minus observed, where the METAR
   *  gave a direction (not calm, not variable). */
  dir: Spread | null;
  /** Gust, forecast minus observed, where both had one. */
  gust: Spread | null;
  /** Reports whose METAR carried a gust, and of those, how many the source
   *  had a gust value for. */
  metarGusts: number;
  forecastGustWhenMetarGust: number;
  /** Reports where the source had a gust and the METAR none. Not a
   *  disagreement in itself: a METAR carries a G group only for gusts that
   *  meet its coding rules, while Open-Meteo and NWS serve a gust figure
   *  every hour. Counted because it is what a reader setting the two side
   *  by side would see. */
  forecastGustWhenMetarNone: number;
}

export interface SurfaceWindSummary {
  records: number;
  firstAt: string | null;
  lastAt: string | null;
  /** Distinct METAR reports seen. */
  metarReports: number;
  errors: Record<SourceName | 'omMeta' | 'omHrrr', number>;
  cadence: Cadence[];
  staleness: Staleness[];
  vsMetar: VsMetar[];
  /** Runs where `current` equalled the 15-minute step at its own time, out
   *  of runs where both were present. */
  currentIsM15: { same: number; of: number };
  /** Runs where every hourly step equalled the 15-minute step at the same
   *  time, out of runs where any hourly step had one. Whether the hourly
   *  series is the 15-minute one read on the hour. */
  hourlyIsM15: { same: number; of: number };
  /** Open-Meteo's docs give the hourly gust as "a maximum of the preceding
   *  hour" (read 2026-10-09). Distinct valid hours for which some run had
   *  the whole preceding hour of 15-minute steps in the same response (the
   *  step itself and the three before), each read from the LATEST such run,
   *  and how many of those had an hourly gust equal to the largest of the
   *  four 15-minute gusts, below it (and by how much at most, kt), or
   *  above it. */
  hourlyGustVsHourMax: { hours: number; equal: number; below: number; above: number; maxBelowKt: number };
  /** Runs where Open-Meteo's default model returned HRRR's numbers, and for
   *  the runs where it did not, the largest gaps (hrrrMaxDiff, with
   *  `shapeDiffers` when the two responses did not carry the same valid
   *  times or the same values present, in which case the gaps cover only
   *  the values both had). */
  defaultIsHrrr: { same: number; of: number; diffs: ({ at: string } & HrrrDiff)[] };
  /** Distinct run init times seen per model domain, in order, with the first
   *  run time each was seen at. */
  modelRuns: Record<string, { init: string; avail: string | null; firstSeenAt: string }[]>;
  /** Distinct NWS gridpoint `updateTime`s, in the order first seen, each with
   *  the first run that saw it and that run's hourly-product `updateTime`. */
  nwsUpdates: { updateTime: string; firstSeenAt: string; hourlyUpdateTime: string | null }[];
}

const angular = (a: number, b: number): number => ((((a - b + 540) % 360) + 360) % 360) - 180;
const sameWind = (a: WindAt | null, b: WindAt | null): boolean =>
  a != null && b != null && a.dir === b.dir && a.spd === b.spd && a.gust === b.gust;
/** Same speed and gust, directions exactly one degree apart (across north
 *  too: 360 and 1). */
const dirOnlyByOne = (a: WindAt, b: WindAt): boolean =>
  a.spd === b.spd && a.gust === b.gust && a.dir != null && b.dir != null && Math.abs(angular(a.dir, b.dir)) === 1;

/** The largest gap between two responses' values at the valid times both
 *  carry: direction (degrees, angular), speed and gust (kt). Zero when
 *  they agree everywhere; `matched` says how many valid times were set
 *  side by side. */
export function maxWindDiff(a: readonly WindAt[], b: readonly WindAt[]): { dir: number; spd: number; gust: number; matched: number } {
  const byT = new Map(b.map((w) => [w.t, w]));
  let dir = 0;
  let spd = 0;
  let gust = 0;
  let matched = 0;
  for (const x of a) {
    const y = byT.get(x.t);
    if (!y) continue;
    matched += 1;
    if (x.dir != null && y.dir != null) dir = Math.max(dir, Math.abs(angular(x.dir, y.dir)));
    if (x.spd != null && y.spd != null) spd = Math.max(spd, Math.round(Math.abs(x.spd - y.spd) * 10) / 10);
    if (x.gust != null && y.gust != null) gust = Math.max(gust, Math.round(Math.abs(x.gust - y.gust) * 10) / 10);
  }
  return { dir, spd, gust, matched };
}

/** Two responses compared series by series (current, hourly, 15-minute):
 *  the same only when every series is (sameWindSeries); otherwise the
 *  largest gaps over the valid times both carry, and `shapeDiffers` when
 *  any pair of series did not carry the same valid times, or carried a
 *  value on one side only, so a gap of 0/0/0 is never logged as if it
 *  explained the difference. */
export function compareWindResponses(pairs: readonly (readonly [readonly WindAt[], readonly WindAt[]])[]): {
  same: boolean;
  diff?: HrrrDiff;
} {
  if (pairs.every(([a, b]) => sameWindSeries(a, b))) return { same: true };
  const d = pairs.map(([a, b]) => maxWindDiff(a, b));
  // A different set of valid times, or a value one side served and the
  // other did not (a gust on one, null on the other): either leaves the
  // gaps above unable to say how the two differed.
  const present = (w: WindAt): string => [w.dir, w.spd, w.gust].map((v) => (v == null ? '-' : '+')).join('');
  const shapeDiffers = pairs.some(
    ([a, b]) => a.length !== b.length || a.some((x, i) => x.t !== b[i].t || present(x) !== present(b[i])),
  );
  return {
    same: false,
    diff: {
      dir: Math.max(...d.map((x) => x.dir)),
      spd: Math.max(...d.map((x) => x.spd)),
      gust: Math.max(...d.map((x) => x.gust)),
      ...(shapeDiffers ? { shapeDiffers: true } : {}),
    },
  };
}

const minutes = (ms: number): number => Math.round((ms / 60_000) * 10) / 10;

function medianOf(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** A one-degree flap: the same valid time, nothing but the direction
 *  changed, by exactly one degree. */
const isFlap = (a: WindAt, b: WindAt): boolean => a.t === b.t && dirOnlyByOne(a, b);

function intervalOf(times: readonly number[]): Interval {
  const gaps = times.slice(1).map((t, i) => minutes(t - times[i]));
  return {
    median: medianOf(gaps),
    min: gaps.length ? Math.min(...gaps) : null,
    max: gaps.length ? Math.max(...gaps) : null,
  };
}

function cadenceOf(records: readonly SurfaceWindRecord[], source: SourceName): Cadence {
  const withValue = records.filter((r) => shownAt(r, source) != null);
  const changeTimes: number[] = [];
  const netChangeTimes: number[] = [];
  for (let i = 1; i < withValue.length; i++) {
    const a = shownAt(withValue[i - 1], source) as WindAt;
    const b = shownAt(withValue[i], source) as WindAt;
    if (sameWind(a, b)) continue;
    changeTimes.push(Date.parse(withValue[i].at));
    if (!isFlap(a, b)) netChangeTimes.push(Date.parse(withValue[i].at));
  }

  // Revisions: the same valid time, read in two consecutive runs, with a
  // different value. The METAR has no revisions (a report is a report), and
  // `current` carries one valid time per run, so it is compared with the
  // previous run's `current` only when both name the same interval.
  const revisions: string[] = [];
  const revisionsNet: string[] = [];
  let revisionPairs = 0;
  let revisionChanges = 0;
  const revisionKinds = { dirByOne: 0, revert: 0, other: 0 };
  if (source !== 'metar') {
    const valued = records.filter((r) => (source === 'omCurrent' ? r.om?.current : source === 'nws' ? r.nws : r.om));
    // Every value served so far for each valid time, to tell a revert from
    // a revision.
    const history = new Map<string, WindAt[]>();
    const remember = (r: SurfaceWindRecord): void => {
      for (const [t, w] of forecastValues(r, source)) {
        const h = history.get(t) ?? [];
        if (!h.some((x) => sameWind(x, w))) h.push(w);
        history.set(t, h);
      }
    };
    if (valued[0]) remember(valued[0]);
    for (let i = 1; i < valued.length; i++) {
      const prev = forecastValues(valued[i - 1], source);
      const next = forecastValues(valued[i], source);
      let changed = false;
      let changedNet = false;
      for (const [t, w] of next) {
        const p = prev.get(t);
        if (!p) continue;
        revisionPairs += 1;
        if (sameWind(p, w)) continue;
        revisionChanges += 1;
        changed = true;
        if (dirOnlyByOne(p, w)) {
          revisionKinds.dirByOne += 1;
          continue;
        }
        changedNet = true;
        if ((history.get(t) ?? []).some((x) => sameWind(x, w))) revisionKinds.revert += 1;
        else revisionKinds.other += 1;
      }
      if (changed) revisions.push(valued[i].at);
      if (changedNet) revisionsNet.push(valued[i].at);
      remember(valued[i]);
    }
  }
  return {
    source,
    runs: withValue.length,
    shownChanges: changeTimes.length,
    shownPairs: Math.max(0, withValue.length - 1),
    shownChangesNet: netChangeTimes.length,
    shownIntervalMin: intervalOf(changeTimes),
    shownIntervalNetMin: intervalOf(netChangeTimes),
    revisions,
    revisionsNet,
    revisionPairs,
    revisionChanges,
    revisionKinds,
  };
}

function forecastValues(r: SurfaceWindRecord, source: ForecastSource): Map<string, WindAt> {
  const list = source === 'omCurrent' ? (r.om?.current ? [r.om.current] : []) : seriesOf(r, source);
  return new Map(list.map((w) => [w.t, w]));
}

function stalenessOf(records: readonly SurfaceWindRecord[], source: SourceName): Staleness {
  const ages: number[] = [];
  let basis = '';
  for (const r of records) {
    const at = Date.parse(r.at);
    let from: string | null | undefined = null;
    if (source === 'metar') {
      basis = 'run time minus the report’s observation time';
      from = r.metar?.obsAt;
    } else if (source === 'nws') {
      basis = 'run time minus the gridpoint’s updateTime';
      from = r.nws?.updateTime;
    } else if (source === 'omCurrent') {
      basis = 'run time minus the start of the `current` interval';
      from = r.om?.current?.t;
    } else {
      // Open-Meteo says nothing in the forecast response about its run; the
      // metadata API does, per model domain. Both series are read against
      // HRRR's 15-minute domain: on 2026-10-09 every hourly 10 m wind equalled
      // the 15-minute step at the same hour (`hourlyIsM15`), and the hourly
      // values changed when a new 15-minute run arrived, not when
      // `ncep_hrrr_conus` (the hourly domain) did, which was an hour behind
      // (docs/surface-wind-sources.md). That domain's runs are still logged.
      //
      // INFERRED, not measured: this assumes the forecast came from the run
      // the metadata named, and the same sample showed it need not (for about
      // twelve minutes after a run arrived, requests got the new run or the
      // old one in turn, and the metadata itself differed between servers).
      // Only runs that returned a forecast count: a run whose forecast
      // request failed has metadata but nothing it describes.
      const domain = 'ncep_hrrr_conus_15min';
      basis =
        `INFERRED: run time minus ${domain}'s last_run_availability_time, ` +
        'assuming the forecast came from that run (servers can lag it)';
      from = r.om ? r.omMeta?.[domain]?.avail : null;
    }
    const t = from ? Date.parse(from) : NaN;
    if (Number.isFinite(t) && Number.isFinite(at)) ages.push(minutes(at - t));
  }
  return {
    source,
    basis,
    n: ages.length,
    medianMin: medianOf(ages),
    minMin: ages.length ? Math.min(...ages) : null,
    maxMin: ages.length ? Math.max(...ages) : null,
  };
}

/**
 * Each distinct METAR report against each forecast's value for its
 * observation time, read from the first run that both had the report as its
 * newest and returned that source's forecast: what the forecast said while
 * the report was the newest one, the moment a reader would set them side by
 * side. Per source, so a run whose Open-Meteo request failed does not drop
 * the report for NWS, and a later run fills in for the source that failed.
 * A report no run had a forecast for is left out for that source (`n`
 * against `reports`).
 *
 * `current` has one valid time per run, so for it the report is paired with
 * the first run whose `current` interval contains the observation time, if
 * any run's does, whichever report that run had.
 */
function vsMetarOf(records: readonly SurfaceWindRecord[], source: ForecastSource): VsMetar {
  const hasForecast = (r: SurfaceWindRecord): boolean => (source === 'nws' ? r.nws != null : r.om != null);
  const firstByReport = new Map<string, SurfaceWindRecord | null>();
  for (const r of records) {
    if (!r.metar) continue;
    const seen = firstByReport.get(r.metar.obsAt);
    if (seen) continue;
    firstByReport.set(r.metar.obsAt, hasForecast(r) || source === 'omCurrent' ? r : null);
  }
  const spd: number[] = [];
  const dir: number[] = [];
  const gust: number[] = [];
  let n = 0;
  let metarGusts = 0;
  let gustBoth = 0;
  let gustOnlyForecast = 0;
  for (const [obsAt, first] of firstByReport) {
    if (!first) continue;
    const obs = first.metar?.wind;
    if (!obs) continue;
    const ms = Date.parse(obsAt);
    let fc: WindAt | null = null;
    if (source === 'omCurrent') {
      for (const r of records) {
        const c = r.om?.current;
        if (!c) continue;
        const start = Date.parse(c.t);
        const len = (c.intervalS ?? 900) * 1000;
        if (ms >= start && ms < start + len) {
          fc = c;
          break;
        }
      }
    } else {
      fc = windAtTime(seriesOf(first, source), ms, RULES[source]);
    }
    if (!fc) continue;
    n += 1;
    if (fc.spd != null && obs.spd != null) spd.push(Math.round((fc.spd - obs.spd) * 10) / 10);
    if (fc.dir != null && obs.dir != null) dir.push(angular(fc.dir, obs.dir));
    if (obs.gust != null) {
      metarGusts += 1;
      if (fc.gust != null) {
        gustBoth += 1;
        gust.push(Math.round((fc.gust - obs.gust) * 10) / 10);
      }
    } else if (fc.gust != null) {
      gustOnlyForecast += 1;
    }
  }
  return {
    source,
    reports: firstByReport.size,
    n,
    spd: spreadOf(spd),
    dir: spreadOf(dir),
    gust: spreadOf(gust),
    metarGusts,
    forecastGustWhenMetarGust: gustBoth,
    forecastGustWhenMetarNone: gustOnlyForecast,
  };
}

/** Everything above, over a set of records in any order (sorted here by run
 *  time; a run logged twice counts once). */
export function summarizeSurfaceWind(input: readonly SurfaceWindRecord[]): SurfaceWindSummary {
  const seen = new Set<string>();
  const records = [...input]
    .filter((r) => Number.isFinite(Date.parse(r.at)))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .filter((r) => (seen.has(r.at) ? false : (seen.add(r.at), true)));
  const sources: SourceName[] = ['metar', ...FORECAST_SOURCES];

  let curSame = 0;
  let curOf = 0;
  let hrrrSame = 0;
  let hrrrOf = 0;
  let hourlySame = 0;
  let hourlyOf = 0;
  const gustByHour = new Map<string, { hourly: number; max: number }>();
  const hrrrDiffs: SurfaceWindSummary['defaultIsHrrr']['diffs'] = [];
  const modelRuns: SurfaceWindSummary['modelRuns'] = {};
  const nwsUpdates: SurfaceWindSummary['nwsUpdates'] = [];
  for (const r of records) {
    const u = r.nws?.updateTime;
    if (u && !nwsUpdates.some((x) => x.updateTime === u)) {
      nwsUpdates.push({ updateTime: u, firstSeenAt: r.at, hourlyUpdateTime: r.nws?.hourlyUpdateTime ?? null });
    }
    const c = r.om?.current;
    const step = c ? windAtTime(r.om?.m15 ?? [], Date.parse(c.t), { kind: 'nearest', maxGapMs: 0 }) : null;
    if (c && step) {
      curOf += 1;
      if (sameWind(c, step)) curSame += 1;
    }
    const m15ByT = new Map((r.om?.m15 ?? []).map((x) => [x.t, x]));
    const onTheHour = (r.om?.hourly ?? []).filter((h) => m15ByT.has(h.t));
    if (onTheHour.length > 0) {
      hourlyOf += 1;
      if (onTheHour.every((h) => sameWind(h, m15ByT.get(h.t) ?? null))) hourlySame += 1;
    }
    for (const h of r.om?.hourly ?? []) {
      const end = Date.parse(h.t);
      const quarter = [0, 1, 2, 3].map((k) => m15ByT.get(iso(end - k * STEP15_MS))?.gust);
      if (h.gust == null || quarter.some((g) => g == null)) continue;
      // Records run in time order, so a later run's reading of the same
      // valid hour replaces an earlier one: each hour counts once, as the
      // latest run served it.
      gustByHour.set(h.t, { hourly: h.gust, max: Math.max(...(quarter as number[])) });
    }
    if (r.om?.sameAsHrrr != null) {
      hrrrOf += 1;
      if (r.om.sameAsHrrr) hrrrSame += 1;
      else if (r.om.hrrrMaxDiff) hrrrDiffs.push({ at: r.at, ...r.om.hrrrMaxDiff });
    }
    for (const [domain, meta] of Object.entries(r.omMeta ?? {})) {
      if (!meta?.init) continue;
      const runs = (modelRuns[domain] ??= []);
      if (!runs.some((x) => x.init === meta.init)) runs.push({ init: meta.init, avail: meta.avail, firstSeenAt: r.at });
    }
  }

  const gustVsMax = { hours: 0, equal: 0, below: 0, above: 0, maxBelowKt: 0 };
  for (const { hourly, max } of gustByHour.values()) {
    gustVsMax.hours += 1;
    if (hourly === max) gustVsMax.equal += 1;
    else if (hourly < max) {
      gustVsMax.below += 1;
      gustVsMax.maxBelowKt = Math.max(gustVsMax.maxBelowKt, Math.round((max - hourly) * 10) / 10);
    } else gustVsMax.above += 1;
  }

  return {
    records: records.length,
    firstAt: records[0]?.at ?? null,
    lastAt: records[records.length - 1]?.at ?? null,
    metarReports: new Set(records.flatMap((r) => (r.metar ? [r.metar.obsAt] : []))).size,
    errors: {
      metar: records.filter((r) => r.metarError).length,
      nws: records.filter((r) => r.nwsError).length,
      omHourly: records.filter((r) => r.omError).length,
      om15: records.filter((r) => r.omError).length,
      omCurrent: records.filter((r) => r.omError).length,
      omMeta: records.filter((r) => !r.omMeta || Object.values(r.omMeta).some((m) => m == null)).length,
      // Runs left out of defaultIsHrrr because the HRRR comparison was not
      // made; counted here so they do not vanish from the summary.
      omHrrr: records.filter((r) => r.omHrrrError).length,
    },
    cadence: sources.map((s) => cadenceOf(records, s)),
    staleness: sources.map((s) => stalenessOf(records, s)),
    vsMetar: FORECAST_SOURCES.map((s) => vsMetarOf(records, s)),
    currentIsM15: { same: curSame, of: curOf },
    hourlyIsM15: { same: hourlySame, of: hourlyOf },
    hourlyGustVsHourMax: gustVsMax,
    defaultIsHrrr: { same: hrrrSame, of: hrrrOf, diffs: hrrrDiffs },
    modelRuns,
    nwsUpdates,
  };
}

/** The `@@parity` lines of kind `surfacewind` in a log, everything else
 *  ignored, a line that is not valid JSON skipped (as parseParityLines does
 *  for the other kinds, which in turn skips these). */
export function parseSurfaceWindLines(text: string): SurfaceWindRecord[] {
  const out: SurfaceWindRecord[] = [];
  for (const line of text.split('\n')) {
    const i = line.indexOf('@@parity ');
    if (i < 0) continue;
    try {
      const obj = JSON.parse(line.slice(i + '@@parity '.length)) as SurfaceWindRecord;
      if (obj?.kind === 'surfacewind' && typeof obj.at === 'string') out.push(obj);
    } catch {
      // not ours, or truncated: skip
    }
  }
  return out;
}
