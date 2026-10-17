/**
 * The gridpoint's hourly rain and thunder chances, as the card read them,
 * against what KPMV reported in the same hours (docs/forecast-chances.md).
 * No archive holds these hours: NDFD has only a 12-hour `pop12` and no
 * thunder element (docs/open-questions.md, "Forecasts kept for later"),
 * so the forecasts are the keeper's snapshots alone.
 *
 * Counts only. For each chance the forecast gave, how many hours had it
 * and in how many the thing happened at the station; the chances summed
 * beside the hours it happened in. Nothing here grades the forecast, and
 * the app shows none of it on the dashboard.
 */
import { END_REACH_H, type KeptGridpointSnapshot } from './ceilingHeights';
import { NWS_ISSUANCES, type MetarRecord } from './cloudCoverSources';
import { parseValidTime } from './normalize';
import { WX, WX_DESCRIPTOR_ONLY } from './taf';

const MS_H = 3_600_000;

/** The two kept chances, by their gridpoint property names. */
export const CHANCE_ELEMENTS = ['probabilityOfPrecipitation', 'probabilityOfThunder'] as const;
export type ChanceElement = (typeof CHANCE_ELEMENTS)[number];

/** One hour's chance, in percent, from one issuance. */
export interface ChanceForecast {
  issued: string;
  valid: string;
  chance: number;
}

/**
 * One element's chances in a kept snapshot, one record per hour, issued at
 * the gridpoint's `updateTime`, as keptCeilingRecords reads the ceiling.
 * The API runs equal hours together (`P2DT21H` at 0 for 69 hours, read
 * 2026-10-17), so a period is its value for each of its hours. A null
 * value is no forecast and gives no record.
 */
export function keptChanceRecords(snap: KeptGridpointSnapshot, element: ChanceElement): ChanceForecast[] {
  const gp = snap.nwsGridpoint;
  if (!gp || 'error' in gp || !gp.updateTime) return [];
  const prop = gp.properties[element];
  if (!prop) return [];
  if (prop.uom != null && prop.uom !== 'wmoUnit:percent') {
    throw new Error(`keptChanceRecords: ${element} in ${prop.uom}`);
  }
  const out: ChanceForecast[] = [];
  for (const { validTime, value } of prop.values) {
    const span = parseValidTime(validTime);
    if (!span || value == null) continue;
    for (let h = 0; h < span.hours; h++) {
      out.push({ issued: gp.updateTime, valid: new Date(span.start + h * MS_H).toISOString(), chance: value });
    }
  }
  return out;
}

/** What KPMV's reports in one clock hour say happened. */
export interface ReportedHour {
  /** The hour's start, ms. */
  t: number;
  /**
   * At least 0.01 in. of precipitation, the amount NWS's chance of
   * precipitation is a chance of. KPMV's `P` group is the amount since its
   * last :55 report, so the hour read is the one ending at :55, five
   * minutes ahead of the clock hour (docs/forecast-chances.md). Null when
   * a report's gauge could not say (`P////`) and none measured any.
   */
  measurable: boolean | null;
  /** Any precipitation reported at the station: a precipitation code in
   *  the weather group (not in the vicinity), or any `P` group, a trace
   *  (`P0000`) included. */
  precip: boolean;
  /** `TS` at the station in any report. Null when the station said its
   *  lightning sensor was out (`TSNO`) and reported none. */
  ts: boolean | null;
  /** `VCTS`: thunderstorm in the vicinity, not at the station. */
  vcts: boolean;
}

const PRECIP_CODES = /DZ|RA|SN|SG|IC|PL|GR|GS|UP/;
const P_GROUP = /^P(\d{4}|\/{4})$/;

/** One report's weather groups and `P` group. Intensity written before
 *  `VC` (`-VCTSRA`, seen at KPMV on 2026-10-13) is dropped so the group
 *  reads as the vicinity weather it is. */
function readReport(raw: string) {
  const [body, rmk = ''] = raw.split(/ RMK /);
  let precip = false;
  let ts = false;
  let vcts = false;
  for (const tok of body.split(/\s+/).slice(2)) {
    const t = tok.replace(/^[-+](?=VC)/, '');
    const m = WX.exec(t);
    const d = m ? null : WX_DESCRIPTOR_ONLY.exec(t);
    if (!m && !d) continue;
    const vc = (m ?? d)![1] === 'VC';
    const isTs = (m ?? d)![2] === 'TS';
    if (vc) {
      if (isTs) vcts = true;
      continue;
    }
    if (isTs) ts = true;
    if (m && PRECIP_CODES.test(m[3])) precip = true;
  }
  const rtoks = rmk.split(/\s+/);
  const p = rtoks.map((x) => P_GROUP.exec(x)).find(Boolean);
  const amount = p ? (p[1] === '////' ? null : Number(p[1]) / 100) : 0;
  return { precip: precip || p != null, ts, vcts, amount, tsno: rtoks.includes('TSNO') };
}

/**
 * KPMV's reports grouped by clock hour. An hour counts only when it holds
 * a report at :45 or later, the hourly one that carries the hour's whole
 * `P` amount: KPMV reports at :15, :35 and :55 (4,460 of each from April
 * to October 9, 2026), and without the :55 one the hour's rain is not
 * all on record.
 */
