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
import { byValidHour, END_REACH_H, keptHours, pastReach, type KeptGridpointSnapshot } from './ceilingHeights';
import { NWS_ISSUANCES, type MetarRecord } from './cloudCoverSources';
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

/** One element's chances in a kept snapshot, one record per hour
 *  (keptHours). A null value is no forecast and gives no record. */
export function keptChanceRecords(snap: KeptGridpointSnapshot, element: ChanceElement): ChanceForecast[] {
  const kept = keptHours(snap, element);
  if (!kept) return [];
  if (kept.uom != null && kept.uom !== 'wmoUnit:percent') {
    throw new Error(`keptChanceRecords: ${element} in ${kept.uom}`);
  }
  return kept.hours.flatMap(({ valid, value }) => (value == null ? [] : [{ issued: kept.issued, valid, chance: value }]));
}

/** What KPMV's reports say happened in one hour (reportedHours: the `P`
 *  amount over the hour ending at :55, the weather group over the clock
 *  hour). */
export interface ReportedHour {
  /** The clock hour's start, ms. */
  t: number;
  /**
   * At least 0.01 in. of precipitation, the amount NWS's chance of
   * precipitation is a chance of. Null when a report's gauge could not
   * say (`P////`, or `PNO`, the gauge not available) and none measured
   * any.
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
  /** The hour's amount, in.: the largest `P` group read over the hour
   *  ending with its :55 report. That is the :55 report's, since every
   *  report from the :55 before measures from it and no amount fell within
   *  an hour in the archive; a special earlier in the hour gives its amount
   *  only if the :55 report's is smaller. 0 with none, and a trace,
   *  `P0000`, is 0. Null when the :55 report's gauge could not say. */
  amount: number | null;
}

const PRECIP_CODES = /DZ|RA|SN|SG|IC|PL|GR|GS|UP/;
// Drifting or blowing snow is snow lifted by the wind, not falling.
const LIFTED = new Set(['DR', 'BL']);
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
    if (m && !LIFTED.has(m[2]) && PRECIP_CODES.test(m[3])) precip = true;
  }
  const rtoks = rmk.split(/\s+/);
  const p = rtoks.map((x) => P_GROUP.exec(x)).find(Boolean);
  const amount = p ? (p[1] === '////' ? null : Number(p[1]) / 100) : rtoks.includes('PNO') ? null : 0;
  return { precip, ts, vcts, tsno: rtoks.includes('TSNO'), amount, pGroup: p != null };
}

/**
 * What KPMV reported, hour by hour. Two readings, two hours. The `P`
 * amount runs from one :55 report to the next, so it is read over the
 * hour ending with the :55 report (a report at :56 to :59 opens the next
 * one). The weather group is what was seen at the report's minute, so
 * thunder, vicinity weather and precipitation codes are read in the clock
 * hour they were seen in. An hour counts only when its :55 report, the
 * hourly one carrying the hour's whole `P` amount, is on record: KPMV
 * reports at :15, :35 and :55 (about 4,460 of each from April to October
 * 9, 2026; 57 reports at any other minute from April to October 16, none
 * of them an hourly report out of place), and without the :55 one the
 * hour's rain is not all there.
 */
