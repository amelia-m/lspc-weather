import { describe, expect, it } from 'vitest';
import type { SchulzeRecord } from '../src/domain/paritySummary';
import { groundHours, measuredAt, OLD_POINT, surfaceRowsTable, type WindReport } from '../src/domain/surfaceRows';

const H = 3_600_000;
const T = Date.parse('2026-10-10T15:00:00Z'); // 10 AM CDT
const DZ = '40.8703,-96.1085';
const rec = (at: string, ours: number | null, theirs: number | null, o: Partial<SchulzeRecord> = {}): SchulzeRecord => ({
  kind: 'schulze',
  at,
  appHour: `${at.slice(11, 13)}Z`,
  aligned: { rows: [] },
  ground: { ourKt: ours == null ? null : ours + 0.3, ourShownKt: ours, theirKt: theirs },
  dz: DZ,
  ...o,
});

describe('groundHours', () => {
  it('places each run on its hour and takes each side’s median over the hour’s runs', () => {
    const hs = groundHours([
      rec('2026-10-10T14:40:00Z', 6, 9, { appHour: '15Z' }),
      rec('2026-10-10T15:05:00Z', 8, 11),
      rec('2026-10-10T15:20:00Z', 7, 10),
    ]);
    expect(hs).toEqual([{ t: T, point: DZ, ours: 7, theirs: 10, runs: 3 }]);
    // An even number of runs takes the mean of the middle two.
    const [even] = groundHours([rec('2026-10-10T15:05:00Z', 6, 9), rec('2026-10-10T15:20:00Z', 9, 12)]);
    expect(even).toMatchObject({ ours: 7.5, theirs: 10.5, runs: 2 });
  });

  it('uses the shown figure, else the raw one rounded as the card rounds it', () => {
    const [h] = groundHours([{ ...rec('2026-10-10T15:00:00Z', null, 9), ground: { ourKt: 6.6, theirKt: 9 } }]);
    expect(h.ours).toBe(7);
  });

  it('leaves out a run on unaligned tables, one missing a side, and another kind', () => {
    expect(
      groundHours([
        rec('2026-10-10T15:00:00Z', 6, 9, { aligned: null }),
        rec('2026-10-10T15:00:00Z', 6, null),
        { ...rec('2026-10-10T15:00:00Z', 6, 9), kind: 'usairnet' } as unknown as SchulzeRecord,
      ]),
    ).toEqual([]);
  });

  it('places a run on the hour the card showed, as the #parity summary does, not the nearest hour', () => {
    // Run at 15:25Z, which rounds to 15Z, with the card showing 16Z.
    expect(groundHours([rec('2026-10-10T15:25:00Z', 6, 9, { appHour: '16Z' })])[0].t).toBe(T + H);
  });

  it('keeps each point apart, so one hour never pools runs from two points', () => {
    const hs = groundHours([
      rec('2026-10-10T15:05:00Z', 6, 9, { dz: undefined }),
      rec('2026-10-10T15:20:00Z', 10, 13),
    ]);
    expect(hs.map((h) => [h.point, h.ours])).toEqual([
      [OLD_POINT, 6],
      [DZ, 10],
    ]);
  });
});

describe('measuredAt', () => {
  const reports: WindReport[] = [
    { t: T - 31 * 60_000, kt: 30 },
    { t: T - 25 * 60_000, kt: 4 },
    { t: T + 15 * 60_000, kt: 8 },
    { t: T + 30 * 60_000, kt: 9 },
  ];
  it('means the reports within 30 minutes of the hour, the edge included', () => {
    expect(measuredAt(reports, T)).toBe(7);
  });
  it('gives nothing for an hour with no report', () => {
    expect(measuredAt(reports, T + 5 * H)).toBeNull();
  });
});

describe('surfaceRowsTable', () => {
  // 10 AM: KPMV 6 kt, this app 7, Schulze 10 (this app nearer).
  // 11 PM: KPMV 2 kt, this app 5, Schulze 5 (tied).
  // 1 PM: KPMV 9 kt, this app 5, Schulze 10 (Schulze nearer).
  const hours = [
    { t: T, ours: 7, theirs: 10 },
    { t: T + 13 * H, ours: 5, theirs: 5 },
    { t: T + 3 * H, ours: 5, theirs: 10 },
    // No report near this hour, so it is not counted.
    { t: T + 30 * H, ours: 5, theirs: 5 },
    // 7 AM at the DZ (CDT) exactly: day, not night. This app nearer.
    { t: T - 3 * H, ours: 3, theirs: 9 },
  ].map((h) => ({ ...h, point: DZ, runs: 1 }));
  const reports: WindReport[] = [
    { t: T, kt: 6 },
    { t: T + 13 * H, kt: 2 },
    { t: T + 3 * H, kt: 9 },
    { t: T - 3 * H, kt: 3 },
  ];
  const [all, night, day, jumping] = surfaceRowsTable(hours, reports);

  it('counts which side was nearer, and ties', () => {
    // Measured 3, 6, 9 and 2: the median of four is the mean of 3 and 6.
    expect(all).toMatchObject({ n: 4, nearer: { ours: 2, theirs: 1, tied: 1 }, measuredMedian: 4.5 });
  });

  it('gives each side’s bias and mean error against the measured wind', () => {
    // This app: +1, +3, −4, 0. Schulze: +4, +3, +1, +6.
    expect(all.ours).toEqual({ bias: 0, mae: 2 });
    expect(all.theirs).toEqual({ bias: 3.5, mae: 3.5 });
  });

  it('splits the hours by the clock at the DZ, 7 AM counting as day', () => {
    expect(night).toMatchObject({ n: 1, nearer: { ours: 0, theirs: 0, tied: 1 } });
    expect(day).toMatchObject({ n: 3, nearer: { ours: 2, theirs: 1, tied: 0 } });
    expect(jumping.n).toBe(2);
  });
});
