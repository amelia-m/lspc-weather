/** Humidity helpers — pure and unit-tested. Relative humidity and the
 *  temperature/dew-point spread are fog & low-ceiling signals (a small spread
 *  with high RH favors fog), and the vapor pressure feeds the humidity-corrected
 *  density altitude. */

/** Saturation vapor pressure over water, hPa (Magnus/Tetens, WMO coefficients). */
export function satVaporPressureHpa(tC: number): number {
  return 6.112 * Math.exp((17.62 * tC) / (243.12 + tC));
}

/** Relative humidity, percent, from temperature and dew point (°C). */
export function relativeHumidity(tempC: number, dewpointC: number): number {
  const rh = 100 * (satVaporPressureHpa(dewpointC) / satVaporPressureHpa(tempC));
  return Math.max(0, Math.min(100, rh));
}

/** Temperature − dew point spread, °C. */
export const dewpointSpreadC = (tempC: number, dewpointC: number): number => tempC - dewpointC;
