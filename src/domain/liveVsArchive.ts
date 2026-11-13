/**
 * Open-Meteo's live hourly 10 m wind against its own archive, by lead.
 *
 * The question (the maintainer, 2026-11-13): why does Open-Meteo's archived
 * "start of run" wind differ from the forecast the live API served for the
 * same hour? `scripts/omArchiveVsSample.ts` had found the live value about
 * 0.6 kt over the archive's, mostly at night. The hypothesis was lead time:
 * the live value comes from a run one and a half to two hours old, the
 * archive's from a run started at the hour.
 *
 * The surface-wind sample (`SurfaceWindRecord`) can test that from the
 * files on disk, because each run keeps Open-Meteo's hourly series for the
 * two hours either side of the request and, beside it, the HRRR 15-minute
 * domain's run metadata (`omMeta`, the domain the hourly values follow:
 * docs/surface-wind-sources.md, "What changes"). So every hourly value in
 * a record carries a lead: its valid hour minus that run's initialisation
 * hour. Lead 0 is the run's own analysis hour; the hour under way when the
 * app asks is at lead 1 or 2, since a run reaches the servers about ninety
 * minutes after its initialisation (docs/run-split.md).
 *
 * Everything here is arithmetic on records already read; `scripts/
 * omArchiveLead.ts` loads the files and prints the tables. Counts and
 * spreads only.
 */
import { reportNear } from './cloudCoverSources';
import type { Instant } from './keptForecasts';
import { median } from './paritySummary';
import type { SurfaceWindRecord } from './surfaceWindSources';

const MS_H = 3_600_000;

/** The Open-Meteo domain whose runs the hourly values follow. */
export const HOURLY_RUN_DOMAIN = 'ncep_hrrr_conus_15min';

/** One hourly value the live API served, beside the archive's for the
 *  same valid hour. */
export interface LiveVsArchiveSample {
  /** The request's time, ms. */
  at: number;
  /** The valid hour, ms, on the hour. */
  valid: number;
  /** Valid hour minus the newest HRRR 15-minute run's initialisation, in
   *  hours; null when the record has no readable metadata for it. The
   *  metadata is read a moment after the forecast and can name a run the
   *  forecast was not from (docs/surface-wind-sources.md, "Open-Meteo's
   *  servers do not all answer alike"), so a lead is the run the server
   *  that answered the metadata had, not a certainty. */
  lead: number | null;
  /** kt, to the tenth as served. */
  live: number;
  archive: number;
  /** KPMV's report within REPORT_WINDOW_MIN of the valid hour, its speed
   *  in whole knots; null when none. */
  obs: number | null;
}

/**
 * Every hourly value in every record that the archive also holds, with
 * its lead and the report at its hour. A record with no Open-Meteo answer
 * contributes nothing; a value with no speed, nothing.
 */
export function liveVsArchiveSamples(
  records: readonly SurfaceWindRecord[],
  archiveSpdByValid: ReadonlyMap<number, number>,
  reportsByHour: ReadonlyMap<number, readonly Instant[]>,
): LiveVsArchiveSample[] {
  const out: LiveVsArchiveSample[] = [];
  for (const r of records) {
    if (!r.om) continue;
    const at = Date.parse(r.at);
    if (!Number.isFinite(at)) continue;
    const initText = r.omMeta?.[HOURLY_RUN_DOMAIN]?.init ?? null;
    const init = initText == null ? NaN : Date.parse(initText);
    for (const w of r.om.hourly) {
      const valid = Date.parse(w.t);
      if (!Number.isFinite(valid) || w.spd == null) continue;
      const archive = archiveSpdByValid.get(valid);
      if (archive == null) continue;
      const near = reportNear(reportsByHour.get(valid) ?? [], valid);
      out.push({
        at,
        valid,
        lead: Number.isFinite(init) ? (valid - init) / MS_H : null,
        live: w.spd,
        archive,
        obs: near?.spd ?? null,
      });
    }
  }
  return out;
}

/** The hour the request was made in, on the hour. */
export const hourUnderWay = (atMs: number): number => Math.floor(atMs / MS_H) * MS_H;

/** The samples for the hour each request was made in: what the app shows
 *  as the current hour's forecast. */
export function hourUnderWaySamples(samples: readonly LiveVsArchiveSample[]): LiveVsArchiveSample[] {
  return samples.filter((s) => s.valid === hourUnderWay(s.at));
}

