import { fetchJson, OPEN_METEO_BASE, USE_FIXTURES } from './http';
import { normalizeOpenMeteo, type RawOpenMeteo } from '../domain/normalize';
import { interpolateWindsAloft } from '../domain/windsAloft';
import type { WindsAloftLevel } from '../domain/types';
import { OPEN_METEO_FIXTURE } from './fixtures/openMeteo';

const PRESSURE_LEVELS = [1000, 925, 850, 700, 600, 500];

function buildHourlyVars(): string {
  const vars = ['wind_speed_10m', 'wind_direction_10m'];
  for (const p of PRESSURE_LEVELS) {
    vars.push(`wind_speed_${p}hPa`, `wind_direction_${p}hPa`, `geopotential_height_${p}hPa`);
  }
  return vars.join(',');
}

/** Fetch winds aloft and interpolate to the requested AGL jump altitudes. */
export async function fetchWindsAloft(
  lat: number,
  lon: number,
  fieldElevationFt: number,
  targetAltitudesFtAgl: readonly number[],
  now: number,
): Promise<WindsAloftLevel[]> {
  const data: RawOpenMeteo = USE_FIXTURES
    ? OPEN_METEO_FIXTURE
    : await fetchJson<RawOpenMeteo>(
        `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lon}` +
          `&hourly=${buildHourlyVars()}` +
          `&wind_speed_unit=kn&forecast_days=2&timeformat=unixtime&timezone=UTC`,
      );

  // timeformat=unixtime returns numbers; normalize expects ISO strings, so
  // coerce here to keep the normalizer single-pathed.
  const coerced = coerceTimes(data);
  const samples = normalizeOpenMeteo(coerced, now);
  return interpolateWindsAloft(samples, fieldElevationFt, targetAltitudesFtAgl);
}

/** Open-Meteo returns epoch seconds when timeformat=unixtime; normalize wants
 *  parseable strings. Fixtures already use ISO strings, so pass those through. */
function coerceTimes(data: RawOpenMeteo): RawOpenMeteo {
  const t = data.hourly.time as unknown[];
  if (t.length > 0 && typeof t[0] === 'number') {
    return {
      ...data,
      hourly: {
        ...data.hourly,
        time: (t as number[]).map((s) => new Date(s * 1000).toISOString()),
      },
    };
  }
  return data;
}
