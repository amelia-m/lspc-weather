import { describe, expect, it } from 'vitest';
import {
  aggregateDailyFromHourly,
  altimeterFromRaw,
  durationToHours,
  normalizeGridpoint,
  normalizeMetar,
  normalizeNwsObservation,
  normalizeOpenMeteoDaily,
  parseFdWinds,
  parseTaf,
  parseValidTime,
  toSkyCover,
} from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';
import { GRIDPOINT_FIXTURE } from '../src/api/fixtures/gridpoint';
import { OBSERVATION_FIXTURE } from '../src/api/fixtures/observation';
import { TAF_FIXTURE } from '../src/api/fixtures/taf';
import { OPEN_METEO_DAILY_FIXTURE } from '../src/api/fixtures/openMeteoDaily';

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

  it('maps an unrecognized vendor sky-cover string to SKC instead of casting it through', () => {
    const c = normalizeMetar({
      ...METAR_FIXTURE[0],
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
    expect(c.ceilingFtAgl).toBe(4501); // FEW ignored, BKN 1372 m → 4501 ft
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

  it('aggregates maxima/minima and derives a coarse weather code', () => {
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
    expect(d.weatherCode).toBe(61); // pop >= 50 → rain-ish
  });

  it('derives sky-cover codes when precip is low and handles missing data', () => {
    const clear = aggregateDailyFromHourly([hour('2026-07-03T18:00:00Z', { skyCoverPct: 5 })], CHI);
    expect(clear[0].weatherCode).toBe(0);
    const ovc = aggregateDailyFromHourly([hour('2026-07-03T18:00:00Z', { skyCoverPct: 95 })], CHI);
    expect(ovc[0].weatherCode).toBe(3);
    // A day with no values at all (the padded tail of the hourly series) is dropped.
    const empty = aggregateDailyFromHourly(
      [
        hour('2026-07-03T18:00:00Z', {
          skyCoverPct: null,
          precipProbPct: null,
          tempC: null,
          windSpeedKt: null,
          windGustKt: null,
        }),
      ],
      CHI,
    );
    expect(empty).toHaveLength(0);
  });
});
