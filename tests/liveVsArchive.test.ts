import { describe, expect, it } from 'vitest';
import type { Instant } from '../src/domain/keptForecasts';
import {
  HOURLY_RUN_DOMAIN,
  hourUnderWaySamples,
  isNightUtc,
  liveVsArchiveRows,
  liveVsArchiveSamples,
  minuteBand,
  splitAtFirstChange,
  summarizeDiffs,
  type LiveVsArchiveSample,
} from '../src/domain/liveVsArchive';
import type { SurfaceWindRecord, WindAt } from '../src/domain/surfaceWindSources';

const H = 3_600_000;
const T0 = Date.parse('2026-11-01T17:00:00Z');

const wind = (t: number, spd: number | null): WindAt => ({ t: new Date(t).toISOString(), dir: 150, spd, gust: null });

/** A run at `at` whose hourly series is the two hours either side, each
 *  with the speed given, from a HRRR 15-minute run initialised `init`. */
function record(at: number, speeds: Record<number, number | null>, init: number | null): SurfaceWindRecord {
  return {
    kind: 'surfacewind',
    v: 2,
    at: new Date(at).toISOString(),
    dz: '40.8703,-96.1085',
    om: {
      fetchedAt: new Date(at).toISOString(),
      generationMs: 1,
      gridLat: 40.86,
      gridLon: -96.12,
      elevationM: 355,
      current: null,
      hourly: Object.entries(speeds).map(([t, spd]) => wind(Number(t), spd)),
      m15: [],
      lastModified: null,
      cacheControl: null,
      sameAsHrrr: true,
    },
    omMeta: init == null ? undefined : { [HOURLY_RUN_DOMAIN]: { init: new Date(init).toISOString(), modified: null, avail: null, stepS: 900 } },
  };
}

const report = (t: number, spd: number): Instant => ({ t, spd, gust: null, dir: 150, tempC: 10, visSm: 10 });

describe('liveVsArchiveSamples', () => {
  const archive = new Map<number, number>([
    [T0 - H, 5.0],
    [T0, 6.0],
    [T0 + H, 7.0],
  ]);
  const reports = new Map<number, Instant[]>([[T0, [report(T0 - 7 * 60_000, 5)]]]);

  it('keeps every hourly value the archive holds, with its lead and the report at the hour', () => {
    // Asked at 17:30 from the 15Z run: 16Z is lead 1, 17Z lead 2, 18Z lead 3.
    const r = record(T0 + 30 * 60_000, { [T0 - H]: 5.5, [T0]: 6.7, [T0 + H]: 8.1, [T0 + 2 * H]: 9 }, T0 - 2 * H);
    const out = liveVsArchiveSamples([r], archive, reports);
    expect(out.map((s) => [s.valid, s.lead, s.live, s.archive, s.obs])).toEqual([
      [T0 - H, 1, 5.5, 5.0, null],
      [T0, 2, 6.7, 6.0, 5],
      [T0 + H, 3, 8.1, 7.0, null],
    ]);
  });

  it('has no lead without the domain metadata, and skips a value with no speed', () => {
    const r = record(T0 + 30 * 60_000, { [T0]: null, [T0 + H]: 8.1 }, null);
    const out = liveVsArchiveSamples([r], archive, reports);
    expect(out).toEqual([{ at: T0 + 30 * 60_000, valid: T0 + H, lead: null, live: 8.1, archive: 7.0, obs: null }]);
  });

  it('contributes nothing from a run with no Open-Meteo answer', () => {
    const r = { ...record(T0, { [T0]: 6 }, T0 - H), om: undefined, omError: 'timeout' };
    expect(liveVsArchiveSamples([r], archive, reports)).toEqual([]);
  });
});

describe('hourUnderWaySamples', () => {
  it('keeps the sample for the clock hour the request was made in', () => {
    const at = T0 + 59 * 60_000 + 59_000;
    const samples: LiveVsArchiveSample[] = [
      { at, valid: T0 - H, lead: 0, live: 5, archive: 5, obs: null },
      { at, valid: T0, lead: 1, live: 6, archive: 5, obs: null },
      { at, valid: T0 + H, lead: 2, live: 7, archive: 5, obs: null },
    ];
    expect(hourUnderWaySamples(samples).map((s) => s.valid)).toEqual([T0]);
  });
});

