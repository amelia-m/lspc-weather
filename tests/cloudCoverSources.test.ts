import { describe, expect, it } from 'vitest';
import {
  gapToRange,
  observedCover,
  parseCloudCoverLines,
  reportNear,
  summarizeCloudCover,
  type CloudCoverRecord,
} from '../src/domain/cloudCoverSources';
import { parseSkyGroups } from '../src/domain/normalize';

const cover = (raw: string) => observedCover(parseSkyGroups(raw));

describe('observedCover, by AC 00-45H Table 3-3', () => {
  it('takes the highest-ranked layer, in eighths as percent', () => {
    expect(cover('KPMV 011255Z AUTO 10SM FEW030 SCT050 BKN080 15/10 A3001')).toEqual({ category: 'BKN', loPct: 62.5, hiPct: 87.5 });
    expect(cover('KPMV 011255Z AUTO 10SM SCT040 15/10 A3001')).toEqual({ category: 'SCT', loPct: 37.5, hiPct: 50 });
    expect(cover('KPMV 011255Z AUTO 10SM FEW040 15/10 A3001')).toEqual({ category: 'FEW', loPct: 0, hiPct: 25 });
    expect(cover('KPMV 011255Z AUTO 2SM BR OVC004 15/15 A3001')).toEqual({ category: 'OVC', loPct: 100, hiPct: 100 });
    expect(cover('KPMV 011255Z AUTO 1/4SM FG VV002 15/15 A3001')).toEqual({ category: 'VV', loPct: 100, hiPct: 100 });
  });

  it('reads CLR as none, a heightless layer by its amount, and no sky group as not reported', () => {
    expect(cover('KPMV 011255Z AUTO 10SM CLR 15/10 A3001')).toEqual({ category: 'CLR', loPct: 0, hiPct: 0 });
    expect(cover('KPMV 011255Z 10SM SKC 15/10 A3001')?.category).toBe('CLR');
    expect(cover('KPMV 011255Z AUTO 10SM NCD 15/10 A3001')?.category).toBe('CLR');
    expect(cover('KPMV 011255Z AUTO 10SM BKN/// 15/10 A3001')?.category).toBe('BKN');
    expect(cover('KPMV 011255Z AUTO 10SM 15/10 A3001')).toBeNull();
  });

  it('ignores sky-like tokens in the remarks', () => {
    expect(cover('KPMV 011255Z AUTO 10SM SCT040 15/10 A3001 RMK AO2 OVC V BKN')?.category).toBe('SCT');
  });
});

describe('gapToRange', () => {
  const bkn = { category: 'BKN' as const, loPct: 62.5, hiPct: 87.5 };
  it('is zero inside the range, negative below it and positive above', () => {
    expect(gapToRange(62.5, bkn)).toBe(0);
    expect(gapToRange(87.5, bkn)).toBe(0);
    expect(gapToRange(40, bkn)).toBe(-22.5);
    expect(gapToRange(100, bkn)).toBe(12.5);
  });
});

describe('reportNear', () => {
  const at = (hhmm: string) => ({ t: Date.parse(`2026-10-01T${hhmm}:00Z`), id: hhmm });
  it('takes the :55 report for the top of the hour and not the :15', () => {
    expect(reportNear([at('11:35'), at('11:55'), at('12:15')], Date.parse('2026-10-01T12:00:00Z'))?.id).toBe('11:55');
  });
  it('takes none when nothing is within ten minutes', () => {
    expect(reportNear([at('11:35'), at('12:15')], Date.parse('2026-10-01T12:00:00Z'))).toBeNull();
  });
  it('gives a tie to the earlier report', () => {
    expect(reportNear([at('11:55'), at('12:05')], Date.parse('2026-10-01T12:00:00Z'))?.id).toBe('11:55');
  });
});

