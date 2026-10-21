/**
 * Whether the winds-aloft comparison's "different forecast run" flag
 * (`rawMismatch`) clusters in the minutes after Open-Meteo makes a new run
 * available.
 *
 * Seen since 2026-09-23: for the same hour, this app's table and Mark
 * Schulze's tool, both reading Open-Meteo, are sometimes on different runs,
 * most often between half past and ten to the hour (docs/open-questions.md,
 * "Which forecast run the winds-aloft request is served"). The surface-wind
 * sample of 2026-10-09 found that HRRR became available near the top of the
 * hour (00:48Z and 01:52Z that evening). For about twelve minutes after a
 * new run arrived, successive requests got the new run or the old one in
 * turn. Open-Meteo's model-updates page says its redundant servers can
 * differ "while the data is being copied" (read 2026-10-09). If that is
 * the cause, mismatches should sit in the first quarter hour after a run's
 * availability time, whatever the minute of the clock. If they do not, the
 * cause is elsewhere: the tool's next-hour request, say.
 *
 * Counts only: how many comparisons fell in each band of minutes since the
 * latest run, and how many of those were flagged. The flag is itself a
 * heuristic (two raw levels within 150 ft more than 5° or 2 kt apart), not
 * a run identifier.
 */
import type { SchulzeRecord } from './paritySummary';

/** Minutes since a run became available: the first quarter hour, when the
 *  servers may still differ, then wider bands. */
export const RUN_AGE_BANDS: readonly { fromMin: number; toMin: number }[] = [
  { fromMin: 0, toMin: 15 },
  { fromMin: 15, toMin: 30 },
  { fromMin: 30, toMin: 60 },
  { fromMin: 60, toMin: Infinity },
];

/** Minutes from `domain`'s latest availability time to the comparison's
 *  start, or null when the record has no usable metadata for it. A negative
 *  age (the metadata newer than the run's own clock) is returned as is and
 *  falls in no band. */
export function runAgeMinutes(r: SchulzeRecord, domain: string): number | null {
  const avail = r.omRuns?.[domain]?.avail;
  if (avail == null) return null;
  const a = Date.parse(avail);
  const at = Date.parse(r.at);
  return Number.isFinite(a) && Number.isFinite(at) ? (at - a) / 60_000 : null;
}

export interface RunAgeRow {
  fromMin: number;
  toMin: number;
  /** Comparisons in the band whose flag could be judged. */
  n: number;
  /** Of those, flagged as on different runs. */
  mismatched: number;
}

export function mismatchByRunAge(records: readonly SchulzeRecord[], domain: string): RunAgeRow[] {
  const rows = RUN_AGE_BANDS.map((b) => ({ ...b, n: 0, mismatched: 0 }));
  for (const r of records) {
    if (r.kind !== 'schulze' || typeof r.rawMismatch !== 'boolean') continue;
    const age = runAgeMinutes(r, domain);
    if (age == null) continue;
    const row = rows.find((b) => age >= b.fromMin && age < b.toMin);
    if (!row) continue;
    row.n += 1;
    if (r.rawMismatch) row.mismatched += 1;
  }
  return rows;
}
