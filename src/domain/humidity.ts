/** Humidity helpers — pure and unit-tested. Relative humidity is printed on the
 *  current-conditions card, and the saturation vapor pressure feeds the
 *  humidity-corrected density altitude (virtual temperature).
 *
 *  There is deliberately no dew-point-spread helper here. A tight spread is a
 *  real fog and low-ceiling signal, but the only thing that ever consumed one
 *  was a flag firing at a 3 °C spread — a number no published source sets —
 *  which went with the rest of the unsourced triggers. MetarPanel still shows
 *  the spread beside the RH, as a plain subtraction with no verdict attached;
 *  one subtraction does not need an exported function, and exporting it again
 *  would invite a consumer that puts a threshold back on it. */

/** Saturation vapor pressure over water, hPa (Magnus/Tetens, WMO coefficients). */
export function satVaporPressureHpa(tC: number): number {
  return 6.112 * Math.exp((17.62 * tC) / (243.12 + tC));
}

/** Relative humidity, percent, from temperature and dew point (°C). */
export function relativeHumidity(tempC: number, dewpointC: number): number {
  const rh = 100 * (satVaporPressureHpa(dewpointC) / satVaporPressureHpa(tempC));
  return Math.max(0, Math.min(100, rh));
}