describe('summarizeCloudCover', () => {
  const metar = (obsAt: string, sky: string): CloudCoverRecord => ({
    src: 'metar',
    obsAt,
    raw: `KPMV ${obsAt.slice(8, 10)}${obsAt.slice(11, 13)}${obsAt.slice(14, 16)}Z AUTO 10SM ${sky} 15/10 A3001`,
  });
  const ndfd = (issued: string, valid: string, sky: number): CloudCoverRecord => ({
    src: 'ndfd',
    key: `YAUZ98_KWBN_${issued}`,
    issued,
    ref: issued,
    valid,
    sky,
    gridKm: 0.9,
  });
  const om = (valid: string, total: number, high = 0, run: 'historical' | 'previous_day1' = 'historical'): CloudCoverRecord => ({
    src: 'om',
    run,
    valid,
    total,
    low: total - high,
    mid: 0,
    high,
    grid: '40.86,-96.12',
  });

  const records: CloudCoverRecord[] = [
    metar('2026-10-01T11:55Z', 'BKN030'),
    metar('2026-10-01T12:55Z', 'CLR'),
    metar('2026-10-01T13:55Z', ''),
    metar('2026-10-01T14:55Z', 'SCT040'),
    // The 12Z hour. The 06Z file is the latest issued before it; 00Z is the
    // newest at least 6 h ahead. The day before has only 11Z and 05Z, the
    // 17Z and 23Z files missing: the newest at least 24 h ahead is 11Z
    // (24.2 h), which a pick by position in the list would not reach. A file
    // issued after the hour is not a forecast of it.
    ndfd('2026-09-30T05:46Z', '2026-10-01T12:00Z', 10),
    ndfd('2026-09-30T11:46Z', '2026-10-01T12:00Z', 90),
    ndfd('2026-10-01T00:46Z', '2026-10-01T12:00Z', 20),
    ndfd('2026-10-01T06:46Z', '2026-10-01T12:00Z', 70),
    ndfd('2026-10-01T12:46Z', '2026-10-01T12:00Z', 0),
    // 13Z: the 06Z file is both the latest and 6.2 h ahead.
    ndfd('2026-10-01T06:46Z', '2026-10-01T13:00Z', 40),
    ndfd('2026-10-01T06:46Z', '2026-10-01T14:00Z', 40),
    // 15Z, reported SCT: 30% is under SCT's 3/8 but within 0 to 50%.
    ndfd('2026-10-01T06:46Z', '2026-10-01T15:00Z', 30),
    om('2026-10-01T12:00Z', 100),
    om('2026-10-01T13:00Z', 60, 60),
    om('2026-10-01T13:00Z', 10, 0, 'previous_day1'),
  ];
  const s = summarizeCloudCover(records);
  const vs = (source: string) => s.vs.find((x) => x.source === source);

  it('counts hours by what was reported, and a report with no sky group apart', () => {
    expect(s.hoursWithReport).toBe(4);
    expect(s.hoursNoSkyGroup).toBe(1);
    expect(s.observed).toMatchObject({ BKN: 1, CLR: 1, SCT: 1 });
    expect(s.firstHour).toBe('2026-10-01T12:00:00.000Z');
    expect(s.lastHour).toBe('2026-10-01T15:00:00.000Z');
  });

  it('pairs each hour with the latest NWS issuance before it', () => {
    const latest = vs('NWS, latest issuance');
    expect(latest?.n).toBe(3);
    expect(latest?.byObserved.BKN).toMatchObject({ n: 1, inside: 1, median: 70 });
    expect(latest?.byObserved.CLR).toMatchObject({ n: 1, inside: 0, median: 40 });
    expect(latest?.byObserved.SCT).toMatchObject({ n: 1, inside: 0, median: 30 });
    expect([latest?.inside, latest?.below, latest?.above]).toEqual([1, 1, 1]);
    expect(latest?.leadH).toEqual({ min: 5.2, max: 8.2 });
    expect(latest?.sctAtOrBelowHalf).toBe(1);
    expect(latest?.noneOrAll).toBe(0);
    expect(vs('Open-Meteo, a day earlier (total)')?.noneOrAll).toBe(0);
    expect(vs('Open-Meteo, start of run (total)')?.noneOrAll).toBe(1);
    // 12Z: BKN reported, 70 forecast (≥ 5/8); 13Z: CLR, 40; 15Z: SCT, 30.
    expect(latest?.ceiling).toEqual({ bothYes: 1, reportedOnly: 0, forecastOnly: 0, neither: 2 });
  });

  it('picks the earlier NWS issuances by how far ahead they were issued, not by position', () => {
    const six = vs('NWS, 6 h or more ahead');
    expect(six?.byObserved.BKN).toMatchObject({ n: 1, median: 20 });
    expect(six?.byObserved.CLR).toMatchObject({ n: 1, median: 40 });
    expect(six?.leadH).toEqual({ min: 6.2, max: 11.2 });
    expect(six?.ceiling).toEqual({ bothYes: 0, reportedOnly: 1, forecastOnly: 0, neither: 2 });
    const day = vs('NWS, 24 h or more ahead');
    expect(day?.n).toBe(1);
    expect(day?.byObserved.BKN).toMatchObject({ n: 1, median: 90 });
    expect(day?.leadH).toEqual({ min: 24.2, max: 24.2 });
  });

  it('pairs Open-Meteo by run, and compares the two forecasts on the hours both have', () => {
    expect(vs('Open-Meteo, start of run (total)')?.n).toBe(2);
    expect(vs('Open-Meteo, a day earlier (total)')?.byObserved.CLR).toMatchObject({ n: 1, median: 10 });
    expect(vs('Open-Meteo, start of run (low band)')?.byObserved.CLR).toMatchObject({ n: 1, inside: 1 });
    // 13Z: CLR reported, Open-Meteo 60, just under 5/8.
    expect(vs('Open-Meteo, start of run (total)')?.ceiling).toEqual({ bothYes: 1, reportedOnly: 0, forecastOnly: 0, neither: 1 });
    // 12Z: NWS 70 inside BKN, Open-Meteo 100 above; 13Z: 40 and 60 both above CLR.
    expect(s.bothInside).toEqual({ both: 0, nwsOnly: 1, omOnly: 0, neither: 1 });
    expect(s.nwsVsOpenMeteo?.mean).toBe(-25);
    expect(s.omHighWhenClear).toMatchObject({ n: 1, median: 60 });
  });
});

