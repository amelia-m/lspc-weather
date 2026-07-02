import type { RawOpenMeteoDaily } from '../../domain/normalize';

/** Anchor each fixture day at 12:00 UTC (06:00/07:00 America/Chicago) so the
 *  weekday label rendered in the DZ time zone matches the intended UTC day. */
const dayStartSec = (offsetDays: number): number =>
  Math.floor(Date.now() / 86_400_000) * 86_400 + 12 * 3600 + offsetDays * 86_400;

/** Sample Open-Meteo daily response (wind_speed_unit=kn, timeformat=unixtime)
 *  for a 10-day outlook anchored to today: a jumpable stretch, a windy spell,
 *  and a storm day to exercise every column. */
export const OPEN_METEO_DAILY_FIXTURE: RawOpenMeteoDaily = {
  daily: {
    time: Array.from({ length: 10 }, (_, i) => dayStartSec(i)),
    weather_code: [1, 0, 2, 3, 61, 95, 80, 2, 1, 45],
    temperature_2m_max: [29, 31, 30, 27, 24, 26, 25, 28, 30, 27],
    temperature_2m_min: [17, 18, 19, 17, 15, 16, 15, 16, 18, 16],
    precipitation_probability_max: [5, 0, 10, 30, 80, 90, 60, 15, 5, 20],
    wind_speed_10m_max: [9, 11, 14, 18, 16, 22, 12, 8, 10, 7],
    wind_gusts_10m_max: [15, 17, 22, 28, 26, 38, 20, 13, 16, 11],
  },
};
