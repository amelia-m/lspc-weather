import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WIND_COLUMNS,
  histogram,
  nwsKeptSection,
  omArchiveSection,
  parseOmWindLines,
  surfaceSampleSection,
  windErrorsShrinkage,
  yStep,
  type HistSpec,
  type OmWindRecord,
  type WindErrorsData,
} from '../src/domain/windErrors';
import type { MetarRecord } from '../src/domain/cloudCoverSources';
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

  it('counts the sides as the bars are drawn: a value that rounds into the zero bar is on neither', () => {
    expect(histogram([0.4, -0.4, 0.6, -0.6], SPEED)).toMatchObject({ above: 1, below: 1 });
  });

  it('counts values past the axis as beyond it, and gives no median or mean for none', () => {
    expect(histogram([4, -40, 1], SPEED).outside).toBe(2);
    expect(histogram([], SPEED)).toMatchObject({ n: 0, median: null, mean: null, outside: 0 });
  });
});

describe('yStep', () => {
  it('draws at most six gridlines, whatever the tallest bar, up to the archive’s hundreds', () => {
    for (let max = 1; max <= 3000; max++) {
      const step = yStep(max);
      expect(Math.ceil(max / step)).toBeLessThanOrEqual(6);
    }
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

const om = (run: OmWindRecord['run'], valid: string, spd: number, gust: number, dir: number): OmWindRecord => ({
  src: 'om-wind',
  run,
  valid,
  spd,
  gust,
  dir,
});
const metar = (obsAt: string, raw: string): MetarRecord => ({ src: 'metar', obsAt, raw });

describe('parseOmWindLines', () => {
  it('reads the drop zone’s archived wind, skipping blank lines, other records and other sites', () => {
    const text = [
      JSON.stringify(om('historical', '2026-10-20T15:00Z', 9.4, 15.2, 200)),
      '',
      JSON.stringify({ src: 'om', run: 'historical', valid: '2026-10-20T15:00Z', total: 40 }),
      JSON.stringify({ ...om('historical', '2026-10-20T15:00Z', 1, 2, 3), site: 'PMV' }),
    ].join('\n');
    expect(parseOmWindLines(text)).toEqual([om('historical', '2026-10-20T15:00Z', 9.4, 15.2, 200)]);
  });
});

describe('omArchiveSection', () => {
  const reports = [
    metar('2026-10-20T14:55Z', 'KPMV 201455Z AUTO 19012G20KT 10SM CLR 12/03 A3001'),
    // Nearer the 15Z hour than the :55, so this is the report paired.
    metar('2026-10-20T15:03Z', 'KPMV 201503Z AUTO 19010KT 10SM CLR 12/03 A3001'),
    metar('2026-10-20T15:55Z', 'KPMV 201555Z AUTO 00000KT 10SM CLR 13/03 A3001'),
    // 17Z has no report within ten minutes: not paired.
    metar('2026-10-20T16:40Z', 'KPMV 201640Z AUTO 18008KT 10SM CLR 13/03 A3001'),
  ];

  it('pairs each hour with the report nearest it and reads it as the kept NWS forecasts are', () => {
    const s = omArchiveSection(
      [
        om('historical', '2026-10-20T15:00Z', 12.6, 18.4, 200),
        om('historical', '2026-10-20T16:00Z', 4.4, 9, 120),
        om('historical', '2026-10-20T17:00Z', 30, 40, 300),
        om('previous_day1', '2026-10-20T15:00Z', 8.5, 14, 170),
      ],
      reports,
    );
    expect(s).toMatchObject({ id: 'om-archive', unitWord: 'hour' });
    expect(s.rows.map((r) => r.label)).toEqual(['start of run', 'a day earlier']);
    const [speed, gust, dir] = s.rows[0].panels;
    // 15Z: 13 against 10 (whole knots, as windDiffs reads it). 16Z: 4 against calm.
    expect(speed).toMatchObject({ n: 2, above: 2, below: 0, median: 3.5 });
    // Neither paired report gave a gust; the 14:55 one did but is not the nearer.
    expect(gust.n).toBe(0);
    // Calm gives no direction: only 15Z, 200 against 190.
    expect(dir).toMatchObject({ n: 1, median: 10 });
    // 8.5 rounds to 9 against 10.
    expect(s.rows[1].panels[0]).toMatchObject({ n: 1, median: -1 });
    expect(s.first).toBe('2026-10-20T15:00:00.000Z');
    expect(s.last).toBe('2026-10-20T16:00:00.000Z');
  });

  it('counts an hour fetched twice once, with the later file’s value', () => {
    const s = omArchiveSection(
      [om('historical', '2026-10-20T15:00Z', 30, 40, 300), om('historical', '2026-10-20T15:00Z', 12.6, 18.4, 200)],
      reports,
    );
    expect(s.rows[0].panels[0]).toMatchObject({ n: 1, median: 3 });
  });

  it('keeps a field an earlier fetch had when the later one left it null', () => {
    const partial: OmWindRecord = { ...om('historical', '2026-10-20T15:00Z', 12.6, 0, 0), gust: null, dir: null };
    const s = omArchiveSection([om('historical', '2026-10-20T15:00Z', 30, 40, 200), partial], reports);
    expect(s.rows[0].panels[0]).toMatchObject({ n: 1, median: 3 }); // the later speed
    expect(s.rows[0].panels[2]).toMatchObject({ n: 1, median: 10 }); // the earlier direction
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
      // Out of order and repeated, as overlapping log files give them: read
      // in time order, each run once, as the summary reads them.
      run('11:00', '10:55', w('10:55', null, 0), hourly),
      // The same report at a later run, when the forecast had moved, listed
      // first: the earliest run that had the report is the one paired.
      run('10:05', '09:55', w('09:55', 190, 8, 15), [w('10:00', 260, 20, 30), w('11:00', 210, 6, 11)]),
      run('10:00', '09:55', w('09:55', 190, 8, 15), hourly),
      run('10:00', '09:55', w('09:55', 190, 8, 15), hourly),
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

  it('credits Open-Meteo when its archive is on the page', () => {
    const withArchive: WindErrorsData = {
      ...data,
      sections: [...data.sections, omArchiveSection([om('historical', '2026-10-20T15:00Z', 12, 18, 200)], [metar('2026-10-20T15:03Z', 'KPMV 201503Z AUTO 19010KT 10SM CLR 12/03 A3001')])],
    };
    const html = page(withArchive, 'ready');
    expect(html).toContain('Open-Meteo.com');
    expect(html).toContain('Open-Meteo’s archived forecasts, against KPMV');
    // Only the archive is on this page: the credit names it and not the sample.
    expect(html).toContain('archived forecasts’ charts');
    expect(html).not.toContain('surface-wind sample’s');
  });
});

describe('windErrorsShrinkage', () => {
  const pair = (t: number): InstantPair => ({
    t,
    issued: '2026-10-20T00:00:00Z',
    fc: { windSpeed: 9, windGust: 15, windDirection: 200 },
    obs: obs(12, 20, 190),
  });
  const file = (hours: number): WindErrorsData => ({
    generatedAt: '2026-10-23T12:00:00.000Z',
    sections: [nwsKeptSection([{ label: 'latest issuance', pairs: Array.from({ length: hours }, (_, i) => pair(T + i * 3_600_000)) }])],
  });

  it('passes a rebuild that holds at least as much', () => {
    expect(windErrorsShrinkage(file(3), file(3))).toEqual([]);
    expect(windErrorsShrinkage(file(3), file(5))).toEqual([]);
  });

  it('names every chart with fewer pairs, and a section that ends earlier', () => {
    const less = windErrorsShrinkage(file(5), file(3));
    expect(less).toContain('nws-kept: "latest issuance" speed 3 pairs, published 5');
    expect(less).toContain('nws-kept: "latest issuance" gust 3 pairs, published 5');
    expect(less.some((l) => l.startsWith('nws-kept: ends 2026-10-20T17:00'))).toBe(true);
  });

  it('names a section that starts later, though every count grew', () => {
    const later: WindErrorsData = {
      ...file(5),
      sections: [nwsKeptSection([{ label: 'latest issuance', pairs: Array.from({ length: 6 }, (_, i) => pair(T + (i + 2) * 3_600_000)) }])],
    };
    expect(windErrorsShrinkage(file(5), later)).toEqual([
      `nws-kept: starts ${new Date(T + 2 * 3_600_000).toISOString()}, published ${new Date(T).toISOString()}`,
    ]);
  });

  it('names a section or row that is gone', () => {
    expect(windErrorsShrinkage(file(3), { ...file(3), sections: [] })).toEqual(['section nws-kept is gone']);
    const renamed = file(3);
    renamed.sections[0].rows[0].label = 'newest';
    expect(windErrorsShrinkage(file(3), renamed)).toEqual(['nws-kept: row "latest issuance" is gone']);
  });
});
