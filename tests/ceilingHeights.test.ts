import { describe, expect, it } from 'vitest';
import {
  bandOf,
  forecastCeiling,
  NDFD_MISSING,
  NDFD_NO_CEILING,
  openMeteoByCeilingBand,
  parseCeilingLines,
  reportedCeiling,
  summarizeCeilings,
  type NdfdCeilingRecord,
} from '../src/domain/ceilingHeights';
import { parseSkyGroups } from '../src/domain/normalize';
import type { MetarRecord, OpenMeteoCloudRecord } from '../src/domain/cloudCoverSources';

const layers = (sky: string) => parseSkyGroups(`KPMV 011255Z AUTO 18010KT 10SM ${sky} 20/10 A3000 RMK AO2`);

describe('forecastCeiling', () => {
  it('reads the grid’s codes and holds it to what an AWOS can report', () => {
    expect(forecastCeiling(NDFD_NO_CEILING)).toBe('none');
    expect(forecastCeiling(NDFD_MISSING)).toBeNull();
    expect(forecastCeiling(1371.6)).toBe(4500);
    // 3,700 m is about 12,139 ft: above the 12,000 ft an AWOS reports to.
    expect(forecastCeiling(3700)).toBe('none');
    expect(forecastCeiling(3658)).toBe(12000);
  });

  it('bands the grid’s whole metres as the hundreds of feet they stand for', () => {
    // The archive's 152, 305 and 914 m are 500, 1,000 and 3,000 ft: each
    // on a band's edge, and each a few tenths of a foot under it unrounded.
    expect([152, 305, 914].map((m) => forecastCeiling(m))).toEqual([500, 1000, 3000]);
    expect([152, 305, 914, 918].map((m) => bandOf(forecastCeiling(m) as number))).toEqual(['IFR', 'MVFR', 'MVFR', 'VFR']);
  });
});

describe('reportedCeiling', () => {
  it('is the lowest broken, overcast or vertical-visibility base', () => {
    expect(reportedCeiling(layers('SCT008 BKN015 OVC030'))).toBe(1500);
    expect(reportedCeiling(layers('VV002'))).toBe(200);
    expect(reportedCeiling(layers('FEW020 SCT030'))).toBe('none');
    expect(reportedCeiling(layers('CLR'))).toBe('none');
  });

  it('says none above 12,000 ft, and unknown for a heightless ceiling or no sky group', () => {
    expect(reportedCeiling(layers('BKN150'))).toBe('none');
    expect(reportedCeiling(layers('BKN///'))).toBeNull();
    expect(reportedCeiling(layers('FEW008 BKN/// OVC030'))).toBeNull();
    expect(reportedCeiling([])).toBeNull();
    // A heightless layer above a measured ceiling leaves it known.
    expect(reportedCeiling(layers('OVC005 BKN///'))).toBe(500);
  });
});

describe('bandOf', () => {
  it('uses the flight-category ceiling limits', () => {
    expect([499, 500, 999, 1000, 3000, 3001].map(bandOf)).toEqual(['LIFR', 'IFR', 'IFR', 'MVFR', 'MVFR', 'VFR']);
    expect(bandOf('none')).toBe('none');
  });
});

const T = Date.parse('2026-07-01T18:00:00Z');
const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/:00\.000Z$/, 'Z');
const fc = (issuedH: number, cig: number, site?: string): NdfdCeilingRecord => ({
  src: 'ndfd-cig',
  key: 'k',
  issued: iso(T - issuedH * H),
  ref: iso(T - issuedH * H),
  valid: iso(T),
  cig,
  gridKm: 1,
  ...(site ? { site } : {}),
});
const metar = (minBefore: number, sky: string): MetarRecord => ({
  src: 'metar',
  obsAt: iso(T - minBefore * 60_000),
  raw: `KPMV 011755Z AUTO 18010KT 10SM ${sky} 20/10 A3000 RMK AO2`,
});

