import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { estimateDrift } from '../src/domain/spot';
import { DriftPanel } from '../src/components/DriftPanel';
import type { WindsAloftLevel } from '../src/domain/types';

/** Uniform 10 kt wind FROM the west (270°) at every 1,000 ft → drift TOWARD east (90°). */
function uniformLevels(count = 14): WindsAloftLevel[] {
  return Array.from({ length: count }, (_, i) => ({
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

  it('extrapolates above the highest sample with its wind', () => {
    // Samples stop at 13,000 ft but exit is 18,000: the 13k→18k band must use
    // the top sample's wind, matching a fully-sampled run to 18,000 ft.
    const high = { ...opts, exitFtAgl: 18000 };
    const truncated = estimateDrift(uniformLevels(14), high); // samples to 13,000
    const full = estimateDrift(uniformLevels(19), high); // samples to 18,000
    expect(truncated.freefall.distanceFt).toBeCloseTo(full.freefall.distanceFt, 5);
    expect(truncated.total.distanceFt).toBeCloseTo(full.total.distanceFt, 5);
    // freefall: 15,000 ft at 176 ft/s → 85.23 s × 16.878 ft/s ≈ 1438 ft
    expect(truncated.freefall.distanceFt).toBeCloseTo(1438, -1);
  });

  it('yields nonzero drift from a single sample (constant wind)', () => {
    const single = uniformLevels().filter((l) => l.altitudeFtAgl === 3000);
    expect(single).toHaveLength(1);
    const d = estimateDrift(single, opts);
    // Same closed form as the fully-sampled uniform-wind case.
    expect(d.freefall.distanceFt).toBeCloseTo(959, -1);
    expect(d.canopy.distanceFt).toBeCloseTo(3038, -1);
    expect(d.total.towardDeg).toBeCloseTo(90, 1);
  });

  it('treats exit below deploy as canopy-only from exit altitude', () => {
    const d = estimateDrift(uniformLevels(), { ...opts, exitFtAgl: 2000, deployFtAgl: 6000 });
    expect(d.freefall.distanceFt).toBeCloseTo(0, 5);
    // canopy: 2,000 ft at 16.667 ft/s → 120 s × 16.878 ft/s ≈ 2025 ft
    expect(d.canopy.distanceFt).toBeCloseTo(2025, -1);
    expect(d.total.distanceFt).toBeCloseTo(d.canopy.distanceFt, 5);
  });
});

/**
 * The integral extrapolates a constant wind below the lowest level, which is
 * right — a drift figure missing the bottom of the descent is too short, and
 * too short is the direction that hurts. But the assumption is invisible in the
 * result, so the estimate reports how far it reached.
 *
 * The arrangement that produces it is the NOAA FD fallback: its lowest level is
 * 3,000 ft MSL, so at this field elevation the winds-aloft table's lowest row is
 * 2,000 ft AGL and everything under that is assumed.
 */
describe('estimateDrift reports how far below the levels it had to assume', () => {
  const opts = { exitFtAgl: 13000, deployFtAgl: 3000, fallRateMph: 120, canopyRateFpm: 1000 };

  /** Levels as the FD path yields them at NE69: nothing below 2,000 ft AGL. */
  const fdLevels = (): WindsAloftLevel[] =>
    uniformLevels().filter((l) => l.altitudeFtAgl >= 2000);

  it('is zero when the levels reach the ground', () => {
    expect(estimateDrift(uniformLevels(), opts).extrapolatedBelowFtAgl).toBe(0);
  });

  it('is the lowest level when the source stops above the ground', () => {
    expect(estimateDrift(fdLevels(), opts).extrapolatedBelowFtAgl).toBe(2000);
  });

  it('counts only the part the canopy leg flew through', () => {
    // Deployment at 1,500 ft is below the lowest level, so the canopy leg
    // extrapolates over 1,500 ft of descent, not 2,000.
    const d = estimateDrift(fdLevels(), { ...opts, deployFtAgl: 1500 });
    expect(d.extrapolatedBelowFtAgl).toBe(1500);
  });

  it('does not claim an extrapolation when there is nothing to integrate', () => {
    expect(estimateDrift([], opts).extrapolatedBelowFtAgl).toBe(0);
  });

  /* The drift number itself must not change: dropping the fabricated rows from
   * the table was a display fix, and the integral covered that depth with the
   * same constant wind before and after. A uniform wind makes them identical. */
  it('leaves the drift figure unchanged under a uniform wind', () => {
    const withGround = estimateDrift(uniformLevels(), opts);
    const withoutGround = estimateDrift(fdLevels(), opts);
    expect(withoutGround.canopy.distanceFt).toBeCloseTo(withGround.canopy.distanceFt, 5);
    expect(withoutGround.total.distanceFt).toBeCloseTo(withGround.total.distanceFt, 5);
  });
});

/* The card names its data source in the footer, and named Open-Meteo whatever
 * it was handed — so on the NOAA FD fallback it credited a source the numbers
 * had not come from, on the one path where the distinction matters most. */
describe('the drift card credits the source the numbers came from', () => {
  const levels = uniformLevels();
  const markup = (source?: 'open-meteo' | 'nws-fd'): string =>
    renderToStaticMarkup(
      createElement(DriftPanel, { levels, profile: 'licensed', source } as never),
    );

  it('names Open-Meteo on the primary path', () => {
    expect(markup('open-meteo')).toContain('Open-Meteo');
  });

  it('names the NOAA FD product on the fallback path, not Open-Meteo', () => {
    const html = markup('nws-fd');
    expect(html).toContain('NOAA winds aloft (FD)');
    expect(html).not.toContain('>Open-Meteo<');
  });
});
