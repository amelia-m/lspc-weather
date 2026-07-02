import type { WindsAloftLevel } from './types';

/**
 * Rough freefall-drift / spot estimate, in the spirit of Mark Schulze's tool.
 *
 * It integrates the winds-aloft layers over the descent: in each altitude layer
 * the wind pushes you horizontally by (wind speed × time in that layer). Time is
 * layer thickness ÷ vertical speed (freefall rate above deployment, canopy
 * descent rate below). Summing the per-layer displacement vectors gives the net
 * drift distance and direction.
 *
 * Pure function — no I/O. This is an ESTIMATE for awareness, not a spotting
 * decision; the jumpmaster/pilot makes the call.
 */

const KT_TO_FPS = 1.6878099;
const MPH_TO_FPS = 1.4666667;

export interface DriftLeg {
  /** Net horizontal drift, feet. */
  distanceFt: number;
  /** Direction the drift carries you TOWARD, degrees true [0,360). */
  towardDeg: number;
}

export interface DriftEstimate {
  freefall: DriftLeg; // exit → deployment
  canopy: DriftLeg; // deployment → ground (if you don't steer)
  total: DriftLeg; // vector sum
}

export interface DriftOptions {
  exitFtAgl: number;
  deployFtAgl: number;
  fallRateMph: number; // average vertical freefall speed
  canopyRateFpm: number; // average canopy descent rate
}

/** Wind vector (ft/s) in the direction it BLOWS TOWARD (dir + 180). */
function windVec(l: WindsAloftLevel): { e: number; n: number } {
  const toward = ((l.directionDeg + 180) % 360) * (Math.PI / 180);
  const sp = l.speedKt * KT_TO_FPS;
  return { e: sp * Math.sin(toward), n: sp * Math.cos(toward) };
}

function legFromComponents(e: number, n: number): DriftLeg {
  return {
    distanceFt: Math.hypot(e, n),
    towardDeg: ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360,
  };
}

/**
 * Integrate drift between two AGL altitudes at a constant vertical speed.
 *
 * Outside the sampled altitude range the wind is extrapolated as a constant —
 * the nearest sample's vector — matching how `sampleAt` in windsAloft.ts
 * extrapolates when interpolating. Without this, any band above the highest
 * sample (e.g. exit at 18,000 ft with winds sampled to 13,000 ft) contributed
 * ZERO drift and the estimate silently underestimated.
 */
function integrate(
  levels: WindsAloftLevel[],
  loAgl: number,
  hiAgl: number,
  vSpeedFps: number,
): { e: number; n: number } {
  const ls = [...levels].sort((a, b) => a.altitudeFtAgl - b.altitudeFtAgl);
  let e = 0;
  let n = 0;
  if (vSpeedFps <= 0 || ls.length === 0 || hiAgl <= loAgl) return { e, n };

  // Band below the lowest sample: constant extrapolation with its wind.
  const bottom = ls[0];
  const belowThickness = Math.min(hiAgl, bottom.altitudeFtAgl) - loAgl;
  if (belowThickness > 0) {
    const v = windVec(bottom);
    const time = belowThickness / vSpeedFps;
    e += v.e * time;
    n += v.n * time;
  }

  for (let i = 0; i < ls.length - 1; i++) {
    const a = ls[i];
    const b = ls[i + 1];
    const top = Math.min(hiAgl, b.altitudeFtAgl);
    const bot = Math.max(loAgl, a.altitudeFtAgl);
    const thickness = top - bot;
    if (thickness <= 0) continue;

    const time = thickness / vSpeedFps; // seconds in this layer
    const va = windVec(a);
    const vb = windVec(b);
    e += ((va.e + vb.e) / 2) * time;
    n += ((va.n + vb.n) / 2) * time;
  }

  // Band above the highest sample: constant extrapolation with its wind.
  const top = ls[ls.length - 1];
  const aboveThickness = hiAgl - Math.max(loAgl, top.altitudeFtAgl);
  if (aboveThickness > 0) {
    const v = windVec(top);
    const time = aboveThickness / vSpeedFps;
    e += v.e * time;
    n += v.n * time;
  }

  return { e, n };
}

export function estimateDrift(levels: WindsAloftLevel[], opts: DriftOptions): DriftEstimate {
  const fallFps = opts.fallRateMph * MPH_TO_FPS;
  const canopyFps = opts.canopyRateFpm / 60;

  // Guard exit < deploy (e.g. a low hop-and-pop typed into the inputs): the
  // canopy leg can only start at the lower of the two, and the freefall leg
  // is zero-length unless exit is actually above deploy.
  const canopyTopFtAgl = Math.min(opts.deployFtAgl, opts.exitFtAgl);
  const ff =
    opts.exitFtAgl > opts.deployFtAgl
      ? integrate(levels, opts.deployFtAgl, opts.exitFtAgl, fallFps)
      : { e: 0, n: 0 };
  const can = integrate(levels, 0, canopyTopFtAgl, canopyFps);

  return {
    freefall: legFromComponents(ff.e, ff.n),
    canopy: legFromComponents(can.e, can.n),
    total: legFromComponents(ff.e + can.e, ff.n + can.n),
  };
}
