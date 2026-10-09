/** Unit conversions. Kept tiny and pure so they are trivially testable and
 *  reusable across the domain and UI layers. */

export const KT_PER_MPH = 0.868976;
export const MPH_PER_KT = 1.150779;
export const KT_PER_MPS = 1.943844;
export const FT_PER_M = 3.280839895;
export const M_PER_SM = 1609.344;
export const HPA_PER_INHG = 33.8639;

export const ktToMph = (kt: number): number => kt * MPH_PER_KT;
export const mphToKt = (mph: number): number => mph * KT_PER_MPH;
export const mpsToKt = (mps: number): number => mps * KT_PER_MPS;
export const mToFt = (m: number): number => m * FT_PER_M;
export const mToSm = (m: number): number => m / M_PER_SM;
export const hpaToInHg = (hpa: number): number => hpa / HPA_PER_INHG;
export const cToF = (c: number): number => (c * 9) / 5 + 32;

/** The page-wide temperature unit. One setting for every card, like the
 *  wind speed unit, rather than each card printing both. */
export type TempUnit = 'F' | 'C';

/** A temperature in the page's unit, as a number, unrounded. */
export const toTemp = (c: number, u: TempUnit): number => (u === 'F' ? cToF(c) : c);

/** A temperature in the page's unit, whole degrees unless `digits` says
 *  otherwise: "70°F", "21°C", "95.0°F". Rounded before it is printed, so a
 *  value just under zero reads "0.0", not "-0.0". */
export const fmtTemp = (c: number, u: TempUnit, digits = 0): string =>
  `${round(toTemp(c, u), digits).toFixed(digits)}°${u}`;

/** A temperature DIFFERENCE in the page's unit (a dew-point spread, an ISA
 *  deviation): scaled by 9/5 with no 32 offset, since a difference of 5 °C is
 *  9 °F, not 41. Signed when `signed`; `digits` decimals (the ISA deviation
 *  keeps its tenth). */
export const fmtTempDelta = (dc: number, u: TempUnit, signed = false, digits = 0): string => {
  const v = round(u === 'F' ? (dc * 9) / 5 : dc, digits);
  return `${signed && v >= 0 ? '+' : ''}${v.toFixed(digits)}°${u}`;
};

/** 16-point compass label for a true heading in degrees.
 *
 *  16 points rather than 8 because a 45°-wide sector is coarse enough to
 *  mislead: a wind from 060° labelled "NE" is off by 15°, which over a 10,000 ft
 *  freefall is a meaningful difference in where the drift puts you. The exact
 *  degrees are shown alongside this label wherever a heading is displayed. */
export function compass(deg: number): string {
  const points = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  return points[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

export const round = (n: number, places = 0): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

export type SpeedUnit = 'kt' | 'mph';

/** Convert a knots value to the selected display unit. */
export const toSpeed = (kt: number, u: SpeedUnit): number => (u === 'mph' ? ktToMph(kt) : kt);

/** Format a knots value in the selected unit, e.g. "12 kt" or "14 mph". */
export const fmtSpeed = (kt: number, u: SpeedUnit, digits = 0): string =>
  `${round(toSpeed(kt, u), digits)} ${u}`;

/**
 * Format a wind LIMIT that its source posted in whole mph.
 *
 * The LSPC waiver sign states a gust ceiling per experience tier one mph apart
 * at the top — under 19 mph at 10–20 jumps, under 20 mph at 21+ — and the app
 * stores them converted to knots (16.51 and 17.38). Rounded to whole knots both
 * print "17 kt", so in the default unit the tier a jumper earned changed nothing
 * on screen and the dashboard misquoted the sign it asks an instructor to check
 * it against. A tenth of a knot is finer than any windsock resolves, but it is
 * what keeps two separately posted limits separate; in mph the figure lands back
 * on the posted whole number, which is how the sign reads it.
 *
 * Readings keep `fmtSpeed`: a METAR reports wind in whole knots, so a decimal
 * there would invent precision the observation does not have.
 */
export const fmtLimitSpeed = (kt: number, u: SpeedUnit): string =>
  fmtSpeed(kt, u, u === 'kt' ? 1 : 0);
