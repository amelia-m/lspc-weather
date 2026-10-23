/**
 * "How far the wind forecasts were from KPMV": the data behind the
 * #wind-errors page, and the figures in the docs drawn from it.
 *
 * Two sets of pairs, each counted by the code that already counts it, so the
 * page and the docs' tables agree:
 * - the NWS gridpoint forecasts the keeper saved hourly, by issuance lead
 *   (`pairInstants`, `windDiffs`; docs/kept-forecasts-vs-kpmv.md);
 * - Open-Meteo's own archive of its 10 m wind, the start of each run and the
 *   forecast made a day earlier, paired as the kept NWS forecasts are
 *   (`omArchiveSection`; docs/surface-wind-sources.md, "Open-Meteo's
 *   archive");
 * - the surface-wind sample's forecasts, read while each KPMV report was the
 *   newest: Open-Meteo's hourly, 15-minute and current 10 m wind, and the NWS
 *   gridpoint hour beside them on the same reports (`pairsVsMetar`;
 *   docs/surface-wind-sources.md).
 *
 * Each pair gives a speed, gust and direction difference, forecast minus
 * reported, binned into histograms. Counts and spreads, never a grade: a
 * histogram centred off zero says which side a forecast fell on here, not
 * that it is wrong, and nothing on the dashboard reads any of it.
 */
import type { InstantPair } from './keptForecasts';
import { reportsByHour, windDiffs } from './keptForecasts';
import { reportNear, type MetarRecord } from './cloudCoverSources';
import { median } from './paritySummary';
import { SITE } from '../config/site';
import { angular, orderedRuns, pairsVsMetar, type ForecastSource, type SurfaceWindRecord } from './surfaceWindSources';

export type WindQuantity = 'speed' | 'gust' | 'dir';

/** A histogram's axis: bins `bin` wide, centred on its multiples, from `lo`
 *  to `hi` inclusive. */
export interface HistSpec {
  quantity: WindQuantity;
  title: string;
  unit: string;
  bin: number;
  lo: number;
  hi: number;
}

/** The three columns of every figure: speed to the knot, the gust only where
 *  KPMV reported one (a METAR gives one only when there is one to report,
 *  the forecasts every hour), direction to ten degrees, only where the report
 *  gave one (not calm, not variable). The axes hold every speed and gust
 *  difference the October sets gave (Open-Meteo's sample reached +17.3 kt in
 *  a gust, NWS −13), and are shared by every row so the charts compare.
 *  Open-Meteo's archive, six months with the summer's storms in it, runs
 *  past them in 0.4 to 1.8% of its speeds and gusts (a gust reported 36 kt
 *  over the forecast at the widest, built 2026-10-23), and those, with the
 *  direction misses past 100°, are counted as beyond the axis. */
export const WIND_COLUMNS: readonly HistSpec[] = [
  { quantity: 'speed', title: 'Wind speed', unit: 'kt', bin: 1, lo: -10, hi: 10 },
  { quantity: 'gust', title: 'Gust, where KPMV reported one', unit: 'kt', bin: 1, lo: -14, hi: 18 },
  { quantity: 'dir', title: 'Direction', unit: '°', bin: 10, lo: -100, hi: 100 },
];

export interface Histogram extends HistSpec {
  n: number;
  /** Rounded to a tenth. Null with no values. */
  median: number | null;
  mean: number | null;
  /** Values in a bin right of zero (forecast above the report) and left of
   *  it, as the bars are drawn: a difference that rounds to the zero bin
   *  (Open-Meteo's −0.4 kt) is counted on neither side. */
  above: number;
  below: number;
  /** Count per bin, from `lo` to `hi`. */
  counts: number[];
  /** Values beyond the axis, either side. */
  outside: number;
}

const r1 = (x: number): number => Math.round(x * 10) / 10;

/** Bins centred on multiples of the width, a halfway value rounded away from
 *  zero on either side, so neither side gains it. */
