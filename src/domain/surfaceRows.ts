/**
 * Which forecast Surface row sits nearer the wind KPMV measured: this app's
 * (Open-Meteo's 10 m wind, as the Winds aloft card shows it) or Mark
 * Schulze's (his table's 0 ft row, a straight line through his pressure
 * levels read at the ground). First done by hand on 2026-10-08 over 156
 * hours (docs/markschulze-altitude-reference.md, "Which Surface row is
 * nearer the measured wind"); this is that method written down, so the
 * figure can be taken again as the logs grow (scripts/surfaceRows.ts).
 *
 * Counts, biases and mean errors only. Neither row is the observation, and
 * the Surface wind card reads the observation; this says how far each
 * forecast row sat from it, not which a jumper should use.
 */
import { groundKt, localHour, median, validHourOf, type SchulzeRecord } from './paritySummary';

/** One valid hour with both rows at one point: each side's median over
 *  that hour's runs there. */
export interface GroundHour {
  t: number;
  /** Where both sides were read: the record's `dz`, or `OLD_POINT` for
   *  records from before it was logged (2026-10-08). */
  point: string;
  ours: number;
  theirs: number;
  runs: number;
}

/** The point records without `dz` were taken at (SchulzeRecord.dz). */
export const OLD_POINT = '40.8675,-96.11';

/**
 * The comparison records as valid hours, by the point they were read at, so
 * one hour's median never pools runs from two points. A record counts when
 * both tables were for the same hour (`aligned`) and it carries both ground
 * figures, read as the #parity summary reads them (`groundKt`: the card's
 * whole knots; KPMV reports whole knots too) on the hour the summary gives
 * it (`validHourOf`: the hour this card showed).
 */
export function groundHours(records: readonly SchulzeRecord[]): GroundHour[] {
  const byHour = new Map<string, { t: number; point: string; ours: number[]; theirs: number[] }>();
  for (const r of records) {
    if (r.kind !== 'schulze' || !r.aligned) continue;
    const g = groundKt(r);
    if (!g) continue;
    const t = validHourOf(r);
    if (!Number.isFinite(t)) continue;
    const point = r.dz ?? OLD_POINT;
    const key = `${t} ${point}`;
    const h = byHour.get(key) ?? { t, point, ours: [], theirs: [] };
    h.ours.push(g.ours);
    h.theirs.push(g.theirs);
    byHour.set(key, h);
  }
  return [...byHour.values()]
    .map((h) => ({ t: h.t, point: h.point, ours: median(h.ours)!, theirs: median(h.theirs)!, runs: h.ours.length }))
    .sort((a, b) => a.t - b.t || a.point.localeCompare(b.point));
}

/** One KPMV wind report: when, and the speed in knots. */
export interface WindReport {
  t: number;
  kt: number;
}

/** The mean of KPMV's reports within 30 minutes of `t`, or null when there
 *  are none: KPMV reports every 20 minutes, so an hour normally has three.
 *  A scan per hour: a few hundred hours against a few thousand reports. */
export function measuredAt(reports: readonly WindReport[], t: number): number | null {
  const near = reports.filter((r) => Math.abs(r.t - t) <= 30 * 60_000).map((r) => r.kt);
  return near.length ? near.reduce((a, b) => a + b, 0) / near.length : null;
}

export interface SideStats {
  /** Mean of forecast minus measured, kt. */
  bias: number;
  /** Mean of the absolute difference, kt. */
  mae: number;
}

export interface SurfaceRowsRow {
  label: string;
  n: number;
  measuredMedian: number | null;
  ours: SideStats | null;
  theirs: SideStats | null;
  /** Hours each side was nearer the measured wind, and hours equally near. */
  nearer: { ours: number; theirs: number; tied: number };
}

/** The rows of the table: every hour, then night and day by the clock at
 *  the DZ (7 PM to 7 AM and the rest), then the hours jumping mostly
 *  happens in, 9 AM to 6 PM, as the 2026-10-08 table had them. */
export const SURFACE_ROW_GROUPS: readonly { label: string; keep: (localHour: number) => boolean }[] = [
  { label: 'all', keep: () => true },
  { label: 'night, 7 PM to 7 AM', keep: (h) => h >= 19 || h < 7 },
  { label: 'day, 7 AM to 7 PM', keep: (h) => h >= 7 && h < 19 },
  { label: '9 AM to 6 PM', keep: (h) => h >= 9 && h < 18 },
];

export function surfaceRowsTable(hours: readonly GroundHour[], reports: readonly WindReport[]): SurfaceRowsRow[] {
  const paired = hours.flatMap((h) => {
    const m = measuredAt(reports, h.t);
    return m == null ? [] : [{ ...h, measured: m, local: localHour(h.t) }];
  });
  const stats = (d: number[]): SideStats | null =>
    d.length ? { bias: d.reduce((a, b) => a + b, 0) / d.length, mae: d.reduce((a, b) => a + Math.abs(b), 0) / d.length } : null;
  return SURFACE_ROW_GROUPS.map(({ label, keep }) => {
    const rows = paired.filter((p) => keep(p.local));
    const nearer = { ours: 0, theirs: 0, tied: 0 };
    for (const p of rows) {
      const a = Math.abs(p.ours - p.measured);
      const b = Math.abs(p.theirs - p.measured);
      if (a < b) nearer.ours++;
      else if (b < a) nearer.theirs++;
      else nearer.tied++;
    }
    return {
      label,
      n: rows.length,
      measuredMedian: median(rows.map((p) => p.measured)),
      ours: stats(rows.map((p) => p.ours - p.measured)),
      theirs: stats(rows.map((p) => p.theirs - p.measured)),
      nearer,
    };
  });
}
