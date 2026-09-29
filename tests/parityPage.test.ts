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
