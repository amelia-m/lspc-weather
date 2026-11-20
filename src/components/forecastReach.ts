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

/* `ceilingCoverage`, which named the hours of the Ceiling & sky card's
 * strip the NWS ceiling forecast did not cover, went with the strip
 * (2026-11-18): the day tables say where that forecast ends through
 * `nwsCeilingForecastEnd` in src/domain/skyDays.ts. */

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
