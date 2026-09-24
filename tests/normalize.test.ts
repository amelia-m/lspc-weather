import { describe, expect, it } from 'vitest';
import { OPEN_METEO_FIXTURE } from '../src/api/fixtures/openMeteo';
import { hourStartMs } from '../src/api/fixtures/_time';
import { mToFt } from '../src/domain/units';
import {
  aggregateDailyFromHourly,
  altimeterFromRaw,
  durationToHours,
  normalizeGridpoint,
  normalizeMetar,
  ceilingState,
  compareSkyDecodes,
  normalizeNwsObservation,
  parseSkyGroups,
  normalizeOpenMeteo,
  openMeteoHourlyVariables,
  openMeteoWindsUrl,
  OPEN_METEO_FORECAST_URL,
  normalizeOpenMeteoDaily,
  parseFdTiming,
  parseFdWinds,
  parseTaf,
  parseValidTime,
  toSkyCover,
  type RawNwsObservation,
} from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';
import { GRIDPOINT_FIXTURE } from '../src/api/fixtures/gridpoint';
import { OBSERVATION_FIXTURE } from '../src/api/fixtures/observation';
import { TAF_FIXTURE } from '../src/api/fixtures/taf';
import { OPEN_METEO_DAILY_FIXTURE } from '../src/api/fixtures/openMeteoDaily';
import type { RawOpenMeteo } from '../src/domain/normalize';

describe('durationToHours', () => {
  it('parses hour and day durations', () => {
    expect(durationToHours('PT1H')).toBe(1);
    expect(durationToHours('PT6H')).toBe(6);
    expect(durationToHours('P1DT6H')).toBe(30);
    expect(durationToHours('PT30M')).toBe(1); // partial hour rounds up
  });
});

describe('parseValidTime', () => {
  it('splits an interval into start epoch + hours', () => {
    const p = parseValidTime('2025-06-27T13:00:00+00:00/PT3H');
    expect(p?.hours).toBe(3);
    expect(p?.start).toBe(Date.parse('2025-06-27T13:00:00+00:00'));
  });
});

describe('normalizeMetar', () => {
  it('picks the lowest BKN/OVC layer as the ceiling and converts altimeter', () => {
    const c = normalizeMetar(METAR_FIXTURE[0]);
    expect(c.station).toBe('KPMV');
    expect(c.ceilingFtAgl).toBe(4500); // FEW 3500 ignored, BKN 4500 is the ceiling
    expect(c.wind.gustKt).toBe(22);
    expect(c.altimeterInHg).toBeGreaterThan(29.9);
    expect(c.altimeterInHg).toBeLessThan(30.0);
  });

  it('maps a missing wind speed to null, not calm', () => {
    const c = normalizeMetar({ ...METAR_FIXTURE[0], wspd: null });
    expect(c.wind.speedKt).toBeNull();
  });

  it('keeps a genuine calm (0 kt) as 0', () => {
    const c = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 0 });
    expect(c.wind.speedKt).toBe(0);
  });

  it('reads the sky from the METAR text when the decode has no layers', () => {
    // aviationweather.gov's decode has no `clouds` entries for a clear sky;
    // the text says CLR, and a CLR layer is what lets a category be VFR.
    const c = normalizeMetar({
      ...METAR_FIXTURE[0],
      rawOb: 'KPMV 241152Z AUTO 13006KT 10SM CLR 14/12 A3012 RMK AO2',
      clouds: [],
    });
    expect(c.skyLayers).toEqual([{ cover: 'CLR', baseFtAgl: null }]);
    expect(ceilingState(c)).toBe('known');
  });

  it('maps an unrecognized vendor sky-cover string to SKC instead of casting it through', () => {
    // The text has no sky group here, so the decode is what gets read.
    const c = normalizeMetar({
      ...METAR_FIXTURE[0],
      rawOb: 'KPMV 241152Z AUTO 13006KT 10SM 14/12 A3012',
      clouds: [
        { cover: 'BOGUS', base: 1200 },
        { cover: 'BKN', base: 4500 },
      ],
    });
    expect(c.skyLayers[0].cover).toBe('SKC'); // unknown → SKC, never a ceiling
    expect(c.skyLayers[1].cover).toBe('BKN');
    expect(c.ceilingFtAgl).toBe(4500);
  });
});

describe('toSkyCover', () => {
  it('accepts SkyCover union members and falls back to SKC otherwise', () => {
    expect(toSkyCover('OVC')).toBe('OVC');
    expect(toSkyCover('FEW')).toBe('FEW');
    expect(toSkyCover('CAVOK')).toBe('SKC'); // unknown vendor string
    expect(toSkyCover(undefined)).toBe('SKC'); // missing
  });
});

