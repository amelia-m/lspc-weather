import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HourlyChart, HourlyLegend } from '../src/components/common/HourlyChart';
import { sunTimes } from '../src/domain/sun';
import { SITE } from '../src/config/site';
import { resolveThresholds, withOverrides } from '../src/config/thresholds';
import type { HourlyPoint } from '../src/domain/types';
import { withoutGlossaryLinks } from './support/glossaryLinks';

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

/* A sun over each day span the chart shows and a moon over each night, at
 * the middle of the visible part, in the margin above the plot. */
describe('HourlyChart sun and moon', () => {
  const hours = (fromIso: string, n: number): HourlyPoint[] =>
    Array.from({ length: n }, (_, i) => ({
      time: Date.parse(fromIso) + i * 3_600_000,
      windSpeedKt: 8,
      windGustKt: 12,
      precipProbPct: 0,
    })) as unknown as HourlyPoint[];
  const icons = (points: HourlyPoint[]): { kind: string; x: number; y: number }[] =>
    [
      ...renderToStaticMarkup(createElement(HourlyChart, { points, unit: 'kt' })).matchAll(
        /<g class="hc-(sun|moon)" transform="translate\(([\d.]+) ([\d.]+)\)"/g,
      ),
    ].map((m) => ({ kind: m[1], x: Number(m[2]), y: Number(m[3]) }));
  const xAt = (points: HourlyPoint[], t: number): number =>
    26 + ((t - points[0].time) / (points[points.length - 1].time - points[0].time)) * 306;

  it('centres a moon on the night and a sun on each day either side', () => {
    // 1 PM CDT on Oct 3 to 1 PM CDT on Oct 4.
    const points = hours('2026-10-03T18:00:00Z', 25);
    const sunset = sunTimes(SITE.dz.lat, SITE.dz.lon, new Date('2026-10-03T18:00:00Z')).sunset;
    const sunrise = sunTimes(SITE.dz.lat, SITE.dz.lon, new Date('2026-10-04T18:00:00Z')).sunrise;
    const got = icons(points);
    expect(got.map((i) => i.kind)).toEqual(['sun', 'moon', 'sun']);
    expect(got[0].x).toBeCloseTo((xAt(points, points[0].time) + xAt(points, sunset)) / 2, 0);
    expect(got[1].x).toBeCloseTo((xAt(points, sunset) + xAt(points, sunrise)) / 2, 0);
    expect(got[2].x).toBeCloseTo((xAt(points, sunrise) + xAt(points, points[24].time)) / 2, 0);
  });

  it('sits above the plot, where no line or bar reaches', () => {
    const html = renderToStaticMarkup(createElement(HourlyChart, { points: hours('2026-10-03T18:00:00Z', 25), unit: 'kt' }));
    // The top gridline is the plot's top edge; the max-speed line can reach it.
    const plotTop = Math.min(...[...html.matchAll(/<line class="hc-grid" x1="[\d.]+" y1="([\d.]+)"/g)].map((m) => Number(m[1])));
    for (const i of icons(hours('2026-10-03T18:00:00Z', 25))) {
      // The sun's rays reach 8.5 from its centre, the moon 5.5.
      expect(i.y + 8.5).toBeLessThan(plotTop);
    }
  });

  it('labels the visible part of a night that runs off the edge', () => {
    // 8 PM CDT to 2 AM CDT: night throughout, so one moon in the middle.
    const points = hours('2026-10-04T01:00:00Z', 7);
    const got = icons(points);
    expect(got.map((i) => i.kind)).toEqual(['moon']);
    expect(got[0].x).toBeCloseTo(26 + 306 / 2, 0);
  });

  it('leaves a span too narrow for a glyph unlabelled', () => {
    // Six hours ending ten minutes after sunset: those ten minutes of night
    // are about 8.5 units wide, too narrow for a moon; the day gets its sun.
    const sunset = sunTimes(SITE.dz.lat, SITE.dz.lon, new Date('2026-10-03T18:00:00Z')).sunset;
    const from = sunset - 6 * 3_600_000 + 10 * 60_000;
    const points = Array.from({ length: 7 }, (_, i) => ({
      time: from + i * 3_600_000,
      windSpeedKt: 8,
      windGustKt: 12,
      precipProbPct: 0,
    })) as unknown as HourlyPoint[];
    expect(icons(points).map((i) => i.kind)).toEqual(['sun']);
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

/* A student profile's published limits as reference lines; none for
 * Licensed, which has no published limit to draw. */
describe('HourlyChart limit lines', () => {
  const points = Array.from({ length: 7 }, (_, i) => ({
    time: Date.parse('2026-10-03T15:00:00Z') + i * 3_600_000,
    windSpeedKt: 5,
    windGustKt: 8,
    precipProbPct: 0,
  })) as unknown as HourlyPoint[];
  const chart = (id: Parameters<typeof resolveThresholds>[0], unit: 'kt' | 'mph' = 'mph'): string =>
    renderToStaticMarkup(createElement(HourlyChart, { points, unit, limits: resolveThresholds(id) }));
  const legend = (t: ReturnType<typeof resolveThresholds>): string =>
    renderToStaticMarkup(createElement(HourlyLegend, { unit: 'mph', limits: t, profile: 'P' }));

  const text = (html: string): string => html.replace(/<!-- -->/g, '');

  it('draws the BSR student maximum and no gust ceiling, its figure in the legend', () => {
    const html = chart('student');
    expect(html).toContain('class="hc-limit hc-limit-wind"');
    expect(html).not.toContain('hc-limit-gust');
    expect(text(legend(resolveThresholds('student')))).toContain('wind limit 14 mph');
  });

  it('draws a waiver tier’s wind limit and its gust ceiling, the figures as posted in the legend', () => {
    expect(chart('waiver:0-5')).toContain('hc-limit-gust');
    const key = text(legend(resolveThresholds('waiver:0-5')));
    expect(key).toContain('wind limit 15 mph');
    expect(key).toContain('gust ceiling 16 mph');
  });

  it('prints no figure on the plot itself', () => {
    expect(chart('waiver:0-5')).not.toMatch(/<text[^>]*>[^<]*(limit|ceiling)/);
  });

  it('places the line at the limit on the speed axis', () => {
    const html = chart('student', 'kt');
    const y = Number(/<g class="hc-limit hc-limit-wind"><line x1="[\d.]+" y1="([\d.]+)"/.exec(html)![1]);
    // 12 kt on a 0–20 kt axis: the plot runs from y=24 to y=136.
    expect(y).toBeCloseTo(24 + (1 - 12 / 20) * 112, 3);
  });

  it('stretches the axis to show a limit above the forecast and the 20 floor', () => {
    // Only an edit can put one there: the highest posted figure is 20 mph.
    const t = withOverrides(resolveThresholds('student'), { windCautionKt: 28 });
    const html = renderToStaticMarkup(createElement(HourlyChart, { points, unit: 'kt', limits: t }));
    const y = Number(/<g class="hc-limit hc-limit-wind"><line x1="[\d.]+" y1="([\d.]+)"/.exec(html)![1]);
    expect(y).toBeGreaterThanOrEqual(24);
  });

  it('draws nothing on the Licensed profile, or with no profile given', () => {
    expect(chart('licensed')).not.toContain('hc-limit');
    expect(renderToStaticMarkup(createElement(HourlyChart, { points, unit: 'kt' }))).not.toContain('hc-limit');
  });

  it('names the lines and their source in the legend, or says a figure was edited', () => {
    const html = legend(resolveThresholds('waiver:0-5'));
    expect(html).toContain('hc-key-limit-wind');
    expect(html).toContain('hc-key-limit-gust');
    expect(html).toContain('Limit lines: P.');
    expect(html).toContain('LSPC Waivered Wind Limits</a>');
    // An edit names the line it touched; the unedited one keeps its source.
    const edited = legend(withOverrides(resolveThresholds('waiver:0-5'), { gustCautionKt: 20 }));
    expect(edited).toContain('The gust ceiling is edited in Settings, so the source does not set it');
    expect(edited).toContain('LSPC Waivered Wind Limits</a>');
    expect(legend(resolveThresholds('licensed'))).not.toContain('Limit lines');
  });

  it('marks an edited figure beside it in the legend', () => {
    const t = withOverrides(resolveThresholds('waiver:0-5'), { gustCautionKt: 20 });
    const key = text(renderToStaticMarkup(createElement(HourlyLegend, { unit: 'kt', limits: t, profile: 'P' })));
    expect(key).toContain('gust ceiling 20 kt (edited)');
    expect(key).toMatch(/wind limit 13 kt<\/span>/);
  });

  it('names the BSR round-reserve figure the student line is not', () => {
    // The Surface wind card's standing note, carried to the chart: the line
    // is the ram-air figure, and a reader on a round reserve has a lower one.
    expect(text(withoutGlossaryLinks(legend(resolveThresholds('student'))))).toContain(
      'A lower maximum ground wind, 10 mph, is published for solo students on round reserves. The limit line is not it.',
    );
    // A waiver tier has no such caveat (the club's call, A5 on #citations).
    expect(legend(resolveThresholds('waiver:0-5'))).not.toContain('round reserves');
  });

  it('keeps the top limit line below the top gridline', () => {
    // The 21+ tier's gust ceiling is 20 mph, the axis floor.
    const html = renderToStaticMarkup(createElement(HourlyChart, { points, unit: 'mph', limits: resolveThresholds('waiver:21+') }));
    const plotTop = Math.min(...[...html.matchAll(/<line class="hc-grid" x1="[\d.]+" y1="([\d.]+)"/g)].map((m) => Number(m[1])));
    const y = Number(/<g class="hc-limit hc-limit-gust"><line x1="[\d.]+" y1="([\d.]+)"/.exec(html)![1]);
    expect(y - plotTop).toBeGreaterThanOrEqual(4);
  });

  it('stretches the axis over an edited limit at the axis top', () => {
    // 20 kt on what would be a 20 kt axis.
    const t = withOverrides(resolveThresholds('waiver:0-5'), { gustCautionKt: 20 });
    const html = renderToStaticMarkup(createElement(HourlyChart, { points, unit: 'kt', limits: t }));
    const plotTop = Math.min(...[...html.matchAll(/<line class="hc-grid" x1="[\d.]+" y1="([\d.]+)"/g)].map((m) => Number(m[1])));
    const y = Number(/<g class="hc-limit hc-limit-gust"><line x1="[\d.]+" y1="([\d.]+)"/.exec(html)![1]);
    expect(y - plotTop).toBeGreaterThanOrEqual(4);
  });
});

/* Past three days the axis names days, at the drop zone's local noon; up to
 * three days it keeps clock hours. A label every n/6 hours over a week would
 * fall on a different hour each day with nothing to say which day. */
describe('HourlyChart axis over several days', () => {
  const hours = (fromIso: string, n: number): HourlyPoint[] =>
    Array.from({ length: n }, (_, i) => ({
      time: Date.parse(fromIso) + i * 3_600_000,
      windSpeedKt: 8,
      windGustKt: 12,
      precipProbPct: 0,
    })) as unknown as HourlyPoint[];
  const axis = (points: HourlyPoint[]): string[] =>
    [...renderToStaticMarkup(createElement(HourlyChart, { points, unit: 'kt' })).matchAll(
      /<text class="hc-axis" x="[\d.]+" y="148" text-anchor="middle">([^<]+)<\/text>/g,
    )].map((m) => m[1]);

  it('names each day at local noon over seven days', () => {
    // Midnight CDT Fri Oct 9 (05:00Z), 168 hours: noons Fri to Thu.
    expect(axis(hours('2026-10-09T05:00:00Z', 168))).toEqual(['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu']);
  });

  it('leaves out a day whose noon falls at the very edge of the plot', () => {
    // Starting at noon CDT Fri: Friday's noon is the first point, at the edge.
    expect(axis(hours('2026-10-09T17:00:00Z', 120))[0]).toBe('Sat');
  });

  it('keeps clock hours up to three days', () => {
    const labels = axis(hours('2026-10-09T05:00:00Z', 72));
    expect(labels.length).toBeGreaterThan(3);
    for (const l of labels) expect(l).toMatch(/^\d{1,2}(am|pm)$/);
  });
});
