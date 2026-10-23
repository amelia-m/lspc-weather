/**
 * The NWS gust forecast from NOAA's NDFD archive set against KPMV's reports,
 * over months rather than the forecast keeper's days
 * (docs/nws-gust-archive.md). The question it serves is the open one in
 * docs/open-questions.md, "A note on the card about the forecast gust?":
 * the kept forecasts' gust ran above KPMV's in 45 of 53 gusting hours, by
 * an amount that varied from day to day, and 53 hours could not say how
 * consistent that is.
 *
 * Read as the kept forecasts are (docs/kept-forecasts-vs-kpmv.md), so the two
 * readings compare: the newest issuance at least each lead before the hour
 * (`NWS_ISSUANCES`), the report within REPORT_WINDOW_MIN of the hour
 * (`reportNear`), and the forecast in whole knots, as the API's gust reads
 * and a METAR reports (`windDiffs`). The archive's gust matched the API's
 * `windGust` at 42 of 42 hours on 2026-10-13 (scripts/ndfdApiCheck.py).
 *
 * Counts and spreads only; nothing on the dashboard reads them.
 */
import { byValidHour, END_REACH_H, pastReach } from './ceilingHeights';
import { NWS_ISSUANCES, reportNear, type MetarRecord } from './cloudCoverSources';
import { reportsByHour, windDiffs, type Instant } from './keptForecasts';
import { median, spreadOf, type Spread } from './paritySummary';
import { KT_PER_MPS } from './units';

const MS_H = 3_600_000;

/** One hour of one NDFD gust issuance at the drop zone's grid point, as
 *  scripts/cloudCoverFetch.py (PARTS=wgust) writes it. `gust` in m/s. */
export interface NdfdGustRecord {
  src: 'ndfd-wgust';
  key: string;
  issued: string;
  ref: string;
  valid: string;
  gust: number;
  gridKm: number;
  site?: string;
}

/** The drop zone's gust records from JSON lines. A negative gust is the
 *  grid's no-data fill (−9999 in the office's unit; the files declare no
 *  bitmap, docs/open-questions.md), not a forecast, and is dropped. */
export function parseNdfdGustLines(text: string): NdfdGustRecord[] {
  const out: NdfdGustRecord[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as NdfdGustRecord;
    if (r.src === 'ndfd-wgust' && r.site == null && r.gust >= 0) out.push(r);
  }
  return out;
}

/** One paired hour. `fc` is the forecast gust in whole knots. */
export interface GustPair {
  t: number;
  issued: string;
  leadH: number;
  fc: number;
  obs: Instant;
  /** Forecast minus reported gust, where KPMV reported one. */
  gustDiff: number | null;
  /** Forecast gust minus the reported steady wind, where it reported none. */
  overSteady: number | null;
}

/** The pairs for each NWS_ISSUANCES row: the newest issuance at least
 *  `minLeadH` before the hour, chosen by time as the cloud-cover and
 *  ceiling comparisons choose it, and KPMV's report near the hour. Hours
 *  whose report has no wind group are left out, and so are hours past the
 *  reach of the issuances fetched (`pastReach`, END_REACH_H), whose
 *  "newest" would only be the one the fetch ended on. */
export function pairGusts(
  records: readonly NdfdGustRecord[],
  metars: readonly MetarRecord[],
): { label: string; minLeadH: number; pairs: GustPair[] }[] {
  // An issuance at or after its hour is never picked (every row asks for
  // one at least 0 h before), and a row takes one issuance an hour, so a
  // file read twice by overlapping fetches needs no weeding.
  const { byHour: fcBy, lastIssued } = byValidHour(records);
  const repBy = reportsByHour(metars);
  const hours = [...fcBy.keys()].sort((a, b) => a - b);
  return NWS_ISSUANCES.map(({ minLeadH, label }) => {
    const pairs: GustPair[] = [];
    for (const t of hours) {
      if (pastReach(t, minLeadH, lastIssued, END_REACH_H)) continue;
      const r = fcBy.get(t)!.find((x) => t - Date.parse(x.issued) >= minLeadH * MS_H);
      if (!r) continue;
      const obs = reportNear(repBy.get(t) ?? [], t);
      if (!obs || obs.spd == null) continue;
      // Whole knots once, so the pair's figure and its differences agree.
      const fc = Math.round(r.gust * KT_PER_MPS);
      const d = windDiffs({ fc: { windGust: fc }, obs });
      pairs.push({
        t,
        issued: r.issued,
        leadH: (t - Date.parse(r.issued)) / MS_H,
        fc,
        obs,
        gustDiff: d.gust,
        overSteady: d.gustOverSpeed,
      });
    }
    return { label: label.replace('NWS, ', ''), minLeadH, pairs };
  });
}

