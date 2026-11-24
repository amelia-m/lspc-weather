import { WINDS_ALOFT_LEVELS_AGL } from '../config/site';
import { coerceOpenMeteoTimes, normalizeOpenMeteo, OPEN_METEO_RRFS_MODEL, type RawOpenMeteo } from './normalize';
import type { RrfsLog } from './paritySummary';
import type { WindsAloftLevel } from './types';
import { interpolateWindsAloft, levelDiffs } from './windsAloft';

/** What came back from asking Open-Meteo for the winds from a named model:
 *  the body, or why there is none. */
export type ModelAnswer = { raw: RawOpenMeteo } | { error: string };

/**
 * The comparison's record of the RRFS for one run (scripts/schulzeCompare.live.ts,
 * from 2026-11-24): the table built from the RRFS's answer for the hour the
 * app showed, minus the app's default table, row by row.
 *
 * Why it is logged: NOAA replaced the NAM with the RRFS on 2026-11-03, and
 * Open-Meteo says the HRRR, which the app's unnamed request is served from
 * here, goes with RRFSv2. The log is how far the table on screen would move,
 * measured before it does.
 *
 * It never throws, since the comparison is a report that must not fail its
 * run: a request that failed, an answer for another hour (the two tables
 * would differ by the hour, not the model) and a body the normaliser cannot
 * read are each recorded as that, with no rows. Pure: `now` is passed in.
 */
export function rrfsLogOf(
  answer: ModelAnswer,
  run: RrfsLog['run'],
  now: number,
  validMs: number,
  defaultLevels: readonly WindsAloftLevel[],
  elevationFt: number,
): RrfsLog {
  const model = OPEN_METEO_RRFS_MODEL;
  if ('error' in answer) return { model, run, error: answer.error };
  try {
    const n = normalizeOpenMeteo(coerceOpenMeteoTimes(answer.raw), now);
    if (n.validMs == null || n.samples.length === 0) return { model, run, error: 'no usable hour' };
    if (n.validMs !== validMs) return { model, run, error: `a different hour: ${new Date(n.validMs).toISOString()}` };
    const levels = interpolateWindsAloft(n.samples, elevationFt, WINDS_ALOFT_LEVELS_AGL);
    return {
      model,
      run,
      // How much of the profile the model serves: every sample the request
      // names that came back with a wind, and the rows they reach. The RRFS
      // had no 180 m wind on 2026-11-24, so its 500 ft row is built from
      // fewer samples than the default's; the count says when that changes.
      samples: n.samples.length,
      levels: levels.length,
      rows: levelDiffs(levels, defaultLevels),
    };
  } catch (e) {
    return { model, run, error: `unreadable body: ${(e as Error).message}` };
  }
}
