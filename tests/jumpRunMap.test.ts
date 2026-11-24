import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { feetToPixels, jumpRunLine, metresPerPixel } from '../src/domain/jumpRunMap';
import { JumpRunMap } from '../src/components/JumpRunMap';
import { ExitSeparation } from '../src/components/ExitSeparation';
import { DZ_IMAGERY_TILES } from '../src/config/sources';
import { SITE } from '../src/config/site';
import { pixelOffset, tileXY } from '../src/domain/slippyTiles';
import type { WindsAloftLevel } from '../src/domain/types';

/* The jump run's bearing drawn over a north-up map (the maintainer,
 * 2026-11-24): the line through the drop zone's point and an arrow in the
 * direction of flight. Screen y grows south. */

const near = (p: { x: number; y: number }, x: number, y: number): void => {
  expect(p.x).toBeCloseTo(x, 6);
  expect(p.y).toBeCloseTo(y, 6);
};

describe('the jump-run line on a north-up map', () => {
  it('runs up the screen for a run toward north, and to the right for one toward east', () => {
    const north = jumpRunLine(360, 100, 40);
    near(north.from, 0, 100);
    near(north.to, 0, -100);
    const east = jumpRunLine(90, 100, 40);
    near(east.from, -100, 0);
    near(east.to, 100, 0);
    // South-west: down and to the left.
    const sw = jumpRunLine(225, 100, 40);
    expect(sw.to.x).toBeLessThan(0);
    expect(sw.to.y).toBeGreaterThan(0);
    expect(Math.hypot(sw.to.x, sw.to.y)).toBeCloseTo(100, 6);
  });

  it('puts the arrowhead on the half the plane flies toward, its tip ahead of its barbs and the barbs either side', () => {
    const { arrow } = jumpRunLine(90, 100, 40, 12);
    near(arrow[0], 52, 0);
    // To the right of an eastbound flight is south: screen y positive.
    near(arrow[1], 40, 7.2);
    near(arrow[2], 40, -7.2);
    const back = jumpRunLine(270, 100, 40, 12).arrow;
    near(back[0], -52, 0);
  });
});

describe('the map’s scale', () => {
  it('is Web Mercator’s: 156,543 m per pixel at the equator at zoom 0, halving each zoom, shrinking with latitude', () => {
    expect(metresPerPixel(0, 0)).toBeCloseTo(156543.03392, 4);
    expect(metresPerPixel(0, 1)).toBeCloseTo(156543.03392 / 2, 4);
    expect(metresPerPixel(60, 0)).toBeCloseTo(156543.03392 / 2, 3);
  });

  it('draws 1,000 ft as about 42 px at the drop zone’s latitude at zoom 14', () => {
    // 7.225 m per pixel at 40.87°N: 304.8 m is 42.2 px.
    expect(feetToPixels(1000, 40.8703, 14)).toBeCloseTo(42.2, 1);
    expect(feetToPixels(1000, 40.8703, 15)).toBeCloseTo(84.4, 1);
  });
});