describe('summarizeCloudCover below a top', () => {
  it('reads a report with only high cloud as CLR when given 12,000 ft', () => {
    const records: CloudCoverRecord[] = [
      { src: 'metar', obsAt: '2026-10-01T11:53Z', raw: 'KOMA 011153Z 10SM FEW250 15/10 A3001' },
      { src: 'om', run: 'historical', valid: '2026-10-01T12:00Z', total: 0, low: 0, mid: 0, high: 0, grid: 'x' },
    ];
    expect(summarizeCloudCover(records).observed.FEW).toBe(1);
    expect(summarizeCloudCover(records, 12_000).observed).toMatchObject({ FEW: 0, CLR: 1 });
  });
});

describe('summarizeCloudCover with several sites', () => {
  it('refuses them, so stations are never merged into one', () => {
    const records: CloudCoverRecord[] = [
      { src: 'metar', site: 'PMV', obsAt: '2026-10-01T11:55Z', raw: 'KPMV 011155Z AUTO CLR' },
      { src: 'metar', site: 'OMA', obsAt: '2026-10-01T11:53Z', raw: 'KOMA 011153Z CLR' },
    ];
    expect(() => summarizeCloudCover(records)).toThrow(/2 sites/);
    expect(() => summarizeCloudCover(records.slice(0, 1))).not.toThrow();
  });
});

describe('parseCloudCoverLines', () => {
  it('keeps the three kinds of record and skips the rest', () => {
    const text = [
      '{"src":"metar","obsAt":"2026-10-01T11:55Z","raw":"KPMV 011155Z AUTO CLR"}',
      'not json',
      '{"src":"other"}',
      '',
      '{"src":"om","run":"historical","valid":"2026-10-01T12:00Z","total":1,"low":1,"mid":0,"high":0,"grid":"x"}',
    ].join('\n');
    expect(parseCloudCoverLines(text).map((r) => r.src)).toEqual(['metar', 'om']);
  });
});
