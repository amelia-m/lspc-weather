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
});
