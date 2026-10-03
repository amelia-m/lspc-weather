import { describe, expect, it } from 'vitest';
import { TILE_PX, tileXY, tilesAround } from '../src/domain/slippyTiles';
import { SITE } from '../src/config/site';

/* The tile indices below were checked against FAA's tile service on
 * 2026-10-03: tile 11/768/477 (z/y/x) is the one printed "BROWNS (Pvt)
 * 1182 - 22", and a 5x5 mosaic at zoom 10 put the drop zone's coordinates
 * on that label. */
describe('tileXY', () => {
  it('puts the drop zone in the tile that shows Browns on the sectional', () => {
    const p = tileXY(SITE.dz.lat, SITE.dz.lon, 11);
    expect(Math.floor(p.x)).toBe(477);
    expect(Math.floor(p.y)).toBe(768);
    expect(p.x % 1).toBeCloseTo(0.241, 3);
    expect(p.y % 1).toBeCloseTo(0.846, 3);
  });

  it('puts 0,0 at the middle of the world at every zoom', () => {
    expect(tileXY(0, 0, 0)).toEqual({ x: 0.5, y: 0.5 });
    expect(tileXY(0, 0, 3)).toEqual({ x: 4, y: 4 });
  });
});

describe('tilesAround', () => {
  const lat = SITE.dz.lat;
  const lon = SITE.dz.lon;

  it('places the drop zone\'s own tile so the point sits at the centre', () => {
    const tiles = tilesAround(lat, lon, 11, 100, 100);
    const own = tiles.find((t) => t.x === 477 && t.y === 768)!;
    // The point is 0.241 and 0.846 of the way across and down its tile.
    expect(own.left).toBeCloseTo(-0.241 * TILE_PX, 0);
    expect(own.top).toBeCloseTo(-0.846 * TILE_PX, 0);
  });

  it('covers the whole window and nothing outside it', () => {
    const half = { w: 320, h: 160 };
    const tiles = tilesAround(lat, lon, 10, half.w, half.h);
    // Every tile overlaps the window...
    for (const t of tiles) {
      expect(t.left).toBeLessThan(half.w);
      expect(t.left + TILE_PX).toBeGreaterThan(-half.w);
      expect(t.top).toBeLessThan(half.h);
      expect(t.top + TILE_PX).toBeGreaterThan(-half.h);
    }
    // ...and together they reach every edge of it.
    expect(Math.min(...tiles.map((t) => t.left))).toBeLessThanOrEqual(-half.w);
    expect(Math.max(...tiles.map((t) => t.left + TILE_PX))).toBeGreaterThanOrEqual(half.w);
    expect(Math.min(...tiles.map((t) => t.top))).toBeLessThanOrEqual(-half.h);
    expect(Math.max(...tiles.map((t) => t.top + TILE_PX))).toBeGreaterThanOrEqual(half.h);
  });

  it('labels every tile with the zoom it was computed for', () => {
    expect(tilesAround(lat, lon, 9, 50, 50).every((t) => t.z === 9)).toBe(true);
  });
});
