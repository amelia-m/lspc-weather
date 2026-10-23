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
 * Since 2026-10-23 the archive's wind speed and direction are read too
 * (`parseNdfdWindLines`, `pairNdfdWind`): the speed so the Student-limit
 * count reads the higher of the forecast wind and gust, as the forecast
 * flag does, and all three for the #wind-errors page's NWS archive section
 * (src/domain/windErrors.ts). The API's `windSpeed` and `windDirection`
 * matched the archive at 42 of 42 hours on 2026-10-13 as well.
 *
 * Counts and spreads only; nothing on the dashboard reads them.
 */
import { byValidHour } from './ceilingHeights';
import { NWS_ISSUANCES, type MetarRecord } from './cloudCoverSources';
import { pairInstants, reportsByHour, windDiffs, type Instant, type InstantPair } from './keptForecasts';
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

/** One hour of the archive's wind speed (m/s) or direction (degrees
 *  true), as scripts/cloudCoverFetch.py (PARTS=wspd,wdir) writes it. */
export interface NdfdSpeedRecord {
  src: 'ndfd-wspd';
  key: string;
  issued: string;
  valid: string;
  spd: number;
  site?: string;
}
export interface NdfdDirRecord {
  src: 'ndfd-wdir';
  key: string;
  issued: string;
  valid: string;
  dir: number;
  site?: string;
}

/** The archive's three wind elements, the drop zone's, from JSON lines in
 *  any mix (the weekly refresh writes all three to one file). A negative
 *  value is the grid's no-data fill (−9999 in the office's unit; the files
 *  declare no bitmap, docs/open-questions.md), not a forecast, and is
 *  dropped, as are other records and other sites' points. The files the
 *  archive cut short (`ndfd-truncated`, scripts/cloudCoverFetch.py) are
 *  kept apart, so a reading can say which they were. */
export function parseNdfdWindLines(text: string): {
  gust: NdfdGustRecord[];
  spd: NdfdSpeedRecord[];
  dir: NdfdDirRecord[];
  truncated: { key: string; issued: string; kept: number }[];
} {
  const out = {
    gust: [] as NdfdGustRecord[],
    spd: [] as NdfdSpeedRecord[],
    dir: [] as NdfdDirRecord[],
    truncated: [] as { key: string; issued: string; kept: number }[],
  };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as
      | NdfdGustRecord
      | NdfdSpeedRecord
      | NdfdDirRecord
      | { src: 'ndfd-truncated'; key: string; issued: string; kept: number; site?: string };
    if (r.site != null) continue;
    if (r.src === 'ndfd-truncated') {
      out.truncated.push({ key: r.key, issued: r.issued, kept: r.kept });
      continue;
    }
    if (r.src === 'ndfd-wgust' && r.gust >= 0) out.gust.push(r);
    else if (r.src === 'ndfd-wspd' && r.spd >= 0) out.spd.push(r);
    else if (r.src === 'ndfd-wdir' && r.dir >= 0) out.dir.push(r);
  }
  return out;
}

/** A lead row's label as the rows here print it ("latest issuance"), the
 *  same for the gust reading, the page and the docs. */
export const nwsRowLabel = (label: string): string => label.replace('NWS, ', '');

/** The six-hour block of UTC an hour falls in, as the kept reading splits
 *  its tables ("00–05Z"). */
export function utcBlockKey(t: number): string {
  const b = Math.floor(new Date(t).getUTCHours() / 6) * 6;
  return `${String(b).padStart(2, '0')}–${String(b + 5).padStart(2, '0')}Z`;
}

/**
 * The archive's wind, gust and direction as the kept forecasts' pairs, a
 * row per NWS_ISSUANCES lead, by the kept reading's own `pairInstants`: each
 * element its own newest issuance at least the lead before the hour (a
 * direction file is sometimes stamped a minute before its speed file), its
 * own reach (`pastReach`), and the report near the hour. So the #wind-errors
 * page's two NWS sections are paired by the same code. Speeds in knots,
 * unrounded (`windDiffs` rounds them). The issue time given is the gust's,
 * else the speed's, else the direction's: the gust reading's leads are
 * the gust's.
 */
export function pairNdfdWind(
  wind: { gust: readonly NdfdGustRecord[]; spd: readonly NdfdSpeedRecord[]; dir: readonly NdfdDirRecord[] },
  metars: readonly MetarRecord[],
): { label: string; minLeadH: number; pairs: InstantPair[] }[] {
  const as = <T extends { issued: string; valid: string }>(rs: readonly T[], value: (r: T) => number) =>
    byValidHour(rs.map((r) => ({ issued: r.issued, valid: r.valid, value: value(r) })));
  const per = [
    { el: 'windGust' as const, ...as(wind.gust, (r) => r.gust * KT_PER_MPS) },
    { el: 'windSpeed' as const, ...as(wind.spd, (r) => r.spd * KT_PER_MPS) },
    { el: 'windDirection' as const, ...as(wind.dir, (r) => r.dir) },
  ];
  const hours = [...new Set(per.flatMap((p) => [...p.byHour.keys()]))].sort((a, b) => a - b);
  const prepared = { reportsByHour: reportsByHour(metars), per, hours };
  return NWS_ISSUANCES.map(({ minLeadH, label }) => ({
    label: nwsRowLabel(label),
    minLeadH,
    pairs: pairInstants(prepared, minLeadH),
  }));
}

