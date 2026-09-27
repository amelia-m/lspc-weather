/**
 * Which forecast hour the Winds aloft card shows, and how far that hour is
 * from the clock.
 *
 * The model is hourly. By default the card follows the hour nearest the
 * clock, which keeps the table within 30 minutes of now; at half past it
 * moves to the coming hour. The reader can step an hour at a time instead,
 * as Mark Schulze's page lets them, to look at the winds for a later load or
 * to line the table up with his (his page shows the hour in progress, so
 * after half past the two are an hour apart until one is stepped).
 *
 * A stepped choice is kept as the hour itself, not as "one hour ahead of
 * nearest": a jumper who picked the 18Z winds for a 1 PM load wants 18Z
 * after the next refresh too, not whatever hour is now one ahead. If that
 * hour drops out of the data, the card goes back to following the clock
 * rather than showing nothing.
 *
 * Pure: the clock is passed in.
 */
import type { WindsAloftHour, WindsAloftLevel } from './types';

export interface ChosenHour {
  validMs: number;
  levels: WindsAloftLevel[];
  /** True when the card is following the hour nearest the clock, false when
   *  the reader has stepped to a particular hour. */
  following: boolean;
  /** Whether there is an earlier or later hour to step to. */
  canBack: boolean;
  canForward: boolean;
}

function nearestIndex(hours: readonly WindsAloftHour[], now: number): number {
  let best = 0;
  for (let i = 1; i < hours.length; i++) {
    if (Math.abs(hours[i].validMs - now) < Math.abs(hours[best].validMs - now)) best = i;
  }
  return best;
}

/** The hour to show: the one the reader stepped to if it is still in the
 *  data, otherwise the hour nearest `now`. null with no hours. */
export function chooseForecastHour(
  hours: readonly WindsAloftHour[] | null | undefined,
  selectedMs: number | null,
  now: number,
): ChosenHour | null {
  if (!hours || hours.length === 0) return null;
  const picked = selectedMs == null ? -1 : hours.findIndex((h) => h.validMs === selectedMs);
  const i = picked >= 0 ? picked : nearestIndex(hours, now);
  return {
    validMs: hours[i].validMs,
    levels: hours[i].levels,
    following: picked < 0,
    canBack: i > 0,
    canForward: i < hours.length - 1,
  };
}

/** The hour `delta` steps from `fromMs`, or null past either end. */
export function stepForecastHour(
  hours: readonly WindsAloftHour[],
  fromMs: number,
  delta: number,
): number | null {
  const i = hours.findIndex((h) => h.validMs === fromMs);
  if (i < 0) return null;
  return hours[i + delta]?.validMs ?? null;
}

/** Minutes from `now` to `validMs`, positive ahead, and the same in words:
 *  "1 h 45 min ahead of now", "20 min behind now", "at the current time"
 *  inside a minute. */
export function offsetFromNow(validMs: number, now: number): { minutes: number; text: string } {
  const minutes = Math.round((validMs - now) / 60_000);
  if (minutes === 0) return { minutes, text: 'at the current time' };
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
  return { minutes, text: `${span} ${minutes > 0 ? 'ahead of' : 'behind'} now` };
}

/** Where the valid-time mark sits on the card's timeline bar, as a percent
 *  of its width, with now at the middle and `spanMin` either side to the
 *  edges. An hour beyond the span pins to the edge and says which, so the
 *  bar never draws a far hour as a near one. */
export function offsetBarPosition(
  minutes: number,
  spanMin = 180,
): { markPct: number; beyond: 'before' | 'after' | null } {
  const raw = 50 + (minutes / spanMin) * 50;
  if (raw < 0) return { markPct: 0, beyond: 'before' };
  if (raw > 100) return { markPct: 100, beyond: 'after' };
  return { markPct: Math.round(raw * 10) / 10, beyond: null };
}

/**
 * What to remember after stepping `delta` hours from `fromMs`: the hour
 * itself, or null to go back to following the clock when the step lands on
 * the hour nearest `now`, so "−1 h" after "+1 h" leaves the card where it
 * started rather than pinned to an hour the clock will leave behind.
 * `undefined` when there is no hour that way.
 */
export function selectionAfterStep(
  hours: readonly WindsAloftHour[],
  fromMs: number,
  delta: number,
  now: number,
): number | null | undefined {
  const next = stepForecastHour(hours, fromMs, delta);
  if (next == null) return undefined;
  const nearest = chooseForecastHour(hours, null, now);
  return nearest != null && next === nearest.validMs ? null : next;
}
