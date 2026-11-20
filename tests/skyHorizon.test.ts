import { describe, expect, it } from 'vitest';
import { horizonOptions } from '../src/components/forecastReach';

/* The Hourly wind card looks 12 hours ahead by default and longer at the
 * reader's choice (the maintainer, 2026-10-24); the Ceiling & sky card did
 * too until 2026-11-18, when its strip became one table per day, and its
 * `ceilingCoverage` went with the strip (the day tables name where the NWS
 * ceiling forecast ends through src/domain/skyDays.ts, tested there). */

describe('horizonOptions', () => {
  it('offers a longer horizon only when the forecast runs past the one before it', () => {
    const h = [12, 24, 36] as const;
    expect(horizonOptions(h, (x) => x, 12)).toEqual([12]);
    expect(horizonOptions(h, (x) => x, 13)).toEqual([12, 24]);
    expect(horizonOptions(h, (x) => x, 24)).toEqual([12, 24]);
    expect(horizonOptions(h, (x) => x, 25)).toEqual([12, 24, 36]);
  });
});
