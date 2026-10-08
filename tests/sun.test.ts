import { describe, expect, it } from 'vitest';
import { nightIntervals, skyPhase, sunTimes } from '../src/domain/sun';

// LSPC / Weeping Water, NE
const LAT = 40.8675;
const LON = -96.11;
const HOUR = 3600_000;

describe('sunTimes', () => {
  it('puts a summer day at ~15 hours between sunrise and sunset', () => {
    const noonLocal = new Date('2026-06-27T18:00:00Z'); // ~noon CDT
    const { sunrise, sunset } = sunTimes(LAT, LON, noonLocal);
    expect(sunrise).toBeLessThan(sunset);
    const hours = (sunset - sunrise) / HOUR;
    expect(hours).toBeGreaterThan(14);
    expect(hours).toBeLessThan(16);
  });

  it('selects the local solar day, not the UTC day (regression)', () => {
    // 2026-06-28T01:00Z is 2026-06-27 ~20:00 CDT — still before that evening's
    // sunset. Sunset must be a couple hours ahead, NOT ~26 h ahead.
    const evening = new Date('2026-06-28T01:00:00Z');
    const { sunset } = sunTimes(LAT, LON, evening);
    const hoursToSunset = (sunset - evening.getTime()) / HOUR;
    expect(hoursToSunset).toBeGreaterThan(0);
    expect(hoursToSunset).toBeLessThan(4);
  });

  /* Reference times from NOAA's Solar Calculator's own functions
   * (gml.noaa.gov/grad/solcalc/main.js, run under Node on 2026-10-03:
   * getJD, then calcSunriseSetUTC twice as its calcSunriseSet does). The
   * app's sunset feeds the 14 CFR 105.19 night flag, so it is held to a
   * second; the simplified equation it replaced was 2 min 21 s late on
   * 2026-09-29. */
  const NOAA: Array<[string, number, number, string, string, string]> = [
    ['DZ', LAT, LON, '2026-09-29T18:00:00Z', '2026-09-29T12:19:07.453Z', '2026-09-30T00:09:34.429Z'],
    ['DZ', LAT, LON, '2026-10-02T18:00:00Z', '2026-10-02T12:22:10.981Z', '2026-10-03T00:04:34.420Z'],
    ['DZ', LAT, LON, '2026-06-21T18:00:00Z', '2026-06-21T10:52:55.587Z', '2026-06-22T01:59:42.622Z'],
    ['DZ', LAT, LON, '2026-12-21T18:00:00Z', '2026-12-21T13:45:30.969Z', '2026-12-21T22:59:46.782Z'],
    ['DZ', LAT, LON, '2026-03-08T18:00:00Z', '2026-03-08T12:47:16.280Z', '2026-03-09T00:23:37.117Z'],
    ['DZ', LAT, LON, '2026-11-01T18:00:00Z', '2026-11-01T12:55:09.418Z', '2026-11-01T23:20:15.209Z'],
    ['KPMV', 40.9502, -95.9179, '2026-09-29T18:00:00Z', '2026-09-29T12:18:22.523Z', '2026-09-30T00:08:47.058Z'],
  ];

  // The port is NOAA's arithmetic, so it agrees to within float rounding of
  // the millisecond-rounded references; 5 ms is tight enough that dropping
  // even NOAA's smallest term (aberration and nutation, under a second
  // here) fails.
  const TOLERANCE_MS = 5;

  it.each(NOAA)('matches NOAA’s calculator (%s, %s)', (_name, lat, lon, at, rise, set) => {
    const { sunrise, sunset } = sunTimes(lat, lon, new Date(at));
    expect(Math.abs(sunrise - Date.parse(rise))).toBeLessThan(TOLERANCE_MS);
    expect(Math.abs(sunset - Date.parse(set))).toBeLessThan(TOLERANCE_MS);
  });

  it('gives the same day’s times from any instant in that local day', () => {
    // 6:30 AM and 11:30 PM CDT on 2026-09-29 both belong to the day whose
    // sunset is 7:09:34 PM CDT.
    for (const at of ['2026-09-29T11:30:00Z', '2026-09-30T04:30:00Z']) {
      expect(Math.abs(sunTimes(LAT, LON, new Date(at)).sunset - Date.parse('2026-09-30T00:09:34.429Z'))).toBeLessThan(1000);
    }
  });
});

