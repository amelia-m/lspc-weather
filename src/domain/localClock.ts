/**
 * Turn a bare local clock time ("8:15 AM") into an instant.
 *
 * usairnet stamps its observation "as of 8:15 AM CDST": a wall-clock time in
 * the station's zone with no date. To say which of two sources had the newer
 * report, and by how many minutes, that time has to become an instant, and
 * the date it belongs to is the one that puts it nearest a reference instant
 * (the dashboard's own observation time, never more than a few report cycles
 * away). Resolving against the reference rather than "today" is what keeps a
 * 11:55 PM report read at 12:05 AM on the right day.
 *
 * Pure: the zone's offset comes from Intl for the instant in question, so a
 * daylight-saving change is handled without a table, and nothing reads the
 * clock.
 */

/** Minutes the zone is ahead of UTC at `ms` (negative west of Greenwich). */
function zoneOffsetMin(ms: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(ms));
  const get = (t: string): number => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

/** The local calendar date (y, m0, d) at `ms` in `zone`. */
function localDate(ms: number, zone: string): [number, number, number] {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(ms));
  const get = (t: string): number => Number(parts.find((p) => p.type === t)!.value);
  return [get('year'), get('month') - 1, get('day')];
}

/**
 * The instant of a "h:mm AM/PM" wall-clock time in `zone`, on whichever of
 * the reference's local day, the day before or the day after is nearest
 * `nearMs`. null when the text is not a clock time.
 */
export function resolveLocalClock(clock: string, nearMs: number, zone: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(clock.trim());
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') hour += 12;
  const minute = Number(m[2]);
  const [y, mo, d] = localDate(nearMs, zone);
  let best: number | null = null;
  for (const dd of [d - 1, d, d + 1]) {
    // Wall time read as if UTC, then shifted by the zone's offset at that
    // instant; a second pass settles the rare case where the first guess
    // lands on the other side of a daylight-saving change.
    const wall = Date.UTC(y, mo, dd, hour, minute);
    let ms = wall - zoneOffsetMin(wall, zone) * 60_000;
    ms = wall - zoneOffsetMin(ms, zone) * 60_000;
    if (best == null || Math.abs(ms - nearMs) < Math.abs(best - nearMs)) best = ms;
  }
  return best;
}
