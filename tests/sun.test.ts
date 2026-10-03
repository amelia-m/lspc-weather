import { describe, expect, it } from 'vitest';
import { sunTimes } from '../src/domain/sun';

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
