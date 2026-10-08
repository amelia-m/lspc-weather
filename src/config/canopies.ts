/**
 * Performance Designs' Navigator wing-loading chart, and what this club flies.
 *
 * Transcribed by the maintainer from PD's "Navigator Wing Loading Chart"
 * (TABLE-0122 Rev.A, on performancedesigns.com/navigator) on 2026-10-08, as
 * text and a screenshot that agree. The page serves the chart from its own
 * script, folded behind a button, and it did not open under an automated
 * check from here (2026-10-08), so the figures have not been checked against
 * PD's copy; CITATIONS.pdNavigator says so, and #citations asks for it.
 *
 * The chart's footnote calls each figure the "Recommended Maximum Exit
 * Weight in pounds / (KG) for that skillset"; PD's "Wing Loading Chart
 * Interpretation" (CN-0089 Rev. 0, read 2026-10-08) says the weights in its
 * sizing charts "are the maximum exit weights for each category, not the
 * recommended weights", so the card calls them maximums. The NOVICE column
 * carries no asterisk on the chart while the others do; CN-0089 treats every
 * category alike, and so does the app. "MIN EXT WT." reads "VLC" on every
 * row, which CN-0089 defines as "varies with landing conditions": no fixed
 * minimum, so nothing here uses it.
 */
export const NAVIGATOR_SKILLS = ['student', 'novice', 'intermediate', 'advanced', 'expert', 'max'] as const;
export type NavigatorSkill = (typeof NAVIGATOR_SKILLS)[number];

export const NAVIGATOR_SKILL_LABEL: Readonly<Record<NavigatorSkill, string>> = {
  student: 'Student',
  novice: 'Novice',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
  max: 'Max',
};

export interface NavigatorSize {
  /** Canopy area, sq ft. */
  areaSqFt: number;
  /** PD's maximum exit weight per skill set, [lb, kg] as printed. */
  maxExit: Readonly<Record<NavigatorSkill, readonly [number, number]>>;
}

const row = (areaSqFt: number, ...p: [number, number][]): NavigatorSize => ({
  areaSqFt,
  maxExit: { student: p[0], novice: p[1], intermediate: p[2], advanced: p[3], expert: p[4], max: p[5] },
});

export const NAVIGATOR_CHART: readonly NavigatorSize[] = [
  row(200, [140, 64], [160, 73], [200, 91], [240, 109], [240, 109], [240, 109]),
  row(220, [176, 80], [187, 85], [220, 100], [264, 120], [264, 120], [264, 120]),
  row(240, [216, 98], [216, 98], [240, 109], [288, 131], [288, 131], [288, 131]),
  row(260, [255, 116], [255, 116], [280, 127], [336, 153], [336, 153], [336, 153]),
  row(280, [270, 123], [270, 123], [300, 136], [336, 153], [336, 153], [336, 153]),
  row(300, [290, 132], [290, 132], [320, 145], [350, 159], [350, 159], [350, 159]),
];

/** The Navigator sizes the club's student rigs carry, per the maintainer on
 *  2026-10-08 ("I believe the LSPC student canopies are all Performance
 *  Designs Navigators", to be confirmed, with a table of student rigs to
 *  follow). */
export const LSPC_STUDENT_NAVIGATOR_SIZES: readonly number[] = [200, 220, 260, 280];

/** Gear weight added to body weight for exit weight: one student rig (a
 *  Navigator 260) weighed by the maintainer at about 32 lb, 2026-10-08, used
 *  for every rig until a table of weights replaces it. The card says so and
 *  lets the reader change it. */
export const STUDENT_RIG_WEIGHT_LB = 32;
