/**
 * The Ceiling & sky card's day tables: the forecasts it reads, cut into
 * one block per local day of eight three-hour slots, so the same hour sits
 * in the same column of every block and a reader compares days by
 * scanning down (docs/ceiling-sky-layout-review.md and
 * docs/data-viz-notes.md, 2026-11-18, the maintainer's word that day to
 * build the readings' recommendation: usairnet's day-table form, which
 * jumpers know, with the cloud heights drawn the right way up).
 *
 * Three forecasts meet here and are never blended: the NWS gridpoint's
 * hourly sky cover and ceiling (and Open-Meteo's cloud cover beside it,
 * matched by hour), the NBM's hourly bulletin (NBH: its lowest cloud base,
 * 25 hours), and the NBM's three-hourly bulletin (NBS: sky cover, ceiling
 * and base, 6 to 72 hours). A slot's own time is the three-hourly
 * bulletin's column where it has one (its columns fall on UTC multiples
 * of three, which are local multiples of three in Central Standard Time
 * and one past in Daylight Time), else the earliest hour any forecast
 * has in the slot: its start hour, or the hour under way for the slot
 * that holds it; the hourly figures are read at that time, exactly,
 * never a neighbour's.
 * A slot before the hour under way, or past every forecast, is empty: a
 * blank cell, not a dash, since a dash read as missing data (the review's
 * fifth finding).
 *
 * Night is the drop zone's, sunset to sunrise (sun.ts, the night flag's
 * times); a slot goes by the middle of its three hours (spanIsNight).
 *
 * Pure: the clock, the forecasts and the zone come in; nothing is read.
 * Nothing here grades a slot: figures, their times and a night fact.
 */
import type { HourlyPoint, NbmHour, OpenMeteoCloudHour } from './types';
import { nightIntervals, spanIsNight } from './sun';

export const SLOTS_PER_DAY = 8;
export const SLOT_HOURS = 3;
/** Days shown at most: today and the three the three-hourly bulletin
 *  reaches (its 66 hours cross three or four local dates). */
export const MAX_DAYS = 4;

export interface DaySlot {
  /** 0 to 7: the local three-hour slot, floor(local hour / 3). */
  index: number;
  /** The slot's own time (see above), or null for an empty slot. */
  time: number | null;
  nws: HourlyPoint | null;
  om: OpenMeteoCloudHour | null;
  /** The hourly bulletin's hour at the slot's time. */
  nbh: NbmHour | null;
  /** The three-hourly bulletin's column in the slot. */
  nbs: NbmHour | null;
  night: boolean;
}

export interface DayBlock {
  /** The local date, "2026-11-18". */
  key: string;
  /** The first time in the block, for its heading. */
  firstTime: number;
  today: boolean;
  slots: DaySlot[];
  /** The NWS hours of this local day from the hour under way on, for the
   *  block's hourly detail, each with Open-Meteo's and the NBH's figures
   *  at the same hour. */
  hours: { nws: HourlyPoint; om: OpenMeteoCloudHour | null; nbh: NbmHour | null; night: boolean }[];
  /** The slots left in the day by the clock, the hour under way's
   *  included: eight for any day but today. The card shows today as its
   *  hourly rows alone when two or fewer remain, whatever they hold. */
  slotsLeft: number;
}

export interface SkyDaysInput {
  now: number;
  hourly: readonly HourlyPoint[];
  om?: readonly OpenMeteoCloudHour[] | null;
  nbh?: readonly NbmHour[] | null;
  nbs?: readonly NbmHour[] | null;
  dz: { lat: number; lon: number };
  timeZone: string;
}

const HOUR = 3_600_000;

/** "2026-11-18" at the drop zone. One formatter per call set: the card
 *  builds its blocks once per render. */
function dateKeyIn(timeZone: string): (ms: number) => string {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone });
  return (ms) => f.format(ms);
}
function localHourIn(timeZone: string): (ms: number) => number {
  const f = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone });
  return (ms) => Number(f.format(ms));
}

/** The blocks, today first, at most MAX_DAYS, each day's slots by local
 *  hour. A day with no forecast of any kind in it is not a block. */