describe('altimeterFromRaw', () => {
  it('parses an A-group (inHg)', () => {
    expect(altimeterFromRaw('KPMV 271300Z AUTO 19012G22KT 10SM BKN045 28/19 A2996 RMK')).toBe(29.96);
  });
  it('parses a Q-group (hPa) to inHg', () => {
    const v = altimeterFromRaw('EGLL 271320Z 18012KT 9999 BKN040 18/12 Q1013');
    expect(v).toBeGreaterThan(29.9);
    expect(v).toBeLessThan(29.95);
  });
  it('returns null when neither is present', () => {
    expect(altimeterFromRaw('KPMV 271300Z AUTO 19012KT 10SM CLR 28/19 RMK')).toBeNull();
  });
});

describe('normalizeNwsObservation', () => {
  it('decodes wind (km/h→kt), ceiling, visibility and altimeter from the raw METAR', () => {
    const c = normalizeNwsObservation(OBSERVATION_FIXTURE, 'KPMV');
    expect(c.station).toBe('KPMV');
    expect(c.wind.speedKt).toBe(12); // 22.2 km/h
    expect(c.wind.gustKt).toBe(22); // 40.7 km/h
    expect(c.ceilingFtAgl).toBe(4500); // FEW035 ignored, BKN045 from the raw METAR
    expect(c.visibilitySm).toBeCloseTo(10, 0);
    expect(c.altimeterInHg).toBe(29.96); // from A2996 in rawMessage
  });

  it('falls back to station pressure when the raw text lacks an A/Q group', () => {
    const noRaw = {
      properties: { ...OBSERVATION_FIXTURE.properties, rawMessage: 'KPMV 271300Z AUTO' },
    };
    const c = normalizeNwsObservation(noRaw, 'KPMV');
    expect(c.altimeterInHg).toBeGreaterThan(29.5); // 101490 Pa ≈ 29.97 inHg
    expect(c.altimeterInHg).toBeLessThan(30.5);
  });

  it('maps a null wind-speed value (sensor failed QC) to null, not calm', () => {
    const obs = {
      properties: { ...OBSERVATION_FIXTURE.properties, windSpeed: { value: null } },
    };
    const c = normalizeNwsObservation(obs, 'KPMV');
    expect(c.wind.speedKt).toBeNull();
  });

  it('maps an absent windSpeed field to null, not calm', () => {
    const props = { ...OBSERVATION_FIXTURE.properties };
    delete props.windSpeed;
    const c = normalizeNwsObservation({ properties: props }, 'KPMV');
    expect(c.wind.speedKt).toBeNull();
  });

  it('keeps a genuine calm (0 km/h) as 0 kt', () => {
    const obs = {
      properties: {
        ...OBSERVATION_FIXTURE.properties,
        windSpeed: { unitCode: 'wmoUnit:km_h-1', value: 0 },
      },
    };
    const c = normalizeNwsObservation(obs, 'KPMV');
    expect(c.wind.speedKt).toBe(0);
  });
});

/* The sky is read from the METAR text, and the API's decoded cloudLayers only
 * when the text has no sky group. On 2026-09-23 api.weather.gov served seven
 * consecutive KPMV observations with cloudLayers: [] while rawMessage read
 * OVC027–OVC035; the dashboard showed "Clear" and VFR under a 2,700 ft
 * overcast. The first case below is that report, verbatim. */
describe('normalizeNwsObservation sky', () => {
  const withRaw = (rawMessage: string, cloudLayers: RawNwsObservation['properties']['cloudLayers']) =>
    normalizeNwsObservation(
      { properties: { ...OBSERVATION_FIXTURE.properties, rawMessage, cloudLayers } },
      'KPMV',
    );

  it('reads the sky from the raw METAR when the API decode is empty', () => {
    const c = withRaw('KPMV 230355Z AUTO 08003KT 10SM OVC027 15/13 A3028 RMK AO2 T01530132', []);
    expect(c.skyLayers).toEqual([{ cover: 'OVC', baseFtAgl: 2700 }]);
    expect(c.ceilingFtAgl).toBe(2700);
  });

  it('prefers the raw METAR over cloudLayers when both are present', () => {
    // The decode says BKN at 4,501 ft; the text says BKN020. The text wins.
    const c = withRaw(
      'KPMV 271300Z AUTO 19012G22KT 10SM BKN020 28/19 A2996 RMK AO2',
      OBSERVATION_FIXTURE.properties.cloudLayers,
    );
    expect(c.ceilingFtAgl).toBe(2000);
  });

  it('falls back to cloudLayers when the raw text has no sky group', () => {
    const c = withRaw('KPMV 271300Z AUTO 19012G22KT 10SM 28/19 A2996', [
      { base: { unitCode: 'wmoUnit:m', value: 610 }, amount: 'OVC' },
    ]);
    expect(c.skyLayers).toEqual([{ cover: 'OVC', baseFtAgl: 2001 }]);
  });

  it('keeps a clear report as a CLR layer, distinct from an unreported sky', () => {
    const clear = withRaw('KPMV 271300Z AUTO 19012KT 10SM CLR 28/19 A2996', []);
    expect(clear.skyLayers).toEqual([{ cover: 'CLR', baseFtAgl: null }]);
    expect(clear.ceilingFtAgl).toBeNull();
    // Four of the same forty observations had no METAR text at all.
    const none = withRaw('', []);
    expect(none.skyLayers).toEqual([]);
    expect(none.ceilingFtAgl).toBeNull();
  });
});

