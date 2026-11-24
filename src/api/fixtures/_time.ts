/** Helpers so sample data is always anchored to "now" — otherwise the hourly
 *  window filters would hide statically-dated fixtures. */

export const hourStartMs = (): number => Math.floor(Date.now() / 3600_000) * 3600_000;

/** ISO string for the current hour start + `offsetH` hours (no milliseconds). */
export const isoHour = (offsetH: number): string =>
  new Date(hourStartMs() + offsetH * 3600_000).toISOString().replace('.000', '');

/** NWS-style "<ISO start>/PT<n>H" interval beginning `offsetH` hours from now. */
export const interval = (offsetH: number, hours: number): string =>
  `${isoHour(offsetH)}/PT${hours}H`;

/** The wall-clock time at `ms` in `timeZone`, as a UTC timestamp of the
 *  same digits, so two of them subtract to the zone's offset. */
const wallClockMs = (ms: number, timeZone: string): number => {
  const p: Record<string, number> = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(ms)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
};

/** The instant local midnight begins on the calendar day `offsetDays` from
 *  today's in `timeZone`, in seconds: what Open-Meteo's daily `time` is
 *  with `timezone` set and `timeformat=unixtime` (06:00Z for a Central
 *  Standard Time day, read in the kept forecasts of 2026-11-10). Anchored
 *  at 12:00 UTC of the UTC day until 2026-11-20, which in the drop zone's
 *  evening is tomorrow's morning: the outlook then showed no "Today" row
 *  once that label went by date. Corrected twice for the zone's offset,
 *  so a day on either side of a clock change still lands on its midnight. */
export const localDayStartSec = (offsetDays: number, timeZone: string): number => {
  const now = Date.now();
  const today = wallClockMs(now, timeZone);
  const wanted = Date.UTC(new Date(today).getUTCFullYear(), new Date(today).getUTCMonth(), new Date(today).getUTCDate() + offsetDays);
  let at = wanted;
  for (let i = 0; i < 2; i++) at = wanted - (wallClockMs(at, timeZone) - at);
  return Math.floor(at / 1000);
};
