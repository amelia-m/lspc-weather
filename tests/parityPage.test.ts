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
  { kind: 'usairnet', at: '2026-09-24T01:00:05Z', sameReport: true, fields: [{ name: 'clouds', same: true }, { name: 'dew point °F', same: false, delta: -1 }] },
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
    expect((html.match(/<th>avg diff<\/th>/g) ?? []).length).toBe(3); // two winds tables + usairnet
    expect((html.match(/<th>min diff<\/th>/g) ?? []).length).toBe(3);
    expect((html.match(/<th>max diff<\/th>/g) ?? []).length).toBe(3);
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

  it('leaves the breakdown out of a summary written before it existed', () => {
    const old = { ...summary, schulze: { ...summary.schulze, byTimeGap: undefined } };
    const html = render('ready', old);
    expect(html).not.toContain('Time the tables represent');
    expect(html).toContain('Direction, ft AGL');
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
