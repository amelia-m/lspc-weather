import { describe, expect, it } from 'vitest';
import { flightCategory } from '../src/domain/flightCategory';

describe('flightCategory', () => {
  it('classifies clear/high conditions as VFR', () => {
    expect(flightCategory(null, 10)).toBe('VFR'); // no ceiling, 10 SM
    expect(flightCategory(5000, 10)).toBe('VFR');
  });

  it('classifies by the worse of ceiling and visibility', () => {
    // Good visibility, marginal ceiling → MVFR
    expect(flightCategory(2000, 10)).toBe('MVFR');
    // Good ceiling, IFR visibility → IFR
    expect(flightCategory(5000, 2)).toBe('IFR');
    // Both limiting; take the worse (LIFR ceiling beats IFR vis)
    expect(flightCategory(400, 2)).toBe('LIFR');
  });

  it('applies the standard boundary values', () => {
    expect(flightCategory(3000, 10)).toBe('MVFR'); // 3000 ceiling is MVFR, not VFR
    expect(flightCategory(3001, 10)).toBe('VFR');
    expect(flightCategory(1000, 10)).toBe('MVFR');
    expect(flightCategory(999, 10)).toBe('IFR');
    expect(flightCategory(500, 10)).toBe('IFR');
    expect(flightCategory(499, 10)).toBe('LIFR');
    expect(flightCategory(5000, 5)).toBe('MVFR'); // 5 SM is MVFR
    expect(flightCategory(5000, 5.1)).toBe('VFR');
    expect(flightCategory(5000, 3)).toBe('MVFR');
    expect(flightCategory(5000, 2.9)).toBe('IFR');
    expect(flightCategory(5000, 1)).toBe('IFR');
    expect(flightCategory(5000, 0.5)).toBe('LIFR');
  });

  it('handles missing data', () => {
    expect(flightCategory(null, null)).toBeNull();
    expect(flightCategory(2000, null)).toBe('MVFR'); // ceiling only
    expect(flightCategory(null, 2)).toBe('IFR'); // visibility only, no ceiling
  });
});
