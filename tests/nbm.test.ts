import { describe, expect, it } from 'vitest';
import { parseNbhBlock, parseNbmBlock, parseNbsBlock } from '../src/domain/nbm';
import { nbhFixtureText, nbsFixtureText } from '../src/api/fixtures/nbm';

/* KPMV's NBH block of 2026-10-24 03Z, as the relay cuts it: the first of
 * the two blocks in data/parity/nbm-kpmv-2026-10-24-03z.txt (the second is
 * the 3-hourly NBS, which the card does not read). */
const FILES = import.meta.glob('../data/parity/nbm-kpmv-2026-10-24-03z.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const NBH = Object.values(FILES)[0].split('\n\n')[0];
/* And KPMV's NBS block of 2026-11-12 01Z, the three-hourly bulletin
 * usairnet's three-day table reads, kept the day the card began reading it. */
const NBS_FILES = import.meta.glob('../data/parity/nbm-kpmv-nbs-2026-11-12-01z.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const NBS = Object.values(NBS_FILES)[0].trimEnd();

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

  it('reads a header with no version token, as the bucket’s has read since the 2026-11-03 12Z cycle', () => {
    // " KPMV   NBM  NBH GUIDANCE    11/03/2026  1200 UTC": two spaces where
    // " V5.0 " was. A pattern that required the token parsed nothing, and
    // the relay answered 502 for twelve hours.
    // The fixture's hours are the 03Z cycle's, so only the header changes.
    const bare = NBH.replace('NBM V5.0 NBH GUIDANCE', 'NBM  NBH GUIDANCE');
    const g = parseNbhBlock(bare)!;
    expect(g.station).toBe('KPMV');
    expect(g.version).toBeNull();
    expect(g.cycleMs).toBe(Date.UTC(2026, 9, 24, 3));
    expect(g.hours).toHaveLength(25);
    expect(g.hours[0].time).toBe(Date.UTC(2026, 9, 24, 4));
  });

  it('stops at another station’s header, so loosely cut text cannot hand it the neighbour’s rows', () => {
    const two = `${NBH}\n KPMZ   NBM V5.0 NBH GUIDANCE    10/24/2026  0300 UTC\n UTC  04 05\n LCB  10 10`;
    expect(parseNbhBlock(two)!.hours[0].lowestBaseFtAgl).toBe(20000);
    expect(parseNbhBlock(two)!.hours).toHaveLength(25);
    // And at one with no version token.
    const bareNext = `${NBH}\n KPMZ   NBM  NBH GUIDANCE    10/24/2026  0300 UTC\n UTC  04 05\n LCB  10 10`;
    expect(parseNbhBlock(bareNext)!.hours).toHaveLength(25);
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

describe('parseNbsBlock', () => {
  const f = parseNbsBlock(NBS)!;

  it('reads the header and names the product and its step', () => {
    expect(f.station).toBe('KPMV');
    expect(f.product).toBe('NBS');
    expect(f.stepHours).toBe(3);
    expect(f.version).toBeNull();
    expect(f.cycleMs).toBe(Date.UTC(2026, 10, 12, 1));
  });

  it('dates each column by its FHR, three hours apart from 5 to 71 hours after the cycle, across the DT row’s three days', () => {
    expect(f.hours).toHaveLength(23);
    expect(f.hours[0].time).toBe(Date.UTC(2026, 10, 12, 6));
    expect(f.hours[1].time).toBe(Date.UTC(2026, 10, 12, 9));
    expect(f.hours[6].time).toBe(Date.UTC(2026, 10, 13, 0));
    expect(f.hours[22].time).toBe(Date.UTC(2026, 10, 15, 0));
  });

  it('reads the ceiling, base and sky of the same three-character fields: a ceiling only at 15Z, bases of 16,000 down to 1,400 ft, then none, then 26,000', () => {
    const at = (h: number) => f.hours.find((x) => x.time === Date.UTC(2026, 10, 12, h))!;
    expect(at(6)).toMatchObject({ ceilingFtAgl: null, lowestBaseFtAgl: 16000, skyCoverPct: 22 });
    expect(at(15)).toMatchObject({ ceilingFtAgl: 3500, lowestBaseFtAgl: 2400, skyCoverPct: 62 });
    expect(f.hours[11]).toMatchObject({ lowestBaseFtAgl: 8000 });
    expect(f.hours[12]).toMatchObject({ lowestBaseFtAgl: null, ceilingFtAgl: null });
    expect(f.hours[19]).toMatchObject({ lowestBaseFtAgl: 26000 });
  });

  it('is strict about the product, as the relay’s paths are one each', () => {
    expect(parseNbsBlock(NBH)).toBeNull();
    expect(parseNbhBlock(NBS)).toBeNull();
    expect(parseNbmBlock(NBS, 'NBS')?.product).toBe('NBS');
  });

  it('dates the fixture’s columns from the hour before now by the FHR row, so the strip finds them', () => {
    const now = Date.UTC(2026, 10, 12, 4, 37);
    const g = parseNbsBlock(nbsFixtureText(now))!;
    expect(g.cycleMs).toBe(Date.UTC(2026, 10, 12, 3));
    expect(g.hours[0].time).toBe(Date.UTC(2026, 10, 12, 8));
    expect(g.hours[22].time).toBe(Date.UTC(2026, 10, 15, 2));
    expect(g.stepHours).toBe(3);
    // The UTC row was recomputed to match, as a reader of the text expects.
    expect(nbsFixtureText(now)).toMatch(/\n UTC {2}08 11 14 17 20 23 02 05/);
  });
});
