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

/** Integrate drift between two AGL altitudes at a constant vertical speed. */
function integrate(
  levels: WindsAloftLevel[],
  loAgl: number,
  hiAgl: number,
  vSpeedFps: number,
): { e: number; n: number } {
  const ls = [...levels].sort((a, b) => a.altitudeFtAgl - b.altitudeFtAgl);
  let e = 0;
  let n = 0;
  if (vSpeedFps <= 0) return { e, n };

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
  return { e, n };
}

export function estimateDrift(levels: WindsAloftLevel[], opts: DriftOptions): DriftEstimate {
  const fallFps = opts.fallRateMph * MPH_TO_FPS;
  const canopyFps = opts.canopyRateFpm / 60;

  const ff = integrate(levels, opts.deployFtAgl, opts.exitFtAgl, fallFps);
  const can = integrate(levels, 0, opts.deployFtAgl, canopyFps);

  return {
    freefall: legFromComponents(ff.e, ff.n),
    canopy: legFromComponents(can.e, can.n),
    total: legFromComponents(ff.e + can.e, ff.n + can.n),
  };
}
