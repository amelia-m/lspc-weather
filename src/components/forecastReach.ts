/* The plain helpers the forecast cards share about how far ahead the NWS
 * forecast reaches, kept out of the component files so those export only
 * components (react-refresh). */
import type { HourlyPoint } from '../domain/types';

/** How far ahead the strip looks: twelve hours by default, and longer at the
 *  reader's choice (the maintainer, 2026-10-24). The NWS ceiling forecast
 *  runs about a day and a half, so 36 h reaches its end on most refreshes;
 *  the sky cover runs on, and the strip says where the ceiling stops. */
export const SKY_HORIZONS = [12, 24, 36] as const;

/** The horizons worth offering for `futureHours` hours of forecast: the
 *  first always, a longer one only when the forecast runs past the one
 *  before it, so it always shows something new, though not always its full
 *  length. The Hourly wind card and the Ceiling & sky card both offer
 *  theirs this way. */
export function horizonOptions<T>(horizons: readonly T[], hoursOf: (h: T) => number, futureHours: number): T[] {
  return horizons.filter((_, i) => i === 0 || futureHours > hoursOf(horizons[i - 1]));
}

export const skyHorizonOptions = (futureHours: number): number[] =>
  horizonOptions(SKY_HORIZONS, (h) => h, futureHours);

/** What the Ceiling & sky card says about hours in its strip that the NWS
 *  ceiling forecast does not cover: `end` when the forecast stops partway
 *  and does not come back within the strip (its usual reach, about a day
 *  and a half), `gaps` for any other shape (no ceiling element at all, or a
 *  hole it resumes after), null when every hour is covered. A reach ending
 *  is the only shape the "about a day and a half" sentence explains. */
export function ceilingCoverage(
  hours: readonly Pick<HourlyPoint, 'time' | 'ceilingForecast'>[],
): { kind: 'end'; from: number } | { kind: 'gaps' } | null {
  const first = hours.findIndex((h) => !h.ceilingForecast);
  if (first < 0) return null;
  if (first > 0 && !hours.slice(first).some((h) => h.ceilingForecast)) return { kind: 'end', from: hours[first].time };
  return { kind: 'gaps' };
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
