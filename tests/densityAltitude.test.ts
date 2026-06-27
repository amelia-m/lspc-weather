import { describe, expect, it } from 'vitest';
import { densityAltitude } from '../src/domain/densityAltitude';

describe('densityAltitude', () => {
  it('equals field elevation at standard pressure and ISA temperature', () => {
    // ISA temp at 1182 ft = 15 - 1.98 * 1.182 ≈ 12.66 °C
    const r = densityAltitude({ elevationFt: 1182, altimeterInHg: 29.92, oatC: 12.66 });
    expect(r.pressureAltitudeFt).toBe(1182);
    expect(Math.abs(r.densityAltitudeFt - 1182)).toBeLessThanOrEqual(2);
    expect(Math.abs(r.isaDeviationC)).toBeLessThanOrEqual(0.1);
  });

  it('is zero at sea level, standard day', () => {
    const r = densityAltitude({ elevationFt: 0, altimeterInHg: 29.92, oatC: 15 });
    expect(Math.abs(r.densityAltitudeFt)).toBeLessThanOrEqual(2);
  });

  it('rises well above field elevation on a hot day', () => {
    // ~15 °C above ISA → ~+1800 ft over pressure altitude
    const r = densityAltitude({ elevationFt: 1182, altimeterInHg: 29.92, oatC: 28 });
    expect(r.densityAltitudeFt).toBeGreaterThan(2800);
    expect(r.densityAltitudeFt - r.fieldElevationFt).toBeGreaterThan(1500);
  });

  it('accounts for low pressure in pressure altitude', () => {
    const r = densityAltitude({ elevationFt: 1000, altimeterInHg: 29.42, oatC: 15 });
    expect(r.pressureAltitudeFt).toBe(1500); // 1000 + (29.92-29.42)*1000
  });
});
