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

/** The fields of a Schulze comparison record (scripts/schulzeCompare.live.ts,
 *  one `@@parity` line a run) this reads. */
export interface SchulzeGroundRecord {
  kind: string;
  /** When the comparison ran. */
  at: string;
  /** The hour this app's table showed, "05Z". */
  appHour?: string;
  /** Present when both tables were for the same valid hour. */
  aligned?: unknown;
  ground?: { ourKt?: number | null; ourShownKt?: number | null; theirKt?: number | null };
}

/** One valid hour with both rows: each side's median over that hour's runs. */
export interface GroundHour {
  t: number;
  ours: number;
  theirs: number;
  runs: number;
}

const MS_H = 3_600_000;

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * The comparison records as valid hours. A record counts when both tables
 * were for the same hour (`aligned`) and it carries both ground figures.
 * Its valid hour is the run time rounded to the hour, which is the hour this
 * card snaps to; a record whose `appHour` names another hour is left out
 * rather than guessed at. This side is the figure as the card shows it,
 * whole knots (`ourShownKt`, or `ourKt` rounded where an older record has
 * no shown figure); KPMV reports whole knots too.
 */
export function groundHours(records: readonly SchulzeGroundRecord[]): GroundHour[] {
  const byHour = new Map<number, { ours: number[]; theirs: number[] }>();
  for (const r of records) {
    if (r.kind !== 'schulze' || !r.aligned || !r.ground) continue;
    const ours = r.ground.ourShownKt ?? (r.ground.ourKt == null ? null : Math.round(r.ground.ourKt));
    const theirs = r.ground.theirKt;
    if (ours == null || theirs == null) continue;
    const at = Date.parse(r.at);
    if (!Number.isFinite(at)) continue;
    const t = Math.round(at / MS_H) * MS_H;
    const hh = `${String(new Date(t).getUTCHours()).padStart(2, '0')}Z`;
    if (r.appHour && r.appHour !== hh) continue;
    const h = byHour.get(t) ?? { ours: [], theirs: [] };
    h.ours.push(ours);
    h.theirs.push(theirs);
    byHour.set(t, h);
  }
  return [...byHour]
    .map(([t, h]) => ({ t, ours: median(h.ours), theirs: median(h.theirs), runs: h.ours.length }))
    .sort((a, b) => a.t - b.t);
}

/** One KPMV wind report: when, and the speed in knots. */
export interface WindReport {
  t: number;
  kt: number;
}

/** The mean of KPMV's reports within 30 minutes of `t`, or null when there
 *  are none: KPMV reports every 20 minutes, so an hour normally has three. */
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

/** The hour of the day at `zone`, 0 to 23. */
export function localHour(ms: number, zone: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(ms);
  return Number(h) % 24;
}

export function surfaceRowsTable(
  hours: readonly GroundHour[],
  reports: readonly WindReport[],
  zone: string,
): SurfaceRowsRow[] {
  const paired = hours.flatMap((h) => {
    const m = measuredAt(reports, h.t);
    return m == null ? [] : [{ ...h, measured: m, local: localHour(h.t, zone) }];
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
      measuredMedian: rows.length ? median(rows.map((p) => p.measured)) : null,
      ours: stats(rows.map((p) => p.ours - p.measured)),
      theirs: stats(rows.map((p) => p.theirs - p.measured)),
      nearer,
    };
  });
}
