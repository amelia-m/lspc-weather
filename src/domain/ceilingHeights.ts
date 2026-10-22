/**
 * Forecast ceiling heights against what KPMV reported: the arithmetic behind
 * docs/ceiling-heights.md.
 *
 * The cloud-cover comparison (cloudCoverSources.ts) left height out: it asked
 * how much of the sky each forecast covered, not how low. The Ceiling & sky
 * card shows the NWS gridpoint's `ceilingHeight` for each coming hour, which
 * is NDFD's ceiling grid (scripts/cloudCoverFetch.py, part `cig`, says how
 * that was checked). Open-Meteo has no ceiling or cloud-base variable at the
 * drop zone (its `cloud_base` came back null, unit "undefined", on
 * 2026-10-13); its low band (up to 3 km) is the nearest it has to a height,
 * so it is read by reported ceiling band instead.
 *
 * A ceiling is "the lowest layer aloft reported as broken or overcast", or
 * the vertical visibility (AC 00-45H; normalize.ts's CEILING_COVERS). Heights
 * are ft AGL on both sides. Both are held at or below 12,000 ft (`AUTOMATED_TOP_FT`):
 * KPMV, an AWOS, reports nothing higher, so a forecast ceiling above that is
 * one the station could not have reported and counts as none. The bands are
 * the FAA flight-category ceiling limits (flightCategory.ts, AIM 7-1-7):
 * under 500, 500 to under 1,000, 1,000 to 3,000, above 3,000 ft. Counts and
 * spreads, never a grade (CLAUDE.md, the governing rule).
 *
 * Pure: records in, summary out. Every time is in a record.
 */
import type { SkyLayer } from './types';
import { CEILING_COVERS, parseSkyGroups, parseValidTime } from './normalize';
import { ceilingCategory, type FlightCategory } from './flightCategory';
import {
  CEILING_EIGHTHS,
  NWS_ISSUANCES,
  reportNear,
  type MetarRecord,
  type OpenMeteoCloudRecord,
} from './cloudCoverSources';
import { AUTOMATED_TOP_FT } from './stationPairs';
import { median, percentile } from './paritySummary';
import { mToFt } from './units';

/** One forecast ceiling for one hour from one issuance: what
 *  summarizeCeilings reads. `cig` is metres AGL, with NDFD's two codes:
 *  NDFD_NO_CEILING and NDFD_MISSING. */
export interface CeilingForecast {
  issued: string;
  valid: string;
  cig: number;
  site?: string;
}

/** One NDFD ceiling value at a grid point, `cig` as the grid gives it. */
export interface NdfdCeilingRecord extends CeilingForecast {
  src: 'ndfd-cig';
  key: string;
  ref: string;
  gridKm: number;
}

const MS_H = 3_600_000;

/** One gridpoint property as the API serves it and the keeper keeps it. */
export type KeptSeries = { uom?: string; values: { validTime: string; value: number | null }[] } | null;

/** The kept gridpoint properties read here, in chances.ts and in
 *  keptForecasts.ts. */
export interface KeptProperties {
  ceilingHeight?: KeptSeries;
  probabilityOfPrecipitation?: KeptSeries;
  probabilityOfThunder?: KeptSeries;
  windSpeed?: KeptSeries;
  windGust?: KeptSeries;
  windDirection?: KeptSeries;
  temperature?: KeptSeries;
  visibility?: KeptSeries;
  quantitativePrecipitation?: KeptSeries;
}

/** The part of a kept snapshot (scripts/forecastKeep.ts, the
 *  `forecast-archive` branch) this reads: the
 *  gridpoint as the card fetched it, or `{ error }` when that fetch
 *  failed. The keeper copies a property the API left out as null. */
export interface KeptGridpointSnapshot {
  at: string;
  nwsGridpoint:
    | {
        url: string;
        updateTime?: string;
        properties: KeptProperties;
      }
    | { error: string }
    | null;
}

/**
 * One property of a kept snapshot, hour by hour, issued at the gridpoint's
 * `updateTime`: the hour the forecast was made, as an NDFD file's issue
 * time is, so the lead reads alike in both. The API runs equal hours
 * together (`P2DT21H` at 0% rain chance for 69 hours, read 2026-10-17), so
 * a period gives its value to each of its hours. Hours before `updateTime`
 * are in the snapshot too; no summary picks an issuance made after its
 * hour. Null when the fetch failed or the property is missing.
 */
