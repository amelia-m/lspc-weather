/**
 * The jump run drawn over a north-up map: where a line of a given bearing
 * through a point runs on screen, how long a distance on the ground is in
 * pixels, where an offset called in nautical miles puts that point, and the
 * tick marks that make the line a ruler.
 *
 * The Drift card's exit-separation section draws the bearing the reader set
 * over an aerial image of the drop zone (the maintainer, 2026-11-24), so the
 * number has a picture: the line through the drop zone's point, an arrow in
 * the direction of flight. It is the bearing and nothing more: where the run
 * lies over the ground, and where on it the exits start, is the spotter's
 * and the pilot's, and the caption says so.
 *
 * Screen coordinates: x grows east, y grows SOUTH, as SVG's do, with the
 * point at the origin. Pure.
 */

/** Web Mercator's ground resolution at the equator for a 256 px tile at
 *  zoom 0, metres per pixel (the earth's circumference over 256). */
const EQUATOR_M_PER_PX_Z0 = 156543.03392;
const M_PER_FT = 0.3048;

/** Metres on the ground per pixel of a 256 px Web Mercator tile at a
 *  latitude and zoom. */
export function metresPerPixel(lat: number, zoom: number): number {
  return (EQUATOR_M_PER_PX_Z0 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** A distance on the ground, in pixels of the map. */
export function feetToPixels(ft: number, lat: number, zoom: number): number {
  return (ft * M_PER_FT) / metresPerPixel(lat, zoom);
}

/** A nautical mile, in metres (exact, by definition). */
const M_PER_NM = 1852;

/** A distance in nautical miles, the unit a pilot's GPS reads and an offset
 *  is called in, in pixels of the map. */
export function nmToPixels(nm: number, lat: number, zoom: number): number {
  return (nm * M_PER_NM) / metresPerPixel(lat, zoom);
}

export interface Pt {
  x: number;
  y: number;
}

/**
 * Where a point lies on screen from the origin, a distance toward a
 * compass direction: the offset a jump run is called with ("0.1 north" of
 * the GPS point; the maintainer, 2026-11-25).
 */
export function offsetPixels(nm: number, towardDeg: number, lat: number, zoom: number): Pt {
  const px = nmToPixels(nm, lat, zoom);
  const r = (towardDeg * Math.PI) / 180;
  return { x: px * Math.sin(r), y: -px * Math.cos(r) };
}

/**
 * The closest zoom, within the service's range, at which a distance is no
 * more than `maxPx` on screen: the image steps out to it when an offset is
 * set, so the point the line is moved to is inside the frame. At the
 * widest zoom the distance may still be past `maxPx`; the widest is given.
 */
export function zoomToFit(nm: number, lat: number, maxPx: number, minZoom: number, maxZoom: number): number {
  for (let z = maxZoom; z > minZoom; z--) if (nmToPixels(nm, lat, z) <= maxPx) return z;
  return minZoom;
}

export interface JumpRunTick {
  /** Steps from the point the line is drawn through: positive ahead of it
   *  in the direction of flight, negative behind. Never 0, where the
   *  point's own mark is. */
  n: number;
  /** The tick's two ends, square to the line. */
  a: Pt;
  b: Pt;
}

/**
 * Tick marks across the line at equal steps either side of the origin, as
 * far as the line is drawn: a ruler on the run in the unit the pilot's GPS
 * counts down in (the maintainer, 2026-11-25: markers at 0.1 nm). Every
 * `longEvery`th tick is longer, so half miles can be counted at a glance.
 */
export function jumpRunTicks(
  trackDeg: number,
  stepPx: number,
  halfLengthPx: number,
  halfTickPx = 5,
  longHalfTickPx = 9,
  longEvery = 5,
): JumpRunTick[] {
  if (!(stepPx > 0)) return [];
  const r = (trackDeg * Math.PI) / 180;
  const d = { x: Math.sin(r), y: -Math.cos(r) };
  const right = { x: Math.cos(r), y: Math.sin(r) };
  const count = Math.floor(halfLengthPx / stepPx);
  const ticks: JumpRunTick[] = [];
  for (let n = -count; n <= count; n++) {
    if (n === 0) continue;
    const half = n % longEvery === 0 ? longHalfTickPx : halfTickPx;
    const c = { x: d.x * stepPx * n, y: d.y * stepPx * n };
    ticks.push({
      n,
      a: { x: c.x - right.x * half, y: c.y - right.y * half },
      b: { x: c.x + right.x * half, y: c.y + right.y * half },
    });
  }
  return ticks;
}

export interface JumpRunLine {
  /** The line's two ends, `halfLengthPx` either side of the point: `from`
   *  is where the plane comes from, `to` where it flies toward. */
  from: Pt;
  to: Pt;
  /** An arrowhead part-way along the flown half, its tip toward `to`: tip,
   *  then the two barbs. */
  arrow: [Pt, Pt, Pt];
}

/**
 * The line of a bearing through the origin. `trackDeg` is the direction of
 * flight, degrees clockwise from north, as on the card.
 */
export function jumpRunLine(trackDeg: number, halfLengthPx: number, arrowAtPx: number, arrowSizePx = 12): JumpRunLine {
  const r = (trackDeg * Math.PI) / 180;
  // Unit vector along the flight, and one square to it (to its right).
  const d = { x: Math.sin(r), y: -Math.cos(r) };
  const right = { x: Math.cos(r), y: Math.sin(r) };
  const at = (along: number, across = 0): Pt => ({
    x: d.x * along + right.x * across,
    y: d.y * along + right.y * across,
  });
  return {
    from: at(-halfLengthPx),
    to: at(halfLengthPx),
    arrow: [at(arrowAtPx + arrowSizePx), at(arrowAtPx, arrowSizePx * 0.6), at(arrowAtPx, -arrowSizePx * 0.6)],
  };
}