export function reportedHours(metars: readonly MetarRecord[]): ReportedHour[] {
  // A report seen twice (overlapping fetches) changes nothing: every
  // reading below asks whether any report in the hour said so.
  type Read = ReturnType<typeof readReport>;
  const seen = new Map<number, Read[]>();
  const gauge = new Map<number, { hourly: boolean; r: Read }[]>();
  const push = <V>(map: Map<number, V[]>, t: number, v: V) => {
    const list = map.get(t);
    if (list) list.push(v);
    else map.set(t, [v]);
  };
  for (const m of metars) {
    const at = Date.parse(m.obsAt);
    const hour = Math.floor(at / MS_H) * MS_H;
    const min = Math.floor((at - hour) / 60_000);
    const r = readReport(m.raw);
    push(seen, hour, r);
    push(gauge, min > 55 ? hour + MS_H : hour, { hourly: min === 55, r });
  }
  const out: ReportedHour[] = [];
  for (const [t, list] of gauge) {
    if (!list.some((x) => x.hourly)) continue;
    const amounts = list.map((x) => x.r);
    const wx = seen.get(t) ?? [];
    const measured = amounts.some((r) => r.amount != null && r.amount >= 0.01);
    const ts = wx.some((r) => r.ts);
    out.push({
      t,
      measurable: measured ? true : amounts.some((r) => r.amount == null) ? null : false,
      precip: wx.some((r) => r.precip) || amounts.some((r) => r.pGroup),
      ts: ts ? true : wx.some((r) => r.tsno) ? null : false,
      vcts: wx.some((r) => r.vcts),
      // The largest in the hour: every report in it measures from the :55
      // before, and an amount never fell within an hour in the archive.
      amount:
        list.find((x) => x.hourly)!.r.amount == null
          ? null
          : Math.max(...amounts.flatMap((r) => (r.amount == null ? [] : [r.amount]))),
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The chance groups: 0 on its own (most hours), then tens. `hi` is the
 *  label's; a chance above 0 belongs to the last group whose `lo` it
 *  reaches, or to 1 to 9% below 1, so a fractional one (none seen) still
 *  has a group and 0% holds only 0. */
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
  /** Totals of the bins'. */
  hours: number;
  events: number;
  chanceSum: number;
  /** Hours counted without the event but with something short of it
   *  (CHANCE_NEAR). */
  nearMiss: number;
  leadH: { min: number; max: number } | null;
  bins: ChanceBin[];
  /** Every hour counted, in time order. */
  pairs: { valid: string; issued: string; chance: number; event: boolean; near: boolean }[];
}

/**
 * One element's chances against what happened, one row per NWS_ISSUANCES
 * entry, picking the newest issuance at least the row's lead before the
 * hour's start and leaving out hours past the reach of what was gathered,
 * by the same rules as summarizeCeilings (byValidHour, pastReach). An
 * hour whose outcome is unknown (`event` null) is left out.
 */
export function summarizeChances(
  forecasts: readonly ChanceForecast[],
  hours: readonly ReportedHour[],
  element: ChanceElement,
  endReachH = END_REACH_H,
): ChanceRow[] {
  const { byHour, lastIssued } = byValidHour(forecasts);
  const event = CHANCE_EVENT[element];
  const near = CHANCE_NEAR[element];
  return NWS_ISSUANCES.map(({ minLeadH, label }) => {
    const bins: ChanceBin[] = CHANCE_BINS.map((b) => ({ ...b, hours: 0, events: 0, chanceSum: 0 }));
    const pairs: ChanceRow['pairs'] = [];
    const leads: number[] = [];
    for (const h of hours) {
      if (pastReach(h.t, minLeadH, lastIssued, endReachH)) continue;
      const happened = event(h);
      if (happened == null) continue;
      const pick = byHour.get(h.t)?.find((r) => h.t - Date.parse(r.issued) >= minLeadH * MS_H);
      if (!pick) continue;
      if (!(pick.chance >= 0 && pick.chance <= 100)) throw new Error(`summarizeChances: a chance of ${pick.chance}%`);
      const bin = pick.chance === 0 ? bins[0] : (bins.filter((b) => b.lo > 0 && pick.chance >= b.lo).pop() ?? bins[1]);
      bin.hours++;
      bin.chanceSum += pick.chance;
      if (happened) bin.events++;
      pairs.push({ valid: new Date(h.t).toISOString(), issued: pick.issued, chance: pick.chance, event: happened, near: !happened && near(h) });
      leads.push((h.t - Date.parse(pick.issued)) / MS_H);
    }
    const total = (k: 'hours' | 'events' | 'chanceSum') => bins.reduce((a, b) => a + b[k], 0);
    return {
      label,
      minLeadH,
      hours: total('hours'),
      events: total('events'),
      chanceSum: total('chanceSum'),
      nearMiss: pairs.filter((p) => p.near).length,
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

/** Something short of the event, counted beside it: precipitation under
 *  0.01 in., or thunder only in the vicinity. */
export const CHANCE_NEAR: Record<ChanceElement, (h: ReportedHour) => boolean> = {
  probabilityOfPrecipitation: (h) => h.precip,
  probabilityOfThunder: (h) => h.vcts,
};
