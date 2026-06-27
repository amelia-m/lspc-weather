/** Great-circle distance and bearing between two lat/lon points. Pure. */

const R_MI = 3958.7613; // mean Earth radius, statute miles
const rad = (d: number): number => (d * Math.PI) / 180;

export function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial (forward) bearing from A to B, degrees true [0,360). */
export function initialBearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const p1 = rad(aLat);
  const p2 = rad(bLat);
  const dLon = rad(bLon - aLon);
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
