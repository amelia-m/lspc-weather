import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HourlyChart, HourlyLegend } from '../src/components/common/HourlyChart';
import { sunTimes } from '../src/domain/sun';
import { SITE } from '../src/config/site';
import type { HourlyPoint } from '../src/domain/types';

/* The night shade must sit exactly between the drop zone's sunset and
 * sunrise on the chart's own time axis, and nowhere on a daytime chart. */
describe('HourlyChart night shading', () => {
  const hours = (fromIso: string, n: number): HourlyPoint[] =>
    Array.from({ length: n }, (_, i) => ({
      time: Date.parse(fromIso) + i * 3_600_000,
      windSpeedKt: 8,
      windGustKt: 12,
      precipProbPct: 0,
    })) as unknown as HourlyPoint[];
  const render = (points: HourlyPoint[]): string =>
    renderToStaticMarkup(createElement(HourlyChart, { points, unit: 'kt' }));
  const rects = (html: string): { x: number; w: number }[] =>
    [...html.matchAll(/<rect class="hc-night" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].map((m) => ({
      x: Number(m[1]),
      w: Number(m[2]),
    }));

  it('shades sunset to sunrise across an overnight chart', () => {
    // 1 PM CDT on Oct 3 to 1 PM CDT on Oct 4: 25 hourly points.
    const points = hours('2026-10-03T18:00:00Z', 25);
    const r = rects(render(points));
    expect(r).toHaveLength(1);
    // The chart's plot runs from x=26 to x=332 (340 wide, 26 and 8 padding)
    // over 24 hours.
    const xAt = (t: number): number => 26 + ((t - points[0].time) / (24 * 3_600_000)) * 306;
    const sunset = sunTimes(SITE.dz.lat, SITE.dz.lon, new Date('2026-10-03T18:00:00Z')).sunset;
    const sunrise = sunTimes(SITE.dz.lat, SITE.dz.lon, new Date('2026-10-04T18:00:00Z')).sunrise;
    expect(r[0].x).toBeCloseTo(xAt(sunset), 3);
    expect(r[0].x + r[0].w).toBeCloseTo(xAt(sunrise), 3);
    // A line at sunset and at sunrise, where the band's own edge is faint.
    const edges = [...render(points).matchAll(/<line class="hc-night-edge" x1="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(edges).toHaveLength(2);
    expect(edges[0]).toBeCloseTo(xAt(sunset), 3);
    expect(edges[1]).toBeCloseTo(xAt(sunrise), 3);
  });

  it('shades nothing on a chart that is all daytime', () => {
    expect(rects(render(hours('2026-10-03T15:00:00Z', 6)))).toEqual([]);
  });

  it('paints the night band before the gridlines, bars and lines, so they stay on top of it', () => {
    const points = hours('2026-10-03T18:00:00Z', 25).map((p, i) => ({ ...p, precipProbPct: i % 2 ? 40 : 0 }));
    const html = render(points);
    // SVG paints in document order.
    const night = html.indexOf('class="hc-night"');
    expect(night).toBeGreaterThan(-1);
    for (const later of ['class="hc-grid"', 'class="hc-precip"', 'class="hc-gust"', 'class="hc-wind"']) {
      expect(html.indexOf(later)).toBeGreaterThan(night);
    }
  });
});

/* The stylesheet's night shade must be darker than the panel it sits on:
 * a grey band once read lighter than the day around it. A Node render does
 * not apply CSS, so this reads the token itself. */
describe('the night shade', async () => {
  // Read from disk: vitest stubs CSS imports (a `?raw` import of a .css file
  // comes back empty). The specifier is built so the typecheck, which has no
  // Node types for the test files, does not try to resolve it.
  const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync: (p: string, e: string) => string };
  const css = fs.readFileSync(decodeURIComponent(new URL('../src/styles/app.css', import.meta.url).pathname), 'utf8');

  it('is black at half opacity or more, so night reads darker than day', () => {
    const m = /--hc-night:\s*rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/.exec(css);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(0.5);
  });

  it('edges night with solid lines, so they cannot pass for the dashed gust line', () => {
    const edge = /\.hc-night-edge\s*\{([^}]*)\}/.exec(css);
    expect(edge).not.toBeNull();
    expect(edge![1]).not.toMatch(/dasharray/);
    expect(css).toMatch(/\.hc-gust\s*\{[^}]*stroke-dasharray/);
  });

  it('is the one value the band and its legend swatch both use', () => {
    expect(css).toMatch(/\.hc-night\s*\{\s*fill:\s*var\(--hc-night\)/);
    expect(css).toMatch(/\.hc-key-night\s*\{\s*background:\s*var\(--hc-night\)/);
  });
});

describe('the precip shade', async () => {
  const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync: (p: string, e: string) => string };
  const css = fs.readFileSync(decodeURIComponent(new URL('../src/styles/app.css', import.meta.url).pathname), 'utf8');

  it('is a plain rgba, since an unsupported color-mix() fills the bars black', () => {
    expect(css).toMatch(/--hc-precip:\s*rgba\(/);
  });

  it('is the one value the bars and their legend swatch both use', () => {
    expect(css).toMatch(/\.hc-precip\s*\{\s*fill:\s*var\(--hc-precip\)/);
    expect(css).toMatch(/\.hc-key-precip\s*\{\s*background:\s*var\(--hc-precip\)/);
  });
});

describe('HourlyLegend', () => {
  it('keys every mark the chart draws, in the unit shown', () => {
    const html = renderToStaticMarkup(createElement(HourlyLegend, { unit: 'mph' }));
    for (const k of ['hc-key-wind', 'hc-key-gust', 'hc-key-precip', 'hc-key-night']) expect(html).toContain(k);
    expect(html).toContain('gust (mph)');
  });

  it('keeps each swatch in one wrapping unit with its name', () => {
    const html = renderToStaticMarkup(createElement(HourlyLegend, { unit: 'kt' }));
    const items = [...html.matchAll(/<span class="hc-legend-item">(.*?)<\/span>\s*([^<]*)<\/span>/g)];
    expect(items.map((m) => [m[1].match(/hc-key-(\w+)/)?.[1], m[2].trim()])).toEqual([
      ['wind', 'wind'],
      ['gust', 'gust (kt)'],
      ['precip', 'precip chance'],
      ['night', 'sunset to sunrise'],
    ]);
  });
});
