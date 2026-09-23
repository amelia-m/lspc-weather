import type { Citation, JumperClass } from '../domain/types';
import { mphToKt } from '../domain/units';

/**
 * Advisory thresholds and their citations.
 *
 * DESIGN RULE: this dashboard does NOT make go/no-go decisions. Every value
 * here exists only to FLAG a condition worth noting and to point the jumper at
 * the authoritative source so THEY (or the S&TA / instructor / PIC) decide.
 */

/** Note for a citation whose section text was read in the SIM that uspa.org
 *  served on 2026-09-22. It says what was done rather than "verified": the
 *  online SIM is not a printed edition, USPA revises it, and a reader deciding
 *  whether to trust a wind limit deserves the date and the source of the
 *  reading rather than a bare tick. Still not a substitute for an instructor:
 *  reading a rule is not the same as knowing how the DZ applies it. */
const SIM_READ_NOTE =
  'Section text read in the online SIM at uspa.org on 2026-09-22 and matches this claim. USPA revises the SIM — re-check against the current one, and confirm with the S&TA before relying on it.';

/** The same shape for the two CFR sections, read on 2026-09-23. They were read
 *  through the eCFR API (api/versioner/v1/full/2026-09-21/title-14.xml — Title
 *  14 as current on 2026-09-21), which serves the text the linked page renders;
 *  the page itself answers a script with a redirect to a bot check, so the API
 *  is what was actually read and the note says so. The URL stays on the page a
 *  person would open. */
const CFR_READ_NOTE =
  'Section text read through the eCFR (Title 14 current as of 2026-09-21) on 2026-09-23 and matches this claim. The CFR is amended — re-check the linked section, and confirm with the S&TA and the PIC before relying on it.';

/** AIM 7-1-7 as faa.gov served it on 2026-09-23: the HTML edition, Change 3,
 *  effective 2026-07-09. The FAA issues AIM changes on a schedule, so the
 *  change number is part of what was read, not decoration. */
const AIM_READ_NOTE =
  'Read in the AIM on faa.gov on 2026-09-23 (Change 3, effective 2026-07-09) and matches this claim. The FAA revises the AIM — re-check the linked section before relying on it.';

/** FAA-P-8740-2 as read on 2026-09-23 from the linked PDF: the 2008 AFS-8
 *  edition (cover "FAA–P–8740–2 • AFS–8 (2008) HQ-08561 Density Altitude",
 *  8 pages). The link is a copy in a FAASTeam event folder rather than a
 *  catalogue page — the shape most likely to rot — and no other FAA home for
 *  the pamphlet was found, so the note names the document so a reader can
 *  find it again if the link dies. */
const FAA_PAMPHLET_READ_NOTE =
  'Read on 2026-09-23 from the linked PDF (FAA-P-8740-2, AFS-8, 2008) and matches this claim. The link is a copy in a FAASTeam event folder, not a catalogue entry — if it stops resolving, the pamphlet is what to look for.';

/** SIM section URLs all take this shape — `simUrl('2-1')` → …/sim/2-1. Written
 *  once so a citation cannot drift into a different URL shape (deep anchors,
 *  PDF mirrors) that may not resolve. */
