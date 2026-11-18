import { describe, expect, it } from 'vitest';
import { MAX_DAYS, SLOTS_PER_DAY, buildDayBlocks } from '../src/domain/skyDays';
import { nightIntervals, spanIsNight } from '../src/domain/sun';
import { SITE } from '../src/config/site';
import type { HourlyPoint, NbmHour } from '../src/domain/types';

/* The Ceiling & sky card's day tables, at a fixed clock: 2026-11-18 at
 * 20:00Z, 2 PM Central Standard Time. The NWS hourly runs 48 h from then,
 * the NBM hourly bulletin 25 h from its 19Z cycle, the three-hourly one 23
 * columns from 00Z on the 19th (FHR 5) to 18Z on the 21st (FHR 71). */
const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 18, 20);
const hour = (t: number, i: number): HourlyPoint =>
  ({
    time: t,
    skyCoverPct: 10 + i,
    ceilingFtAgl: i === 3 ? 4500 : null,
    ceilingForecast: i < 30,
    visibilitySm: 10,
    visibilityForecast: true,
    windSpeedKt: 8,
    windGustKt: 12,
    windDirectionDeg: 180,
    precipProbPct: 0,
    thunderProbPct: 0,
    precipAmountIn: 0,
    tempC: 15,
  }) as HourlyPoint;
const hourly = Array.from({ length: 48 }, (_, i) => hour(NOW + i * H, i));
const nbh: NbmHour[] = Array.from({ length: 25 }, (_, i) => ({ time: Date.UTC(2026, 10, 18, 20) + i * H, lowestBaseFtAgl: 2000 + i * 100, ceilingFtAgl: null, skyCoverPct: 30 }));
const nbs: NbmHour[] = Array.from({ length: 23 }, (_, i) => ({
  time: Date.UTC(2026, 10, 19, 0) + i * 3 * H,
  lowestBaseFtAgl: i === 20 ? 26000 : i > 11 ? null : 2400,
  ceilingFtAgl: i === 5 ? 3500 : null,
  skyCoverPct: 20 + i,
}));
const om = hourly.map((h) => ({ time: h.time, totalPct: 5, lowPct: 1, midPct: 2, highPct: 2 }));
const blocks = buildDayBlocks({ now: NOW, hourly, om, nbh, nbs, dz: SITE.dz, timeZone: SITE.timeZone });

describe('buildDayBlocks', () => {
  it('makes one block per local day from today to the last forecast time, at most four, eight slots each', () => {
    expect(blocks.map((b) => b.key)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21']);
    expect(blocks).toHaveLength(MAX_DAYS);
    expect(blocks[0].today).toBe(true);
    expect(blocks[1].today).toBe(false);
    for (const b of blocks) expect(b.slots).toHaveLength(SLOTS_PER_DAY);
  });

  it('leaves today’s slots before the hour under way empty, and fills from it: 2 PM Central is slot 4', () => {
    const today = blocks[0].slots;
    expect(today.slice(0, 4).every((s) => s.time == null && !s.nws && !s.nbs)).toBe(true);
    expect(today[4].time).toBe(NOW);
    expect(today[4].nws?.time).toBe(NOW);
    expect(today[4].om?.totalPct).toBe(5);
    expect(today[4].nbh?.lowestBaseFtAgl).toBe(2000);
    // 6 PM Central is 00Z: the three-hourly bulletin's first column names the slot.
    expect(today[6].nbs?.time).toBe(Date.UTC(2026, 10, 19, 0));
    expect(today[6].time).toBe(Date.UTC(2026, 10, 19, 0));
    expect(today[6].nws?.time).toBe(Date.UTC(2026, 10, 19, 0));
  });

  it('reads each forecast at the slot’s own time exactly, never a neighbour’s, and past its reach gives null', () => {
    const fri = blocks[2].slots;
    // The NWS hourly ends 48 h on, 20Z on the 20th (2 PM); the 3 PM slot has none.
    expect(fri[4].nws?.time).toBe(Date.UTC(2026, 10, 20, 18));
    expect(fri[5].nws).toBeNull();
    expect(fri[5].nbs?.time).toBe(Date.UTC(2026, 10, 20, 21));
    // The hourly bulletin ends 25 h on; Thursday 9 PM has none, the three-hourly's base stands.
    const thu = blocks[1].slots;
    expect(thu[7].nbh).toBeNull();
    expect(thu[7].nbs?.lowestBaseFtAgl).toBe(2400);
  });

  it('marks night by the middle of each slot, from the drop zone’s sunset and sunrise', () => {
    const nights = nightIntervals(SITE.dz.lat, SITE.dz.lon, NOW, NOW + 80 * H);
    for (const b of blocks) {
      for (const s of b.slots) {
        if (s.time == null) expect(s.night).toBe(false);
        else expect(s.night).toBe(spanIsNight(nights, s.time, s.time + 3 * H));
      }
    }
    // November at the DZ: 6 PM and 9 PM are night, noon is not.
    expect(blocks[1].slots[6].night).toBe(true);
    expect(blocks[1].slots[4].night).toBe(false);
  });

  it('lists each day’s NWS hours for the hourly detail, and names where the NWS ceiling forecast ends', () => {
    expect(blocks[0].hours).toHaveLength(10); // 2 PM to 11 PM Central
    expect(blocks[0].hours[0].nws.time).toBe(NOW);
    expect(blocks[0].hours[0].nbh?.lowestBaseFtAgl).toBe(2000);
    expect(blocks[1].hours).toHaveLength(24);
    // ceilingForecast is false from the 31st hour: 02Z on the 20th, 8 PM Thursday.
    expect(blocks[1].nwsCeilingEnds).toBe(NOW + 30 * H);
    expect(blocks[0].nwsCeilingEnds).toBeNull();
    expect(blocks[3].hours).toHaveLength(0);
  });

  it('gives no block at all with no forecast, and only the NWS days without the bulletins', () => {
    expect(buildDayBlocks({ now: NOW, hourly: [], dz: SITE.dz, timeZone: SITE.timeZone })).toEqual([]);
    const nwsOnly = buildDayBlocks({ now: NOW, hourly, dz: SITE.dz, timeZone: SITE.timeZone });
    expect(nwsOnly.map((b) => b.key)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20']);
    expect(nwsOnly[0].slots[4].time).toBe(NOW);
    expect(nwsOnly.every((b) => b.slots.every((s) => s.nbs == null && s.nbh == null))).toBe(true);
  });
});
