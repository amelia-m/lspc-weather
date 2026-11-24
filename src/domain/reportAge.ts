/**
 * How old a report is, in words, and whether reports have stopped arriving.
 *
 * The cards printed a report's clock time and nothing compared it with now
 * (read 2026-11-24): a flag fired the same on a three-hour-old report as on
 * a fresh one, and Data health's "stale" was the time since the app last
 * fetched, so an old report fetched a minute ago read as fresh. The
 * maintainer, that day: say how old and how limited the data is, plainly.
 *
 * An age is a plain observed fact, so it prints beside every report's time.
 * "Overdue" needs a basis the app does not invent, and has one in the
 * station's own cadence (`reportIntervalMin` in site.ts, measured from the
 * archive): once the newest report is more than two intervals old, the
 * report due one interval after it is itself a whole interval late, so at
 * least one later report has not reached the page. The line states that and
 * no more: no colour, no word on the weather, and the flags still fire on
 * the report the page has, each naming it.
 *
 * Pure: every time is passed in.
 */

const MIN = 60_000;

/** "12 min", "1 h", "1 h 40 min", "3 days": a span to the minute up to two
 *  days, then in days, where the minute no longer says anything. Under a
 *  minute, and a time ahead of the clock (a fast station clock or a slow
 *  reader's), is "under a minute". */
export function ageWords(atMs: number, now: number): string {
  const mins = Math.round((now - atMs) / MIN);
  if (mins < 1) return 'under a minute';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h >= 48) return `${Math.floor(h / 24)} days`;
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "12 min ago", "1 h 40 min ago", "just now". */
export function agoText(atMs: number, now: number): string {
  const words = ageWords(atMs, now);
  return words === 'under a minute' ? 'just now' : `${words} ago`;
}

/** Whether the newest report is more than two of the station's usual
 *  intervals old: at least one later report is due and a whole interval
 *  late (the header says why two). */
export function reportsOverdue(observedAt: number, now: number, intervalMin: number): boolean {
  return now - observedAt > 2 * intervalMin * MIN;
}

/** The line the cards print when reports are overdue, or null. "Here",
 *  because the page knows only what reached it: the station may be silent,
 *  or a feed may be behind it. */
export function overdueReportText(
  station: string,
  observedAt: number,
  now: number,
  intervalMin: number,
): string | null {
  if (!reportsOverdue(observedAt, now, intervalMin)) return null;
  return (
    `${station} usually reports every ${intervalMin} minutes. The newest report here is ` +
    `${ageWords(observedAt, now)} old, so at least one later report has not arrived.`
  );
}
