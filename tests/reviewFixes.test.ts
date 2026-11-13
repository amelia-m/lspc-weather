import { describe, expect, it } from 'vitest';
import { SOURCE_KEYS, sourcesFetched } from '../src/domain/types';
import { isLatest } from '../src/domain/latest';
import { fmtVisibilitySm, toSpeedUnit } from '../src/domain/units';
import { normalizeNwsObservation } from '../src/domain/normalize';
import { OBSERVATION_FIXTURE } from '../src/api/fixtures/observation';

/* The fixes from the whole-project review of 2026-11-03
 * (docs/open-questions.md, "Review of the whole project"). */

describe('sourcesFetched', () => {
  it('is every source with the NBM fetched, and all but the NBM without', () => {
    expect(sourcesFetched(true)).toEqual([...SOURCE_KEYS]);
    expect(sourcesFetched(false)).toEqual(SOURCE_KEYS.filter((k) => k !== 'nbm' && k !== 'nbs'));
    expect(sourcesFetched(false)).not.toContain('nbm');
    expect(sourcesFetched(false)).not.toContain('nbs');
  });
});

describe('isLatest', () => {
  it('accepts a newer or equal refresh and refuses an older one', () => {
    expect(isLatest({}, 'windsAloft', 1)).toBe(true);
    expect(isLatest({ windsAloft: 2 }, 'windsAloft', 2)).toBe(true);
    expect(isLatest({ windsAloft: 2 }, 'windsAloft', 3)).toBe(true);
    // The slow first refresh's winds answer, landing after the second's.
    expect(isLatest({ windsAloft: 2 }, 'windsAloft', 1)).toBe(false);
    // Per source: the daily's record says nothing about the winds.
    expect(isLatest({ daily: 5 }, 'windsAloft', 1)).toBe(true);
  });
});

describe('toSpeedUnit', () => {
  it('accepts the two units and gives knots for anything stored by hand', () => {
    expect(toSpeedUnit('mph')).toBe('mph');
    expect(toSpeedUnit('kt')).toBe('kt');
    expect(toSpeedUnit('foo')).toBe('kt');
    expect(toSpeedUnit(null)).toBe('kt');
    expect(toSpeedUnit(undefined)).toBe('kt');
  });
});

describe('the NWS observation', () => {
  const obs = (over: Record<string, unknown>) =>
    normalizeNwsObservation({ ...OBSERVATION_FIXTURE, properties: { ...OBSERVATION_FIXTURE.properties, ...over } } as typeof OBSERVATION_FIXTURE, 'KPMV');

  it('gives a calm wind no direction, as the IEM path does, whatever the decode says', () => {
    // NWS's decode gives calm 0°, which no card shows (CLAUDE.md).
    const calm = obs({
      rawMessage: 'KPMV 271300Z AUTO 00000KT 10SM FEW035 BKN045 28/19 A2996 RMK AO2',
      windSpeed: { unitCode: 'wmoUnit:km_h-1', value: 0 },
      windDirection: { unitCode: 'wmoUnit:degree_(angle)', value: 0 },
    });
    expect(calm.wind.speedKt).toBe(0);
    expect(calm.wind.directionDeg).toBeNull();
    // A reported wind keeps its direction.
    expect(obs({}).wind.directionDeg).toBe(190);
  });

  it('keeps visibility to the sixteenth of a mile the METAR reports, so a quarter mile is 0.25 and 10 SM is 10', () => {
    // NWS encodes 10 SM as 16090 m (a sixteenth short of 16093 m) and
    // 1/4 SM as 402 m; rounded to a tenth, a quarter mile read 0.3, and
    // the IEM path, which keeps the decode's 0.25, disagreed with it.
    expect(obs({ visibility: { unitCode: 'wmoUnit:m', value: 16090 } }).visibilitySm).toBe(10);
    expect(obs({ visibility: { unitCode: 'wmoUnit:m', value: 402 } }).visibilitySm).toBe(0.25);
    expect(obs({ visibility: { unitCode: 'wmoUnit:m', value: 2012 } }).visibilitySm).toBe(1.25);
    expect(obs({ visibility: { unitCode: 'wmoUnit:m', value: 1207 } }).visibilitySm).toBe(0.75);
  });
});

describe('fmtVisibilitySm', () => {
  it('prints statute miles as a METAR states them, in sixteenths', () => {
    expect(fmtVisibilitySm(10)).toBe('10');
    expect(fmtVisibilitySm(0.25)).toBe('1/4');
    expect(fmtVisibilitySm(1.25)).toBe('1 1/4');
    expect(fmtVisibilitySm(2.5)).toBe('2 1/2');
    expect(fmtVisibilitySm(0.0625)).toBe('1/16');
    expect(fmtVisibilitySm(0.75)).toBe('3/4');
    // Not on a sixteenth (a forecast from metres): the nearest one.
    expect(fmtVisibilitySm(9.9979)).toBe('10');
    expect(fmtVisibilitySm(8.0467)).toBe('8 1/16');
    expect(fmtVisibilitySm(0)).toBe('0');
  });
});
