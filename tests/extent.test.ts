import { describe, expect, it } from 'vitest';
import { extent } from '../src/domain/extent';

describe('extent', () => {
  it('gives the smallest and largest, or null for none', () => {
    expect(extent([3, -1, 7, 7, 0])).toEqual({ min: -1, max: 7 });
    expect(extent([5])).toEqual({ min: 5, max: 5 });
    expect(extent([])).toBeNull();
  });

  it('takes a list longer than a spread call could: the extremes placed in the middle', () => {
    // A spread passes every value as an argument, which V8 refuses past
    // about a hundred thousand; a loop does not care.
    const many = Array.from({ length: 300_000 }, (_, i) => (i * 7919) % 1_000_003);
    many[123_456] = -5;
    many[234_567] = 2_000_000;
    expect(extent(many)).toEqual({ min: -5, max: 2_000_000 });
  });
});
