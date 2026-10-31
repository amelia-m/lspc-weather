import { SITE } from '../config/site';
import type { CurrentConditions } from '../domain/types';
import { compass, fmtSpeed, type SpeedUnit } from '../domain/units';
import { shortHour } from '../domain/localClock';
import { round } from '../domain/units';

/** "10pm": the hour alone, as the hourly chart's axis and the precip
 *  card's blocks print it, where "10:00 PM" would wrap on a phone. */
export const fmtShortHour = (ms: number): string => shortHour(ms, SITE.timeZone);

/** A report's surface wind in words, one wording for every card that prints
 *  it (Current conditions, Winds aloft): "SSW (200°) 12 kt, gusting 22 kt",
 *  "Calm", "— (not reported)". A direction of null is "variable" only when
 *  the report says VRB; a direction the feed dropped (IEM's drct missing,
 *  NWS's failing QC) is "direction not reported", since a one-word label
 *  asserts as much as a sentence and the report did not say variable. */
export function describeWind(c: CurrentConditions, unit: SpeedUnit): string {
  const { directionDeg, speedKt, gustKt } = c.wind;
  if (speedKt == null) return '— (not reported)';
  if (speedKt === 0) return 'Calm';
  const dir =
    directionDeg != null
      ? `${compass(directionDeg)} (${directionDeg}°)`
      : /\bVRB\d/.test(c.raw)
        ? 'variable'
        : 'direction not reported';
  const g = gustKt != null ? `, gusting ${fmtSpeed(gustKt, unit)}` : '';
  return `${dir} ${fmtSpeed(speedKt, unit)}${g}`;
}

/** "Fri": the weekday alone, at the drop zone, for the hourly chart's axis
 *  when it spans days. */
export const fmtWeekday = (ms: number): string =>
  new Date(ms).toLocaleDateString('en-US', { weekday: 'short', timeZone: SITE.timeZone });

const LOCAL_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: SITE.timeZone });

/** The calendar date at the drop zone, "2026-10-09", to group hours by day.
 *  One formatter for every call: the chart asks once per point. */
export const localDateKey = (ms: number): string => LOCAL_DATE.format(ms);

export const fmtTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: SITE.timeZone,
  });

export const fmtClock = (ms: number): string =>
  new Date(ms).toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: SITE.timeZone,
  });

/** "Sun, Oct 11, 11:00 AM": the date as well, for a time that can be days
 *  back, where a weekday alone could name the wrong week. */
export const fmtDateClock = (ms: number): string =>
  new Date(ms).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: SITE.timeZone,
  });

export const fmtAgo = (ms: number | null): string => {
  if (ms == null) return '—';
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h === 1 ? '1 hr ago' : `${h} hr ago`;
};

/** An error message for a one-line status: each URL cut to its host. The
 *  fetch errors quote the whole request URL, and Open-Meteo's runs to a
 *  thousand characters, which filled a phone screen on Data health. The
 *  host says which service failed; the full text stays in the source log
 *  and the row's tooltip. */
export const shortError = (msg: string): string => msg.replace(/https?:\/\/([^/\s?#]+)[^\s;)]*/g, '$1');

/** UTC "1800Z". Mark Schulze's Winds Aloft — the tool jumpers cross-check the
 *  winds table against — labels its forecast in exactly this form, so printing
 *  it verbatim turns the comparison into a character match instead of
 *  arithmetic. */
export function fmtZulu(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}${mm}Z`;
}

/** Label positions (percent along the bar) pushed apart to at least `gap`
 *  and kept inside [lo, hi], in their original order. A tier's two limits
 *  can be one mph apart (the waiver's 10–20 tier: 18 and 19 mph), about 4%
 *  of the bar, and their figures would print over each other. */
export function spreadLabels(xs: readonly number[], gap: number, lo: number, hi: number): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const out = order.map(([x]) => Math.min(hi, Math.max(lo, x)));
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + gap);
  const over = out.length > 0 ? out[out.length - 1] - hi : 0;
  if (over > 0) {
    out[out.length - 1] = hi;
    // Back from the end, moving a label only as far as its neighbour needs.
    for (let i = out.length - 2; i >= 0; i--) out[i] = Math.min(out[i], out[i + 1] - gap);
  }
  const back: number[] = new Array(xs.length);
  order.forEach(([, i], k) => (back[i] = round(Math.max(lo, out[k]), 2)));
  return back;
}