export function keptHours(
  snap: KeptGridpointSnapshot,
  key: keyof KeptProperties,
): { issued: string; uom: string | undefined; hours: { valid: string; value: number | null }[] } | null {
  const gp = snap.nwsGridpoint;
  if (!gp || 'error' in gp || !gp.updateTime) return null;
  const prop = gp.properties[key];
  if (!prop) return null;
  const hours: { valid: string; value: number | null }[] = [];
  for (const { validTime, value } of prop.values) {
    const span = parseValidTime(validTime);
    if (!span) continue;
    for (let h = 0; h < span.hours; h++) {
      hours.push({ valid: new Date(span.start + h * MS_H).toISOString().replace(/:00\.000Z$/, 'Z'), value });
    }
  }
  return { issued: gp.updateTime, uom: prop.uom, hours };
}

/**
 * The ceiling forecast in a kept snapshot, one record per hour (keptHours).
 * The API serves no ceiling as null (its NDFD value is NDFD_NO_CEILING,
 * read 2026-10-13), so null becomes that code.
 */
export function keptCeilingRecords(snap: KeptGridpointSnapshot, site: string): CeilingForecast[] {
  const kept = keptHours(snap, 'ceilingHeight');
  if (!kept) return [];
  const uom = kept.uom ?? 'wmoUnit:m';
  const toM = uom === 'wmoUnit:m' ? 1 : uom === 'wmoUnit:ft' ? 0.3048 : null;
  if (toM == null) throw new Error(`keptCeilingRecords: ceilingHeight in ${uom}`);
  return kept.hours.map(({ valid, value }) => ({
    issued: kept.issued,
    valid,
    cig: value == null ? NDFD_NO_CEILING : value * toM,
    site,
  }));
}

/** The grid's "no ceiling", which api.weather.gov serves as null. */
export const NDFD_NO_CEILING = -29;
/** The grid's missing value. */
export const NDFD_MISSING = 9999;

/** A ceiling in ft AGL, or 'none': no ceiling at or below `topFt`. */
export type Ceiling = number | 'none';

/** The forecast's ceiling, or null where the grid has no value. The grid
 *  stores whole metres, so a 500 ft ceiling arrives as 152 m, 498.7 ft,
 *  and unrounded it would fall in the band below 500 (api.weather.gov
 *  serves the same value as 152.4 m). Rounded to 10 ft, every whole hundred
 *  comes back whole; a METAR reports in hundreds. */
export function forecastCeiling(m: number, topFt = AUTOMATED_TOP_FT): Ceiling | null {
  if (!Number.isFinite(m) || m === NDFD_MISSING) return null;
  if (m === NDFD_NO_CEILING) return 'none';
  const ft = Math.round(mToFt(m) / 10) * 10;
  return ft > topFt ? 'none' : ft;
}

/** The report's ceiling: its lowest BKN, OVC or VV base, if at or below
 *  `topFt`, else 'none'. A METAR lists layers from the lowest up, so that is
 *  the first ceiling layer. Null when the report has no sky group (not
 *  reported, which is not clear), or when that first ceiling layer has no
 *  height (`BKN///`): then the ceiling is unknown (normalize.ts's
 *  ceilingState). A heightless layer above a measured one leaves the
 *  ceiling known. */
export function reportedCeiling(layers: readonly SkyLayer[], topFt = AUTOMATED_TOP_FT): Ceiling | null {
  if (layers.length === 0) return null;
  const first = layers.find((l) => CEILING_COVERS.includes(l.cover));
  if (first == null) return 'none';
  if (first.baseFtAgl == null) return null;
  return first.baseFtAgl <= topFt ? first.baseFtAgl : 'none';
}

export type CeilingBand = FlightCategory | 'none';
/** Lowest first, then no ceiling. */
export const CEILING_BANDS: readonly CeilingBand[] = ['LIFR', 'IFR', 'MVFR', 'VFR', 'none'];
/** The bands a ceiling height falls in, lowest first. */
export const FLIGHT_BANDS = ['LIFR', 'IFR', 'MVFR', 'VFR'] as const satisfies readonly FlightCategory[];

