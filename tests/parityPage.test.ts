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
  { kind: 'usairnet', at: '2026-09-24T01:00:05Z', sameReport: true, fields: [{ name: 'clouds', same: true }] },
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
    expect(html).toContain('dir 90th');
    expect(html).toContain('1 of 1 (100%)'); // any row over 10°
    expect(html).toContain('Raw profiles disagreed');
    expect(html).toContain('ratio 2');
    expect(html).toContain('<td>clouds</td>');
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
