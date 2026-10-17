import { describe, expect, it } from 'vitest';
import {
  CHANCE_BINS,
  CHANCE_EVENT,
  keptChanceRecords,
  reportedHours,
  summarizeChances,
  type ChanceForecast,
  type ReportedHour,
} from '../src/domain/chances';
import type { KeptGridpointSnapshot } from '../src/domain/ceilingHeights';
import type { MetarRecord } from '../src/domain/cloudCoverSources';

const H = 3_600_000;
const T = Date.parse('2026-10-15T10:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

const snap = (values: { validTime: string; value: number | null }[], updateTime = '2026-10-15T08:05:00+00:00'): KeptGridpointSnapshot => ({
  at: '2026-10-15T08:23:00Z',
  nwsGridpoint: {
    url: 'https://api.weather.gov/gridpoints/OAX/77,42',
    updateTime,
    properties: { probabilityOfPrecipitation: { uom: 'wmoUnit:percent', values }, probabilityOfThunder: null },
  },
});

describe('keptChanceRecords', () => {
  it('gives each hour of a run of equal hours its value, issued at the update time', () => {
    const recs = keptChanceRecords(
      snap([
        { validTime: '2026-10-15T10:00:00+00:00/PT3H', value: 40 },
        { validTime: '2026-10-15T13:00:00+00:00/PT1H', value: null },
        { validTime: '2026-10-15T14:00:00+00:00/PT1H', value: 5 },
      ]),
      'probabilityOfPrecipitation',
    );
    expect(recs.map((r) => [r.valid.slice(11, 13), r.chance])).toEqual([['10', 40], ['11', 40], ['12', 40], ['14', 5]]);
    expect(new Set(recs.map((r) => r.issued))).toEqual(new Set(['2026-10-15T08:05:00+00:00']));
  });

  it('gives nothing for a failed fetch or a missing property, and refuses a unit it does not know', () => {
    expect(keptChanceRecords({ at: 'x', nwsGridpoint: { error: 'HTTP 500' } }, 'probabilityOfPrecipitation')).toEqual([]);
    expect(keptChanceRecords(snap([]), 'probabilityOfThunder')).toEqual([]);
    const bad = snap([{ validTime: '2026-10-15T10:00:00+00:00/PT1H', value: 1 }]);
    (bad.nwsGridpoint as { properties: { probabilityOfPrecipitation: { uom: string } } }).properties.probabilityOfPrecipitation.uom = 'wmoUnit:mm';
    expect(() => keptChanceRecords(bad, 'probabilityOfPrecipitation')).toThrow(/wmoUnit:mm/);
  });
});

// KPMV's reports, as on 2026-10-15: :15, :35 and :55, the `P` group the
// amount since the last :55 report.
const m = (hh: number, mm: number, wx: string, rmk = ''): MetarRecord => ({
  src: 'metar',
  obsAt: `2026-10-15T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`,
  raw: `KPMV 15${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}Z AUTO 02004KT 5SM ${wx} OVC003 12/12 A3001 RMK AO2 ${rmk}`.trim(),
});
const hourOf = (hours: ReportedHour[], hh: number) => hours.find((h) => new Date(h.t).getUTCHours() === hh);

describe('reportedHours', () => {
  const hours = reportedHours([
    // 09Z: drizzle with no P group: precipitation, none measurable.
    m(9, 15, '-DZ'), m(9, 35, ''), m(9, 55, ''),
    // 10Z: rain with 0.06 in. on the hourly report.
    m(10, 15, ''), m(10, 35, ''), m(10, 55, 'RA', 'P0006'),
    // 11Z: only a trace in the remarks: precipitation, none measurable.
    m(11, 15, ''), m(11, 35, ''), m(11, 55, '', 'P0000'),
    // 12Z: thunder and rain in the vicinity only, written with intensity
    // before VC, as KPMV did on 2026-10-13; then mist, which is weather
    // but not precipitation.
    m(12, 15, '-VCTSRA'), m(12, 35, 'BR'), m(12, 55, ''),
    // 13Z: thunder at the station, and a gauge that could not say.
    m(13, 15, 'TSRA'), m(13, 35, ''), m(13, 55, '', 'P////'),
    // 14Z: lightning sensor out, a plain VCTS.
    m(14, 15, 'VCTS'), m(14, 35, ''), m(14, 55, '', 'TSNO'),
    // 15Z: no hourly report, so the hour is left out though it rained.
    m(15, 15, 'RA', 'P0002'), m(15, 35, 'RA', 'P0004'),
    // A report seen twice counts as once.
    m(10, 55, 'RA', 'P0006'),
  ]);

  it('counts only hours holding the hourly report', () => {
    expect(hours.map((h) => new Date(h.t).getUTCHours())).toEqual([9, 10, 11, 12, 13, 14]);
  });

  it('reads a measurable amount from the P group alone', () => {
    expect(hourOf(hours, 9)).toMatchObject({ measurable: false, precip: true });
    expect(hourOf(hours, 10)).toMatchObject({ measurable: true, precip: true });
    expect(hourOf(hours, 11)).toMatchObject({ measurable: false, precip: true });
    expect(hourOf(hours, 13)?.measurable).toBeNull();
  });

  it('tells thunder at the station from thunder in the vicinity, and an unknown from a no', () => {
    expect(hourOf(hours, 12)).toMatchObject({ ts: false, vcts: true, precip: false, measurable: false });
    expect(hourOf(hours, 13)).toMatchObject({ ts: true, vcts: false });
    expect(hourOf(hours, 14)).toMatchObject({ ts: null, vcts: true });
    expect(hourOf(hours, 10)?.ts).toBe(false);
  });
});

describe('CHANCE_BINS', () => {
  it('cover 0 to 100 once each', () => {
    const covered = CHANCE_BINS.flatMap((b) => Array.from({ length: b.hi - b.lo + 1 }, (_, i) => b.lo + i));
    expect(covered).toEqual(Array.from({ length: 101 }, (_, i) => i));
  });
});

describe('summarizeChances', () => {
  const fc = (issuedH: number, validT: number, chance: number): ChanceForecast => ({
    issued: iso(validT - issuedH * H),
    valid: iso(validT),
    chance,
  });
  const hour = (t: number, measurable: boolean | null): ReportedHour => ({ t, measurable, precip: !!measurable, ts: false, vcts: false });

  it('reads each hour from the newest issuance at least the row’s lead before it, and counts by bin', () => {
    const rows = summarizeChances(
      [fc(1, T, 70), fc(8, T, 30), fc(30, T, 5), fc(1, T + H, 0), fc(8, T + H, 15)],
      [hour(T, true), hour(T + H, false)],
      CHANCE_EVENT.probabilityOfPrecipitation,
    );
    const [latest, six, day] = rows;
    expect(latest.pairs.map((p) => p.chance)).toEqual([70, 0]);
    expect(six.pairs.map((p) => p.chance)).toEqual([30, 15]);
    expect(day.pairs.map((p) => p.chance)).toEqual([5]);
    expect(latest).toMatchObject({ hours: 2, events: 1, chanceSum: 70, leadH: { min: 1, max: 1 } });
    const bin = (lo: number) => latest.bins.find((b) => b.lo === lo);
    expect(bin(70)).toMatchObject({ hours: 1, events: 1, chanceSum: 70 });
    expect(bin(0)).toMatchObject({ hours: 1, events: 0, chanceSum: 0 });
    expect(six.bins.find((b) => b.lo === 10)).toMatchObject({ hours: 1, events: 0 });
  });

  it('leaves out an hour whose outcome is unknown, and hours past the reach of what was gathered', () => {
    const rows = summarizeChances(
      [fc(1, T, 50), fc(1, T + H, 50), fc(9, T + 9 * H, 50)],
      [hour(T, null), hour(T + H, true), hour(T + 9 * H, true)],
      CHANCE_EVENT.probabilityOfPrecipitation,
    );
    // The last issuance is at T, and holds T + 9 h; that hour is past
    // END_REACH_H (6 h) of it, so a later fetch's reports are not scored
    // against the forecast this one ended on.
    expect(rows[0].pairs.map((p) => p.valid)).toEqual([iso(T + H)]);
  });
});
