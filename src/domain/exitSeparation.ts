import type { WindsAloftLevel } from './types';

/**
 * Seconds between groups on jump run, from the ground separation the USPA
 * SIM gives and the plane's speed over the ground.
 *
 * SIM 4-7 C, "Exit Separation on Jump Run", gives distances over the ground
 * ("at least 1,000 feet" between solo jumpers, "at least 1,500 feet" between
 * small groups; `EXIT_SEPARATION_FT` in thresholds.ts holds them). A jumper
 * at the door counts seconds, so the card divides the distance by the ground
 * speed: arithmetic on a published figure and on numbers the reader enters,
 * which raises no flag and sets no threshold of the app's.
 *
 * The ground speed is worked the way the question is asked on the ground,
 * before the pilot has a GPS reading (the maintainer, 2026-11-24: enter the
 * bearing and work the ground speed from the headwind): the reader gives the
 * jump run's bearing and the plane's indicated airspeed, and the forecast
 * wind at exit altitude supplies the rest.
 *
 *  - The airspeed indicator reads low at altitude: at 10,000 ft above this
 *    field true airspeed is about a fifth above indicated. The conversion
 *    is the standard one, indicated over the square root of the density
 *    ratio, with the standard atmosphere's pressure at the exit's altitude
 *    MSL and the forecast temperature there (the standard temperature when
 *    the forecast has none). Calibration and compressibility corrections are
 *    left out: a knot or two at a jump plane's speeds.
 *  - A jump run is a line over the ground, so the plane crabs into any
 *    crosswind and only part of its airspeed is along the line:
 *    ground speed = sqrt(TAS² − crosswind²) − headwind.
 *
 * Seconds are rounded up, since the SIM's distances are minimums. The
 * figure is separation at exit and nothing after it: the same part of the
 * SIM says slower-falling groups are blown farther downwind, which this
 * does not work out.
 *
 * Pure: no clock, no I/O.
 */

const KT_TO_FPS = 1.6878099;
/** ICAO standard atmosphere, troposphere: sea-level temperature (K), lapse
 *  rate (K per ft), and the pressure exponent g·M/(R·L). */
const ISA_T0_K = 288.15;
const ISA_LAPSE_K_PER_FT = 0.0019812;
const ISA_PRESSURE_EXP = 5.25588;

export interface WindAtAltitude {
  /** Direction the wind blows FROM, degrees true [0, 360). */
  directionDeg: number;
  speedKt: number;
  /** Forecast temperature there, °C, or null when a bracketing level had
   *  none. */
  tempC: number | null;
  altitudeFtMsl: number;
}

/**
 * The forecast wind at an altitude AGL: the table's row there, or between
 * two rows a straight line through their wind vectors (so 350° and 010°
 * average to north, not south). Null when the altitude is outside the rows
 * the table has: the card says so, and a wind is not assumed for it.
 */
export function windAtAltitude(levels: readonly WindsAloftLevel[], ftAgl: number): WindAtAltitude | null {
  const sorted = [...levels].sort((a, b) => a.altitudeFtAgl - b.altitudeFtAgl);
  const above = sorted.find((l) => l.altitudeFtAgl >= ftAgl);
  const below = [...sorted].reverse().find((l) => l.altitudeFtAgl <= ftAgl);
  if (!above || !below) return null;
  const span = above.altitudeFtAgl - below.altitudeFtAgl;
  const f = span === 0 ? 0 : (ftAgl - below.altitudeFtAgl) / span;
  const vec = (l: WindsAloftLevel): { e: number; n: number } => {
    const r = (l.directionDeg * Math.PI) / 180;
    return { e: l.speedKt * Math.sin(r), n: l.speedKt * Math.cos(r) };
  };
  const a = vec(below);
  const b = vec(above);
  const e = a.e + (b.e - a.e) * f;
  const n = a.n + (b.n - a.n) * f;
  const speedKt = Math.hypot(e, n);
  return {
    // A calm has no direction; 0 keeps the type, and with no speed it
    // changes no figure.
    directionDeg: speedKt === 0 ? 0 : ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360,
    speedKt,
    tempC: below.tempC != null && above.tempC != null ? below.tempC + (above.tempC - below.tempC) * f : null,
    altitudeFtMsl: below.altitudeFtMsl + (above.altitudeFtMsl - below.altitudeFtMsl) * f,
  };
}

