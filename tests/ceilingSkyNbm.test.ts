import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CeilingSkyPanel } from '../src/components/CeilingSkyPanel';
import { DATA_SOURCES } from '../src/config/sources';
import { deriveProvenance } from '../src/domain/sourceProvenance';
import type { HourlyPoint, NbmForecast } from '../src/domain/types';

/* The NBM's lowest cloud base on the Ceiling & sky card: a row under the
 * ceiling, in the NWS hours the bulletin reaches, printed and not flagged. */

const t0 = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
const hours = (n: number): HourlyPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    time: t0 + i * 3_600_000,
    skyCoverPct: 40,
    ceilingFtAgl: i === 1 ? 4500 : null,
    ceilingForecast: true,
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
const nbm: NbmForecast = {
  station: 'KPMV',
  product: 'NBH',
  stepHours: 1,
  version: '5.0',
  cycleMs: t0 - 3_600_000,
  file: 'blend.20261027/01/text/blend_nbhtx.t01z',
  // Three hours only: a base, no layer, no figure; the rest of the strip is past it.
  hours: [
    { time: t0, lowestBaseFtAgl: 2500, ceilingFtAgl: null, skyCoverPct: 40 },
    { time: t0 + 3_600_000, lowestBaseFtAgl: null, ceilingFtAgl: null, skyCoverPct: 10 },
    { time: t0 + 2 * 3_600_000, lowestBaseFtAgl: undefined, ceilingFtAgl: undefined, skyCoverPct: null },
  ],
};
const card = (n: NbmForecast | null) => renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly: hours(12), omClouds: null, nbm: n }));

describe('the NBM base row on the Ceiling & sky card', () => {
  it('prints the base under each hour in thousands of feet, "no" for no layer, a dash where it gives none, and names the source', () => {
    const html = card(nbm);
    expect(html).toContain('class="sky-ceil sky-base">base<');
    const cells = [...html.matchAll(/<span class="sky-base" title="([^"]*)">([^<]*)</g)].map((m) => [m[1], m[2]]);
    expect(cells.slice(0, 3)).toEqual([
      ['NBM lowest cloud base 2,500 ft AGL', '2.5'],
      ['NBM: no cloud layer', 'no'],
      ['No NBM figure for this hour', '—'],
    ]);
    expect(cells).toHaveLength(12);
    expect(cells[11]).toEqual(['No NBM figure for this hour', '—']);
    expect(html).toContain('lowest cloud base in the NWS National Blend of Models');
    // The cycle, not an issue time: the file lands about an hour after it.
    expect(html).toContain(`(the ${String(new Date(nbm.cycleMs).getUTCHours()).padStart(2, '0')}Z cycle, read through the relay)`);
    expect(html).not.toContain('issued');
    expect(html).toContain('it raises no');
    expect(html).toContain(DATA_SOURCES.nbm.url);
  });

  it('shows no row, no note and no source without the bulletin, or with one that reaches none of the hours', () => {
    for (const html of [card(null), card({ ...nbm, hours: nbm.hours.map((h) => ({ ...h, time: h.time - 48 * 3_600_000 })) })]) {
      expect(html).not.toContain('sky-base');
      expect(html).not.toContain('National Blend');
      expect(html).not.toContain(DATA_SOURCES.nbm.url);
    }
  });

  it('is a plain figure: no colour class, no flag word', () => {
    const html = card(nbm);
    expect(html).not.toMatch(/sky-base[^>]*(caution|watch|warn)/);
    expect(html).not.toMatch(/\b(low cloud warning|unsafe|go|no-go)\b/i);
  });
});

describe('Data health names the NBM bulletin', () => {
  it('as the station’s NBH cycle through the relay', () => {
    const prov = deriveProvenance({ current: null, hourly: [], daily: [], windsAloft: [], sun: null, densityAltitude: null, taf: null, nbm: { ...nbm, cycleMs: Date.UTC(2026, 9, 27, 1) } }, true);
    expect(prov.nbm).toEqual({ detail: "KPMV NBH 01Z · NOAA's bucket via the relay", fallback: false });
  });
});

