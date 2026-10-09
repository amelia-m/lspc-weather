import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HourlyForecastPanel } from '../src/components/HourlyForecastPanel';
import type { HourlyPoint } from '../src/domain/types';

/* The horizon buttons: each longer one only when the forecast reaches past
 * the one before it, so a button never shows nothing new. The NWS gridpoint
 * served 168 hours for the drop zone on 2026-10-09, which fills all five. */
describe('HourlyForecastPanel horizons', () => {
  const ahead = (n: number): HourlyPoint[] => {
    const start = Math.floor(Date.now() / 3_600_000) * 3_600_000;
    return Array.from({ length: n }, (_, i) => ({
      time: start + i * 3_600_000,
      windSpeedKt: 8,
      windGustKt: 12,
      precipProbPct: 0,
    })) as unknown as HourlyPoint[];
  };
  const buttons = (n: number): string[] =>
    [
      ...renderToStaticMarkup(
        createElement(HourlyForecastPanel, { hourly: ahead(n), unit: 'kt', onUnitChange: () => undefined }),
      ).matchAll(/<div class="range-toggle"[^>]*>([\s\S]*?)<\/div>/g),
    ].flatMap((m) => [...m[1].matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((b) => b[1]));

  it('offers 5 and 7 days when the forecast runs a week', () => {
    expect(buttons(168)).toEqual(['18h', '36h', '72h', '5d', '7d']);
  });

  it('offers 7 days only once the forecast reaches past 5', () => {
    expect(buttons(120)).toEqual(['18h', '36h', '72h', '5d']);
    expect(buttons(121)).toEqual(['18h', '36h', '72h', '5d', '7d']);
  });

  it('stops at 72 hours when the forecast does', () => {
    expect(buttons(72)).toEqual(['18h', '36h', '72h']);
  });
});
