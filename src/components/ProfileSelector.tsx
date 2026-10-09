import { LICENSES, WAIVER_TIERS, type License, type WindProfileId } from '../config/thresholds';

/** The posted sign the waiver tiers were transcribed from, served with the
 *  site: a crop of docs/lspc-waivered-wind-limits.jpg (the photo as taken,
 *  kept there as the record) to the framed sign, 1,400 px wide. Undated,
 *  like the photo. */
export const WAIVER_SIGN_PHOTO = `${import.meta.env.BASE_URL}lspc-waiver-sign.jpg`;

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
 *
 * Under Licensed, the USPA license. It sets no wind limit (BSR 2-1 H sets
 * none for any license); it is here because the profile is where a jumper
 * says who they are, and the drift card's Deploy box opens on the 2-1 I
 * minimum for it (`openingMinimum`).
 */
export function ProfileSelector({
  profile,
  lastStudent,
  lastTier,
  onChange,
  license,
  onLicenseChange,
}: {
  profile: WindProfileId;
  lastStudent: WindProfileId;
  lastTier: WindProfileId;
  onChange: (p: WindProfileId) => void;
  license: License;
  onLicenseChange: (l: License) => void;
}): JSX.Element {
  const licensed = profile === 'licensed';
  const isWaiver = profile.startsWith('waiver');
  const choice = (label: string, on: boolean, choose: () => void) => (
    <button key={label} type="button" className={on ? 'active' : ''} aria-pressed={on} onClick={choose}>
      {label}
    </button>
  );
  const button = (label: string, on: boolean, to: WindProfileId) => choice(label, on, () => onChange(to));

  return (
    <>
      <div className="class-toggle" role="group" aria-label="Jumper class">
        {button('Student', !licensed, licensed ? lastStudent : profile)}
        {button('Licensed', licensed, 'licensed')}
      </div>
      {licensed && (
        <div className="class-toggle class-toggle-sub" role="group" aria-label="USPA license">
          {LICENSES.map((l) => choice(l, l === license, () => onLicenseChange(l)))}
        </div>
      )}
      {!licensed && (
        <div className="class-toggle class-toggle-sub" role="group" aria-label="Student wind limits">
          {button('USPA BSR', profile === 'student', 'student')}
          {button('LSPC waiver', isWaiver, isWaiver ? profile : lastTier)}
        </div>
      )}
      {isWaiver && (
        <>
          <div className="tier-toggle" role="group" aria-label="Waiver experience tier">
            {WAIVER_TIERS.map((tier) => button(tier.label, tier.id === profile, tier.id))}
          </div>
          {/* The sign itself, a tap away from the tiers read off it, so a
              jumper can check the transcription. Undated, so it says so. */}
          <a className="tier-sign" href={WAIVER_SIGN_PHOTO} target="_blank" rel="noopener noreferrer">
            Photo of the posted sign (undated)
          </a>
        </>
      )}
    </>
  );
}