/* The Hourly wind chart shades these spans, so they must be exactly the
 * sunset-to-sunrise the night flag uses, clipped to the chart's range. */
describe('nightIntervals', () => {
  const lat = 40.8675;
  const lon = -96.11;
  const oct3 = sunTimes(lat, lon, new Date('2026-10-03T18:00:00Z'));
  const oct4 = sunTimes(lat, lon, new Date('2026-10-04T18:00:00Z'));
  const oct5 = sunTimes(lat, lon, new Date('2026-10-05T18:00:00Z'));

  it('runs from one day\'s sunset to the next day\'s sunrise', () => {
    const from = Date.parse('2026-10-03T18:00:00Z'); // 1 PM CDT
    const to = Date.parse('2026-10-04T18:00:00Z');
    expect(nightIntervals(lat, lon, from, to)).toEqual([[oct3.sunset, oct4.sunrise]]);
  });

  it('clips a night the range starts or ends inside', () => {
    const from = Date.parse('2026-10-04T05:00:00Z'); // midnight CDT, mid-night
    const to = Date.parse('2026-10-05T03:00:00Z'); // 10 PM CDT on the 4th
    expect(nightIntervals(lat, lon, from, to)).toEqual([
      [from, oct4.sunrise],
      [oct4.sunset, to],
    ]);
  });

  it('gives one span per night over several days, in order', () => {
    const from = Date.parse('2026-10-03T18:00:00Z');
    const to = Date.parse('2026-10-05T18:00:00Z');
    expect(nightIntervals(lat, lon, from, to)).toEqual([
      [oct3.sunset, oct4.sunrise],
      [oct4.sunset, oct5.sunrise],
    ]);
  });

  it('is empty for a range inside the day, and for an empty range', () => {
    expect(nightIntervals(lat, lon, Date.parse('2026-10-03T15:00:00Z'), Date.parse('2026-10-03T20:00:00Z'))).toEqual([]);
    expect(nightIntervals(lat, lon, 5, 5)).toEqual([]);
  });
});

describe('skyPhase', () => {
  const oct3 = sunTimes(LAT, LON, new Date('2026-10-03T18:00:00Z'));
  const oct4 = sunTimes(LAT, LON, new Date('2026-10-04T18:00:00Z'));

  it('is day from sunrise to sunset, with how far through', () => {
    const mid = (oct4.sunrise + oct4.sunset) / 2;
    const p = skyPhase(LAT, LON, mid);
    expect(p).toMatchObject({ phase: 'day', startMs: oct4.sunrise, endMs: oct4.sunset });
    expect(p?.fraction).toBeCloseTo(0.5, 6);
    expect(skyPhase(LAT, LON, oct4.sunrise)?.phase).toBe('day');
  });

  it('is night from sunset to the next sunrise, across midnight', () => {
    // 1 AM CDT on Oct 4 (06Z): the night began the evening before.
    const p = skyPhase(LAT, LON, Date.parse('2026-10-04T06:00:00Z'));
    expect(p?.phase).toBe('night');
    expect(p?.startMs).toBe(oct3.sunset);
    expect(p?.endMs).toBe(oct4.sunrise);
    // 9 PM CDT on Oct 3 (02Z Oct 4), before midnight: the same night.
    expect(skyPhase(LAT, LON, Date.parse('2026-10-04T02:00:00Z'))?.startMs).toBe(oct3.sunset);
  });

  it('is still the same night after solar midnight, before dawn', () => {
    // 4 AM CDT (09Z): past solar midnight (about 1:25 AM CDT here), so the
    // clock's own solar day is Oct 4 and the night's sunset is the day
    // before's. The case the day before in the lookup exists for.
    const p = skyPhase(LAT, LON, Date.parse('2026-10-04T09:00:00Z'));
    expect(p).toMatchObject({ phase: 'night', startMs: oct3.sunset, endMs: oct4.sunrise });
  });

  it('turns to night at sunset itself, as the night flag does', () => {
    expect(skyPhase(LAT, LON, oct4.sunset)?.phase).toBe('night');
    expect(skyPhase(LAT, LON, oct4.sunset - 1)?.phase).toBe('day');
    expect(skyPhase(LAT, LON, oct4.sunset)?.fraction).toBe(0);
  });
});

