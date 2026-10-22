/**
 * The gridpoint's wind, gust, direction, temperature, visibility and
 * rainfall, as the card read them, against what KPMV reported
 * (docs/kept-forecasts-vs-kpmv.md). The ceilings and the rain and thunder
 * chances from the same snapshots are scored elsewhere (ceilingHeights.ts,
 * chances.ts); these are the rest of what the keeper holds.
 *
 * Spreads and counts only, forecast minus reported. Nothing here grades
 * the forecast, and the dashboard shows none of it.
 */
import { byValidHour, END_REACH_H, keptHours, pastReach, type KeptGridpointSnapshot } from './ceilingHeights';
import { NWS_ISSUANCES, reportNear, type MetarRecord } from './cloudCoverSources';
import { metarWindGroup } from './surfaceWindSources';
import { parseValidTime, tempsFromRaw } from './normalize';
import { reportedHours } from './chances';
import { spreadOf, type Spread } from './paritySummary';

const MS_H = 3_600_000;
const KMH_PER_KT = 1.852;
const M_PER_SM = 1609.344;

/** The instant fields, each hour's value valid for the whole hour. */
export const INSTANT_ELEMENTS = ['windSpeed', 'windGust', 'windDirection', 'temperature', 'visibility'] as const;
export type InstantElement = (typeof INSTANT_ELEMENTS)[number];

/** What each is converted to, from the units the API served (all of them
 *  read in the snapshots on 2026-10-22). */
const TO_UNIT: Record<InstantElement, { uom: string; f: (v: number) => number }> = {
  windSpeed: { uom: 'wmoUnit:km_h-1', f: (v) => v / KMH_PER_KT },
  windGust: { uom: 'wmoUnit:km_h-1', f: (v) => v / KMH_PER_KT },
  windDirection: { uom: 'wmoUnit:degree_(angle)', f: (v) => v },
  temperature: { uom: 'wmoUnit:degC', f: (v) => v },
  visibility: { uom: 'wmoUnit:m', f: (v) => v / M_PER_SM },
};

export interface KeptValue {
  issued: string;
  valid: string;
  /** kt, degrees true, °C or SM. */
  value: number;
}

/** One instant element of a kept snapshot, one record per hour, in the
 *  units above. A null value is no forecast and gives no record. */
export function keptInstantRecords(snap: KeptGridpointSnapshot, element: InstantElement): KeptValue[] {
  const kept = keptHours(snap, element);
  if (!kept) return [];
  const { uom, f } = TO_UNIT[element];
  if (kept.uom !== uom) throw new Error(`keptInstantRecords: ${element} in ${kept.uom ?? 'no unit'}`);
  return kept.hours.flatMap(({ valid, value }) => (value == null ? [] : [{ issued: kept.issued, valid, value: f(value) }]));
}

/** One report's instant readings. */
export interface Instant {
  t: number;
  /** kt; 0 when calm. */
  spd: number | null;
  /** The `G` figure; null when the report gave none. */
  gust: number | null;
  /** Degrees true; null when calm or variable (`VRB`). */
  dir: number | null;
  tempC: number | null;
  /** SM, from the body's visibility group. KPMV, an automated station,
   *  reports nothing above 10 SM; `M1/4SM` (less than) reads as 1/4. */
  visSm: number | null;
}

/** The visibility group, whole, fraction or both ("1 1/4SM"). */
export function metarVisibilitySm(raw: string): number | null {
  const toks = raw.split(' RMK ')[0].split(/\s+/);
  const i = toks.findIndex((t) => /^M?(\d+|\d+\/\d+)SM$/.test(t));
  if (i < 0) return null;
  const num = (s: string): number => {
    const [a, b] = s.split('/');
    return b == null ? Number(a) : Number(a) / Number(b);
  };
  const part = toks[i].replace(/^M/, '').replace(/SM$/, '');
  const whole = i > 0 && /^\d+$/.test(toks[i - 1]) && part.includes('/') ? Number(toks[i - 1]) : 0;
  return whole + num(part);
}