describe('compareSkyDecodes', () => {
  const ovc = (baseFtAgl: number | null) => ({ cover: 'OVC' as const, baseFtAgl });

  it('treats no-cloud layers as the same layer whatever base or token the decode gives them', () => {
    // api.weather.gov gives CLR a base of 3,810 m — the 12,500 ft ceilometer
    // limit — where the text has none (five clear stations sampled 2026-09-23).
    const clr = { cover: 'CLR' as const, baseFtAgl: null };
    expect(compareSkyDecodes([clr], [{ cover: 'CLR', baseFtAgl: 12500 }])).toBe('agrees');
    expect(compareSkyDecodes([clr], [{ cover: 'SKC', baseFtAgl: null }])).toBe('agrees');
    expect(compareSkyDecodes([clr], [ovc(2700)])).toBe('decode-differs');
    // An empty decode under a CLR text is still a gap: the API sends a CLR
    // entry for a clear sky, so nothing at all is the decode missing.
    expect(compareSkyDecodes([clr], [])).toBe('decode-empty');
  });

  it('grades the 2026-09-23 gap as decode-empty, and the mirror case as text-empty', () => {
    expect(compareSkyDecodes([ovc(2700)], [])).toBe('decode-empty');
    expect(compareSkyDecodes([], [ovc(2690)])).toBe('text-empty');
    expect(compareSkyDecodes([], [])).toBe('not-reported');
  });

  it('allows the rounding between hundreds of feet and metres, and no more', () => {
    // OVC027 is 2,700 ft; the API's 820 m rounds to 2,690 ft. Same layer.
    expect(compareSkyDecodes([ovc(2700)], [ovc(2690)])).toBe('agrees');
    expect(compareSkyDecodes([ovc(2700)], [ovc(2600)])).toBe('decode-differs');
    expect(compareSkyDecodes([ovc(2700)], [{ cover: 'BKN', baseFtAgl: 2700 }])).toBe('decode-differs');
    expect(compareSkyDecodes([ovc(2700)], [ovc(2700), ovc(4000)])).toBe('decode-differs');
    expect(compareSkyDecodes([ovc(null)], [ovc(null)])).toBe('agrees');
    expect(compareSkyDecodes([ovc(null)], [ovc(2700)])).toBe('decode-differs');
  });

  it('is carried on the observation', () => {
    const c = normalizeNwsObservation(
      {
        properties: {
          ...OBSERVATION_FIXTURE.properties,
          rawMessage: 'KPMV 230355Z AUTO 08003KT 10SM OVC027 15/13 A3028',
          cloudLayers: [],
        },
      },
      'KPMV',
    );
    expect(c.skyDecode).toBe('decode-empty');
    expect(normalizeNwsObservation(OBSERVATION_FIXTURE, 'KPMV').skyDecode).toBe('agrees');
  });
});

describe('ceilingState', () => {
  it('tells a clear sky, a heightless ceiling layer and no sky apart', () => {
    expect(ceilingState({ skyLayers: [{ cover: 'CLR', baseFtAgl: null }] })).toBe('known');
    expect(ceilingState({ skyLayers: [{ cover: 'FEW', baseFtAgl: null }] })).toBe('known');
    expect(ceilingState({ skyLayers: [{ cover: 'BKN', baseFtAgl: 2000 }] })).toBe('known');
    expect(ceilingState({ skyLayers: [{ cover: 'BKN', baseFtAgl: null }] })).toBe('height-unknown');
    expect(ceilingState({ skyLayers: [{ cover: 'SCT', baseFtAgl: 1500 }, { cover: 'OVC', baseFtAgl: null }] })).toBe(
      'height-unknown',
    );
    expect(ceilingState({ skyLayers: [] })).toBe('unreported');
  });
});

