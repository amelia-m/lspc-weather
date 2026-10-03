import type { SunTimes } from './types';

/**
 * Sunrise and sunset by NOAA's own method: the functions of NOAA's Solar
 * Calculator (https://gml.noaa.gov/grad/solcalc/, its main.js, read
 * 2026-10-03), which follow Meeus's Astronomical Algorithms. Pure and
 * offline, so no extra API call.
 *
 * Why this and not something shorter: the 14 CFR 105.19 night flag fires on
 * this sunset. The simplified "sunrise equation" the app used until
 * 2026-10-03 added a fixed 0.0009 day (78 s) to solar noon and approximated
 * the equation of time and declination, and put the drop zone's sunset 2 to
 * 3 minutes late: 7:11:55 PM CDT on 2026-09-29, where NOAA's calculator gives
 * 7:09:34, the astral library 7:09:20 and Open-Meteo 7:09, and usairnet
 * printed 7:09 for KPMV. A late sunset means a late night flag. This port
 * agrees with NOAA's script to well under a second (tests/sun.test.ts).
 *
 * "Sunrise" and "sunset" are the sun's upper limb on a level horizon with
 * standard refraction (the 90.833° zenith), the definition the USNO and NOAA
 * both use; terrain and the observer's height are not modelled.
 *
 * The day is the LOCAL solar day nearest `date` (the one whose mean solar
 * noon is closest), not the UTC day, so an evening reading after 00Z gets
 * that evening's sunset rather than the next day's.
 *
 * Longitude is east-positive, as everywhere in this app (and in NOAA's
 * current script).
 */
export function sunTimes(lat: number, lon: number, date: Date): SunTimes {
  // The UTC calendar day whose mean solar noon (12:00 UTC less 4 min per
  // degree east) is nearest the instant: that is the local solar day.
  const dayIndex = Math.round(date.getTime() / DAY_MS - 0.5 + lon / 360);
  const jd0 = 2440587.5 + dayIndex; // Julian Day at 0h UT of that date

  return {
    sunrise: (dayIndex * 1440 + eventMinutesUtc(true, jd0, lat, lon)) * 60_000,
    sunset: (dayIndex * 1440 + eventMinutesUtc(false, jd0, lat, lon)) * 60_000,
  };
}

const DAY_MS = 86_400_000;
const rad = Math.PI / 180;
const deg = 180 / Math.PI;

/** Minutes after 0h UT of `jd0` at which the sun rises or sets. Two passes,
 *  as NOAA's calcSunriseSet: the first with the sun's position at 0h UT,
 *  the second with its position at the time the first found. */
function eventMinutesUtc(rise: boolean, jd0: number, lat: number, lon: number): number {
  const first = minutesAt(rise, jd0, lat, lon);
  return minutesAt(rise, jd0 + first / 1440, lat, lon);
}

/** NOAA's calcSunriseSetUTC. Where the sun neither rises nor sets that day
 *  (only poleward of about 66°) the hour angle is clamped, giving solar noon
 *  or midnight rather than NaN. */
function minutesAt(rise: boolean, jd: number, lat: number, lon: number): number {
  const t = (jd - 2451545.0) / 36525.0; // Julian centuries since J2000
  const { eqTimeMin, declDeg } = sunPosition(t);
  const latR = lat * rad;
  const decR = declDeg * rad;
  const cosHa =
    Math.cos(90.833 * rad) / (Math.cos(latR) * Math.cos(decR)) - Math.tan(latR) * Math.tan(decR);
  const haDeg = Math.acos(Math.max(-1, Math.min(1, cosHa))) * deg;
  const delta = lon + (rise ? haDeg : -haDeg);
  return 720 - 4 * delta - eqTimeMin;
}

/** The equation of time (minutes) and the sun's declination (degrees) at
 *  `t`, NOAA's calcEquationOfTime and calcSunDeclination. */
function sunPosition(t: number): { eqTimeMin: number; declDeg: number } {
  const l0 = (((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360) + 360) % 360; // mean longitude
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t); // mean anomaly
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t); // orbit eccentricity
  const c =
    Math.sin(m * rad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * rad) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * rad) * 0.000289; // equation of centre
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(omega * rad); // apparent longitude
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const obliq = 23 + (26 + seconds / 60) / 60 + 0.00256 * Math.cos(omega * rad); // corrected obliquity

  const declDeg = Math.asin(Math.sin(obliq * rad) * Math.sin(lambda * rad)) * deg;

  let y = Math.tan((obliq * rad) / 2);
  y *= y;
  const eqTime =
    y * Math.sin(2 * l0 * rad) -
    2 * e * Math.sin(m * rad) +
    4 * e * y * Math.sin(m * rad) * Math.cos(2 * l0 * rad) -
    0.5 * y * y * Math.sin(4 * l0 * rad) -
    1.25 * e * e * Math.sin(2 * m * rad);
  return { eqTimeMin: eqTime * deg * 4, declDeg };
}
