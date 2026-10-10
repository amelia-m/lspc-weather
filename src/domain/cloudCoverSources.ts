/**
 * Forecast cloud cover against what KPMV reported: the arithmetic behind
 * docs/cloud-cover-sources.md.
 *
 * The Ceiling & sky card shows two forecasts of cloud cover for each coming
 * hour, the NWS gridpoint's `skyCover` and Open-Meteo's `cloud_cover`, both a
 * percentage of the sky, and the METAR's layers for now. The question left
 * open on 2026-10-08 (docs/open-questions.md) was whether the two forecasts
 * agree with each other, and with the METAR, often enough to be worth both.
 * scripts/cloudCoverFetch.py gathers past records of all three;
 * scripts/cloudCoverSummary.ts reads them through this file.
 *
 * A METAR gives each layer's amount as a range of eighths, the "summation
 * amount" up to and including that layer (AC 00-45H Chg 2, Table 3-3, read
 * 2026-10-10 in the PDF at faa.gov): FEW 1/8 to 2/8, any amount under 1/8
 * also reported as FEW; SCT 3/8 to 4/8; BKN 5/8 to 7/8; OVC and VV 8/8; CLR
 * at an automated station "no layers ... at or below 12,000 ft". So the
 * report's cover is its highest-ranked layer's range, in percent, and a
 * forecast percentage either falls inside that range or misses it by so many
 * points. That is the whole comparison: counts and spreads, never a grade
 * (CLAUDE.md, the governing rule). A forecast of 0% under FEW counts as
 * inside, because FEW's range starts at "less than 1/8". One thing the
 * numbers cannot allow for, and the doc states: CLR says nothing above
 * 12,000 ft, where a forecast's total includes high cloud.
 *
 * Pure: records in, summary out. Every time is in a record.
 */
import type { SkyLayer } from './types';
import { CEILING_COVERS, NO_CLOUD_COVERS, parseSkyGroups } from './normalize';
import { median, percentile, spreadOf, type Spread } from './paritySummary';

/** One NDFD sky-cover value at the drop zone's grid point (the NWS gridpoint
 *  forecast). `issued` is the archive file's time, `valid` the hour it is
 *  for; both ISO. */
export interface NdfdRecord {
  src: 'ndfd';
  key: string;
  issued: string;
  ref: string;
  valid: string;
  sky: number;
  gridKm: number;
}

/** One hour of Open-Meteo's cloud cover: `historical` is its Historical
 *  Forecast API (the start of each model run, stitched), `previous_day1` the
 *  Previous Runs API's forecast made a day before. Percent, null where none. */
export interface OpenMeteoCloudRecord {
  src: 'om';
  run: 'historical' | 'previous_day1';
  valid: string;
  total: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  grid: string;
}

export interface MetarRecord {
  src: 'metar';
  obsAt: string;
  raw: string;
}

export type CloudCoverRecord = NdfdRecord | OpenMeteoCloudRecord | MetarRecord;

/** A report's cover, by its highest-ranked layer. VV is kept apart from OVC
 *  because it is an obscuration, not a cloud layer, though both are 8/8. */
export type ObservedCategory = 'CLR' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV';
export const OBSERVED_CATEGORIES: readonly ObservedCategory[] = ['CLR', 'FEW', 'SCT', 'BKN', 'OVC', 'VV'];

export interface ObservedCover {
  category: ObservedCategory;
  /** The summation amount's range, in percent of the sky (eighths × 12.5). */
  loPct: number;
  hiPct: number;
}

/** Table 3-3's summation amounts, in eighths. FEW starts at 0 because any
 *  amount under 1/8 is reported as FEW. */
const EIGHTHS: Record<ObservedCategory, [number, number]> = {
  CLR: [0, 0],
  FEW: [0, 2],
  SCT: [3, 4],
  BKN: [5, 7],
  OVC: [8, 8],
  VV: [8, 8],
};

/** BKN's lowest summation amount, in eighths: the least cover a ceiling
 *  layer can have. */
export const CEILING_EIGHTHS = EIGHTHS.BKN[0];

/** SCT's highest summation amount, in percent. */
const SCT_HI_PCT = EIGHTHS.SCT[1] * 12.5;

const RANK: Record<ObservedCategory, number> = { CLR: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4, VV: 5 };