describe('parseSkyGroups', () => {
  it('reads cover and height in hundreds of feet, with CB/TCU and missing heights', () => {
    expect(parseSkyGroups('KPMV 1200Z 10SM SCT005 BKN010CB OVC018 15/13 A3028')).toEqual([
      { cover: 'SCT', baseFtAgl: 500 },
      { cover: 'BKN', baseFtAgl: 1000 },
      { cover: 'OVC', baseFtAgl: 1800 },
    ]);
    expect(parseSkyGroups('KPMV 1200Z 1/4SM FG VV002 10/10 A3028')).toEqual([
      { cover: 'VV', baseFtAgl: 200 },
    ]);
    expect(parseSkyGroups('KPMV 1200Z AUTO 10SM BKN/// 15/13 A3028')).toEqual([
      { cover: 'BKN', baseFtAgl: null },
    ]);
    // The automated no-cloud form used outside the US.
    expect(parseSkyGroups('EGLL 1200Z AUTO 9999 NCD 15/13 Q1025')).toEqual([
      { cover: 'NCD', baseFtAgl: null },
    ]);
  });

  it('ignores the remarks, which carry tokens that look like sky groups', () => {
    // "SCT V BKN" is a variable-sky remark; "SCT" alone would match the group
    // pattern and invent a layer with no height.
    expect(parseSkyGroups('KPMV 1200Z 10SM CLR 15/13 A3028 RMK AO2 SCT V BKN')).toEqual([
      { cover: 'CLR', baseFtAgl: null },
    ]);
  });
});

describe('parseTaf', () => {
  it('extracts the KOFF TAF body, valid period, and issuance time', () => {
    const taf = parseTaf(TAF_FIXTURE.productText!, 'KOFF', TAF_FIXTURE.issuanceTime);
    expect(taf).not.toBeNull();
    expect(taf!.station).toBe('KOFF');
    expect(taf!.raw.startsWith('KOFF')).toBe(true); // comms header stripped
    expect(taf!.raw).toContain('TEMPO');
    expect(taf!.raw.endsWith('=')).toBe(false); // trailing separator stripped
    expect(taf!.validRaw).toBe('2718/2824');
    expect(taf!.issuedMs).toBeTypeOf('number');
  });
  it('returns null when the station is not in the product', () => {
    expect(parseTaf('TAF KOMA 271720Z 2718/2824 ...', 'KOFF')).toBeNull();
  });
});

describe('normalizeGridpoint', () => {
  it('expands interval values into an hourly series with converted units', () => {
    const hourly = normalizeGridpoint(GRIDPOINT_FIXTURE);
    expect(hourly.length).toBeGreaterThan(0);
    const first = hourly[0];
    // 22 km/h ≈ 11.9 kt
    expect(first.windSpeedKt).toBeGreaterThan(11);
    expect(first.windSpeedKt).toBeLessThan(13);
    // 1372 m ≈ 4501 ft
    expect(first.ceilingFtAgl).toBeGreaterThan(4400);
    expect(first.ceilingFtAgl).toBeLessThan(4600);
    expect(first.skyCoverPct).toBe(55);
    expect(first.thunderProbPct).toBe(5); // probabilityOfThunder, first interval
    expect(first.precipAmountIn).toBe(0); // QPF, first interval (0 mm)
    // Second interval QPF: 6.35 mm → 0.25 in
    const later = hourly.find((h) => h.precipAmountIn != null && h.precipAmountIn > 0);
    expect(later?.precipAmountIn).toBeCloseTo(0.25, 2);
  });

  it('generates past 48 h and stops at the last hour any property carries data', () => {
    const start = Date.parse('2026-07-03T00:00:00Z');
    const iso = (h: number): string => new Date(start + h * 3600_000).toISOString();
    // Wind runs to hour 71 (72 h), sky to hour 155 (~6.5 days) — the series
    // should reach 156 hours, not the old 48 cap, and not run past the data.
    const grid = {
      properties: {
        windSpeed: {
          uom: 'wmoUnit:km_h-1',
          values: Array.from({ length: 72 }, (_, h) => ({ validTime: `${iso(h)}/PT1H`, value: 20 })),
        },
        skyCover: {
          uom: 'wmoUnit:percent',
          values: [{ validTime: `${iso(0)}/PT1H`, value: 10 }, { validTime: `${iso(155)}/PT1H`, value: 90 }],
        },
      },
    };
    const hourly = normalizeGridpoint(grid);
    expect(hourly).toHaveLength(156); // 0..155 inclusive
    expect(hourly[100].windSpeedKt).toBeNull(); // past the 72 h wind horizon
    expect(hourly[155].skyCoverPct).toBe(90); // last hour with data
  });

  it('respects an explicit maxHours cap', () => {
    const start = Date.parse('2026-07-03T00:00:00Z');
    const iso = (h: number): string => new Date(start + h * 3600_000).toISOString();
    const grid = {
      properties: {
        temperature: {
          uom: 'wmoUnit:degC',
          values: Array.from({ length: 200 }, (_, h) => ({ validTime: `${iso(h)}/PT1H`, value: 15 })),
        },
      },
    };
    expect(normalizeGridpoint(grid, 24)).toHaveLength(24);
  });
});

