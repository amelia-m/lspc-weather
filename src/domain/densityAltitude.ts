import type { DensityAltitudeResult } from './types';
import { satVaporPressureHpa } from './humidity';

/**
 * Density altitude via the standard E6B / flight-planning approximation.
 *
 *   PA  = elevation + (29.92 − altimeter_inHg) × 1000
 *   ISA = 15 − 1.98 × elevation/1000           (standard temp at the field, °C)
 *   DA  = PA + 120 × (T − ISA)
 *
 * The 120 ft per °C deviation rule is the accepted flight-planning
 * approximation and is more than adequate for a performance-awareness aid.
 * It is NOT in FAA-P-8740-2, the pamphlet the card cites for the performance
 * claim (2008 edition, read 2026-09-23): that document defines density
 * altitude as "pressure altitude corrected for nonstandard temperature
 * variations" and gives a rule-of-thumb chart rather than a coefficient. The
 * chart's rows work out to roughly 100–115 ft per °C, so this formula reads a
 * couple of hundred feet higher on a hot day than the chart would. The card
 * cites the pamphlet for the claim (worse climb, longer takeoff), not for
 * this number.
 *
 * When a dew point is supplied, moisture is folded in by replacing the dry OAT
 * with the VIRTUAL temperature (moist air is less dense, so it behaves like
 * warmer dry air → higher DA). The displayed ISA deviation stays the dry
 * thermometer reading; only the DA value carries the moisture correction.
 * The pamphlet does not do this: it says humidity "is not generally
 * considered a major factor in density altitude computations because the
 * effect of humidity is related to engine power rather than aerodynamic
 * efficiency", and advises adding 10 percent to takeoff distance when it is
 * high instead. The correction here is the air-density part of that effect,
 * which is why the card labels the figure "humidity-corrected" rather than
 * presenting it as the number an ASOS or an E6B would give the pilot.
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