const r2 = (x: number): number => Math.round(x * 100) / 100;
const mean = (xs: readonly number[]): number | null => (xs.length ? r2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export interface Side {
  above: number;
  equal: number;
  below: number;
}
const sideOf = (ds: readonly number[]): Side => ({
  above: ds.filter((d) => d > 0).length,
  equal: ds.filter((d) => d === 0).length,
  below: ds.filter((d) => d < 0).length,
});

export interface GroupMean {
  key: string;
  n: number;
  mean: number | null;
  side: Side;
}
function groups(pairs: readonly GustPair[], keyOf: (p: GustPair) => string): GroupMean[] {
  const acc = new Map<string, number[]>();
  for (const p of pairs) {
    if (p.gustDiff == null) continue;
    const k = keyOf(p);
    acc.set(k, [...(acc.get(k) ?? []), p.gustDiff]);
  }
  return [...acc]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, ds]) => ({ key, n: ds.length, mean: mean(ds), side: sideOf(ds) }));
}

/** The calendar day in the drop zone's time zone, YYYY-MM-DD: a windy
 *  afternoon and its evening are one day to a reader, not split at 00Z. */
const localDay = (t: number, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);

/** Below, from and above these reported gusts: the sizes the kept reading
 *  split at (docs/kept-forecasts-vs-kpmv.md), kept so the two compare. */
const SIZE_BANDS = [
  { key: 'under 18 kt', test: (g: number) => g < 18 },
  { key: '18 to 22 kt', test: (g: number) => g >= 18 && g <= 22 },
  { key: '23 kt or more', test: (g: number) => g >= 23 },
];

export interface GustSummary {
  label: string;
  hours: number;
  lead: { min: number; max: number } | null;
  /** Hours KPMV reported a gust. */
  gustHours: number;
  side: Side;
  spread: Spread | null;
  /** Forecast gust minus reported steady wind, hours with no reported gust. */
  overSteady: Spread | null;
  byMonth: GroupMean[];
  byUtcBlock: GroupMean[];
  bySize: GroupMean[];
  /** Each local day with at least `minDayHours` gusting hours, its mean;
   *  the spread of those means is how far the size moved day to day. */
  days: GroupMean[];
  /** Those days' means, signed: the lowest, middle and highest, and how
   *  many fell below −2 kt, within 2 kt of zero, and above +2 kt. */
  dayMeans: { n: number; min: number; median: number; max: number; under: number; near: number; over: number } | null;
  /** At a published limit: hours the forecast gust was at or over it, how
   *  many of those KPMV's report was at or over it too (the higher of its
   *  wind and gust, as the report's caution flag reads it), and hours the
   *  report was at or over it with the forecast gust under. The forecast
   *  flag reads the higher of the forecast wind and gust; only the gust is
   *  fetched here, so this is the flag's count only where the gust is the
   *  higher (docs/nws-gust-archive.md says how far that was checked). */
  atLimit: { limitKt: number; forecastAt: number; bothAt: number; reportOnly: number; hours: number };
}

export function summarizeGusts(
  rows: readonly { label: string; pairs: readonly GustPair[] }[],
  opts: { timeZone: string; limitKt: number; minDayHours: number },
): GustSummary[] {
  return rows.map(({ label, pairs }) => {
    const gusting = pairs.filter((p) => p.gustDiff != null);
    const ds = gusting.map((p) => p.gustDiff!);
    const leads = pairs.map((p) => p.leadH);
    const days = groups(pairs, (p) => localDay(p.t, opts.timeZone)).filter((g) => g.n >= opts.minDayHours);
    const reported = (p: GustPair): number => Math.max(p.obs.spd ?? -Infinity, p.obs.gust ?? -Infinity);
    let forecastAt = 0;
    let bothAt = 0;
    let reportOnly = 0;
    for (const p of pairs) {
      const f = p.fc >= opts.limitKt;
      const o = reported(p) >= opts.limitKt;
      if (f) forecastAt++;
      if (f && o) bothAt++;
      if (o && !f) reportOnly++;
    }
    return {
      label,
      hours: pairs.length,
      lead: leads.length ? { min: r2(Math.min(...leads)), max: r2(Math.max(...leads)) } : null,
      gustHours: gusting.length,
      side: sideOf(ds),
      spread: spreadOf(ds),
      overSteady: spreadOf(pairs.flatMap((p) => (p.overSteady == null ? [] : [p.overSteady]))),
      byMonth: groups(pairs, (p) => localDay(p.t, opts.timeZone).slice(0, 7)),
      byUtcBlock: groups(pairs, (p) => {
        const b = Math.floor(new Date(p.t).getUTCHours() / 6) * 6;
        return `${String(b).padStart(2, '0')}–${String(b + 5).padStart(2, '0')}Z`;
      }),
      bySize: SIZE_BANDS.map(({ key, test }) => {
        const xs = gusting.filter((p) => test(p.obs.gust!)).map((p) => p.gustDiff!);
        return { key, n: xs.length, mean: mean(xs), side: sideOf(xs) };
      }),
      days,
      dayMeans: days.length
        ? {
            n: days.length,
            min: Math.min(...days.map((d) => d.mean!)),
            median: r2(median(days.map((d) => d.mean!))!),
            max: Math.max(...days.map((d) => d.mean!)),
            under: days.filter((d) => d.mean! < -2).length,
            near: days.filter((d) => Math.abs(d.mean!) <= 2).length,
            over: days.filter((d) => d.mean! > 2).length,
          }
        : null,
      atLimit: { limitKt: opts.limitKt, forecastAt, bothAt, reportOnly, hours: pairs.length },
    };
  });
}