/** A ceiling's flight-category band (VFR here is above 3,000 ft up to the
 *  12,000 ft top), or 'none'. */
export const bandOf = (c: Ceiling): CeilingBand => (c === 'none' ? 'none' : ceilingCategory(c));

interface CeilingReport {
  t: number;
  ceiling: Ceiling | null;
}

function ceilingReports(metars: readonly MetarRecord[], topFt: number): CeilingReport[] {
  return metars
    .map((r) => ({ t: Date.parse(r.obsAt), ceiling: reportedCeiling(parseSkyGroups(r.raw), topFt) }))
    .filter((r) => Number.isFinite(r.t))
    .sort((a, b) => a.t - b.t);
}

/** How far past a source's last issuance its records still count, beyond
 *  each row's own lead. Past that, an hour is outside the window the
 *  forecasts were gathered for, and its "newest" issuance is only the one
 *  the fetch ended on: reports fetched for a later window would be scored
 *  against it a day or more ahead in the "latest issuance" row. Six hours
 *  is the spacing of the NDFD archive as read (four issuances a day) and
 *  the longest gap between the keeper's runs seen to 2026-10-15. */
export const END_REACH_H = 6;

/** One NWS issuance row against the reports. */
export interface CeilingRow {
  label: string;
  minLeadH: number;
  /** Hours with a report (and a known ceiling or none) and a forecast. */
  hours: number;
  /** Hours ahead the chosen issuances were, least and most. */
  leadH: { min: number; max: number } | null;
  call: { both: number; forecastOnly: number; reportedOnly: number; neither: number };
  /** Forecast minus reported, ft, on hours both had a ceiling: the signed
   *  median and 10th and 90th percentiles, and the median of the size. */
  diffFt: { n: number; median: number; p10: number; p90: number; medianAbs: number } | null;
  /** The same difference by the reported ceiling's band, on hours both
   *  had a ceiling. Grouped by what was reported, an unbiased but noisy
   *  forecast still reads high in the lowest band and low in the highest
   *  (a reported 300 ft ceiling can be missed upward by thousands of feet
   *  but downward by 200 at most), so read it beside `diffByForecastBand`. */
  diffByBand: Record<FlightCategory, { n: number; median: number | null }>;
  /** The same difference by the forecast ceiling's band: what a reader of
   *  the card's figure would have found. */
  diffByForecastBand: Record<FlightCategory, { n: number; median: number | null }>;
  /** `bands[reported][forecast]`: hours by each side's band. */
  bands: Record<CeilingBand, Record<CeilingBand, number>>;
  /** Hours both sides fell in the same band, 'none' included. */
  sameBand: number;
  /** Every hour counted, in time order: the hour (ISO, UTC), when the
   *  issuance read for it was issued (as the record wrote it), the forecast
   *  ceiling and the reported one, each ft or 'none'. What the
   *  distributions are read from, and how two sources are matched hour for
   *  hour. */
  pairs: { valid: string; issued: string; forecast: Ceiling; reported: Ceiling }[];
}

const emptyBands = (): CeilingRow['bands'] =>
  Object.fromEntries(
    CEILING_BANDS.map((a) => [a, Object.fromEntries(CEILING_BANDS.map((b) => [b, 0]))]),
  ) as CeilingRow['bands'];

const round0 = (x: number): number => Math.round(x);

const mediansOf = (d: Record<FlightCategory, DiffDistribution>): CeilingRow['diffByBand'] =>
  Object.fromEntries(FLIGHT_BANDS.map((b) => [b, { n: d[b].n, median: d[b].diffFt?.[2] ?? null }])) as CeilingRow['diffByBand'];

/**
 * Forecast records by the hour they are for, newest issuance first, and
 * the latest issue time of all: what summarizeCeilings and
 * summarizeChances pick each hour's issuance from. An issuance made after
 * its hour is never picked: every row asks for one at least 0 h before it.
 */
