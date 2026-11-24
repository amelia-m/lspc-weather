import { describe, expect, it } from 'vitest';
import {
  mergeSurfaceWindLines,
  unarchivedSurfaceWindLines,
  compareWindResponses,
  defaultModelByDay,
  DEFAULT_MODEL_NOTICE_DAYS,
  defaultModelNotice,
  defaultModelSwitched,
  DEFAULT_MODEL_MIN_RUNS,
  hasWind,
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

  it('compareWindResponses: the same, a gap, or a difference of shape that no gap explains', () => {
    const a = [w('00:00', 147, 5.3, 11.7), w('00:15', 136, 5.6, 12.2)];
    expect(compareWindResponses([[a, a]])).toEqual({ same: true });
    expect(compareWindResponses([[a, [w('00:00', 148, 5.3, 11.7), w('00:15', 136, 5.6, 12.2)]]])).toEqual({
      same: false,
      diff: { dir: 1, spd: 0, gust: 0 },
    });
    // One step fewer, the rest identical: 0/0/0 alone would read as no
    // difference at all.
    expect(compareWindResponses([[a, a], [a, a.slice(0, 1)]])).toEqual({
      same: false,
      diff: { dir: 0, spd: 0, gust: 0, shapeDiffers: true },
    });
    // Same length, different times.
    expect(compareWindResponses([[a, [a[0], { ...a[1], t: '2026-10-09T00:30:00.000Z' }]]]).diff?.shapeDiffers).toBe(true);
    // A value served on one side only (a gust against null) at the same
    // times: not the same, and the 0/0/0 gaps are marked as not explaining it.
    const noGust = a.map((x) => ({ ...x, gust: null }));
    const mixed = compareWindResponses([[a, [noGust[0], a[1]]]]);
    expect(mixed.same).toBe(false);
    expect(mixed.diff?.shapeDiffers).toBe(true);
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
      run('00:03', { om: om({ hourly: [w('01:00', 114, 6.0), w('02:00', 129, 6.5)] }) }),
      // Another server, still on the older run: both go back.
      run('00:06', { om: om({ hourly: [w('01:00', 115, 5.7), w('02:00', 130, 6.2)] }) }),
      // Unchanged, plus an hour the previous run did not have, which is not
      // a pair.
      run('00:09', { om: om({ hourly: [w('01:00', 115, 5.7), w('02:00', 130, 6.2), w('03:00', 140, 7)] }) }),
    ]);
    const c = s.cadence.find((x) => x.source === 'omHourly');
    expect(c?.revisionPairs).toBe(6);
    expect(c?.revisionChanges).toBe(4);
    expect(c?.revisionKinds).toEqual({ dirByOne: 0, revert: 2, other: 2 });
    expect(c?.revisions).toEqual(['2026-10-09T00:03:00.000Z', '2026-10-09T00:06:00.000Z']);
  });

  it('sorts revisions into one-degree flaps, reverts and others, which partition them', () => {
    const s = summarizeSurfaceWind([
      run('00:43', { om: om({ m15: [w('00:30', 130, 5.1, 11.9), w('00:45', 360, 5.2, 10.7), w('01:00', 115, 5.7, 10.3)] }) }),
      // 130 → 131 and 360 → 1 are one degree with nothing else changed, as
      // Open-Meteo's servers differed on 2026-10-09; 115 → 116 with a new
      // speed is another kind.
      run('00:46', { om: om({ m15: [w('00:30', 131, 5.1, 11.9), w('00:45', 1, 5.2, 10.7), w('01:00', 116, 6.0, 10.3)] }) }),
      // 131 → 130 is a flap AND a return to a value served before: it
      // counts once, as a flap, the first kind that fits.
      run('00:49', { om: om({ m15: [w('00:30', 130, 5.1, 11.9), w('00:45', 1, 5.2, 10.7), w('01:00', 116, 6.0, 10.3)] }) }),
    ]);
    const c = s.cadence.find((x) => x.source === 'om15');
    expect(c?.revisionChanges).toBe(4);
    expect(c?.revisionKinds).toEqual({ dirByOne: 3, revert: 0, other: 1 });
    // The 00:49 run changed nothing but a flap.
    expect(c?.revisions).toEqual(['2026-10-09T00:46:00.000Z', '2026-10-09T00:49:00.000Z']);
    expect(c?.revisionsNet).toEqual(['2026-10-09T00:46:00.000Z']);
  });

  it('the shown value net of one-degree flaps: a flap on the same valid time is left out, a new step is not', () => {
    const s = summarizeSurfaceWind([
      run('00:31', { om: om({ current: { ...w('00:30', 131, 5.1), intervalS: 900 } }) }),
      run('00:34', { om: om({ current: { ...w('00:30', 130, 5.1), intervalS: 900 } }) }),
      run('00:37', { om: om({ current: { ...w('00:30', 131, 5.1), intervalS: 900 } }) }),
      // A new quarter hour one degree from the last: a change of step, kept.
      run('00:46', { om: om({ current: { ...w('00:45', 130, 5.1), intervalS: 900 } }) }),
      run('00:49', { om: om({ current: { ...w('00:45', 128, 5.6), intervalS: 900 } }) }),
    ]);
    const c = s.cadence.find((x) => x.source === 'omCurrent');
    expect(c).toMatchObject({ shownChanges: 4, shownChangesNet: 2 });
    expect(c?.shownIntervalMin).toEqual({ median: 3, min: 3, max: 9 });
    expect(c?.shownIntervalNetMin).toEqual({ median: 3, min: 3, max: 3 });
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
    // No RRFS in this run (a record from before version 3): no age for it.
    expect(age).toEqual({ metar: 8, nws: 7.5, omHourly: 12, om15: 12, omCurrent: 13, rrfsHourly: null });
    expect(s.staleness.find((x) => x.source === 'om15')?.basis).toMatch(/^INFERRED/);
  });

  it('staleness: a run whose forecast request failed is not counted for Open-Meteo, though its metadata was read', () => {
    const meta = {
      ncep_hrrr_conus_15min: { init: '2026-10-08T23:00:00.000Z', modified: null, avail: '2026-10-09T00:31:00.000Z', stepS: 900 },
    };
    const s = summarizeSurfaceWind([
      run('00:43', { om: om({}), omMeta: meta }),
      run('01:31', { omError: 'connect timeout', omMeta: meta }),
    ]);
    const om15 = s.staleness.find((x) => x.source === 'om15');
    expect(om15).toMatchObject({ n: 1, medianMin: 12, maxMin: 12 });
  });

  it('errors: a run whose HRRR comparison was not made is counted, not left out silently', () => {
    const s = summarizeSurfaceWind([
      run('00:43', { om: om({}) }),
      run('00:46', { om: om({ sameAsHrrr: null }), omHrrrError: 'no wind values in the response' }),
    ]);
    expect(s.errors.omHrrr).toBe(1);
    // And it is not counted as compared.
    expect(s.defaultIsHrrr).toMatchObject({ same: 1, of: 1 });
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

  it('against the METAR: per source, the first run with that source’s forecast while the report was newest', () => {
    const s = summarizeSurfaceWind([
      // Open-Meteo failed on the first run that saw the 00:35 report…
      run('00:43', { metar: metar('00:35', 120, 5), nws: nws([w('00:00', 140, 6, 10)]), omError: 'connect timeout' }),
      // …so the next run with that report as its newest fills in for it,
      // while NWS stays on the first run's forecast.
      run('00:46', {
        metar: metar('00:35', 120, 5),
        nws: nws([w('00:00', 0, 30, 40)]),
        om: om({ m15: [w('00:30', 131, 5.1, 11.9)] }),
      }),
      // A new report: an Open-Meteo forecast here is not read for 00:35.
      run('00:58', { metar: metar('00:55', 120, 6), omError: 'connect timeout' }),
      run('01:01', { metar: metar('00:55', 120, 6), omError: 'connect timeout' }),
      run('01:04', { metar: metar('01:15', 120, 6), om: om({ m15: [w('00:30', 0, 30, 40), w('01:00', 0, 30, 40)] }) }),
    ]);
    const by = Object.fromEntries(s.vsMetar.map((v) => [v.source, v]));
    expect(by.nws).toMatchObject({ n: 1, spd: { mean: 1 } });
    // 00:35 paired from the 00:46 run; 00:55 had no run with a forecast; the
    // 01:15 report's run had one but no step within 7.5 minutes.
    expect(by.om15).toMatchObject({ reports: 3, n: 1, spd: { mean: 0.1 }, dir: { mean: 11 } });
  });

  it('against the METAR: counts no direction error for a calm report, even one carrying the NWS decode’s 0°', () => {
    // A version-1 record read through the NWS path carried 0° for calm;
    // version 2 carries null. Neither has a direction to miss by.
    const s = summarizeSurfaceWind([
      run('00:20', { metar: { ...metar('00:15', 0, 0)!, source: 'nws' as const }, om: om({ m15: [w('00:15', 200, 4, 9)] }) }),
    ]);
    const by = Object.fromEntries(s.vsMetar.map((v) => [v.source, v]));
    expect(by.om15.n).toBe(1);
    expect(by.om15.dir?.n ?? 0).toBe(0);
    expect(by.om15.spd?.n).toBe(1);
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

  // One response as served on 2026-10-09: the 01Z hourly gust is the 01:00
  // step's (10.3), below the hour's largest, which is the earliest of its
  // four steps (12.2 at 00:15). 02Z equals its hour's largest. 00Z lacks the
  // three steps before it: not counted.
  const gustHourly = [w('00:00', 148, 5.3, 11.7), w('01:00', 115, 5.7, 10.3), w('02:00', 130, 6.2, 13.6)];
  const gustM15 = [
    w('00:00', 148, 5.3, 11.7),
    w('00:15', 137, 5.6, 12.2),
    w('00:30', 131, 5.1, 9.5),
    w('00:45', 122, 5.2, 9.3),
    w('01:00', 115, 5.7, 10.3),
    w('01:15', 117, 5.7, 10.7),
    w('01:30', 122, 5.7, 11.7),
    w('01:45', 122, 6.1, 12.8),
    w('02:00', 130, 6.2, 13.6),
  ];

  it('sets each hourly gust against the largest 15-minute gust of the hour before it', () => {
    const s = summarizeSurfaceWind([run('01:10', { om: om({ hourly: gustHourly, m15: gustM15 }) })]);
    expect(s.hourlyGustVsHourMax).toEqual({ hours: 2, equal: 1, below: 1, above: 0, maxBelowKt: 1.9 });
  });

  it('counts each valid hour once, as the latest run served it, however many runs carried it', () => {
    const later = gustHourly.map((h) => (h.t.endsWith('01:00:00.000Z') ? { ...h, gust: 12.2 } : h));
    const s = summarizeSurfaceWind([
      run('01:10', { om: om({ hourly: gustHourly, m15: gustM15 }) }),
      run('01:13', { om: om({ hourly: gustHourly, m15: gustM15 }) }),
      // The latest run's 01Z gust equals the hour's largest: that is the
      // reading counted.
      run('01:16', { om: om({ hourly: later, m15: gustM15 }) }),
    ]);
    expect(s.hourlyGustVsHourMax).toEqual({ hours: 2, equal: 2, below: 0, above: 0, maxBelowKt: 0 });
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

describe('the archive step', () => {
  const line = (at: string, extra = ''): string => `@@parity {"kind":"surfacewind","v":1,"at":"${at}"${extra}}`;

  it('keeps each run once, skips the runs an archive holds, and orders by run time', () => {
    const fresh = [
      'other text',
      line('2026-11-02T10:05:00.000Z', ',"n":2'),
      line('2026-11-02T10:00:00.000Z'),
      // The same run uploaded twice (a re-run): one copy.
      line('2026-11-02T10:05:00.000Z', ',"n":2'),
      '@@parity {"kind":"schulze","at":"2026-11-02T10:01:00.000Z"}',
    ].join('\n');
    const archived = line('2026-11-02T10:00:00.000Z');
    expect(unarchivedSurfaceWindLines(fresh, archived)).toEqual([line('2026-11-02T10:05:00.000Z', ',"n":2')]);
    expect(unarchivedSurfaceWindLines(fresh, '')).toEqual([
      line('2026-11-02T10:00:00.000Z'),
      line('2026-11-02T10:05:00.000Z', ',"n":2'),
    ]);
  });

  it('merges new lines into an archive in run order', () => {
    const existing = [line('2026-11-02T10:00:00.000Z'), line('2026-11-02T10:10:00.000Z')].join('\n');
    expect(mergeSurfaceWindLines(existing, [line('2026-11-02T10:05:00.000Z')])).toEqual([
      line('2026-11-02T10:00:00.000Z'),
      line('2026-11-02T10:05:00.000Z'),
      line('2026-11-02T10:10:00.000Z'),
    ]);
  });
});

describe('hasWind', () => {
  const step = (t: string, dir: number | null, spd: number | null): WindAt => ({ t, dir, spd, gust: null });
  it('is true when any step of any series has a direction or speed', () => {
    expect(hasWind([[], [step('2026-10-09T00:00:00.000Z', null, 5)]])).toBe(true);
    expect(hasWind([[step('2026-10-09T00:00:00.000Z', 140, null)], []])).toBe(true);
  });
  it('is false for no steps, or steps that are all null (a model not yet available)', () => {
    expect(hasWind([[], [], []])).toBe(false);
    expect(hasWind([[step('2026-10-09T00:00:00.000Z', null, null)], [step('2026-10-09T00:15:00.000Z', null, null)]])).toBe(false);
  });
});

/* The RRFS beside the default, from record version 3 (2026-11-24): Open-Meteo
 * says the HRRR, which the default is served from here, goes with RRFSv2, so
 * the sampler asks the RRFS by name each run (docs/rrfs-comparison-plan.md). */
describe('the RRFS as a forecast source', () => {
  const rrfsMeta = { init: '2026-10-08T18:00:00.000Z', modified: null, avail: '2026-10-09T00:13:00.000Z', stepS: 3600 };

  it('is shown as its nearest hour, read as the default’s hourly wind is', () => {
    const r = run('00:43', { rrfs: { hourly: [w('00:00', 150, 7), w('01:00', 160, 9)] } });
    expect(shownAt(r, 'rrfsHourly')).toEqual(w('01:00', 160, 9));
    // A record from before version 3 never asked: no value, not an error.
    expect(shownAt(run('00:43'), 'rrfsHourly')).toBeNull();
  });

  it('is paired against the report like any other source, and its failures counted', () => {
    const s = summarizeSurfaceWind([
      run('00:43', { metar: metar('00:35', 120, 5), rrfs: { hourly: [w('01:00', 150, 8)] }, om: om({}), omMeta: { ncep_rrfs_conus: rrfsMeta } }),
      run('01:00', { metar: metar('00:55', 130, 6), rrfsError: 'HTTP 502', om: om({}) }),
      // Before version 3: neither a value nor a failure.
      run('01:17', { metar: metar('01:15', 130, 6), om: om({}) }),
    ]);
    const vs = s.vsMetar.find((x) => x.source === 'rrfsHourly');
    expect(vs).toMatchObject({ reports: 3, n: 1 });
    expect(s.errors.rrfsHourly).toBe(1);
    // Its age is taken from its own domain's metadata: 00:43 less 00:13.
    const age = s.staleness.find((x) => x.source === 'rrfsHourly');
    expect(age).toMatchObject({ n: 1, medianMin: 30 });
    expect(age?.basis).toMatch(/^INFERRED: run time minus ncep_rrfs_conus/);
  });

  it('counts how often the default returned the RRFS’s numbers, over the runs that compared them', () => {
    const s = summarizeSurfaceWind([
      run('00:43', { om: om({ sameAsRrfs: false }) }),
      run('01:00', { om: om({ sameAsRrfs: true }) }),
      run('01:17', { om: om({ sameAsRrfs: null }) }),
      run('01:34', { om: om({}) }),
    ]);
    expect(s.defaultIsRrfs).toEqual({ same: 1, of: 2 });
  });
});

describe('the day Open-Meteo’s default model changes', () => {
  /** `n` runs seventeen minutes apart from midnight UTC on `day`. */
  const dayOf = (day: string, n: number, part: (i: number) => Partial<NonNullable<SurfaceWindRecord['om']>>): SurfaceWindRecord[] =>
    Array.from({ length: n }, (_, i) => ({
      kind: 'surfacewind' as const,
      v: 3,
      at: new Date(Date.parse(`${day}T00:00:00.000Z`) + i * 17 * 60_000).toISOString(),
      dz: '40.8703,-96.1085',
      om: om(part(i)),
    }));

  it('is not called on an ordinary day: the default is the HRRR and never the RRFS', () => {
    const [d] = defaultModelByDay(dayOf('2026-11-24', 80, () => ({ sameAsHrrr: true, sameAsRrfs: false })));
    expect(d).toEqual({
      day: '2026-11-24',
      hrrrCompared: 80,
      notHrrr: 0,
      rrfsCompared: 80,
      isRrfs: 0,
      defaultRuns: 80,
      hrrrFailed: 0,
      switched: false,
    });
  });

  it('is not called for a few hours of difference, which a run being copied gives', () => {
    // Twelve of eighty runs, about three and a half hours.
    const [d] = defaultModelByDay(dayOf('2026-10-25', 80, (i) => ({ sameAsHrrr: i >= 12, sameAsRrfs: false })));
    expect(d.notHrrr).toBe(12);
    expect(d.switched).toBe(false);
  });

  it('is called when most of a day’s runs differ from the HRRR, or match the RRFS', () => {
    const notHrrr = defaultModelByDay(dayOf('2026-12-01', 80, () => ({ sameAsHrrr: false, sameAsRrfs: null })));
    expect(notHrrr[0].switched).toBe(true);
    // The HRRR request failing all day (null) leaves the RRFS side to say so.
    const isRrfs = defaultModelByDay(dayOf('2026-12-01', 80, () => ({ sameAsHrrr: null, sameAsRrfs: true })));
    expect(isRrfs[0]).toMatchObject({ hrrrCompared: 0, rrfsCompared: 80, isRrfs: 80, switched: true });
  });

  it('is called when the HRRR can no longer be had by name, though nothing is left to compare', () => {
    // Open-Meteo withdraws the model: every by-name request fails, the
    // default still answers, and the new default is no model the sampler
    // names, so neither comparison moves.
    const gone = dayOf('2026-12-10', 80, () => ({ sameAsHrrr: null, sameAsRrfs: false })).map((r) => ({
      ...r,
      omHrrrError: 'HTTP 400',
    }));
    const [d] = defaultModelByDay(gone);
    expect(d).toMatchObject({ hrrrCompared: 0, notHrrr: 0, defaultRuns: 80, hrrrFailed: 80, switched: true });
    // A morning of failures is not the model gone.
    const morning = dayOf('2026-12-10', 80, () => ({ sameAsHrrr: true, sameAsRrfs: false })).map((r, i) =>
      i < 30 ? { ...r, om: om({ sameAsHrrr: null, sameAsRrfs: false }), omHrrrError: 'timeout' } : r,
    );
    expect(defaultModelByDay(morning)[0].switched).toBe(false);
  });

  it('is not called on a handful of runs, however they read', () => {
    const few = {
      hrrrCompared: DEFAULT_MODEL_MIN_RUNS - 1,
      notHrrr: DEFAULT_MODEL_MIN_RUNS - 1,
      rrfsCompared: 0,
      isRrfs: 0,
      defaultRuns: DEFAULT_MODEL_MIN_RUNS - 1,
      hrrrFailed: 0,
    };
    expect(defaultModelSwitched(few)).toBe(false);
    expect(defaultModelSwitched({ ...few, hrrrCompared: DEFAULT_MODEL_MIN_RUNS, notHrrr: DEFAULT_MODEL_MIN_RUNS })).toBe(true);
    // Exactly half is not most.
    expect(defaultModelSwitched({ hrrrCompared: 40, notHrrr: 20, rrfsCompared: 0, isRrfs: 0, defaultRuns: 40, hrrrFailed: 0 })).toBe(false);
  });

  it('raises the notice from the first whole day that reads as switched, naming that day while the change holds', () => {
    const ok = dayOf('2026-11-29', 80, () => ({ sameAsHrrr: true, sameAsRrfs: false }));
    const switchedOn = (day: string): SurfaceWindRecord[] => dayOf(day, 80, () => ({ sameAsHrrr: false, sameAsRrfs: true }));
    const first = switchedOn('2026-11-30');
    // The morning after the first switched day: a notice, naming that day.
    const n = defaultModelNotice(defaultModelByDay([...ok, ...first]), '2026-12-01');
    expect(n).toMatchObject({ day: '2026-11-30', since: '2026-11-30', label: 'model-switch' });
    expect(n?.title).toContain('2026-11-30');
    expect(n?.body).toContain('| 2026-11-30 | 80 of 80 | 80 of 80 | 0 of 80 |');
    // The day after, the change still holds: the notice again, still for
    // the first day, so a run that missed yesterday's can still raise it
    // and one that did not can find the issue it opened.
    const again = defaultModelNotice(defaultModelByDay([...ok, ...first, ...switchedOn('2026-12-01')]), '2026-12-02');
    expect(again).toMatchObject({ day: '2026-12-01', since: '2026-11-30' });
    expect(again?.title).toBe(n?.title);
    // The day in progress is never judged: the first switched day is today.
    expect(defaultModelNotice(defaultModelByDay([...ok, ...first]), '2026-11-30')).toBeNull();
    // An ordinary day raises nothing.
    expect(defaultModelNotice(defaultModelByDay(ok), '2026-11-30')).toBeNull();
  });

  it('stops giving the notice once the change has held longer than the notice window', () => {
    const ok = dayOf('2026-11-29', 80, () => ({ sameAsHrrr: true, sameAsRrfs: false }));
    const switched = (count: number): SurfaceWindRecord[] =>
      Array.from({ length: count }, (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`).flatMap((day) =>
        dayOf(day, 30, () => ({ sameAsHrrr: false, sameAsRrfs: true })),
      );
    const dayAfter = (count: number): string => `2026-12-${String(count + 1).padStart(2, '0')}`;
    const at = (count: number): unknown => defaultModelNotice(defaultModelByDay([...ok, ...switched(count)]), dayAfter(count));
    expect(at(DEFAULT_MODEL_NOTICE_DAYS)).toMatchObject({ since: '2026-12-01' });
    expect(at(DEFAULT_MODEL_NOTICE_DAYS + 1)).toBeNull();
    // A switch back and a second change is a new run of days, with its own first day.
    const back = dayOf('2026-12-09', 80, () => ({ sameAsHrrr: true, sameAsRrfs: false }));
    const second = dayOf('2026-12-10', 80, () => ({ sameAsHrrr: false, sameAsRrfs: true }));
    expect(defaultModelNotice(defaultModelByDay([...ok, ...switched(8), ...back, ...second]), '2026-12-11')).toMatchObject({
      since: '2026-12-10',
    });
  });

  it('counts each run once and keeps the days in order', () => {
    const a = dayOf('2026-11-25', 3, () => ({ sameAsHrrr: true, sameAsRrfs: false }));
    const b = dayOf('2026-11-24', 2, () => ({ sameAsHrrr: true, sameAsRrfs: false }));
    const days = defaultModelByDay([...a, ...b, ...a]);
    expect(days.map((d) => [d.day, d.hrrrCompared])).toEqual([['2026-11-24', 2], ['2026-11-25', 3]]);
  });
});