describe('minuteBand and isNightUtc', () => {
  it('bands the request minute, inclusive at both ends', () => {
    expect(minuteBand(Date.parse('2026-11-01T17:00:54Z'), 20)).toBe('0-19');
    expect(minuteBand(Date.parse('2026-11-01T17:19:59Z'), 20)).toBe('0-19');
    expect(minuteBand(Date.parse('2026-11-01T17:20:00Z'), 20)).toBe('20-39');
    expect(minuteBand(Date.parse('2026-11-01T17:59:00Z'), 10)).toBe('50-59');
  });

  it('night is 01Z to 12Z inclusive', () => {
    expect(isNightUtc(Date.parse('2026-11-01T00:30:00Z'))).toBe(false);
    expect(isNightUtc(Date.parse('2026-11-01T01:00:00Z'))).toBe(true);
    expect(isNightUtc(Date.parse('2026-11-01T12:59:00Z'))).toBe(true);
    expect(isNightUtc(Date.parse('2026-11-01T13:00:00Z'))).toBe(false);
  });
});

describe('liveVsArchiveRows', () => {
  // Each sample's group, kept beside it rather than on it.
  const keys = new Map<LiveVsArchiveSample, string>();
  const keyOf = (x: LiveVsArchiveSample): string => keys.get(x) ?? 'a';
  const s = (live: number, archive: number, obs: number | null, key = 'a'): LiveVsArchiveSample => {
    const sample = { at: T0, valid: T0, lead: 1, live, archive, obs };
    keys.set(sample, key);
    return sample;
  };

  it('summarises live minus archive and both against the report, per key, keys in order met', () => {
    const samples = [s(6.7, 6.0, 5), s(5.2, 6.0, null), s(6.0, 6.0, 6), s(9.1, 8.0, 7, 'b')];
    const rows = liveVsArchiveRows(samples, keyOf);
    expect(rows.map((r) => r.key)).toEqual(['a', 'b']);
    const a = rows[0];
    // +0.7, −0.8, 0: mean −0.03, median 0; above 1, zero 1, below 1;
    // equal to the tenth 1, within half a knot 1.
    expect(a.liveMinusArchive).toEqual({ n: 3, mean: -0.03, median: 0, above: 1, zero: 1, below: 1, equal: 1, withinHalf: 1 });
    // Two reports: live +1.7 and 0; archive +1 and 0.
    expect(a.liveMinusReport).toEqual({ n: 2, mean: 0.85, median: 0.85, above: 1, zero: 1, below: 0 });
    expect(a.archiveMinusReport).toEqual({ n: 2, mean: 0.5, median: 0.5, above: 1, zero: 1, below: 0 });
    expect(rows[1].liveMinusArchive.n).toBe(1);
  });

  it('leaves out a sample the key function declines', () => {
    const rows = liveVsArchiveRows([s(6, 5, null), s(7, 5, null, 'skip')], (x) => (keyOf(x) === 'skip' ? null : 'kept'));
    expect(rows).toHaveLength(1);
    expect(rows[0].liveMinusArchive.n).toBe(1);
  });

  it('takes a difference to the tenth, so floating-point noise is not a side', () => {
    expect(summarizeDiffs([0.1 + 0.2 - 0.3])).toMatchObject({ above: 1 });
    expect(liveVsArchiveRows([s(6.3, 6.3, null)], () => 'k')[0].liveMinusArchive).toMatchObject({ zero: 1, equal: 1 });
  });
});

describe('splitAtFirstChange', () => {
  const at = (min: number, hour = 0): number => T0 + hour * H + min * 60_000;
  const s = (atMs: number, live: number, valid = T0 + Math.floor((atMs - T0) / H) * H): LiveVsArchiveSample => ({ at: atMs, valid, lead: 1, live, archive: 5, obs: null });

  it('splits each hour at the first request whose value differs from the last', () => {
    const out = splitAtFirstChange([
      // Hour 0: three requests, the value moves at the third.
      s(at(55), 7.1),
      s(at(4), 6.2),
      s(at(21), 6.2),
      s(at(38), 7.1),
      // Hour 1: two requests, no change.
      s(at(10, 1), 8),
      s(at(44, 1), 8),
      // Hour 2: one request.
      s(at(30, 2), 9),
      // Not the hour under way: left out.
      s(at(30, 2), 9, T0 + 3 * H),
    ]);
    expect(out.hoursWithTwo).toBe(2);
    expect(out.hoursChanged).toBe(1);
    expect(out.before.map((x) => x.at)).toEqual([at(4), at(21)]);
    expect(out.after.map((x) => x.at)).toEqual([at(38), at(55)]);
    expect(out.unchanged.map((x) => x.at)).toEqual([at(10, 1), at(44, 1), at(30, 2)]);
  });
});