export function byValidHour<T extends { issued: string; valid: string }>(
  forecasts: readonly T[],
): { byHour: Map<number, T[]>; lastIssued: number } {
  // Each issue time parsed once: an archive holds hundreds of thousands.
  const issuedAt = new Map<T, number>(forecasts.map((r) => [r, Date.parse(r.issued)]));
  const byHour = new Map<number, T[]>();
  let lastIssued = -Infinity;
  for (const r of forecasts) {
    lastIssued = Math.max(lastIssued, issuedAt.get(r)!);
    const t = Date.parse(r.valid);
    const list = byHour.get(t);
    if (list) list.push(r);
    else byHour.set(t, [r]);
  }
  for (const rs of byHour.values()) rs.sort((a, b) => issuedAt.get(b)! - issuedAt.get(a)!);
  return { byHour, lastIssued };
}

/** Whether hour `t` is past the end of what was gathered, for a row
 *  needing an issuance `minLeadH` before it: see END_REACH_H. */
export const pastReach = (t: number, minLeadH: number, lastIssued: number, endReachH: number): boolean =>
  t - minLeadH * MS_H > lastIssued + endReachH * MS_H;

/**
 * The NWS ceiling against the reports, one row per NWS_ISSUANCES entry
 * (the newest issuance at least so many hours before the hour, picked by
 * time as the cloud-cover summary picks them). One place's records: the
 * forecast for one grid point, the reports of one station. An hour past
 * the end of what was gathered, for a row's lead, counts in no row
 * (`endReachH`, END_REACH_H).
 */
export function summarizeCeilings(
  forecasts: readonly CeilingForecast[],
  metars: readonly MetarRecord[],
  topFt = AUTOMATED_TOP_FT,
  endReachH = END_REACH_H,
): CeilingRow[] {
  const sites = new Set(forecasts.map((r) => r.site));
  if (sites.size > 1) throw new Error(`summarizeCeilings: forecasts from ${sites.size} sites; filter to one first`);
  const reports = ceilingReports(metars, topFt);
  const { byHour, lastIssued } = byValidHour(forecasts);
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  // Each hour's report, found once for the three rows.
  const reportAt = new Map(hours.map((t) => [t, reportNear(reports, t)]));

  return NWS_ISSUANCES.map(({ minLeadH, label }) => {
    const call = { both: 0, forecastOnly: 0, reportedOnly: 0, neither: 0 };
    const bands = emptyBands();
    const diffs: number[] = [];
    const leads: number[] = [];
    let n = 0;
    let sameBand = 0;
    const pairs: CeilingRow['pairs'] = [];
    for (const t of hours) {
      if (pastReach(t, minLeadH, lastIssued, endReachH)) continue;
      const rep = reportAt.get(t);
      if (rep?.ceiling == null) continue;
      // The newest issuance far enough ahead that has a value there: one
      // with the grid's missing value gives way to the one before it.
      const pick = byHour
        .get(t)!
        .find((r) => t - Date.parse(r.issued) >= minLeadH * MS_H && forecastCeiling(r.cig, topFt) != null);
      if (!pick) continue;
      const fc = forecastCeiling(pick.cig, topFt) as Ceiling;
      n++;
      pairs.push({ valid: new Date(t).toISOString(), issued: pick.issued, forecast: fc, reported: rep.ceiling });
      leads.push((t - Date.parse(pick.issued)) / MS_H);
      const rb = bandOf(rep.ceiling);
      const fb = bandOf(fc);
      bands[rb][fb]++;
      if (rb === fb) sameBand++;
      if (fc !== 'none' && rep.ceiling !== 'none') {
        call.both++;
        diffs.push(fc - rep.ceiling);
      } else if (fc !== 'none') call.forecastOnly++;
      else if (rep.ceiling !== 'none') call.reportedOnly++;
      else call.neither++;
    }
    return {
      label,
      minLeadH,
      hours: n,
      leadH: leads.length ? { min: Math.min(...leads), max: Math.max(...leads) } : null,
      call,
      diffFt: diffs.length
        ? {
            n: diffs.length,
            median: round0(median(diffs) as number),
            p10: round0(percentile(diffs, 0.1) as number),
            p90: round0(percentile(diffs, 0.9) as number),
            medianAbs: round0(median(diffs.map(Math.abs)) as number),
          }
        : null,
      diffByBand: mediansOf(diffDistribution(pairs, 'reported')),
      diffByForecastBand: mediansOf(diffDistribution(pairs, 'forecast')),
      bands,
      sameBand,
      pairs,
    };
  });
}