const categoryOf = (l: SkyLayer): ObservedCategory =>
  NO_CLOUD_COVERS.includes(l.cover) ? 'CLR' : (l.cover as Exclude<ObservedCategory, 'CLR'>);

/** The report's cover from its layers, or null when it has no sky group
 *  (not reported, which is not clear). */
export function observedCover(layers: readonly SkyLayer[]): ObservedCover | null {
  if (layers.length === 0) return null;
  const category = layers.map(categoryOf).reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
  const [lo, hi] = EIGHTHS[category];
  return { category, loPct: lo * 12.5, hiPct: hi * 12.5 };
}

/** How far a forecast percentage sits from the observed range: 0 inside it,
 *  negative below it, positive above. */
export function gapToRange(forecastPct: number, obs: ObservedCover): number {
  if (forecastPct < obs.loPct) return forecastPct - obs.loPct;
  if (forecastPct > obs.hiPct) return forecastPct - obs.hiPct;
  return 0;
}

/** KPMV reports at :15, :35 and :55; the forecasts are for the top of the
 *  hour. The report counts for an hour when it is within this many minutes
 *  of it, which takes the :55 and any special near the hour. */
export const REPORT_WINDOW_MIN = 10;

const MS_H = 3_600_000;

/** The report nearest `t`, within the window, or null. `reports` sorted by
 *  time. Ties go to the earlier report, the one a reader at `t` had. */
export function reportNear<T extends { t: number }>(reports: readonly T[], t: number): T | null {
  let best: T | null = null;
  for (const r of reports) {
    const d = Math.abs(r.t - t);
    if (d > REPORT_WINDOW_MIN * 60_000) continue;
    if (best == null || d < Math.abs(best.t - t)) best = r;
  }
  return best;
}

/** One forecast's percentages against the observed cover at the same hours. */
export interface VsObserved {
  source: string;
  /** Hours compared: a forecast value and a report with a sky group. */
  n: number;
  inside: number;
  below: number;
  above: number;
  /** Signed gap to the observed range (gapToRange), all hours. */
  gap: Spread | null;
  /** Lead, hours from the forecast's issue to the hour it is for, where
   *  known. */
  leadH: { min: number; max: number } | null;
  byObserved: Record<ObservedCategory, CategoryRow>;
  /** Hours by whether KPMV reported a ceiling (BKN, OVC or VV: AC 00-45H,
   *  "the lowest layer aloft reported as broken or overcast", or the
   *  vertical visibility) and whether the forecast was at or above 5/8, the
   *  least a broken layer's summation amount can be. */
  ceiling: { bothYes: number; reportedOnly: number; forecastOnly: number; neither: number };
  /** SCT hours with the forecast at or below 4/8, i.e. inside 0 to 50%: the
   *  SCT range for a station that reports no FEW, so that a SCT there also
   *  stands for amounts under 3/8 (KPMV, docs/cloud-cover-sources.md). */
  sctAtOrBelowHalf: number;
  /** Hours the forecast was exactly 0% or 100%. */
  noneOrAll: number;
}

export interface CategoryRow {
  n: number;
  inside: number;
  /** The forecast's median and 10th/90th percentiles over these hours. */
  median: number | null;
  p10: number | null;
  p90: number | null;
  /** Hours by forecast percentage: 0–9, 10–19, … 90–100. */
  deciles: number[];
}

export interface CloudCoverSummary {
  firstHour: string | null;
  lastHour: string | null;
  reports: number;
  /** Top-of-hour times with a report in the window, and of those how many
   *  carried no sky group. */
  hoursWithReport: number;
  hoursNoSkyGroup: number;
  observed: Record<ObservedCategory, number>;
  vs: VsObserved[];
  /** NWS (latest issuance) minus Open-Meteo (start of run), same hours. */
  nwsVsOpenMeteo: Spread | null;
  /** For the same hours: both inside the observed range, one, or neither. */
  bothInside: { both: number; nwsOnly: number; omOnly: number; neither: number };
  /** Open-Meteo's high-cloud share on hours KPMV reported CLR: the part of a
   *  total no ceilometer below 12,000 ft could see. */
  omHighWhenClear: { n: number; median: number | null; p90: number | null };
}

