import { describe, expect, it } from 'vitest';
import { ceilingCoverage, horizonOptions } from '../src/components/forecastReach';

/* The Hourly wind card looks 12 hours ahead by default and longer at the
 * reader's choice (the maintainer, 2026-10-24); the Ceiling & sky card did
 * too until 2026-11-18, when its strip became one table per day. */

describe('horizonOptions', () => {
  it('offers a longer horizon only when the forecast runs past the one before it', () => {
    const h = [12, 24, 36] as const;
    expect(horizonOptions(h, (x) => x, 12)).toEqual([12]);
    expect(horizonOptions(h, (x) => x, 13)).toEqual([12, 24]);
    expect(horizonOptions(h, (x) => x, 24)).toEqual([12, 24]);
    expect(horizonOptions(h, (x) => x, 25)).toEqual([12, 24, 36]);
  });
});

describe('ceilingCoverage', () => {
  const at = (covered: boolean[]) => covered.map((c, i) => ({ time: i, ceilingForecast: c }));
  it('names the hour a ceiling forecast ends when it does not come back', () => {
    expect(ceilingCoverage(at([true, true, false, false]))).toEqual({ kind: 'end', from: 2 });
  });
  it('calls a hole the forecast resumes after gaps, and no ceiling at all none: neither is an end', () => {
    expect(ceilingCoverage(at([true, false, true]))).toEqual({ kind: 'gaps' });
    expect(ceilingCoverage(at([false, true, false]))).toEqual({ kind: 'gaps' });
    expect(ceilingCoverage(at([false, false]))).toEqual({ kind: 'none' });
  });
  it('says nothing when every hour is covered', () => {
    expect(ceilingCoverage(at([true, true]))).toBeNull();
  });
});
