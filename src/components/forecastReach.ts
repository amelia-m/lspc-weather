/* The plain helpers the forecast cards share about how far ahead the NWS
 * forecast reaches, kept out of the component files so those export only
 * components (react-refresh). */
import type { HourlyPoint } from '../domain/types';

/** The horizons worth offering for `futureHours` hours of forecast: the
 *  first always, a longer one only when the forecast runs past the one
 *  before it, so it always shows something new, though not always its full
 *  length. The Hourly wind card offers its horizons this way (the Ceiling &
 *  sky card did too until 2026-11-18, when its strip became day tables). */
export function horizonOptions<T>(horizons: readonly T[], hoursOf: (h: T) => number, futureHours: number): T[] {
  return horizons.filter((_, i) => i === 0 || futureHours > hoursOf(horizons[i - 1]));
}

/** What the Ceiling & sky card says about hours in its strip that the NWS
 *  ceiling forecast does not cover: `end` when the forecast stops partway
 *  and does not come back within the strip, `none` when it covers no hour
 *  of the strip (no ceiling element, or a copy so old it has run out),
 *  `gaps` for a hole it resumes after, null when every hour is covered.
 *  Each gets its own sentence: "from <hour>" names an end, and "some of
 *  these hours" would send a reader looking for the ones with a figure
 *  when there are none. */
export function ceilingCoverage(
  hours: readonly Pick<HourlyPoint, 'time' | 'ceilingForecast'>[],
): { kind: 'end'; from: number } | { kind: 'none' } | { kind: 'gaps' } | null {
  const first = hours.findIndex((h) => !h.ceilingForecast);
  if (first < 0) return null;
  const resumes = hours.slice(first).some((h) => h.ceilingForecast);
  if (resumes) return { kind: 'gaps' };
  return first > 0 ? { kind: 'end', from: hours[first].time } : { kind: 'none' };
}

/** What changed between two hours in what the NWS forecast covers, as the
 *  hourly table's marker row says it, or null for no change. Against no
 *  previous hour, a day that starts fully forecast needs no row. */
export function reachChange(
  prev: Pick<HourlyPoint, 'ceilingForecast' | 'visibilityForecast'> | null,
  h: Pick<HourlyPoint, 'ceilingForecast' | 'visibilityForecast'>,
): string | null {
  const before = prev ?? { ceilingForecast: true, visibilityForecast: true };
  if (before.ceilingForecast === h.ceilingForecast && before.visibilityForecast === h.visibilityForecast) return null;
  if (h.ceilingForecast && h.visibilityForecast) return 'Ceiling and visibility forecast again';
  if (!h.ceilingForecast && !h.visibilityForecast) return 'Ceiling and visibility not forecast';
  return h.ceilingForecast ? 'Visibility not forecast' : 'Ceiling not forecast';
}
