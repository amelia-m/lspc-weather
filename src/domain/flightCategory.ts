/** FAA flight category (VFR / MVFR / IFR / LIFR) from ceiling and visibility —
 *  the classification usairnet color-codes and pilots brief from. Pure and
 *  unit-tested. This is a factual weather category (FAA AIM 7-1-7), NOT a
 *  jump go/no-go verdict; the UI surfaces it and cites the source. */

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

/** Restrictiveness order — a higher rank is worse (more limiting). */
const RANK: Record<FlightCategory, number> = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 };

/**
 * Standard FAA/AIM thresholds (ceiling ft AGL, visibility statute miles):
 *   VFR   ceiling > 3000  AND vis > 5
 *   MVFR  ceiling 1000–3000 OR vis 3–5
 *   IFR   ceiling 500–<1000 OR vis 1–<3
 *   LIFR  ceiling < 500   OR vis < 1
 * The overall category is the more restrictive of the ceiling and visibility
 * categories. A null ceiling means "no ceiling" (unlimited); a null visibility
 * is unknown and doesn't contribute. Returns null when neither is usable.
 */
export function flightCategory(
  ceilingFtAgl: number | null,
  visibilitySm: number | null,
): FlightCategory | null {
  if (ceilingFtAgl == null && visibilitySm == null) return null;
  const cats: FlightCategory[] = [ceilingCategory(ceilingFtAgl)];
  if (visibilitySm != null) cats.push(visibilityCategory(visibilitySm));
  return cats.reduce((worst, c) => (RANK[c] > RANK[worst] ? c : worst));
}

function ceilingCategory(ft: number | null): FlightCategory {
  if (ft == null) return 'VFR'; // no ceiling reported → unlimited
  if (ft < 500) return 'LIFR';
  if (ft < 1000) return 'IFR';
  if (ft <= 3000) return 'MVFR';
  return 'VFR';
}

function visibilityCategory(sm: number): FlightCategory {
  if (sm < 1) return 'LIFR';
  if (sm < 3) return 'IFR';
  if (sm <= 5) return 'MVFR';
  return 'VFR';
}

export const CATEGORY_LABEL: Record<FlightCategory, string> = {
  VFR: 'VFR',
  MVFR: 'Marginal VFR',
  IFR: 'IFR',
  LIFR: 'Low IFR',
};
