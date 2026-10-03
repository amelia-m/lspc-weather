import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SectionalPanel } from '../src/components/SectionalPanel';
import { DATA_SOURCES } from '../src/config/sources';
import { tileXY } from '../src/domain/slippyTiles';
import { SITE } from '../src/config/site';

/* The card is FAA's chart around the drop zone with a ring on it; these pin
 * that the ring is on the drop zone (its own tile placed so the point sits at
 * the centre), that the chart opens SkyVector on the same spot, and that the
 * card says nothing about the airspace. */
describe('SectionalPanel', () => {
  const html = renderToStaticMarkup(createElement(SectionalPanel));
  const own = tileXY(SITE.dz.lat, SITE.dz.lon, 10);
  const ownX = Math.floor(own.x);
  const ownY = Math.floor(own.y);

  it("loads FAA's tiles at zoom 10, the drop zone's own tile placed so the drop zone is at the centre", () => {
    expect(html).toContain(`/VFR_Sectional/MapServer/tile/10/${ownY}/${ownX}`);
    const left = Math.round(-(own.x % 1) * 256 * 1000) / 1000;
    const tag = new RegExp(`tile/10/${ownY}/${ownX}"[^>]*style="left:calc\\(50% \\+ (-?[\\d.]+)px\\);top:calc\\(50% \\+ (-?[\\d.]+)px\\)`);
    const m = tag.exec(html);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(left, 1);
    expect(Number(m![2])).toBeCloseTo(-(own.y % 1) * 256, 1);
    expect(html).toContain('class="sectional-dz"');
  });

  it('opens SkyVector on the drop zone when the chart is tapped', () => {
    expect(html).toContain(`class="sectional-frame" href="${DATA_SOURCES.skyvector.url.replace(/&/g, '&amp;')}"`);
  });

  it('offers both zoom steps from the default, each named by the word it shows', () => {
    // WCAG 2.5.3: no aria-label to override the visible "wider" / "closer",
    // and the signs beside them hidden from the accessible name.
    const buttons = html.match(/<button[^>]*>.*?<\/button>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b).not.toContain('aria-label');
    expect(buttons[0]).toContain('<span aria-hidden="true">−</span> wider');
    expect(buttons[1]).toContain('closer <span aria-hidden="true">+</span>');
    expect(html).not.toMatch(/<button[^>]*disabled/);
  });

  it('marks the drop zone and makes no claim about the airspace', () => {
    expect(html).toContain('marks the drop zone');
    expect(html).not.toMatch(/class="[^"]*(caution|watch|warn)/);
    expect(html.toLowerCase()).not.toMatch(/\b(clear of|outside|inside|safe)\b/);
  });
});
