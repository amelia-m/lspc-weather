import { describe, expect, it } from 'vitest';
import {
  ceilingFromTheirClouds,
  cloudsInTheirWords,
  comparableDirection,
  milesFrom,
  pageTextNear,
  parseUsairnet,
  sameDirection,
} from '../src/domain/usairnet';

/* Station blocks cut from usairnet's live pages on 2026-09-29 (the rest of
 * each ~470 KB page is navigation and maps). Each is the shape a field
 * takes on the page: a gust, a variable wind, calm, an overcast layer. */
const PAGES = import.meta.glob('./fixtures/usairnet/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const page = (station: string): string => PAGES[`./fixtures/usairnet/${station}.html`];
/* Station blocks cut from the redesigned pages on 2026-10-26: a clear
 * sky, a gust with weather in the heading, calm, a wind the METAR left
 * out, a sky group it left out, decimal fractions of a mile. */
const MODERN = import.meta.glob('./fixtures/usairnet/modern/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const modern = (station: string): string => MODERN[`./fixtures/usairnet/modern/${station}.html`];

describe('parseUsairnet', () => {
  it('reads a gusting wind’s direction past the gust (KSWW, METAR 14016G21KT)', () => {
    expect(parseUsairnet(page('KSWW'), 'KSWW')).toMatchObject({
      windMph: 18,
      windGustMph: 24,
      windDirDeg: 160,
      windText: '18 MPH|Gust: 24 MPH|160° South',
    });
  });

  it('reads a variable wind as a speed with no direction (KRKS, METAR VRB04KT)', () => {
    expect(parseUsairnet(page('KRKS'), 'KRKS')).toMatchObject({
      windMph: 5,
      windGustMph: null,
      windDirDeg: null,
      windText: '5 MPH',
    });
  });

  it('reads calm as 0 mph and no direction (KAIA, METAR 00000KT)', () => {
    expect(parseUsairnet(page('KAIA'), 'KAIA')).toMatchObject({ windMph: 0, windDirDeg: null, windText: 'Calm' });
  });

  it('reads the rest of the block, and the overcast layer in the page’s own words (KOMA)', () => {
    expect(parseUsairnet(page('KOMA'), 'KOMA')).toMatchObject({
      windMph: 15,
      windGustMph: null,
      windDirDeg: 170,
      // The page's "Solid Overcast" read as "Overcast", the redesign's word.
      clouds: 'Broken at 3600 ft, Broken at 4900 ft, Overcast at 11000 ft',
      rawMetar: null,
    });
  });

  it('reads the temperature when the heading carries present weather too (KPMV, 4SM -RA)', () => {
    // "(KPMV)|68°|Partly Cloudy|Light Rain|as of 6:15 PM CDST|…"
    expect(parseUsairnet(page('KPMV'), 'KPMV')).toMatchObject({
      asOf: '6:15 PM',
      tempF: 68,
      condition: 'Partly Cloudy, Light Rain',
      dewpointF: 68,
      visibilityMi: 4,
      pressureInHg: 29.78,
      flightRule: 'MVFR',
      sunset: '7:09 PM',
    });
    expect(parseUsairnet(page('KSWW'), 'KSWW')).toMatchObject({ tempF: 88, condition: 'Mostly Cloudy' });
  });

  it('is null for a station not on the page', () => {
    expect(parseUsairnet(page('KOMA'), 'KPMV')).toBeNull();
  });
});

describe('parseUsairnet on the redesigned page (2026-10-09 on)', () => {
  it('reads the block, the clock without its leading zero, and the raw METAR (KPMV, 01006KT 10SM CLR)', () => {
    expect(parseUsairnet(modern('KPMV'), 'KPMV')).toMatchObject({
      asOf: '4:15 AM',
      tempF: 54,
      condition: 'Clear',
      humidityPct: 82,
      dewpointF: 48,
      visibilityMi: 10,
      pressureInHg: 30.3,
      flightRule: 'VFR',
      windMph: 7,
      windGustMph: null,
      windDirDeg: 10,
      windText: '7 mph|10° from',
      clouds: 'Clear',
      sunrise: '7:47 AM',
      sunset: '6:29 PM',
      rawMetar: 'KPMV 260915Z AUTO 01006KT 10SM CLR 12/09 A3030 RMK AO2 T01230085',
    });
  });

  it('reads a gust after the direction, and weather in the heading (KIML, 04013G18KT 4SM -RA BR OVC004)', () => {
    expect(parseUsairnet(modern('KIML'), 'KIML')).toMatchObject({
      tempF: 43,
      condition: 'Light rain, mist',
      visibilityMi: 4,
      windMph: 15,
      windGustMph: 21,
      windDirDeg: 40,
      windText: '15 mph|40° from|Gust 21',
      clouds: 'Overcast at 400 ft',
    });
  });

  it('reads calm as 0 mph and no direction (KMLE, 00000KT OVC080)', () => {
    expect(parseUsairnet(modern('KMLE'), 'KMLE')).toMatchObject({ windMph: 0, windDirDeg: null, windText: 'Calm', clouds: 'Overcast at 8000 ft' });
  });

  it('reads a wind the METAR left out as none, and a decimal fraction of a mile (KHYS, 1/2SM FG, no wind group)', () => {
    expect(parseUsairnet(modern('KHYS'), 'KHYS')).toMatchObject({
      condition: 'fog',
      visibilityMi: 0.5,
      windMph: null,
      windDirDeg: null,
      windText: 'Not reported',
      clouds: 'Overcast at 300 ft',
    });
    expect(parseUsairnet(modern('KCBK'), 'KCBK')).toMatchObject({ visibilityMi: 0.25 });
    expect(parseUsairnet(modern('KLBF'), 'KLBF')).toMatchObject({ visibilityMi: 2.5, condition: 'Heavy rain, mist' });
  });

  it('reads a sky group the METAR left out in the dashboard’s own words (KHEQ, no sky group)', () => {
    expect(parseUsairnet(modern('KHEQ'), 'KHEQ')).toMatchObject({ clouds: '(not reported)' });
    expect(cloudsInTheirWords([])).toBe(parseUsairnet(modern('KHEQ'), 'KHEQ')!.clouds);
  });

  it('joins layers as the legacy page did, so one wording serves both (K9K7, OVC110)', () => {
    expect(parseUsairnet(modern('K9K7'), 'K9K7')!.clouds).toBe('Overcast at 11000 ft');
    expect(cloudsInTheirWords([{ cover: 'OVC', baseFtAgl: 11000 }])).toBe('Overcast at 11000 ft');
  });
});

describe('cloudsInTheirWords', () => {
  it('writes OVC as usairnet does, so an overcast report can agree', () => {
    // KOMA 292252Z … BKN036 BKN049 OVC110, as the page printed it above.
    expect(
      cloudsInTheirWords([
        { cover: 'BKN', baseFtAgl: 3600 },
        { cover: 'BKN', baseFtAgl: 4900 },
        { cover: 'OVC', baseFtAgl: 11000 },
      ]),
    ).toBe(parseUsairnet(page('KOMA'), 'KOMA')!.clouds);
    expect(cloudsInTheirWords([{ cover: 'CLR', baseFtAgl: null }])).toBe('Clear');
    expect(cloudsInTheirWords([])).toBe('(not reported)');
  });

  it('still finds the ceiling in usairnet’s wording', () => {
    expect(ceilingFromTheirClouds('Scattered at 3300 ft, Overcast at 11000 ft')).toBe(11000);
    expect(ceilingFromTheirClouds('Few at 3700 ft, Broken at 12000 ft')).toBe(12000);
    expect(ceilingFromTheirClouds('Clear')).toBeNull();
  });
});

describe('comparableDirection', () => {
  it('gives a calm report no direction, as usairnet prints it, whatever the feed said', () => {
    expect(comparableDirection(0, 0)).toBeNull();
    expect(comparableDirection(9, 150)).toBe(150);
    expect(comparableDirection(null, 150)).toBe(150);
  });
});

describe('visibility as usairnet prints it', () => {
  it('reads a fraction and a whole number with a fraction (KFXY 1/2, KPRO 1 1/4, 2026-10-03)', () => {
    expect(parseUsairnet(page('KFXY'), 'KFXY')!.visibilityMi).toBe(0.5);
    expect(parseUsairnet(page('KPRO'), 'KPRO')!.visibilityMi).toBe(1.25);
    expect(parseUsairnet(page('KPMV'), 'KPMV')!.visibilityMi).toBe(4);
  });

  it('reads each form, and nothing else', () => {
    expect(milesFrom('10')).toBe(10);
    expect(milesFrom('2.5')).toBe(2.5);
    expect(milesFrom('2 1/2')).toBe(2.5);
    expect(milesFrom('3/4')).toBe(0.75);
    expect(milesFrom('ten')).toBeNull();
    expect(milesFrom(null)).toBeNull();
  });
});

describe('sameDirection', () => {
  it('counts 360 and 0 as the same north wind, and nothing else as a match', () => {
    expect(sameDirection(360, 0)).toBe(true);
    expect(sameDirection(150, 150)).toBe(true);
    expect(sameDirection(150, 160)).toBe(false);
    expect(sameDirection(null, null)).toBe(true);
    expect(sameDirection(360, null)).toBe(false);
  });
});

describe('pageTextNear', () => {
  it('keeps the station block’s text for the log, or the page’s start when the station is absent', () => {
    expect(pageTextNear(page('KPRO'), 'KPRO', 60)).toMatch(/^\(KPRO\)\|\d+°\|/);
    expect(pageTextNear(page('KPRO'), 'KPMV', 40)).toMatch(/^\|?Current Conditions at/);
  });
});

