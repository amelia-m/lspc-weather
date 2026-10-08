import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CeilingSkyPanel } from '../src/components/CeilingSkyPanel';
import { normalizeOpenMeteoClouds, openMeteoHourlyVariables, type RawOpenMeteo } from '../src/domain/normalize';
import type { HourlyPoint, OpenMeteoCloudHour } from '../src/domain/types';

/* Open-Meteo's cloud cover rides on the winds request and sits beside the
 * NWS sky cover on the Ceiling & sky card: a second forecast, never a
 * ceiling. */
describe('Open-Meteo cloud cover', () => {
  it('is asked for with the winds: total and the three bands', () => {
    const vars = openMeteoHourlyVariables();
    for (const v of ['cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high']) expect(vars).toContain(v);
  });

  it('normalises each hour, null where a value is missing', () => {
    const raw = {
      hourly: {
        time: ['2026-10-08T12:00:00Z', '2026-10-08T13:00:00Z'],
        cloud_cover: [40, null],
        cloud_cover_low: [10, 20],
        cloud_cover_mid: [30, 30],
        cloud_cover_high: [5, 5],
      },
    } as unknown as RawOpenMeteo;
    expect(normalizeOpenMeteoClouds(raw)).toEqual([
      { time: Date.parse('2026-10-08T12:00:00Z'), totalPct: 40, lowPct: 10, midPct: 30, highPct: 5 },
      { time: Date.parse('2026-10-08T13:00:00Z'), totalPct: null, lowPct: 20, midPct: 30, highPct: 5 },
    ]);
  });
});

describe('the Ceiling & sky card with Open-Meteo beside NWS', () => {
  const t0 = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
  const hourly = [0, 1, 2].map((i) => ({
    time: t0 + i * 3_600_000,
    skyCoverPct: 55,
    ceilingFtAgl: 4500,
    precipProbPct: 0,
  })) as unknown as HourlyPoint[];
  const om: OpenMeteoCloudHour[] = [
    { time: t0, totalPct: 40, lowPct: 10, midPct: 30, highPct: 5 },
    // t0 + 1 h not served; t0 + 2 h served.
    { time: t0 + 2 * 3_600_000, totalPct: 85, lowPct: 60, midPct: 40, highPct: 20 },
  ];
  const card = (omClouds: OpenMeteoCloudHour[] | null): string =>
    renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly, omClouds }));

  it('puts each hour’s Open-Meteo figure under the NWS one, matched by time, and credits it', () => {
    const html = card(om);
    const figures = [...html.matchAll(/<span class="sky-pct om-pct">([^<]*)<\/span>/g)].map((m) => m[1]);
    // The axis column's blank first, then one per hour.
    expect(figures).toEqual([' ', '40%', '—', '85%']);
    expect(html.match(/class="sky-bar om-bar"/g)).toHaveLength(3);
    expect(html).toContain('Open-Meteo’s cloud');
    expect(html).toContain('says nothing about a cloud base');
    expect(html).toContain('open-meteo.com');
  });

  it('names the bands in each hour’s tooltip', () => {
    expect(card(om)).toContain('Open-Meteo 40% cover (low 10%, mid 30%, high 5%)');
  });

  it('shows the NWS forecast alone when Open-Meteo did not answer', () => {
    const html = card(null);
    expect(html).not.toContain('om-bar');
    expect(html).not.toContain('om-pct');
    expect(html).not.toContain('Open-Meteo');
  });

  it('never paints the Open-Meteo bar by amount', () => {
    expect(card(om)).not.toMatch(/om-bar"[^>]*data-cover/);
  });
});
