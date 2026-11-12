/* The plain helpers the forecast cards share about how far ahead the NWS
 * forecast reaches, kept out of the component files so those export only
 * components (react-refresh). */
import type { HourlyPoint, NbmHour } from '../domain/types';

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

/** How the Ceiling & sky card shows the NBM's three-day bulletin, while
 *  the maintainer tries the layouts (2026-11-12): `horizon` adds a 3-day
 *  option to the strip's toggle, with an NBM ceiling row under the base;
 *  `continue` adds the option too and lets the ceiling row carry on in
 *  the NBM's figures, marked, where the NWS ceiling ends; `strip` leaves
 *  the hourly strip as it is and draws a second, three-hourly strip under
 *  it; `none` shows nothing of it. */
export type ThreeDayLayout = 'horizon' | 'continue' | 'strip' | 'none';
export const THREE_DAY_LAYOUTS: readonly ThreeDayLayout[] = ['horizon', 'continue', 'strip', 'none'];

/** The three-day horizon the NBM's three-hourly bulletin reaches (NBS,
 *  6 to 72 hours from its cycle); offered on the strip only where that
 *  bulletin is in hand, since the NWS ceiling and the hourly NBH stop
 *  well short of it. */
export const THREE_DAY_H = 72;

/** One column of a strip that runs past the NWS hourly forecast: the NWS
 *  hour where there is one, the NBM's hourly figures where its bulletin
 *  reaches, and the three-hourly bulletin's at its own times. A column with
 *  no NWS hour draws no NWS bar: the NBM is a second forecast, printed
 *  beside the first, never standing in for it. */
export interface StripColumn {
  time: number;
  nws: HourlyPoint | null;
  nbh: NbmHour | null;
  nbs: NbmHour | null;
}

/** The columns of a strip `horizonH` hours long from `from`: every NWS
 *  hour in it, and past the last NWS hour every time the three-hourly
 *  bulletin has in it, so the strip runs on to the bulletin's reach in
 *  its own three-hour steps rather than ending where the NWS forecast
 *  does. Sorted by time, one column per time. */
export function stripColumns(
  from: number,
  horizonH: number,
  nws: readonly HourlyPoint[],
  nbh: readonly NbmHour[] | null | undefined,
  nbs: readonly NbmHour[] | null | undefined,
): StripColumn[] {
  const end = from + horizonH * 3_600_000;
  const nbhAt = new Map((nbh ?? []).map((h) => [h.time, h]));
  const nbsAt = new Map((nbs ?? []).map((h) => [h.time, h]));
  const times = new Set<number>();
  let lastNws = -Infinity;
  for (const h of nws) {
    if (h.time < from || h.time >= end) continue;
    times.add(h.time);
    lastNws = Math.max(lastNws, h.time);
  }
  for (const t of nbsAt.keys()) if (t > lastNws && t >= from && t < end) times.add(t);
  const nwsAt = new Map(nws.map((h) => [h.time, h]));
  return [...times].sort((a, b) => a - b).map((time) => ({
    time,
    nws: nwsAt.get(time) ?? null,
    nbh: nbhAt.get(time) ?? null,
    nbs: nbsAt.get(time) ?? null,
  }));
}
