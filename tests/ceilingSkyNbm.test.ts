import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
/** The hourly bulletin: a base, no layer, no figure, from the hour under way. */
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
  ],
};
/** The three-hourly bulletin: 23 columns from 00Z on the 19th, a ceiling
 *  in one, bases of 2,400 ft then none then 26,000. */
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
    ceilingFtAgl: i === 5 ? 3500 : null,
    skyCoverPct: 20 + i,
  })),
};
const card = (o: { nbm?: NbmForecast | null; nbs?: NbmForecast | null; n?: number }) =>
  renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly: hours(o.n ?? 48), omClouds: null, nbm: o.nbm ?? null, nbs: o.nbs ?? null, now: NOW }));
const rowOf = (html: string, label: string, from = 0): string[] => {
  const at = html.indexOf(`>${label}</th>`, from);
  if (at < 0) return [];
  return [...html.slice(at, html.indexOf('</tr>', at)).matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]);
};

describe('the NBM hourly bulletin’s base on the day tables', () => {
  it('prints the base in thousands of feet at each slot’s hour, "no" for no layer, blank where it gives none, and names the source', () => {
    const html = card({ nbm });
    // Wednesday's table: the 2 PM slot (NOW) 2.5; 3 PM "no"; 6 PM and 9 PM blank.
    expect(rowOf(html, 'NBM base')).toEqual(['', '', '', '', '2.5', 'no', '', '']);
    expect(html).toContain('title="from the hourly bulletin"');
    expect(html).toContain('NWS National Blend of Models’ bulletins for KPMV');
    expect(html).toContain('(hourly, the 19Z cycle, 25 hours)');
    expect(html).not.toContain('issued');
    expect(html).toContain('lowest cloud base whether or not a ceiling is present');
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
    const thu = html.indexOf('class="csd-day"', html.indexOf('class="csd-day"') + 1);
    const figs = [...html.slice(thu, html.indexOf('class="csd-day"', thu + 1)).matchAll(/<span class="csd-barcell nbm"><span class="csd-track">.*?<span class="csd-fig">([^<]*)/g)].map((m) => m[1]);
    expect(figs).toEqual(['22', '23', '24', '25', '26', '27', '28', '29']);
    expect(rowOf(html, 'NBM ceil', thu)).toEqual(['no', 'no', 'no', '3.5', 'no', 'no', 'no', 'no']);
    expect(html).toContain('three-hourly, the 19Z cycle, 6 to 72 hours, the bulletin usairnet’s three-day table reads');
    expect(html).toContain(DATA_SOURCES.nbs.url);
  });

  it('takes the base from the hourly bulletin where it reaches and the three-hourly one past it, saying which', () => {
    // Wednesday 6 PM (00Z): the hourly bulletin has no figure (its third hour is undefined and
    // it ends there), the three-hourly's 2,400 ft stands, titled as its.
    const wed = rowOf(html, 'NBM base');
    expect(wed).toEqual(['', '', '', '', '2.5', 'no', '2.4', '2.4']);
    expect(html).toContain('title="from the three-hourly bulletin"');
  });

  it('draws the band the right way up: the base a bar at its height, the NBM ceiling as cloud above it, the NWS ceiling a tick, night behind', () => {
    const bandH = 120;
    const y = (ft: number) => bandH - (Math.min(ft, 12000) / 12000) * bandH;
    // 2,400 ft: a 4-unit bar centred on y(2400) = 96, so at 94.
    expect(html).toContain(`<rect class="csd-base" x="2" y="${y(2400) - 2}" width="96" height="4">`);
    // 26,000 ft clamps to the top edge: column 20 is 6 AM Saturday, slot 2.
    expect(html).toContain('<rect class="csd-base" x="202" y="0" width="96" height="4">');
    // 3,500 ft NBM ceiling: cloud from y(3500) = 85 up to the top.
    expect(html).toContain(`<rect class="csd-oc" x="302" y="0" width="96" height="${y(3500)}">`);
    // The NWS 4,500 ft ceiling at 3 PM Wednesday, slot 5: a tick at y(4500) = 75.
    expect(html).toContain(`<line class="csd-nws-ceil" x1="502" x2="598" y1="${y(4500)}" y2="${y(4500)}">`);
    // Night rects come first in the band, before the gridlines and marks.
    const band = html.slice(html.indexOf('<svg class="csd-band"'), html.indexOf('</svg>', html.indexOf('<svg class="csd-band"')));
    expect(band.indexOf('csd-night')).toBeLessThan(band.indexOf('csd-grid'));
    expect(band.indexOf('csd-grid')).toBeLessThan(band.indexOf('csd-base'));
  });

  it('shades night cells by the drop zone’s sunset and sunrise, a slot by its greater part, and says so', () => {
    const nights = nightIntervals(SITE.dz.lat, SITE.dz.lon, NOW, NOW + 80 * H);
    // Thursday's time row: 12 AM, 3 AM night; 6 AM to 3 PM day; 6 PM, 9 PM night (November at the DZ).
    const thu = html.indexOf('class="csd-day"', html.indexOf('class="csd-day"') + 1);
    const head = html.slice(html.indexOf('<tr class="csd-time">', thu), html.indexOf('</tr>', html.indexOf('<tr class="csd-time">', thu)));
    const nightFlags = [...head.matchAll(/<th class="(night)?" scope="col">([^<]*)<\/th>/g)].map((m) => Boolean(m[1]));
    const expected = nbs.hours.filter((h) => h.time >= Date.UTC(2026, 10, 19, 6) && h.time < Date.UTC(2026, 10, 20, 6)).map((h) => spanIsNight(nights, h.time, h.time + 3 * H));
    expect(nightFlags).toEqual(expected);
    expect(nightFlags).toEqual([true, true, false, false, false, false, true, true]);
    expect(html).toContain('the dark columns are night there, sunset to sunrise, the same times the night flag uses');
    expect(html).toMatch(/title="[^"]*· night"/);
  });

  it('opens today’s hourly detail and leaves the other days’ closed, and names where the NWS ceiling forecast ends', () => {
    expect(html).toContain('<details class="csd-hourly" open=""><summary>hourly</summary>');
    expect((html.match(/<details class="csd-hourly"><summary>hourly<\/summary>/g) ?? []).length).toBe(2);
    // ceilingForecast false from hour 30: 02Z on the 20th, 8 PM Thursday.
    expect(html).toContain('NWS ceiling forecast ends 8pm; its sky row runs on');
  });

  it('is a picture of the figures in the muted colour: no warning class in the tables', () => {
    const tables = html.slice(html.indexOf('class="csd-day"'), html.indexOf('Each day across'));
    expect(tables).not.toMatch(/warn|caution|danger|alert|ok\b/);
  });
});
