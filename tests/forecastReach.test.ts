import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeGridpoint } from '../src/domain/normalize';
import { forecastFlightCategory } from '../src/domain/flightCategory';
import { DayDetail } from '../src/components/DailyForecastPanel';
import { CeilingSkyPanel } from '../src/components/CeilingSkyPanel';
import type { HourlyPoint } from '../src/domain/types';

/* The NWS gridpoint forecasts ceiling and visibility about a day and a half
 * ahead and sky cover and wind about a week. Inside the ceiling forecast a
 * null ceiling is NWS's "no ceiling"; past it, the ceiling is not forecast,
 * and nothing may read the null as a clear sky (docs/ceiling-heights.md,
 * "The hourly table's flight category"). */

const start = Date.parse('2026-10-24T00:00:00Z');
const iso = (h: number): string => new Date(start + h * 3_600_000).toISOString();

describe('normalizeGridpoint: the ceiling forecast’s reach', () => {
  const grid = {
    properties: {
      // A ceiling, then "no ceiling" (null) for three hours, then nothing.
      ceilingHeight: {
        uom: 'wmoUnit:m',
        values: [
          { validTime: `${iso(0)}/PT2H`, value: 900 },
          { validTime: `${iso(2)}/PT3H`, value: null },
        ],
      },
      skyCover: { uom: 'wmoUnit:percent', values: [{ validTime: `${iso(0)}/PT10H`, value: 80 }] },
    },
  };
  const hourly = normalizeGridpoint(grid);

  it('marks every hour its validTimes cover, its null values included, and none after', () => {
    expect(hourly).toHaveLength(10);
    expect(hourly.map((h) => h.ceilingForecast)).toEqual([true, true, true, true, true, false, false, false, false, false]);
    expect(hourly[3].ceilingFtAgl).toBeNull(); // no ceiling, forecast
    expect(hourly[6].ceilingFtAgl).toBeNull(); // not forecast
  });
});

describe('forecastFlightCategory', () => {
  const h = (ceilingFtAgl: number | null, ceilingForecast: boolean, visibilitySm: number | null) => ({
    ceilingFtAgl,
    ceilingForecast,
    visibilitySm,
  });

  it('reads a null ceiling inside the ceiling forecast as a clear sky', () => {
    expect(forecastFlightCategory(h(null, true, 10))).toBe('VFR');
    expect(forecastFlightCategory(h(2000, true, 10))).toBe('MVFR');
  });

  it('past the ceiling forecast, lets visibility give MVFR or worse but never VFR', () => {
    expect(forecastFlightCategory(h(null, false, 10))).toBeNull();
    expect(forecastFlightCategory(h(null, false, 2))).toBe('IFR');
    expect(forecastFlightCategory(h(null, false, null))).toBeNull();
  });
});

const point = (i: number, ceilingForecast: boolean, visibilitySm: number | null): HourlyPoint => ({
  time: start + i * 3_600_000,
  skyCoverPct: 60,
  ceilingFtAgl: null,
  ceilingForecast,
  visibilitySm,
  windSpeedKt: 8,
  windGustKt: 14,
  windDirectionDeg: 180,
  precipProbPct: 10,
  thunderProbPct: 0,
  precipAmountIn: 0,
  tempC: 15,
});
const detail = (points: HourlyPoint[]) =>
  renderToStaticMarkup(
    createElement(DayDetail, {
      dayKey: '2026-10-24',
      points,
      lastCoveredDay: '2026-10-30',
      unit: 'mph',
      tempUnit: 'F',
      onClose: () => undefined,
    }),
  );

describe('the hourly table', () => {
  it('marks the hour the ceiling forecast stops with a row of its own, and labels the dashes after it', () => {
    const html = detail([point(0, true, 10), point(1, true, 10), point(2, false, null), point(3, false, null)]);
    expect(html.match(/class="reach-row"/g)).toHaveLength(1);
    // The row sits after the last forecast hour and before the first not forecast.
    const table = html.slice(0, html.indexOf('</table>'));
    const row = table.indexOf('reach-row');
    expect(table.lastIndexOf('fc-vfr', row)).toBeGreaterThan(-1);
    expect(table.indexOf('fc-vfr', row)).toBe(-1);
    expect(html.match(/ not forecast<\/span>/g)).toHaveLength(2);
    expect(html).not.toContain('reach-note');
  });

  it('says so above the table when the whole day is past the ceiling forecast, with no row', () => {
    const html = detail([point(0, false, null), point(1, false, null)]);
    expect(html).toContain('reach-note');
    expect(html).not.toContain('reach-row');
  });

  it('adds neither inside the forecast, and folds a key under the table', () => {
    const html = detail([point(0, true, 10), point(1, true, 10)]);
    expect(html).not.toMatch(/reach-row|reach-note| not forecast</);
    expect(html).toContain('Key: what the columns mean');
    expect(html).toContain('AIM 7-1-7');
    // Every category the key defines, and no verdict.
    for (const c of ['fc-vfr', 'fc-mvfr', 'fc-ifr', 'fc-lifr']) expect(html).toContain(c);
    expect(html).not.toMatch(/\b(safe|unsafe|jumpable|good to go)\b/i);
  });
});

describe('the Ceiling & sky strip', () => {
  it('says "no" for a forecast hour with no ceiling, and a dash for one the ceiling forecast does not reach', () => {
    const t0 = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
    const hourly = [
      { ...point(0, true, 10), time: t0 },
      { ...point(1, false, null), time: t0 + 3_600_000 },
    ];
    const html = renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly, omClouds: null }));
    expect(html).toMatch(/<span class="sky-ceil" title="No ceiling \(no broken\/overcast layer\)">no/);
    expect(html).toMatch(/<span class="sky-ceil" title="No ceiling forecast for this hour">—/);
  });
});
