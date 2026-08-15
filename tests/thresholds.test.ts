import { describe, expect, it } from 'vitest';
import { recommendedDeployFt, WAIVER_TIERS } from '../src/config/thresholds';

describe('recommendedDeployFt', () => {
  it('uses the student/A-license BSR minimum (3,000 ft) for students', () => {
    expect(recommendedDeployFt('student')).toBe(3000);
  });

  it('uses the licensed (B-license) BSR minimum (2,500 ft) for licensed', () => {
    expect(recommendedDeployFt('licensed')).toBe(2500);
  });

  it('treats every waiver tier as student-category (3,000 ft)', () => {
    for (const tier of WAIVER_TIERS) {
      expect(recommendedDeployFt(tier.id)).toBe(3000);
    }
  });
});
