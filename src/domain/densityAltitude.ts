import type { DensityAltitudeResult } from './types';

/**
 * Density altitude via the standard E6B / flight-planning approximation.
 *
 *   PA  = elevation + (29.92 − altimeter_inHg) × 1000
 *   ISA = 15 − 1.98 × elevation/1000           (standard temp at the field, °C)
 *   DA  = PA + 120 × (OAT − ISA)
 *
 * The 120 ft per °C deviation rule is the accepted approximation for
 * flight planning and is more than adequate for a performance-awareness aid.
 * Cited to FAA-P-8740-2 "Density Altitude".
 *
 * Pure function — no I/O, fully unit-tested.
 */
export function densityAltitude(params: {
  elevationFt: number;
  altimeterInHg: number;
  oatC: number;
}): DensityAltitudeResult {
  const { elevationFt, altimeterInHg, oatC } = params;

  const pressureAltitudeFt = elevationFt + (29.92 - altimeterInHg) * 1000;
  const isaTempC = 15 - 1.98 * (elevationFt / 1000);
  const isaDeviationC = oatC - isaTempC;
  const densityAltitudeFt = pressureAltitudeFt + 120 * isaDeviationC;

  return {
    densityAltitudeFt: Math.round(densityAltitudeFt),
    pressureAltitudeFt: Math.round(pressureAltitudeFt),
    isaDeviationC: Math.round(isaDeviationC * 10) / 10,
    fieldElevationFt: elevationFt,
  };
}
