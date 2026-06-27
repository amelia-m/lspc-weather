import { describe, expect, it } from 'vitest';
import {
  altimeterFromRaw,
  durationToHours,
  normalizeGridpoint,
  normalizeMetar,
  normalizeNwsObservation,
  parseValidTime,
} from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';
import { GRIDPOINT_FIXTURE } from '../src/api/fixtures/gridpoint';
import { OBSERVATION_FIXTURE } from '../src/api/fixtures/observation';

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

describe('altimeterFromRaw', () => {
  it('parses an A-group (inHg)', () => {
    expect(altimeterFromRaw('KPMV 271300Z AUTO 19012G22KT 10SM BKN045 28/19 A2996 RMK')).toBe(29.96);
  });
  it('parses a Q-group (hPa) to inHg', () => {
    const v = altimeterFromRaw('EGLL 271320Z 18012KT 9999 BKN040 18/12 Q1013');
    expect(v).toBeGreaterThan(29.9);
    expect(v).toBeLessThan(29.95);
  });
  it('returns null when neither is present', () => {
    expect(altimeterFromRaw('KPMV 271300Z AUTO 19012KT 10SM CLR 28/19 RMK')).toBeNull();
  });
});

describe('normalizeNwsObservation', () => {
  it('decodes wind (km/h→kt), ceiling, visibility and altimeter from the raw METAR', () => {
    const c = normalizeNwsObservation(OBSERVATION_FIXTURE, 'KPMV');
    expect(c.station).toBe('KPMV');
    expect(c.wind.speedKt).toBe(12); // 22.2 km/h
    expect(c.wind.gustKt).toBe(22); // 40.7 km/h
    expect(c.ceilingFtAgl).toBe(4501); // FEW ignored, BKN 1372 m → 4501 ft
    expect(c.visibilitySm).toBeCloseTo(10, 0);
    expect(c.altimeterInHg).toBe(29.96); // from A2996 in rawMessage
  });

  it('falls back to station pressure when the raw text lacks an A/Q group', () => {
    const noRaw = {
      properties: { ...OBSERVATION_FIXTURE.properties, rawMessage: 'KPMV 271300Z AUTO' },
    };
    const c = normalizeNwsObservation(noRaw, 'KPMV');
    expect(c.altimeterInHg).toBeGreaterThan(29.5); // 101490 Pa ≈ 29.97 inHg
    expect(c.altimeterInHg).toBeLessThan(30.5);
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
