import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WIND_COLUMNS,
  histogram,
  nwsKeptSection,
  surfaceSampleSection,
  type HistSpec,
  type WindErrorsData,
} from '../src/domain/windErrors';
import type { InstantPair } from '../src/domain/keptForecasts';
import type { SurfaceWindRecord, WindAt } from '../src/domain/surfaceWindSources';
import { WindErrorsPage } from '../src/components/WindErrorsPage';

const SPEED: HistSpec = { quantity: 'speed', title: 'Wind speed', unit: 'kt', bin: 1, lo: -3, hi: 3 };
const DIR: HistSpec = { quantity: 'dir', title: 'Direction', unit: '°', bin: 10, lo: -30, hi: 30 };

describe('histogram', () => {
  it('counts each value in the bin centred nearest it, and the sides of zero', () => {
    const h = histogram([-1, 0, 0, 1, 1, 2.4], SPEED);
    // Bins −3 … +3.
    expect(h.counts).toEqual([0, 0, 1, 2, 2, 1, 0]);
    expect(h).toMatchObject({ n: 6, above: 3, below: 1, outside: 0, median: 0.5, mean: 0.6 });
  });

  it('rounds a halfway value away from zero on both sides, so neither side gains it', () => {
    expect(histogram([5, -5], DIR).counts).toEqual([0, 0, 1, 0, 1, 0, 0]);
    expect(histogram([0.5, -0.5], SPEED).counts).toEqual([0, 0, 1, 0, 1, 0, 0]);
  });

  it('counts values past the axis as beyond it, and gives no median or mean for none', () => {
    expect(histogram([4, -40, 1], SPEED).outside).toBe(2);
    expect(histogram([], SPEED)).toMatchObject({ n: 0, median: null, mean: null, outside: 0 });
  });
});

const T = Date.parse('2026-10-20T15:00:00Z');
const obs = (spd: number | null, gust: number | null, dir: number | null): InstantPair['obs'] => ({
  t: T - 300_000,
  spd,
  gust,
  dir,
  tempC: null,
  visSm: null,
});

describe('nwsKeptSection', () => {
  it('reads each pair as windDiffs does: whole knots, the gust only where reported, direction where given', () => {
    const pairs: InstantPair[] = [
      { t: T, issued: '2026-10-20T14:00:00Z', fc: { windSpeed: 9.6, windGust: 15.4, windDirection: 200 }, obs: obs(12, 20, 190) },
      { t: T + 3_600_000, issued: '2026-10-20T14:00:00Z', fc: { windSpeed: 4, windGust: 9, windDirection: 120 }, obs: obs(0, null, null) },
    ];
    const s = nwsKeptSection([{ label: 'latest issuance', pairs }]);
    const [speed, gust, dir] = s.rows[0].panels;
    expect(speed).toMatchObject({ n: 2, above: 1, below: 1 }); // −2 and +4
    expect(gust).toMatchObject({ n: 1, median: -5 }); // calm hour: no reported gust
    expect(dir).toMatchObject({ n: 1, median: 10 }); // calm hour: no direction
    expect(s).toMatchObject({ id: 'nws-kept', unitWord: 'hour', first: new Date(T).toISOString() });
    expect(s.rows[0].panels.map((p) => p.quantity)).toEqual(WIND_COLUMNS.map((c) => c.quantity));
  });
});

const w = (t: string, dir: number | null, spd: number | null, gust: number | null = null): WindAt => ({
  t: `2026-10-09T${t}:00.000Z`,
  dir,
  spd,
  gust,
});
const run = (hhmm: string, obsAt: string, metarWind: WindAt, omHourly: WindAt[]): SurfaceWindRecord => ({
  kind: 'surfacewind',
  v: 1,
  at: `2026-10-09T${hhmm}:00.000Z`,
  dz: '40.8703,-96.1085',
  metar: { source: 'iem', obsAt: `2026-10-09T${obsAt}:00.000Z`, wind: metarWind, group: null, iemObsAt: null, nwsObsAt: null },
  om: {
    fetchedAt: `2026-10-09T${hhmm}:00.000Z`,
    generationMs: 1,
    gridLat: 40.86,
    gridLon: -96.12,
    elevationM: 355,
    current: null,
    hourly: omHourly,
    m15: [],
    lastModified: null,
    cacheControl: null,
    sameAsHrrr: true,
  },
});

describe('surfaceSampleSection', () => {
  it('pairs each report once, as the sample’s summary does, and keeps Open-Meteo’s tenths', () => {
    const hourly = [w('10:00', 200, 9.4, 18.2), w('11:00', 210, 6, 11)];
    const records = [
      run('10:00', '09:55', w('09:55', 190, 8, 15), hourly),
      // The same report again: counted once.
      run('10:05', '09:55', w('09:55', 190, 8, 15), hourly),
      run('11:00', '10:55', w('10:55', null, 0), hourly),
    ];
    const s = surfaceSampleSection(records);
    const omHourly = s.rows.find((r) => r.label === 'Open-Meteo hourly')!;
    const [speed, gust, dir] = omHourly.panels;
    expect(speed).toMatchObject({ n: 2, median: 3.7 }); // +1.4 and +6
    expect(gust).toMatchObject({ n: 1, median: 3.2 });
    expect(dir).toMatchObject({ n: 1, median: 10 });
    expect(s).toMatchObject({ id: 'surface-sample', unitWord: 'report' });
    // No NWS in these runs: that row pairs nothing.
    expect(s.rows.find((r) => r.label.startsWith('NWS'))!.panels[0].n).toBe(0);
  });
});

describe('WindErrorsPage', () => {
  const page = (data: WindErrorsData | null, state: 'loading' | 'missing' | 'error' | 'ready') =>
    renderToStaticMarkup(createElement(WindErrorsPage, { data, state }));
  const data: WindErrorsData = {
    generatedAt: '2026-10-23T12:00:00.000Z',
    sections: [
      nwsKeptSection([
        {
          label: 'latest issuance',
          pairs: [{ t: T, issued: '2026-10-20T14:00:00Z', fc: { windSpeed: 9, windGust: 15, windDirection: 200 }, obs: obs(12, 20, 190) }],
        },
      ]),
    ],
  };

  it('says what each state is, in the words the live-site check reads', () => {
    expect(page(null, 'loading')).toContain('Loading the wind figures');
    expect(page(null, 'missing')).toContain('No wind figures have been published yet');
    expect(page(null, 'error')).toContain('The wind figures could not be read');
  });

  it('draws a chart per quantity with each bar titled, and grades nothing', () => {
    const html = page(data, 'ready');
    expect(html.match(/class="werr-svg"/g)).toHaveLength(3);
    expect(html).toContain('<title>−3 kt: 1 hour</title>');
    expect(html).toContain('n 1 · median −3 kt');
    expect(html).not.toMatch(/\b(good|bad|accurate|inaccurate|reliable)\b/i);
    // No Open-Meteo data on the page, so no Open-Meteo credit.
    expect(html).not.toContain('Open-Meteo.com');
  });
});
