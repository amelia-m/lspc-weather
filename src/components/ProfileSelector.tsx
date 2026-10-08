import { useState } from 'react';
import { WAIVER_TIERS, type WindProfileId } from '../config/thresholds';

/**
 * The wind-limit profile, chosen the way the limits are organised: first
 * Student or Licensed, then for a student whether the USPA BSR limits apply
 * or the club's waiver, and under the waiver the jump-count tier.
 *
 * The waiver sits under Student because it is a student policy: the posted
 * sign's table is headed "Students" and waives "the wind limits stated in
 * the BSRs", which BSR 2-1 H sets for solo students only. Offered as a third
 * option beside Student and Licensed it read as a jumper class of its own.
 *
 * Going to Licensed and back returns to the student choice last made, so a
 * jumper on a waiver tier does not have to find it again.
 */
export function ProfileSelector({
  profile,
  onChange,
}: {
  profile: WindProfileId;
  onChange: (p: WindProfileId) => void;
}): JSX.Element {
  const licensed = profile === 'licensed';
  const isWaiver = profile.startsWith('waiver');
  const [lastStudent, setLastStudent] = useState<WindProfileId>(licensed ? 'student' : profile);
  const pick = (p: WindProfileId): void => {
    if (p !== 'licensed') setLastStudent(p);
    onChange(p);
  };
  const lastTier = lastStudent.startsWith('waiver') ? lastStudent : WAIVER_TIERS[0].id;

  return (
    <>
      <div className="class-toggle" role="group" aria-label="Jumper class">
        <button className={!licensed ? 'active' : ''} onClick={() => pick(licensed ? lastStudent : profile)}>
          Student
        </button>
        <button className={licensed ? 'active' : ''} onClick={() => pick('licensed')}>
          Licensed
        </button>
      </div>
      {!licensed && (
        <div className="class-toggle class-toggle-sub" role="group" aria-label="Student wind limits">
          <button className={profile === 'student' ? 'active' : ''} onClick={() => pick('student')}>
            USPA BSR
          </button>
          <button className={isWaiver ? 'active' : ''} onClick={() => pick(isWaiver ? profile : lastTier)}>
            LSPC waiver
          </button>
        </div>
      )}
      {isWaiver && (
        <div className="tier-toggle" role="group" aria-label="Waiver experience tier">
          {WAIVER_TIERS.map((tier) => (
            <button key={tier.id} className={tier.id === profile ? 'active' : ''} onClick={() => pick(tier.id)}>
              {tier.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