/** 01Z to 12Z, the split the archive's day/night reading used. */
export const isNightUtc = (ms: number): boolean => {
  const h = new Date(ms).getUTCHours();
  return h >= 1 && h <= 12;
};

/** The minute band a request falls in, "20-39" for bands twenty minutes
 *  wide; `width` must divide 60. */
export function minuteBand(atMs: number, width: number): string {
  const m = new Date(atMs).getUTCMinutes();
  const lo = Math.floor(m / width) * width;
  return `${lo}-${lo + width - 1}`;
}

/** Signed differences in knots over one group of samples. */
export interface DiffSummary {
  n: number;
  mean: number | null;
  median: number | null;
  above: number;
  zero: number;
  below: number;
}

/** One group's live-minus-archive, and both against the report where a
 *  report is paired, so the group's own nearness to KPMV is read beside
 *  its nearness to the archive. */
export interface LiveVsArchiveRow {
  key: string;
  liveMinusArchive: DiffSummary & {
    /** Equal to the tenth, and within half a knot. */
    equal: number;
    withinHalf: number;
  };
  liveMinusReport: DiffSummary;
  archiveMinusReport: DiffSummary;
}

const tenth = (x: number): number => Math.round(x * 10) / 10;
const hundredth = (x: number): number => Math.round(x * 100) / 100;

export function summarizeDiffs(diffs: readonly number[]): DiffSummary {
  const n = diffs.length;
  return {
    n,
    mean: n ? hundredth(diffs.reduce((a, b) => a + b, 0) / n) : null,
    median: n ? hundredth(median(diffs) as number) : null,
    above: diffs.filter((d) => d > 0).length,
    zero: diffs.filter((d) => d === 0).length,
    below: diffs.filter((d) => d < 0).length,
  };
}

/**
 * The samples grouped by `keyOf` (a sample it returns null for is left
 * out), in the order the keys are first met, each group summarised.
 * Differences are taken to the tenth, the resolution the API serves.
 */
export function liveVsArchiveRows(
  samples: readonly LiveVsArchiveSample[],
  keyOf: (s: LiveVsArchiveSample) => string | null,
): LiveVsArchiveRow[] {
  const groups = new Map<string, LiveVsArchiveSample[]>();
  for (const s of samples) {
    const k = keyOf(s);
    if (k == null) continue;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return [...groups].map(([key, list]) => {
    const la = list.map((s) => tenth(s.live - s.archive));
    const paired = list.filter((s) => s.obs != null);
    return {
      key,
      liveMinusArchive: {
        ...summarizeDiffs(la),
        equal: la.filter((d) => d === 0).length,
        withinHalf: la.filter((d) => Math.abs(d) <= 0.5).length,
      },
      liveMinusReport: summarizeDiffs(paired.map((s) => tenth(s.live - s.obs!))),
      archiveMinusReport: summarizeDiffs(paired.map((s) => tenth(s.archive - s.obs!))),
    };
  });
}

/**
 * The hour-under-way samples split at the first request in each clock
 * hour whose live value differs from the previous request's for the same
 * hour: a new run arriving (or a server on the other copy), seen from the
 * sample alone without the metadata. Hours with one request, or whose
 * value never changed, go to `unchanged`.
 */
export function splitAtFirstChange(samples: readonly LiveVsArchiveSample[]): {
  before: LiveVsArchiveSample[];
  after: LiveVsArchiveSample[];
  unchanged: LiveVsArchiveSample[];
  hoursChanged: number;
  hoursWithTwo: number;
} {
  const byHour = new Map<number, LiveVsArchiveSample[]>();
  for (const s of hourUnderWaySamples(samples)) byHour.set(s.valid, [...(byHour.get(s.valid) ?? []), s]);
  const before: LiveVsArchiveSample[] = [];
  const after: LiveVsArchiveSample[] = [];
  const unchanged: LiveVsArchiveSample[] = [];
  let hoursChanged = 0;
  let hoursWithTwo = 0;
  for (const list of byHour.values()) {
    list.sort((a, b) => a.at - b.at);
    if (list.length < 2) {
      unchanged.push(...list);
      continue;
    }
    hoursWithTwo += 1;
    const i = list.findIndex((s, k) => k > 0 && tenth(s.live - list[k - 1].live) !== 0);
    if (i < 0) {
      unchanged.push(...list);
      continue;
    }
    hoursChanged += 1;
    before.push(...list.slice(0, i));
    after.push(...list.slice(i));
  }
  return { before, after, unchanged, hoursChanged, hoursWithTwo };
}