/* The three-hourly bulletin (NBS) on the card, in the layouts the
 * maintainer is trying (forecastReach.ts, ThreeDayLayout, 2026-11-12). The
 * NWS hours run 48 h; the NBS's columns run 6 to 72 h from a cycle an hour
 * before now, three hours apart, so past the NWS hours the strip's columns
 * are the bulletin's alone. */
const nbs: NbmForecast = {
  station: 'KPMV',
  product: 'NBS',
  stepHours: 3,
  version: null,
  cycleMs: t0 - 3_600_000,
  file: 'blend.20261112/01/text/blend_nbstx.t01z',
  hours: Array.from({ length: 23 }, (_, i) => ({
    time: t0 - 3_600_000 + (5 + 3 * i) * 3_600_000,
    lowestBaseFtAgl: i === 20 ? 26000 : i > 11 ? null : 2400,
    ceilingFtAgl: i === 18 ? 3500 : null,
    skyCoverPct: 20 + i,
  })),
};
const cardWith = (threeDay: 'horizon' | 'continue' | 'strip' | 'none', initialHours?: number) =>
  renderToStaticMarkup(
    createElement(CeilingSkyPanel, { current: null, hourly: hours(48), omClouds: null, nbm, nbs, threeDay, initialHours }),
  );

describe('the NBM three-hourly bulletin on the Ceiling & sky card', () => {
  it("'horizon': a 3-day option, and at it the strip runs past the NWS hours in the bulletin's own wider columns, with an NBM ceiling row", () => {
    const html = cardWith('horizon', 72);
    expect(html).toContain('>3d</button>');
    // 48 NWS hours, then the bulletin's times past them: 72 - 47 = 25 h of
    // 3-h steps from the next one, 8 columns.
    expect((html.match(/class="sky-col nbs-col"/g) ?? []).length).toBe(8);
    expect((html.match(/class="sky-col"/g) ?? []).length).toBe(48);
    expect(html).toContain('class="sky-ceil sky-base">NBM<');
    expect(html).toContain('now + next 70 h');
    expect(html).toContain('three-hourly bulletin for KPMV (NBS');
    expect(html).toContain('NWS NBM three-hourly bulletin');
    // A column of the bulletin's alone draws no NWS bar and no NWS figure.
    const past = html.slice(html.indexOf('class="sky-col nbs-col"'));
    expect(past).not.toContain('class="sky-bar" style');
    expect(past).toContain('class="sky-pct nbm-pct"');
  });

  it("'continue': the 3-day option too, and past the NWS ceiling's end the ceiling row carries the NBM's figure in the marked type", () => {
    const html = cardWith('continue', 72);
    expect(html).toContain('>3d</button>');
    expect(html).not.toContain('class="sky-ceil sky-base">NBM<');
    expect((html.match(/class="sky-ceil nbm-fig"/g) ?? []).length).toBe(8);
    expect(html).toContain('title="NBM ceiling 3,500 ft AGL"');
    expect(html).toContain('goes on in the NBM’s figures');
  });

  it("'strip': the hourly strip as it was, no 3-day option, and a second three-hourly strip of every column of the bulletin under it", () => {
    const html = cardWith('strip');
    expect(html).not.toContain('>3d</button>');
    expect(html).toContain('class="sky-timeline ceiling-timeline extended nbs-timeline"');
    expect((html.match(/class="sky-col nbs-col"/g) ?? []).length).toBe(23);
    expect(html).toContain('Next three days, every 3 h: NBM three-hourly bulletin');
    expect(html).toContain('The three-day strip is the');
    expect(html).toContain('now + next 11 h');
  });

  it("'none': nothing of the bulletin, and no 3-day option; and without the bulletin the other layouts offer none either", () => {
    const html = cardWith('none', 72);
    expect(html).not.toContain('>3d</button>');
    expect(html).not.toContain('nbs-col');
    expect(html).not.toContain('NWS NBM three-hourly bulletin');
    const without = renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly: hours(48), omClouds: null, nbm, nbs: null, threeDay: 'horizon' }));
    expect(without).not.toContain('>3d</button>');
    expect(without).not.toContain('class="sky-ceil sky-base">NBM<');
  });
});
