/** The smallest and largest of the values, or null for none. A loop, not
 *  `Math.min(...values)`: a spread passes every value as an argument, and
 *  V8 throws RangeError past about a hundred thousand, which an archive
 *  that grows weekly (the NDFD's) or a sample that runs over seasons (the
 *  surface wind's) will reach. */
export function extent(values: readonly number[]): { min: number; max: number } | null {
  if (values.length === 0) return null;
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}