export function reportedHours(metars: readonly MetarRecord[]): ReportedHour[] {
  // A report seen twice (overlapping fetches) changes nothing: every
  // reading below asks whether any report in the hour said so.
  const byHour = new Map<number, { min: number; r: ReturnType<typeof readReport> }[]>();
  for (const m of metars) {
    const at = Date.parse(m.obsAt);
    const t = Math.floor(at / MS_H) * MS_H;
    const list = byHour.get(t) ?? [];
    list.push({ min: (at - t) / 60_000, r: readReport(m.raw) });
    byHour.set(t, list);
  }
  const out: ReportedHour[] = [];
  for (const [t, list] of byHour) {
    if (!list.some((x) => x.min >= 45)) continue;
    const rs = list.map((x) => x.r);
    const measured = rs.some((r) => r.amount != null && r.amount >= 0.01);
    const ts = rs.some((r) => r.ts);
    out.push({
      t,
      measurable: measured ? true : rs.some((r) => r.amount == null) ? null : false,
      precip: rs.some((r) => r.precip),
      ts: ts ? true : rs.some((r) => r.tsno) ? null : false,
      vcts: rs.some((r) => r.vcts),
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The chance bins: 0 on its own (most hours), then tens. Inclusive. */
export const CHANCE_BINS: readonly { lo: number; hi: number }[] = [
  { lo: 0, hi: 0 },
  { lo: 1, hi: 9 },
  ...Array.from({ length: 9 }, (_, i) => ({ lo: (i + 1) * 10, hi: i === 8 ? 100 : (i + 1) * 10 + 9 })),
];

export interface ChanceBin {
  lo: number;
  hi: number;
  hours: number;
  /** Hours it happened in. */
  events: number;
  /** The bin's chances summed, percent: ÷ 100 is the hours a forecast
   *  meaning exactly what it said would have expected. */
  chanceSum: number;
}

export interface ChanceRow {
  label: string;
  minLeadH: number;
  hours: number;
  events: number;
  chanceSum: number;
  leadH: { min: number; max: number } | null;
  bins: ChanceBin[];
  /** Every hour counted, in time order. */
  pairs: { valid: string; issued: string; chance: number; event: boolean }[];
}

/**
 * One element's chances against what happened, one row per NWS_ISSUANCES
 * entry, picking the newest issuance at least the row's lead before the
 * hour's start, as summarizeCeilings does, and leaving out hours past the
 * reach of what was gathered (END_REACH_H). `event` reads an hour as
 * happened, not, or unknown (null: the hour is left out).
 */
export function summarizeChances(
  forecasts: readonly ChanceForecast[],
  hours: readonly ReportedHour[],
  event: (h: ReportedHour) => boolean | null,
  endReachH = END_REACH_H,
): ChanceRow[] {
  const byHour = new Map<number, ChanceForecast[]>();
  for (const r of forecasts) {
    const t = Date.parse(r.valid);
    const list = byHour.get(t) ?? [];
    list.push(r);
    byHour.set(t, list);
  }
  for (const rs of byHour.values()) rs.sort((a, b) => Date.parse(b.issued) - Date.parse(a.issued));
  const lastIssued = forecasts.reduce((m, r) => Math.max(m, Date.parse(r.issued)), -Infinity);

  return NWS_ISSUANCES.map(({ minLeadH, label }) => {
    const bins: ChanceBin[] = CHANCE_BINS.map((b) => ({ ...b, hours: 0, events: 0, chanceSum: 0 }));
    const pairs: ChanceRow['pairs'] = [];
    const leads: number[] = [];
    for (const h of hours) {
      if (h.t - minLeadH * MS_H > lastIssued + endReachH * MS_H) continue;
      const happened = event(h);
      if (happened == null) continue;
      const pick = byHour.get(h.t)?.find((r) => h.t - Date.parse(r.issued) >= minLeadH * MS_H);
      if (!pick) continue;
      const bin = bins.find((b) => pick.chance >= b.lo && pick.chance <= b.hi);
      if (!bin) throw new Error(`summarizeChances: a chance of ${pick.chance}%`);
      bin.hours++;
      bin.chanceSum += pick.chance;
      if (happened) bin.events++;
      pairs.push({ valid: new Date(h.t).toISOString(), issued: pick.issued, chance: pick.chance, event: happened });
      leads.push((h.t - Date.parse(pick.issued)) / MS_H);
    }
    return {
      label,
      minLeadH,
      hours: pairs.length,
      events: pairs.filter((p) => p.event).length,
      chanceSum: bins.reduce((s, b) => s + b.chanceSum, 0),
      leadH: leads.length ? { min: Math.min(...leads), max: Math.max(...leads) } : null,
      bins,
      pairs,
    };
  });
}

/** What each chance is scored against: rain against a measurable amount,
 *  which is what NWS's chance of precipitation is a chance of; thunder
 *  against `TS` reported at the station. */
export const CHANCE_EVENT: Record<ChanceElement, (h: ReportedHour) => boolean | null> = {
  probabilityOfPrecipitation: (h) => h.measurable,
  probabilityOfThunder: (h) => h.ts,
};