export function readInstant(m: MetarRecord): Instant {
  const w = metarWindGroup(m.raw);
  const wm = w ? /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$/.exec(w) : null;
  const spd = wm ? Number(wm[2]) : null;
  return {
    t: Date.parse(m.obsAt),
    spd,
    gust: wm?.[3] != null ? Number(wm[3]) : null,
    dir: wm && wm[1] !== 'VRB' && spd !== 0 ? Number(wm[1]) : null,
    tempC: tempsFromRaw(m.raw)?.tempC ?? null,
    visSm: metarVisibilitySm(m.raw),
  };
}

/** a − b in degrees, in (−180, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = (((a - b) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

/** One paired hour: the forecast picked for it and the report nearest it. */
export interface InstantPair {
  t: number;
  issued: string;
  fc: Partial<Record<InstantElement, number>>;
  obs: Instant;
}

/** The pairs for one lead row: the newest issuance at least `minLeadH`
 *  before the hour, per element (an element an issuance left null gives
 *  way to the one before it), and the report within REPORT_WINDOW_MIN of
 *  the hour's start, as the ceilings are paired. Hours past the reach of
 *  what was gathered are left out (pastReach, END_REACH_H). */
export function pairInstants(
  snaps: readonly KeptGridpointSnapshot[],
  metars: readonly MetarRecord[],
  minLeadH: number,
  endReachH = END_REACH_H,
): InstantPair[] {
  const reports = metars.map(readInstant).sort((a, b) => a.t - b.t);
  const per = INSTANT_ELEMENTS.map((el) => ({ el, ...byValidHour(snaps.flatMap((s) => keptInstantRecords(s, el))) }));
  const hours = [...new Set(per.flatMap((p) => [...p.byHour.keys()]))].sort((a, b) => a - b);
  const out: InstantPair[] = [];
  for (const t of hours) {
    const obs = reportNear(reports, t);
    if (!obs) continue;
    const fc: InstantPair['fc'] = {};
    let issued: string | null = null;
    for (const { el, byHour, lastIssued } of per) {
      if (pastReach(t, minLeadH, lastIssued, endReachH)) continue;
      const pick = byHour.get(t)?.find((r) => t - Date.parse(r.issued) >= minLeadH * MS_H);
      if (!pick) continue;
      fc[el] = pick.value;
      // The lead reported is the first element's picked, the wind speed's
      // where it has one: each element's own pick follows the same rule.
      issued ??= pick.issued;
    }
    if (issued) out.push({ t, issued, fc, obs });
  }
  return out;
}

/** Visibility at or above which KPMV's reports stop: 10 SM. The forecast
 *  runs past it (16,093 m is 10 SM; 15 km and more are served), so both are
 *  read capped there. */
export const VIS_CAP_SM = 10;

/** The forecast's visibility as a report would read it: whole miles from
 *  3 SM, quarters below. The API serves metres (16,080 m, 9.99 SM), and
 *  unrounded nearly every hour under 10 SM was a hair under it. KPMV's
 *  reports in the 2026-10-13 to 10-22 window read 10, 7, 5, 4, 3, 2 1/2 and
 *  2 SM, all on those steps. */
export function asReported(sm: number): number {
  return sm >= 2.875 ? Math.round(sm) : Math.round(sm * 4) / 4;
}

