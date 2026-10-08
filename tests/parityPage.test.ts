import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ParityPage } from '../src/components/ParityPage';
import { summarizeParity, type ParityRecord } from '../src/domain/paritySummary';

const records: ParityRecord[] = [
  {
    kind: 'schulze',
    at: '2026-09-24T01:00:00Z',
    aligned: { rows: [{ ft: 9000, dDir: 12, dSpd: 1, dT: 0 }, { ft: 1000, dDir: 1, dSpd: 0, dT: 0 }] },
    unaligned: { hoursDiffer: true, maxDir: 50 },
    rawMismatch: true,
    ground: { ourKt: 6, theirKt: 12 },
  },
  { kind: 'usairnet', at: '2026-09-24T01:00:05Z', v: 2, sameReport: true, fields: [{ name: 'clouds', same: true }, { name: 'dew point °F', same: false, delta: -1 }] },
];
const summary = summarizeParity(records, Date.parse('2026-09-25T12:00:00Z'));
const render = (state: 'loading' | 'missing' | 'error' | 'ready', s = summary) =>
  renderToStaticMarkup(createElement(ParityPage, { summary: state === 'ready' ? s : null, state }));

describe('ParityPage', () => {
  it('shows the spreads per altitude, the counts, and both comparisons', () => {
    const html = render('ready');
    expect(html).toContain('How different from other sources');
    // altitude rows in ascending order, with the 90th-percentile column present
    expect(html.indexOf('<td>1,000</td>')).toBeLessThan(html.indexOf('<td>9,000</td>'));
    // direction and speed each get a table with the average, smallest and
    // largest gap beside the median and 90th percentile
    expect(html).toContain('Direction, ft AGL');
    expect(html).toContain('Speed, ft AGL');
    // two winds tables + the two usairnet tables
    expect((html.match(/<th>avg diff<\/th>/g) ?? []).length).toBe(4);
    expect((html.match(/<th>min diff<\/th>/g) ?? []).length).toBe(4);
    expect((html.match(/<th>max diff<\/th>/g) ?? []).length).toBe(4);
    expect(html).toContain('<td>12°</td>'); // 9,000 ft direction: one run, so avg = min = max
    expect(html).toContain('1 of 1 (100%)'); // any row over 10°
    expect(html).toContain('Raw profiles disagreed');
    expect(html).toContain('ratio 2');
    expect(html).toContain('<td>clouds</td>');
  });

  it('breaks the winds differences down by the time the two tables represent', () => {
    const html = render('ready');
    const table = /<th>Time the tables represent<\/th>[\s\S]*?<\/table>/.exec(html)?.[0] ?? '';
    // One row per group, same run first; the fixture's run had profiles
    // that disagreed, so its aloft rows (12° and 1°) are in the second row
    // and the first row is empty.
    const rows = table.match(/<tr><td>[^<]*<\/td>(?:<td>[^<]*<\/td>)*<\/tr>/g) ?? [];
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('<td>Same hour, same forecast run</td><td>0</td><td>—</td>');
    expect(rows[1]).toContain('<td>Same hour, one side on a newer run</td><td>1</td><td>6.50°</td>');
    expect(rows[1]).toContain('<td>12°</td>');
    // Logged without rows, so the one-hour-apart group has none yet.
    expect(rows[2]).toContain('<td>One hour apart</td><td>0</td>');
  });

  it('shows same-observation and different-observation runs in separate tables', () => {
    const recs: ParityRecord[] = [
      { kind: 'usairnet', at: '2026-09-27T13:00:00Z', v: 2, sameReport: true, fields: [{ name: 'temperature °F', same: true, delta: 0 }] },
      {
        kind: 'usairnet',
        at: '2026-09-27T13:40:00Z',
        v: 2,
        sameReport: false,
        ourObsAt: '2026-09-27T13:15:00Z',
        obsGapMin: -20,
        nwsNewestAt: '2026-09-27T13:35:00Z',
        fields: [{ name: 'temperature °F', same: false, delta: -3 }],
      },
    ];
    const html = render('ready', summarizeParity(recs, Date.parse('2026-09-27T14:00:00Z')));
    const same = html.indexOf('<caption class="parity-caption">Same observation on both sides</caption>');
    const diff = html.indexOf('<caption class="parity-caption">Different observations, usually one report (20 min) apart</caption>');
    expect(same).toBeGreaterThan(-1);
    expect(diff).toBeGreaterThan(same);
    // The 3 °F gap between two reports sits in the second table only.
    expect(html.slice(same, diff)).not.toContain('<td>3</td>');
    expect(html.slice(diff)).toContain('<td>3</td>');
    // And only that run: one temperature row in each table, not both runs in
    // the second.
    expect(html.slice(same, diff).match(/<tr><td>temperature °F<\/td>/g)).toHaveLength(1);
    expect(html.slice(diff).match(/<tr><td>temperature °F<\/td>/g)).toHaveLength(1);
    expect(html).toContain('usairnet had the newer report in 1 and this dashboard in 0');
    expect(html).toContain('already held the newer report in 1 of 1');
  });

  it('shows the runs since the dashboard read IEM apart from the ones before', () => {
    const run = (at: string, obsGapMin: number, ourSource?: 'iem' | 'nws'): ParityRecord => ({
      kind: 'usairnet',
      at,
      sameReport: false,
      ourObsAt: at,
      obsGapMin,
      nwsNewestAt: at,
      ...(ourSource ? { ourSource } : {}),
      fields: [],
    });
    const html = render(
      'ready',
      summarizeParity(
        [run('2026-09-27T13:40:00Z', -20), run('2026-09-29T13:40:00Z', 20, 'iem'), run('2026-09-29T14:00:00Z', 20, 'iem')],
        Date.parse('2026-09-29T15:00:00Z'),
      ),
    );
    const since = html.indexOf('Since this dashboard reads IEM first');
    const before = html.indexOf('Before, when NWS was its only feed');
    expect(since).toBeGreaterThan(-1);
    expect(before).toBeGreaterThan(since);
    expect(html).toContain('IEM served the dashboard’s report in 2 of 2');
    expect(html.slice(since, before)).toContain('usairnet had the newer report in 0 and this dashboard in 2');
    expect(html.slice(before)).toContain('usairnet had the newer report in 1 and this dashboard in 0');
  });

  it('shows no since-IEM section for a summary with no runs since', () => {
    const html = render('ready');
    expect(html).not.toContain('Since this dashboard reads IEM first');
    expect(html).not.toContain('Before, when NWS was its only feed');
  });

  it('leaves the breakdown out of a summary written before it existed', () => {
    const old = { ...summary, schulze: { ...summary.schulze, byTimeGap: undefined } };
    const html = render('ready', old);
    expect(html).not.toContain('Time the tables represent');
    expect(html).toContain('Direction, ft AGL');
  });

  it('shows how soon each source had each report once samples bracket an arrival, and not before', () => {
    expect(render('ready')).not.toContain('How soon each source had each report');
    const at = (m: number): string => new Date(Date.parse('2026-09-30T13:36:00Z') + m * 60_000).toISOString();
    const recs: ParityRecord[] = [0, 2, 4, 6, 8].map((m) => ({
      kind: 'usairnet',
      at: at(m),
      v: 2,
      ourSource: 'iem',
      iemObsAt: m >= 6 ? '2026-09-30T13:35:00Z' : '2026-09-30T13:15:00Z',
      fields: [],
    }));
    const html = render('ready', summarizeParity(recs, Date.parse('2026-09-30T14:00:00Z')));
    expect(html).toContain('How soon each source had each report');
    // IEM first found the 13:35Z report at 13:42Z.
    expect(html).toContain('<td>IEM (the dashboard reads first)</td><td>1</td><td>7 min</td>');
    expect(html).toContain('<td>usairnet</td><td>0</td><td>—</td>');
  });

  /* The breakdowns added on 2026-10-03, from the questions asked of the
   * logs that day: the headline figures, medians in the time-gap table, the
   * ground rows through the day, the fields grouped with their known causes,
   * and how long usairnet stayed unreadable. */
  describe('the breakdowns', () => {
    const at = (iso: string, m: number): string => new Date(Date.parse(iso) + m * 60_000).toISOString();
    const recs: ParityRecord[] = [
      // Two same-run winds runs at 9 PM CDT (02Z): Schulze's ground row 4 kt over ours.
      ...[0, 4].map(
        (m): ParityRecord => ({
          kind: 'schulze',
          at: at('2026-10-03T01:40:00Z', m),
          appHour: '02Z',
          // Aloft gaps 2, 2, 2 and 8°: average 3.5, median 2, 90th and max 8,
          // so every column of the time-gap row is told apart.
          aligned: {
            rows: [
              { ft: 0, dDir: 30, dSpd: 4, dT: null },
              { ft: 3000, dDir: 2, dSpd: 1, dT: null },
              { ft: 6000, dDir: m === 0 ? 2 : 8, dSpd: 1, dT: null },
            ],
          },
          rawMismatch: false,
          ground: { ourKt: 5, theirKt: 9 },
        }),
      ),
      // Same report: wind speed agrees, dew point differs by 1, clouds agree,
      // temperature agrees (it has a known cause, but nothing to explain).
      ...[0, 2].map(
        (m): ParityRecord => ({
          kind: 'usairnet',
          at: at('2026-10-03T13:00:00Z', m),
          v: 3,
          sameReport: true,
          ourSource: 'iem',
          fields: [
            { name: 'wind mph', same: true, delta: 0 },
            { name: 'dew point °F', same: m === 0, delta: m === 0 ? 0 : -1 },
            { name: 'clouds', same: true },
            { name: 'temperature °F', same: true, delta: 0 },
            { name: 'a field added later', same: true },
          ],
        }),
      ),
      // usairnet unreadable three samples in a row, then once more alone.
      ...[4, 6, 8].map((m): ParityRecord => ({ kind: 'usairnet', at: at('2026-10-03T13:00:00Z', m), error: 'usairnet: page did not parse' })),
      { kind: 'usairnet', at: '2026-10-03T13:10:00Z', v: 3, sameReport: true, ourSource: 'iem', fields: [] },
      { kind: 'usairnet', at: '2026-10-03T15:00:00Z', error: 'usairnet: fetch failed' },
    ];
    const html = render('ready', summarizeParity(recs, Date.parse('2026-10-03T16:00:00Z')));

    it('opens with the headline figures, computed from the summary', () => {
      const glance = html.slice(html.indexOf('At a glance'), html.indexOf('Winds aloft vs Mark Schulze'));
      expect(glance).toContain('2° and 1 kt apart at the median, 8° and 1 kt at the most, over 2 runs');
      expect(glance).toContain('4 of 5 fields agreed on every run; the others differed on some runs: dew point °F by up to 1');
    });

    it('adds the median to the time-gap table', () => {
      expect(html).toContain('<th>median dir</th>');
      expect(html).toContain('<td>Same hour, same forecast run</td><td>2</td><td>3.50°</td><td>2°</td><td>8°</td><td>8°</td>');
    });

    it('breaks the ground rows down by the local time of the forecast hour', () => {
      expect(html).toContain('The two Surface rows are different heights');
      expect(html).toContain('<td>9\u00a0PM–12\u00a0AM</td><td>2</td><td>5 kt</td><td>9 kt</td><td>+4 kt</td>');
      expect(html).toContain('<td>12–3\u00a0AM</td><td>0</td><td>—</td>');
    });

    it('breaks the ground rows down by local day of the forecast hour', () => {
      // 02Z on Oct 3 is 9 PM on Oct 2 at the drop zone.
      expect(html).toContain('By local day of the forecast hour');
      expect(html).toContain('<td>Oct 2</td><td>2</td><td>5 kt</td><td>9 kt</td><td>+4 kt</td>');
    });

    it('groups the fields under headings, the surface wind first, and keeps an unlisted one', () => {
      const same = html.slice(html.indexOf('Same observation on both sides'));
      const wind = same.indexOf('Surface wind</th>');
      expect(wind).toBeGreaterThan(-1);
      expect(same.indexOf('<td>wind mph</td>')).toBeGreaterThan(wind);
      expect(same.indexOf('Temperature and moisture</th>')).toBeGreaterThan(same.indexOf('<td>clouds</td>'));
      expect(same.indexOf('<td>a field added later</td>')).toBeGreaterThan(same.indexOf('Other</th>'));
    });

    it('gives a known cause only for a field that differed', () => {
      const causes = html.slice(html.indexOf('Known reasons a field differs'));
      expect(causes).toContain('<strong>dew point °F</strong> (1 of 2 runs, by up to 1)');
      // Temperature has a known cause but agreed every time: nothing to explain.
      expect(causes.slice(0, causes.indexOf('</ul>'))).not.toContain('temperature °F');
      // A 1 °F gap is what the cause covers, so no caveat.
      expect(causes).not.toContain('not the larger ones here');
    });

    it('says when a gap is larger than its known cause accounts for', () => {
      const late: ParityRecord = {
        kind: 'usairnet',
        at: '2026-10-03T13:00:00Z',
        v: 3,
        sameReport: true,
        fields: [{ name: 'sunset (min past midnight)', same: false, delta: 4 }],
      };
      const page = render('ready', summarizeParity([late], Date.parse('2026-10-03T14:00:00Z')));
      expect(page).toContain('<strong>sunset (min past midnight)</strong> (1 of 1 runs, by up to 4)');
      expect(page).toContain('That accounts for a gap of 1, not the larger ones here.');
    });

    it('says how long usairnet stayed unreadable, apart from the dashboard\'s own feeds', () => {
      expect(html).toContain('usairnet’s page in 4, this dashboard’s feeds in 0');
      expect(html).toContain('the longest ran 4 min');
      expect(html).toContain('(3 samples in a row)');
    });

    it('renders a summary written before the breakdowns without them', () => {
      const old = {
        ...summary,
        schulze: { ...summary.schulze, groundByLocalHour: undefined },
        usairnet: { ...summary.usairnet, outages: undefined, unreadable: 2 },
      };
      const page = render('ready', { ...old, schulze: { ...old.schulze, groundByLocalDay: undefined } });
      expect(page).toContain('The two Surface rows are different heights');
      expect(page).not.toContain('by the local time of the forecast hour');
      expect(page).not.toContain('By local day of the forecast hour');
      expect(page).toContain('2 runs could not read one side.');
    });
  });

  /* The timeline separates a change to the dashboard (it moved how far the
   * dashboard is from the other source) from a change to the comparison (it
   * moved how well that is measured), so an improvement after a comparison
   * fix cannot be read as the dashboard getting better. */
  describe('the timeline of changes', () => {
    const html = render('ready');
    const timeline = html.slice(html.indexOf('Timeline: what changed'), html.indexOf('Context: checks made by hand'));

    it('sits between the live comparisons and the hand-made checks', () => {
      expect(html.indexOf('Timeline: what changed')).toBeGreaterThan(html.indexOf('Latest observation vs usairnet'));
      expect(timeline.length).toBeGreaterThan(0);
    });

    it('labels every entry as a dashboard change, a comparison change or an event, in date order', () => {
      const labels = [...timeline.matchAll(/<strong>(\w{3} \d+) · (\w+)\.<\/strong>/g)];
      expect(labels.length).toBeGreaterThan(5);
      for (const [, , kind] of labels) expect(['Dashboard', 'Comparison', 'Event']).toContain(kind);
      const day = (d: string): number => Date.parse(`${d} 2026 12:00 UTC`);
      const days = labels.map(([, d]) => day(d));
      expect(days).toEqual([...days].sort((a, b) => a - b));
    });

    it('gives the before and after of the changes that moved the figures', () => {
      expect(timeline).toContain('Sep 29 · Dashboard.');
      expect(timeline).toContain('this dashboard had the older one in 11 of 11');
      expect(timeline).toContain('this dashboard had the newer one in 786 of 786');
      expect(timeline).toContain('72 of 120 same-report runs agreeing (to Sep 29) to 576 of 576 (to Oct 2)');
      expect(timeline).toContain('0 of 723 same-report runs, 2 to 4 minutes apart');
    });
  });

  /* The checks made by hand, dated, beside the live figures. They are copied
   * from the write-ups, so the test pins that each is present and dated, and
   * that the panel shows whatever state the summary is in. */
  describe('the context from checks made by hand', () => {
    const html = render('ready');

    it('comes after the live comparisons', () => {
      expect(html.indexOf('Context: checks made by hand')).toBeGreaterThan(
        html.indexOf('Latest observation vs usairnet'),
      );
    });

    it('carries each check, dated', () => {
      expect(html).toContain('How the winds gap grows with the hours between the tables');
      expect(html).toContain('Measured on Sep 26 at 16:19Z');
      expect(html).toContain('<td>6</td><td>676</td><td>47°</td>');
      expect(html).toContain('Which hour each table shows');
      expect(html).toContain('How Schulze’s Surface row was worked out');
      expect(html).toContain('<td>Near Tampa</td><td>89 ft</td><td>6</td>');
      expect(html).toContain('56 of 56 sunrises and sunsets across 2026 (read Oct 3)');
      expect(html).toContain('Why older observation runs are left out of some rows');
      expect(html).toContain('48 runs to Oct 2');
    });

    it('dates every check and links its write-up', () => {
      const panel = html.slice(html.indexOf('Context: checks made by hand'));
      const sections = panel.split('<h4 class="cite-found-head">').slice(1);
      expect(sections.length).toBe(5);
      for (const sec of sections) {
        expect(sec).toMatch(/(Sep|Oct) \d+/);
        expect(sec).toContain('href="https://github.com/amelia-m/lspc-weather/blob/main/');
      }
    });

    it('does not call the unexplained run a misreading', () => {
      expect(html).toContain('All but one turned out to be the');
      expect(html).toContain('It is not a known misreading and nothing was fixed');
    });

    it('links each write-up in the repository', () => {
      expect(html).toContain('href="https://github.com/amelia-m/lspc-weather/blob/main/docs/markschulze-altitude-reference.md"');
      expect(html).toContain('href="https://github.com/amelia-m/lspc-weather/blob/main/docs/source-parity.md"');
    });

    it('is not shown without a summary', () => {
      expect(render('missing')).not.toContain('Context: checks made by hand');
    });
  });

  it('never grades: no verdict words, no warning classes', () => {
    const html = render('ready');
    for (const word of ['good', 'bad', 'acceptable', 'unsafe', 'safe', 'ok']) {
      expect(html.toLowerCase().split(/[^a-z]+/)).not.toContain(word);
    }
    expect(html).not.toMatch(/class="[^"]*(caution|watch|warn)/);
  });

  it('says plainly when there is no summary yet', () => {
    expect(render('missing')).toContain('No summary has been published yet');
    expect(render('missing')).not.toContain('aloft-table');
  });
});

