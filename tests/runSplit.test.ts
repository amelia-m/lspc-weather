import { describe, expect, it } from 'vitest';
import {
  appRawLevels,
  parseRunSplitLines,
  rawGap,
  schulzeRawLevels,
  summarizeRunSplit,
  type RawGap,
  type RawLevel,
  type RunSplitRecord,
} from '../src/domain/runSplit';

const profile = (dir: number, spd: number): RawLevel[] =>
  [1000, 3000, 5000, 7000, 9000].map((ftAgl) => ({ ftAgl, dir, spd }));

describe('rawGap', () => {
  it('pairs heights within 150 ft and calls two levels more than 5° or 2 kt apart different runs', () => {
    const ours = profile(270, 20);
    expect(rawGap(ours, profile(270, 20)).mismatch).toBe(false);
    // One level off is rounding or a blip; two are a different run.
    const oneOff = profile(270, 20).map((l, i) => (i === 0 ? { ...l, dir: 280 } : l));
    expect(rawGap(ours, oneOff)).toMatchObject({
      pairs: 5,
      bad: 1,
      maxDir: 10,
      mismatch: false,
    });
    const twoOff = profile(270, 20).map((l, i) => (i < 2 ? { ...l, spd: 23 } : l));
    expect(rawGap(ours, twoOff)).toMatchObject({
      bad: 2,
      maxSpd: 3,
      mismatch: true,
    });
    // The margins themselves are not "apart".
    expect(rawGap(ours, profile(275, 22)).mismatch).toBe(false);
  });

  it('measures direction the short way round', () => {
    expect(rawGap(profile(355, 10), profile(3, 10)).maxDir).toBe(8);
  });

  it('cannot judge from fewer than three pairs, and pairs nothing beyond 150 ft', () => {
    const shifted = profile(270, 20).map((l) => ({
      ...l,
      ftAgl: l.ftAgl + 151,
    }));
    expect(rawGap(profile(270, 20), shifted)).toMatchObject({
      pairs: 0,
      mismatch: null,
    });
    expect(rawGap(profile(270, 20), profile(200, 40).slice(0, 2)).mismatch).toBeNull();
  });

  it('skips his levels below the ground or above the table', () => {
    const theirs = [...profile(270, 20), { ftAgl: -300, dir: 90, spd: 50 }, { ftAgl: 16_000, dir: 90, spd: 50 }];
    const ours = [...profile(270, 20), { ftAgl: -300, dir: 270, spd: 20 }, { ftAgl: 16_000, dir: 270, spd: 20 }];
    expect(rawGap(ours, theirs)).toMatchObject({ pairs: 5, bad: 0 });
  });
});

describe('the raw levels compared', () => {
  it('leaves out the 10 m and fixed-height winds, and measures from the drop zone', () => {
    const levels = appRawLevels(
      [
        { heightFtMsl: 1215, speedKt: 5, directionDeg: 180, isSurface: true },
        { heightFtMsl: 1445, speedKt: 9, directionDeg: 190, fixedHeightM: 80 },
        { heightFtMsl: 2500, speedKt: 15, directionDeg: 200 },
      ],
      1182,
    );
    expect(levels).toEqual([{ ftAgl: 1318, dir: 200, spd: 15 }]);
  });

  it('keeps a height his endpoint served without a value: a pair, never apart', () => {
    const his = schulzeRawLevels({
      altFtRaw: [1000, 3000, 5000, 7000],
      directionRaw: { 1000: 270, 3000: 270, 5000: 270 },
      speedRaw: { 1000: 20, 3000: 20, 5000: 20 },
    });
    expect(his).toHaveLength(4);
    // Three good pairs and the empty one: four pairs, none apart, as the
    // comparison counted before the rule was shared.
    expect(rawGap(profile(270, 20), his)).toEqual({ pairs: 4, bad: 0, maxDir: 0, maxSpd: 0, mismatch: false });
  });

});

const gap = (mismatch: boolean | null): RawGap => ({
  pairs: 5,
  bad: mismatch ? 2 : 0,
  maxDir: 0,
  maxSpd: 0,
  mismatch,
});
const rec = (
  minute: number,
  o0: [boolean | null, boolean | null],
  o1: [boolean | null, boolean | null],
  self: boolean | null = false,
  avail?: string,
): RunSplitRecord => ({
  kind: 'runsplit',
  v: 1,
  at: `2026-10-23T10:${String(minute).padStart(2, '0')}:00.000Z`,
  minute,
  hours: [
    { offset: 0, validHour: null, vsFirst: gap(o0[0]), vsSecond: gap(o0[1]) },
    { offset: 1, validHour: null, vsFirst: gap(o1[0]), vsSecond: gap(o1[1]) },
  ],
  self: [
    { offset: 0, gap: gap(self) },
    { offset: 1, gap: gap(self) },
  ],
  apartS: 1,
  ...(avail
    ? {
        omRuns: {
          ncep_hrrr_conus: {
            init: null,
            modified: null,
            avail,
            stepS: 3600,
            reads: 3,
            variants: 1,
          },
        },
      }
    : {}),
});

