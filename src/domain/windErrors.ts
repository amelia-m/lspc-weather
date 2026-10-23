/**
 * "How far the wind forecasts were from KPMV": the data behind the
 * #wind-errors page, and the figures in the docs drawn from it.
 *
 * Two sets of pairs, each counted by the code that already counts it, so the
 * page and the docs' tables agree:
 * - the NWS gridpoint forecasts the keeper saved hourly, by issuance lead
 *   (`pairInstants`, `windDiffs`; docs/kept-forecasts-vs-kpmv.md);
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
import { windDiffs } from './keptForecasts';
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
 *  difference seen to 2026-10-23 (Open-Meteo's reached +17.3 kt in a gust, NWS −13);
 *  the few direction misses past 100° are counted as beyond the axis. */
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

/** The y gridline step for a chart whose tallest bar is `max`. */
export const yStep = (max: number): number =>
  max <= 10 ? 2 : max <= 25 ? 5 : max <= 60 ? 10 : max <= 150 ? 25 : 50;

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
  id: 'nws-kept' | 'surface-sample';
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

const span = (times: readonly number[]): { first: string | null; last: string | null } =>
  times.length
    ? { first: new Date(Math.min(...times)).toISOString(), last: new Date(Math.max(...times)).toISOString() }
    : { first: null, last: null };

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
