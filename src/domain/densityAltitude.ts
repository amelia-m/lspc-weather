import type { CurrentConditions, DensityAltitudeResult } from './types';
import { FT_PER_M, HPA_PER_INHG } from './units';

/**
 * Density altitude by the National Weather Service's own formulas, those
 * behind three of its WFO El Paso calculators (weather.gov/epz, wxcalc_*),
 * read 2026-10-09 from the pages' scripts and the formula sheets they link:
 *
 *   station pressure  P  = altimeter × ((288 − 0.0065 × h_m) / 288)^5.2561
 *   pressure altitude PA = (1 − (P_hPa / 1013.25)^0.190284) × 145366.45
 *   density altitude  DA = 145366 × (1 − (17.326 × P_inHg / T_R)^0.235)
 *
 * with h_m the field elevation in metres and T_R the temperature in degrees
 * Rankine. The altimeter setting is reduced to the field's pressure, the
 * pressure altitude is the standard atmosphere's altitude for that pressure
 * (what an altimeter set to 29.92 reads), and the density altitude is the
 * standard atmosphere's altitude for the air's density. The pilot's rule,
 * elevation + (29.92 − altimeter) × 1,000, approximates the second line and
 * drifts from it away from 29.92: at this field 54 ft at 30.50, 105 ft at
 * 31.00, 70 ft at 28.90. The card prints the exact one,
 * so the headline follows from the rows printed under it (pressure
 * altitude, or the station pressure, and the temperature), as an E6B's does.
 *
 * Two figures come out, because the two documents a reader would check the
 * card against disagree about humidity:
 *
 *  - `densityAltitudeFt`, dry: T is the thermometer reading. This is
 *    FAA-P-8740-2's density altitude, "pressure altitude corrected for
 *    nonstandard temperature variations", and the card's headline. The
 *    pamphlet leaves humidity out of the computation, "because the effect of
 *    humidity is related to engine power rather than aerodynamic
 *    efficiency", and advises adding 10 percent to takeoff distance when it
 *    is high instead.
 *  - `humidDensityAltitudeFt`: T is the virtual temperature, as the NWS
 *    Density Altitude calculator computes it from the dew point (moist air
 *    is less dense, so it behaves like warmer dry air); the calculator has
 *    no dry mode. Null without a dew point. The vapour pressure is the
 *    calculator's own formula, so this is the figure its page gives for the
 *    card's station pressure, temperature and dew point.
 *
 * This replaced `PA + 120 × (T − ISA)` with the virtual temperature in T. The
 * 120 ft per °C is in neither document (the pamphlet's chart works out to
 * roughly 100 to 115), and the headline folded humidity in, so on a hot,
 * humid day it ran 460 to 570 ft above the dry figure (30 °C over a 22 °C
 * dew point, 35 °C over 24 °C, at the field on a 29.92 altimeter). The
 * calculator's rounded constants put a standard day about 20 ft high, at
 * sea level as at the field; that is its figure, and kept.
 *
 * The ISA deviation is from the standard temperature at the pressure
 * altitude, 15 − 1.98 °C per 1,000 ft, the temperature density altitude is
 * measured against.
 *
 * Pure function: no I/O.
 */
export function densityAltitude(params: {
  elevationFt: number;
  altimeterInHg: number;
  oatC: number;
  dewpointC?: number | null;
}): DensityAltitudeResult {
  const { elevationFt, altimeterInHg, oatC, dewpointC } = params;

  const stationInHg = altimeterInHg * ((288 - 0.0065 * (elevationFt / FT_PER_M)) / 288) ** 5.2561;
  const stationHpa = stationInHg * HPA_PER_INHG;
  const pressureAltitudeFt = (1 - (stationHpa / 1013.25) ** 0.190284) * 145366.45;
  const isaTempC = 15 - 1.98 * (pressureAltitudeFt / 1000);
  const tK = oatC + 273.15;
  const fromKelvin = (kelvin: number): number =>
    145366 * (1 - ((17.326 * stationInHg) / (kelvin * 1.8)) ** 0.235);

  let humidDensityAltitudeFt: number | null = null;
  if (dewpointC != null) {
    const eHpa = 6.11 * 10 ** ((7.5 * dewpointC) / (237.3 + dewpointC));
    const tvK = tK / (1 - (eHpa / stationHpa) * (1 - 0.622));
    humidDensityAltitudeFt = Math.round(fromKelvin(tvK));
  }

  return {
    densityAltitudeFt: Math.round(fromKelvin(tK)),
    humidDensityAltitudeFt,
    pressureAltitudeFt: Math.round(pressureAltitudeFt),
    stationPressureInHg: Math.round(stationInHg * 100) / 100,
    isaDeviationC: Math.round((oatC - isaTempC) * 10) / 10,
    fieldElevationFt: elevationFt,
    oatC,
    dewpointC: dewpointC ?? null,
  };
}

/** The card's figures for one report, or null when the report has no
 *  altimeter setting or temperature. From that report or not at all: the
 *  card prints the temperature it was worked from, so a result kept from an
 *  earlier report would sit beside the METAR card's newer report worked
 *  from a different one, with nothing to say so. Without the inputs the
 *  card says what it needs. */
export function densityAltitudeOf(
  current: Pick<CurrentConditions, 'altimeterInHg' | 'tempC' | 'dewpointC'>,
  elevationFt: number,
): DensityAltitudeResult | null {
  if (current.altimeterInHg == null || current.tempC == null) return null;
  return densityAltitude({
    elevationFt,
    altimeterInHg: current.altimeterInHg,
    oatC: current.tempC,
    dewpointC: current.dewpointC,
  });
}
