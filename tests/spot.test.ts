import { describe, expect, it } from 'vitest';
import { estimateDrift } from '../src/domain/spot';
import type { WindsAloftLevel } from '../src/domain/types';

/** Uniform 10 kt wind FROM the west (270°) at every 1,000 ft → drift TOWARD east (90°). */
function uniformLevels(): WindsAloftLevel[] {
  return Array.from({ length: 14 }, (_, i) => ({
    altitudeFtAgl: i * 1000,
    altitudeFtMsl: 1182 + i * 1000,
    directionDeg: 270,
    speedKt: 10,
    tempC: null,
  }));
}

describe('estimateDrift', () => {
  const opts = { exitFtAgl: 13000, deployFtAgl: 3000, fallRateMph: 120, canopyRateFpm: 1000 };

  it('drifts downwind (toward east for a west wind)', () => {
    const d = estimateDrift(uniformLevels(), opts);
    expect(d.freefall.towardDeg).toBeCloseTo(90, 1);
    expect(d.canopy.towardDeg).toBeCloseTo(90, 1);
    expect(d.total.towardDeg).toBeCloseTo(90, 1);
  });

  it('matches the closed-form distance for uniform wind', () => {
    const d = estimateDrift(uniformLevels(), opts);
    // freefall: 10 kt = 16.878 ft/s over 10,000 ft at 176 ft/s → 56.82 s → ~959 ft
    expect(d.freefall.distanceFt).toBeCloseTo(959, -1);
    // canopy: 3,000 ft at 16.667 ft/s → 180 s → 16.878 × 180 ≈ 3038 ft
    expect(d.canopy.distanceFt).toBeCloseTo(3038, -1);
    expect(d.total.distanceFt).toBeCloseTo(959 + 3038, -1);
  });

  it('is zero with no winds', () => {
    const calm = uniformLevels().map((l) => ({ ...l, speedKt: 0 }));
    const d = estimateDrift(calm, opts);
    expect(d.total.distanceFt).toBeCloseTo(0, 5);
  });
});
