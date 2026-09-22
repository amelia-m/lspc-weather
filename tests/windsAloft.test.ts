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

  it('drops altitudes outside the sampled range rather than clamping to it', () => {
    // Both of these used to come back clamped — 10 kt at the ground and 30 kt
    // at 100,000 ft — from samples that say nothing about either height.
    const out = interpolateWindsAloft(samples, 0, [0, 100000]);
    expect(out).toEqual([]);
  });

  /* The NOAA FD bulletin's lowest level is 3,000 ft MSL, about 1,800 ft above
   * this DZ, and it carries no surface level. Clamping filled the Surface and
   * 1,000 ft rows from it: live on 2026-09-22 the card read "Surface E 9 kt"
   * while the KPMV METAR reported NE 3 kt. These assert the rows are absent in
   * exactly that arrangement. */
  describe('a bulletin with no surface level', () => {
    const fd: RawWindSample[] = [
      { heightFtMsl: 3000, speedKt: 9, directionDeg: 90 },
      { heightFtMsl: 6000, speedKt: 4, directionDeg: 328 },
      { heightFtMsl: 9000, speedKt: 10, directionDeg: 284 },
    ];

    it('lists no level below its lowest', () => {
      const out = interpolateWindsAloft(fd, 1182, [0, 1000, 2000, 3000]);
      expect(out.map((l) => l.altitudeFtAgl)).toEqual([2000, 3000]);
    });

    it('does not report the 3,000 ft MSL wind as the surface wind', () => {
      const out = interpolateWindsAloft(fd, 1182, [0]);
      expect(out).toEqual([]);
    });
  });

  /* Open-Meteo's 10 m sample IS the ground wind, so it may fill the short gap
   * down to the published field elevation — the model's surface height and the
   * DZ's field elevation differ by a few tens of feet, which is not a layer of
   * atmosphere. Without this the primary path would lose its Surface row. */
  it('fills down to field elevation from a surface sample', () => {
    const withSurface: RawWindSample[] = [
      { heightFtMsl: 1178, speedKt: 6, directionDeg: 36, isSurface: true },
      { heightFtMsl: 4200, speedKt: 30, directionDeg: 220 },
    ];
    const out = interpolateWindsAloft(withSurface, 1182, [0]);
    expect(out).toHaveLength(1);
    expect(out[0].speedKt).toBe(6);
    expect(out[0].directionDeg).toBe(36);
  });

  it('returns nothing when there are no samples', () => {
    expect(interpolateWindsAloft([], 1182, [3000])).toEqual([]);
  });

  it('interpolates temperature when present and is null when absent', () => {
    const withTemp: RawWindSample[] = [
      { heightFtMsl: 1200, speedKt: 10, directionDeg: 200, tempC: 20 },
      { heightFtMsl: 4200, speedKt: 30, directionDeg: 220, tempC: 0 },
    ];
    const out = interpolateWindsAloft(withTemp, 1182, [1518]); // midpoint
    expect(out[0].tempC).toBe(10);

    const noTemp = interpolateWindsAloft(samples, 1182, [1518]);
    expect(noTemp[0].tempC).toBeNull();
  });
});
