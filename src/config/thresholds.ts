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
 *  3. Where NO published rule sets the number at all, the citation says so:
 *     `appHeuristic` below. A threshold the app invented must not be dressed in
 *     a USPA or FAA source line — that is borrowed authority, and it is the one
 *     failure mode a reader cannot detect by clicking the link.
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
   * It is NOT the home for a number the app invented: flags that fire on a
   * house threshold (ceiling, fog spread, precipitation and forecast-storm
   * chance) cite appHeuristic below, because attaching a SIM link to those made
   * the SIM look like the source of a figure it never printed.
   */
  uspaWeather: {
    source: 'USPA SIM',
    ref: 'Weather awareness — winds, clouds, precipitation, storms',
    url: SIM_INDEX_URL,
    note: `${VERIFY_NOTE} Links to the SIM contents, not a section: the SIM section governing general weather guidance has not been identified, and a wrong section number would be worse than a general link.`,
  },
  /**
   * House thresholds — the numbers this dashboard invented.
   *
   * Several flags fire on levels no published rule sets: the ceiling bands, the
   * fog dew-point spread, the precipitation and thunderstorm chances, the
   * licensed wind bands, and every "watch" band that sits a few knots under a
   * real limit. They were chosen so the card says something useful before a
   * condition becomes a problem — which is a reasonable thing for a dashboard
   * to do, and NOT a reasonable thing to hang a USPA or FAA citation on.
   *
   * Citing the SIM or a CFR for one of those numbers is worse than citing
   * nothing: it lends borrowed authority to a figure nobody sourced, and a
   * jumper who follows the link to check it will not find it there. This entry
   * is where those flags point instead. Its URL is the in-app citations page,
   * which lists every unsourced number for an instructor to rule on.
   */
  appHeuristic: {
    source: 'LSPC Weather — app heuristic',
    ref: 'Dashboard flag threshold — not a published limit',
    url: '#citations',
    note:
      'Not a USPA or FAA figure. This dashboard picked the number to decide when to raise a flag; ' +
      'no rule, BSR, or club policy sets it. Listed on the in-app citations page for an instructor to review.',
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
  /** Surface wind, knots. */
  windWatchKt: number;
  windCautionKt: number;
  /** Gust spread (gust − sustained), knots — turbulence flag. */
  gustSpreadWatchKt: number;
  /** Absolute gust ceiling, knots (LSPC waiver). undefined = no absolute rule. */
  gustCautionKt?: number;
  /** Guidance + citation for the surface-wind flag (varies by profile). */
  windGuidance: string;
  windCitation: Citation;
  /**
   * Citation for the CAUTION band as a NUMBER, which is not always the same
   * claim as `windCitation`. `windCitation` sources the guidance SENTENCE (for
   * licensed jumpers that sentence is "USPA sets no limit", so it cites the
   * BSR for an absence). The surface-wind card instead draws the band at a
   * specific speed and needs the source of THAT speed: the USPA figure for
   * students, the posted club policy for waiver tiers, and — for licensed
   * jumpers, where nobody published a limit — the app's own heuristic.
   * Pointing the card's 25 kt band at the BSR would credit USPA with a number
   * the same sentence says it never set.
   */
  windLimitCitation: Citation;
  /** Ceiling / cloud base AGL, ft. */
  ceilingWatchFt: number;
  ceilingCautionFt: number;
  /** Visibility, statute miles (105.17 floor below 10k MSL is 3 SM). */
  visibilityCautionSm: number;
  /** Precip probability, percent. */
  precipWatchPct: number;
  precipCautionPct: number;
  /** Density altitude above field elevation, ft (C-182 climb concern). */
  densityAltExcessWatchFt: number;
  densityAltExcessCautionFt: number;
  /** Minutes before sunset to start flagging "last load" pressure. */
  lastLoadWatchMin: number;
}

const STUDENT_WIND_KT = 12; // USPA ~14 mph rounded to whole knots
const LICENSED_WIND_WATCH_KT = 17;
const LICENSED_WIND_CAUTION_KT = 25;

const STUDENT: Thresholds = {
  windWatchKt: STUDENT_WIND_KT - 2,
  windCautionKt: STUDENT_WIND_KT,
  gustSpreadWatchKt: 8,
  windGuidance:
    'USPA recommends max ~14 mph (~12 kt) ground winds for solo students on ram-air reserves.',
  windCitation: CITATIONS.uspaStudentWinds,
  windLimitCitation: CITATIONS.uspaStudentWinds,
  ceilingWatchFt: 5000,
  ceilingCautionFt: 3000,
  visibilityCautionSm: 3,
  precipWatchPct: 25,
  precipCautionPct: 50,
  densityAltExcessWatchFt: 2000,
  densityAltExcessCautionFt: 3500,
  lastLoadWatchMin: 45,
};

const LICENSED: Thresholds = {
  windWatchKt: LICENSED_WIND_WATCH_KT,
  windCautionKt: LICENSED_WIND_CAUTION_KT,
  gustSpreadWatchKt: 10,
  windGuidance:
    'No USPA hard wind limit for licensed jumpers — included for awareness; consider canopy size and currency. ' +
    'The levels this flag fires at are the dashboard’s own, not USPA’s. ' +
    'Whether the load flies is a separate question: takeoff limits come from the aircraft’s operating limitations and the pilot in command, not from USPA — ask the PIC.',
  // Cites the BSR for the absence of a limit, not the student limit: this flag
  // is awareness only, and a reader who follows the link should land on the
  // section that shows the wind rule is written for students.
  windCitation: CITATIONS.uspaLicensedWinds,
  // The 17/25 kt bands themselves are app-invented (the sentence above says as
  // much), so the card that draws them cites the heuristic, not the BSR.
  windLimitCitation: CITATIONS.appHeuristic,
  ceilingWatchFt: 4000,
  ceilingCautionFt: 2500,
  visibilityCautionSm: 3,
  precipWatchPct: 30,
  precipCautionPct: 60,
  densityAltExcessWatchFt: 2500,
  densityAltExcessCautionFt: 4000,
  lastLoadWatchMin: 30,
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
    windCautionKt: mphToKt(tier.windMph),
    windWatchKt: mphToKt(Math.max(0, tier.windMph - 3)),
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
