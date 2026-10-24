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
 *  before it, as the Hourly wind card offers its own. */
export const skyHorizonOptions = (futureHours: number): number[] =>
  SKY_HORIZONS.filter((_, i) => i === 0 || futureHours > SKY_HORIZONS[i - 1]);

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
