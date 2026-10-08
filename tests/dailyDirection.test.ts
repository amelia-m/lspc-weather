import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { aggregateDailyFromHourly, dominantWindDirectionDeg, normalizeOpenMeteoDaily } from '../src/domain/normalize';
import { OPEN_METEO_DAILY_FIXTURE } from '../src/api/fixtures/openMeteoDaily';
import { DailyForecastPanel } from '../src/components/DailyForecastPanel';
import type { HourlyPoint } from '../src/domain/types';

/* The outlook's Dir column: Open-Meteo's `wind_direction_10m_dominant`, which
 * recomputed from its hourlies is the speed-weighted vector mean (matched 7 of
 * 7 days, 2026-10-08), and the same figure worked from the NWS hourlies on
 * the fallback. */
describe('dominantWindDirectionDeg', () => {
  const h = (speedKt: number | null, directionDeg: number | null) => ({ speedKt, directionDeg });

  it('weights each hour by its speed', () => {
    // 10 kt from the north and 2 kt from the east: atan2(2, 10) = 11.3°. An
    // unweighted mean of the two directions would say 45°.
    expect(dominantWindDirectionDeg([h(10, 0), h(2, 90)])).toBe(11);
  });

  it('averages across north rather than through south', () => {
    expect(dominantWindDirectionDeg([h(10, 350), h(10, 10)])).toBe(0);
    expect(dominantWindDirectionDeg([h(10, 340), h(10, 350)])).toBe(345);
  });

  it('is null with nothing to average, or when the hours cancel', () => {
    expect(dominantWindDirectionDeg([])).toBeNull();
    expect(dominantWindDirectionDeg([h(null, 180), h(5, null)])).toBeNull();
    expect(dominantWindDirectionDeg([h(0, 180), h(0, 90)])).toBeNull();
    expect(dominantWindDirectionDeg([h(10, 0), h(10, 180)])).toBeNull();
  });

  it('reproduces Open-Meteo’s own figure from its hourlies, on a day the wind swings', () => {
    // Open-Meteo's hourly 10 m winds at the DZ for 2026-10-12 (local day),
    // read 2026-10-08: southerly through the morning, backing round to north
    // and strengthening. Its daily dominant direction for the day was 312°.
    const hours: [number, number][] = [
      [6.4, 183], [4.5, 198], [3.4, 196], [4.7, 182], [5.8, 180], [6.0, 182], [6.1, 187], [6.1, 187],
      [5.7, 190], [4.4, 203], [7.0, 226], [5.8, 258], [5.4, 268], [7.2, 272], [7.1, 292], [8.1, 316],
      [9.6, 331], [11.1, 341], [12.4, 347], [13.6, 352], [14.4, 355], [15.0, 356], [15.0, 359], [13.8, 2],
    ];
    expect(dominantWindDirectionDeg(hours.map(([s, d]) => h(s, d)))).toBe(312);
    // Unweighted, the light southerly morning pulls it round to 257°.
    expect(dominantWindDirectionDeg(hours.map(([, d]) => h(1, d)))).toBe(257);
  });
});

describe('the outlook’s Dir column', () => {
  it('reads Open-Meteo’s figure on the usual path', () => {
    const days = normalizeOpenMeteoDaily(OPEN_METEO_DAILY_FIXTURE);
    expect(days.map((d) => d.windDirDominantDeg)).toEqual(OPEN_METEO_DAILY_FIXTURE.daily.wind_direction_10m_dominant);
    expect(normalizeOpenMeteoDaily({ daily: { time: ['2026-07-02T12:00:00Z'] } })[0].windDirDominantDeg).toBeNull();
  });

  it('works the same figure from the NWS hourlies on the fallback', () => {
    const hour = (iso: string, windSpeedKt: number, windDirectionDeg: number): HourlyPoint =>
      ({ time: Date.parse(iso), windSpeedKt, windDirectionDeg, tempC: 20 }) as HourlyPoint;
    const [day] = aggregateDailyFromHourly(
      [hour('2026-07-03T18:00:00Z', 10, 0), hour('2026-07-03T19:00:00Z', 2, 90)],
      'America/Chicago',
    );
    expect(day.windDirDominantDeg).toBe(11);
  });

  it('prints a 16-point compass label with the degrees on hover, and says what the figure is', () => {
    const html = renderToStaticMarkup(
      createElement(DailyForecastPanel, {
        daily: normalizeOpenMeteoDaily(OPEN_METEO_DAILY_FIXTURE),
        source: 'open-meteo',
        hourly: [],
        unit: 'kt',
        onUnitChange: () => {},
      }),
    );
    expect(html).toContain('>Dir</th>');
    // Fixture day 4: 250°, WSW on a 16-point compass.
    expect(html).toContain('<td title="250°">WSW</td>');
    expect(html).toContain('not the direction of the maximum');
  });
});