describe('ParityPage, the "as Schulze" table', () => {
  it('shows how often the app reproduces his table, once runs have logged it', () => {
    const withHisWay = summarizeParity(
      [
        ...records,
        {
          kind: 'schulze',
          at: '2026-10-08T12:00:00Z',
          aligned: { rows: [{ ft: 1000, dDir: 3, dSpd: 1, dT: 0 }] },
          asSchulze: { rows: [{ ft: 0, dDir: 0, dSpd: 0, dT: 0 }, { ft: 1000, dDir: 0, dSpd: 0, dT: 0 }] },
        } as ParityRecord,
      ],
      Date.parse('2026-10-09T00:00:00Z'),
    );
    const html = render('ready', withHisWay);
    expect(html).toContain('Built as Schulze’s tool builds it');
    expect(html).toContain('within 1° and 1 kt, which is rounding, in 1 of 1 runs');
    expect(html).toContain('Direction, as Schulze');
    expect(html).not.toContain('no rows to compare');
    expect(html).not.toContain('No run has had rows to compare');
    expect(render('ready')).not.toContain('Built as Schulze’s tool builds it');
  });

  it('says how many runs could not build it', () => {
    const s = summarizeParity(
      [
        { kind: 'schulze', at: '2026-10-08T12:00:00Z', asSchulze: { rows: [{ ft: 0, dDir: 0, dSpd: 0, dT: 0 }] } } as ParityRecord,
        { kind: 'schulze', at: '2026-10-08T13:00:00Z', asSchulze: { rows: [] } } as ParityRecord,
      ],
      Date.parse('2026-10-09T00:00:00Z'),
    );
    expect(render('ready', s)).toContain('Another 1 run logged it with no rows to compare and is left out.');
    const none = summarizeParity(
      [{ kind: 'schulze', at: '2026-10-08T13:00:00Z', asSchulze: { rows: [] } } as ParityRecord],
      Date.parse('2026-10-09T00:00:00Z'),
    );
    const html = render('ready', none);
    expect(html).toContain('No run has had rows to compare yet (1 logged it empty).');
    expect(html).not.toContain('Direction, as Schulze');
  });
});