describe('normalizeOpenMeteoDaily', () => {
  it('normalizes the 10-day fixture with unixtime seconds', () => {
    const days = normalizeOpenMeteoDaily(OPEN_METEO_DAILY_FIXTURE);
    expect(days).toHaveLength(10);
    expect(days[0].date).toBe((OPEN_METEO_DAILY_FIXTURE.daily.time[0] as number) * 1000);
    expect(days[0].weatherCode).toBe(1);
    expect(days[5].gustMaxKt).toBe(38);
    expect(days[1].precipProbMaxPct).toBe(0); // 0 is a real value, not missing
  });

  it('accepts ISO date strings and maps gaps to null', () => {
    const days = normalizeOpenMeteoDaily({
      daily: {
        time: ['2026-07-02T12:00:00Z', '2026-07-03T12:00:00Z'],
        weather_code: [61, null],
        temperature_2m_max: [24],
        wind_speed_10m_max: [16, null],
      },
    });
    expect(days).toHaveLength(2);
    expect(days[0].date).toBe(Date.parse('2026-07-02T12:00:00Z'));
    expect(days[0].tempMaxC).toBe(24);
    expect(days[1].weatherCode).toBeNull();
    expect(days[1].tempMaxC).toBeNull(); // array shorter than time
    expect(days[1].windMaxKt).toBeNull();
    expect(days[1].gustMaxKt).toBeNull(); // field absent entirely
  });

  it('drops entries whose time cannot be parsed', () => {
    const days = normalizeOpenMeteoDaily({
      daily: { time: ['not-a-date', '2026-07-02T12:00:00Z'], weather_code: [0, 3] },
    });
    expect(days).toHaveLength(1);
    expect(days[0].weatherCode).toBe(3);
  });
});

describe('parseTaf body anchoring', () => {
  it('anchors on the TAF body when the station also appears in the WMO header', () => {
    const product = `000\nFTUS80 KOFF 022000\nTAF AMD KOFF 022000Z 0220/0324 15011KT 9999 SCT020\n     TEMPO 0220/0222 -TSRA BKN020CB=`;
    const taf = parseTaf(product, 'KOFF');
    expect(taf).not.toBeNull();
    // Starts at the body (with its TAF AMD prefix), not the comms header.
    expect(taf!.raw.startsWith('TAF AMD KOFF 022000Z')).toBe(true);
    expect(taf!.validRaw).toBe('0220/0324');
  });
});

describe('parseFdWinds', () => {
  const FD = `000
FBUS33 KWNO 040200
FD1US3
DATA BASED ON 040000Z
VALID 040600Z   FOR USE 0500-0900Z. TEMPS NEG ABV 24000

FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
DEN         2426+14 2431+08 2536+03 2648-09 2762-21 269536 259545 249256
OMA 2118    2426+14 2431+08 2536+03 2648-09 7762-21 269536 259545 249256
`;

  it('decodes direction, speed, and temps for the station row', () => {
    const s = parseFdWinds(FD, 'OMA')!;
    expect(s).not.toBeNull();
    expect(s[0]).toEqual({ heightFtMsl: 3000, speedKt: 18, directionDeg: 210, tempC: null });
    expect(s[1]).toEqual({ heightFtMsl: 6000, speedKt: 26, directionDeg: 240, tempC: 14 });
    expect(s[4]).toEqual({ heightFtMsl: 18000, speedKt: 48, directionDeg: 260, tempC: -9 });
  });

  it('decodes the over-100-kt and implied-negative-temp encodings', () => {
    const s = parseFdWinds(FD, 'OMA')!;
    // 7762-21 at 24000: dd 77 -> 270 deg, speed 62+100
    expect(s[5]).toEqual({ heightFtMsl: 24000, speedKt: 162, directionDeg: 270, tempC: -21 });
    // 269536 at 30000: unsigned temp above 24k is negative
    expect(s[6]).toEqual({ heightFtMsl: 30000, speedKt: 95, directionDeg: 260, tempC: -36 });
  });

  it('handles a blank low-level column via fixed-width slicing', () => {
    const s = parseFdWinds(FD, 'DEN')!;
    expect(s[0].heightFtMsl).toBe(6000); // 3000 column blank for DEN
    expect(s).toHaveLength(8);
  });

  it('treats 9900 as light and variable (calm)', () => {
    const calm = parseFdWinds('FT  3000\nOMA 9900\n', 'OMA')!;
    expect(calm[0].speedKt).toBe(0);
  });

  it('returns null when the station or header is missing', () => {
    expect(parseFdWinds(FD, 'LNK')).toBeNull();
    expect(parseFdWinds('no header here', 'OMA')).toBeNull();
  });
});

