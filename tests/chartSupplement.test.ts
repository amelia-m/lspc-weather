import { describe, expect, it } from 'vitest';
import { airacId, chartSupplementCycle } from '../src/domain/chartSupplement';

const at = (iso: string) => Date.parse(iso);

describe('airacId', () => {
  // Published AIRAC effective dates.
  it.each([
    ['2024-01-25T09:01:00Z', '2401'],
    ['2025-01-23T09:01:00Z', '2501'],
    ['2026-01-22T09:01:00Z', '2601'],
    ['2026-09-03T09:01:00Z', '2609'],
    ['2026-10-29T09:01:00Z', '2611'],
    ['2026-12-24T09:01:00Z', '2613'],
    ['2027-01-21T09:01:00Z', '2701'],
  ])('%s is AIRAC %s', (iso, id) => {
    expect(airacId(at(iso))).toBe(id);
  });

  it('names the cycle in effect at any time within it', () => {
    expect(airacId(at('2026-10-08T12:00:00Z'))).toBe('2610');
    // Before 2027's first cycle (Jan 21): still 2026's last.
    expect(airacId(at('2027-01-10T00:00:00Z'))).toBe('2613');
    expect(airacId(at('2026-01-22T09:00:00Z'))).toBe('2513');
  });
});

describe('chartSupplementCycle', () => {
  it('is the edition the FAA form showed as current on 2026-10-08', () => {
    expect(chartSupplementCycle(at('2026-10-08T12:00:00Z'))).toEqual({ id: '2609', effectiveMs: at('2026-09-03T09:01:00Z') });
  });

  it('changes 56 days on, at 0901Z, not before', () => {
    expect(chartSupplementCycle(at('2026-10-29T09:00:00Z')).id).toBe('2609');
    expect(chartSupplementCycle(at('2026-10-29T09:01:00Z')).id).toBe('2611');
    // Across the year: Dec 24 2026, then Feb 18 2027, the second AIRAC of 2027.
    expect(chartSupplementCycle(at('2027-01-10T00:00:00Z')).id).toBe('2613');
    expect(chartSupplementCycle(at('2027-02-20T00:00:00Z')).id).toBe('2702');
  });

  it('works back before the reference edition too', () => {
    expect(chartSupplementCycle(at('2026-08-01T00:00:00Z'))).toEqual({ id: '2607', effectiveMs: at('2026-07-09T09:01:00Z') });
  });
});