/** The wind along and across a line flown toward `trackDeg`. Headwind is
 *  positive when the wind opposes the plane and negative for a tailwind;
 *  the crosswind is its size, the side not mattering to the ground speed. */
export function windOnTrack(
  windFromDeg: number,
  windKt: number,
  trackDeg: number,
): { headwindKt: number; crosswindKt: number } {
  const r = ((windFromDeg - trackDeg) * Math.PI) / 180;
  return { headwindKt: windKt * Math.cos(r), crosswindKt: Math.abs(windKt * Math.sin(r)) };
}

/** The standard atmosphere's temperature at an altitude, °C. */
export function standardTempC(altitudeFtMsl: number): number {
  return ISA_T0_K - ISA_LAPSE_K_PER_FT * altitudeFtMsl - 273.15;
}

/**
 * True airspeed from the indicated airspeed the pilot reads: indicated over
 * the square root of the density ratio, the density from the standard
 * pressure at the altitude and the temperature given (the standard one when
 * null). See the header for what is left out.
 */
export function trueAirspeedKt(indicatedKt: number, altitudeFtMsl: number, tempC: number | null): number {
  const pressureRatio = (1 - (ISA_LAPSE_K_PER_FT * altitudeFtMsl) / ISA_T0_K) ** ISA_PRESSURE_EXP;
  const tempRatio = ((tempC ?? standardTempC(altitudeFtMsl)) + 273.15) / ISA_T0_K;
  return indicatedKt / Math.sqrt(pressureRatio / tempRatio);
}

/**
 * The plane's speed along a line over the ground, or null when the
 * crosswind is at or above its true airspeed and no heading holds the line.
 * Zero or less means the headwind takes all of it: the plane makes no
 * ground on that bearing.
 */
export function groundSpeedKt(tasKt: number, headwindKt: number, crosswindKt: number): number | null {
  if (crosswindKt >= tasKt) return null;
  return Math.sqrt(tasKt * tasKt - crosswindKt * crosswindKt) - headwindKt;
}

/** Whole seconds to cover a distance over the ground, rounded up; null when
 *  the plane makes no ground. */
export function secondsToCover(distanceFt: number, groundSpeedKt_: number): number | null {
  if (!(groundSpeedKt_ > 0)) return null;
  return Math.ceil(distanceFt / (groundSpeedKt_ * KT_TO_FPS));
}

export interface ExitSeparation {
  wind: WindAtAltitude;
  headwindKt: number;
  crosswindKt: number;
  /** True airspeed worked from the indicated one, and whether the forecast
   *  had a temperature for it or the standard one stood in. */
  tasKt: number;
  tempForecast: boolean;
  /** Along the jump run; null when no heading holds the line. */
  groundSpeedKt: number | null;
}

/**
 * The estimate from a bearing and an indicated airspeed, or null when the
 * table has no wind at the exit altitude.
 */
export function estimateExitSeparation(
  levels: readonly WindsAloftLevel[],
  opts: { exitFtAgl: number; trackDeg: number; indicatedKt: number },
): ExitSeparation | null {
  const wind = windAtAltitude(levels, opts.exitFtAgl);
  if (!wind) return null;
  const { headwindKt, crosswindKt } = windOnTrack(wind.directionDeg, wind.speedKt, opts.trackDeg);
  const tasKt = trueAirspeedKt(opts.indicatedKt, wind.altitudeFtMsl, wind.tempC);
  return {
    wind,
    headwindKt,
    crosswindKt,
    tasKt,
    tempForecast: wind.tempC != null,
    groundSpeedKt: groundSpeedKt(tasKt, headwindKt, crosswindKt),
  };
}
