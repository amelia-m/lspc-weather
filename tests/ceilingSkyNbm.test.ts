import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { folded, inView, keyFolded } from './support/fold';
import { CeilingSkyPanel } from '../src/components/CeilingSkyPanel';
import { DATA_SOURCES } from '../src/config/sources';
import { SITE } from '../src/config/site';
import { deriveProvenance } from '../src/domain/sourceProvenance';
import { nightIntervals, spanIsNight } from '../src/domain/sun';
import type { HourlyPoint, NbmForecast } from '../src/domain/types';

/* The NBM's two bulletins on the Ceiling & sky card's day tables (since
 * 2026-11-18): the hourly one's base, the three-hourly one's sky cover,
 * ceiling and base, the heights drawn as a band the right way up, every
 * figure printed, nothing flagged. A fixed clock: 2026-11-18 20:00Z, 2 PM
 * Central Standard Time. */
const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 18, 20);
const hours = (n: number): HourlyPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    time: NOW + i * H,
    skyCoverPct: 40,
    ceilingFtAgl: i === 1 ? 4500 : null,
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
  }));
/** The hourly bulletin: a base, no layer, no figure, then at 00Z (6 PM,
 *  where the three-hourly bulletin begins) 8,000 ft, from the hour under way. */
const nbm: NbmForecast = {
  station: 'KPMV',
  product: 'NBH',
  stepHours: 1,
  version: '5.0',
  cycleMs: NOW - H,
  file: 'blend.20261118/19/text/blend_nbhtx.t19z',
  hours: [
    { time: NOW, lowestBaseFtAgl: 2500, ceilingFtAgl: null, skyCoverPct: 40 },
    { time: NOW + H, lowestBaseFtAgl: null, ceilingFtAgl: null, skyCoverPct: 10 },
    { time: NOW + 2 * H, lowestBaseFtAgl: undefined, ceilingFtAgl: undefined, skyCoverPct: null },
    { time: NOW + 4 * H, lowestBaseFtAgl: 8000, ceilingFtAgl: null, skyCoverPct: 30 },
  ],
};
/** The three-hourly bulletin: 23 columns from 00Z on the 19th, a ceiling
 *  of 3,500 ft in one and 15,000 ft in another, bases of 2,400 ft then
 *  none then 26,000. */
const nbs: NbmForecast = {
  station: 'KPMV',
  product: 'NBS',
  stepHours: 3,
  version: null,
  cycleMs: NOW - H,
  file: 'blend.20261118/19/text/blend_nbstx.t19z',
  hours: Array.from({ length: 23 }, (_, i) => ({
    time: Date.UTC(2026, 10, 19, 0) + i * 3 * H,
    lowestBaseFtAgl: i === 20 ? 26000 : i > 11 ? null : 2400,
    ceilingFtAgl: i === 5 ? 3500 : i === 8 ? 15000 : null,
    skyCoverPct: 20 + i,
  })),
};
const card = (o: { nbm?: NbmForecast | null; nbs?: NbmForecast | null; n?: number; now?: number }) =>
  renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly: hours(o.n ?? 48), omClouds: null, nbm: o.nbm ?? null, nbs: o.nbs ?? null, now: o.now ?? NOW }));
const rowOf = (html: string, label: string, from = 0): string[] => {
  const at = html.indexOf(`>${label}</th>`, from);
  if (at < 0) return [];
  return [...html.slice(at, html.indexOf('</tr>', at)).matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]);
};
const rowCells = (html: string, label: string, from = 0): string[] => {
  const at = html.indexOf(`>${label}</th>`, from);
  return [...html.slice(at, html.indexOf('</tr>', at)).matchAll(/<td([^>]*)>/g)].map((m) => m[1]);
};
/** The n-th day block's markup (0 = today). */
const dayBlock = (html: string, n: number): string => {
  const starts = [...html.matchAll(/class="csd-day(?: csd-today-hours)?"/g)].map((m) => m.index as number);
  return html.slice(starts[n], starts[n + 1] ?? html.indexOf('<details class="reading-key">'));
};

