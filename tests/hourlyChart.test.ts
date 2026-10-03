import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HourlyChart } from '../src/components/common/HourlyChart';
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
  });

  it('shades nothing on a chart that is all daytime', () => {
    expect(rects(render(hours('2026-10-03T15:00:00Z', 6)))).toEqual([]);
  });
});
