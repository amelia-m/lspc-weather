import { describe, expect, it } from 'vitest';
import {
  maxAgeSeconds,
  maxWindDiff,
  metarWindGroup,
  openMeteoCurrent,
  openMeteoRunMeta,
  openMeteoSeries,
  parseSurfaceWindLines,
  sameWindSeries,
  shownAt,
  summarizeSurfaceWind,
  windAtTime,
  type SurfaceWindRecord,
  type WindAt,
} from '../src/domain/surfaceWindSources';
import { parseParityLines } from '../src/domain/paritySummary';

const w = (t: string, dir: number | null, spd: number | null, gust: number | null = null): WindAt => ({
  t: `2026-10-09T${t}:00.000Z`,
  dir,
  spd,
  gust,
});

/** One run at `hhmm` UTC on 2026-10-09, with whatever sources the test
 *  names; the rest absent, as a failed source is. */
const run = (hhmm: string, parts: Partial<SurfaceWindRecord> = {}): SurfaceWindRecord => ({
  kind: 'surfacewind',
  v: 1,
  at: `2026-10-09T${hhmm}:00.000Z`,
  dz: '40.8703,-96.1085',
  ...parts,
});

const metar = (obs: string, dir: number | null, spd: number, gust: number | null = null): SurfaceWindRecord['metar'] => ({
  source: 'iem',
  obsAt: `2026-10-09T${obs}:00.000Z`,
  wind: w(obs, dir, spd, gust),
  group: null,
  iemObsAt: null,
  nwsObsAt: null,
});

const om = (parts: Partial<NonNullable<SurfaceWindRecord['om']>>): SurfaceWindRecord['om'] => ({
  fetchedAt: '2026-10-09T00:00:00.000Z',
  generationMs: 1,
  gridLat: 40.86,
  gridLon: -96.12,
  elevationM: 355,
  current: null,
  hourly: [],
  m15: [],
  lastModified: null,
  cacheControl: null,
  sameAsHrrr: true,
  ...parts,
});

const nws = (hours: WindAt[], updateTime: string | null = null): SurfaceWindRecord['nws'] => ({
  fetchedAt: '2026-10-09T00:00:00.000Z',
  updateTime,
  lastModified: null,
  expires: null,
  maxAgeS: 3600,
  hourlyUpdateTime: null,
  hourlyGeneratedAt: null,
  hours,
});

