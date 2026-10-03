import { describe, expect, it } from 'vitest';
import {
  arrivalLags,
  groundByLocalDay,
  groundByLocalHour,
  median,
  outagesOf,
  parseParityLines,
  percentile,
  summarizeParity,
  timeGapGroups,
  validHourOf,
  type ParityRecord,
  type SchulzeRecord,
  type UsairnetRecord,
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

  it('keeps same-observation and different-observation runs in separate field tables', () => {
    const records: ParityRecord[] = [
      { kind: 'usairnet', at: '2026-09-24T01:00:00Z', v: 2, sameReport: true, fields: [{ name: 'clouds', same: true }, { name: 'dew point °F', same: false, delta: -1 }] },
      { kind: 'usairnet', at: '2026-09-24T01:15:00Z', v: 2, sameReport: false, fields: [{ name: 'clouds', same: false }, { name: 'dew point °F', same: false, delta: 4 }] },
      { kind: 'usairnet', at: '2026-09-24T01:45:00Z', v: 2, sameReport: true, fields: [{ name: 'clouds', same: true }, { name: 'dew point °F', same: false, delta: -3 }] },
      { kind: 'usairnet', at: '2026-09-24T01:30:00Z', error: 'HTTP 503' },
    ];
    const s = summarizeParity(records, NOW);
    expect(s.usairnet.runs).toBe(4);
    expect(s.usairnet.unreadable).toBe(1);
    expect(s.usairnet.sameReport).toBe(2);
    // Only the two same-observation runs: gaps -1 and -3.
    expect(s.usairnet.fieldsSameReport).toEqual([
      { name: 'clouds', n: 2, agree: 2, spread: null },
      { name: 'dew point °F', n: 2, agree: 0, spread: { n: 2, meanAbs: 2, medianAbs: 2, p90Abs: 3, minAbs: 1, maxAbs: 3, mean: -2 } },
    ]);
    // The different-observation run on its own, its 4 °F gap kept out of the
    // table above.
    expect(s.usairnet.fieldsDifferentReport).toEqual([
      { name: 'clouds', n: 1, agree: 0, spread: null },
      { name: 'dew point °F', n: 1, agree: 0, spread: { n: 1, meanAbs: 4, medianAbs: 4, p90Abs: 4, minAbs: 4, maxAbs: 4, mean: 4 } },
    ]);
    // No longer pooled.
    expect(s.usairnet.fields).toBeUndefined();
  });

  it('says which side was behind when the observations differed, and whether NWS already had the newer one', () => {
    const run = (at: string, obsGapMin: number | null, ourObsAt: string, nwsNewestAt: string | null): ParityRecord => ({
      kind: 'usairnet',
      at,
      sameReport: false,
      ourObsAt,
      obsGapMin,
      nwsNewestAt,
      fields: [],
    });
    const s = summarizeParity(
      [
        // Dashboard 20 min behind, and NWS's list already had the newer report.
        run('2026-09-27T13:40:00Z', -20, '2026-09-27T13:15:00Z', '2026-09-27T13:35:00Z'),
        // Dashboard 20 min behind, and NWS did not have it yet.
        run('2026-09-27T13:41:00Z', -20, '2026-09-27T13:15:00Z', '2026-09-27T13:15:00Z'),
        // usairnet behind.
        run('2026-09-27T14:00:00Z', 20, '2026-09-27T13:55:00Z', '2026-09-27T13:55:00Z'),
        // Logged before the times were recorded.
        { kind: 'usairnet', at: '2026-09-25T01:15:00Z', sameReport: false, fields: [] },
        { kind: 'usairnet', at: '2026-09-25T01:35:00Z', sameReport: true, fields: [] },
      ],
      NOW,
    );
    expect(s.usairnet.timing).toMatchObject({
      mismatched: 4,
      timed: 3,
      usairnetNewer: 2,
      dashboardNewer: 1,
      dashboardBehindNwsListHadIt: 1,
      dashboardBehindNwsListLacked: 1,
    });
    expect(s.usairnet.timing?.gapMin).toMatchObject({ n: 3, medianAbs: 20, mean: -6.67 });
  });

  it('keeps the runs since the dashboard read IEM apart from the NWS-only runs before, and counts the feed', () => {
    const run = (at: string, obsGapMin: number, ourSource?: 'iem' | 'nws'): ParityRecord => ({
      kind: 'usairnet',
      at,
      sameReport: false,
      ourObsAt: at,
      obsGapMin,
      nwsNewestAt: null,
      ...(ourSource ? { ourSource } : {}),
      fields: [],
    });
    const s = summarizeParity(
      [
        // Before: NWS only, the dashboard behind twice.
        run('2026-09-27T13:40:00Z', -20),
        run('2026-09-27T14:00:00Z', -20),
        // Since: IEM served and the dashboard was ahead; once NWS served.
        run('2026-09-29T13:40:00Z', 20, 'iem'),
        run('2026-09-29T14:00:00Z', 20, 'iem'),
        run('2026-09-29T14:20:00Z', -20, 'nws'),
        { kind: 'usairnet', at: '2026-09-29T14:40:00Z', sameReport: true, ourSource: 'iem', fields: [] },
      ],
      NOW,
    );
    expect(s.usairnet.timing).toMatchObject({ mismatched: 2, dashboardNewer: 0, usairnetNewer: 2 });
    expect(s.usairnet.timingSinceIem).toMatchObject({ mismatched: 3, dashboardNewer: 2, usairnetNewer: 1 });
    expect(s.usairnet.feeds).toEqual({ iem: 3, nws: 1 });
  });

  it('leaves each corrected row out of records older than its fix, and keeps the rest', () => {
    const fields = [
      { name: 'clouds', same: false },
      { name: 'temperature °F', same: false },
      { name: 'wind dir °', same: false },
      { name: 'visibility mi', same: false },
      { name: 'sunset (min past midnight)', same: false, delta: 2 },
      { name: 'pressure inHg', same: true, delta: 0 },
    ];
    const s = summarizeParity(
      [
        { kind: 'usairnet', at: '2026-09-26T20:00:00Z', sameReport: true, fields },
        { kind: 'usairnet', at: '2026-09-30T20:00:00Z', v: 2, sameReport: true, fields },
        { kind: 'usairnet', at: '2026-10-03T20:00:00Z', v: 3, sameReport: true, fields },
      ],
      NOW,
    );
    const n = Object.fromEntries((s.usairnet.fieldsSameReport ?? []).map((f) => [f.name, f.n]));
    // Version-2 rows count from v2 records, version-3 rows only from v3, the
    // rest from every record.
    expect(n).toEqual({
      clouds: 2,
      'temperature °F': 2,
      'wind dir °': 1,
      'visibility mi': 1,
      'sunset (min past midnight)': 1,
      'pressure inHg': 3,
    });
  });

  it('times each report at each source from the first sample that found it', () => {
    // Samples every 2 minutes from 13:36Z. KPMV's 13:35Z report reaches the
    // raw file by 13:40, IEM by 13:42, usairnet by 13:52, NWS's list by
    // 13:56 and its latest by 14:02; before that each shows 13:15Z.
    const R0 = '2026-09-30T13:15:00Z';
    const R1 = '2026-09-30T13:35:00Z';
    const mins = (m: number): string => new Date(Date.parse('2026-09-30T13:36:00Z') + m * 60_000).toISOString();
    const has = (at: number, by: number): string => (at >= by ? R1 : R0);
    const recs: UsairnetRecord[] = [];
    for (let m = 0; m <= 26; m += 2) {
      recs.push({
        kind: 'usairnet',
        at: mins(m),
        v: 2,
        ourSource: 'iem',
        rawFileObsAt: has(m, 4),
        iemObsAt: has(m, 6),
        theirObsAt: has(m, 16),
        nwsNewestAt: has(m, 20),
        nwsObsAt: has(m, 26),
        fields: [],
      });
    }
    const lag = Object.fromEntries(arrivalLags(recs).map((a) => [a.source, a.lagMin?.medianAbs ?? null]));
    expect(lag).toEqual({ rawFile: 5, iem: 7, usairnet: 17, nwsList: 21, nwsLatest: 27 });
  });

  it('times nothing across a gap longer than the bracket, or from a source’s first sample', () => {
    const rec = (at: string, iemObsAt: string): UsairnetRecord => ({ kind: 'usairnet', at, v: 2, iemObsAt, fields: [] });
    const a = arrivalLags([
      // First sample: already has 13:35Z, so when it arrived is unknown.
      rec('2026-09-30T13:50:00Z', '2026-09-30T13:35:00Z'),
      // An hour later, the 14:35Z report: the gap brackets nothing.
      rec('2026-09-30T14:50:00Z', '2026-09-30T14:35:00Z'),
    ]).find((x) => x.source === 'iem')!;
    expect(a.reports).toBe(0);
    expect(a.lagMin).toBeNull();
  });

  it('is empty, not broken, with no records', () => {
    const s = summarizeParity([], NOW);
    expect(s.from).toBeNull();
    expect(s.schulze.byAltitude).toEqual([]);
    expect(s.schulze.ground.medianRatio).toBeNull();
    expect(s.usairnet.fieldsSameReport).toEqual([]);
    expect(s.usairnet.fieldsDifferentReport).toEqual([]);
    expect(s.usairnet.timing).toMatchObject({ mismatched: 0, timed: 0, gapMin: null });
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

describe('timeGapGroups', () => {
  const row = (ft: number, dDir: number, dSpd = 0) => ({ ft, dDir, dSpd, dT: 0 });
  const recs: SchulzeRecord[] = [
    // Same hour, raw profiles agreed: the tools' own arithmetic.
    { kind: 'schulze', at: '2026-09-26T16:10:00Z', gapHours: 0, rawMismatch: false, aligned: { rows: [row(0, 30, 5), row(1000, 1), row(5000, -2, 1)] } },
    // Same hour, one side on a newer run.
    { kind: 'schulze', at: '2026-09-26T17:10:00Z', gapHours: 0, rawMismatch: true, aligned: { rows: [row(0, 3), row(1000, 12, 2), row(5000, -8, -1)] } },
    // Same hour, not judged: in neither same-hour group.
    { kind: 'schulze', at: '2026-09-26T18:10:00Z', gapHours: 0, rawMismatch: null, aligned: { rows: [row(1000, 90, 9)] } },
    // After half past: the pages showed different hours, rows recorded.
    {
      kind: 'schulze',
      at: '2026-09-26T16:40:00Z',
      gapHours: 1,
      rawMismatch: false,
      aligned: { rows: [row(1000, 0)] },
      unaligned: { hoursDiffer: true, maxDir: 20, rows: [{ ft: 0, dDir: 40, dSpd: 6 }, { ft: 1000, dDir: -20, dSpd: 3 }, { ft: 5000, dDir: 10, dSpd: -1 }] },
    },
    // Logged before rows were recorded: only the worst direction survives.
    { kind: 'schulze', at: '2026-09-25T16:40:00Z', rawMismatch: false, aligned: { rows: [row(1000, 1)] }, unaligned: { hoursDiffer: true, maxDir: 25 } },
    { kind: 'schulze', at: '2026-09-26T19:00:00Z', error: 'open-meteo: HTTP 500' },
  ];
  const groups = timeGapGroups(recs);
  const by = Object.fromEntries(groups.map((g) => [g.key, g]));

  it('returns the three groups in order, same run first', () => {
    expect(groups.map((g) => g.key)).toEqual(['same-hour-same-run', 'same-hour-different-run', 'one-hour-apart']);
  });

  it('pools the aligned rows of runs whose raw profiles agreed, leaving the surface row out', () => {
    // Runs 1, 4 and 5 agreed: rows 1°, -2°, 0°, 1° (surface 30° left out).
    expect(by['same-hour-same-run'].runs).toBe(3);
    expect(by['same-hour-same-run'].dir).toMatchObject({ n: 4, maxAbs: 2, meanAbs: 1 });
  });

  it('keeps a newer-run run apart from the rest, and an unjudged run out of both', () => {
    expect(by['same-hour-different-run'].runs).toBe(1);
    expect(by['same-hour-different-run'].dir).toMatchObject({ n: 2, maxAbs: 12, meanAbs: 10 });
    expect(by['same-hour-different-run'].spd).toMatchObject({ maxAbs: 2 });
    // The unjudged run's 90° row appears nowhere.
    for (const g of groups) expect(g.dir?.maxAbs ?? 0).toBeLessThan(90);
  });

  it('takes the one-hour-apart rows as the pages showed them, only from runs that recorded rows', () => {
    expect(by['one-hour-apart'].runs).toBe(1);
    expect(by['one-hour-apart'].dir).toMatchObject({ n: 2, maxAbs: 20, meanAbs: 15 });
    expect(by['one-hour-apart'].spd).toMatchObject({ n: 2, maxAbs: 3, meanAbs: 2 });
  });

  it('is carried in the summary', () => {
    expect(summarizeParity(recs, Date.parse('2026-09-26T20:00:00Z')).schulze.byTimeGap).toEqual(groups);
  });
});

/* The ground rows are bucketed by the local time of the hour they forecast,
 * not the minute the run sampled: a run at 01:40Z compares the 02Z table,
 * which is 9 PM CDT, while 01:40Z itself is 8:40 PM. */
describe('groundByLocalHour', () => {
  const run = (at: string, appHour: string, ourKt: number, theirKt: number): SchulzeRecord => ({
    kind: 'schulze',
    at,
    appHour,
    ground: { ourKt, theirKt },
  });

  it('places each run by its forecast hour, on the UTC day nearest the run', () => {
    // 23:40Z on the 2nd compares 00Z on the 3rd, not 00Z on the 2nd.
    expect(validHourOf(run('2026-10-02T23:40:00Z', '00Z', 1, 1))).toBe(Date.parse('2026-10-03T00:00:00Z'));
    expect(validHourOf(run('2026-10-03T00:10:00Z', '00Z', 1, 1))).toBe(Date.parse('2026-10-03T00:00:00Z'));
    // No hour logged: the run's own time.
    expect(validHourOf({ kind: 'schulze', at: '2026-10-03T05:00:00Z' })).toBe(Date.parse('2026-10-03T05:00:00Z'));
  });

  it('buckets by the drop zone\'s local hour, with medians per block', () => {
    const bands = groundByLocalHour([
      // 02Z = 9 PM CDT: the 21-24 block. Sampled at 01:40Z (8:40 PM), which
      // would land in the 18-21 block if the run time were used.
      run('2026-10-03T01:40:00Z', '02Z', 4, 10),
      run('2026-10-03T02:10:00Z', '02Z', 6, 9),
      // 18Z = 1 PM CDT: the 12-15 block.
      run('2026-10-03T18:05:00Z', '18Z', 10, 11),
    ]);
    expect(bands.map((b) => b.fromHour)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
    expect(bands[7]).toEqual({ fromHour: 21, runs: 2, medianOurKt: 5, medianTheirKt: 9.5, medianGapKt: 4.5 });
    expect(bands[6].runs).toBe(0);
    expect(bands[4]).toMatchObject({ fromHour: 12, runs: 1, medianGapKt: 1 });
  });

  it('skips runs without both ground rows', () => {
    const bands = groundByLocalHour([
      { kind: 'schulze', at: '2026-10-03T18:05:00Z', appHour: '18Z', ground: { ourKt: null, theirKt: 8 } },
    ]);
    expect(bands.every((b) => b.runs === 0 && b.medianOurKt === null)).toBe(true);
  });
});

/* Failures on usairnet's side are kept apart from the dashboard's own, and
 * the longest unbroken stretch is reported: the 2026-09-30 outage was one
 * afternoon of consecutive failures, which a count alone does not show. */
describe('outagesOf', () => {
  const ok = (at: string): UsairnetRecord => ({ kind: 'usairnet', at, fields: [] });
  const theirs = (at: string): UsairnetRecord => ({ kind: 'usairnet', at, error: 'usairnet: page did not parse' });
  const ours = (at: string): UsairnetRecord => ({ kind: 'usairnet', at, error: 'neither observation feed could be read' });

  it('counts each side and finds the longest stretch of usairnet failures', () => {
    const o = outagesOf([
      ok('2026-09-30T13:10:00Z'),
      theirs('2026-09-30T13:12:00Z'),
      theirs('2026-09-30T13:14:00Z'),
      theirs('2026-09-30T13:16:00Z'),
      ok('2026-09-30T13:18:00Z'),
      theirs('2026-09-30T14:00:00Z'),
      ours('2026-09-30T15:00:00Z'),
    ]);
    expect(o.theirs).toBe(4);
    expect(o.ours).toBe(1);
    expect(o.stretches).toBe(2);
    expect(o.longest).toEqual({ from: '2026-09-30T13:12:00.000Z', to: '2026-09-30T13:16:00.000Z', samples: 3 });
  });

  it('does not join failures across a gap in the sampling', () => {
    // An hour between batches: two stretches, not one spanning the hour.
    const o = outagesOf([theirs('2026-09-30T13:12:00Z'), theirs('2026-09-30T14:12:00Z')]);
    expect(o.stretches).toBe(2);
    expect(o.longest?.samples).toBe(1);
  });

  it('ends a stretch at a readable sample, in time order whatever the input order', () => {
    // Unsorted, the two failures would sit side by side, 4 min apart, and join.
    const o = outagesOf([theirs('2026-09-30T13:12:00Z'), theirs('2026-09-30T13:16:00Z'), ok('2026-09-30T13:14:00Z')]);
    expect(o.stretches).toBe(2);
  });

  it('reports no stretch when usairnet never failed', () => {
    expect(outagesOf([ok('2026-09-30T13:10:00Z'), ours('2026-09-30T13:12:00Z')])).toEqual({
      theirs: 0,
      ours: 1,
      stretches: 0,
      longest: null,
    });
  });
});

/* By local day of the forecast hour: 02Z on Oct 3 is still Oct 2 at the
 * drop zone (9 PM CDT), so a UTC date would put it on the wrong day. */
describe('groundByLocalDay', () => {
  const run = (at: string, appHour: string, ourKt: number | null, theirKt: number): SchulzeRecord => ({
    kind: 'schulze',
    at,
    appHour,
    ground: { ourKt, theirKt },
  });

  it('groups by the drop zone\'s local date of the forecast hour, oldest first', () => {
    const days = groundByLocalDay([
      run('2026-10-03T18:05:00Z', '18Z', 10, 11),
      run('2026-10-03T01:40:00Z', '02Z', 4, 10),
      run('2026-10-03T02:10:00Z', '02Z', 6, 9),
      run('2026-10-03T19:05:00Z', '19Z', null, 12),
      // Sampled at 11:40 PM CDT on the 2nd, comparing midnight (05Z): the 3rd.
      run('2026-10-03T04:40:00Z', '05Z', 8, 8),
    ]);
    expect(days).toEqual([
      { date: '2026-10-02', runs: 2, medianOurKt: 5, medianTheirKt: 9.5, medianGapKt: 4.5 },
      { date: '2026-10-03', runs: 2, medianOurKt: 9, medianTheirKt: 9.5, medianGapKt: 0.5 },
    ]);
  });
});