const emptyRows = (): Record<ObservedCategory, CategoryRow> =>
  Object.fromEntries(
    OBSERVED_CATEGORIES.map((c) => [c, { n: 0, inside: 0, median: null, p10: null, p90: null, deciles: Array(10).fill(0) }]),
  ) as Record<ObservedCategory, CategoryRow>;

interface Pair {
  pct: number;
  obs: ObservedCover;
  leadH: number | null;
}

function vsObserved(source: string, pairs: readonly Pair[]): VsObserved {
  const rows = emptyRows();
  const byCat = new Map<ObservedCategory, number[]>();
  let inside = 0;
  let below = 0;
  let above = 0;
  const ceiling = { bothYes: 0, reportedOnly: 0, forecastOnly: 0, neither: 0 };
  let sctAtOrBelowHalf = 0;
  let noneOrAll = 0;
  const gaps: number[] = [];
  const leads = pairs.map((p) => p.leadH).filter((l): l is number => l != null);
  for (const p of pairs) {
    const g = gapToRange(p.pct, p.obs);
    gaps.push(g);
    if (g === 0) inside++;
    else if (g < 0) below++;
    else above++;
    if (p.obs.category === 'SCT' && p.pct <= SCT_HI_PCT) sctAtOrBelowHalf++;
    if (p.pct === 0 || p.pct === 100) noneOrAll++;
    const reported = (CEILING_COVERS as readonly string[]).includes(p.obs.category);
    const forecast = p.pct >= CEILING_EIGHTHS * 12.5;
    if (reported && forecast) ceiling.bothYes++;
    else if (reported) ceiling.reportedOnly++;
    else if (forecast) ceiling.forecastOnly++;
    else ceiling.neither++;
    const row = rows[p.obs.category];
    row.n++;
    if (g === 0) row.inside++;
    row.deciles[Math.min(9, Math.floor(p.pct / 10))]++;
    const xs = byCat.get(p.obs.category);
    if (xs) xs.push(p.pct);
    else byCat.set(p.obs.category, [p.pct]);
  }
  for (const [c, xs] of byCat) {
    rows[c].median = median(xs);
    rows[c].p10 = percentile(xs, 0.1);
    rows[c].p90 = percentile(xs, 0.9);
  }
  return {
    source,
    n: pairs.length,
    inside,
    below,
    above,
    gap: spreadOf(gaps),
    leadH:
      leads.length > 0
        ? { min: Math.round(Math.min(...leads) * 10) / 10, max: Math.round(Math.max(...leads) * 10) / 10 }
        : null,
    byObserved: rows,
    ceiling,
    sctAtOrBelowHalf,
    noneOrAll,
  };
}

/** The NWS forecasts issued before each hour, newest first. */
function ndfdByHour(records: readonly NdfdRecord[]): Map<number, NdfdRecord[]> {
  const by = new Map<number, NdfdRecord[]>();
  for (const r of records) {
    const t = Date.parse(r.valid);
    if (Date.parse(r.issued) >= t) continue;
    const list = by.get(t);
    if (list) list.push(r);
    else by.set(t, [r]);
  }
  for (const rs of by.values()) rs.sort((a, b) => Date.parse(b.issued) - Date.parse(a.issued));
  return by;
}

/** Which NWS issuances the summary reads for an hour: the newest one issued
 *  at least `minLeadH` hours before it. Chosen by time, not by position in
 *  the list, so a missing file lengthens a row's lead instead of moving an
 *  older issuance into a newer row. */
export const NWS_ISSUANCES: readonly { minLeadH: number; label: string }[] = [
  { minLeadH: 0, label: 'NWS, latest issuance' },
  { minLeadH: 6, label: 'NWS, 6 h or more ahead' },
  { minLeadH: 24, label: 'NWS, 24 h or more ahead' },
];

/** The Open-Meteo rows, named once so the pairing and the order agree. */
export const OM_ROWS = {
  startTotal: 'Open-Meteo, start of run (total)',
  dayBeforeTotal: 'Open-Meteo, a day earlier (total)',
  startLow: 'Open-Meteo, start of run (low band)',
} as const;