describe('the NBM hourly bulletin’s base on the day tables', () => {
  it('prints the base in thousands of feet at each slot’s hour, "no" for no layer, blank where it gives none, dotted as the hourly bulletin’s, and names the source', () => {
    const html = card({ nbm });
    // Wednesday's table: the 2 PM slot (NOW) 2.5; 3 PM "no"; 6 PM 8; 9 PM blank.
    expect(rowOf(html, 'NBM base')).toEqual(['', '', '', '', '2.5', 'no', '8', '']);
    expect(rowCells(html, 'NBM base').slice(4, 7)).toEqual([' class="muted csd-hb"', ' class="muted csd-hb"', ' class="muted csd-hb night"']);
    expect(html).not.toContain('title="from the');
    // The tables' key is behind "How to read this", closed, and is not
    // filed under the comparisons.
    expect(keyFolded(html)).toMatch(/^<details class="reading-key"><summary class="small">How to read this<\/summary>/);
    expect(keyFolded(html)).toContain('Each day across, every 3 h');
    expect(keyFolded(html)).toContain('a blank cell is a slot that forecast does not cover');
    expect(inView(html)).not.toContain('Each day across');
    expect(folded(html)).not.toContain('Each day across');
    // In view: what the rows are, and that a second forecast can disagree
    // and raises no flag. Behind the fold: which bulletins, and how.
    expect(inView(html)).toContain(
      'The NBM rows are the NWS National Blend of Models’ bulletins for KPMV: a second forecast beside the NWS one, which it can disagree with; neither raises a flag.',
    );
    expect(inView(html)).not.toContain('read through the relay');
    expect(folded(html)).toContain('(hourly, 25 hours)');
    expect(folded(html)).toContain('each bulletin’s cycle is on Data health');
    expect(html).not.toMatch(/\d\dZ cycle/);
    expect(html).not.toContain('issued');
    expect(folded(html)).toContain('lowest cloud base whether or not a ceiling is present');
    expect(folded(html)).toContain('usairnet KPMV page');
    expect(html).toContain(DATA_SOURCES.nbm.url);
  });

  it('has no base row and no NBM note without a bulletin, and never a dash', () => {
    const html = card({});
    expect(html).not.toContain('>NBM base</th>');
    expect(html).not.toContain('>NBM %</th>');
    expect(html).not.toContain('National Blend');
    expect(html.slice(html.indexOf('class="csd-day"'))).not.toContain('—');
    const prov = deriveProvenance({ current: null, hourly: hours(3), daily: [], windsAloft: [], sun: null, densityAltitude: null, taf: null, nbm: null }, true);
    expect(prov.nbm).toBeUndefined();
  });
});

