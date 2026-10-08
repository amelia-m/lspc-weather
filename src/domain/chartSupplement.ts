/**
 * Which edition of the FAA Chart Supplement is current, so the Pilots tab's
 * link can open an airport's entry rather than the empty search form.
 *
 * FAA's search takes the edition as `cycle` and redirects to the empty form
 * without one (both read 2026-10-08). Editions run 56 days and take effect
 * at 0901Z; the form offered "2609" for Sep 03 to Oct 29, 2026. The number
 * is taken to be the AIRAC cycle of the edition's first day: two-digit
 * year, then that cycle's place in the year, counting the 28-day AIRAC
 * cycles from the first of that year (AIRAC 2601 took effect 2026-01-22, so
 * Sep 03 is the ninth). That is an inference, not something FAA states: the
 * same office's procedures search numbers its 28-day cycles that way (2609
 * Sep 03, 2610 Oct 01, read 2026-10-08), but every Chart Supplement edition
 * of 2026 so far also fits two-digit year and month, and the two first
 * differ on 2026-10-29 (AIRAC 2611, month 2610). A wrong number makes the
 * search answer 500, so scripts/pilotLinks.live.ts opens the link in the
 * daily live run and fails it, raising the parity issue, if it does not
 * list the airport.
 *
 * Pure: the time is passed in.
 */

const DAY_MS = 86_400_000;
const AIRAC_MS = 28 * DAY_MS;
const EDITION_MS = 56 * DAY_MS;

/** AIRAC 2601: 2026-01-22. Any AIRAC date works; the cycles are a fixed
 *  28-day grid. */
const AIRAC_REF = Date.UTC(2026, 0, 22, 9, 1);
/** The edition the FAA form showed as current on 2026-10-08: 2609. */
const EDITION_REF = Date.UTC(2026, 8, 3, 9, 1);

/** "2609": the AIRAC number of the cycle in effect at `ms`, any time within
 *  it. Early January, before the year's first cycle, is in the last cycle
 *  of the year before. */
export function airacId(ms: number): string {
  const start = AIRAC_REF + Math.floor((ms - AIRAC_REF) / AIRAC_MS) * AIRAC_MS;
  const year = new Date(start).getUTCFullYear();
  const firstOfYear = AIRAC_REF + Math.ceil((Date.UTC(year, 0, 1) - AIRAC_REF) / AIRAC_MS) * AIRAC_MS;
  const n = Math.round((start - firstOfYear) / AIRAC_MS) + 1;
  return `${String(year % 100).padStart(2, '0')}${String(n).padStart(2, '0')}`;
}

/** The Chart Supplement edition in effect at `now`. */
export function chartSupplementCycle(now: number): { id: string; effectiveMs: number } {
  const effectiveMs = EDITION_REF + Math.floor((now - EDITION_REF) / EDITION_MS) * EDITION_MS;
  return { id: airacId(effectiveMs), effectiveMs };
}
