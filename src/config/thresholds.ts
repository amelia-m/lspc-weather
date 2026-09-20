import type { Citation, JumperClass } from '../domain/types';
import { mphToKt } from '../domain/units';

/**
 * Advisory thresholds and their citations.
 *
 * DESIGN RULE: this dashboard does NOT make go/no-go decisions. Every value
 * here exists only to FLAG a condition worth noting and to point the jumper at
 * the authoritative source so THEY (or the S&TA / instructor / PIC) decide.
 */

const VERIFY_NOTE =
  'AI-derived citation — may be inaccurate. Verify against the linked primary source and a licensed professional before use.';

/** SIM section URLs all take this shape — `simUrl('2-1')` → …/sim/2-1. Written
 *  once so a citation cannot drift into a different URL shape (deep anchors,
 *  PDF mirrors) that may not resolve. */
const simUrl = (section: string) => `https://www.uspa.org/sim/${section}`;

/** The SIM's table of contents. Used when no section has been identified for a
 *  claim — see the honesty rule in the CITATIONS doc comment below. */
const SIM_INDEX_URL = 'https://www.uspa.org/sim';

/**
 * Citations — the product, not decoration.
 *
 * This dashboard gives no go/no-go verdict; its whole job is to flag a
 * condition and hand the jumper the rule so they (or the S&TA / instructor /
 * PIC) can check it. So a citation has to land on the SECTION that governs the
 * claim: a reader sent to a document index to hunt for a wind limit will not
 * hunt, and an uncheckable flag is just an opinion.
 *
 * Two rules keep that honest, both enforced by tests/thresholds.test.ts:
 *
 *  1. `source` and `url` must agree. A source naming "Section 2-1" links to
 *     /sim/2-1; a source naming no section links to the SIM index. Naming a
 *     section while linking to the index claims a precision the link does not
 *     deliver.
 *  2. Where the governing section is NOT known, the citation stays on the index
 *     and says so in its note. A confidently wrong section number is worse than
 *     an honest general link — it sends a jumper to the wrong rule while
 *     looking authoritative. Pin such a citation to a section only after
 *     someone has read it in a current SIM.
 *  3. Where NO published rule sets the number at all, the app does not raise a
 *     flag on it. There is deliberately no house-heuristic citation to fall back
 *     on: a threshold nobody published cannot be checked, and a dashboard whose
 *     premise is that every flag is traceable has no honest way to show one.
 *     Such numbers are listed on the in-app #citations page for review instead.
 */
