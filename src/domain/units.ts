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

export const round = (n: number, places = 0): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