export function histogram(values: readonly number[], spec: HistSpec): Histogram {
  const nb = Math.round((spec.hi - spec.lo) / spec.bin) + 1;
  const counts = new Array<number>(nb).fill(0);
  let outside = 0;
  let above = 0;
  let below = 0;
  for (const d of values) {
    const v = Math.sign(d) * Math.round(Math.abs(d) / spec.bin) * spec.bin;
    if (v > 0) above += 1;
    else if (v < 0) below += 1;
    const i = Math.round((v - spec.lo) / spec.bin);
    if (i < 0 || i >= nb) outside += 1;
    else counts[i] += 1;
  }
  const med = median(values);
  return {
    ...spec,
    n: values.length,
    median: med == null ? null : r1(med),
    mean: values.length ? r1(values.reduce((a, b) => a + b, 0) / values.length) : null,
    above,
    below,
    counts,
    outside,
  };
}

/** A difference as the charts label it: a plus for above, a minus sign for
 *  below, a dash for none. */
export const signed = (x: number | null): string => (x == null ? '—' : x > 0 ? `+${x}` : x < 0 ? `−${-x}` : '0');

/** The y gridline steps, by the tallest bar they serve up to: at most six
 *  gridlines on any chart to 3,000, so the labels stay apart on a phone
 *  (the Open-Meteo archive's six months put 800 hours in one bar). */
const Y_STEPS: readonly (readonly [number, number])[] = [
  [10, 2],
  [25, 5],
  [60, 10],
  [150, 25],
  [300, 50],
  [600, 100],
  [1500, 250],
];

/** The y gridline step for a chart whose tallest bar is `max`. */
export const yStep = (max: number): number => Y_STEPS.find(([upTo]) => max <= upTo)?.[1] ?? 500;

/** The line printed above each chart, on the page and in the docs. */
export const histogramLine = (h: Histogram): string =>
  `n ${h.n} · median ${signed(h.median)} ${h.unit} · mean ${signed(h.mean)} ${h.unit} · ${h.above} above, ${h.below} below`;

/** A section's dates, in the drop zone's time zone, on the page and in the
 *  docs alike. */
export const spanDay = (iso: string | null): string =>
  iso == null
    ? '—'
    : new Date(iso).toLocaleDateString('en-US', { timeZone: SITE.timeZone, month: 'short', day: 'numeric', year: 'numeric' });

export interface WindErrorRow {
  label: string;
  /** One per WIND_COLUMNS entry, in that order. */
  panels: Histogram[];
}

export interface WindErrorSection {
  id: 'nws-kept' | 'om-archive' | 'surface-sample';
  title: string;
  /** What a bar counts: an hour of the kept forecasts, a report of the sample. */
  unitWord: 'hour' | 'report';
  /** The first and last valid time or report time paired (ISO), or null. */
  first: string | null;
  last: string | null;
  rows: WindErrorRow[];
}

export interface WindErrorsData {
  generatedAt: string;
  sections: WindErrorSection[];
}

type Diffs = Record<WindQuantity, number | null>;

function rowOf(label: string, diffs: readonly Diffs[]): WindErrorRow {
  return {
    label,
    panels: WIND_COLUMNS.map((c) =>
      histogram(
        diffs.map((d) => d[c.quantity]).filter((v): v is number => v != null),
        c,
      ),
    ),
  };
}

/** The first and last of the times. A loop, not Math.min(...times): the
 *  archive section's times grow every week, past what a spread call takes. */
function span(times: readonly number[]): { first: string | null; last: string | null } {
  if (!times.length) return { first: null, last: null };
  let lo = times[0];
  let hi = times[0];
  for (const t of times) {
    if (t < lo) lo = t;
    if (t > hi) hi = t;
  }
  return { first: new Date(lo).toISOString(), last: new Date(hi).toISOString() };
}

/** The kept NWS forecasts, a row per issuance lead (the rows `pairInstants`
 *  was run for, in order). */