const simUrl = (section: string) => `https://www.uspa.org/sim/${section}`;

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
 *  2. Where the governing section is NOT known, the citation stays on the SIM
 *     index (https://www.uspa.org/sim) and says so in its note. A confidently
 *     wrong section number is worse than an honest general link — it sends a
 *     jumper to the wrong rule while looking authoritative. Pin such a citation
 *     to a section only after someone has read it in a current SIM.
 *
 *     No citation needs the index today: the two that did — general weather and
 *     exit separation — were pinned to 4-5 and 4-7 once those sections were
 *     read. The rule stands for the next claim that arrives without a section,
 *     and tests/thresholds.test.ts still enforces it.
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
    ref: 'BSR 2-1 H, Winds — maximum ground winds for all solo students: 14 mph for ram-air canopies, 10 mph for round reserves',
    url: simUrl('2-1'),
    note: SIM_READ_NOTE,
  },
  /** Same BSR section, different claim: the ground-wind limit is written for
   *  solo students, so for a licensed jumper the section is cited for the
   *  ABSENCE of a limit. Split from uspaStudentWinds because sharing that
   *  citation attached a ref about student limits to a flag explicitly telling
   *  licensed jumpers no such limit binds them. */
  uspaLicensedWinds: {
    source: 'USPA SIM, Section 2-1 (BSR)',
    ref: 'BSR 2-1 H, Winds — maximum ground winds “for licensed skydivers are unlimited”',
    url: simUrl('2-1'),
    note: SIM_READ_NOTE,
  },
  /** 105.17 bars parachute ops into or through cloud outright, then sets
   *  flight visibility and distance from cloud by altitude. Two of its rows
   *  matter at this DZ: below 10,000 ft MSL, 3 SM and 500 ft below / 1,000 ft
   *  above / 2,000 ft horizontal; at or above 10,000 ft MSL, 5 SM and 1,000 /
   *  1,000 ft / 1 mile. Brown's is at 1,182 ft MSL, so a 10,000 ft AGL exit is
   *  in the 5 SM row and the freefall drops into the 3 SM row on the way down.
   *
   *  The visibility flag fires at 3 SM, the lower row. The METAR reports
   *  surface visibility and the reg's measure is flight visibility at
   *  altitude, so the lower row is the one a surface reading can be held
   *  against without claiming it says more than it does; both rows are
   *  printed so the reader can check the exit against the right one. Whether
   *  the flag should fire at 5 SM instead is an open question on #citations. */
  far10517: {
    source: '14 CFR § 105.17',
    ref: 'Flight visibility and clearance from cloud — never into or through cloud; below 10,000 ft MSL 3 SM and 500 ft below / 1,000 ft above / 2,000 ft horizontal; at or above 10,000 ft MSL 5 SM and 1,000 / 1,000 ft / 1 mile',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-105/subpart-B/section-105.17',
    note: CFR_READ_NOTE,
  },
  /** 105.19 (a) sets the trigger — "between sunset and sunrise" — and the
   *  light; (b) says whose it is and when: displayed by the person or object
   *  descending, from a properly functioning open parachute until the surface.
   *  It is the jumper's light, not the aircraft's, and the section says nothing
   *  about licences — the USPA half of the after-sunset flag cites 5-3. */
  far10519: {
    source: '14 CFR § 105.19',
    ref: 'Parachute operations between sunset and sunrise — the jumper must display a light visible for at least 3 statute miles, from open canopy until reaching the surface',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-105/subpart-B/section-105.19',
    note: CFR_READ_NOTE,
  },
  /** The four bands in src/domain/flightCategory.ts were checked against this
   *  section on 2026-09-23 and match at every boundary, inclusive ends
   *  included (a 3,000 ft ceiling or exactly 5 SM is MVFR; 1,000 ft or 3 SM is
   *  MVFR, not IFR). The AIM calls these terms a description of "reported or
   *  forecast general ceiling and visibility conditions" — a classification,
   *  which is how the flag presents it. */
  aimFlightCategory: {
    source: 'FAA AIM 7-1-7',
    ref: 'Categorical ceiling and visibility conditions — LIFR / IFR / MVFR / VFR',
    url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap7_section_1.html',
    note: AIM_READ_NOTE,
  },
  /** Density altitude and its effect on climb performance. Backs the standing
   *  note on the density-altitude card, not a flag: the claim (a loaded jump
   *  plane climbs worse in high DA) is FAA-sourced and true at any DA, but the
   *  ft-above-field bands that used to raise a watch/caution were the app's
   *  own. The card prints the DA figure; the reader judges it.
   *
   *  Cited for the CLAIM, not the arithmetic: the pamphlet states no ft-per-°C
   *  coefficient and leaves humidity out of the density-altitude computation
   *  altogether (it treats humidity as an engine-power effect). The card's
   *  formula and its virtual-temperature correction are in
   *  src/domain/densityAltitude.ts, which says so. */
  faaDensityAltitude: {
    source: 'FAA-P-8740-2',
    ref: 'Density Altitude (FAA Safety pamphlet, AFS-8, 2008) — high density altitude means "reduced rate of climb" and "increased takeoff distance"',
    url: 'https://www.faasafety.gov/files/events/NM/NM07/2023/NM07120280/FAA-P-8740-02-DensityAltitude.pdf',
    note: FAA_PAMPHLET_READ_NOTE,
  },
  /**
   * General weather awareness — the thunderstorm flag's claim.
   *
   * This used to link to the SIM contents page because the governing section
   * had not been identified. It has been now: 4-5 is "Weather", and its part B
   * ("Hazardous Weather") covers gust fronts, turbulence in gusty winds,
   * spontaneously generating thunderstorms and dust devils, while part A
   * ("Determining Winds") covers checking winds before and during the jump.
   * That is the section a reader wants behind "thunderstorms reported at the
   * station", so the citation now names it.
   *
   * It is still NOT a home for a number the app invented — see rule 3 above.
   * The flags that used to lean on it that way (ceiling, fog spread,
   * precipitation and forecast-storm chance) have been removed rather than
   * relabelled, and pinning this citation to a real section does not license
   * bringing any of them back.
   */
  uspaWeather: {
    source: 'USPA SIM, Section 4-5 (Weather)',
    ref: 'SIM 4-5 B, Hazardous Weather — gust fronts, turbulence, thunderstorms, dust devils',
    url: simUrl('4-5'),
    note: SIM_READ_NOTE,
  },
  /**
   * Exit separation and spotting in strong upper winds — the winds-aloft card's
   * standing note.
   *
   * Split out of `uspaWeather`, which the note used to share with the
   * thunderstorm flag while both pointed at the SIM index. They are different
   * claims governed by different sections, and 4-7 C ("Exit Separation on Jump
   * Run") is the one that carries this: "On days with strong upper headwinds,
   * allow more time between groups on the same pass to get sufficient
   * horizontal separation over the ground."
   *
   * The card states the guidance at any wind speed. The trigger that used to
   * gate it (upper winds above 20 kt) was the app's own and is gone; 4-7 sets
   * separation distances, not a wind speed at which to start caring.
   */
  uspaSpotting: {
    source: 'USPA SIM, Section 4-7 (Spotting)',
    ref: 'SIM 4-7 C, Exit Separation on Jump Run — allow more time between groups in strong upper headwinds',
    url: simUrl('4-7'),
    note: SIM_READ_NOTE,
  },
  /**
   * Night jumps, USPA's half of the after-sunset flag.
   *
   * The flag used to make two claims — the FAA light requirement and a USPA
   * licence requirement — and offer one source, 14 CFR 105.19. 5-3 is the
   * section behind the second. The CFR was read on 2026-09-23 and confirms
   * the split: 105.19 is about the light the descending jumper displays and
   * says nothing about licences. 5-3 also settles when the flag should fire:
   * "Any jumps made between official sunset and official sunrise are
   * considered night jumps", which is the same trigger the reg uses, so the
   * flag firing at sunset matches both authorities.
   *
   * Note the modal verb. 5-3 B says participants "should meet all the
   * requirements for a USPA B or higher license" — a recommendation — while
   * 3-1 lists performing night jumps among the B licence's privileges. The
   * guidance text says "should" for that reason; it read "requires" before.
   *
   * It also no longer prints "(50 jumps)". That figure is real but it is in
   * 3-1, not here, so a reader following this link could not check it — the
   * same defect as citing a section a claim does not appear in. The number is
   * on the #citations page, where 3-1 is named as its source.
   */
  uspaNightJumps: {
    source: 'USPA SIM, Section 5-3 (Night Jumps)',
    ref: 'SIM 5-3 — any jump between official sunset and sunrise is a night jump; participants should meet USPA B-licence requirements',
    url: simUrl('5-3'),
    note: SIM_READ_NOTE,
  },
  /**
   * The rule underneath the club waiver: which BSRs an S&TA may waive.
   *
   * The LSPC waiver document says excursions from the BSR wind limits are
   * "approved on site", and 2-2 is what makes that possible — a BSR marked [S]
   * is waiverable by an S&TA or Examiner, and the student ground-wind BSR
   * (2-1 H) carries that marking. The waiver tiers still cite club policy for
   * their numbers, because the numbers are the club's; this rides alongside as
   * `windSecondaryCitation`, for the authority the club is exercising.
   */
  uspaWaivers: {
    source: 'USPA SIM, Section 2-2 (Waivers to the BSRs)',
    ref: 'SIM 2-2 B — a BSR marked [S] may be waived by an S&TA or Examiner; the student ground-wind BSR (2-1 H) is so marked',
    url: simUrl('2-2'),
    note: SIM_READ_NOTE,
  },
  /** BSR minimum container-opening altitudes — same Section 2-1 as the wind
   *  limits. Drives the drift card's deploy-altitude floor via
   *  recommendedDeployFt().
   *
   *  2-1 I reads: tandem 5,000 ft AGL; all students and A-license 3,000 ft;
   *  B-license 2,500 ft; C- and D-license 2,500 ft [S], waiverable to no lower
   *  than 2,000 ft. This app previously printed a flat 2,000 ft for C/D, which
   *  is the waiver floor rather than the BSR minimum — 2-2 C confirms the
   *  direction, describing an S&TA waiving the deployment altitude "from 2,500
   *  feet down to 2,000 feet". */
  uspaOpeningAltitude: {
    source: 'USPA SIM, Section 2-1 (BSR)',
    ref: 'BSR 2-1 I — minimum container opening altitudes: tandem 5,000 ft AGL; students & A 3,000 ft; B 2,500 ft; C/D 2,500 ft, waiverable to no lower than 2,000 ft',
    url: simUrl('2-1'),
    note: SIM_READ_NOTE,
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
   * Guidance sentence and its citation for the profile's surface wind.
   *
   * Two places read them, because a profile with no published limit raises no
   * flag and a flag is not the only way a sourced claim should reach a reader:
   * the surface-wind flag carries them when it fires, and SurfaceWindPanel
   * prints them as a standing note where `windLimitCitation` is null — the case
   * where the sentence is the profile's account of the ABSENCE of a limit and
   * would otherwise never be seen at any speed.
   */
  windGuidance: string;
  windCitation: Citation;
  /** A second authority for `windGuidance`, where the sentence makes a claim
   *  the first does not carry. The waiver tiers are the case: their numbers are
   *  the club's, but "any excursion above the BSR needs on-site approval" is
   *  the SIM 2-2 [S] mechanism, and a reader following one link should not have
   *  to take the other on trust. */
  windSecondaryCitation?: Citation;
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

const STUDENT_WIND_KT = 12; // BSR 2-1 H: 14 mph, rounded to whole knots

/** Licensed profile: nobody publishes a surface-wind limit for licensed
 *  jumpers, so no band is drawn and no flag fires. This number is NOT a limit —
 *  it is only the upper bound the surface-wind card scales its bar against, so
 *  a 12 kt reading does not render as a full bar. It was previously this
 *  dashboard's own 25 kt caution band, which fired a flag nobody could check. */
const LICENSED_BAR_SCALE_KT = 25;

const STUDENT: Thresholds = {
  windCautionKt: STUDENT_WIND_KT,
  // "Maximum", not "recommends": BSR 2-1 H states a maximum, and the [S]
  // marking makes it waiverable by an S&TA rather than advisory. The old
  // wording read as guidance a jumper could weigh, which is what the club
  // waiver document contradicted — it treats the figure as a limit needing
  // on-site approval to exceed. The canopy qualifier is the BSR's own: the
  // 14 mph figure is paired with ram-air canopies, 10 mph with round reserves.
  // The BSR states two figures and this profile can only act on one. Naming
  // the 10 mph round-reserve limit without saying the flag does not use it
  // left the card advertising a published limit nothing here checks — the same
  // "silence reads as an all-clear" failure the Licensed profile has a whole
  // standing note about. The app models no canopy type, so the honest move is
  // to keep both sourced figures and say which one the band and flag use.
  // Modelling canopy type is in docs/open-questions.md.
  windGuidance:
    'USPA BSR maximum ground winds for solo students: 14 mph (~12 kt) on ram-air canopies, 10 mph on round reserves. The band and flag here use the 14 mph figure — on a round reserve the limit is lower and nothing on this page flags it. An S&TA or Examiner may waive it on site.',
  windCitation: CITATIONS.uspaStudentWinds,
  // The guidance's last clause — that an S&TA or Examiner may waive it — is
  // 2-2's rule, not 2-1's. 2-1 carries the [S] marker; 2-2 B is what says the
  // marker means S&TA or Examiner. The waiver tiers cite it for the same
  // sentence, and this profile makes the same claim.
  windSecondaryCitation: CITATIONS.uspaWaivers,
  windLimitCitation: CITATIONS.uspaStudentWinds,
  visibilityCautionSm: 3,
};

/**
 * Licensed jumpers. Both bands this profile used to flag on (17 kt watch,
 * 25 kt caution) were the dashboard's own, and its own guidance says no USPA
 * limit binds a licensed jumper — so the flag had no published trigger at any
 * level and no longer fires.
 *
 * The guidance sentence below is this profile's account of that absence, and
 * removing the flag must not remove it too: it names no number, so it is
 * checkable exactly as written (the BSR in `windCitation` is cited for the
 * absence, and the takeoff question is referred to the PIC, who holds it). It
 * therefore stands on the surface-wind card at any speed rather than waiting
 * for a trigger this profile no longer has — the treatment the winds-aloft and
 * density-altitude guidance got when their invented triggers were removed. A
 * licensed jumper in 60 kt of wind reads it there; nothing in this app flags
 * that wind for them.
 */
const LICENSED: Thresholds = {
  windCautionKt: LICENSED_BAR_SCALE_KT,
  windGuidance:
    'No USPA ground-wind limit for licensed jumpers — the BSR states maximum ground winds for solo students and then that for licensed skydivers they "are unlimited". Judge it on your canopy, your currency and the conditions, with the S&TA. ' +
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
    //
    // Stored in knots, which is how they are compared against a METAR, but the
    // tiers are only one mph apart at the top of the table — so anything that
    // DISPLAYS these uses fmtLimitSpeed, or the 19 and 20 mph ceilings collide
    // at whole knots and the sign is misquoted. See domain/units.ts.
    windCautionKt: mphToKt(tier.windMph),
    gustCautionKt: mphToKt(tier.gustMph),
    windGuidance:
      `LSPC waivered limit (students, ${tier.label}): max wind ${tier.windMph} mph, gusts under ${tier.gustMph} mph. ` +
      'Any excursion above the USPA BSR requires on-site approval by a USPA instructor; consult the S&TA.',
    windCitation: CITATIONS.lspcWaiver,
    // The tier's numbers are the club's, so the club document is the primary
    // citation. The second sentence of the guidance is not the club's rule but
    // the SIM one that permits it — 2-2 classifies the student wind BSR [S],
    // waiverable by an S&TA or Examiner.
    windSecondaryCitation: CITATIONS.uspaWaivers,
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
