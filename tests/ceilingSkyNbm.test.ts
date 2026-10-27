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
