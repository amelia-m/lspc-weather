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

/** How far the buttons reach from the hour nearest the clock: two hours
 *  back, to line the table up with Mark Schulze's page or re-read the hour
 *  just gone, and four forward, for the next few loads. Not the whole
 *  two-day forecast: a table for tomorrow afternoon sitting beside today's
 *  surface wind invites reading it as today's. */
export const STEP_BACK_HOURS = 2;
export const STEP_FORWARD_HOURS = 4;

export interface StepWindow {
  back: number;
  forward: number;
}
const DEFAULT_WINDOW: StepWindow = { back: STEP_BACK_HOURS, forward: STEP_FORWARD_HOURS };

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

/** The first and last index the buttons may reach at `now`. */
function reach(hours: readonly WindsAloftHour[], now: number, w: StepWindow): [number, number] {
  const n = nearestIndex(hours, now);
  return [Math.max(0, n - w.back), Math.min(hours.length - 1, n + w.forward)];
}

/** The hour to show: the one the reader stepped to while it is still in the
 *  data and inside the step window, otherwise the hour nearest `now`. A
 *  stepped hour the clock has carried outside the window (two hours back,
 *  an hour later) lets go rather than hold a table the buttons could not
 *  have reached. null with no hours. */
export function chooseForecastHour(
  hours: readonly WindsAloftHour[] | null | undefined,
  selectedMs: number | null,
  now: number,
  w: StepWindow = DEFAULT_WINDOW,
): ChosenHour | null {
  if (!hours || hours.length === 0) return null;
  const [lo, hi] = reach(hours, now, w);
  const found = selectedMs == null ? -1 : hours.findIndex((h) => h.validMs === selectedMs);
  const picked = found >= lo && found <= hi ? found : -1;
  const i = picked >= 0 ? picked : nearestIndex(hours, now);
  return {
    validMs: hours[i].validMs,
    levels: hours[i].levels,
    following: picked < 0,
    canBack: i > lo,
    canForward: i < hi,
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

/** Where now and the valid-time mark sit on the card's timeline bar, as
 *  percents of its width, the bar running `backMin` before now to
 *  `forwardMin` after. The defaults are the step window plus the half hour
 *  the nearest hour can sit either side of the clock, rounded out to whole
 *  hours (three back, five forward), so every hour the buttons reach lands
 *  on the bar. An hour beyond it (the FD fallback's bulletin can be) pins to
 *  the edge and says which, so the bar never draws a far hour as a near one. */
export function offsetBarPosition(
  minutes: number,
  backMin = (STEP_BACK_HOURS + 1) * 60,
  forwardMin = (STEP_FORWARD_HOURS + 1) * 60,
): { nowPct: number; markPct: number; beyond: 'before' | 'after' | null } {
  const r1 = (x: number): number => Math.round(x * 10) / 10;
  const nowPct = r1((backMin / (backMin + forwardMin)) * 100);
  const raw = ((minutes + backMin) / (backMin + forwardMin)) * 100;
  if (raw < 0) return { nowPct, markPct: 0, beyond: 'before' };
  if (raw > 100) return { nowPct, markPct: 100, beyond: 'after' };
  return { nowPct, markPct: r1(raw), beyond: null };
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
  w: StepWindow = DEFAULT_WINDOW,
): number | null | undefined {
  const next = stepForecastHour(hours, fromMs, delta);
  if (next == null) return undefined;
  const [lo, hi] = reach(hours, now, w);
  const i = hours.findIndex((h) => h.validMs === next);
  if (i < lo || i > hi) return undefined;
  return i === nearestIndex(hours, now) ? null : next;
}
