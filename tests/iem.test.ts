import { describe, expect, it } from 'vitest';
import { chooseObservation, normalizeIemCurrent, supersedes, type RawIemCurrent } from '../src/domain/iem';
import type { CurrentConditions } from '../src/domain/types';

/** IEM's current record for KPMV as a GitHub runner fetched it at 20:45Z on
 *  2026-09-27 (every field the normaliser reads, verbatim). */
const REC: RawIemCurrent = {
  station: 'PMV',
  utc_valid: '2026-09-27T20:35:00Z',
  raw: 'KPMV 272035Z AUTO 03003KT 10SM SCT037 SCT043 SCT049 25/17 A3003 RMK AO2 T02500173',
  tmpf: 77.0,
  dwpf: 63.0,
  drct: 30.0,
  sknt: 3.0,
  gust: null,
  vsby: 10.0,
  alti: 30.03,
  wxcodes: null,
  skyc1: 'SCT',
  skyl1: 3700,
  skyc2: 'SCT',
  skyl2: 4300,
  skyc3: 'SCT',
  skyl3: 4900,
  skyc4: null,
  skyl4: null,
};

describe('normalizeIemCurrent', () => {
  it('reads the real 20:35Z record the way the cards need it', () => {
    const c = normalizeIemCurrent(REC, 'KPMV')!;
    expect(c).toMatchObject({
      station: 'KPMV',
      source: 'iem',
      observedAt: Date.parse('2026-09-27T20:35:00Z'),
      wind: { directionDeg: 30, speedKt: 3, gustKt: null },
      visibilitySm: 10,
      ceilingFtAgl: null,
      skyDecode: 'agrees',
      tempC: 25,
      altimeterInHg: 30.03,
      wxString: null,
    });
    expect(c.skyLayers).toEqual([
      { cover: 'SCT', baseFtAgl: 3700 },
      { cover: 'SCT', baseFtAgl: 4300 },
      { cover: 'SCT', baseFtAgl: 4900 },
    ]);
  });

  it('takes the dew point from the T group, not IEM’s whole-degree °F', () => {
    // 63.0 °F converts to 17.2 °C; the report says 17.3.
    expect(normalizeIemCurrent(REC, 'KPMV')!.dewpointC).toBe(17.3);
  });

  it('reads the sky from the METAR text before IEM’s decode, and says when the decode disagrees', () => {
    const c = normalizeIemCurrent({ ...REC, raw: REC.raw!.replace('SCT037 SCT043 SCT049', 'OVC027') }, 'KPMV')!;
    expect(c.skyLayers).toEqual([{ cover: 'OVC', baseFtAgl: 2700 }]);
    expect(c.ceilingFtAgl).toBe(2700);
    expect(c.skyDecode).toBe('decode-differs');
  });

  it('falls back to IEM’s decode and °F when the record has no METAR text', () => {
    const c = normalizeIemCurrent({ ...REC, raw: null }, 'KPMV')!;
    expect(c.skyLayers).toHaveLength(3);
    expect(c.skyDecode).toBe('text-empty');
    expect(c.tempC).toBe(25);
    expect(c.dewpointC).toBe(17.2);
  });

  it('gives calm and variable winds no direction', () => {
    expect(normalizeIemCurrent({ ...REC, sknt: 0, drct: 0 }, 'KPMV')!.wind.directionDeg).toBeNull();
    const vrb = normalizeIemCurrent({ ...REC, raw: REC.raw!.replace('03003KT', 'VRB03KT') }, 'KPMV')!;
    expect(vrb.wind.directionDeg).toBeNull();
    expect(vrb.wind.speedKt).toBe(3);
  });

  it('is null without a valid time', () => {
    expect(normalizeIemCurrent({ ...REC, utc_valid: null }, 'KPMV')).toBeNull();
  });
});

describe('chooseObservation', () => {
  const at = (iso: string): CurrentConditions =>
    ({ ...normalizeIemCurrent(REC, 'KPMV')!, source: undefined, observedAt: Date.parse(iso) }) as CurrentConditions;
  const t1 = '2026-09-27T20:35:00Z';
  const t0 = '2026-09-27T20:15:00Z';

  it('shows IEM’s newer report, and remembers when NWS’s was taken', () => {
    const r = chooseObservation(at(t1), at(t0))!;
    expect(r.source).toBe('iem');
    expect(r.current.source).toBe('iem');
    expect(r.otherObservedAt).toBe(Date.parse(t0));
  });

  it('shows NWS when its report is the newer one', () => {
    expect(chooseObservation(at(t0), at(t1))!.source).toBe('nws');
  });

  it('prefers IEM for the same report', () => {
    expect(chooseObservation(at(t1), at(t1))!.source).toBe('iem');
  });

  it('uses whichever answered when the other failed, and null when neither did', () => {
    expect(chooseObservation(null, at(t0))!.source).toBe('nws');
    expect(chooseObservation(at(t0), null)!.source).toBe('iem');
    expect(chooseObservation(null, null)).toBeNull();
  });
});

describe('supersedes', () => {
  const at = (iso: string): CurrentConditions => ({ ...normalizeIemCurrent(REC, 'KPMV')!, observedAt: Date.parse(iso) });
  it('lets a newer or the same report replace the one shown, never an older one', () => {
    expect(supersedes(at('2026-09-27T20:35:00Z'), null)).toBe(true);
    expect(supersedes(at('2026-09-27T20:35:00Z'), at('2026-09-27T20:15:00Z'))).toBe(true);
    expect(supersedes(at('2026-09-27T20:35:00Z'), at('2026-09-27T20:35:00Z'))).toBe(true);
    expect(supersedes(at('2026-09-27T20:15:00Z'), at('2026-09-27T20:35:00Z'))).toBe(false);
  });
});
