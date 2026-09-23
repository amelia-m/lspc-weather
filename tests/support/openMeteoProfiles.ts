import { OPEN_METEO_FIXTURE } from '../../src/api/fixtures/openMeteo';
import { hourStartMs } from '../../src/api/fixtures/_time';
import { SITE, WINDS_ALOFT_LEVELS_AGL } from '../../src/config/site';
import { normalizeOpenMeteo, type RawOpenMeteo } from '../../src/domain/normalize';
import { interpolateWindsAloft } from '../../src/domain/windsAloft';
import type { WindsAloftLevel } from '../../src/domain/types';

/**
 * Winds-aloft profiles built the way the app builds them — the Open-Meteo
 * fixture through `normalizeOpenMeteo` and `interpolateWindsAloft` at the
 * configured altitudes — so a test about where the profile ends is exercising
 * the real path, not a hand-typed list that happens to stop somewhere.
 */

const PRESSURE_VARIABLES = ['wind_speed', 'wind_direction', 'geopotential_height', 'temperature'];

/** The fixture with the named pressure levels served as nulls, which is how
 *  Open-Meteo reports a level it has no value for. */
function withLevelsMissing(hPa: readonly number[]): RawOpenMeteo {
  const hourly = { ...OPEN_METEO_FIXTURE.hourly };
  for (const p of hPa) {
    for (const v of PRESSURE_VARIABLES) {
      const key = `${v}_${p}hPa`;
      hourly[key] = hourly[key].map(() => null) as unknown as number[];
    }
  }
  return { ...OPEN_METEO_FIXTURE, hourly };
}

function levelsFrom(raw: RawOpenMeteo): WindsAloftLevel[] {
  const { samples } = normalizeOpenMeteo(raw, hourStartMs());
  return interpolateWindsAloft(samples, SITE.dz.elevationFt, WINDS_ALOFT_LEVELS_AGL);
}

/** The full profile: every configured altitude, surface to the top. */
export const fullProfile = (): WindsAloftLevel[] => levelsFrom(OPEN_METEO_FIXTURE);

/** The profile with the 500 and 600 hPa levels missing. The highest sample is
 *  then 700 hPa, whose fixture height (3,120 m, 10,236 ft MSL) puts it at
 *  ~9,050 ft above the field, so the interpolated profile ends at 9,000 ft AGL
 *  — four rows short of the 13,000 ft the app asks for. */
export const shortProfile = (): WindsAloftLevel[] => levelsFrom(withLevelsMissing([500, 600]));

/** Where the short profile ends, stated once so the assertions and the fixture
 *  cannot disagree about it. */
export const SHORT_PROFILE_TOP_FT_AGL = 9000;

/** What the app asks for at the top. */
export const REQUESTED_TOP_FT_AGL = Math.max(...WINDS_ALOFT_LEVELS_AGL);