describe('reading Open-Meteo and NWS responses', () => {
  it('turns Unix seconds into ISO and keeps a served null as null', () => {
    const s = openMeteoSeries({
      time: [1791504000, 1791504900],
      wind_speed_10m: [5.3, null],
      wind_direction_10m: [147, 136],
      wind_gusts_10m: [11.7, 12.2],
    });
    expect(s).toEqual([
      { t: '2026-10-09T00:00:00.000Z', dir: 147, spd: 5.3, gust: 11.7 },
      { t: '2026-10-09T00:15:00.000Z', dir: 136, spd: null, gust: 12.2 },
    ]);
    expect(openMeteoSeries(undefined)).toEqual([]);
  });

  it('a series without a gust field reads as no gust, not zero', () => {
    expect(openMeteoSeries({ time: [1791504000], wind_speed_10m: [5], wind_direction_10m: [90] })[0].gust).toBeNull();
  });

  it('reads `current` with its interval, and nothing when the block is missing', () => {
    expect(
      openMeteoCurrent({ current: { time: 1791505800, interval: 900, wind_speed_10m: 5.1, wind_direction_10m: 131, wind_gusts_10m: 11.9 } }),
    ).toEqual({ t: '2026-10-09T00:30:00.000Z', dir: 131, spd: 5.1, gust: 11.9, intervalS: 900 });
    expect(openMeteoCurrent({})).toBeNull();
  });

  it('reads the model metadata’s run times as ISO', () => {
    expect(
      openMeteoRunMeta({
        last_run_initialisation_time: 1791500400,
        last_run_modification_time: 1791505688,
        last_run_availability_time: 1791505804,
        temporal_resolution_seconds: 900,
      }),
    ).toEqual({
      init: '2026-10-08T23:00:00.000Z',
      modified: '2026-10-09T00:28:08.000Z',
      avail: '2026-10-09T00:30:04.000Z',
      stepS: 900,
    });
  });

  it('takes max-age from Cache-Control, never s-maxage', () => {
    // As api.weather.gov sent it for the gridpoint on 2026-10-09.
    expect(maxAgeSeconds('public, max-age=3486, s-maxage=3600')).toBe(3486);
    expect(maxAgeSeconds('public, s-maxage=3600, max-age=10')).toBe(10);
    expect(maxAgeSeconds('public, s-maxage=3600')).toBeNull();
    expect(maxAgeSeconds(null)).toBeNull();
  });

  it('finds the METAR wind group, with a gust or variable, and not a remark', () => {
    expect(metarWindGroup('KPMV 090035Z AUTO 12005KT 10SM CLR 24/13 A2990 RMK AO2')).toBe('12005KT');
    expect(metarWindGroup('KPMV 090035Z AUTO 18012G20KT 10SM CLR')).toBe('18012G20KT');
    expect(metarWindGroup('KPMV 090035Z AUTO VRB03KT 10SM CLR')).toBe('VRB03KT');
    expect(metarWindGroup('KPMV 090035Z AUTO 00000KT 10SM CLR')).toBe('00000KT');
    expect(metarWindGroup('KPMV 090035Z AUTO 10SM CLR RMK PK WND 18030/2345')).toBeNull();
    expect(metarWindGroup('')).toBeNull();
  });

  it('maxWindDiff: the largest gap at shared valid times, direction across north', () => {
    const a = [w('00:00', 359, 5.3, 11.7), w('00:15', 136, 5.6, 12.2), w('00:30', 130, 5.1, null)];
    const b = [w('00:00', 2, 5.3, 11.7), w('00:15', 136, 5.9, 12.0), w('00:45', 0, 30, 40)];
    expect(maxWindDiff(a, b)).toEqual({ dir: 3, spd: 0.3, gust: 0.2, matched: 2 });
    expect(maxWindDiff(a, a)).toEqual({ dir: 0, spd: 0, gust: 0, matched: 3 });
  });

  it('two series are the same only value for value', () => {
    const a = [w('00:00', 147, 5.3, 11.7)];
    expect(sameWindSeries(a, [w('00:00', 147, 5.3, 11.7)])).toBe(true);
    expect(sameWindSeries(a, [w('00:00', 148, 5.3, 11.7)])).toBe(false);
    expect(sameWindSeries(a, [])).toBe(false);
  });
});

describe('windAtTime', () => {
  const hourly = [w('00:00', 140, 5), w('01:00', 115, 6)];

  it('nearest: the closer step, as the app picks its Open-Meteo hour', () => {
    expect(windAtTime(hourly, Date.parse('2026-10-09T00:35:00Z'), { kind: 'nearest', maxGapMs: 1_800_000 })?.dir).toBe(115);
    expect(windAtTime(hourly, Date.parse('2026-10-09T00:25:00Z'), { kind: 'nearest', maxGapMs: 1_800_000 })?.dir).toBe(140);
  });

  it('nearest: exactly between two steps reads the earlier', () => {
    expect(windAtTime(hourly, Date.parse('2026-10-09T00:30:00Z'), { kind: 'nearest', maxGapMs: 1_800_000 })?.dir).toBe(140);
  });

  it('nearest: no value when the closest step is farther than the bound', () => {
    expect(windAtTime(hourly, Date.parse('2026-10-09T02:00:00Z'), { kind: 'nearest', maxGapMs: 1_800_000 })).toBeNull();
  });

  it('block: the hour that contains the moment, even when the next one is nearer', () => {
    // 00:50 is nearer 01:00, but an NWS hour value is valid 00:00–01:00.
    expect(windAtTime(hourly, Date.parse('2026-10-09T00:50:00Z'), { kind: 'block', stepMs: 3_600_000 })?.dir).toBe(140);
    expect(windAtTime(hourly, Date.parse('2026-10-09T01:00:00Z'), { kind: 'block', stepMs: 3_600_000 })?.dir).toBe(115);
    expect(windAtTime(hourly, Date.parse('2026-10-09T02:00:00Z'), { kind: 'block', stepMs: 3_600_000 })).toBeNull();
  });
});