describe('summarizeRunSplit', () => {
  it('counts each of his requests by half of the hour, so a next-hour cause and a clock cause read apart', () => {
    const s = summarizeRunSplit([
      // First half: his next hour on a different run, his hour in progress not.
      rec(5, [false, false], [true, false]),
      rec(25, [false, false], [true, true]),
      // Second half: neither.
      rec(40, [false, false], [false, false]),
    ]);
    const at = (offset: 0 | 1, half: 'first' | 'second') =>
      s.byOffsetAndHalf.find((c) => c.offset === offset && c.half === half)!.cell;
    expect(at(1, 'first')).toEqual({ n: 2, mismatched: 2 });
    expect(at(0, 'first')).toEqual({ n: 2, mismatched: 0 });
    expect(at(1, 'second')).toEqual({ n: 1, mismatched: 0 });
    expect(s.byOffsetAndBand.find((c) => c.offset === 1 && c.fromMin === 20)!.cell).toEqual({ n: 1, mismatched: 1 });
  });

  it('counts the app against itself, and when the app’s first answer was the odd one out', () => {
    const s = summarizeRunSplit([
      rec(42, [true, false], [false, false], true),
      rec(44, [false, false], [false, false], false),
    ]);
    expect(s.selfByBand.find((c) => c.fromMin === 40)!.cell).toEqual({
      n: 4,
      mismatched: 2,
    });
    expect(s.firstWasOddOneOut).toEqual({ of: 1, secondMatched: 1 });
  });

  it('leaves unjudged pairings out, and counts by minutes since the newest HRRR run', () => {
    const s = summarizeRunSplit([
      rec(5, [null, null], [true, true], null, '2026-10-23T09:55:00.000Z'),
      rec(50, [false, false], [false, false], false, '2026-10-23T09:00:00.000Z'),
    ]);
    expect(s.byOffsetAndHalf.find((c) => c.offset === 0 && c.half === 'first')!.cell).toEqual({ n: 0, mismatched: 0 });
    expect(s.byRunAge[0].cell).toEqual({ n: 1, mismatched: 1 }); // 10 min after
    expect(s.byRunAge[3].cell).toEqual({ n: 2, mismatched: 0 }); // 110 min after
    expect(s.samples).toBe(2);
  });

  it('splits the counts by whether the HRRR reads disagreed, and leaves a sample with one read out', () => {
    const split = (variants: number, reads = 3) => ({
      ncep_hrrr_conus: { init: '2026-10-23T08:00:00.000Z', modified: null, avail: null, stepS: 3600, reads, variants },
    });
    const s = summarizeRunSplit([
      { ...rec(35, [true, true], [true, true], true), omRuns: split(2) },
      { ...rec(39, [false, false], [false, false], false), omRuns: split(1) },
      { ...rec(43, [true, true], [true, true], true), omRuns: split(2, 1) },
    ]);
    expect(s.bySplit).toEqual([
      { serversDisagreed: false, cell: { n: 2, mismatched: 0 }, self: { n: 2, mismatched: 0 } },
      { serversDisagreed: true, cell: { n: 2, mismatched: 2 }, self: { n: 2, mismatched: 2 } },
    ]);
  });

  it('counts each copy of a run as an arrival, by the minute it became available', () => {
    const run = (init: string, avail: string) => ({
      ncep_hrrr_conus: { init, modified: null, avail, stepS: 3600, reads: 3, variants: 1 },
    });
    const s = summarizeRunSplit([
      { ...rec(5, [false, false], [false, false]), omRuns: run('2026-10-23T08:00:00.000Z', '2026-10-23T09:34:00.000Z') },
      // The same run again, from the same copy: one arrival.
      { ...rec(9, [false, false], [false, false]), omRuns: run('2026-10-23T08:00:00.000Z', '2026-10-23T09:34:00.000Z') },
      // The same run from another copy, ten minutes later: a second arrival.
      { ...rec(13, [false, false], [false, false]), omRuns: run('2026-10-23T08:00:00.000Z', '2026-10-23T09:44:00.000Z') },
      { ...rec(17, [false, false], [false, false]), omRuns: run('2026-10-23T09:00:00.000Z', '2026-10-23T10:58:00.000Z') },
    ]);
    expect(s.runArrivals.runs).toBe(2);
    expect(s.runArrivals.runsWithSeveralArrivals).toBe(1);
    expect(s.runArrivals.byMinute.map((b) => b.arrivals)).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it('counts whether both his hours moved together, and the stretches of mismatched samples', () => {
    const s = summarizeRunSplit([
      rec(30, [true, true], [true, true]),
      rec(34, [true, true], [false, false]),
      rec(38, [false, false], [false, false]),
      rec(42, [false, false], [true, true]),
      // Unjudged: not a mismatch, so it ends a stretch.
      rec(46, [null, null], [null, null]),
      rec(50, [true, true], [true, true]),
    ]);
    expect(s.offsetsTogether).toEqual({ both: 2, one: 2 });
    expect(s.stretches).toEqual({ count: 3, longest: 2 });
  });
});

describe('parseRunSplitLines', () => {
  it('keeps run-split records and skips other lines and cut-short ones', () => {
    const r = rec(5, [false, false], [false, false]);
    const text = [
      '== sample',
      `@@parity ${JSON.stringify(r)}`,
      '@@parity {"kind":"schulze"}',
      '@@parity {"kind":"runsp',
    ].join('\n');
    expect(parseRunSplitLines(text)).toEqual([r]);
  });
});