export const CITATIONS = {
  /** BSR maximum ground winds for solo students. Section 2-1 is the Basic
   *  Safety Requirements themselves; the LSPC waiver (docs/) treats this limit
   *  as a BSR that needs on-site instructor approval to exceed, which is why
   *  the waiver tiers below cite the club policy rather than this. */
  uspaStudentWinds: {
    source: 'USPA SIM, Section 2-1 (BSR)',
    ref: 'Basic Safety Requirements — student ground-wind limits',
    url: simUrl('2-1'),
    note: VERIFY_NOTE,
  },
  /** Same BSR section, different claim: the ground-wind limit is written for
   *  solo students, so for a licensed jumper the section is cited for the
   *  ABSENCE of a limit. Split from uspaStudentWinds because sharing that
   *  citation attached a ref about student limits to a flag explicitly telling
   *  licensed jumpers no such limit binds them. */
  uspaLicensedWinds: {
    source: 'USPA SIM, Section 2-1 (BSR)',
    ref: 'Basic Safety Requirements — wind limits stated for students, not licensed jumpers',
    url: simUrl('2-1'),
    note: VERIFY_NOTE,
  },
  far10517: {
    source: '14 CFR § 105.17',
    ref: 'Flight visibility & clearance from cloud (parachute ops)',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-105/subpart-B/section-105.17',
    note: VERIFY_NOTE,
  },
  far10519: {
    source: '14 CFR § 105.19',
    ref: 'Parachute ops between sunset and sunrise (light visible ≥ 3 SM)',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-105/subpart-B/section-105.19',
    note: VERIFY_NOTE,
  },
  aimFlightCategory: {
    source: 'FAA AIM 7-1-7',
    ref: 'Categorical ceiling & visibility (VFR / MVFR / IFR / LIFR)',
    url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap7_section_1.html',
    note: VERIFY_NOTE,
  },
  /** Density altitude and its effect on climb performance. Backs the standing
   *  note on the density-altitude card, not a flag: the claim (a loaded jump
   *  plane climbs worse in high DA) is FAA-sourced and true at any DA, but the
   *  ft-above-field bands that used to raise a watch/caution were the app's
   *  own. The card prints the DA figure; the reader judges it. */
  faaDensityAltitude: {
    source: 'FAA-P-8740-2',
    ref: 'Density Altitude (FAA Safety pamphlet)',
    url: 'https://www.faasafety.gov/files/events/NM/NM07/2023/NM07120280/FAA-P-8740-02-DensityAltitude.pdf',
    note: VERIFY_NOTE,
  },
  /**
   * General weather awareness. Used by the two flags whose CLAIM is skydiving
   * practice a SIM section very likely governs, even though no section has been
   * identified: a thunderstorm reported at the station, and strong upper winds
   * lengthening the spot (where the practice claim is about jump run and exit
   * separation, not about the trigger speed, which is the app's own).
   *
   * DELIBERATELY still the SIM index. The BSRs (2-1) set wind limits, opening
   * altitudes and cloud clearance, but none of them govern "it is gusty" or
   * "there is a 40% chance of storms", and the SIM section that carries general
   * weather guidance has not been identified from this environment. Guessing a
   * number here would point a jumper at the wrong rule with a confident-looking
   * link, so the note tells the reader the link is an index on purpose.
   *
   * It is NOT a home for a number the app invented — see rule 3 above. The
   * flags that used to lean on it that way (ceiling, fog spread, precipitation
   * and forecast-storm chance) have been removed rather than relabelled.
   */
  uspaWeather: {
    source: 'USPA SIM',
    ref: 'Weather awareness — winds, clouds, precipitation, storms',
    url: SIM_INDEX_URL,
    note: `${VERIFY_NOTE} Links to the SIM contents, not a section: the SIM section governing general weather guidance has not been identified, and a wrong section number would be worse than a general link.`,
  },
  /** BSR minimum container-opening altitudes (students & A 3,000 ft; B 2,500;
   *  C/D 2,000; tandem 5,000) — same Section 2-1 as the wind limits. Drives the
   *  drift card's deploy-altitude floor via recommendedDeployFt(). */
  uspaOpeningAltitude: {
    source: 'USPA SIM, Section 2-1 (BSR)',
    ref: 'Basic Safety Requirements — minimum container opening altitudes',
    url: simUrl('2-1'),
    note: VERIFY_NOTE,
  },
  lspcWaiver: {
    source: 'LSPC Waivered Wind Limits',
    ref: 'Club wind-limit policy (posted at the DZ)',
    url: 'https://github.com/amelia-m/lspc-weather/blob/main/docs/lspc-waivered-wind-limits.md',
    note: 'Transcribed from the LSPC posted policy photo — verify against the current posted sign.',
  },
} satisfies Record<string, Citation>;

export interface Thresholds {
  /**
   * Surface-wind caution band, knots — the ONLY level the wind flag fires at.
   *
   * There is deliberately no earlier "watch" band. The one that used to sit a
   * couple of knots under this (and 3 mph under the posted waiver limits) was
   * the app's own invention: no BSR, club waiver or reg defines an early-warning
   * speed, so a reader had nothing to check it against.
   *
   * Meaningful only where `windLimitCitation` is set, i.e. where a published
   * source puts a number here. Where nobody published one (licensed jumpers) no
   * flag fires and the card draws no band; the value then survives only as the
   * upper bound the surface-wind card scales its bar against.
   */
  windCautionKt: number;
  /** Absolute gust ceiling, knots (LSPC waiver). undefined = no absolute rule. */
  gustCautionKt?: number;
  /**
   * Guidance sentence and its citation for the surface-wind flag. They reach
   * the screen only when that flag fires, so on a profile with no published
   * limit (licensed) they describe why the profile has no limit and nothing
   * renders them.
   */
  windGuidance: string;
  windCitation: Citation;
  /**
   * Source of the CAUTION band as a NUMBER, which is a different claim from
   * `windCitation` (that one sources the guidance SENTENCE). The card draws the
   * band at a specific speed and needs the source of THAT speed: the USPA
   * figure for students, the posted club policy for waiver tiers.
   *
   * null means no published rule sets a limit for this profile. That is also
   * the switch on the flag itself: with no sourced number there is no trigger a
   * reader could check, so `evaluateAdvisories` raises no surface-wind flag and
   * the card draws no band.
   */
  windLimitCitation: Citation | null;
  /** Visibility, statute miles (105.17 floor below 10k MSL is 3 SM). */
  visibilityCautionSm: number;
}

const STUDENT_WIND_KT = 12; // USPA ~14 mph rounded to whole knots

/** Licensed profile: nobody publishes a surface-wind limit for licensed
 *  jumpers, so no band is drawn and no flag fires. This number is NOT a limit —
 *  it is only the upper bound the surface-wind card scales its bar against, so
 *  a 12 kt reading does not render as a full bar. It was previously this
 *  dashboard's own 25 kt caution band, which fired a flag nobody could check. */
const LICENSED_BAR_SCALE_KT = 25;

