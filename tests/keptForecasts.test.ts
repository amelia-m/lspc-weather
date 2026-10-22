import { describe, expect, it } from 'vitest';
import type { KeptGridpointSnapshot, KeptProperties } from '../src/domain/ceilingHeights';
import type { MetarRecord } from '../src/domain/cloudCoverSources';
import {
  angleDiff,
  asReported,
  keptInstantRecords,
  metarVisibilitySm,
  pairInstants,
  readInstant,
  summarizeInstants,
  summarizeRain,
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

  it('measures direction differences the short way round', () => {
    expect(angleDiff(350, 10)).toBe(-20);
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(0, 180)).toBe(180);
    expect(angleDiff(150, 140)).toBe(10);
  });

  it('reads the forecast visibility as a report would: whole miles from 3 SM, quarters below', () => {
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

  it('picks the newest issuance at least the row’s lead before the hour, and the report within 10 minutes of it', () => {
    const snaps = [snap(T - 30 * H, { kt: 2 }), snap(T - 8 * H, { kt: 4 }), snap(T - 1 * H, { kt: 6 })];
    const at = (lead: number) => pairInstants(snaps, metars, lead, 48).find((p) => p.t === T);
    expect(at(0)?.fc.windSpeed).toBeCloseTo(6);
    expect(at(6)?.fc.windSpeed).toBeCloseTo(4);
    expect(at(24)?.fc.windSpeed).toBeCloseTo(2);
    expect(at(0)?.obs.t).toBe(T - 5 * 60_000);
  });

  it('leaves out an hour with no report near its start, and one past the reach of what was gathered', () => {
    const snaps = [snap(T - 1 * H, { kt: 6 })];
    // T+H's nearest report is 25 minutes before it.
    expect(pairInstants(snaps, metars, 0, 48).map((p) => p.t)).toEqual([T]);
    // At 24 h ahead, T is far past the one issuance's reach.
    expect(pairInstants(snaps, metars, 24, 6)).toEqual([]);
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

describe('summarizeRain', () => {
  // A six-hour period from T, and the station's :55 reports through it.
  const qpf = (updateMs: number, mm: number): KeptGridpointSnapshot =>
    snap(updateMs, {}, { quantitativePrecipitation: { uom: 'wmoUnit:mm', values: [{ validTime: vt(T, 6), value: mm }] } });
  const hourly = (amounts: (string | null)[]) =>
    amounts.flatMap((p, i) => (p === null ? [] : [metar(T + i * H + 55 * 60_000, '02004KT 5SM RA OVC010 12/12', p)]));

  it('sets the period total against the hourly amounts added up', () => {
    const rows = summarizeRain([qpf(T - 2 * H, 10.16), qpf(T - 8 * H, 2.54)], hourly(['P0010', '', 'P0005', '', '', 'P0001']));
    expect(rows[0].periods).toEqual([{ start: iso(T), issued: iso(T - 2 * H).replace('.000Z', '+00:00'), fc: 0.4, obs: 0.16 }]);
    expect(rows[1].periods[0].fc).toBe(0.1);
    expect(rows[2].periods).toEqual([]);
  });

  it('leaves out a period with an hour it cannot add', () => {
    expect(summarizeRain([qpf(T - 2 * H, 1)], hourly(['', '', null, '', '', '']))[0].periods).toEqual([]);
    expect(summarizeRain([qpf(T - 2 * H, 1)], hourly(['', 'P////', '', '', '', '']))[0].periods).toEqual([]);
  });
});