export function buildDayBlocks(input: SkyDaysInput): DayBlock[] {
  const { now, timeZone, dz } = input;
  const dateKey = dateKeyIn(timeZone);
  const localHour = localHourIn(timeZone);
  const hourUnderWay = Math.floor(now / HOUR) * HOUR;
  const todayKey = dateKey(now);

  const nws = input.hourly.filter((h) => h.time >= hourUnderWay);
  const nwsAt = new Map(nws.map((h) => [h.time, h]));
  const omAt = new Map((input.om ?? []).map((c) => [c.time, c]));
  const nbhAt = new Map((input.nbh ?? []).filter((h) => h.time >= hourUnderWay).map((h) => [h.time, h]));
  const nbsCols = (input.nbs ?? []).filter((h) => h.time >= hourUnderWay);

  // Every time any forecast has, from the hour under way: the days are
  // the local dates those times fall on, in order, today first.
  const times = [...new Set([...nws.map((h) => h.time), ...nbsCols.map((h) => h.time), ...nbhAt.keys()])].sort((a, b) => a - b);
  if (times.length === 0) return [];
  const dayKeys: string[] = [];
  for (const t of times) {
    const k = dateKey(t);
    if (k < todayKey) continue;
    if (!dayKeys.includes(k)) dayKeys.push(k);
  }
  const keys = dayKeys.slice(0, MAX_DAYS);

  const first = times[0];
  const last = times[times.length - 1] + SLOT_HOURS * HOUR;
  const nights = nightIntervals(dz.lat, dz.lon, first, last);

  return keys.map((key) => {
    const slots: DaySlot[] = Array.from({ length: SLOTS_PER_DAY }, (_, index) => ({
      index,
      time: null,
      nws: null,
      om: null,
      nbh: null,
      nbs: null,
      night: false,
    }));
    // The three-hourly column names the slot's time where there is one.
    for (const c of nbsCols) {
      if (dateKey(c.time) !== key) continue;
      const s = slots[Math.floor(localHour(c.time) / SLOT_HOURS)];
      s.nbs = c;
      s.time = c.time;
    }
    // Else the earliest hour any forecast has in the slot: its start hour,
    // or for the slot under way the hour under way (2 PM in the noon slot).
    for (const t of times) {
      if (dateKey(t) !== key) continue;
      const s = slots[Math.floor(localHour(t) / SLOT_HOURS)];
      if (s.time == null) s.time = t;
    }
    for (const s of slots) {
      if (s.time == null) continue;
      s.nws = nwsAt.get(s.time) ?? null;
      s.om = omAt.get(s.time) ?? null;
      s.nbh = nbhAt.get(s.time) ?? null;
      s.night = spanIsNight(nights, s.time, s.time + SLOT_HOURS * HOUR);
    }
    const hours = nws
      .filter((h) => dateKey(h.time) === key)
      .map((h) => ({ nws: h, om: omAt.get(h.time) ?? null, nbh: nbhAt.get(h.time) ?? null, night: spanIsNight(nights, h.time, h.time + HOUR) }));
    const firstTime = slots.find((s) => s.time != null)?.time ?? hours[0]?.nws.time ?? now;
    const today = key === todayKey;
    const slotsLeft = today ? SLOTS_PER_DAY - Math.floor(localHour(hourUnderWay) / SLOT_HOURS) : SLOTS_PER_DAY;
    return { key, firstTime, today, slots, hours, slotsLeft };
  });
}

/** Where the NWS ceiling forecast ends, from the hour under way: the first
 *  hour with no ceiling forecast, or null while every hour has one. Read
 *  over the whole list, not a day at a time: the gridpoint's ceiling ends
 *  on a UTC hour, and 06Z is local midnight in Central Standard Time, so a
 *  per-day search found no transition inside either day and named nothing
 *  (the rebuild review, 2026-11-18, its seventh finding). The card prints
 *  it once under the tables, day and hour, so a later day's missing
 *  ceiling row needs no explaining of its own. */
export function nwsCeilingForecastEnd(hourly: readonly HourlyPoint[], now: number): number | null {
  const hourUnderWay = Math.floor(now / HOUR) * HOUR;
  const h = hourly.find((p) => p.time >= hourUnderWay && !p.ceilingForecast);
  return h ? h.time : null;
}

/** The slot's NBM base, from the bulletin the band's column is drawn from:
 *  the three-hourly bulletin's where the slot has its column (its sky
 *  cover, ceiling and base are then one forecast), else the hourly
 *  bulletin's, in the slots before the three-hourly one begins. Drawing
 *  the hourly base inside the three-hourly ceiling put a bar at 8,000 ft
 *  inside cloud from 3,500 ft up (the rebuild review's first finding).
 *  null is a figure ("no layer"); undefined is no figure, so `??` would be
 *  wrong on the hourly null (found in test, 2026-11-18). */
export function slotBase(s: DaySlot): { ft: number | null; from: 'nbs' | 'nbh' } | undefined {
  if (s.nbs) return s.nbs.lowestBaseFtAgl === undefined ? undefined : { ft: s.nbs.lowestBaseFtAgl, from: 'nbs' };
  if (s.nbh && s.nbh.lowestBaseFtAgl !== undefined) return { ft: s.nbh.lowestBaseFtAgl, from: 'nbh' };
  return undefined;
}
