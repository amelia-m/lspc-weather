import type { DensityAltitudeResult } from './types';

/**
 * Density altitude by the National Weather Service's own method: the
 * formulas behind its Density Altitude calculator (weather.gov/epz,
 * wxcalc_densityaltitude), read 2026-10-09 from the page's script and its
 * formula sheets (densityAltitude.pdf, stationPressure.pdf).
 *
 *   station pressure  P = altimeter × ((288 − 0.0065 × h_m) / 288)^5.2561
 *   density altitude  DA = 145366 × (1 − (17.326 × P_inHg / T_R)^0.235)
 *
 * with h_m the field elevation in metres and T_R the temperature in degrees
 * Rankine. The second line is the standard atmosphere's density altitude:
 * the height at which standard air has the density the field's air has now.
 *
 * Two figures come out of it, because the two documents a reader would check
 * the card against disagree about humidity:
 *
 *  - `densityAltitudeFt`, dry: T is the thermometer reading. This is
 *    FAA-P-8740-2's density altitude, "pressure altitude corrected for
 *    nonstandard temperature variations", and the card's headline. The
 *    pamphlet leaves humidity out of the computation, "because the effect of
 *    humidity is related to engine power rather than aerodynamic
 *    efficiency", and advises adding 10 percent to takeoff distance when it
 *    is high instead.
 *  - `humidDensityAltitudeFt`: T is the virtual temperature, as the NWS
 *    calculator computes it from the dew point (moist air is less dense, so
 *    it behaves like warmer dry air). Null without a dew point.
 *
 * This replaced `PA + 120 × (T − ISA)` with the virtual temperature in T. The
 * 120 ft per °C is in neither document (the pamphlet's chart works out to
 * roughly 100 to 115), and the headline folded humidity in, so on a hot,
 * humid day it ran 460 to 570 ft above the dry figure (30 °C over a 22 °C
 * dew point, 35 °C over 24 °C, at the field on a 29.92 altimeter). The
 * calculator's rounded constants put a standard day about 20 ft high, at
 * sea level as at the field; that is its figure, and kept. The vapour pressure is
 * the calculator's own formula rather than `satVaporPressureHpa`, so the
 * humid figure is the one its page gives for the same inputs.
 *
 * Pressure altitude stays the pilot's rule, elevation + (29.92 − altimeter)
 * × 1000, and the ISA deviation is from the standard temperature at the
 * field, 15 − 1.98 °C per 1,000 ft: both are figures the card prints, not
 * inputs to the density altitude.
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

  const pressureAltitudeFt = elevationFt + (29.92 - altimeterInHg) * 1000;
  const isaTempC = 15 - 1.98 * (elevationFt / 1000);

  const stationInHg = altimeterInHg * ((288 - 0.0065 * elevationFt * 0.3048) / 288) ** 5.2561;
  const tK = oatC + 273.15;
  const fromKelvin = (kelvin: number): number => 145366 * (1 - ((17.326 * stationInHg) / (kelvin * 1.8)) ** 0.235);

  let humidDensityAltitudeFt: number | null = null;
  if (dewpointC != null) {
    const eHpa = 6.11 * 10 ** ((7.5 * dewpointC) / (237.3 + dewpointC));
    const tvK = tK / (1 - (eHpa / (stationInHg * 33.8639)) * (1 - 0.622));
    humidDensityAltitudeFt = Math.round(fromKelvin(tvK));
  }

  return {
    densityAltitudeFt: Math.round(fromKelvin(tK)),
    humidDensityAltitudeFt,
    pressureAltitudeFt: Math.round(pressureAltitudeFt),
    isaDeviationC: Math.round((oatC - isaTempC) * 10) / 10,
    fieldElevationFt: elevationFt,
  };
}
