/**
 * What the daily live-site check (scripts/liveSite.ts,
 * .github/workflows/live-site.yml) counts as a fault on a page it loaded.
 * The browser work is the script's; this is the reading of what it saw, so
 * the line between a fault and a note can be tested without a browser.
 *
 * A fault is something a reader of the deployed site would meet: a script
 * error, a crash screen, a page wider than the phone, a file of the site's
 * own that will not load, or a card whose source the app itself marks as
 * failed or still loading after the check has waited. A note is something
 * that may be the network rather than the site: a console error, or another
 * host's request failing, which the app retries (on 2026-10-17 Open-Meteo's
 * first request failed on most loads from the sandbox and filled on the
 * retry; docs/open-questions.md, "Live-site smoke test").
 */

/** One source on the Data health card, as its list item showed it. */
export interface SourceRow {
  name: string;
  /** The item's state class: `source ok`, `source error` and so on. */
  state: 'ok' | 'stale' | 'error' | 'pending' | 'idle';
  /** The item's right-hand text: "2 min ago", "stale", "error: …". */
  meta: string;
}

/** What one load of one page at one width showed. */
export interface LoadObservation {
  page: string;
  width: number;
  /** Uncaught script errors. */
  pageErrors: string[];
  /** The site's own requests answered 400 or above, or not answered. */
  ownFailures: string[];
  /** Other hosts' requests that failed: notes, since the app retries them. */
  otherFailures: string[];
  /** Console errors: notes, since a retried request logs one too. */
  consoleErrors: string[];
  scrollWidth: number;
  viewportWidth: number;
  /** The error boundary's screen was showing. */
  crashed: boolean;
  /** The Data health card's rows, or null on a page without the card. */
  sources: SourceRow[] | null;
  /** The page's own checks: the radar image drew, the summary loaded. */
  checks: { name: string; ok: boolean; detail?: string }[];
}

export interface LoadVerdict {
  faults: string[];
  notes: string[];
}

export function judgeLoad(o: LoadObservation): LoadVerdict {
  const faults: string[] = [];
  const notes: string[] = [];
  for (const e of o.pageErrors) faults.push(`script error: ${e}`);
  if (o.crashed) faults.push('the error screen is showing');
  for (const f of o.ownFailures) faults.push(`site file not served: ${f}`);
  // A pixel of rounding is not a sideways scroll.
  if (o.scrollWidth > o.viewportWidth + 1) {
    faults.push(`scrolls sideways: ${o.scrollWidth} px wide in a ${o.viewportWidth} px viewport`);
  }
  for (const s of o.sources ?? []) {
    if (s.state === 'error') faults.push(`${s.name}: ${s.meta}`);
    else if (s.state === 'pending') faults.push(`${s.name}: still loading when the check stopped waiting`);
    // A stale or idle source can be the station or the forecast office
    // being late, not the site; it is shown, not counted.
    else if (s.state !== 'ok') notes.push(`${s.name}: ${s.meta || s.state}`);
  }
  for (const c of o.checks) if (!c.ok) faults.push(`${c.name}${c.detail ? `: ${c.detail}` : ''}`);
  for (const f of o.otherFailures) notes.push(`other host: ${f}`);
  for (const e of o.consoleErrors) notes.push(`console: ${e}`);
  return { faults, notes };
}

/** A page at a width passes when any of its loads had no fault: the check
 *  loads a failing page once more before counting it, so one dropped
 *  request does not open an issue, and a fault on both loads does. */
export const pagePasses = (verdicts: readonly LoadVerdict[]): boolean => verdicts.some((v) => v.faults.length === 0);
