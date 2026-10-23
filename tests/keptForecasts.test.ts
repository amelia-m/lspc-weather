import { describe, expect, it } from 'vitest';
import type { KeptGridpointSnapshot, KeptProperties } from '../src/domain/ceilingHeights';
import type { MetarRecord } from '../src/domain/cloudCoverSources';
import {
  asReported,
  keptInstantRecords,
  metarVisibilitySm,
  pairInstants,
  prepareInstants,
  readInstant,
  summarizeInstants,
  summarizeRain,
  windDiffs,
} from '../src/domain/keptForecasts';

const H = 3_600_000;
const T = Date.parse('2026-10-20T15:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const vt = (ms: number, hours = 1) => `${iso(ms).replace('.000Z', '+00:00')}/PT${hours}H`;

/** A snapshot issued `leadH` before T, every element one value over
 *  T−1h..T+2h, as the API serves them (km/h, degC, m). */
const snap = (
  updateMs: number,
  v: { kt?: number; gustKt?: number; dir?: number; c?: number; m?: number },
  extra: KeptProperties = {},
): KeptGridpointSnapshot => {
  const s = (uom: string, value: number | undefined) =>
    value == null ? null : { uom, values: [{ validTime: vt(T - H, 3), value }] };
  return {
    at: iso(updateMs + 18 * 60_000),
    nwsGridpoint: {
      url: 'https://api.weather.gov/gridpoints/OAX/77,42',
      updateTime: iso(updateMs).replace('.000Z', '+00:00'),
      properties: {
        windSpeed: s('wmoUnit:km_h-1', v.kt == null ? undefined : v.kt * 1.852),
        windGust: s('wmoUnit:km_h-1', v.gustKt == null ? undefined : v.gustKt * 1.852),
        windDirection: s('wmoUnit:degree_(angle)', v.dir),
        temperature: s('wmoUnit:degC', v.c),
        visibility: s('wmoUnit:m', v.m),
        ...extra,
      },
    },
  };
};

const metar = (ms: number, body: string, rmk = ''): MetarRecord => {
  const d = new Date(ms);
  const z = `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
  return { src: 'metar', obsAt: iso(ms).replace(':00.000Z', 'Z'), raw: `KPMV ${z} AUTO ${body} A3030 RMK AO2 ${rmk}`.trim() };
};

describe('keptInstantRecords', () => {
  it('converts the units the API serves, gives each hour of a run its value, and skips null', () => {
    const s = snap(T - 2 * H, { kt: 8, c: 12.5, m: 16093.44 });
    expect(keptInstantRecords(s, 'windSpeed').map((r) => [r.valid, Math.round(r.value * 1000) / 1000])).toEqual([
      [iso(T - H).replace(':00.000Z', 'Z'), 8],
      [iso(T).replace(':00.000Z', 'Z'), 8],
      [iso(T + H).replace(':00.000Z', 'Z'), 8],
    ]);
    expect(keptInstantRecords(s, 'visibility')[0].value).toBeCloseTo(10, 6);
    expect(keptInstantRecords(s, 'windGust')).toEqual([]);
  });

  it('gives no record for an hour the API left null', () => {
    const s = snap(T - 2 * H, {}, {
      temperature: { uom: 'wmoUnit:degC', values: [{ validTime: vt(T, 2), value: null }, { validTime: vt(T + 2 * H), value: 4 }] },
    });
    expect(keptInstantRecords(s, 'temperature').map((r) => [r.valid, r.value])).toEqual([[iso(T + 2 * H).replace(':00.000Z', 'Z'), 4]]);
  });

  it('refuses a unit it does not convert', () => {
    const s = snap(T - 2 * H, {}, { windSpeed: { uom: 'wmoUnit:m_s-1', values: [{ validTime: vt(T), value: 4 }] } });
    expect(() => keptInstantRecords(s, 'windSpeed')).toThrow(/m_s-1/);
  });
});

describe('reading a report', () => {
  it('reads wind, gust, direction, temperature and visibility from the text', () => {
    expect(readInstant(metar(T, '15009G14KT 10SM CLR 25/10', 'T02500104'))).toMatchObject({
      spd: 9,
      gust: 14,
      dir: 150,
      tempC: 25,
      visSm: 10,
    });
  });

  it('gives a calm or variable wind no direction', () => {
    expect(readInstant(metar(T, '00000KT 10SM CLR 10/05'))).toMatchObject({ spd: 0, dir: null, gust: null, tempC: 10 });
    expect(readInstant(metar(T, 'VRB03KT 10SM CLR 10/05'))).toMatchObject({ spd: 3, dir: null });
  });

  it('reads whole, fractional and less-than visibilities', () => {
    expect(metarVisibilitySm('KPMV 151555Z AUTO 02004KT 1 1/4SM BR OVC003 12/12 A3001')).toBe(1.25);
    expect(metarVisibilitySm('KPMV 151555Z AUTO 02004KT 1/2SM FG OVC003 12/12 A3001')).toBe(0.5);
    expect(metarVisibilitySm('KPMV 151555Z AUTO 02004KT M1/4SM FG VV001 12/12 A3001')).toBe(0.25);
    expect(metarVisibilitySm('KPMV 151555Z AUTO 02004KT 2SM BR OVC003 12/12 A3001')).toBe(2);
    expect(metarVisibilitySm('KPMV 151555Z AUTO 02004KT OVC003 12/12 A3001')).toBeNull();
  });

  it('rounds the forecast visibility to the nearest whole mile from 3 SM, quarter below', () => {
    // 16,080 m: a hair under 10 SM, which unrounded counted as "under 10".
    expect(asReported(16080 / 1609.344)).toBe(10);
    expect(asReported(9.29)).toBe(9);
    expect(asReported(3.44)).toBe(3);
    expect(asReported(2.6)).toBe(2.5);
    expect(asReported(0.3)).toBe(0.25);
  });
});

describe('pairInstants', () => {
  const metars = [metar(T - 5 * 60_000, '14006KT 10SM CLR 14/06'), metar(T + H - 25 * 60_000, '14006KT 10SM CLR 14/06')];
  const pairs = (snaps: KeptGridpointSnapshot[], ms: MetarRecord[], lead: number, reach: number) =>
    pairInstants(prepareInstants(snaps, ms), lead, reach);

  it('picks the newest issuance at least the row’s lead before the hour, and the report within 10 minutes of it', () => {
    const snaps = [snap(T - 30 * H, { kt: 2 }), snap(T - 8 * H, { kt: 4 }), snap(T - 1 * H, { kt: 6 })];
    const at = (lead: number) => pairs(snaps, metars, lead, 48).find((p) => p.t === T);
    expect(at(0)?.fc.windSpeed).toBeCloseTo(6);
    expect(at(6)?.fc.windSpeed).toBeCloseTo(4);
    expect(at(24)?.fc.windSpeed).toBeCloseTo(2);
    expect(at(0)?.obs.t).toBe(T - 5 * 60_000);
  });

  it('leaves out an hour with no report within 10 minutes of its start', () => {
    // T+H's nearest report is 25 minutes before it.
    expect(pairs([snap(T - 1 * H, { kt: 6 })], metars, 0, 48).map((p) => p.t)).toEqual([T]);
  });

  it('leaves out an hour past the reach of what was gathered', () => {
    // Issued T−1h, reaching an hour past that: T is in reach, T+H is not,
    // though the snapshot has a value and a report sits at its start.
    const both = [metar(T - 5 * 60_000, '14006KT 10SM CLR 14/06'), metar(T + H - 5 * 60_000, '14006KT 10SM CLR 14/06')];
    expect(pairs([snap(T - 1 * H, { kt: 6 })], both, 0, 48).map((p) => p.t)).toEqual([T, T + H]);
    expect(pairs([snap(T - 1 * H, { kt: 6 })], both, 0, 1).map((p) => p.t)).toEqual([T]);
  });
});

describe('summarizeInstants', () => {
  const hours = [0, 1, 2].map((i) => T + i * H);

  it('splits the gust by whether the station reported one, and direction by the reported speed', () => {
    const snaps = [
      snap(T - 2 * H, {}, {
        windSpeed: { uom: 'wmoUnit:km_h-1', values: [{ validTime: vt(T, 3), value: 8 * 1.852 }] },
        windGust: { uom: 'wmoUnit:km_h-1', values: [{ validTime: vt(T, 3), value: 15 * 1.852 }] },
        windDirection: { uom: 'wmoUnit:degree_(angle)', values: [{ validTime: vt(T, 3), value: 200 }] },
        temperature: { uom: 'wmoUnit:degC', values: [{ validTime: vt(T, 3), value: 10 }] },
        visibility: { uom: 'wmoUnit:m', values: [{ validTime: vt(T, 3), value: 4.6 * 1609.344 }] },
      }),
    ];
    const metars = [
      metar(hours[0] - 5 * 60_000, '19012G20KT 10SM CLR 11/05'),
      metar(hours[1] - 5 * 60_000, '21006KT 5SM BR CLR 09/05'),
      metar(hours[2] - 5 * 60_000, '00000KT 10SM CLR 10/05'),
    ];
    const [latest] = summarizeInstants(snaps, metars, 48);
    expect(latest.hours).toBe(3);
    // 8 against 12, 6 and 0.
    expect(latest.speed?.mean).toBe(2);
    expect(latest.speedMeans).toEqual({ fc: 8, obs: 6 });
    // One hour gave a gust (15 against 20); two did not (15 against 6 and 0).
    expect(latest.gustReported).toEqual({ hours: 1, of: 3 });
    expect(latest.gustSide).toEqual({ above: 0, equal: 0, below: 1 });
    expect(latest.gustWhenReported?.mean).toBe(-5);
    expect(latest.gustWhenNone?.mean).toBe(12);
    // 200 against 190 at 12 kt, against 210 at 6 kt; calm gives none.
    expect(latest.direction.from10kt?.mean).toBe(10);
    expect(latest.direction.under10kt?.mean).toBe(-10);
    expect(latest.temperature?.mean).toBe(0);
    // 4.6 SM reads as 5: under 10 in all three hours, against 10, 5 and 10.
    expect(latest.visibility).toMatchObject({ hours: 3, reportedUnder: 1, forecastUnder: 3, bothUnder: 1 });
    expect(latest.visibility.spread?.mean).toBe(-3.33);
  });
});

describe('windDiffs', () => {
  const pair = (body: string, fc: { windSpeed?: number; windGust?: number; windDirection?: number }) => ({
    t: T,
    issued: iso(T - H),
    fc,
    obs: readInstant(metar(T - 5 * 60_000, `${body} 10SM CLR 10/05`)),
  });

  it('reads speed in whole knots, and the gust against the reported gust where there is one', () => {
    expect(windDiffs(pair('19012G20KT', { windSpeed: 9.6, windGust: 15.4, windDirection: 200 }))).toEqual({
      speed: -2,
      gust: -5,
      gustOverSpeed: null,
      dir: 10,
      reportedSpd: 12,
    });
  });

  it('sets the gust against the steady wind where none was reported, and gives calm and VRB no direction', () => {
    expect(windDiffs(pair('21006KT', { windGust: 15 }))).toMatchObject({ gust: null, gustOverSpeed: 9, speed: null });
    expect(windDiffs(pair('VRB03KT', { windDirection: 200 })).dir).toBeNull();
    expect(windDiffs(pair('00000KT', { windSpeed: 2, windDirection: 200 }))).toMatchObject({ speed: 2, dir: null });
  });
});

describe('summarizeRain', () => {
  // A six-hour period from T (12Z), and the station's :55 reports through it.
  const P = Date.parse('2026-10-20T12:00:00Z');
  const qpf = (updateMs: number, mm: number, values?: { validTime: string; value: number }[]): KeptGridpointSnapshot =>
    snap(updateMs, {}, { quantitativePrecipitation: { uom: 'wmoUnit:mm', values: values ?? [{ validTime: vt(P, 6), value: mm }] } });
  const hourly = (amounts: (string | null)[]) =>
    amounts.flatMap((p, i) => (p === null ? [] : [metar(P + i * H + 55 * 60_000, '02004KT 5SM RA OVC010 12/12', p)]));

  it('sets the period total against the hourly amounts added up', () => {
    const rows = summarizeRain([qpf(P - 2 * H, 10.16), qpf(P - 8 * H, 2.54)], hourly(['P0010', '', 'P0005', '', '', 'P0001']), 48);
    expect(rows[0].periods).toEqual([{ start: iso(P), issued: iso(P - 2 * H).replace('.000Z', '+00:00'), fc: 0.4, obs: 0.16 }]);
    expect(rows[1].periods[0].fc).toBe(0.1);
    expect(rows[2].periods).toEqual([]);
  });

  it('leaves out a period with an hour it cannot add', () => {
    expect(summarizeRain([qpf(P - 2 * H, 1)], hourly(['', '', null, '', '', '']), 48)[0].periods).toEqual([]);
    expect(summarizeRain([qpf(P - 2 * H, 1)], hourly(['', 'P////', '', '', '', '']), 48)[0].periods).toEqual([]);
  });

  it('scores only the six-hour periods on 00, 06, 12 and 18Z', () => {
    // The API also serves shorter ones, 13Z for five hours among them,
    // which would overlap the 12Z period.
    const odd = qpf(P - 2 * H, 0, [
      { validTime: vt(P + H, 5), value: 5 },
      { validTime: vt(P + 6 * H, 3), value: 5 },
    ]);
    expect(summarizeRain([odd], hourly(['', '', '', '', '', '', '', '', '']), 48)[0].periods).toEqual([]);
  });

  it('leaves out a period past the reach of what was gathered', () => {
    // At 24 h ahead the 12Z period needs an issuance by P−24h; the one kept
    // is P−30h, so with a reach of 5 hours past it the period is out, with
    // 48 in.
    const rows = summarizeRain([qpf(P - 30 * H, 1)], hourly(['', '', '', '', '', '']), 5);
    expect(rows[2].periods).toEqual([]);
    expect(summarizeRain([qpf(P - 30 * H, 1)], hourly(['', '', '', '', '', '']), 48)[2].periods).toHaveLength(1);
  });
});