export function summarizeCloudCover(records: readonly CloudCoverRecord[]): CloudCoverSummary {
  const reports = records
    .filter((r): r is MetarRecord => r.src === 'metar')
    .map((r) => ({ t: Date.parse(r.obsAt), obs: observedCover(parseSkyGroups(r.raw)) }))
    .filter((r) => Number.isFinite(r.t))
    .sort((a, b) => a.t - b.t);
  const ndfd = ndfdByHour(records.filter((r): r is NdfdRecord => r.src === 'ndfd'));
  const om = new Map<string, OpenMeteoCloudRecord>();
  for (const r of records) if (r.src === 'om') om.set(`${r.run}|${Date.parse(r.valid)}`, r);

  // Every top of the hour any forecast covers, in order.
  const hours = [
    ...new Set([...ndfd.keys(), ...[...om.values()].map((r) => Date.parse(r.valid))]),
  ]
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);


  const observed = Object.fromEntries(OBSERVED_CATEGORIES.map((c) => [c, 0])) as Record<ObservedCategory, number>;
  const pairs = new Map<string, Pair[]>();
  const add = (source: string, p: Pair): void => {
    const list = pairs.get(source);
    if (list) list.push(p);
    else pairs.set(source, [p]);
  };
  let firstHour: number | null = null;
  let lastHour: number | null = null;
  let hoursWithReport = 0;
  let hoursNoSkyGroup = 0;
  const nwsOm: number[] = [];
  const bothInside = { both: 0, nwsOnly: 0, omOnly: 0, neither: 0 };
  const highWhenClear: number[] = [];

  for (const t of hours) {
    const rep = reportNear(reports, t);
    if (rep == null) continue;
    firstHour ??= t;
    lastHour = t;
    hoursWithReport++;
    if (rep.obs == null) {
      hoursNoSkyGroup++;
      continue;
    }
    const obs = rep.obs;
    observed[obs.category]++;
    const nws = ndfd.get(t) ?? [];
    for (const { minLeadH, label } of NWS_ISSUANCES) {
      const r = nws.find((x) => t - Date.parse(x.issued) >= minLeadH * MS_H);
      if (r) add(label, { pct: r.sky, obs, leadH: (t - Date.parse(r.issued)) / MS_H });
    }
    const start = om.get(`historical|${t}`);
    if (start?.total != null) add(OM_ROWS.startTotal, { pct: start.total, obs, leadH: null });
    if (start?.low != null) add(OM_ROWS.startLow, { pct: start.low, obs, leadH: null });
    const dayBefore = om.get(`previous_day1|${t}`);
    if (dayBefore?.total != null) add(OM_ROWS.dayBeforeTotal, { pct: dayBefore.total, obs, leadH: null });
    if (obs.category === 'CLR' && start?.high != null) highWhenClear.push(start.high);

    const latest = nws[0];
    if (latest && start?.total != null) {
      nwsOm.push(latest.sky - start.total);
      const a = gapToRange(latest.sky, obs) === 0;
      const b = gapToRange(start.total, obs) === 0;
      if (a && b) bothInside.both++;
      else if (a) bothInside.nwsOnly++;
      else if (b) bothInside.omOnly++;
      else bothInside.neither++;
    }
  }

  const order = [...NWS_ISSUANCES.map((i) => i.label), OM_ROWS.startTotal, OM_ROWS.dayBeforeTotal, OM_ROWS.startLow];
  return {
    firstHour: firstHour == null ? null : new Date(firstHour).toISOString(),
    lastHour: lastHour == null ? null : new Date(lastHour).toISOString(),
    reports: reports.length,
    hoursWithReport,
    hoursNoSkyGroup,
    observed,
    vs: order.filter((s) => pairs.has(s)).map((s) => vsObserved(s, pairs.get(s) as Pair[])),
    nwsVsOpenMeteo: spreadOf(nwsOm),
    bothInside,
    omHighWhenClear: { n: highWhenClear.length, median: median(highWhenClear), p90: percentile(highWhenClear, 0.9) },
  };
}

/** The fetch script's output, one JSON object per line. Lines that do not
 *  parse, or carry no known `src`, are skipped. */
export function parseCloudCoverLines(text: string): CloudCoverRecord[] {
  const out: CloudCoverRecord[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const r = JSON.parse(line) as CloudCoverRecord;
      if (r.src === 'ndfd' || r.src === 'om' || r.src === 'metar') out.push(r);
    } catch {
      // Not a record.
    }
  }
  return out;
}
