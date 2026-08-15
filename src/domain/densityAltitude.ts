import type { DensityAltitudeResult } from './types';
import { satVaporPressureHpa } from './humidity';

/**
 * Density altitude via the standard E6B / flight-planning approximation.
 *
 *   PA  = elevation + (29.92 − altimeter_inHg) × 1000
 *   ISA = 15 − 1.98 × elevation/1000           (standard temp at the field, °C)
 *   DA  = PA + 120 × (T − ISA)
 *
 * The 120 ft per °C deviation rule is the accepted approximation for
 * flight planning and is more than adequate for a performance-awareness aid.
 * Cited to FAA-P-8740-2 "Density Altitude".
 *
 * When a dew point is supplied, moisture is folded in by replacing the dry OAT
 * with the VIRTUAL temperature (moist air is less dense, so it behaves like
 * warmer dry air → higher DA). The displayed ISA deviation stays the dry
 * thermometer reading; only the DA value carries the moisture correction.
 *
 * Pure function — no I/O, fully unit-tested.
 */
export function densityAltitude(params: {
  elevationFt: number;
  altimeterInHg: number;
  oatC: number;
  dewpointC?: number | null;
}): DensityAltitudeResult {
  const { elevationFt, altimeterInHg, oatC, dewpointC } = params;

  const pressureAltitudeFt = elevationFt + (29.92 - altimeterInHg) * 1000;
  const isaTempC = 15 - 1.98 * (elevationFt / 1000);
  const isaDeviationC = oatC - isaTempC;

  // Effective temperature driving DA: virtual temp when humidity is known.
  let effectiveTempC = oatC;
  const humidityCorrected = dewpointC != null;
  if (humidityCorrected) {
    // Station pressure (hPa) from the pressure altitude, standard atmosphere.
    const pStationHpa = 1013.25 * (1 - pressureAltitudeFt * 6.8756e-6) ** 5.2559;
    const eHpa = satVaporPressureHpa(dewpointC); // actual vapor pressure
    const tK = oatC + 273.15;
    const tvK = tK / (1 - (eHpa / pStationHpa) * (1 - 0.622));
    effectiveTempC = tvK - 273.15;
  }
  const densityAltitudeFt = pressureAltitudeFt + 120 * (effectiveTempC - isaTempC);

  return {
    densityAltitudeFt: Math.round(densityAltitudeFt),
    pressureAltitudeFt: Math.round(pressureAltitudeFt),
    isaDeviationC: Math.round(isaDeviationC * 10) / 10,
    fieldElevationFt: elevationFt,
    humidityCorrected,
  };
}