/** Forecast minus reported, binned by size and side. "Low" is a forecast
 *  below the reported ceiling. Each bin holds its larger end, so a 500 ft
 *  miss is "100 to 500", on either side alike. */
export const DIFF_BINS = [
  'more than 3,000 low',
  '1,000 to 3,000 low',
  '500 to 1,000 low',
  '100 to 500 low',
  'within 100',
  '100 to 500 high',
  '500 to 1,000 high',
  '1,000 to 3,000 high',
  'more than 3,000 high',
] as const;

const DIFF_STEPS_FT = [100, 500, 1000, 3000];

/** The DIFF_BINS index of a difference in ft. */
export function diffBin(d: number): number {
  const step = DIFF_STEPS_FT.findIndex((s) => Math.abs(d) <= s);
  const size = step < 0 ? DIFF_STEPS_FT.length : step;
  const mid = DIFF_STEPS_FT.length;
  return size === 0 ? mid : d < 0 ? mid - size : mid + size;
}

export interface DiffDistribution {
  n: number;
  /** Hours in each DIFF_BINS bin. */
  bins: number[];
  /** Forecast minus reported, ft: the 10th, 25th, 50th, 75th and 90th
   *  percentiles, nearest-rank but for the 50th, which is the median as
   *  every other table here takes it (the middle two averaged). */
  diffFt: Quantiles | null;
  /** Forecast over reported, the same percentiles, to two places, on the
   *  hours with a reported ceiling above 0 ft. A miss grows with the
   *  height, so this reads alike across the bands where the difference
   *  in ft does not. */
  ratio: Quantiles | null;
  /** Every hour's difference, ft, lowest first: the points a chart draws. */
  values: number[];
  /** Every hour's forecast ÷ reported (reported above 0 ft), to three
   *  places, lowest first. */
  ratios: number[];
}

type Quantiles = [number, number, number, number, number];

/** As `percentile` and `median` (paritySummary.ts) take them, sorting once. */
function quantiles(xs: readonly number[], round: (n: number) => number): Quantiles | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const rank = (p: number) => s[Math.min(s.length, Math.max(1, Math.ceil(p * s.length))) - 1];
  const mid = Math.floor(s.length / 2);
  const med = s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return [rank(0.1), rank(0.25), med, rank(0.75), rank(0.9)].map(round) as Quantiles;
}

/** The spread of forecast minus reported on the hours both had a ceiling,
 *  by one side's band: `'forecast'` is what a reader of the card's figure
 *  met, `'reported'` sorts by the outcome (see `diffByBand` on why that
 *  grouping leans). */
export function diffDistribution(
  pairs: readonly { forecast: Ceiling; reported: Ceiling }[],
  by: 'forecast' | 'reported',
): Record<FlightCategory, DiffDistribution> {
  const diffs = new Map<FlightCategory, number[]>(FLIGHT_BANDS.map((b) => [b, []]));
  const ratios = new Map<FlightCategory, number[]>(FLIGHT_BANDS.map((b) => [b, []]));
  for (const { forecast, reported } of pairs) {
    if (forecast === 'none' || reported === 'none') continue;
    const band = ceilingCategory(by === 'forecast' ? forecast : reported);
    diffs.get(band)!.push(forecast - reported);
    // A VV000 or OVC000 report has no ratio to give.
    if (reported > 0) ratios.get(band)!.push(forecast / reported);
  }
  return Object.fromEntries(
    FLIGHT_BANDS.map((band) => {
      const ds = diffs.get(band)!;
      const bins = DIFF_BINS.map(() => 0);
      for (const d of ds) bins[diffBin(d)]++;
      const rs = ratios.get(band)!;
      return [
        band,
        {
          n: ds.length,
          bins,
          diffFt: quantiles(ds, round0),
          ratio: quantiles(rs, (n) => Math.round(n * 100) / 100),
          values: [...ds].sort((a, b) => a - b),
          ratios: rs.map((r) => Math.round(r * 1000) / 1000).sort((a, b) => a - b),
        },
      ];
    }),
  ) as Record<FlightCategory, DiffDistribution>;
}

