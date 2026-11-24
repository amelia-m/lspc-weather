/**
 * The jump run drawn over a north-up map: where a line of a given bearing
 * through a point runs on screen, and how long a distance on the ground is
 * in pixels.
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

export interface Pt {
  x: number;
  y: number;
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