describe('aggregateDailyFromHourly', () => {
  const CHI = 'America/Chicago';
  const hour = (iso: string, over: Record<string, number | null> = {}) => ({
    time: Date.parse(iso),
    skyCoverPct: 20,
    ceilingFtAgl: null,
    visibilitySm: null,
    windSpeedKt: 10,
    windGustKt: 18,
    windDirectionDeg: 180,
    precipProbPct: 10,
    thunderProbPct: 0,
    precipAmountIn: 0,
    tempC: 20,
    ...over,
  });

  it('groups by LOCAL day across the UTC boundary', () => {
    // 04:00Z Jul 3 = 11 PM Jul 2 in Chicago (CDT); 06:00Z = 1 AM Jul 3.
    const days = aggregateDailyFromHourly(
      [hour('2026-07-03T04:00:00Z'), hour('2026-07-03T06:00:00Z')],
      CHI,
    );
    expect(days).toHaveLength(2);
  });

  it('aggregates maxima/minima', () => {
    const days = aggregateDailyFromHourly(
      [
        hour('2026-07-03T18:00:00Z', { tempC: 18, windSpeedKt: 8, windGustKt: null }),
        hour('2026-07-03T19:00:00Z', { tempC: 31, windSpeedKt: 16, windGustKt: 24, precipProbPct: 55 }),
        hour('2026-07-03T20:00:00Z', { tempC: 25, windSpeedKt: 12, windGustKt: 20 }),
      ],
      CHI,
    );
    expect(days).toHaveLength(1);
    const d = days[0];
    expect(d.tempMaxC).toBe(31);
    expect(d.tempMinC).toBe(18);
    expect(d.windMaxKt).toBe(16);
    expect(d.gustMaxKt).toBe(24);
    expect(d.precipProbMaxPct).toBe(55);
  });

  // The NWS gridpoint publishes no weather-interpretation code, and this app
  // derives none: the cutoffs it used to derive one through (50 % precip chance
  // → rain, 10/30/60 % cover → clear/mostly clear/partly cloudy/overcast) were
  // its own, and they decided a one-word verdict in the outlook's Sky column.
  it('never invents a weather code, whatever the cover or precip chance', () => {
    const codeFor = (over: Record<string, number | null>): number | null =>
      aggregateDailyFromHourly([hour('2026-07-03T18:00:00Z', over)], CHI)[0].weatherCode;

    for (const sky of [0, 5, 20, 40, 55, 95, 100]) expect(codeFor({ skyCoverPct: sky })).toBeNull();
    for (const pop of [0, 30, 49, 50, 51, 100]) expect(codeFor({ precipProbPct: pop })).toBeNull();
  });

  // The failure this removes: two days a single point apart in rain chance read
  // as "Partly cloudy" and "Rain". They now differ only in the figure the model
  // actually gives, which the outlook prints in its own column.
  it('separates neighbouring days by their precip probability alone', () => {
    const days = aggregateDailyFromHourly(
      [
        hour('2026-07-03T18:00:00Z', { skyCoverPct: 55, precipProbPct: 49 }),
        hour('2026-07-04T18:00:00Z', { skyCoverPct: 55, precipProbPct: 50 }),
      ],
      CHI,
    );
    expect(days).toHaveLength(2);
    expect(days.map((d) => d.precipProbMaxPct)).toEqual([49, 50]);
    expect(days.map((d) => d.weatherCode)).toEqual([null, null]);
  });

  it('keeps a day whose only forecast value is sky cover, and drops empty ones', () => {
    const nulls = {
      skyCoverPct: null,
      precipProbPct: null,
      tempC: null,
      windSpeedKt: null,
      windGustKt: null,
    };
    // Sky cover no longer reaches DailyPoint (it fed the derived code), but the
    // gridpoint's cover series can outrun its temperature and wind series, and
    // the outlook reads the cover for such a day from the hourlies directly.
    const skyOnly = aggregateDailyFromHourly(
      [hour('2026-07-03T18:00:00Z', { ...nulls, skyCoverPct: 70 })],
      CHI,
    );
    expect(skyOnly).toHaveLength(1);
    expect(skyOnly[0].weatherCode).toBeNull();
    // A day with no values at all (the padded tail of the hourly series) is dropped.
    const empty = aggregateDailyFromHourly([hour('2026-07-03T18:00:00Z', nulls)], CHI);
    expect(empty).toHaveLength(0);
  });
});

