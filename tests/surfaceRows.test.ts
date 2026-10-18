import { describe, expect, it } from 'vitest';
import {
  groundHours,
  localHour,
  measuredAt,
  surfaceRowsTable,
  type SchulzeGroundRecord,
  type WindReport,
} from '../src/domain/surfaceRows';

const H = 3_600_000;
const T = Date.parse('2026-10-10T15:00:00Z'); // 10 AM CDT
const rec = (at: string, ours: number | null, theirs: number | null, o: Partial<SchulzeGroundRecord> = {}): SchulzeGroundRecord => ({
  kind: 'schulze',
  at,
  appHour: `${at.slice(11, 13)}Z`,
  aligned: { rows: [] },
  ground: { ourKt: ours == null ? null : ours + 0.3, ourShownKt: ours, theirKt: theirs },
  ...o,
});

describe('groundHours', () => {
  it('places each run on its hour and takes each side’s median over the hour’s runs', () => {
    const hs = groundHours([
      rec('2026-10-10T14:40:00Z', 6, 9, { appHour: '15Z' }),
      rec('2026-10-10T15:05:00Z', 8, 11),
      rec('2026-10-10T15:20:00Z', 7, 10),
    ]);
    expect(hs).toEqual([{ t: T, ours: 7, theirs: 10, runs: 3 }]);
    // An even number of runs takes the mean of the middle two.
    const [even] = groundHours([rec('2026-10-10T15:05:00Z', 6, 9), rec('2026-10-10T15:20:00Z', 9, 12)]);
    expect(even).toMatchObject({ ours: 7.5, theirs: 10.5, runs: 2 });
  });

  it('uses the shown figure, else the raw one rounded as the card rounds it', () => {
    const [h] = groundHours([{ ...rec('2026-10-10T15:00:00Z', null, 9), ground: { ourKt: 6.6, theirKt: 9 } }]);
    expect(h.ours).toBe(7);
  });

  it('leaves out a run on unaligned tables, one missing a side, another kind, and one whose shown hour is not its own', () => {
    expect(
      groundHours([
        rec('2026-10-10T15:00:00Z', 6, 9, { aligned: undefined }),
        rec('2026-10-10T15:00:00Z', 6, null),
        rec('2026-10-10T15:00:00Z', 6, 9, { kind: 'usairnet' }),
        rec('2026-10-10T15:00:00Z', 6, 9, { appHour: '16Z' }),
      ]),
    ).toEqual([]);
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

describe('localHour', () => {
  it('reads the clock at the DZ, summer time included', () => {
    expect(localHour(T, 'America/Chicago')).toBe(10);
    expect(localHour(Date.parse('2026-12-10T05:00:00Z'), 'America/Chicago')).toBe(23);
  });
});

describe('surfaceRowsTable', () => {
  // 10 AM: KPMV 6 kt, this app 7, Schulze 10 (this app nearer).
  // 11 PM: KPMV 2 kt, this app 5, Schulze 5 (tied).
  // 1 PM: KPMV 9 kt, this app 5, Schulze 10 (Schulze nearer).
  const hours = [
    { t: T, ours: 7, theirs: 10, runs: 1 },
    { t: T + 13 * H, ours: 5, theirs: 5, runs: 1 },
    { t: T + 3 * H, ours: 5, theirs: 10, runs: 1 },
    // No report near this hour, so it is not counted.
    { t: T + 30 * H, ours: 5, theirs: 5, runs: 1 },
    // 7 AM local exactly: day, not night. This app nearer.
    { t: T - 3 * H, ours: 3, theirs: 9, runs: 1 },
  ];
  const reports: WindReport[] = [
    { t: T, kt: 6 },
    { t: T + 13 * H, kt: 2 },
    { t: T + 3 * H, kt: 9 },
    { t: T - 3 * H, kt: 3 },
  ];
  const [all, night, day, jumping] = surfaceRowsTable(hours, reports, 'America/Chicago');

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