export interface InstantRow {
  label: string;
  minLeadH: number;
  hours: number;
  leadH: { min: number; max: number } | null;
  first: string | null;
  last: string | null;
  /** kt, forecast minus reported. */
  speed: Spread | null;
  /** The two means, so a spread's sign reads against the size of the wind. */
  speedMeans: { fc: number; obs: number } | null;
  /** The signed mean by UTC hour of the day: where the speed spread sits. */
  speedByUtcHour: { hour: number; n: number; mean: number }[];
  /** Forecast gust minus the reported gust, in hours the report gave one. */
  gustWhenReported: Spread | null;
  /** Forecast gust minus the reported speed, in hours the report gave no
   *  gust: how far above the steady wind the forecast put a gust that the
   *  station did not report. */
  gustWhenNone: Spread | null;
  /** Hours the report gave a gust, of those with a forecast gust. */
  gustReported: { hours: number; of: number };
  /** Degrees, forecast minus reported, split by the reported speed: a
   *  light wind's direction is the least settled. Calm and VRB reports
   *  give none. */
  direction: { under10kt: Spread | null; from10kt: Spread | null };
  /** °C. */
  temperature: Spread | null;
  temperatureByUtcHour: { hour: number; n: number; mean: number }[];
  /** Both capped at VIS_CAP_SM, the forecast read as a report would be
   *  (asReported): hours either side was under it, and the spread over
   *  those hours. */
  visibility: { hours: number; reportedUnder: number; forecastUnder: number; bothUnder: number; spread: Spread | null };
}

const r2 = (x: number): number => Math.round(x * 100) / 100;

function byUtcHour(pairs: readonly { t: number; d: number }[]): { hour: number; n: number; mean: number }[] {
  const acc = new Map<number, number[]>();
  for (const { t, d } of pairs) {
    const h = new Date(t).getUTCHours();
    acc.set(h, [...(acc.get(h) ?? []), d]);
  }
  return [...acc]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, ds]) => ({ hour, n: ds.length, mean: r2(ds.reduce((a, b) => a + b, 0) / ds.length) }));
}

/** One row per NWS_ISSUANCES entry. A METAR reports whole knots and the
 *  forecast's knots are whole too (km/h of whole knots, read 2026-10-22),
 *  so speeds are compared rounded to the knot, as the dashboard prints
 *  them. */
export function summarizeInstants(
  snaps: readonly KeptGridpointSnapshot[],
  metars: readonly MetarRecord[],
  endReachH = END_REACH_H,
): InstantRow[] {
  return NWS_ISSUANCES.map(({ minLeadH, label }) => {
    const pairs = pairInstants(snaps, metars, minLeadH, endReachH);
    const speed: { t: number; d: number; fc: number; obs: number }[] = [];
    const gustRep: number[] = [];
    const gustNone: number[] = [];
    const dirLight: number[] = [];
    const dirStrong: number[] = [];
    const temp: { t: number; d: number }[] = [];
    const vis: number[] = [];
    let repUnder = 0;
    let fcUnder = 0;
    let bothUnder = 0;
    const leads: number[] = [];
    for (const p of pairs) {
      leads.push((p.t - Date.parse(p.issued)) / MS_H);
      const { fc, obs } = p;
      if (fc.windSpeed != null && obs.spd != null) {
        const f = Math.round(fc.windSpeed);
        speed.push({ t: p.t, d: f - obs.spd, fc: f, obs: obs.spd });
      }
      if (fc.windGust != null && obs.spd != null) {
        const g = Math.round(fc.windGust);
        if (obs.gust != null) gustRep.push(g - obs.gust);
        else gustNone.push(g - obs.spd);
      }
      if (fc.windDirection != null && obs.dir != null && obs.spd != null) {
        (obs.spd < 10 ? dirLight : dirStrong).push(angleDiff(fc.windDirection, obs.dir));
      }
      if (fc.temperature != null && obs.tempC != null) temp.push({ t: p.t, d: fc.temperature - obs.tempC });
      if (fc.visibility != null && obs.visSm != null) {
        const f = Math.min(asReported(fc.visibility), VIS_CAP_SM);
        const o = Math.min(obs.visSm, VIS_CAP_SM);
        const fu = f < VIS_CAP_SM;
        const ou = o < VIS_CAP_SM;
        if (fu) fcUnder++;
        if (ou) repUnder++;
        if (fu && ou) bothUnder++;
        if (fu || ou) vis.push(f - o);
      }
    }
    const mean = (xs: number[]): number => r2(xs.reduce((a, b) => a + b, 0) / xs.length);
    return {
      label,
      minLeadH,
      hours: pairs.length,
      leadH: leads.length ? { min: r2(Math.min(...leads)), max: r2(Math.max(...leads)) } : null,
      first: pairs.length ? new Date(pairs[0].t).toISOString() : null,
      last: pairs.length ? new Date(pairs[pairs.length - 1].t).toISOString() : null,
      speed: spreadOf(speed.map((s) => s.d)),
      speedMeans: speed.length ? { fc: mean(speed.map((s) => s.fc)), obs: mean(speed.map((s) => s.obs)) } : null,
      speedByUtcHour: byUtcHour(speed),
      gustWhenReported: spreadOf(gustRep),
      gustWhenNone: spreadOf(gustNone),
      gustReported: { hours: gustRep.length, of: gustRep.length + gustNone.length },
      direction: { under10kt: spreadOf(dirLight), from10kt: spreadOf(dirStrong) },
      temperature: spreadOf(temp.map((x) => x.d)),
      temperatureByUtcHour: byUtcHour(temp),
      visibility: { hours: vis.length, reportedUnder: repUnder, forecastUnder: fcUnder, bothUnder, spread: spreadOf(vis) },
    };
  });
}

