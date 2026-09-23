import type { WindsAloftLevel } from './types';
import { mpsToKt } from './units';

/** A wind sample at a known height MSL, as returned by Open-Meteo. */
export interface RawWindSample {
  heightFtMsl: number;
  speedKt: number;
  directionDeg: number;
  tempC?: number | null;
  /**
   * True only when this sample *is* the surface wind — Open-Meteo's 10 m level.
   *
   * It licenses filling downward from this sample to the field elevation: a
   * 10 m wind is the ground wind, so the few tens of feet between the model's
   * own surface height and the DZ's published field elevation are a datum
   * mismatch, not a layer of atmosphere. A level aloft licenses nothing below
   * itself, and the NOAA FD bulletin has no surface level at all — see
   * `sampleAt`.
   *
   * `sampleAt` consults it only on the LOWEST sample. Since `normalizeOpenMeteo`
   * drops pressure levels below the model's terrain, the 10 m sample normally
   * is that lowest sample — but the flag only does anything when the requested
   * altitude falls beneath it, i.e. when the DZ's published field elevation is
   * below the model's surface height plus 10 m. Whether it is depends on a DEM
   * lookup: at NE69 the model surface is 1,145 ft and the field 1,182 ft, so
   * today the Surface row comes from the interpolation loop and this flag is
   * not reached. A DEM refresh could move it either way, and without the flag
   * the case where it is reached would drop the Surface row entirely.
   */
  isSurface?: boolean;
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

  const out: WindsAloftLevel[] = [];
  for (const agl of targetAltitudesFtAgl) {
    const msl = fieldElevationFt + agl;
    const s = sampleAt(sorted, msl);
    // No sample covers this altitude, so there is no wind to report for it.
    // The level is dropped rather than filled from the nearest one: see
    // `sampleAt` for why a clamped value would be an assertion the source
    // never made.
    if (s === null) continue;
    out.push({
      altitudeFtAgl: agl,
      altitudeFtMsl: Math.round(msl),
      speedKt: Math.round(s.speedKt),
      directionDeg: Math.round(((s.directionDeg % 360) + 360) % 360),
      tempC: s.tempC != null ? Math.round(s.tempC) : null,
    });
  }
  return out;
}

/** Where a winds-aloft profile stops at the top, against what was asked for. */
export interface WindsAloftTop {
  /** Highest altitude AGL the profile reached; null when it has no levels. */
  highestFtAgl: number | null;
  /** Highest altitude AGL that was asked for; null when nothing was. */
  requestedFtAgl: number | null;
  /**
   * True when the profile stops below the highest requested altitude — the
   * rows above `highestFtAgl` were dropped by `interpolateWindsAloft` because
   * no sample covered them, not merely hidden by a collapsed view.
   */
  stopsShort: boolean;
}

/**
 * Report the top of a profile so the card can say where its rows end.
 *
 * `interpolateWindsAloft` drops every target above the highest sample, which
 * is the honest thing to do with a wind nobody forecast — but a dropped row
 * is invisible. If Open-Meteo served nulls at 500 and 600 hPa, the table would
 * end at 9,000 ft while the card's own text still offered every level "up to
 * 13k", and a reader would take the missing rows for a display choice rather
 * than a hole in the report. The bottom of the profile has long had its
 * counterpart (the FD fallback's note about the bulletin's lowest level); this
 * gives the top one.
 *
 * The comparison is against the altitudes that were ASKED for, not a fixed
 * ceiling, so the card and the config cannot drift apart. Levels are
 * contiguous from the lowest covered target to the highest — `sampleAt` only
 * returns null outside the sampled range — so "no wind above the highest
 * level" describes the rows exactly.
 */
export function windsAloftTop(
  levels: readonly WindsAloftLevel[],
  targetAltitudesFtAgl: readonly number[],
): WindsAloftTop {
  const highestFtAgl = levels.length > 0 ? Math.max(...levels.map((l) => l.altitudeFtAgl)) : null;
  const requestedFtAgl = targetAltitudesFtAgl.length > 0 ? Math.max(...targetAltitudesFtAgl) : null;
  return {
    highestFtAgl,
    requestedFtAgl,
    // With no levels at all there is no "highest" for rows to sit above, and
    // the card already says there is no data; that is a different message.
    stopsShort: highestFtAgl != null && requestedFtAgl != null && highestFtAgl < requestedFtAgl,
  };
}

interface Sampled {
  speedKt: number;
  directionDeg: number;
  tempC: number | null;
}

/**
 * Sample the profile at one MSL height, or null where no sample covers it.
 *
 * Outside the sampled range the honest answer is "this source does not say".
 * Returning the nearest sample instead used to put the NOAA FD bulletin's
 * lowest level — 3,000 ft MSL, about 1,800 ft above the DZ — in the Surface
 * and 1,000 ft rows of the winds-aloft table. On a night with an inversion
 * that read "Surface E 9 kt" against a METAR reporting NE 3 kt: a wind from
 * most of a freefall away, printed where a jumper reads ground wind, with
 * nothing on the card to say it was extrapolated. The card has always said
 * that row is omitted on the FD path; this is what omits it.
 *
 * The one extrapolation that is sound runs downward from a sample that is
 * itself the surface wind (`isSurface`) — Open-Meteo's 10 m level — because
 * the gap it spans is the mismatch between the model's surface height and the
 * DZ's published field elevation, not a layer of atmosphere.
 */
function sampleAt(sorted: RawWindSample[], msl: number): Sampled | null {
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  // Strictly below / above, so a target sitting exactly ON the lowest or
  // highest sample is a value the source states verbatim and is kept. The
  // bottom test used to be `<=`, which dropped that row at the bottom while the
  // top kept it — a wind the bulletin prints, discarded for being on the edge.
  // Equality at the bottom falls through to the interpolation loop (t = 0);
  // with a single sample first === last and the top test returns it.
  if (msl < first.heightFtMsl)
    return first.isSurface
      ? { speedKt: first.speedKt, directionDeg: first.directionDeg, tempC: first.tempC ?? null }
      : null;
  if (msl >= last.heightFtMsl)
    return msl === last.heightFtMsl
      ? { speedKt: last.speedKt, directionDeg: last.directionDeg, tempC: last.tempC ?? null }
      : null;

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
  return null;
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
