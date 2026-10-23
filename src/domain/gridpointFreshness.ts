/**
 * Which of two copies of the NWS gridpoint to show: the one held from an
 * earlier refresh, or the one just fetched (docs/nws-gridpoint-age.md).
 *
 * api.weather.gov serves the gridpoint through edge caches holding copies
 * made at different times, each up to an hour, so one request can answer
 * with an older forecast than the request before it. In 13 days of
 * five-minute samples (2026-10-09 to 10-21), 83 of 3,096 answers carried an
 * `updateTime` older than one already served. Replayed at the app's
 * ten-minute refresh, revalidating each time would have stepped back to an
 * older forecast 13 times in those 13 days; keeping the newer copy stops it.
 */
import type { RawGridpoint } from './normalize';

const updatedAt = (g: RawGridpoint): number => {
  const t = g.properties.updateTime;
  return typeof t === 'string' ? Date.parse(t) : NaN;
};

/** The fetched copy, unless the held one was issued later. A copy whose
 *  `updateTime` cannot be read gives way to the fetched one: an unreadable
 *  time is no reason to keep showing an old forecast. So does a held copy
 *  dated after `nowMs`: a forecast cannot have been made in the future,
 *  and a copy that says so would otherwise win every refresh until the
 *  page reloads. */
export function newerGridpoint(held: RawGridpoint | null, fetched: RawGridpoint, nowMs: number): RawGridpoint {
  if (held == null) return fetched;
  const h = updatedAt(held);
  const f = updatedAt(fetched);
  return Number.isFinite(h) && Number.isFinite(f) && h > f && h <= nowMs ? held : fetched;
}
