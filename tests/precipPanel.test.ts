import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrecipPanel } from '../src/components/PrecipPanel';
import type { HourlyPoint } from '../src/domain/types';

/* The card opens on 3-hour blocks, each the highest hourly chance in it, and
 * shows every hour on request. */
describe('PrecipPanel blocks', () => {
  const start = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
  const chances = [0, 60, 10, 5, 5, 5, 0, 0, 0, 20, 30, 0];
  const hourly = chances.map((p, i) => ({ time: start + i * 3_600_000, precipProbPct: p })) as unknown as HourlyPoint[];
  const labels = (html: string): string[] => [...html.matchAll(/<span class="sky-ceil">([^<]*)<\/span>/g)].map((m) => m[1]);

  it('shows four 3-hour blocks by default, each at its highest hour', () => {
    const html = renderToStaticMarkup(createElement(PrecipPanel, { hourly, current: null }));
    expect(labels(html)).toEqual(['60', '5', '0', '30']);
    expect(html).toContain('the highest hourly chance of precipitation (%) in each 3 hours');
    expect(html).toContain('aria-expanded="false">Show each hour</button>');
  });

  it('shows every hour when expanded', () => {
    const html = renderToStaticMarkup(createElement(PrecipPanel, { hourly, current: null, initialEachHour: true }));
    expect(labels(html)).toEqual(chances.map(String));
    expect(html).toContain('aria-expanded="true">Show 3-hour blocks</button>');
  });
});