/** One six-hour rainfall period: the forecast total and what KPMV's `P`
 *  groups add up to over the same hours. */
export interface RainPeriod {
  start: string;
  issued: string;
  /** in. */
  fc: number;
  obs: number;
}

/**
 * The gridpoint's `quantitativePrecipitation`, a total over each period it
 * names (`PT6H`), against the sum of KPMV's hourly amounts over the
 * period's clock hours (reportedHours' `amount`: the :55 report's `P`,
 * which runs from the :55 report before). A period is not spread over its
 * hours as the instant fields are: its value is the period's total. Each
 * lead row picks, per period, the newest issuance at least `minLeadH`
 * before the period's start; a period with any hour unknown (no :55
 * report, or a gauge that could not say) is left out.
 */
export function summarizeRain(
  snaps: readonly KeptGridpointSnapshot[],
  metars: readonly MetarRecord[],
): { label: string; minLeadH: number; periods: RainPeriod[]; fcTotal: number; obsTotal: number }[] {
  const amountAt = new Map(reportedHours(metars).map((h) => [h.t, h.amount]));
  const records: { issued: string; valid: string; hours: number; mm: number }[] = [];
  for (const s of snaps) {
    const gp = s.nwsGridpoint;
    if (!gp || 'error' in gp || !gp.updateTime) continue;
    const q = gp.properties.quantitativePrecipitation;
    if (!q) continue;
    if (q.uom !== 'wmoUnit:mm') throw new Error(`summarizeRain: quantitativePrecipitation in ${q.uom ?? 'no unit'}`);
    for (const { validTime, value } of q.values) {
      const span = parseValidTime(validTime);
      if (!span || value == null) continue;
      records.push({ issued: gp.updateTime, valid: new Date(span.start).toISOString(), hours: span.hours, mm: value });
    }
  }
  const { byHour } = byValidHour(records);
  return NWS_ISSUANCES.map(({ minLeadH, label }) => {
    const periods: RainPeriod[] = [];
    for (const [t, rs] of [...byHour].sort((a, b) => a[0] - b[0])) {
      const pick = rs.find((r) => t - Date.parse(r.issued) >= minLeadH * MS_H);
      if (!pick) continue;
      let obs = 0;
      let known = true;
      for (let h = 0; h < pick.hours; h++) {
        const a = amountAt.get(t + h * MS_H);
        if (a == null) {
          known = false;
          break;
        }
        obs += a;
      }
      if (!known) continue;
      periods.push({ start: new Date(t).toISOString(), issued: pick.issued, fc: r2(pick.mm / 25.4), obs: r2(obs) });
    }
    return {
      label,
      minLeadH,
      periods,
      fcTotal: r2(periods.reduce((a, p) => a + p.fc, 0)),
      obsTotal: r2(periods.reduce((a, p) => a + p.obs, 0)),
    };
  });
}
