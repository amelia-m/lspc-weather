/**
 * Which map tiles cover a window centred on a point, and where each sits.
 *
 * The Sectional card shows FAA's VFR sectional as a static mosaic of 256 px
 * tiles from FAA's own tile service (Web Mercator, the usual z/x/y scheme;
 * its MapServer description, read 2026-10-03, gives 256 px tiles in WKID
 * 3857 with levels 8 to 12). No map library: the card needs a fixed view
 * centred on the drop zone and a zoom step, which is a few lines of
 * arithmetic, and a library would bring its own CSS, events and a much
 * larger bundle for a picture that does not pan.
 *
 * Pure: coordinates in, tile indices and pixel offsets out.
 */

export const TILE_PX = 256;

/** The point's position in tile units at zoom `z`: the integer part is the
 *  tile, the fraction is where in it the point falls. */
export function tileXY(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const latR = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.asinh(Math.tan(latR)) / Math.PI) / 2) * n,
  };
}

export interface PlacedTile {
  z: number;
  x: number;
  y: number;
  /** The tile's top-left corner, in px from the centre point. */
  left: number;
  top: number;
}

/**
 * Every tile that overlaps a window `halfWidth` px either side of the point
 * and `halfHeight` px above and below it, each placed relative to the point.
 * The window is centred on the point, so a card of any width shows the drop
 * zone in its middle as long as the window is at least as large as the card.
 */
export function tilesAround(
  lat: number,
  lon: number,
  z: number,
  halfWidth: number,
  halfHeight: number,
): PlacedTile[] {
  const p = tileXY(lat, lon, z);
  const cx = p.x * TILE_PX;
  const cy = p.y * TILE_PX;
  const n = 2 ** z;
  const out: PlacedTile[] = [];
  for (let ty = Math.floor((cy - halfHeight) / TILE_PX); ty <= Math.floor((cy + halfHeight) / TILE_PX); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor((cx - halfWidth) / TILE_PX); tx <= Math.floor((cx + halfWidth) / TILE_PX); tx++) {
      out.push({ z, x: ((tx % n) + n) % n, y: ty, left: tx * TILE_PX - cx, top: ty * TILE_PX - cy });
    }
  }
  return out;
}