describe('the NBM three-hourly bulletin on the day tables', () => {
  const html = card({ nbm, nbs });

  it('makes a block per local day the bulletins reach, the same slot in the same column, and reads the three-hourly figures at their own times', () => {
    expect((html.match(/class="csd-day"/g) ?? []).length).toBe(4);
    // Thursday: 12 AM to 9 PM Central are 06Z to 03Z, columns 2 to 9: sky 22..29.
    const thu = dayBlock(html, 1);
    const figs = [...thu.matchAll(/<span class="csd-barcell nbm"><span class="csd-track">.*?<span class="csd-fig">([^<]*)/g)].map((m) => m[1]);
    expect(figs).toEqual(['22', '23', '24', '25', '26', '27', '28', '29']);
    expect(rowOf(thu, 'NBM ceil')).toEqual(['no', 'no', 'no', '3.5', 'no', 'no', '15', 'no']);
    expect(html).toContain('three-hourly, 6 to 72 hours, the bulletin usairnet’s three-day table reads');
    expect(html).toContain(DATA_SOURCES.nbs.url);
  });

  it('takes each column from one bulletin: the three-hourly’s base where the slot has its column, over the hourly’s, and the hourly’s before it, dotted', () => {
    // Wednesday 6 PM (00Z): the hourly bulletin says 8,000 ft and the three-hourly 2,400; the
    // column is the three-hourly's, as the band's cloud is, so 2.4, not dotted. 2 PM and 3 PM,
    // before the three-hourly begins, are the hourly's, dotted.
    expect(rowOf(html, 'NBM base')).toEqual(['', '', '', '', '2.5', 'no', '2.4', '2.4']);
    expect(rowCells(html, 'NBM base').slice(4)).toEqual([' class="muted csd-hb"', ' class="muted csd-hb"', ' class="muted night"', ' class="muted night"']);
    expect(html).toContain('the hourly one’s base alone before it begins, dotted');
  });

  it('draws the band the right way up: the base a short bar at its height, the NBM ceiling as cloud above it, a top-edge strip at 12,000 ft or more, the NWS ceiling a line across the column, night behind', () => {
    const bandH = 120;
    const y = (ft: number) => bandH - (Math.min(ft, 12000) / 12000) * bandH;
    // 2,400 ft: a 4-unit bar centred on y(2400) = 96, so at 94, 60% of the column wide.
    expect(html).toContain(`<rect class="csd-base" x="10" y="${y(2400) - 2}" width="80" height="4">`);
    // 26,000 ft clamps to the top edge: column 20 is 6 AM Saturday, slot 2.
    expect(html).toContain('<rect class="csd-base" x="210" y="0" width="80" height="4">');
    // 3,500 ft NBM ceiling: cloud from y(3500) = 85 up to the top.
    expect(html).toContain(`<rect class="csd-oc" x="302" y="0" width="96" height="${y(3500)}">`);
    // 15,000 ft NBM ceiling (column 8, Thursday 6 PM, slot 6): a strip on the top edge, not a height-0 fill.
    expect(html).toContain('<rect class="csd-oc csd-edge" x="602" y="0" width="96" height="4">');
    expect(html).not.toContain('height="0"');
    // The NWS 4,500 ft ceiling at 3 PM Wednesday, slot 5: a line across the column at y(4500) = 75.
    expect(html).toContain(`<line class="csd-nws-ceil" x1="500" x2="600" y1="${y(4500)}" y2="${y(4500)}">`);
    // The hourly bulletin's 8,000 ft at 6 PM Wednesday is not in the band: the column is the three-hourly's.
    const wed = dayBlock(html, 0);
    expect(wed).not.toContain(`y="${y(8000) - 2}"`);
    // Night rects come first in the band, before the gridlines and marks.
    const band = html.slice(html.indexOf('<svg class="csd-band"'), html.indexOf('</svg>', html.indexOf('<svg class="csd-band"')));
    expect(band.indexOf('csd-night')).toBeLessThan(band.indexOf('csd-grid'));
    expect(band.indexOf('csd-grid')).toBeLessThan(band.indexOf('csd-base'));
    // The axis names every gridline: 12k, 9, 6, 3, 0.
    expect(html).toContain('<span>12k</span><span>9</span><span>6</span><span>3</span><span>0</span>');
  });

  it('shades night cells by the drop zone’s sunset and sunrise, a slot by its greater part, and says so', () => {
    const nights = nightIntervals(SITE.dz.lat, SITE.dz.lon, NOW, NOW + 80 * H);
    // Thursday's time row: 12 AM, 3 AM night; 6 AM to 3 PM day; 6 PM, 9 PM night (November at the DZ).
    const thu = dayBlock(html, 1);
    const head = thu.slice(thu.indexOf('<tr class="csd-time">'), thu.indexOf('</tr>', thu.indexOf('<tr class="csd-time">')));
    const nightFlags = [...head.matchAll(/<th class="(night)?" scope="col">/g)].map((m) => Boolean(m[1]));
    const expected = nbs.hours.filter((h) => h.time >= Date.UTC(2026, 10, 19, 6) && h.time < Date.UTC(2026, 10, 20, 6)).map((h) => spanIsNight(nights, h.time, h.time + 3 * H));
    expect(nightFlags).toEqual(expected);
    expect(nightFlags).toEqual([true, true, false, false, false, false, true, true]);
    // Each hour label in both forms; the stylesheet shows one.
    expect(head).toContain('<th class="night" scope="col"><span class="csd-tl">12am</span><span class="csd-ts">12a</span></th>');
    expect(html).toContain('the dark columns are night there, sunset to sunrise, the same times the night flag uses');
    expect(html).toMatch(/title="[^"]*· night"/);
  });

  it('draws a row only on a day with a figure in it', () => {
    // The NWS hourly ends Friday 1 PM: Saturday has the NBM rows and no NWS or hourly rows.
    const sat = dayBlock(html, 3);
    expect(sat).toContain('>NBM %</th>');
    expect(sat).toContain('>NBM ceil</th>');
    expect(sat).not.toContain('>NWS %</th>');
    expect(sat).not.toContain('>NWS ceil</th>');
    expect(sat).not.toContain('<details');
    // Friday: the NWS sky row runs to 1 PM; the NWS ceiling forecast ended Thursday, so no NWS ceil row.
    const fri = dayBlock(html, 2);
    expect(fri).toContain('>NWS %</th>');
    expect(fri).not.toContain('>NWS ceil</th>');
    expect(html).toContain('a row is left out of a day it has no figure in');
  });

  it('opens today’s hourly detail with its hour count and leaves the other days’ closed, and names once, day and hour, where the NWS ceiling forecast ends', () => {
    expect(html).toContain('<details class="csd-hourly" open=""><summary>hourly (10 h)</summary>');
    expect(html.match(/<details class="csd-hourly"><summary>hourly \((24|14) h\)<\/summary>/g)).toHaveLength(2);
    // ceilingForecast false from hour 30: 02Z on the 20th, 8 PM Thursday. One line, under the tables.
    expect(html.match(/NWS ceiling forecast ends/g)).toHaveLength(1);
    expect(html).toContain('<p class="muted small csd-ends">NWS ceiling forecast ends Thu 8pm; its sky row runs on.</p>');
    expect(html.indexOf('csd-ends')).toBeGreaterThan(html.lastIndexOf('class="csd-day"'));
    // The hourly rows name their source as the tables do.
    expect(html).toContain('<th class="csd-lab" scope="row">NWS ceil</th>');
    expect(html).toContain('<th class="csd-lab" scope="row">NBM base</th>');
    expect(html).not.toContain('scope="row">ceil</th>');
  });

  it('shows today as its hours alone when two slots or fewer remain, the next day a full table', () => {
    // 9:30 PM Wednesday: one slot left of today, three NWS hours.
    const late = card({ nbm, nbs, now: Date.UTC(2026, 10, 19, 3, 30) });
    const wed = dayBlock(late, 0);
    expect(wed).toMatch(/^class="csd-day csd-today-hours"/);
    expect(wed).toContain('Wed <span class="muted">Nov 18 · today</span>');
    expect(wed).not.toContain('<table class="csd-table">');
    expect(wed).not.toContain('<details');
    expect(wed).toContain('csd-hourly-table');
    expect(wed.match(/<th class="(?:night)?" scope="col" title=/g)).toHaveLength(3);
    const thu = dayBlock(late, 1);
    expect(thu).toContain('<table class="csd-table">');
    expect(thu).toContain('<details class="csd-hourly"><summary>hourly (24 h)</summary>');
    // Two slots left by the clock (6:30 PM), hours alone; three (3:30 PM), the table stands, with
    // only its three hours of forecast: the rule is the clock's, not the forecast's reach.
    expect(dayBlock(card({ nbm, nbs, now: Date.UTC(2026, 10, 19, 0, 30) }), 0)).not.toContain('<table class="csd-table">');
    expect(dayBlock(card({ nbm, nbs, n: 3, now: Date.UTC(2026, 10, 18, 21, 30) }), 0)).toContain('<table class="csd-table">');
    expect(html).toContain('today is its hours alone when two slots or fewer remain');
  });

  it('is a picture of the figures in the muted colour: no warning class in the tables', () => {
    const tables = html.slice(html.indexOf('class="csd-day"'), html.indexOf('<details class="reading-key">'));
    expect(tables).not.toMatch(/warn|caution|danger|alert|ok\b/);
  });
});
