/**
 * Where a point on the ground falls inside an NWS RIDGE "standard" radar image.
 *
 * The card shows `radar.weather.gov/ridge/standard/<SITE>_loop.gif` as a plain
 * cross-origin <img>. NWS publishes no world file, no `.aux.xml` and no bbox
 * for it — the directory holds nothing but GIFs, and the interactive viewer
 * treats the same file as an ungeoreferenced picture. So the georeferencing
 * here was *measured*, not looked up; `RadarImageGeoref` records what was
 * measured and how, and nothing in this module assumes anything the
 * measurement did not show.
 *
 * The important consequence is that this is a derived position, not a
 * published one. A marker in the wrong place on a weather display is worse
 * than no marker — a jumper reads storm distance against it — so the geometry
 * lives in one pure function that can be tested against the measurement, and
 * callers get `null` rather than a guess wherever the point is off the image.
 */

/**
 * The measured georeferencing of the RIDGE "standard" single-site image.
 *
 * The image is a plate carrée (equirectangular) rendering of a bbox that is
 * *square in degrees*, centred on the radar in longitude and a fixed distance
 * north of it in latitude. Because the box is square in degrees while the
 * image is 600x550 px, the scale differs between axes — 140.1 px/deg of
 * longitude against 128.2 px/deg of latitude — but that difference is entirely
 * absorbed by the image's own aspect ratio, so a position expressed as a
 * *fraction* of width and height needs neither pixel dimension.
 */
export interface RadarImageGeoref {
  /** Side of the bbox, in degrees — the same figure for latitude and longitude. */
  spanDeg: number;
  /** How far north of the radar the bbox centre sits, in degrees of latitude.
   *  The image is centred on the radar in longitude but not in latitude. */
  centreLatOffsetDeg: number;
  /** Fraction of image height covered by the NWS header bar at the top, and by
   *  the colour-scale/timestamp bar at the bottom. They are drawn over the map,
   *  so a point can be inside the bbox and still sit behind one of them. */
  barTopFrac: number;
  barBottomFrac: number;
}

/** A position inside the image, as fractions of its width and height from the
 *  top-left corner. Resolution-independent: the card scales the image to the
 *  card width, so a marker placed at these fractions tracks it at any size. */
export interface ImageFraction {
  x: number;
  y: number;
}

/**
 * Fractional position of `lat`/`lon` within the radar image, or `null` when
 * the point is not on the map.
 *
 * `null` covers two cases, both of which must not produce a marker: the point
 * lies outside the bbox altogether, and the point lies under the header or
 * footer bar, where a marker would be drawn over NWS chrome rather than over
 * the map it refers to.
 */
export function radarImageFraction(
  lat: number,
  lon: number,
  radar: { lat: number; lon: number },
  georef: RadarImageGeoref,
): ImageFraction | null {
  const centreLat = radar.lat + georef.centreLatOffsetDeg;
  const x = 0.5 + (lon - radar.lon) / georef.spanDeg;
  const y = 0.5 - (lat - centreLat) / georef.spanDeg;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  if (y < georef.barTopFrac || y > georef.barBottomFrac) return null;
  return { x, y };
}
