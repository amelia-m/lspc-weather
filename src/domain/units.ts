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

/** 8-point compass label for a true heading in degrees. */
export function compass(deg: number): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

/** 16-point compass label for a true heading in degrees.
 *
 *  Winds are reported to the nearest 8 points because that is the resolution a
 *  jumper acts on, but a fixed bearing between two known points deserves the
 *  finer label: the METAR station sits at 060° from the DZ, which 8-point
 *  rounding would report as "NE" (045°) — a 15° overstatement of a bearing we
 *  know exactly. */
export function compass16(deg: number): string {
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
