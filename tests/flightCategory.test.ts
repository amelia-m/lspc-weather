import { describe, expect, it } from 'vitest';
import { flightCategory, observedFlightCategory } from '../src/domain/flightCategory';
import { normalizeNwsObservation } from '../src/domain/normalize';

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

/* VFR needs a ceiling above 3,000 ft AND visibility above 5 miles. A report
 * with no sky group has no ceiling to read, so it can be MVFR/IFR/LIFR on
 * visibility alone ("and/or") but never VFR. flightCategory alone cannot tell
 * "no ceiling" from "not reported" — a clear METAR also yields a null ceiling —
 * which is why the observation-level wrapper exists. */
describe('observedFlightCategory', () => {
  const obs = (rawMessage: string, visibilityM: number | null) =>
    normalizeNwsObservation(
      {
        properties: {
          timestamp: '2026-09-23T03:55:00+00:00',
          rawMessage,
          visibility: { unitCode: 'wmoUnit:m', value: visibilityM },
        },
      },
      'KPMV',
    );

  it('never returns VFR from a report with no sky group', () => {
    expect(observedFlightCategory(obs('KPMV 230355Z AUTO 08003KT 10SM 15/13 A3028', 16090))).toBeNull();
    expect(observedFlightCategory(obs('', null))).toBeNull();
  });

  it('still classifies below VFR on visibility alone when the sky is unreported', () => {
    expect(observedFlightCategory(obs('KPMV 230355Z AUTO 08003KT 2SM BR 15/13 A3028', 3219))).toBe('IFR');
  });

  it('classifies a reported sky as flightCategory does', () => {
    expect(observedFlightCategory(obs('KPMV 230355Z AUTO 08003KT 10SM CLR 15/13 A3028', 16090))).toBe('VFR');
    // The 2026-09-23 report: overcast at 2,700 ft is MVFR.
    expect(observedFlightCategory(obs('KPMV 230355Z AUTO 08003KT 10SM OVC027 15/13 A3028', 16090))).toBe('MVFR');
  });
});
