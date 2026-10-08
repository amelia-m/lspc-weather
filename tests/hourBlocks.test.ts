import { describe, expect, it } from 'vitest';
import { hourBlocks } from '../src/domain/hourBlocks';

const H = 3_600_000;
const pts = (vals: (number | null)[]) => vals.map((v, i) => ({ time: i * H, v }));

describe('hourBlocks', () => {
  it('groups consecutive hours and keeps each block’s highest value', () => {
    expect(hourBlocks(pts([0, 60, 10, 5, 5, 5]), 3, (p) => p.v)).toEqual([
      { start: 0, hours: 3, max: 60 },
      { start: 3 * H, hours: 3, max: 5 },
    ]);
  });

  it('ends on a short block when the hours run out', () => {
    expect(hourBlocks(pts([10, 20, 30, 40]), 3, (p) => p.v)).toEqual([
      { start: 0, hours: 3, max: 30 },
      { start: 3 * H, hours: 1, max: 40 },
    ]);
  });

  it('skips missing hours, and is null only when the whole block is', () => {
    expect(hourBlocks(pts([null, 20, null, null, null, null]), 3, (p) => p.v).map((b) => b.max)).toEqual([20, null]);
  });

  it('refuses a block size that is not a whole number of hours', () => {
    expect(() => hourBlocks(pts([1]), 0, (p) => p.v)).toThrow(RangeError);
    expect(() => hourBlocks(pts([1]), 1.5, (p) => p.v)).toThrow(RangeError);
  });

  it('gives nothing for no points', () => {
    expect(hourBlocks([], 3, () => 1)).toEqual([]);
  });
});
