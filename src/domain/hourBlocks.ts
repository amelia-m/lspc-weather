/**
 * Hourly forecast points grouped into consecutive blocks of `size` hours,
 * each carrying the highest value of `pick` among its hours.
 *
 * The highest, not the mean: a block stands for its hours, and a 3-hour bar
 * that averaged a 60% hour with two dry ones would read 20%, lower than an
 * hour inside it. With the maximum no block reads lower than any of its own
 * hours, and expanding it can only show the same figure or less. NWS serves
 * the chance hour by hour (runs of equal hours merged), so a block's maximum
 * is a lower bound on the chance of precipitation at some time in it: the
 * hours are not independent, and nothing here can say by how much more. A
 * value is null only when every hour in the block is.
 *
 * Blocks start at the first point and run in order; the last may hold fewer
 * hours than `size` when the points run out, and says so (`hours`).
 */
export function hourBlocks<T extends { time: number }>(
  points: readonly T[],
  size: number,
  pick: (p: T) => number | null,
): { start: number; hours: number; max: number | null }[] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`block size must be a whole number of hours, got ${size}`);
  const out: { start: number; hours: number; max: number | null }[] = [];
  for (let i = 0; i < points.length; i += size) {
    const block = points.slice(i, i + size);
    const values = block.map(pick).filter((v): v is number => v != null);
    out.push({ start: block[0].time, hours: block.length, max: values.length ? Math.max(...values) : null });
  }
  return out;
}
