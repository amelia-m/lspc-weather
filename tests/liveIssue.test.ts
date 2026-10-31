import { describe, expect, it } from 'vitest';
import { failureExcerpt, isTimeoutError, liveIssues, type VitestJsonReport } from '../src/domain/liveIssue';

/* The shape Vitest's JSON reporter wrote on 2026-10-31 (vitest 4), with
 * #238's failure as its message: a TimeoutError from the fetch, colour
 * codes and stack frames included. */
const timeout =
  'TimeoutError: The operation was aborted due to timeout\n' +
  '    at get scripts/skyParity.live.ts:44:15\n' +
  '    at scripts/skyParity.live.ts:183:17\n';
const file = (name: string, tests: { title: string; failed?: string }[], ancestor = 'suite'): VitestJsonReport['testResults'][number] => ({
  name: `/home/runner/work/lspc-weather/lspc-weather/scripts/${name}`,
  status: tests.some((t) => t.failed) ? 'failed' : 'passed',
  assertionResults: tests.map((t) => ({
    title: t.title,
    ancestorTitles: [ancestor],
    status: t.failed ? 'failed' : 'passed',
    failureMessages: t.failed ? [t.failed] : [],
  })),
});
const run = { url: 'https://github.com/amelia-m/lspc-weather/actions/runs/1', date: '2026-10-31' };

describe('liveIssues', () => {
  it('opens one issue per failed check, labelled by it and titled by the failed test', () => {
    const report: VitestJsonReport = {
      testResults: [
        file('simText.live.ts', [{ title: 'USPA SIM 2-1 H, Winds (#1H)' }, { title: 'is still the 2026 SIM' }]),
        file(
          'skyParity.live.ts',
          [
            { title: 'parses the METAR text the way aviationweather.gov decodes it', failed: timeout },
            { title: 'derives the flight category aviationweather.gov derives from the same report' },
          ],
          'sky decode parity for KPMV',
        ),
        file('pilotLinks.live.ts', [{ title: 'opens Plattsmouth in the current Chart Supplement edition', failed: '\u001b[31mAssertionError\u001b[39m: expected 500 to be 200\n\n- Expected\n+ Received\n\n- 200\n+ 500\n    at scripts/pilotLinks.live.ts:31:24\n' }], 'the Pilots tab links'),
        file('schulzeCompare.live.ts', [{ title: 'prints the profiles' }]),
      ],
    };
    const issues = liveIssues(report, run);
    expect(issues.map((i) => i.label)).toEqual(['sky-parity', 'pilot-links']);
    const [sky, pilot] = issues;
    expect(sky.title).toBe('Sky decode parity: parses the METAR text the way aviationweather.gov decodes it');
    expect(sky.body).toContain(`failed on 2026-10-31. Run: ${run.url}`);
    expect(sky.body).toContain('### sky decode parity for KPMV › parses the METAR text the way aviationweather.gov decodes it');
    expect(sky.body).toContain('```\nTimeoutError: The operation was aborted due to timeout\n```');
    expect(sky.body).not.toContain('    at ');
    expect(sky.body).toContain('A fetch timed out, after the one retry');
    expect(sky.body).toContain('#147 and #238');
    // What the label means, for `gh label create`.
    expect(sky.description).toMatch(/aviationweather\.gov/);
    expect(pilot.title).toBe('Pilots tab links: opens Plattsmouth in the current Chart Supplement edition');
    expect(pilot.body).toContain('src/domain/chartSupplement.ts');
    // Colour codes stripped, the diff kept, no timeout note.
    expect(pilot.body).toContain('AssertionError: expected 500 to be 200');
    expect(pilot.body).not.toContain('\u001b[');
    expect(pilot.body).not.toContain('timed out');
    expect(pilot.body).not.toContain('The log says which');
  });

  it('counts further failures in the title and lists each in the body', () => {
    const report: VitestJsonReport = {
      testResults: [
        file('simText.live.ts', [
          { title: 'USPA SIM 2-1 H, Winds (#1H)', failed: 'Error: 2-1#1H: text changed since 2026-10-08' },
          { title: 'USPA SIM 2-2 B (#2B)', failed: 'Error: 2-2#2B: anchor gone' },
          { title: 'is still the 2026 SIM' },
        ]),
      ],
    };
    const [sim] = liveIssues(report, run);
    expect(sim.label).toBe('sim-text');
    expect(sim.title).toBe('SIM text: USPA SIM 2-1 H, Winds (#1H) (and 1 more)');
    expect(sim.body).toContain('### suite › USPA SIM 2-1 H, Winds (#1H)');
    expect(sim.body).toContain('### suite › USPA SIM 2-2 B (#2B)');
    expect(sim.body).toContain('update src/config/readingLog.ts');
  });

  it('reports a file that did not run, and an unknown file, under their own headings', () => {
    const report: VitestJsonReport = {
      testResults: [
        { name: '/x/scripts/simText.live.ts', status: 'failed', message: 'Error: Cannot find module ./liveFetch', assertionResults: [] },
        file('newCheck.live.ts', [{ title: 'does a thing', failed: 'Error: no' }]),
      ],
    };
    const issues = liveIssues(report, run);
    expect(issues.map((i) => i.label)).toEqual(['sim-text', 'live-checks']);
    expect(issues[0].title).toBe('SIM text: simText.live.ts did not run');
    expect(issues[0].body).toContain('Cannot find module ./liveFetch');
    expect(issues[1].title).toBe('Live checks: does a thing');
  });

  it('opens one issue when Vitest failed the run with every test passed', () => {
    const report: VitestJsonReport = { success: false, testResults: [file('skyParity.live.ts', [{ title: 'ok' }])] };
    const [only] = liveIssues(report, run);
    expect(only.label).toBe('live-checks');
    expect(only.title).toBe('Live checks: the run failed with no test failed');
    expect(only.body).toContain(run.url);
    // And not when a test did fail: that issue says it.
    expect(liveIssues({ success: false, testResults: [file('skyParity.live.ts', [{ title: 'x', failed: 'Error: y' }])] }, run).map((i) => i.label)).toEqual(['sky-parity']);
  });

  it('opens one issue when there is no report at all', () => {
    const [only] = liveIssues(null, run);
    expect(only.label).toBe('live-checks');
    expect(only.title).toBe('Live checks: the run failed before the checks started');
    expect(only.body).toContain(run.url);
  });

  it('opens nothing when every check passed', () => {
    expect(liveIssues({ testResults: [file('skyParity.live.ts', [{ title: 'ok' }])] }, run)).toEqual([]);
  });
});