const STUDENT: Thresholds = {
  windCautionKt: STUDENT_WIND_KT,
  windGuidance:
    'USPA recommends max ~14 mph (~12 kt) ground winds for solo students on ram-air reserves.',
  windCitation: CITATIONS.uspaStudentWinds,
  windLimitCitation: CITATIONS.uspaStudentWinds,
  visibilityCautionSm: 3,
};

/**
 * Licensed jumpers. Both bands this profile used to flag on (17 kt watch,
 * 25 kt caution) were the dashboard's own, and its own guidance says no USPA
 * limit binds a licensed jumper — so the flag had no published trigger at any
 * level and no longer fires. What the reader sees instead is the surface-wind
 * card: the observation, and its line saying there is no sourced limit to draw.
 *
 * The guidance sentence below is this profile's account of that absence. With
 * no flag to carry it, nothing renders it today; it stays because it is the
 * text that belongs to `windCitation` — the BSR cited for the absence — should
 * the card ever show the profile's own words.
 */
const LICENSED: Thresholds = {
  windCautionKt: LICENSED_BAR_SCALE_KT,
  windGuidance:
    'No USPA hard wind limit for licensed jumpers — included for awareness; consider canopy size and currency. ' +
    'Whether the load flies is a separate question: takeoff limits come from the aircraft’s operating limitations and the pilot in command, not from USPA — ask the PIC.',
  // Cites the BSR for the absence of a limit, not the student limit: a reader
  // who follows the link should land on the section that shows the wind rule is
  // written for students.
  windCitation: CITATIONS.uspaLicensedWinds,
  // No published limit exists for licensed jumpers, so the card shows no band
  // and evaluateAdvisories raises no surface-wind flag for this profile.
  windLimitCitation: null,
  visibilityCautionSm: 3,
};

/** Kept for tests / back-compat. */
export const DEFAULT_THRESHOLDS: Record<JumperClass, Thresholds> = {
  student: STUDENT,
  licensed: LICENSED,
};

/* ---- LSPC waivered wind limits (posted policy; all values in mph) ---- */

export type WaiverTierId = 'waiver:0-5' | 'waiver:6-10' | 'waiver:10-20' | 'waiver:21+';
export type WindProfileId = 'student' | 'licensed' | WaiverTierId;

export interface WaiverTier {
  id: WaiverTierId;
  label: string;
  windMph: number;
  gustMph: number;
}

export const WAIVER_TIERS: WaiverTier[] = [
  { id: 'waiver:0-5', label: '0–5 jumps', windMph: 15, gustMph: 16 },
  { id: 'waiver:6-10', label: '6–10 jumps', windMph: 16, gustMph: 18 },
  { id: 'waiver:10-20', label: '10–20 jumps', windMph: 18, gustMph: 19 },
  { id: 'waiver:21+', label: '21+ jumps', windMph: 18, gustMph: 20 },
];

function waiverThresholds(tier: WaiverTier): Thresholds {
  return {
    ...STUDENT,
    // The posted policy states one wind figure and one gust ceiling per tier;
    // both are transcribed as-is. The earlier "watch" band this used to derive
    // (posted limit − 3 mph) appears nowhere on the sign, so it is gone.
    windCautionKt: mphToKt(tier.windMph),
    gustCautionKt: mphToKt(tier.gustMph),
    windGuidance:
      `LSPC waivered limit (students, ${tier.label}): max wind ${tier.windMph} mph, gusts under ${tier.gustMph} mph. ` +
      'Any excursion above the USPA BSR requires on-site approval by a USPA instructor; consult the S&TA.',
    windCitation: CITATIONS.lspcWaiver,
    windLimitCitation: CITATIONS.lspcWaiver,
  };
}

export function resolveThresholds(id: WindProfileId): Thresholds {
  if (id === 'student') return STUDENT;
  if (id === 'licensed') return LICENSED;
  const tier = WAIVER_TIERS.find((t) => t.id === id);
  return tier ? waiverThresholds(tier) : STUDENT;
}

/** Default deploy altitude (ft AGL) for a wind-limit profile — the USPA BSR
 *  minimum container-opening altitude for that jumper class: students &
 *  A-license 3,000 ft, licensed (B-license floor) 2,500 ft. Waiver tiers are
 *  all student-category, so they take the student floor. These are minimums,
 *  not targets; the drift card reminds jumpers to deploy above them. */
export function recommendedDeployFt(id: WindProfileId): number {
  return id === 'licensed' ? 2500 : 3000;
}

/** Human label for a profile id, used in the UI. */
export function profileLabel(id: WindProfileId): string {
  if (id === 'student') return 'Student';
  if (id === 'licensed') return 'Licensed';
  const tier = WAIVER_TIERS.find((t) => t.id === id);
  return tier ? `LSPC waiver · ${tier.label}` : 'Student';
}
