import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeGridpoint } from '../src/domain/normalize';
import { forecastFlightCategory } from '../src/domain/flightCategory';
import { DayDetail } from '../src/components/DailyForecastPanel';
import { reachChange } from '../src/components/forecastReach';
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
      // Visibility runs two hours longer, a null among its values.
      visibility: {
        uom: 'wmoUnit:m',
        values: [
          { validTime: `${iso(0)}/PT5H`, value: 16093 },
          { validTime: `${iso(5)}/PT1H`, value: null },
          { validTime: `${iso(6)}/PT1H`, value: 16093 },
        ],
      },
      skyCover: { uom: 'wmoUnit:percent', values: [{ validTime: `${iso(0)}/PT10H`, value: 80 }] },
    },
  };
  const hourly = normalizeGridpoint(grid);

  it('marks every hour each element’s validTimes cover, its null values included, and none after', () => {
    expect(hourly).toHaveLength(10);
    expect(hourly.map((h) => h.ceilingForecast)).toEqual([true, true, true, true, true, false, false, false, false, false]);
    expect(hourly.map((h) => h.visibilityForecast)).toEqual([true, true, true, true, true, true, true, false, false, false]);
    expect(hourly[3].ceilingFtAgl).toBeNull(); // no ceiling, forecast
    expect(hourly[6].ceilingFtAgl).toBeNull(); // not forecast
    expect(hourly[5].visibilitySm).toBeNull(); // a null value, inside the visibility forecast
  });
});

describe('forecastFlightCategory', () => {
  const h = (ceilingFtAgl: number | null, ceilingForecast: boolean, visibilitySm: number | null, visibilityForecast = true) => ({
    ceilingFtAgl,
    ceilingForecast,
    visibilitySm,
    visibilityForecast,
  });

  it('reads a null ceiling inside the ceiling forecast as a clear sky, with the visibility', () => {
    expect(forecastFlightCategory(h(null, true, 10))).toBe('VFR');
    expect(forecastFlightCategory(h(2000, true, 10))).toBe('MVFR');
  });

  it('past the ceiling forecast, lets visibility give MVFR or worse but never VFR', () => {
    expect(forecastFlightCategory(h(null, false, 10))).toBeNull();
    expect(forecastFlightCategory(h(null, false, 2))).toBe('IFR');
    expect(forecastFlightCategory(h(null, false, null))).toBeNull();
  });

  it('past the visibility forecast, lets the ceiling give MVFR or worse but never VFR', () => {
    expect(forecastFlightCategory(h(5000, true, null, false))).toBeNull();
    expect(forecastFlightCategory(h(null, true, null, false))).toBeNull();
    expect(forecastFlightCategory(h(2000, true, null, false))).toBe('MVFR');
    // A figure outside its forecast is not read, whatever it holds.
    expect(forecastFlightCategory(h(5000, true, 10, false))).toBeNull();
    expect(forecastFlightCategory(h(null, false, 10, false))).toBeNull();
  });
});

describe('reachChange', () => {
  const r = (ceilingForecast: boolean, visibilityForecast: boolean) => ({ ceilingForecast, visibilityForecast });
  it('names what stops or comes back, and nothing when nothing changes', () => {
    expect(reachChange(null, r(true, true))).toBeNull();
    expect(reachChange(r(true, true), r(true, true))).toBeNull();
    expect(reachChange(null, r(false, false))).toBe('Ceiling and visibility not forecast');
    expect(reachChange(r(true, true), r(false, true))).toBe('Ceiling not forecast');
    expect(reachChange(r(true, true), r(true, false))).toBe('Visibility not forecast');
    expect(reachChange(r(false, true), r(false, false))).toBe('Ceiling and visibility not forecast');
    expect(reachChange(r(false, false), r(true, true))).toBe('Ceiling and visibility forecast again');
  });
});

const point = (i: number, ceilingForecast: boolean, visibilitySm: number | null): HourlyPoint => ({
  time: start + i * 3_600_000,
  skyCoverPct: 60,
  ceilingFtAgl: null,
  ceilingForecast,
  visibilitySm,
  visibilityForecast: visibilitySm != null,
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
    expect(html).toContain('Ceiling and visibility not forecast from');
  });

  it('marks the first hour when the whole day is past the forecast', () => {
    const html = detail([point(0, false, null), point(1, false, null)]);
    expect(html.match(/class="reach-row"/g)).toHaveLength(1);
    expect(html).toContain('<tbody><tr class="reach-row">');
  });

  it('marks a gap at both ends, and an element that stops alone', () => {
    const gap = detail([point(0, true, 10), point(1, false, null), point(2, true, 10)]);
    expect(gap.match(/class="reach-row"/g)).toHaveLength(2);
    expect(gap).toContain('Ceiling and visibility forecast again from');
    const visOnly = detail([point(0, true, 10), point(1, true, null)]);
    expect(visOnly).toContain('Visibility not forecast from');
  });

  it('adds no row inside the forecast, and folds a key under the table', () => {
    const html = detail([point(0, true, 10), point(1, true, 10)]);
    expect(html).not.toMatch(/reach-row| not forecast</);
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
