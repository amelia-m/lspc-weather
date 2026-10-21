import { describe, expect, it } from 'vitest';
import type { SchulzeRecord } from '../src/domain/paritySummary';
import { mismatchByRunAge, runAgeMinutes } from '../src/domain/runAge';

const AVAIL = '2026-10-21T17:37:00.000Z';
const meta = (avail: string | null) => ({ init: null, modified: null, avail, stepS: 3600 });
const rec = (at: string, rawMismatch: boolean | null, avail: string | null = AVAIL): SchulzeRecord => ({
  kind: 'schulze',
  at,
  rawMismatch,
  omRuns: { ncep_hrrr_conus: meta(avail), ncep_gfs025: null },
});

describe('runAgeMinutes', () => {
  it('is the minutes from the model’s latest availability to the comparison', () => {
    expect(runAgeMinutes(rec('2026-10-21T17:49:30.000Z', false), 'ncep_hrrr_conus')).toBe(12.5);
  });

  it('is null for a model with no metadata, or a record from before it was logged', () => {
    expect(runAgeMinutes(rec('2026-10-21T17:49:30.000Z', false), 'ncep_gfs025')).toBeNull();
    expect(runAgeMinutes({ kind: 'schulze', at: '2026-10-21T17:49:30.000Z', rawMismatch: true }, 'ncep_hrrr_conus')).toBeNull();
  });
});

describe('mismatchByRunAge', () => {
  const at = (min: number) => new Date(Date.parse(AVAIL) + min * 60_000).toISOString();
  const rows = mismatchByRunAge(
    [
      rec(at(0), true), // the moment it became available: the first band
      rec(at(14.9), true),
      rec(at(15), false), // the edge goes to the next band
      rec(at(29), true),
      rec(at(45), false),
      rec(at(200), false),
      rec(at(5), null), // not judged
      rec(at(-3), true), // metadata newer than the run: no band
      rec(at(5), true, null), // no availability time
      { ...rec(at(5), true), kind: 'usairnet' } as unknown as SchulzeRecord,
    ],
    'ncep_hrrr_conus',
  );

  it('counts judged comparisons by minutes since the run, and the flagged ones in each', () => {
    expect(rows.map((r) => [r.fromMin, r.n, r.mismatched])).toEqual([
      [0, 2, 2],
      [15, 2, 1],
      [30, 1, 0],
      [60, 1, 0],
    ]);
  });
});
