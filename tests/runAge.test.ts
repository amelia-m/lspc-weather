import { describe, expect, it } from 'vitest';
import type { SchulzeRecord } from '../src/domain/paritySummary';
import { mismatchByRunAge, mismatchBySplit, runAgeMinutes, runsSeen, type RunsSeen } from '../src/domain/runAge';

const AVAIL = '2026-10-21T17:37:00.000Z';
const meta = (avail: string | null, more: Partial<RunsSeen> = {}): RunsSeen => ({
  init: '2026-10-21T16:00:00.000Z',
  modified: null,
  avail,
  stepS: 3600,
  reads: 3,
  variants: 1,
  ...more,
});
const rec = (at: string, rawMismatch: boolean | null, seen: RunsSeen | null = meta(AVAIL)): SchulzeRecord => ({
  kind: 'schulze',
  at,
  rawMismatch,
  omRuns: { ncep_hrrr_conus: seen, ncep_gfs025: null },
});

describe('runsSeen', () => {
  const one = (init: string, avail: string) => ({ init, modified: null, avail, stepS: 3600 });
  it('keeps the newest run any read saw, and says the servers held different copies', () => {
    // As read on 2026-10-21: one run, two availability times, and a read
    // that failed.
    const seen = runsSeen([one('2026-10-21T16:00:00Z', '2026-10-21T17:39:33Z'), null, one('2026-10-21T16:00:00Z', '2026-10-21T17:37:20Z')]);
    expect(seen).toMatchObject({ avail: '2026-10-21T17:39:33Z', reads: 2, variants: 2 });
  });

  it('takes a newer initialisation over a later availability of an older run', () => {
    const seen = runsSeen([one('2026-10-21T16:00:00Z', '2026-10-21T17:59:00Z'), one('2026-10-21T17:00:00Z', '2026-10-21T18:37:00Z')]);
    expect(seen).toMatchObject({ init: '2026-10-21T17:00:00Z', variants: 2 });
  });

  it('is one version when every read agrees, and null when none answered', () => {
    const a = one('2026-10-21T16:00:00Z', '2026-10-21T17:39:33Z');
    expect(runsSeen([a, { ...a }, a])).toMatchObject({ reads: 3, variants: 1 });
    expect(runsSeen([null, null])).toBeNull();
  });
});

describe('runAgeMinutes', () => {
  it('is the minutes from the newest availability seen to the comparison', () => {
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
      rec(at(-0.2), true), // arrived while the comparison ran: the newest band
      rec(at(14.9), true),
      rec(at(15), false), // the edge goes to the next band
      rec(at(29), true),
      rec(at(45), false),
      rec(at(200), false),
      rec(at(5), null), // not judged
      rec(at(5), true, meta(null)), // no availability time
      { ...rec(at(5), true), kind: 'usairnet' } as unknown as SchulzeRecord,
    ],
    'ncep_hrrr_conus',
  );

  it('counts judged comparisons by minutes since the run, and the flagged ones in each', () => {
    expect(rows.map((r) => [r.fromMin, r.n, r.mismatched])).toEqual([
      [-Infinity, 2, 2],
      [15, 2, 1],
      [30, 1, 0],
      [60, 1, 0],
    ]);
  });
});

describe('mismatchBySplit', () => {
  const t = '2026-10-21T17:49:30.000Z';
  it('counts judged comparisons by whether the metadata reads disagreed', () => {
    const rows = mismatchBySplit(
      [
        rec(t, true, meta(AVAIL, { variants: 2 })),
        rec(t, false, meta(AVAIL, { variants: 2 })),
        rec(t, false),
        rec(t, true),
        rec(t, false),
        rec(t, true, meta(AVAIL, { reads: 1 })), // one read cannot disagree
        rec(t, null, meta(AVAIL, { variants: 2 })), // not judged
        rec(t, true, null),
      ],
      'ncep_hrrr_conus',
    );
    expect(rows).toEqual([
      { serversDisagreed: false, n: 3, mismatched: 1 },
      { serversDisagreed: true, n: 2, mismatched: 1 },
    ]);
  });
});