describe('failureExcerpt', () => {
  it('drops stack frames and colour codes, and bounds the text', () => {
    expect(failureExcerpt(timeout)).toBe('TimeoutError: The operation was aborted due to timeout');
    // Only frames go: an indented message line starting with "at" stays.
    expect(failureExcerpt('AssertionError: expected\n  at or above the 3 SM row\n    at file:///x/y.ts:1:2\n    at async run (node:internal:3:4)')).toBe(
      'AssertionError: expected\n  at or above the 3 SM row',
    );
    const long = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    const cut = failureExcerpt(long);
    expect(cut.split('\n')).toHaveLength(13);
    expect(cut.endsWith('…')).toBe(true);
    expect(failureExcerpt('x'.repeat(2000)).length).toBe(1501);
  });
});

describe('isTimeoutError', () => {
  it('recognises AbortSignal.timeout and Vitest’s rendering of it, and nothing else', () => {
    const dom = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    expect(isTimeoutError(dom)).toBe(true);
    expect(isTimeoutError(new Error('TimeoutError: The operation was aborted due to timeout'))).toBe(true);
    expect(isTimeoutError(new Error('fetch failed'))).toBe(false);
    expect(isTimeoutError(new DOMException('aborted', 'AbortError'))).toBe(false);
    expect(isTimeoutError('timeout')).toBe(false);
  });
});
