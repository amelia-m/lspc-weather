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

  it('reads the header: station, version, and the cycle', () => {
    expect(f.station).toBe('KPMV');
    expect(f.version).toBe('5.0');
    expect(f.cycleMs).toBe(Date.UTC(2026, 9, 24, 3));
  });

  it('dates the hours from the cycle, rolling to the next day past 23Z', () => {
    expect(f.hours).toHaveLength(25);
    expect(f.hours[0].time).toBe(Date.UTC(2026, 9, 24, 4));
    expect(f.hours[19].time).toBe(Date.UTC(2026, 9, 24, 23));
    expect(f.hours[20].time).toBe(Date.UTC(2026, 9, 25, 0));
    expect(f.hours[24].time).toBe(Date.UTC(2026, 9, 25, 4));
  });

  it('dates the 23Z cycle’s hours, which all begin at 00, to the next day from the first', () => {
    // As the bucket's 23Z file is headed (read 2026-10-27): the cycle on
    // the 26th, the hours 00 to 00 all on the 27th and the last on the 28th.
    const night = NBH.replace('10/24/2026  0300 UTC', '10/26/2026  2300 UTC').replace(
      /^ UTC .*$/m,
      ` UTC  ${Array.from({ length: 25 }, (_, i) => String(i % 24).padStart(2, '0')).join(' ')} `,
    );
    const g = parseNbhBlock(night)!;
    expect(g.cycleMs).toBe(Date.UTC(2026, 9, 26, 23));
    expect(g.hours[0].time).toBe(Date.UTC(2026, 9, 27, 0));
    expect(g.hours[23].time).toBe(Date.UTC(2026, 9, 27, 23));
    expect(g.hours[24].time).toBe(Date.UTC(2026, 9, 28, 0));
  });

  it('stops at another station’s header, so loosely cut text cannot hand it the neighbour’s rows', () => {
    const two = `${NBH}\n KPMZ   NBM V5.0 NBH GUIDANCE    10/24/2026  0300 UTC\n UTC  04 05\n LCB  10 10`;
    expect(parseNbhBlock(two)!.hours[0].lowestBaseFtAgl).toBe(20000);
    expect(parseNbhBlock(two)!.hours).toHaveLength(25);
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
    expect(f.cycleMs).toBe(Date.UTC(2026, 10, 3, 14));
    expect(f.hours[0].time).toBe(Date.UTC(2026, 10, 3, 15));
    expect(f.hours[24].time).toBe(Date.UTC(2026, 10, 4, 15));
    expect(f.hours[0].lowestBaseFtAgl).toBe(20000);
  });
});
