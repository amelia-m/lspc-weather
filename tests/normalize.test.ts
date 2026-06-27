import { describe, expect, it } from 'vitest';
import {
  durationToHours,
  normalizeGridpoint,
  normalizeMetar,
  parseValidTime,
} from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';
import { GRIDPOINT_FIXTURE } from '../src/api/fixtures/gridpoint';

describe('durationToHours', () => {
  it('parses hour and day durations', () => {
    expect(durationToHours('PT1H')).toBe(1);
    expect(durationToHours('PT6H')).toBe(6);
    expect(durationToHours('P1DT6H')).toBe(30);
    expect(durationToHours('PT30M')).toBe(1); // partial hour rounds up
  });
});

describe('parseValidTime', () => {
  it('splits an interval into start epoch + hours', () => {
    const p = parseValidTime('2025-06-27T13:00:00+00:00/PT3H');
    expect(p?.hours).toBe(3);
    expect(p?.start).toBe(Date.parse('2025-06-27T13:00:00+00:00'));
  });
});

describe('normalizeMetar', () => {
  it('picks the lowest BKN/OVC layer as the ceiling and converts altimeter', () => {
    const c = normalizeMetar(METAR_FIXTURE[0]);
    expect(c.station).toBe('KPMV');
    expect(c.ceilingFtAgl).toBe(4500); // FEW 3500 ignored, BKN 4500 is the ceiling
    expect(c.wind.gustKt).toBe(22);
    expect(c.altimeterInHg).toBeGreaterThan(29.9);
    expect(c.altimeterInHg).toBeLessThan(30.0);
  });
});

describe('normalizeGridpoint', () => {
  it('expands interval values into an hourly series with converted units', () => {
    const hourly = normalizeGridpoint(GRIDPOINT_FIXTURE);
    expect(hourly.length).toBeGreaterThan(0);
    const first = hourly[0];
    // 22 km/h ≈ 11.9 kt
    expect(first.windSpeedKt).toBeGreaterThan(11);
    expect(first.windSpeedKt).toBeLessThan(13);
    // 1372 m ≈ 4501 ft
    expect(first.ceilingFtAgl).toBeGreaterThan(4400);
    expect(first.ceilingFtAgl).toBeLessThan(4600);
    expect(first.skyCoverPct).toBe(55);
  });
});