describe('summarizeCeilings', () => {
  // KPMV reports BKN015 five minutes before the hour. Issued 2 h before:
  // 610 m (2,001 ft); 8 h before: no ceiling; 26 h before: 300 m (984 ft).
  const rows = summarizeCeilings([fc(2, 610), fc(8, NDFD_NO_CEILING), fc(26, 300)], [metar(5, 'BKN015')]);
  const [latest, six, day] = rows;

  it('takes the newest issuance at least each row’s lead before the hour', () => {
    expect(rows.map((r) => r.hours)).toEqual([1, 1, 1]);
    expect(latest.leadH).toEqual({ min: 2, max: 2 });
    expect(six.leadH).toEqual({ min: 8, max: 8 });
    expect(day.leadH).toEqual({ min: 26, max: 26 });
  });

  it('counts the ceiling call and the height difference, forecast minus reported', () => {
    expect(latest.call).toEqual({ both: 1, forecastOnly: 0, reportedOnly: 0, neither: 0 });
    expect(latest.diffFt).toEqual({ n: 1, median: 500, p10: 500, p90: 500, medianAbs: 500 });
    expect(six.call.reportedOnly).toBe(1);
    expect(six.diffFt).toBeNull();
    expect(day.diffFt?.median).toBe(-520);
  });

  it('gives the difference by the reported ceiling’s band', () => {
    // A low reported ceiling forecast high and a high one forecast low: the
    // overall median says nothing of either, the band medians do.
    const t2 = T + H;
    const at = (t: number, cig: number): NdfdCeilingRecord => ({ ...fc(2, cig), issued: iso(t - 2 * H), ref: iso(t - 2 * H), valid: iso(t) });
    const later: MetarRecord = { src: 'metar', obsAt: iso(t2 - 5 * 60_000), raw: 'KPMV 011855Z AUTO 18010KT 10SM OVC080 20/10 A3000 RMK AO2' };
    const [row] = summarizeCeilings([at(T, 610), at(t2, 1219)], [metar(5, 'OVC003'), later]);
    expect(row.diffByBand.LIFR).toEqual({ n: 1, median: 1700 });
    expect(row.diffByBand.VFR).toEqual({ n: 1, median: -4000 });
    expect(row.diffByBand.IFR).toEqual({ n: 0, median: null });
    // Grouped by the forecast's band instead: 610 m (2,000 ft) is MVFR,
    // 1,219 m (4,000 ft) VFR.
    expect(row.diffByForecastBand.MVFR).toEqual({ n: 1, median: 1700 });
    expect(row.diffByForecastBand.VFR).toEqual({ n: 1, median: -4000 });
    expect(row.diffByForecastBand.LIFR).toEqual({ n: 0, median: null });
  });

  it('tables each side’s band', () => {
    expect(latest.bands.MVFR.MVFR).toBe(1);
    expect(latest.sameBand).toBe(1);
    expect(six.bands.MVFR.none).toBe(1);
    expect(day.bands.MVFR.IFR).toBe(1);
    expect(day.sameBand).toBe(0);
  });

  it('skips an issuance made after the hour, a missing value, and an hour with no usable report', () => {
    const late = { ...fc(2, 610), issued: iso(T + 10 * 60_000) };
    expect(summarizeCeilings([late], [metar(5, 'BKN015')])[0].hours).toBe(0);
    expect(summarizeCeilings([fc(2, NDFD_MISSING)], [metar(5, 'BKN015')])[0].hours).toBe(0);
    // A missing value in the newest issuance gives way to the one before.
    const [fallback] = summarizeCeilings([fc(2, NDFD_MISSING), fc(4, 610)], [metar(5, 'BKN015')]);
    expect(fallback.leadH).toEqual({ min: 4, max: 4 });
    expect(summarizeCeilings([fc(2, 610)], [metar(5, 'BKN///')])[0].hours).toBe(0);
    // Outside the ten-minute window.
    expect(summarizeCeilings([fc(2, 610)], [metar(15, 'BKN015')])[0].hours).toBe(0);
  });

  it('refuses forecasts from two grid points at once', () => {
    expect(() => summarizeCeilings([fc(2, 610, 'PMV'), fc(2, 610, 'DZ')], [])).toThrow(/2 sites/);
  });
});

describe('openMeteoByCeilingBand', () => {
  const om = (run: OpenMeteoCloudRecord['run'], low: number, mid: number, total: number): OpenMeteoCloudRecord => ({
    src: 'om',
    run,
    valid: iso(T),
    total,
    low,
    mid,
    high: 0,
    grid: '',
  });

  it('counts the start of run’s bands at or above 5/8 by the reported ceiling’s band', () => {
    const rows = openMeteoByCeilingBand([om('historical', 80, 10, 80), om('previous_day1', 0, 0, 0)], [metar(5, 'OVC004')]);
    expect(rows.find((r) => r.band === 'LIFR')).toEqual({ band: 'LIFR', hours: 1, low: 1, mid: 0, total: 1 });
    expect(rows.filter((r) => r.band !== 'LIFR').every((r) => r.hours === 0)).toBe(true);
    // 62.5% is 5/8 exactly, and counts; 62 does not.
    const edge = openMeteoByCeilingBand([om('historical', 62.5, 62, 62)], [metar(5, 'BKN020')]);
    expect(edge.find((r) => r.band === 'MVFR')).toMatchObject({ low: 1, mid: 0, total: 0 });
  });
});

describe('parseCeilingLines', () => {
  it('keeps ceiling records only', () => {
    const text = [JSON.stringify(fc(2, 610)), '{"src":"ndfd","sky":50}', 'not json', ''].join('\n');
    expect(parseCeilingLines(text)).toHaveLength(1);
  });
});