export function nwsKeptSection(rows: readonly { label: string; pairs: readonly InstantPair[] }[]): WindErrorSection {
  return {
    id: 'nws-kept',
    title: 'NWS forecasts kept hourly, against KPMV',
    unitWord: 'hour',
    ...span(rows.flatMap((r) => r.pairs.map((p) => p.t))),
    rows: rows.map((r) => rowOf(r.label, r.pairs.map((p) => windDiffs(p)))),
  };
}

/** Open-Meteo's two archives, as scripts/cloudCoverFetch.py (PARTS=omwind)
 *  names them in its records: the Historical Forecast API, the first hours
 *  of each model run stitched together, and the Previous Runs API's
 *  `_previous_day1`, "the value that was predicted 24 hours before valid
 *  time" (open-meteo.com, read 2026-10-10). */
export type OmArchiveRun = 'historical' | 'previous_day1';

/** One hour of Open-Meteo's archived 10 m wind at the drop zone's point,
 *  default model, in knots to the tenth (`wind_speed_unit=kn`, as the
 *  dashboard asks). `valid` as served, `YYYY-MM-DDTHH:mmZ`. */
export interface OmWindRecord {
  src: 'om-wind';
  run: OmArchiveRun;
  valid: string;
  spd: number | null;
  gust: number | null;
  dir: number | null;
  grid?: string;
  /** Set only when the fetch was given SITES; the page reads the drop
   *  zone's, which carry none. */
  site?: string;
}

/** The archive's records from JSON lines, skipping blank lines, other
 *  records and other sites' points. */
export function parseOmWindLines(text: string): OmWindRecord[] {
  const out: OmWindRecord[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as OmWindRecord;
    if (r.src === 'om-wind' && r.site == null) out.push(r);
  }
  return out;
}

/** The archive's rows, as the page names them: the start of run first, its
 *  best case, then a day earlier. The card's hours ahead come from runs in
 *  between, as docs/cloud-cover-sources.md says of the same two archives. */
export const OM_ARCHIVE_ROWS: readonly { run: OmArchiveRun; label: string }[] = [
  { run: 'historical', label: 'start of run' },
  { run: 'previous_day1', label: 'a day earlier' },
];

/** Open-Meteo's archived 10 m wind against KPMV, a row per run, paired and
 *  read as the kept NWS forecasts are: the report within REPORT_WINDOW_MIN
 *  of each hour (`reportNear`), and `windDiffs`, so the forecast is rounded
 *  to whole knots as a METAR reports and the two sections read alike. An
 *  hour fetched twice (the weekly windows overlap by a day) counts once,
 *  each field the later file's where it has one: a refetch that left a
 *  field null does not take away a value an earlier fetch had. */
export function omArchiveSection(records: readonly OmWindRecord[], metars: readonly MetarRecord[]): WindErrorSection {
  const byHour = reportsByHour(metars);
  const latest = new Map<string, OmWindRecord>();
  for (const r of records) {
    const key = `${r.run}|${Date.parse(r.valid)}`;
    const had = latest.get(key);
    latest.set(key, had ? { ...r, spd: r.spd ?? had.spd, gust: r.gust ?? had.gust, dir: r.dir ?? had.dir } : r);
  }
  const times: number[] = [];
  const rows = OM_ARCHIVE_ROWS.map(({ run, label }) => {
    const diffs: Diffs[] = [];
    for (const r of latest.values()) {
      if (r.run !== run) continue;
      const t = Date.parse(r.valid);
      const obs = reportNear(byHour.get(t) ?? [], t);
      if (!obs) continue;
      const fc: InstantPair['fc'] = {};
      if (r.spd != null) fc.windSpeed = r.spd;
      if (r.gust != null) fc.windGust = r.gust;
      if (r.dir != null) fc.windDirection = r.dir;
      const d = windDiffs({ fc, obs });
      if (d.speed == null && d.gust == null && d.dir == null) continue;
      times.push(t);
      diffs.push({ speed: d.speed, gust: d.gust, dir: d.dir });
    }
    return rowOf(label, diffs);
  });
  return {
    id: 'om-archive',
    title: 'Open-Meteo’s archived forecasts, against KPMV',
    unitWord: 'hour',
    ...span(times),
    rows,
  };
}

