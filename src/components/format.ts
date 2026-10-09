import { SITE } from '../config/site';

/** "10pm": the hour alone, as the hourly chart's axis and the precip
 *  card's blocks print it, where "10:00 PM" would wrap on a phone. */
export const fmtShortHour = (ms: number): string =>
  new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: SITE.timeZone }).replace(' ', '').toLowerCase();

/** "Fri": the weekday alone, at the drop zone, for the hourly chart's axis
 *  when it spans days. */
export const fmtWeekday = (ms: number): string =>
  new Date(ms).toLocaleDateString('en-US', { weekday: 'short', timeZone: SITE.timeZone });

/** The hour of the day at the drop zone, 0 to 23. */
export const localHour = (ms: number): number =>
  Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: SITE.timeZone }).format(ms));

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