/** Fewer hours than this give no density curve: the shape of four points
 *  is the kernel's, not the data's, and a chart should show the points. */
export const DENSITY_MIN_N = 5;

/**
 * A Gaussian kernel density of `xs`, for a chart's cloud: pairs
 * [x, density] from two bandwidths below the lowest value to two above
 * the highest, spaced no wider than half a bandwidth (at least 80, at most
 * `maxPoints`), so no peak falls between samples; the density integrates
 * to 1 over all x, a little under over the grid, which leaves the tails
 * past two bandwidths off. The bandwidth is Silverman's
 * rule of thumb, 0.9 · min(sd, IQR / 1.34) · n^(-1/5) (IQR left out when
 * it is 0, as when most hours share one value), and never below
 * `minBandwidth`: the reports come in 100 ft steps, and a narrower kernel
 * draws each step as its own spike. Null under DENSITY_MIN_N values.
 */
export function densityCurve(
  xs: readonly number[],
  minBandwidth: number,
  maxPoints = 400,
): { bandwidth: number; curve: [number, number][] } | null {
  if (!(minBandwidth > 0)) throw new Error(`densityCurve: minBandwidth must be above 0, not ${minBandwidth}`);
  const n = xs.length;
  if (n < DENSITY_MIN_N) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const q = quantiles(s, (v) => v) as Quantiles;
  const iqr = q[3] - q[1];
  const spread = iqr > 0 ? Math.min(sd, iqr / 1.34) : sd;
  const bandwidth = Math.max(minBandwidth, 0.9 * spread * n ** -0.2);
  const lo = s[0] - 2 * bandwidth;
  const hi = s[n - 1] + 2 * bandwidth;
  const points = Math.min(maxPoints, Math.max(80, Math.ceil((hi - lo) / (bandwidth / 2)) + 1));
  const norm = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI));
  const curve: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const x = lo + ((hi - lo) * i) / (points - 1);
    let sum = 0;
    for (const v of s) sum += Math.exp(-0.5 * ((x - v) / bandwidth) ** 2);
    curve.push([x, sum * norm]);
  }
  return { bandwidth, curve };
}

/** Open-Meteo's start-of-run bands on the hours KPMV reported a ceiling,
 *  by the ceiling's band: how often each band was at or above 5/8 (the
 *  least a ceiling layer covers). */
export interface OmByCeilingBand {
  band: FlightCategory;
  hours: number;
  low: number;
  mid: number;
  total: number;
}

export function openMeteoByCeilingBand(
  om: readonly OpenMeteoCloudRecord[],
  metars: readonly MetarRecord[],
  topFt = AUTOMATED_TOP_FT,
): OmByCeilingBand[] {
  const reports = ceilingReports(metars, topFt);
  const atLeast = (v: number | null): boolean => v != null && v >= CEILING_EIGHTHS * 12.5;
  const rows = new Map<FlightCategory, OmByCeilingBand>(
    FLIGHT_BANDS.map((b) => [b, { band: b, hours: 0, low: 0, mid: 0, total: 0 }]),
  );
  for (const r of om) {
    if (r.run !== 'historical') continue;
    const rep = reportNear(reports, Date.parse(r.valid));
    if (rep?.ceiling == null || rep.ceiling === 'none') continue;
    const row = rows.get(ceilingCategory(rep.ceiling))!;
    row.hours++;
    if (atLeast(r.low)) row.low++;
    if (atLeast(r.mid)) row.mid++;
    if (atLeast(r.total)) row.total++;
  }
  return [...rows.values()];
}

/** The fetch script's ceiling records, from its JSON lines. */
export function parseCeilingLines(text: string): NdfdCeilingRecord[] {
  const out: NdfdCeilingRecord[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const r = JSON.parse(line) as NdfdCeilingRecord;
      if (r.src === 'ndfd-cig') out.push(r);
    } catch {
      // Not a record.
    }
  }
  return out;
}
