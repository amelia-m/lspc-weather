import type { DensityAltitudeResult } from './types';

/**
 * Density altitude by the National Weather Service's own formulas: those
 * behind its Density Altitude calculator (weather.gov/epz,
 * wxcalc_densityaltitude) and its Pressure Altitude calculator
 * (wxcalc_pressurealtitude), read 2026-10-09 from the pages' scripts and
 * the formula sheets they link (densityAltitude.pdf, pressureAltitude.pdf).
 *
 *   pressure altitude PA = elevation + (29.92 − altimeter) × 1000
 *   station pressure  P  = 1013.25 × (1 − PA / 145366.45)^(1 / 0.190284) hPa
 *   density altitude  DA = 145366 × (1 − (17.326 × P_inHg / T_R)^0.235)
 *
 * with T_R the temperature in degrees Rankine. The first line is the
 * pilot's rule and the figure the card prints; the second is the Pressure
 * Altitude calculator's formula run backwards, the pressure the standard
 * atmosphere has at that altitude; the third is the Density Altitude
 * calculator's. So the headline follows from the two figures printed under
 * it, pressure altitude and temperature, as an E6B's does, and the card
 * prints the station pressure for a reader to put into the NWS calculator.
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
 *    calculator computes it from the dew point (moist air is less dense, so
 *    it behaves like warmer dry air); the calculator has no dry mode. Null
 *    without a dew point. The vapour pressure is the calculator's own
 *    formula, so this is the figure its page gives for the card's station
 *    pressure, temperature and dew point.
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
 * measured against, so the rows under the headline are the inputs it came
 * from.
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
  const isaTempC = 15 - 1.98 * (pressureAltitudeFt / 1000);

  // The calculator converts inches to millibars with 33.8639; the same
  // factor back.
  const stationHpa = 1013.25 * (1 - pressureAltitudeFt / 145366.45) ** (1 / 0.190284);
  const stationInHg = stationHpa / 33.8639;
  const tK = oatC + 273.15;
  const fromKelvin = (kelvin: number): number => 145366 * (1 - ((17.326 * stationInHg) / (kelvin * 1.8)) ** 0.235);

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
  };
}