describe('normalizeOpenMeteo hour selection', () => {
  /** Three hourly steps with distinguishable winds so the assertions can name
   *  which step was picked, not just that some step was. */
  const SERIES: RawOpenMeteo & { elevation: number } = {
    elevation: 360,
    hourly: {
      time: [
        '2026-06-04T12:00:00Z',
        '2026-06-04T13:00:00Z',
        '2026-06-04T14:00:00Z',
      ],
      temperature_2m: [20, 21, 22],
      wind_speed_10m: [10, 20, 30],
      wind_direction_10m: [100, 200, 300],
      wind_speed_850hPa: [11, 21, 31],
      wind_direction_850hPa: [110, 210, 310],
      geopotential_height_850hPa: [1500, 1500, 1500],
      temperature_850hPa: [5, 6, 7],
    },
  };

  it('reports the epoch of the hour it selected', () => {
    const { samples, validMs } = normalizeOpenMeteo(SERIES, Date.parse('2026-06-04T12:05:00Z'));
    expect(validMs).toBe(Date.parse('2026-06-04T12:00:00Z'));
    expect(samples[0].speedKt).toBe(10);
  });

  // The case that hides a real disagreement: past the half hour the NEXT step is
  // nearer, so the card is showing 13:00 winds at 12:31. The reported validMs is
  // what makes that visible instead of silent.
  it('snaps FORWARD to the next hour once it is nearer, and says so', () => {
    const { samples, validMs } = normalizeOpenMeteo(SERIES, Date.parse('2026-06-04T12:31:00Z'));
    expect(validMs).toBe(Date.parse('2026-06-04T13:00:00Z'));
    expect(validMs).toBeGreaterThan(Date.parse('2026-06-04T12:31:00Z'));
    expect(samples[0].speedKt).toBe(20);
    expect(samples[0].directionDeg).toBe(200);
  });

  it('clamps to the last step when now is past the end of the series', () => {
    const { validMs } = normalizeOpenMeteo(SERIES, Date.parse('2026-06-05T09:00:00Z'));
    expect(validMs).toBe(Date.parse('2026-06-04T14:00:00Z'));
  });

  it('reports a null valid time for an empty series', () => {
    const empty = normalizeOpenMeteo({ hourly: { time: [] } }, Date.now());
    expect(empty).toEqual({ samples: [], validMs: null });
  });
});

describe('parseFdTiming', () => {
  const HEADER = [
    'FBUS33 KWNO 040200',
    'FD1US3',
    'DATA BASED ON 040000Z',
    'VALID 040600Z   FOR USE 0500-0900Z. TEMPS NEG ABV 24000',
  ].join('\n');

  it('reads VALID, DATA BASED ON and FOR USE out of the header', () => {
    const t = parseFdTiming(HEADER, Date.parse('2026-06-04T02:00:00Z'));
    expect(t.validMs).toBe(Date.parse('2026-06-04T06:00:00Z'));
    expect(t.basedOnMs).toBe(Date.parse('2026-06-04T00:00:00Z'));
    // Hour-only codes with no day: kept as the bulletin's own text.
    expect(t.forUseRaw).toBe('0500-0900');
  });

  it('resolves the day code into the month nearest the reference time', () => {
    // Bulletin issued 31 May, read just after midnight UTC on 1 June: the "31"
    // must resolve backwards into May, not forwards into a later month.
    const may = 'DATA BASED ON 310000Z\nVALID 310600Z   FOR USE 0500-0900Z.';
    const t = parseFdTiming(may, Date.parse('2026-06-01T01:00:00Z'));
    expect(t.validMs).toBe(Date.parse('2026-05-31T06:00:00Z'));
  });

  it('returns nulls when the header is absent or the codes are impossible', () => {
    expect(parseFdTiming('FT  3000\nOMA 2118\n', Date.now())).toEqual({
      validMs: null,
      basedOnMs: null,
      forUseRaw: null,
    });
    expect(parseFdTiming('VALID 009900Z', Date.parse('2026-06-04T02:00:00Z')).validMs).toBeNull();
  });
});

/**
 * A pressure surface can lie below the model's own terrain — at NE69 the
 * 1000 hPa level runs underground in every hour of the forecast window. What
 * NOAA's post-processor writes there is not model output: it fills the wind
 * with "the lowest level above ground" and the temperature with a 6.5 K/km
 * lapse rate, so the value is a near-surface wind wearing a false altitude.
 * Open-Meteo's own docs say such data should not be used.
 */
