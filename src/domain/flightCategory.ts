/** FAA flight category (VFR / MVFR / IFR / LIFR) from ceiling and visibility —
 *  the classification usairnet color-codes and pilots brief from. Pure and
 *  unit-tested. This is a factual weather category (FAA AIM 7-1-7), NOT a
 *  jump go/no-go verdict; the UI surfaces it and cites the source. */

import type { CurrentConditions, HourlyPoint } from './types';
import { ceilingState } from './normalize';

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

export function ceilingCategory(ft: number | null): FlightCategory {
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

/**
 * Flight category for a current observation, which may establish nothing
 * about the ceiling: no sky group at all, or a `BKN///` — a broken layer
 * whose height the sensor could not measure (see `ceilingState`).
 *
 * The AIM's "and/or" lets visibility alone establish MVFR, IFR or LIFR, so a
 * report with 2 SM and no usable ceiling is still IFR. It cannot establish
 * VFR: that needs a ceiling above 3,000 ft AND visibility above 5 miles, and
 * the first is unknown. `flightCategory` reads a null ceiling as "no ceiling"
 * because that is what a clear METAR yields, so this wrapper is where an
 * unknown ceiling is told apart from a clear sky: it never returns VFR from
 * half a report. Four of forty KPMV observations on 2026-09-23 had no sky
 * group; without this they wore a VFR pill, and a `BKN///` would have too.
 */
export function observedFlightCategory(c: CurrentConditions): FlightCategory | null {
  if (ceilingState(c) === 'known') return flightCategory(c.ceilingFtAgl, c.visibilitySm);
  return withoutCeiling(c.visibilitySm);
}

/** The category when the ceiling is unknown: what visibility alone can
 *  establish (MVFR, IFR or LIFR), never VFR. */
function withoutCeiling(visibilitySm: number | null): FlightCategory | null {
  const byVisibility = flightCategory(null, visibilitySm);
  return byVisibility === 'VFR' ? null : byVisibility;
}

/**
 * Flight category for a forecast hour from the NWS gridpoint. Inside the
 * ceiling forecast a null ceiling is NWS's "no ceiling" and reads as
 * `flightCategory` reads it. Past it the ceiling is unknown, as for a
 * report with no sky group (`observedFlightCategory`): visibility can still
 * establish MVFR, IFR or LIFR, not VFR. The two elements have ended at the
 * same hour in every forecast read to 2026-10-23
 * (docs/ceiling-heights.md, "The hourly table's flight category"), so this
 * only changes anything if they part.
 */
export function forecastFlightCategory(
  h: Pick<HourlyPoint, 'ceilingFtAgl' | 'ceilingForecast' | 'visibilitySm'>,
): FlightCategory | null {
  if (h.ceilingForecast) return flightCategory(h.ceilingFtAgl, h.visibilitySm);
  return withoutCeiling(h.visibilitySm);
}

export const CATEGORY_LABEL: Record<FlightCategory, string> = {
  VFR: 'VFR',
  MVFR: 'Marginal VFR',
  IFR: 'IFR',
  LIFR: 'Low IFR',
};
