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
import { CEILING_COVERS, parseSkyGroups } from './normalize';
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

/** One NDFD ceiling value at a grid point. `cig` is metres AGL as the grid
 *  gives it, with its two codes kept: NDFD_NO_CEILING and NDFD_MISSING. */
export interface NdfdCeilingRecord {
  src: 'ndfd-cig';
  key: string;
  issued: string;
  ref: string;
  valid: string;
  cig: number;
  gridKm: number;
  site?: string;
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

const MS_H = 3_600_000;

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
  /** Every hour counted, in time order: the forecast ceiling and the
   *  reported one, each ft or 'none'. What the distributions are read from. */
  pairs: { forecast: Ceiling; reported: Ceiling }[];
}

const emptyBands = (): CeilingRow['bands'] =>
  Object.fromEntries(
    CEILING_BANDS.map((a) => [a, Object.fromEntries(CEILING_BANDS.map((b) => [b, 0]))]),
  ) as CeilingRow['bands'];

const round0 = (x: number): number => Math.round(x);

const medianByBand = (by: Map<FlightCategory, number[]>): CeilingRow['diffByBand'] =>
  Object.fromEntries(
    (['LIFR', 'IFR', 'MVFR', 'VFR'] as const).map((b) => {
      const ds = by.get(b) ?? [];
      return [b, { n: ds.length, median: ds.length ? round0(median(ds) as number) : null }];
    }),
  ) as CeilingRow['diffByBand'];

/**
 * The NWS ceiling against the reports, one row per NWS_ISSUANCES entry
 * (the newest issuance at least so many hours before the hour, picked by
 * time as the cloud-cover summary picks them). One place's records: the
 * forecast for one grid point, the reports of one station.
 */
export function summarizeCeilings(
  forecasts: readonly NdfdCeilingRecord[],
  metars: readonly MetarRecord[],
  topFt = AUTOMATED_TOP_FT,
): CeilingRow[] {
  const sites = new Set(forecasts.map((r) => r.site));
  if (sites.size > 1) throw new Error(`summarizeCeilings: forecasts from ${sites.size} sites; filter to one first`);
  const reports = ceilingReports(metars, topFt);
  const byHour = new Map<number, NdfdCeilingRecord[]>();
  for (const r of forecasts) {
    // An issuance made after its hour is never picked: every row asks for
    // one at least 0 h before it.
    const t = Date.parse(r.valid);
    const list = byHour.get(t);
    if (list) list.push(r);
    else byHour.set(t, [r]);
  }
  for (const rs of byHour.values()) rs.sort((a, b) => Date.parse(b.issued) - Date.parse(a.issued));
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  // Each hour's report, found once for the three rows.
  const reportAt = new Map(hours.map((t) => [t, reportNear(reports, t)]));

  return NWS_ISSUANCES.map(({ minLeadH, label }) => {
    const call = { both: 0, forecastOnly: 0, reportedOnly: 0, neither: 0 };
    const bands = emptyBands();
    const diffs: number[] = [];
    const byBand = new Map<FlightCategory, number[]>();
    const byForecastBand = new Map<FlightCategory, number[]>();
    const leads: number[] = [];
    let n = 0;
    let sameBand = 0;
    const pairs: CeilingRow['pairs'] = [];
    for (const t of hours) {
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
      pairs.push({ forecast: fc, reported: rep.ceiling });
      leads.push((t - Date.parse(pick.issued)) / MS_H);
      const rb = bandOf(rep.ceiling);
      const fb = bandOf(fc);
      bands[rb][fb]++;
      if (rb === fb) sameBand++;
      if (fc !== 'none' && rep.ceiling !== 'none') {
        call.both++;
        diffs.push(fc - rep.ceiling);
        const list = byBand.get(rb as FlightCategory) ?? [];
        list.push(fc - rep.ceiling);
        byBand.set(rb as FlightCategory, list);
        const flist = byForecastBand.get(fb as FlightCategory) ?? [];
        flist.push(fc - rep.ceiling);
        byForecastBand.set(fb as FlightCategory, flist);
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
      diffByBand: medianByBand(byBand),
      diffByForecastBand: medianByBand(byForecastBand),
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
  /** Forecast minus reported, ft: nearest-rank 10th, 25th, 50th, 75th
   *  and 90th percentiles. */
  diffFt: [number, number, number, number, number] | null;
  /** Forecast over reported, the same percentiles, to two places. A miss
   *  grows with the height, so this reads alike across the bands where
   *  the difference in ft does not. */
  ratio: [number, number, number, number, number] | null;
}

const QS = [0.1, 0.25, 0.5, 0.75, 0.9];

/** The spread of forecast minus reported on the hours both had a ceiling,
 *  by one side's band: `'forecast'` is what a reader of the card's figure
 *  met, `'reported'` sorts by the outcome (see `diffByBand` on why that
 *  grouping leans). */
export function diffDistribution(
  pairs: CeilingRow['pairs'],
  by: 'forecast' | 'reported',
): Record<FlightCategory, DiffDistribution> {
  const groups = new Map<FlightCategory, { d: number; r: number }[]>();
  for (const { forecast, reported } of pairs) {
    if (forecast === 'none' || reported === 'none') continue;
    const band = ceilingCategory(by === 'forecast' ? forecast : reported);
    const list = groups.get(band) ?? [];
    list.push({ d: forecast - reported, r: forecast / reported });
    groups.set(band, list);
  }
  return Object.fromEntries(
    (['LIFR', 'IFR', 'MVFR', 'VFR'] as const).map((band) => {
      const xs = groups.get(band) ?? [];
      const bins = DIFF_BINS.map(() => 0);
      for (const x of xs) bins[diffBin(x.d)]++;
      const ds = xs.map((x) => x.d);
      const rs = xs.map((x) => x.r);
      const qs = (v: number[], f: (n: number) => number) =>
        v.length ? (QS.map((p) => f(percentile(v, p) as number)) as DiffDistribution['diffFt']) : null;
      return [
        band,
        { n: xs.length, bins, diffFt: qs(ds, round0), ratio: qs(rs, (n) => Math.round(n * 100) / 100) },
      ];
    }),
  ) as Record<FlightCategory, DiffDistribution>;
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
    (['LIFR', 'IFR', 'MVFR', 'VFR'] as const).map((b) => [b, { band: b, hours: 0, low: 0, mid: 0, total: 0 }]),
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