describe('normalizeOpenMeteo drops levels below the model terrain', () => {
  /** `levels` are [hPa, geopotential height in m, wind speed kt] — distinct
   *  speeds so a surviving sample can be told from a dropped one. */
  const at = (elevation: number, levels: Array<[number, number, number]>) => {
    const hourly: Record<string, unknown> = {
      time: ['2026-09-22T04:00'],
      wind_speed_10m: [6],
      wind_direction_10m: [36],
      temperature_2m: [16],
    };
    for (const [hPa, gphM, spd] of levels) {
      hourly[`wind_speed_${hPa}hPa`] = [spd];
      hourly[`wind_direction_${hPa}hPa`] = [270];
      hourly[`geopotential_height_${hPa}hPa`] = [gphM];
      hourly[`temperature_${hPa}hPa`] = [-40];
    }
    return normalizeOpenMeteo(
      { elevation, hourly } as never,
      Date.parse('2026-09-22T04:00:00Z'),
    );
  };

  it('keeps a level above the terrain and drops one below it', () => {
    // Model surface 349 m. 1000 hPa underground at 173 m; 925 hPa above at 836 m.
    const { samples } = at(349, [
      [1000, 173, 99],
      [925, 836, 12],
    ]);
    // Only the 10 m sample (6 kt) and the above-ground 925 hPa level (12 kt).
    expect(samples.map((s) => s.speedKt)).toEqual([6, 12]);
    expect(samples.some((s) => s.speedKt === 99)).toBe(false);
  });

  it('keeps a level sitting exactly at the terrain height', () => {
    const { samples } = at(349, [[1000, 349, 99]]);
    expect(samples.some((s) => s.speedKt === 99)).toBe(true);
  });

  /* Without the filter this is the damaging case: no 10 m wind, so the Surface
   * row would have been built mostly out of a wind stamped below ground. With
   * it, the only sample left is the one genuinely above ground. */
  it('leaves no underground sample to stand in for a missing surface wind', () => {
    const hourly: Record<string, unknown> = {
      time: ['2026-09-22T04:00'],
      wind_speed_1000hPa: [99],
      wind_direction_1000hPa: [270],
      geopotential_height_1000hPa: [173],
      temperature_1000hPa: [-40],
      wind_speed_925hPa: [12],
      wind_direction_925hPa: [200],
      geopotential_height_925hPa: [836],
      temperature_925hPa: [10],
    };
    const { samples } = normalizeOpenMeteo(
      { elevation: 349, hourly } as never,
      Date.parse('2026-09-22T04:00:00Z'),
    );
    expect(samples).toHaveLength(1);
    expect(samples[0].speedKt).toBe(12);
  });
});

describe('Open-Meteo pressure levels', () => {
  // On 2026-09-23 a same-hour comparison with Mark Schulze's Winds Aloft (the
  // same Open-Meteo data at twenty levels) was 38° apart at 6,000 ft: 850 hPa
  // sits near 4,000 ft AGL here and 700 hPa near 9,300, and a wind that backed
  // between them was drawn as a straight line. These four levels close the
  // gaps; the request and the fixture profile must both carry them.
  it('asks Open-Meteo for the levels that fill the freefall column', () => {
    const vars = openMeteoHourlyVariables();
    for (const p of [975, 950, 900, 800, 750, 650, 550]) {
      expect(vars).toContain(`wind_speed_${p}hPa`);
      expect(vars).toContain(`wind_direction_${p}hPa`);
      expect(vars).toContain(`geopotential_height_${p}hPa`);
      expect(vars).toContain(`temperature_${p}hPa`);
    }
  });

  it('builds the winds request the normaliser expects', () => {
    // The fetch and the live comparison script both send this URL, and the
    // normaliser assumes what it asks for: knots, Unix times in UTC, and
    // every level above. A builder that dropped a parameter would still pass
    // every fixture test, so the query is pinned here.
    const url = new URL(openMeteoWindsUrl(40.8675, -96.11));
    expect(`${url.origin}${url.pathname}`).toBe(OPEN_METEO_FORECAST_URL);
    expect(url.searchParams.get('latitude')).toBe('40.8675');
    expect(url.searchParams.get('longitude')).toBe('-96.11');
    expect(url.searchParams.get('hourly')?.split(',')).toEqual(openMeteoHourlyVariables());
    expect(url.searchParams.get('wind_speed_unit')).toBe('kn');
    expect(url.searchParams.get('forecast_days')).toBe('2');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
    expect(url.searchParams.get('timezone')).toBe('UTC');
  });

  it('reads the 800 and 750 hPa samples between 850 and 700 hPa from the fixture', () => {
    const { samples } = normalizeOpenMeteo(OPEN_METEO_FIXTURE, hourStartMs());
    const h850 = mToFt(OPEN_METEO_FIXTURE.hourly.geopotential_height_850hPa[0] as number);
    const h700 = mToFt(OPEN_METEO_FIXTURE.hourly.geopotential_height_700hPa[0] as number);
    const between = samples.filter((x) => x.heightFtMsl > h850 + 1 && x.heightFtMsl < h700 - 1);
    expect(between).toHaveLength(2);
    // And through the 13,000 ft column (up to 600 hPa) no two consecutive
    // samples are further apart than ~2,200 ft; with six levels the 850 → 700
    // gap was over 5,000 ft.
    const h600 = mToFt(OPEN_METEO_FIXTURE.hourly.geopotential_height_600hPa[0] as number);
    const heights = samples
      .map((x) => x.heightFtMsl)
      .filter((h) => h <= h600 + 1)
      .sort((a, b) => a - b);
    const gaps = heights.slice(1).map((h, i) => h - heights[i]);
    expect(Math.max(...gaps)).toBeLessThan(2500);
  });
});
