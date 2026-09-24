import { describe, expect, it } from 'vitest';
import {
  median,
  parseParityLines,
  percentile,
  summarizeParity,
  type ParityRecord,
} from '../src/domain/paritySummary';

const NOW = Date.parse('2026-09-25T12:00:00Z');

const schulze = (
  at: string,
  rows: [number, number, number][],
  extra: Partial<Extract<ParityRecord, { kind: 'schulze' }>> = {},
): ParityRecord => ({
  kind: 'schulze',
  at,
  appHour: '02Z',
  pageHour: '01Z',
  aligned: { rows: rows.map(([ft, dDir, dSpd]) => ({ ft, dDir, dSpd, dT: null })) },
  unaligned: { hoursDiffer: true, maxDir: 50 },
  rawMismatch: false,
  ground: { ourKt: 6, theirKt: 12 },
  ...extra,
});

describe('summarizeParity', () => {
  it('spreads per altitude use the median and the nearest-rank 90th percentile, not the mean', () => {
    // Nine runs within 2° and one stale-run outlier at 40°: a mean would say
    // 5.8°, which describes no run. The median says 2°; with ten runs the
    // nearest-rank 90th percentile is still the ninth value, so it says 2° too
    // and the outlier shows in the maximum and in the count of runs over 10°.
    const records = [
      ...Array.from({ length: 9 }, (_, i) => schulze(`2026-09-24T0${i}:00:00Z`, [[9000, 2, 1]])),
      schulze('2026-09-24T10:00:00Z', [[9000, 40, 1]]),
    ];
    const s = summarizeParity(records, NOW);
    const row = s.schulze.byAltitude.find((r) => r.ft === 9000)!;
    expect(row.n).toBe(10);
    expect(row.dir.medianAbs).toBe(2);
    expect(row.dir.p90Abs).toBe(2);
    expect(row.dir.maxAbs).toBe(40);
    expect(row.dir.minAbs).toBe(2);
    expect(row.dir.meanAbs).toBe(5.8);
    // the signed mean keeps the direction of the gap: every run had the
    // dashboard reading the higher direction
    expect(row.dir.mean).toBe(5.8);
    expect(s.schulze.runsWithRowOver10Deg).toBe(1);
    expect(s.schulze.runsWithRowOver3Kt).toBe(0);
  });

  it('counts the unaligned view, raw mismatches and the ground ratio separately from the aligned rows', () => {
    const records = [
      schulze('2026-09-24T01:00:00Z', [[1000, 1, 0]], { unaligned: { hoursDiffer: false, maxDir: 1 } }),
      schulze('2026-09-24T01:40:00Z', [[1000, 1, 0]], { unaligned: { hoursDiffer: true, maxDir: 50 }, rawMismatch: true }),
      schulze('2026-09-24T02:40:00Z', [[1000, 1, 0]], { unaligned: { hoursDiffer: true, maxDir: 30 } }),
    ];
    const s = summarizeParity(records, NOW);
    expect(s.schulze.unaligned).toEqual({ runs: 3, hoursDiffered: 2, medianMaxDirWhenDiffer: 40, p90MaxDirWhenDiffer: 50 });
    expect(s.schulze.rawMismatch).toEqual({ judged: 3, mismatched: 1 });
    expect(s.schulze.ground).toEqual({ n: 3, medianOurKt: 6, medianTheirKt: 12, medianRatio: 2 });
    expect(s.from).toBe('2026-09-24T01:00:00.000Z');
    expect(s.to).toBe('2026-09-24T02:40:00.000Z');
  });

  it('keeps unreadable runs in the count and out of the spreads', () => {
    const records: ParityRecord[] = [
      schulze('2026-09-24T01:00:00Z', [[1000, 3, 1]]),
      { kind: 'schulze', at: '2026-09-24T01:15:00Z', error: 'HTTP 429' },
      { kind: 'schulze', at: '2026-09-24T01:30:00Z', aligned: null, unaligned: { hoursDiffer: false, maxDir: null } },
    ];
    const s = summarizeParity(records, NOW);
    expect(s.schulze.runs).toBe(3);
    expect(s.schulze.unreadable).toBe(1);
    expect(s.schulze.aligned).toBe(1);
    expect(s.schulze.byAltitude[0].n).toBe(1);
    expect(s.schulze.byAltitude[0].dir.meanAbs).toBe(3);
  });

  it('tallies usairnet agreement per field and how often both sides showed the same report', () => {
    const records: ParityRecord[] = [
      { kind: 'usairnet', at: '2026-09-24T01:00:00Z', sameReport: true, fields: [{ name: 'clouds', same: true }, { name: 'dew point °F', same: false, delta: -1 }] },
      { kind: 'usairnet', at: '2026-09-24T01:15:00Z', sameReport: false, fields: [{ name: 'clouds', same: true }, { name: 'dew point °F', same: true, delta: 0 }] },
      { kind: 'usairnet', at: '2026-09-24T01:45:00Z', sameReport: true, fields: [{ name: 'clouds', same: true }, { name: 'dew point °F', same: false, delta: -3 }] },
      { kind: 'usairnet', at: '2026-09-24T01:30:00Z', error: 'HTTP 503' },
    ];
    const s = summarizeParity(records, NOW);
    expect(s.usairnet).toEqual({
      runs: 4,
      unreadable: 1,
      sameReport: 2,
      fields: [
        // a text field has agreement but no gap
        { name: 'clouds', n: 3, agree: 3, spread: null },
        // gaps -1, 0, -3: average 1.33 apart, from 0 to 3, and the sign says
        // the dashboard read lower every time it differed
        {
          name: 'dew point °F',
          n: 3,
          agree: 1,
          spread: { n: 3, meanAbs: 1.33, medianAbs: 1, p90Abs: 3, minAbs: 0, maxAbs: 3, mean: -1.33 },
        },
      ],
    });
  });

  it('is empty, not broken, with no records', () => {
    const s = summarizeParity([], NOW);
    expect(s.from).toBeNull();
    expect(s.schulze.byAltitude).toEqual([]);
    expect(s.schulze.ground.medianRatio).toBeNull();
    expect(s.usairnet.fields).toEqual([]);
  });
});

describe('parseParityLines', () => {
  it('takes only the tagged lines and survives a bad one', () => {
    const log = [
      '2026-09-24T01:00:00Z === Winds aloft vs Mark Schulze ===',
      '2026-09-24T01:00:01Z @@parity {"kind":"schulze","at":"2026-09-24T01:00:00Z","aligned":null}',
      '@@parity {"kind":"usairnet","at":"2026-09-24T01:00:02Z","sameReport":true,"fields":[]}',
      '@@parity {"kind":"schulze","at":"2026-09-24T01:00:03Z",  truncated',
      '@@parity {"kind":"other","at":"2026-09-24T01:00:04Z"}',
    ].join('\n');
    const records = parseParityLines(log);
    expect(records.map((r) => r.kind)).toEqual(['schulze', 'usairnet']);
  });
});

describe('median and percentile', () => {
  it('median averages the two middle values of an even sample', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([5])).toBe(5);
    expect(median([])).toBeNull();
  });
  it('percentile is nearest-rank: an observed value, never interpolated', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
    expect(percentile([7], 0.9)).toBe(7);
    expect(percentile([], 0.9)).toBeNull();
  });
});
