import { describe, expect, it } from 'vitest';
import { parseNbhBlock } from '../src/domain/nbm';
import { nbhFixtureText } from '../src/api/fixtures/nbm';

/* KPMV's NBH block of 2026-10-24 03Z, as the relay cuts it: the first of
 * the two blocks in data/parity/nbm-kpmv-2026-10-24-03z.txt (the second is
 * the 3-hourly NBS, which the card does not read). */
const FILES = import.meta.glob('../data/parity/nbm-kpmv-2026-10-24-03z.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const NBH = Object.values(FILES)[0].split('\n\n')[0];

describe('parseNbhBlock', () => {
  const f = parseNbhBlock(NBH)!;

  it('reads the header: station, version, and the cycle as the issue time', () => {
    expect(f.station).toBe('KPMV');
    expect(f.version).toBe('5.0');
    expect(f.issuedMs).toBe(Date.UTC(2026, 9, 24, 3));
  });

  it('dates the hours from the cycle, rolling to the next day past 23Z', () => {
    expect(f.hours).toHaveLength(25);
    expect(f.hours[0].time).toBe(Date.UTC(2026, 9, 24, 4));
    expect(f.hours[19].time).toBe(Date.UTC(2026, 9, 24, 23));
    expect(f.hours[20].time).toBe(Date.UTC(2026, 9, 25, 0));
    expect(f.hours[24].time).toBe(Date.UTC(2026, 9, 25, 4));
  });

  it('reads the fields by position in hundreds of feet: "-88-88140" is unlimited, unlimited, 14,000', () => {
    // CIG -88-88140130130180170160-88…: no ceiling at 04 and 05Z, 14,000 ft at 06Z.
    expect(f.hours.slice(0, 3).map((h) => h.ceilingFtAgl)).toEqual([null, null, 14000]);
    // LCB 200200140120130170160150140140120110100 80 60 50…: a base under every hour.
    expect(f.hours.slice(0, 3).map((h) => h.lowestBaseFtAgl)).toEqual([20000, 20000, 14000]);
    expect(f.hours[13].lowestBaseFtAgl).toBe(8000);
    expect(f.hours[15].lowestBaseFtAgl).toBe(5000);
    expect(f.hours[0].skyCoverPct).toBe(44);
  });

  it('leaves a figure undefined for -99 and for a row the block lacks, and null only for -88', () => {
    const noLcb = NBH.split('\n').filter((l) => !l.startsWith(' LCB')).join('\n');
    expect(parseNbhBlock(noLcb)!.hours[0].lowestBaseFtAgl).toBeUndefined();
    const missing = NBH.replace(/^ LCB 200/m, ' LCB -99');
    expect(parseNbhBlock(missing)!.hours[0].lowestBaseFtAgl).toBeUndefined();
    expect(parseNbhBlock(missing)!.hours[1].lowestBaseFtAgl).toBe(20000);
  });

  it('is null for text that is not an NBH block', () => {
    expect(parseNbhBlock('KPMV 260935Z AUTO 02007KT 10SM CLR 12/08 A3029')).toBeNull();
    expect(parseNbhBlock(NBH.split('\n')[0])).toBeNull();
  });
});

describe('nbhFixtureText', () => {
  it('re-dates the saved block to the hour before now, so its hours overlap the strip', () => {
    const now = Date.UTC(2026, 10, 3, 15, 20);
    const f = parseNbhBlock(nbhFixtureText(now))!;
    expect(f.issuedMs).toBe(Date.UTC(2026, 10, 3, 14));
    expect(f.hours[0].time).toBe(Date.UTC(2026, 10, 3, 15));
    expect(f.hours[24].time).toBe(Date.UTC(2026, 10, 4, 15));
    expect(f.hours[0].lowestBaseFtAgl).toBe(20000);
  });
});