describe('ParityPage, why runs were over', () => {
  it('splits the over-10° and over-3 kt counts by cause', () => {
    const row = (ft: number, dDir: number, dSpd = 0) => ({ ft, dDir, dSpd, dT: 0 });
    const s = summarizeParity(
      [
        // Direction: two Surface-only runs and one aloft on a newer run.
        // Speed: one Surface-only run and none aloft. So the two
        // sentences differ, and each must sit under its own count.
        { kind: 'schulze', at: '2026-10-08T12:00:00Z', aligned: { rows: [row(0, 40, 5), row(1000, 1)] }, rawMismatch: false },
        { kind: 'schulze', at: '2026-10-08T12:30:00Z', aligned: { rows: [row(0, 40), row(1000, 1)] }, rawMismatch: false },
        { kind: 'schulze', at: '2026-10-08T13:00:00Z', aligned: { rows: [row(0, 1), row(6000, 30)] }, rawMismatch: true },
      ] as ParityRecord[],
      Date.parse('2026-10-09T00:00:00Z'),
    );
    const html = render('ready', s).replace(/<!-- -->/g, '');
    const dir = html.slice(html.indexOf('Runs with any row over 10° apart'), html.indexOf('Runs with any row over 3 kt apart'));
    const spd = html.slice(html.indexOf('Runs with any row over 3 kt apart'));
    expect(dir).toContain('3 of 3');
    expect(dir).toContain('Of those, 2 only on the Surface row');
    expect(dir).toContain('1 with a newer forecast run on one side; 0 on the same run, from 1,000');
    expect(spd).toContain('1 of 3');
    expect(spd.slice(0, spd.indexOf('</li>'))).toContain('Of those, 1 only on the Surface row');
    expect(spd.slice(0, spd.indexOf('</li>'))).toContain('0 with a newer forecast run');
    expect(html).not.toContain('could not be judged');
  });
});