describe('the jump run over the aerial image', () => {
  const map = (trackDeg: number) => renderToStaticMarkup(createElement(JumpRunMap, { trackDeg }));
  const attr = (html: string, cls: string, name: string): number =>
    Number(new RegExp(`class="${cls}"[^>]*\\b${name}="([^"]+)"`).exec(html)?.[1]);

  it('asks USGS for the tiles round the drop zone’s GPS point, the one holding it among them', () => {
    const html = map(230);
    const srcs = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThan(3);
    expect(srcs.every((s) => s.startsWith(`${DZ_IMAGERY_TILES.origin}/arcgis/rest/services/USGSImageryOnly/MapServer/tile/14/`))).toBe(true);
    const p = tileXY(SITE.gpsPin.lat, SITE.gpsPin.lon, 14);
    // Row before column in the address, as an ArcGIS tile service takes it.
    expect(srcs).toContain(DZ_IMAGERY_TILES.url(14, Math.floor(p.y), Math.floor(p.x)));
    expect(DZ_IMAGERY_TILES.url(14, 6150, 3817)).toMatch(/\/tile\/14\/6150\/3817$/);
    // That tile is placed so the GPS point, not the landing area, is the
    // image's centre: its corner sits up and left of the centre by the
    // point's place within it.
    const own = new RegExp(`tile/14/${Math.floor(p.y)}/${Math.floor(p.x)}"[^>]*style="left:calc\\(50% \\+ (-?[\\d.]+)px\\);top:calc\\(50% \\+ (-?[\\d.]+)px\\)`).exec(html);
    expect(Number(own?.[1])).toBeCloseTo(-(p.x - Math.floor(p.x)) * 256, 3);
    expect(Number(own?.[2])).toBeCloseTo(-(p.y - Math.floor(p.y)) * 256, 3);
  });

  it('draws the line along the bearing through the centre, in the tiles’ own pixels', () => {
    const north = map(0);
    expect(attr(north, 'jumprun-line', 'x1')).toBeCloseTo(0, 3);
    expect(attr(north, 'jumprun-line', 'x2')).toBeCloseTo(0, 3);
    // Toward north is up the screen: the far end's y is negative.
    expect(attr(north, 'jumprun-line', 'y2')).toBeLessThan(-200);
    const east = map(90);
    expect(attr(east, 'jumprun-line', 'x2')).toBeGreaterThan(200);
    expect(attr(east, 'jumprun-line', 'y2')).toBeCloseTo(0, 3);
    // An SVG of no size is painted by no browser: the overlay keeps a pixel.
    expect(north).toContain('<svg class="jumprun-overlay" width="1" height="1"');
  });

  it('marks two places: the GPS point at the centre, where the line passes, and the landing area where it lies from it', () => {
    // Mark Schulze's point for the club, which the maintainer believes is
    // the GPS pin, and the landing-area pin she dropped.
    expect(SITE.gpsPin).toEqual({ lat: 40.8675, lon: -96.11 });
    const off = pixelOffset(SITE.gpsPin, SITE.dz, 14);
    // 336 m to the north-north-east: 17.5 px east and 43.1 px north at
    // 7.2 m per pixel (worked by hand from the two coordinates).
    expect(off.x).toBeCloseTo(17.5, 1);
    expect(off.y).toBeCloseTo(-43.1, 1);
    const html = map(230);
    expect(html).toContain('<circle class="jumprun-dz" r="7" cx="17.5" cy="-43.1"');
    // The cross is drawn about the origin, which the line passes through.
    expect(html).toContain('<path class="jumprun-pin" d="M-8,0H8M0,-8V8"');
    // The same place at any zoom: twice the pixels one level in, which at
    // the closest zoom offered is still inside the frame's 130 px half-height.
    const closest = pixelOffset(SITE.gpsPin, SITE.dz, DZ_IMAGERY_TILES.maxZoom);
    expect(closest.x).toBeCloseTo(off.x * 2 ** (DZ_IMAGERY_TILES.maxZoom - 14), 6);
    expect(Math.abs(closest.y)).toBeLessThan(130 - 7);
  });

  it('sizes the bar to 1,000 ft on the ground and says what each mark is, and is not', () => {
    const html = map(230);
    expect(html).toMatch(/class="jumprun-scale" style="width:42\.2px"[^>]*>1,000 ft</);
    expect(html).toContain(
      'The cross is the drop zone’s GPS point as the maintainer believes it to be, the one Mark Schulze’s Winds Aloft uses for the club (40.8675, -96.1100; her word of 2026-11-24, not confirmed against a pilot’s GPS).',
    );
    expect(html).toContain('The ring is the middle of the main landing area (40.8703, -96.1085).');
    expect(html).toContain('The line is a bearing of 230° SW through the GPS point, the arrow the direction of flight');
    expect(html).toContain('It shows the bearing and nothing else');
    expect(html).toContain('is the spotter’s and the pilot’s');
    expect(html).toContain('>USDA, USGS The National Map: Orthoimagery</a>');
    expect(map(0)).toContain('a bearing of 360° N through the GPS point');
  });

  it('is under the bearing box on the Drift card’s exit-separation section, and absent with no wind to fly into', () => {
    const level = (agl: number): WindsAloftLevel => ({ altitudeFtAgl: agl, altitudeFtMsl: agl + 1182, directionDeg: 270, speedKt: 35, tempC: -5 });
    const html = renderToStaticMarkup(createElement(ExitSeparation, { levels: [level(10000)], exitFtAgl: 10000 }));
    expect(html.indexOf('jumprun-frame')).toBeGreaterThan(html.indexOf('<select'));
    expect(html).toContain('a bearing of 270° W through the GPS point');
    const none = renderToStaticMarkup(createElement(ExitSeparation, { levels: [level(10000)], exitFtAgl: 12500 }));
    expect(none).not.toContain('jumprun');
  });
});