/** One paired hour. `fc` is the forecast gust in whole knots. */
export interface GustPair {
  t: number;
  issued: string;
  leadH: number;
  fc: number;
  /** The forecast wind for the hour in the same lead row, in whole knots,
   *  when the speed was given: each element is its own newest issuance at
   *  the lead, so this can come from a file stamped a minute apart. The
   *  forecast flag reads the higher of the two. */
  fcWind: number | null;
  obs: Instant;
  /** Forecast minus reported gust, where KPMV reported one. */
  gustDiff: number | null;
  /** Forecast gust minus the reported steady wind, where it reported none. */
  overSteady: number | null;
}

/** The gust reading's pairs for each NWS_ISSUANCES row, from `pairNdfdWind`:
 *  the hours with a forecast gust and a report with a wind group. Hours
 *  with a forecast speed but no gust at the lead (none in the six months
 *  read) are counted in `withoutGust`, not paired, so the reading says
 *  what it left out. */
export function pairGusts(
  records: readonly NdfdGustRecord[],
  metars: readonly MetarRecord[],
  speeds: readonly NdfdSpeedRecord[] = [],
): { label: string; minLeadH: number; pairs: GustPair[]; withoutGust: number }[] {
  return pairNdfdWind({ gust: records, spd: speeds, dir: [] }, metars).map(({ label, minLeadH, pairs }) => {
    const out: GustPair[] = [];
    let withoutGust = 0;
    for (const p of pairs) {
      if (p.obs.spd == null) continue;
      if (p.fc.windGust == null) {
        if (p.fc.windSpeed != null) withoutGust++;
        continue;
      }
      // Whole knots once, so the pair's figure and its differences agree.
      const fc = Math.round(p.fc.windGust);
      const d = windDiffs({ fc: { windGust: fc }, obs: p.obs });
      out.push({
        t: p.t,
        issued: p.issued,
        leadH: (p.t - Date.parse(p.issued)) / MS_H,
        fc,
        fcWind: p.fc.windSpeed == null ? null : Math.round(p.fc.windSpeed),
        obs: p.obs,
        gustDiff: d.gust,
        overSteady: d.gustOverSpeed,
      });
    }
    return { label, minLeadH, pairs: out, withoutGust };
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
  /** At a published limit, as the caution flags read it: hours the
   *  forecast was at or over it (the higher of its wind, where given, and
   *  gust), how many of those KPMV's report was at or over it too (the
   *  higher of its wind and gust), and hours the report was at or over it
   *  with the forecast under. */
  atLimit: { limitKt: number; forecastAt: number; bothAt: number; reportOnly: number; hours: number };
  /** Hours with the forecast wind given, and how many of them had it over
   *  the forecast gust, in whole knots. */
  gustUnderWind: { compared: number; under: number };
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
      const f = Math.max(p.fc, p.fcWind ?? -Infinity) >= opts.limitKt;
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
      byUtcBlock: groups(pairs, (p) => utcBlockKey(p.t)),
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
      gustUnderWind: {
        compared: pairs.filter((p) => p.fcWind != null).length,
        under: pairs.filter((p) => p.fcWind != null && p.fcWind > p.fc).length,
      },
    };
  });
}

export interface WindRowSummary {
  label: string;
  hours: number;
  /** Forecast minus reported speed, whole knots (`windDiffs`). */
  speed: Spread | null;
  /** The same by six-hour block of UTC, the kept reading's blocks. */
  speedByUtcBlock: { key: string; n: number; mean: number | null }[];
  /** Forecast minus reported direction, the short way round, where the
   *  report gave one. */
  dir: Spread | null;
}

/** The archive's speed and direction against KPMV, per lead row, as the
 *  kept reading's table gives them (docs/kept-forecasts-vs-kpmv.md), so the
 *  two can be set side by side over the same window. */
export function summarizeNdfdWind(rows: readonly { label: string; pairs: readonly InstantPair[] }[]): WindRowSummary[] {
  return rows.map(({ label, pairs }) => {
    const d = pairs.map((p) => ({ t: p.t, ...windDiffs(p) }));
    const blocks = new Map<string, number[]>();
    for (const x of d) {
      if (x.speed == null) continue;
      const key = utcBlockKey(x.t);
      blocks.set(key, [...(blocks.get(key) ?? []), x.speed]);
    }
    return {
      label,
      hours: pairs.length,
      speed: spreadOf(d.flatMap((x) => (x.speed == null ? [] : [x.speed]))),
      speedByUtcBlock: [...blocks]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([key, xs]) => ({ key, n: xs.length, mean: mean(xs) })),
      dir: spreadOf(d.flatMap((x) => (x.dir == null ? [] : [x.dir]))),
    };
  });
}
