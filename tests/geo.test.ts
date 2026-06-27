import { describe, expect, it } from 'vitest';
import { haversineMiles, initialBearingDeg } from '../src/domain/geo';
import { compass } from '../src/domain/units';

const NE69 = { lat: 40.8687, lon: -96.1088 }; // LSPC / Browns Airport
const KPMV = { lat: 40.9484, lon: -95.9174 }; // Plattsmouth
const KOFF = { lat: 41.1183, lon: -95.9124 }; // Offutt AFB

describe('haversineMiles', () => {
  it('matches the known NE69→KPMV distance (~11.5 mi)', () => {
    const d = haversineMiles(NE69.lat, NE69.lon, KPMV.lat, KPMV.lon);
    expect(d).toBeGreaterThan(10.5);
    expect(d).toBeLessThan(12.5);
  });
  it('matches the known NE69→KOFF distance (~20 mi)', () => {
    const d = haversineMiles(NE69.lat, NE69.lon, KOFF.lat, KOFF.lon);
    expect(d).toBeGreaterThan(18);
    expect(d).toBeLessThan(22);
  });
  it('is zero for identical points', () => {
    expect(haversineMiles(NE69.lat, NE69.lon, NE69.lat, NE69.lon)).toBeCloseTo(0, 5);
  });
});

describe('initialBearingDeg', () => {
  it('points generally north-ish toward Offutt', () => {
    const b = initialBearingDeg(NE69.lat, NE69.lon, KOFF.lat, KOFF.lon);
    expect(b).toBeGreaterThan(5);
    expect(b).toBeLessThan(50);
    expect(['N', 'NE']).toContain(compass(b));
  });
  it('points generally east-ish toward Plattsmouth', () => {
    const b = initialBearingDeg(NE69.lat, NE69.lon, KPMV.lat, KPMV.lon);
    expect(['NE', 'E']).toContain(compass(b));
  });
});