/** The surface-wind sample's sources, as the page names them. Open-Meteo's
 *  three forms first, the NWS hour on the same reports last, for reference. */
export const SAMPLE_ROWS: readonly { source: ForecastSource; label: string }[] = [
  { source: 'omHourly', label: 'Open-Meteo hourly' },
  { source: 'om15', label: 'Open-Meteo 15-minute' },
  { source: 'omCurrent', label: 'Open-Meteo current' },
  { source: 'nws', label: 'NWS hour, same reports' },
];

/** The surface-wind sample's forecasts against each report, as its summary
 *  pairs them (`orderedRuns`, `pairsVsMetar`). Kept to the tenth, as the
 *  summary keeps them, for every row: Open-Meteo serves tenths of a knot and
 *  the sampler's NWS hour is converted from km/h; binned to the knot, so a
 *  tenth either side of zero sits in the zero bar. Direction whole degrees. */
export function surfaceSampleSection(records: readonly SurfaceWindRecord[]): WindErrorSection {
  const runs = orderedRuns(records);
  const times: number[] = [];
  const rows = SAMPLE_ROWS.map(({ source, label }) => {
    const { pairs } = pairsVsMetar(runs, source);
    times.push(...pairs.map((p) => Date.parse(p.obsAt)));
    return rowOf(
      label,
      pairs.map(({ fc, obs }) => ({
        speed: fc.spd != null && obs.spd != null ? r1(fc.spd - obs.spd) : null,
        gust: fc.gust != null && obs.gust != null ? r1(fc.gust - obs.gust) : null,
        dir: fc.dir != null && obs.dir != null ? angular(fc.dir, obs.dir) : null,
      })),
    );
  });
  return { id: 'surface-sample', title: 'The surface-wind sample, against KPMV', unitWord: 'report', ...span(times), rows };
}

/**
 * What a rebuilt file would hold less of than the published one: a section,
 * row or chart gone, a chart with fewer pairs, or a section starting later
 * or ending earlier.
 * The weekly refresh (ceiling-data-refresh.yml) commits nothing when this
 * names anything, as it does for the ceiling page's file
 * (ceilingRefresh.ts's `shrinkage`): the kept snapshots and the reports
 * only grow, so fewer pairs means an input went missing, not that the
 * forecasts changed. Empty when the rebuild holds at least as much.
 */
export function windErrorsShrinkage(published: WindErrorsData, next: WindErrorsData): string[] {
  const out: string[] = [];
  for (const p of published.sections) {
    const n = next.sections.find((s) => s.id === p.id);
    if (n == null) {
      out.push(`section ${p.id} is gone`);
      continue;
    }
    if (p.last != null && (n.last == null || Date.parse(n.last) < Date.parse(p.last))) {
      out.push(`${p.id}: ends ${n.last ?? 'nowhere'}, published ${p.last}`);
    }
    // The start too: a week's new pairs can outnumber a lost first week, and
    // then every count still grows.
    if (p.first != null && (n.first == null || Date.parse(n.first) > Date.parse(p.first))) {
      out.push(`${p.id}: starts ${n.first ?? 'nowhere'}, published ${p.first}`);
    }
    for (const row of p.rows) {
      const nr = n.rows.find((r) => r.label === row.label);
      if (nr == null) {
        out.push(`${p.id}: row "${row.label}" is gone`);
        continue;
      }
      for (const h of row.panels) {
        const nh = nr.panels.find((x) => x.quantity === h.quantity);
        if (nh == null) out.push(`${p.id}: "${row.label}" ${h.quantity} is gone`);
        else if (nh.n < h.n) out.push(`${p.id}: "${row.label}" ${h.quantity} ${nh.n} pairs, published ${h.n}`);
      }
    }
  }
  return out;
}
