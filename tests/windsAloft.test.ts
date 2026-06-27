import { describe, expect, it } from 'vitest';
import { interpAngle, interpolateWindsAloft, type RawWindSample } from '../src/domain/windsAloft';

describe('interpAngle', () => {
  it('takes the short arc across north', () => {
    expect(((interpAngle(350, 10, 0.5) % 360) + 360) % 360).toBeCloseTo(0, 5);
  });
  it('interpolates linearly within a quadrant', () => {
    expect(interpAngle(90, 180, 0.5)).toBeCloseTo(135, 5);
  });
});

describe('interpolateWindsAloft', () => {
  const samples: RawWindSample[] = [
    { heightFtMsl: 1200, speedKt: 10, directionDeg: 200 },
    { heightFtMsl: 4200, speedKt: 30, directionDeg: 220 },
  ];

  it('interpolates speed at a midpoint altitude', () => {
    const out = interpolateWindsAloft(samples, 1182, [1518]); // 1182+1518=2700 MSL, midpoint
    expect(out).toHaveLength(1);
    expect(out[0].speedKt).toBe(20);
    expect(out[0].altitudeFtMsl).toBe(2700);
  });

  it('clamps below the lowest and above the highest sample', () => {
    const out = interpolateWindsAloft(samples, 0, [0, 100000]);
    expect(out[0].speedKt).toBe(10); // clamped to lowest
    expect(out[1].speedKt).toBe(30); // clamped to highest
  });

  it('returns nothing when there are no samples', () => {
    expect(interpolateWindsAloft([], 1182, [3000])).toEqual([]);
  });
});
