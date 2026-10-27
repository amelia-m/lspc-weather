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
import { TAF_RELAY_FAILED } from './sourceProvenance';

/** One source on the Data health card, as its list item showed it. */
export interface SourceRow {
  name: string;
  /** The item's state class: `source ok`, `source error` and so on. */
  state: 'ok' | 'stale' | 'error' | 'pending' | 'idle';
  /** The item's right-hand text: "2 min ago", "stale", "error: …". */
  meta: string;
  /** The provenance chip's text, when the row has one: "fallback KOMA ·
   *  KOFF fetch failed". */
  detail?: string;
  /** The row's `data-flags` (SourceProvenance.flags). */
  flags?: string[];
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
  /** The elements past the viewport's right edge, read only when the page
   *  is wider than it (scripts/liveSiteDom.ts); absent otherwise. */
  overflowing?: OverflowingBox[];
  /** The error boundary's screen was showing. */
  crashed: boolean;
  /** The Data health card's rows, or null on a page without the card. */
  sources: SourceRow[] | null;
  /** The page's own checks: the radar image drew, the summary loaded. */
  checks: { name: string; ok: boolean; detail?: string }[];
}

/** One element past the viewport's edge: its tag, id and classes as a
 *  selector-like path, where its right edge is, how wide it is, and the
 *  index (in the same list) of its nearest ancestor that is also past the
 *  edge, or null. */
export interface OverflowingBox {
  path: string;
  right: number;
  width: number;
  parent: number | null;
}

/** The elements to name for a sideways scroll: the innermost ones past
 *  the edge (an ancestor is past it only because a descendant is), the
 *  farthest out first, at most `max`. Issue #208 gave a width and nothing
 *  to look at; this is what a repeat should give. */
export function overflowReport(boxes: OverflowingBox[], max = 5): string[] {
  const hasChildPast = new Set(boxes.map((b) => b.parent).filter((p): p is number => p != null));
  return boxes
    .map((b, i) => ({ b, i }))
    .filter(({ i }) => !hasChildPast.has(i))
    .sort((x, y) => y.b.right - x.b.right)
    .slice(0, max)
    .map(({ b }) => `${b.path} (right edge ${b.right} px, ${b.width} px wide)`);
}

export interface LoadVerdict {
  faults: string[];
  notes: string[];
}

export interface JudgeOptions {
  /** Whether the TAF relay is set (src/config/tafRelay.ts) and answers the
   *  page's origin. False for a local build on another port, whose requests
   *  the relay refuses by design. */
  relayServesOrigin?: boolean;
}

export function judgeLoad(o: LoadObservation, opts: JudgeOptions = {}): LoadVerdict {
  const faults: string[] = [];
  const notes: string[] = [];
  for (const e of o.pageErrors) faults.push(`script error: ${e}`);
  if (o.crashed) faults.push('the error screen is showing');
  for (const f of o.ownFailures) faults.push(`site file not served: ${f}`);
  // A pixel of rounding is not a sideways scroll.
  if (o.scrollWidth > o.viewportWidth + 1) {
    const past = overflowReport(o.overflowing ?? []);
    faults.push(
      `scrolls sideways: ${o.scrollWidth} px wide in a ${o.viewportWidth} px viewport` +
        (past.length ? `; past the edge: ${past.join('; ')}` : ''),
    );
  }
  for (const s of o.sources ?? []) {
    // The NBM row reads NOAA's bucket through the relay: the bucket failing
    // behind it (the relay's 502, which the app names as the bucket's) is
    // another host's, a note, as aviationweather.gov's is on the TAF row;
    // anything else on the row is the relay's or the site's, a fault.
    if (s.state === 'error' && s.name.startsWith('NBM') && /NBM bucket/.test(s.meta)) notes.push(`${s.name}: ${s.meta}`);
    else if (s.state === 'error') faults.push(`${s.name}: ${s.meta}`);
    else if (s.state === 'pending') faults.push(`${s.name}: still loading when the check stopped waiting`);
    // A stale or idle source can be the station or the forecast office
    // being late, not the site; it is shown, not counted.
    else if (s.state !== 'ok') notes.push(`${s.name}: ${s.meta || s.state}`);
    // The TAF row stays "ok" while the card shows a farther station's TAF,
    // so a failed fetch shows on its chip, and the relay's own failure as a
    // flag beside it (TAF_RELAY_FAILED, set from the chain's record, not
    // read from the chip's words). The relay is the site's own: its failure
    // is a fault, so a broken relay opens an issue rather than waiting to be
    // noticed. aviationweather.gov failing behind it ("upstream failed") and
    // another station's failed fetch are other hosts', notes like a late
    // source. Only on the TAF row, and only when it is otherwise ok, so one
    // failure is not told twice.
    if (s.name.startsWith('TAF') && s.state === 'ok') {
      if (opts.relayServesOrigin && s.flags?.includes(TAF_RELAY_FAILED)) {
        faults.push(`${s.name}: ${s.detail ?? 'relay failed'} (the TAF relay)`);
      } else if (s.detail && /fetch failed|upstream failed/.test(s.detail)) {
        notes.push(`${s.name}: ${s.detail}`);
      }
    }
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
