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
    // The axis column's unit first, then one per hour.
    expect(figures).toEqual(['%', '40', '—', '85']);
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

/* The NWS bars show an amount, not a category: one colour from clear to
 * overcast (the few/scattered/broken/overcast colours read as a verdict and
 * carried no key). Twelve hours fit the card with a time under every third,
 * and Open-Meteo's bar sits in an outlined track so a near-clear hour still
 * shows. */
describe('the Ceiling & sky timeline', () => {
  const t0 = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
  const covers = [0, 10, 30, 60, 95, 100, 20, 40, 70, 90, 5, 50];
  const hourly = covers.map((pct, i) => ({
    time: t0 + i * 3_600_000,
    skyCoverPct: pct,
    ceilingFtAgl: pct >= 50 ? 4500 : null,
    precipProbPct: 0,
  })) as unknown as HourlyPoint[];
  const om: OpenMeteoCloudHour[] = hourly.map((h) => ({ time: h.time, totalPct: 2, lowPct: 1, midPct: 1, highPct: 0 }));
  const html = renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly, omClouds: om }));

  it('draws every NWS bar alike, whatever the cover', () => {
    // Overcast and clear hours carry the same markup apart from their height.
    expect(html).not.toContain('data-cover');
    const bars = [...html.matchAll(/<div class="sky-bar" style="height:([\d.]+)%"><\/div>/g)].map((m) => Number(m[1]));
    expect(bars).toEqual(covers);
  });

  it('puts each Open-Meteo bar in a track of its own, even at 2%', () => {
    expect(html.match(/<div class="om-track"><div class="sky-bar om-bar" style="height:2%"><\/div><\/div>/g)).toHaveLength(12);
  });

  it('labels every third hour and leaves the rest blank', () => {
    const times = [...html.matchAll(/<span class="sky-time">([^<]*)<\/span>/g)].map((m) => m[1]);
    // The axis column's blank first, then twelve hours.
    expect(times).toHaveLength(13);
    const hours = times.slice(1);
    hours.forEach((t, i) => (i % 3 === 0 ? expect(t).toMatch(/^\d{1,2}(am|pm)$/) : expect(t).toBe(' ')));
  });

  it('marks an hour with no ceiling with a dash', () => {
    const ceil = [...html.matchAll(/<span class="sky-ceil"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]).slice(1);
    expect(ceil[0]).toBe('–');
    expect(ceil[3]).toBe('4.5');
  });
});
