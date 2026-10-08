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
 * `lastStudent` is the student choice last made and `lastTier` the waiver
 * tier last chosen, both kept and stored by App beside the profile. Going to
 * Licensed and back returns to the first, and BSR and back to the waiver
 * returns to the second, across a tab switch or a reload: otherwise a jumper
 * on a waiver tier would be put on different limits without being told.
 */
export function ProfileSelector({
  profile,
  lastStudent,
  lastTier,
  onChange,
}: {
  profile: WindProfileId;
  lastStudent: WindProfileId;
  lastTier: WindProfileId;
  onChange: (p: WindProfileId) => void;
}): JSX.Element {
  const licensed = profile === 'licensed';
  const isWaiver = profile.startsWith('waiver');
  const button = (label: string, on: boolean, to: WindProfileId) => (
    <button key={label} type="button" className={on ? 'active' : ''} aria-pressed={on} onClick={() => onChange(to)}>
      {label}
    </button>
  );

  return (
    <>
      <div className="class-toggle" role="group" aria-label="Jumper class">
        {button('Student', !licensed, licensed ? lastStudent : profile)}
        {button('Licensed', licensed, 'licensed')}
      </div>
      {!licensed && (
        <div className="class-toggle class-toggle-sub" role="group" aria-label="Student wind limits">
          {button('USPA BSR', profile === 'student', 'student')}
          {button('LSPC waiver', isWaiver, isWaiver ? profile : lastTier)}
        </div>
      )}
      {isWaiver && (
        <div className="tier-toggle" role="group" aria-label="Waiver experience tier">
          {WAIVER_TIERS.map((tier) => button(tier.label, tier.id === profile, tier.id))}
        </div>
      )}
    </>
  );
}
