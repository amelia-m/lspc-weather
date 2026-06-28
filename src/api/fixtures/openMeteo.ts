import type { RawOpenMeteo } from '../../domain/normalize';
import { isoHour } from './_time';

/** Sample Open-Meteo response (wind_speed_unit=kn) with 10 m wind plus a few
 *  pressure levels and their geopotential heights, for two hours anchored to
 *  the current hour so the "nearest hour" pick lands on real sample winds. */
export const OPEN_METEO_FIXTURE: RawOpenMeteo & { elevation: number } = {
  elevation: 360, // m MSL (~1182 ft)
  hourly: {
    time: [isoHour(0), isoHour(1)],
    temperature_2m: [25, 26],
    wind_speed_10m: [11, 12],
    wind_direction_10m: [190, 195],
    wind_speed_1000hPa: [14, 15],
    wind_direction_1000hPa: [195, 200],
    geopotential_height_1000hPa: [110, 112],
    temperature_1000hPa: [24, 25],
    wind_speed_925hPa: [21, 22],
    wind_direction_925hPa: [205, 210],
    geopotential_height_925hPa: [780, 785],
    temperature_925hPa: [18, 19],
    wind_speed_850hPa: [27, 28],
    wind_direction_850hPa: [215, 218],
    geopotential_height_850hPa: [1500, 1505],
    temperature_850hPa: [12, 13],
    wind_speed_700hPa: [33, 34],
    wind_direction_700hPa: [230, 232],
    geopotential_height_700hPa: [3120, 3130],
    temperature_700hPa: [2, 3],
    wind_speed_600hPa: [38, 39],
    wind_direction_600hPa: [240, 242],
    geopotential_height_600hPa: [4400, 4410],
    temperature_600hPa: [-8, -7],
    wind_speed_500hPa: [44, 45],
    wind_direction_500hPa: [250, 252],
    geopotential_height_500hPa: [5860, 5870],
    temperature_500hPa: [-18, -17],
  },
};
