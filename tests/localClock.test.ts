import { describe, expect, it } from 'vitest';
import { resolveLocalClock } from '../src/domain/localClock';

const Z = 'America/Chicago';

describe('resolveLocalClock', () => {
  it('reads a CDT clock time on the reference day', () => {
    // 8:15 AM CDT on 2026-09-27 is 13:15Z.
    expect(resolveLocalClock('8:15 AM', Date.parse('2026-09-27T13:35:00Z'), Z)).toBe(Date.parse('2026-09-27T13:15:00Z'));
    expect(resolveLocalClock('12:05 PM', Date.parse('2026-09-27T17:00:00Z'), Z)).toBe(Date.parse('2026-09-27T17:05:00Z'));
    expect(resolveLocalClock('12:05 AM', Date.parse('2026-09-27T05:00:00Z'), Z)).toBe(Date.parse('2026-09-27T05:05:00Z'));
  });

  it('puts a late-evening time on the previous local day when the reference is just past midnight', () => {
    // Reference 12:05 AM CDT on the 28th (05:05Z); 11:55 PM is the 27th, 04:55Z.
    expect(resolveLocalClock('11:55 PM', Date.parse('2026-09-28T05:05:00Z'), Z)).toBe(Date.parse('2026-09-28T04:55:00Z'));
  });

  it('uses the standard-time offset in winter', () => {
    // 8:15 AM CST on 2026-12-01 is 14:15Z.
    expect(resolveLocalClock('8:15 AM', Date.parse('2026-12-01T14:30:00Z'), Z)).toBe(Date.parse('2026-12-01T14:15:00Z'));
  });

  it('is null for text that is not a clock time', () => {
    expect(resolveLocalClock('noon', Date.parse('2026-09-27T13:35:00Z'), Z)).toBeNull();
  });
});
