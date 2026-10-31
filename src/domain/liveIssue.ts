/**
 * The issue a failed live check opens, worked from Vitest's JSON report.
 *
 * .github/workflows/sky-parity.yml runs three checks in one job (the
 * decoders, the Pilots tab links, the SIM text) and used to open one issue
 * with one body for any of them: "either the sky parse disagrees, or a link
 * broke, or a SIM part changed, or a fetch failed; the log says which".
 * The maintainer, 2026-10-31: too broad. Splitting the job would cost
 * little in minutes but three runs could each open that body. What the
 * issue lacked was in the run already: Vitest knows which test failed. So
 * the report is read here, one issue per failed check, labelled by it,
 * titled by the failed test, with the failure's own message in the body.
 *
 * Pure: the report, the run's URL and its date come in; the issues come
 * out. scripts/liveIssue.ts reads and writes the files.
 */

/** Vitest's JSON reporter, the parts read here (`--reporter=json`). */
export interface VitestJsonReport {
  success?: boolean;
  testResults: {
    /** The test file's path. */
    name: string;
    status: string;
    /** A file-level error (a failed import, say), when no test ran. */
    message?: string;
    assertionResults: {
      title: string;
      ancestorTitles: string[];
      status: string;
      failureMessages: string[];
    }[];
  }[];
}

export interface LiveIssue {
  label: string;
  /** The label's description on GitHub, created or refreshed by the workflow. */
  description: string;
  title: string;
  body: string;
}

/** The checks the workflow runs, by file, with what a failure of each
 *  means and where to look. A file not here (the comparison reports never
 *  fail; a new check would be added here) falls to `OTHER`. */
const CHECKS: Record<string, { label: string; name: string; description: string; what: string }> = {
  'skyParity.live.ts': {
    label: 'sky-parity',
    name: 'Sky decode parity',
    description: "The app's METAR sky parse, flight category or TAF decode disagreed with aviationweather.gov's, or its fetch failed",
    what:
      "The app's METAR sky parse, its derived flight category or its TAF group decode (src/domain/metar.ts, src/domain/taf.ts) disagrees with aviationweather.gov's decoder on today's report, or the fetch of it failed (scripts/skyParity.live.ts).",
  },
  'pilotLinks.live.ts': {
    label: 'pilot-links',
    name: 'Pilots tab links',
    description: 'A Pilots tab deep link no longer opens what it should',
    what:
      'A Pilots tab deep link no longer opens what it should (src/config/sources.ts; the Chart Supplement edition is inferred in src/domain/chartSupplement.ts; scripts/pilotLinks.live.ts).',
  },
  'simText.live.ts': {
    label: 'sim-text',
    name: 'SIM text',
    description: 'A cited SIM part changed since it was read, a quote is not in its part, or uspa.org names a new edition',
    what:
      'A SIM part the app cites or quotes has changed since it was read, a quote on #citations is not in the part it is tied to, uspa.org names a new SIM edition, or a page could not be fetched (scripts/simText.live.ts). Read the part again and update src/config/readingLog.ts.',
  },
};
const OTHER = {
  label: 'live-checks',
  name: 'Live checks',
  description: 'A live check failed outside the named checks, or the run failed before they started',
  what: 'A live check not listed by name failed (vitest.live.config.ts).',
};

/** Whether an error is a fetch timeout: Node's AbortSignal.timeout rejects
 *  with a DOMException named TimeoutError, and Vitest prints it so. */
export const isTimeoutError = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'TimeoutError' || /aborted due to timeout/i.test(err.message));

const TIMEOUT_TEXT = /TimeoutError|aborted due to timeout/i;

/** Vitest's reporter keeps the console's colour codes in the messages. */
// eslint-disable-next-line no-control-regex -- the escape byte is the point
const stripAnsi = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, '');

/** A stack frame as Vitest prints one: indented "at", a location ending
 *  in :line:column, with or without a closing bracket. Not an indented
 *  message line that happens to start with "at". */
const STACK_FRAME = /^\s+at .*:\d+:\d+\)?$/;

/** The failure's own words: the message's first lines, without the stack
 *  frames Vitest appends, bounded so a dumped page cannot fill the issue. */
export function failureExcerpt(message: string, maxLines = 12, maxChars = 1500): string {
  const lines = stripAnsi(message)
    .split('\n')
    .filter((l) => !STACK_FRAME.test(l))
    .map((l) => l.trimEnd());
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const kept = lines.slice(0, maxLines);
  let text = kept.join('\n');
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}…`;
  else if (lines.length > maxLines) text += '\n…';
  return text;
}

const basename = (path: string): string => path.split('/').pop() ?? path;

/** The issues to open or comment on for a run: one per check that failed.
 *  A null report is a run that failed before the checks started (a failed
 *  checkout or install), which still has to open an issue. */
export function liveIssues(report: VitestJsonReport | null, run: { url: string; date: string }): LiveIssue[] {
  if (report == null) {
    return [
      {
        ...OTHER,
        title: 'Live checks: the run failed before the checks started',
        body: `The daily live checks failed on ${run.date} before any check ran: no report was written. Run: ${run.url}\n\nSee the run for the setup error (checkout, install, or the runner).`,
      },
    ];
  }
  const out: LiveIssue[] = [];
  for (const file of report.testResults) {
    const failed = file.assertionResults.filter((a) => a.status === 'failed');
    if (failed.length === 0 && file.status !== 'failed') continue;
    const check = CHECKS[basename(file.name)] ?? OTHER;
    const failures =
      failed.length > 0
        ? failed.map((a) => ({
            heading: [...a.ancestorTitles, a.title].join(' › '),
            message: a.failureMessages[0] ?? '(no message)',
          }))
        : [{ heading: `${basename(file.name)} did not run`, message: file.message || '(no message)' }];
    const first = failed[0]?.title ?? `${basename(file.name)} did not run`;
    const more = failures.length > 1 ? ` (and ${failures.length - 1} more)` : '';
    const timedOut = failures.some((f) => TIMEOUT_TEXT.test(f.message));
    const body = [
      `The daily live check "${check.name}" failed on ${run.date}. Run: ${run.url}`,
      '',
      check.what,
      '',
      ...failures.flatMap((f) => [`### ${f.heading}`, '', '```', failureExcerpt(f.message), '```', '']),
      ...(timedOut
        ? [
            'A fetch timed out, after the one retry the check makes on a timeout (scripts/liveFetch.ts). #147 and #238 were one timeout each, and the next day’s run passed; if this one does too, close this as not planned.',
            '',
          ]
        : []),
    ].join('\n');
    out.push({ label: check.label, description: check.description, title: `${check.name}: ${first}${more}`, body });
  }
  // A run Vitest calls failed with no test failed: an unhandled error or
  // rejection outside any test. The old step opened an issue on any
  // failure, and so must this.
  if (out.length === 0 && report.success === false) {
    out.push({
      ...OTHER,
      title: 'Live checks: the run failed with no test failed',
      body: `The daily live checks failed on ${run.date} with every test passed: an error outside the tests (an unhandled rejection, say). Run: ${run.url}\n\nThe run's log has it; the report does not.`,
    });
  }
  return out;
}
