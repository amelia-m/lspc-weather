import type { WindsAloftLevel } from './types';
import { mpsToKt } from './units';

/** A wind sample at a known height MSL, as returned by Open-Meteo. */
export interface RawWindSample {
  heightFtMsl: number;
  speedKt: number;
  directionDeg: number;
  tempC?: number | null;
}

/**
 * Interpolate wind to the requested AGL jump altitudes.
 *
 * Open-Meteo gives wind at fixed heights (e.g. 10 m, 80 m, 120 m, 180 m) and
 * at pressure levels (e.g. 850/700 hPa with geopotential height). We convert
 * those to a set of MSL samples, then linearly interpolate speed and direction
 * to each desired altitude. Direction is interpolated on the shortest angular
 * arc so 350°→010° crosses through north, not the long way around.
 */
export function interpolateWindsAloft(
  samples: RawWindSample[],
  fieldElevationFt: number,
  targetAltitudesFtAgl: readonly number[],
): WindsAloftLevel[] {
  const sorted = [...samples].sort((a, b) => a.heightFtMsl - b.heightFtMsl);
  if (sorted.length === 0) return [];

  return targetAltitudesFtAgl.map((agl) => {
    const msl = fieldElevationFt + agl;
    const { speedKt, directionDeg, tempC } = sampleAt(sorted, msl);
    return {
      altitudeFtAgl: agl,
      altitudeFtMsl: Math.round(msl),
      speedKt: Math.round(speedKt),
      directionDeg: Math.round(((directionDeg % 360) + 360) % 360),
      tempC: tempC != null ? Math.round(tempC) : null,
    };
  });
}

interface Sampled {
  speedKt: number;
  directionDeg: number;
  tempC: number | null;
}

function sampleAt(sorted: RawWindSample[], msl: number): Sampled {
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (msl <= first.heightFtMsl)
    return { speedKt: first.speedKt, directionDeg: first.directionDeg, tempC: first.tempC ?? null };
  if (msl >= last.heightFtMsl)
    return { speedKt: last.speedKt, directionDeg: last.directionDeg, tempC: last.tempC ?? null };

  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (msl >= lo.heightFtMsl && msl <= hi.heightFtMsl) {
      const span = hi.heightFtMsl - lo.heightFtMsl;
      const t = span === 0 ? 0 : (msl - lo.heightFtMsl) / span;
      const tempC =
        lo.tempC != null && hi.tempC != null ? lo.tempC + t * (hi.tempC - lo.tempC) : null;
      return {
        speedKt: lo.speedKt + t * (hi.speedKt - lo.speedKt),
        directionDeg: interpAngle(lo.directionDeg, hi.directionDeg, t),
        tempC,
      };
    }
  }
  return { speedKt: last.speedKt, directionDeg: last.directionDeg, tempC: last.tempC ?? null };
}

/** Interpolate between two headings along the shortest arc. */
export function interpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180; // shortest signed delta in [-180,180)
  return a + diff * t;
}

/** Convert an Open-Meteo m/s wind speed to knots for a sample. */
export const windSampleFromMps = (
  heightFtMsl: number,
  speedMps: number,
  directionDeg: number,
): RawWindSample => ({
  heightFtMsl,
  speedKt: mpsToKt(speedMps),
  directionDeg,
});
