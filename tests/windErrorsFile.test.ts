import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WIND_COLUMNS, type WindErrorsData } from '../src/domain/windErrors';
import { WindErrorsPage } from '../src/components/WindErrorsPage';
import publishedText from '../public/wind-errors/summary.json?raw';

/* The #wind-errors page's published file, as the weekly refresh rebuilds
 * it: its Test step runs these before the file is committed, so a
 * malformed rebuild stops there rather than on the live page. */
const data = JSON.parse(publishedText) as WindErrorsData;

describe('the published #wind-errors file', () => {
  it('holds both sections, each with dates in order and a row per source or lead', () => {
    expect(data.sections.map((s) => s.id)).toEqual(['nws-kept', 'surface-sample']);
    for (const s of data.sections) {
      expect(s.rows.length).toBeGreaterThan(0);
      expect(s.first).not.toBeNull();
      expect(Date.parse(s.first!)).toBeLessThanOrEqual(Date.parse(s.last!));
    }
  });

  it('has every chart on the columns’ axes, its bins and its count adding up', () => {
    for (const s of data.sections) {
      for (const row of s.rows) {
        expect(row.panels.map((p) => p.quantity)).toEqual(WIND_COLUMNS.map((c) => c.quantity));
        for (const p of row.panels) {
          const c = WIND_COLUMNS.find((x) => x.quantity === p.quantity)!;
          expect([p.lo, p.hi, p.bin]).toEqual([c.lo, c.hi, c.bin]);
          expect(p.counts).toHaveLength(Math.round((c.hi - c.lo) / c.bin) + 1);
          expect(p.counts.reduce((a, b) => a + b, 0) + p.outside).toBe(p.n);
          expect(p.n).toBeGreaterThan(0);
        }
      }
    }
  });

  it('draws a chart for every panel on the page', () => {
    const html = renderToStaticMarkup(createElement(WindErrorsPage, { data, state: 'ready' }));
    const panels = data.sections.reduce((n, s) => n + s.rows.length * WIND_COLUMNS.length, 0);
    expect(html.match(/class="werr-svg"/g)).toHaveLength(panels);
  });
});
