import type { SunTimes } from './types';

/**
 * Sunrise/sunset via the standard NOAA "sunrise equation" (Wikipedia). Pure and
 * offline — avoids an extra API call and works in the blocked sandbox. Accuracy
 * is within a minute, plenty for "last load" planning.
 *
 * Longitude is east-positive; `lw` (west-positive) is used for the day-cycle
 * selection so the computed sunrise/sunset fall on the correct LOCAL solar day
 * rather than the UTC day.
 */
export function sunTimes(lat: number, lon: number, date: Date): SunTimes {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const lw = -lon; // west longitude positive

  const jDate = date.getTime() / 86400000 + 2440587.5;
  const n = Math.round(jDate - 2451545.0 - 0.0009 - lw / 360);

  const jStar = 2451545.0 + 0.0009 + lw / 360 + n; // mean solar noon (full JD)
  const d = jStar - 2451545.0; // days since J2000
  const M = ((357.5291 + 0.98560028 * d) % 360 + 360) % 360; // solar mean anomaly
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (((M + 102.9372 + C + 180) % 360) + 360) % 360; // ecliptic longitude

  const jTransit = jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const sinDecl = Math.sin(lambda * rad) * Math.sin(23.44 * rad);
  const decl = Math.asin(sinDecl);

  const cosOmega =
    (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinDecl) /
    (Math.cos(lat * rad) * Math.cos(decl));
  const omega = Math.acos(Math.max(-1, Math.min(1, cosOmega))) * deg; // polar day/night guard

  return {
    sunrise: julianToMs(jTransit - omega / 360),
    sunset: julianToMs(jTransit + omega / 360),
  };
}

const julianToMs = (j: number): number => (j - 2440587.5) * 86400000;
