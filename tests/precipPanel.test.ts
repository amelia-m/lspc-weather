import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrecipPanel } from '../src/components/PrecipPanel';
import type { HourlyPoint } from '../src/domain/types';

/* One narrow bar per hour, each with its own figure, and a time under every
 * third. */
describe('PrecipPanel timeline', () => {
  const start = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
  const chances = [0, 60, 10, 5, 5, 5, 0, 0, 0, 20, 30, 0];
  const hourly = chances.map((p, i) => ({ time: start + i * 3_600_000, precipProbPct: p })) as unknown as HourlyPoint[];
  const html = renderToStaticMarkup(createElement(PrecipPanel, { hourly, current: null }));

  it('keeps a bar and a figure for every hour', () => {
    expect([...html.matchAll(/<span class="sky-ceil">([^<]*)<\/span>/g)].map((m) => m[1])).toEqual(chances.map(String));
  });

  it('names every third hour and leaves the two between blank', () => {
    const times = [...html.matchAll(/<span class="sky-time">([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(times).toHaveLength(12);
    times.forEach((t, i) => (i % 3 === 0 ? expect(t).toMatch(/^\d{1,2}(am|pm)$/) : expect(t).toBe('\u00a0')));
  });

  it('draws the narrow timeline', () => {
    expect(html).toContain('class="sky-timeline precip-timeline"');
  });
});
