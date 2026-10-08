import { afterEach, describe, expect, it, vi } from 'vitest';
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

/* The 6-hour figures cover the hours that overlap the next six: the one in
 * progress and those starting before now + 6 h. */
describe('PrecipPanel, max next 6 h', () => {
  afterEach(() => vi.useRealTimers());
  const H = 3_600_000;
  const NOW = Date.parse('2026-10-08T15:00:00Z');
  const figure = (offsets: number[]): string => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    // Hours from 09Z to 21Z; 70% only at the given offsets from NOW, in hours.
    const hourly = Array.from({ length: 13 }, (_, i) => {
      const time = NOW + (i - 6) * H;
      return { time, precipProbPct: offsets.includes(i - 6) ? 70 : 0 };
    }) as unknown as HourlyPoint[];
    const html = renderToStaticMarkup(createElement(PrecipPanel, { hourly, current: null }));
    return /Precip · max next 6 h<\/span><span class="ceil-value">(\d+)%/.exec(html)![1];
  };

  it('counts the hour in progress and the last that starts inside the window', () => {
    expect(figure([0])).toBe('70');
    expect(figure([5])).toBe('70');
  });

  it('leaves out an hour already ended and one that starts at the window’s end', () => {
    expect(figure([-1])).toBe('0');
    expect(figure([6])).toBe('0');
  });
});
