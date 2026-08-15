import { describe, expect, it } from 'vitest';
import { relativeHumidity, dewpointSpreadC, satVaporPressureHpa } from '../src/domain/humidity';

describe('relativeHumidity', () => {
  it('is 100% when dew point equals temperature', () => {
    expect(relativeHumidity(20, 20)).toBeCloseTo(100, 5);
  });

  it('decreases as the spread widens', () => {
    // 20°C / 10°C dew point ≈ 53% RH.
    const rh = relativeHumidity(20, 10);
    expect(rh).toBeGreaterThan(50);
    expect(rh).toBeLessThan(55);
    expect(relativeHumidity(30, 5)).toBeLessThan(relativeHumidity(30, 20));
  });

  it('clamps to [0, 100]', () => {
    expect(relativeHumidity(20, 25)).toBe(100); // dew point above temp (bad data)
    expect(relativeHumidity(40, -40)).toBeGreaterThanOrEqual(0);
  });
});

describe('satVaporPressureHpa / dewpointSpreadC', () => {
  it('gives ~6.1 hPa at 0°C and rises with temperature', () => {
    expect(satVaporPressureHpa(0)).toBeCloseTo(6.11, 1);
    expect(satVaporPressureHpa(30)).toBeGreaterThan(satVaporPressureHpa(20));
  });

  it('computes the spread', () => {
    expect(dewpointSpreadC(22, 19)).toBe(3);
  });
});