describe('shownAt', () => {
  it('reads each source as the dashboard would show it at the run time', () => {
    const r = run('00:50', {
      metar: metar('00:35', 120, 5),
      nws: nws([w('00:00', 140, 6), w('01:00', 150, 7)]),
      om: om({
        current: { ...w('00:45', 122, 5.2), intervalS: 900 },
        hourly: [w('00:00', 148, 5.3), w('01:00', 115, 5.7)],
        m15: [w('00:45', 122, 5.2), w('01:00', 115, 5.7)],
      }),
    });
    expect(shownAt(r, 'metar')?.dir).toBe(120);
    expect(shownAt(r, 'nws')?.dir).toBe(140); // the 00Z hour block
    expect(shownAt(r, 'omHourly')?.dir).toBe(115); // nearest hour, 01Z
    expect(shownAt(r, 'om15')?.dir).toBe(122); // nearest step, 00:45
    expect(shownAt(r, 'omCurrent')?.dir).toBe(122);
  });
});

describe('summarizeSurfaceWind', () => {
  it('counts a change in the shown value and the minutes between changes', () => {
    const s = summarizeSurfaceWind([
      run('00:00', { metar: metar('23:55', 120, 5) }),
      run('00:03', { metar: metar('23:55', 120, 5) }),
      run('00:06', { metar: metar('00:00', 130, 5) }),
      run('00:09', { metar: metar('00:00', 130, 5) }),
      run('00:27', { metar: metar('00:15', 130, 7) }),
    ]);
    const c = s.cadence.find((x) => x.source === 'metar');
    expect(c).toMatchObject({ runs: 5, shownChanges: 2, shownPairs: 4 });
    expect(c?.shownIntervalMin).toEqual({ median: 21, min: 21, max: 21 });
    expect(s.metarReports).toBe(3);
  });

  it('a change in the gust alone is a change', () => {
    const s = summarizeSurfaceWind([
      run('00:31', { om: om({ current: { ...w('00:30', 131, 5.1, 11.9), intervalS: 900 } }) }),
      run('00:34', { om: om({ current: { ...w('00:30', 131, 5.1, 12.4), intervalS: 900 } }) }),
    ]);
    expect(s.cadence.find((x) => x.source === 'omCurrent')).toMatchObject({ shownChanges: 1, revisionChanges: 1 });
  });

  it('a revision is a changed value for a valid time the previous run also had; a revert is one going back', () => {
    const s = summarizeSurfaceWind([
      run('00:00', { om: om({ hourly: [w('01:00', 115, 5.7), w('02:00', 130, 6.2)] }) }),
      // A newer run: both hours change.
      run('00:03', { om: om({ hourly: [w('01:00', 114, 5.7), w('02:00', 129, 6.2)] }) }),
      // Another server, still on the older run: both go back.
      run('00:06', { om: om({ hourly: [w('01:00', 115, 5.7), w('02:00', 130, 6.2)] }) }),
      // Unchanged, plus an hour the previous run did not have, which is not
      // a pair.
      run('00:09', { om: om({ hourly: [w('01:00', 115, 5.7), w('02:00', 130, 6.2), w('03:00', 140, 7)] }) }),
    ]);
    const c = s.cadence.find((x) => x.source === 'omHourly');
    expect(c?.revisionPairs).toBe(6);
    expect(c?.revisionChanges).toBe(4);
    expect(c?.revisionReverts).toBe(2);
    expect(c?.revisions).toEqual(['2026-10-09T00:03:00.000Z', '2026-10-09T00:06:00.000Z']);
  });

  it('counts a change of exactly one degree in direction alone apart, as Open-Meteo’s servers differed on 2026-10-09', () => {
    const s = summarizeSurfaceWind([
      run('00:43', { om: om({ m15: [w('00:30', 130, 5.1, 11.9), w('00:45', 360, 5.2, 10.7), w('01:00', 115, 5.7, 10.3)] }) }),
      // 130 → 131 and 360 → 1 are one degree with nothing else changed;
      // 115 → 116 with a new speed is a revision of another kind.
      run('00:46', { om: om({ m15: [w('00:30', 131, 5.1, 11.9), w('00:45', 1, 5.2, 10.7), w('01:00', 116, 6.0, 10.3)] }) }),
    ]);
    const c = s.cadence.find((x) => x.source === 'om15');
    expect(c).toMatchObject({ revisionChanges: 3, revisionDirOnlyByOne: 2 });
  });

  it('`current` is compared across runs only when both name the same interval', () => {
    const s = summarizeSurfaceWind([
      run('00:31', { om: om({ current: { ...w('00:30', 131, 5.1), intervalS: 900 } }) }),
      run('00:34', { om: om({ current: { ...w('00:30', 130, 5.1), intervalS: 900 } }) }),
      // The next interval: a new valid time, so no revision pair.
      run('00:46', { om: om({ current: { ...w('00:45', 122, 5.2), intervalS: 900 } }) }),
    ]);
    const c = s.cadence.find((x) => x.source === 'omCurrent');
    expect(c).toMatchObject({ revisionPairs: 1, revisionChanges: 1, shownChanges: 2 });
  });

  it('staleness: the METAR from its observation time, NWS from updateTime, Open-Meteo from its run metadata', () => {
    const s = summarizeSurfaceWind([
      run('00:43', {
        metar: metar('00:35', 120, 5),
        nws: nws([], '2026-10-09T00:35:28+00:00'),
        om: om({ current: { ...w('00:30', 131, 5.1), intervalS: 900 } }),
        omMeta: {
          ncep_hrrr_conus: { init: '2026-10-08T22:00:00.000Z', modified: null, avail: '2026-10-08T23:51:00.000Z', stepS: 3600 },
          ncep_hrrr_conus_15min: { init: '2026-10-08T23:00:00.000Z', modified: null, avail: '2026-10-09T00:31:00.000Z', stepS: 900 },
        },
      }),
    ]);
    const age = Object.fromEntries(s.staleness.map((x) => [x.source, x.medianMin]));
    // Both Open-Meteo series from the 15-minute domain, which is what the
    // hourly values were seen to follow; the hourly domain (23:51) is not used.
    expect(age).toEqual({ metar: 8, nws: 7.5, omHourly: 12, om15: 12, omCurrent: 13 });
  });

  it('against the METAR: each report once, from the first run that saw it, read by each source’s rule', () => {
    const forecasts = {
      nws: nws([w('00:00', 140, 6, 10), w('01:00', 150, 9, 14)]),
      om: om({
        hourly: [w('00:00', 148, 5.3, 11.7), w('01:00', 115, 5.7, 10.3)],
        m15: [w('00:30', 131, 5.1, 11.9), w('00:45', 122, 5.2, 10.7)],
      }),
    };
    const s = summarizeSurfaceWind([
      run('00:43', { metar: metar('00:35', 120, 5), ...forecasts }),
      // The same report again, with forecasts that would change every
      // figure: it must not count.
      run('00:46', {
        metar: metar('00:35', 120, 5),
        nws: nws([w('00:00', 0, 30, 40)]),
        om: om({ hourly: [w('01:00', 0, 30, 40)], m15: [w('00:30', 0, 30, 40)] }),
      }),
    ]);
    const by = Object.fromEntries(s.vsMetar.map((v) => [v.source, v]));
    // NWS: the 00Z block, 140° 6 kt.
    expect(by.nws).toMatchObject({ n: 1, spd: { mean: 1 }, dir: { mean: 20 } });
    // Hourly: the nearest hour to 00:35 is 01Z, 115° 5.7 kt.
    expect(by.omHourly).toMatchObject({ n: 1, spd: { mean: 0.7 }, dir: { mean: -5 } });
    // 15-minute: 00:30, 131° 5.1 kt.
    expect(by.om15).toMatchObject({ n: 1, spd: { mean: 0.1 }, dir: { mean: 11 } });
    expect(by.nws.forecastGustWhenMetarNone).toBe(1);
  });

  it('against the METAR: direction left out when the METAR has none (calm or variable); gusts compared only when both have one', () => {
    const s = summarizeSurfaceWind([
      run('00:20', {
        metar: metar('00:15', null, 3),
        om: om({ m15: [w('00:15', 200, 4, 9)] }),
      }),
      run('00:40', {
        metar: metar('00:35', 180, 15, 24),
        om: om({ m15: [w('00:30', 190, 13, 20)] }),
      }),
      run('01:00', {
        metar: metar('00:55', 180, 15, 25),
        om: om({ m15: [w('01:00', 190, 13, null)] }),
      }),
    ]);
    const v = s.vsMetar.find((x) => x.source === 'om15');
    expect(v?.n).toBe(3);
    expect(v?.dir?.n).toBe(2);
    expect(v?.gust).toMatchObject({ n: 1, mean: -4 });
    expect(v).toMatchObject({ metarGusts: 2, forecastGustWhenMetarGust: 1, forecastGustWhenMetarNone: 1 });
  });

  it('against the METAR: `current` pairs with the first run whose interval contains the report', () => {
    const s = summarizeSurfaceWind([
      run('00:43', { metar: metar('00:35', 120, 5), om: om({ current: { ...w('00:30', 131, 5.1), intervalS: 900 } }) }),
      // Report at 00:55; the 00:58 run's `current` (00:45–01:00) contains it.
      run('00:58', { metar: metar('00:55', 120, 6), om: om({ current: { ...w('00:45', 122, 5.2), intervalS: 900 } }) }),
      // Report at 01:15; no run's `current` contains it, so it is not paired.
      run('01:33', { metar: metar('01:15', 120, 6), om: om({ current: { ...w('01:30', 120, 7), intervalS: 900 } }) }),
    ]);
    const v = s.vsMetar.find((x) => x.source === 'omCurrent');
    expect(v?.n).toBe(2);
    expect(v?.spd).toMatchObject({ n: 2, mean: -0.35 });
  });

  it('counts `current` equal to its 15-minute step, the default model equal to HRRR, and each model run once', () => {
    const meta = (init: string) => ({
      ncep_hrrr_conus_15min: { init, modified: null, avail: null, stepS: 900 },
    });
    const s = summarizeSurfaceWind([
      run('00:31', {
        om: om({ current: { ...w('00:30', 131, 5.1), intervalS: 900 }, m15: [w('00:30', 131, 5.1)] }),
        omMeta: meta('2026-10-08T23:00:00.000Z'),
      }),
      run('00:34', {
        om: om({
          current: { ...w('00:30', 130, 5.1), intervalS: 900 },
          m15: [w('00:30', 131, 5.1)],
          sameAsHrrr: false,
          hrrrMaxDiff: { dir: 1, spd: 0, gust: 0 },
        }),
        omMeta: meta('2026-10-08T23:00:00.000Z'),
      }),
      run('01:31', { om: om({ sameAsHrrr: null }), omMeta: meta('2026-10-09T00:00:00.000Z') }),
    ]);
    expect(s.currentIsM15).toEqual({ same: 1, of: 2 });
    expect(s.defaultIsHrrr).toEqual({
      same: 1,
      of: 2,
      diffs: [{ at: '2026-10-09T00:34:00.000Z', dir: 1, spd: 0, gust: 0 }],
    });
    expect(s.modelRuns.ncep_hrrr_conus_15min.map((r) => [r.init, r.firstSeenAt])).toEqual([
      ['2026-10-08T23:00:00.000Z', '2026-10-09T00:31:00.000Z'],
      ['2026-10-09T00:00:00.000Z', '2026-10-09T01:31:00.000Z'],
    ]);
  });

  it('counts runs whose hourly steps all equal the 15-minute step at the same time', () => {
    const s = summarizeSurfaceWind([
      run('00:43', { om: om({ hourly: [w('00:00', 148, 5.3, 11.7), w('01:00', 115, 5.7, 10.3)], m15: [w('00:45', 122, 5.2), w('01:00', 115, 5.7, 10.3)] }) }),
      // One hour agrees, the other does not: not the same.
      run('00:46', { om: om({ hourly: [w('00:00', 148, 5.3, 11.7), w('01:00', 115, 5.7, 10.3)], m15: [w('00:00', 148, 5.3, 11.7), w('01:00', 114, 5.7, 10.3)] }) }),
      // No 15-minute step on any hour: not counted.
      run('00:49', { om: om({ hourly: [w('01:00', 115, 5.7, 10.3)], m15: [w('00:45', 122, 5.2)] }) }),
    ]);
    expect(s.hourlyIsM15).toEqual({ same: 1, of: 2 });
  });

  it('sets each hourly gust against the largest 15-minute gust of the hour before it', () => {
    const s = summarizeSurfaceWind([
      run('01:10', {
        om: om({
          // The 01Z hourly gust is the 01:00 step's (10.3), below the hour's
          // largest, which is the earliest of its four steps (12.2 at 00:15).
          // 02Z equals its hour's largest. 00Z lacks the three steps before
          // it: not counted.
          hourly: [w('00:00', 148, 5.3, 11.7), w('01:00', 115, 5.7, 10.3), w('02:00', 130, 6.2, 13.6)],
          m15: [
            w('00:00', 148, 5.3, 11.7),
            w('00:15', 137, 5.6, 12.2),
            w('00:30', 131, 5.1, 9.5),
            w('00:45', 122, 5.2, 9.3),
            w('01:00', 115, 5.7, 10.3),
            w('01:15', 117, 5.7, 10.7),
            w('01:30', 122, 5.7, 11.7),
            w('01:45', 122, 6.1, 12.8),
            w('02:00', 130, 6.2, 13.6),
          ],
        }),
      }),
    ]);
    expect(s.hourlyGustVsHourMax).toEqual({ steps: 2, equal: 1, below: 1, above: 0 });
  });

  it('lists each NWS gridpoint updateTime once, with the first run that saw it', () => {
    const s = summarizeSurfaceWind([
      run('00:43', { nws: nws([], '2026-10-09T00:35:28+00:00') }),
      run('00:46', { nws: nws([], '2026-10-09T00:35:28+00:00') }),
      run('01:40', { nws: nws([], '2026-10-09T01:34:02+00:00') }),
    ]);
    expect(s.nwsUpdates.map((u) => [u.updateTime, u.firstSeenAt])).toEqual([
      ['2026-10-09T00:35:28+00:00', '2026-10-09T00:43:00.000Z'],
      ['2026-10-09T01:34:02+00:00', '2026-10-09T01:40:00.000Z'],
    ]);
  });

  it('sorts by run time and counts a run logged twice once', () => {
    const a = run('00:03', { metar: metar('00:00', 130, 5) });
    const b = run('00:00', { metar: metar('23:55', 120, 5) });
    const s = summarizeSurfaceWind([a, b, a]);
    expect(s.records).toBe(2);
    expect(s.firstAt).toBe('2026-10-09T00:00:00.000Z');
    expect(s.cadence.find((x) => x.source === 'metar')?.shownChanges).toBe(1);
  });
});

describe('the log lines', () => {
  const log = [
    'some table text',
    `@@parity ${JSON.stringify(run('00:43'))}`,
    '@@parity {"kind":"usairnet","at":"2026-10-09T00:43:00Z"}',
    '@@parity {"kind":"surfacewind", truncated',
  ].join('\n');

  it('parseSurfaceWindLines takes only surfacewind records', () => {
    expect(parseSurfaceWindLines(log).map((r) => r.at)).toEqual(['2026-10-09T00:43:00.000Z']);
  });

  it('the #parity summary’s parser leaves them out, so a mixed log cannot feed that page', () => {
    expect(parseParityLines(log).map((r) => r.kind)).toEqual(['usairnet']);
  });
});
