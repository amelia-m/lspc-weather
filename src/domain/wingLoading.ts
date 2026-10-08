import type { NavigatorSize, NavigatorSkill } from '../config/canopies';

/** Pounds per kilogram (exact by definition of the international pound). */
export const LB_PER_KG = 2.2046226218;

/** Exit weight: the jumper and everything they jump with. */
export const exitWeightLb = (bodyLb: number, gearLb: number): number => bodyLb + gearLb;

/** Wing loading, lb per sq ft: exit weight over canopy area. */
export const wingLoading = (exitLb: number, areaSqFt: number): number => exitLb / areaSqFt;

/**
 * How an exit weight stands against PD's recommended maximum for one skill
 * set on one size: the figure and the margin, in pounds. A comparison with a
 * published figure, not a verdict: what a jumper may fly is the instructor's
 * and the S&TA's call.
 */
export function againstChart(
  exitLb: number,
  size: NavigatorSize,
  skill: NavigatorSkill,
): { maxLb: number; marginLb: number } {
  const maxLb = size.maxExit[skill][0];
  return { maxLb, marginLb: maxLb - exitLb };
}

/** The sizes, of those offered, whose recommended maximum for `skill` is at
 *  or above `exitLb`, smallest first. */
export function sizesWithin(
  exitLb: number,
  chart: readonly NavigatorSize[],
  areas: readonly number[],
  skill: NavigatorSkill,
): number[] {
  return chart
    .filter((s) => areas.includes(s.areaSqFt) && s.maxExit[skill][0] >= exitLb)
    .map((s) => s.areaSqFt)
    .sort((a, b) => a - b);
}
