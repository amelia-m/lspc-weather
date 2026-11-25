import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { feetToPixels, jumpRunLine, jumpRunTicks, metresPerPixel, nmToPixels, offsetPixels, zoomToFit } from '../src/domain/jumpRunMap';
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

describe('an offset called in nautical miles, and the ticks that count them', () => {
  const LAT = SITE.gpsPin.lat;

  it('draws a tenth of a nautical mile as 185.2 m on the ground: about 25.6 px at the drop zone at zoom 14', () => {
    expect(nmToPixels(0.1, LAT, 14) * metresPerPixel(LAT, 14)).toBeCloseTo(185.2, 6);
    expect(nmToPixels(0.1, LAT, 14)).toBeCloseTo(25.6, 1);
    // The same ground as the feet scale: a nautical mile is 6,076.1 ft.
    expect(nmToPixels(1, LAT, 14)).toBeCloseTo(feetToPixels(1852 / 0.3048, LAT, 14), 6);
  });

  it('puts north up the screen, east to the right, and a diagonal the same distance out', () => {
    const px = nmToPixels(0.1, LAT, 14);
    near(offsetPixels(0.1, 0, LAT, 14), 0, -px);
    near(offsetPixels(0.1, 90, LAT, 14), px, 0);
    near(offsetPixels(0.1, 180, LAT, 14), 0, px);
    const sw = offsetPixels(0.1, 225, LAT, 14);
    expect(sw.x).toBeLessThan(0);
    expect(sw.y).toBeGreaterThan(0);
    expect(Math.hypot(sw.x, sw.y)).toBeCloseTo(px, 6);
    near(offsetPixels(0, 45, LAT, 14), 0, 0);
  });

  it('finds the closest zoom that keeps an offset within the frame, and the widest when none does', () => {
    // 0.1 nm is 25.6 px at zoom 14 and doubles each level in.
    expect(zoomToFit(0, LAT, 100, 12, 15)).toBe(15);
    expect(zoomToFit(0.1, LAT, 100, 12, 15)).toBe(15); // 51 px
    expect(zoomToFit(0.3, LAT, 100, 12, 15)).toBe(14); // 77 px; 154 at 15
    expect(zoomToFit(0.4, LAT, 100, 12, 15)).toBe(13); // 103 px at 14
    expect(zoomToFit(1, LAT, 100, 12, 15)).toBe(12); // 128 px at 13
    expect(zoomToFit(3, LAT, 100, 12, 15)).toBe(12); // 192 px even at 12: the widest there is
  });

  it('sets ticks square to the line at each step either side of the point, none on it, every fifth longer', () => {
    const ticks = jumpRunTicks(90, 10, 57);
    expect(ticks.map((t) => t.n)).toEqual([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
    const at = (n: number) => ticks.find((t) => t.n === n)!;
    // Eastbound: two steps ahead is 20 px right, the tick up and down from it.
    near(at(2).a, 20, -5);
    near(at(2).b, 20, 5);
    near(at(-3).a, -30, -5);
    near(at(5).a, 50, -9);
    near(at(-5).b, -50, 9);
    // Northbound: ahead is up the screen, the tick left and right.
    const north = jumpRunTicks(0, 10, 25);
    near(north.find((t) => t.n === 1)!.a, -5, -10);
    near(north.find((t) => t.n === 1)!.b, 5, -10);
    expect(jumpRunTicks(90, 0, 57)).toEqual([]);
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
    // The GPS point is the maintainer's belief, and the key says so and when.
    expect(html).toContain(
      'Cross: the drop zone’s GPS point, as the maintainer believes it (2026-11-24; not confirmed against a pilot’s GPS). Ring: the landing area.',
    );
    expect(html).toContain('The bearing only: where the run lies and exits start is the spotter’s and the pilot’s.');
    expect(html).toContain('>USDA, USGS The National Map: Orthoimagery</a>');
    expect(html).toContain('with a line through the drop zone’s GPS point on a bearing of 230° SW');
    expect(map(0)).toContain('GPS point on a bearing of 360° N');
  });

  const offsetMap = (trackDeg: number, tenths: number, towardDeg: number) =>
    renderToStaticMarkup(createElement(JumpRunMap, { trackDeg, initialOffset: { tenths, towardDeg } }));
  const tickXs = (html: string): number[] =>
    [...(/class="jumprun-tick" d="([^"]+)"/.exec(html)?.[1] ?? '').matchAll(/M(-?[\d.]+),/g)].map((m) => Number(m[1]));

  it('with no offset draws the run through the GPS point, ticked every 0.1 nautical mile from it', () => {
    const html = map(90);
    expect(html).not.toContain('jumprun-offset');
    expect(html).not.toContain('translate(');
    // One box until an offset is set: a direction for no distance is nothing.
    expect(html.match(/<select/g)).toHaveLength(1);
    expect(html).toContain('Offset from the GPS point (nautical miles)');
    expect(html).toContain('<option value="0" selected="">none</option>');
    expect(html).toContain('<option value="10">1.0</option>');
    // Eastbound, so each tick's x is its distance along: 25.6 px a tenth.
    const xs = tickXs(html);
    expect(xs).toContain(25.6);
    expect(xs).toContain(-51.3);
    expect(xs).not.toContain(0);
    expect(html).toContain('Ticks: every 0.1 nautical mile from the cross.');
    expect(html).not.toContain('Diamond:');
  });

  it('moves the run, its ticks and a diamond to the offset point, and leaves the cross and the ring where they are', () => {
    const html = offsetMap(270, 1, 0);
    // 0.1 nm north: 25.6 px up the screen at zoom 14.
    expect(html).toContain('<g transform="translate(0.0,-25.6)">');
    expect(html).toMatch(/<g transform="translate\(0\.0,-25\.6\)">.*class="jumprun-line".*class="jumprun-tick".*class="jumprun-offset" d="M0,-6L6,0L0,6L-6,0Z".*<\/g>.*class="jumprun-dz"/s);
    expect(html).toContain('<circle class="jumprun-dz" r="7" cx="17.5" cy="-43.1"');
    expect(html).toContain('<path class="jumprun-pin" d="M-8,0H8M0,-8V8"');
    expect(html.match(/<select/g)).toHaveLength(2);
    expect(html).toContain('<option value="0" selected="">north</option>');
    expect(html).toContain('<option value="225">south-west</option>');
    expect(html).toContain('with a line through a point 0.1 nm north of the GPS point on a bearing of 270° W');
    expect(html).toContain('Diamond: a point 0.1 nm north of the GPS point. Ticks: every 0.1 nautical mile from the diamond.');
    expect(html).toContain('The bearing and offset only:');
    // East of the point is to the right.
    expect(offsetMap(270, 2, 90)).toContain('<g transform="translate(51.3,0.0)">');
  });

  it('opens wide enough to hold a long offset, and counts half miles where tenths would run together', () => {
    const html = offsetMap(90, 10, 180);
    const srcs = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs.every((s) => s.includes('/MapServer/tile/12/'))).toBe(true);
    // A nautical mile south at zoom 12: 64.1 px down, inside the 130 px half-height.
    expect(html).toContain('<g transform="translate(0.0,64.1)">');
    expect(html).toContain('Ticks: every 0.5 nautical mile at this zoom from the diamond.');
    const xs = tickXs(html);
    expect(xs).toContain(Number(nmToPixels(0.5, SITE.gpsPin.lat, 12).toFixed(1)));
    expect(xs).not.toContain(Number(nmToPixels(0.1, SITE.gpsPin.lat, 12).toFixed(1)));
    // The 1,000 ft bar shrinks with the image: a quarter of its 42.2 px at zoom 14.
    expect(html).toContain(`style="width:${feetToPixels(1000, SITE.gpsPin.lat, 12).toFixed(1)}px"`);
    // A short offset leaves the opening zoom alone.
    expect(offsetMap(90, 3, 0)).toContain('/MapServer/tile/14/');
  });

  it('is under the bearing box on the Drift card’s exit-separation section, and absent with no wind to fly into', () => {
    const level = (agl: number): WindsAloftLevel => ({ altitudeFtAgl: agl, altitudeFtMsl: agl + 1182, directionDeg: 270, speedKt: 35, tempC: -5 });
    const html = renderToStaticMarkup(createElement(ExitSeparation, { levels: [level(10000)], exitFtAgl: 10000 }));
    expect(html.indexOf('jumprun-frame')).toBeGreaterThan(html.indexOf('<select'));
    expect(html).toContain('GPS point on a bearing of 270° W');
    const none = renderToStaticMarkup(createElement(ExitSeparation, { levels: [level(10000)], exitFtAgl: 12500 }));
    expect(none).not.toContain('jumprun');
  });
});
