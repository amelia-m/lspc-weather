import type { Advisory, AdvisoryLevel, WeatherSnapshot } from './types';
import { CITATIONS, type Thresholds } from '../config/thresholds';
import { fmtSpeed, round, type SpeedUnit } from './units';
import { flightCategory, CATEGORY_LABEL } from './flightCategory';

/**
 * Turn a weather snapshot into a list of ADVISORIES — conditions worth noting,
 * each tied to the authoritative source. This engine deliberately produces NO
 * overall go/no-go verdict. The human (jumper, S&TA, PIC) decides.
 *
 * Pure function: same input → same output, no I/O. Unit-tested.
 */

export function evaluateAdvisories(
  snapshot: WeatherSnapshot,
  thresholds: Thresholds,
  now: number,
  unit: SpeedUnit = 'kt',
): Advisory[] {
  const out: Advisory[] = [];
  const { current, sun, densityAltitude } = snapshot;

  // --- Surface wind ---
  if (current) {
    const { speedKt, gustKt } = current.wind;
    // null means the observation lacked a usable reading — that is "no data",
    // not calm. Level on the EFFECTIVE wind (max of sustained and gust): a
    // gust past the limit is still wind past the limit. A gust reading alone
    // (sustained unreported) is enough to evaluate.
    if (speedKt != null || gustKt != null) {
      const effectiveKt = Math.max(speedKt ?? -Infinity, gustKt ?? -Infinity);
      const windLevel: AdvisoryLevel =
        effectiveKt >= thresholds.windCautionKt
          ? 'caution'
          : effectiveKt >= thresholds.windWatchKt
            ? 'watch'
            : 'info';
      if (windLevel !== 'info') {
        const levelKt = windLevel === 'caution' ? thresholds.windCautionKt : thresholds.windWatchKt;
        // Gust-driven: the gust crossed the threshold but the sustained speed did not.
        const gustDriven = gustKt != null && gustKt >= levelKt && (speedKt == null || speedKt < levelKt);
        out.push({
          id: 'surface-wind',
          level: windLevel,
          metric: 'Surface wind',
          value: formatWind(speedKt, gustKt, unit) + (gustDriven ? ' (gusts exceed limit)' : ''),
          guidance: thresholds.windGuidance,
          citation: thresholds.windCitation,
        });
      }
    }

    // --- Absolute gust ceiling (LSPC waiver profiles) ---
    if (thresholds.gustCautionKt != null && gustKt != null && gustKt >= thresholds.gustCautionKt) {
      out.push({
        id: 'gust-limit',
        level: 'caution',
        metric: 'Gust limit',
        // Both figures in the selected unit. The waiver states its ceiling in
        // mph, but printing the source unit next to a kt gust invited exactly
        // the wrong reading: a 14 kt gust against a "16 mph" ceiling looks like
        // 2 units of headroom when 14 kt IS 16 mph — the advisory appeared to
        // contradict the caution it was raising. The citation below carries the
        // reader back to the waiver's own wording.
        value: `gusting ${fmtSpeed(gustKt, unit)}, waiver ceiling ${fmtSpeed(thresholds.gustCautionKt, unit)}`,
        guidance:
          'Gusts are at or above the LSPC waiver gust ceiling for this experience tier (gusts measured over the last 30 min).',
        citation: thresholds.windCitation,
      });
    }

    // --- Visibility (105.17 floor below 10k MSL is 3 SM) ---
    if (current.visibilitySm != null && current.visibilitySm < thresholds.visibilityCautionSm) {
      out.push({
        id: 'visibility',
        level: 'caution',
        metric: 'Visibility',
        value: `${round(current.visibilitySm, 1)} SM`,
        guidance:
          '14 CFR 105.17 requires at least 3 SM flight visibility for jumps below 10,000 ft MSL.',
        citation: CITATIONS.far10517,
      });
    }

    // --- Flight category (FAA VFR/MVFR/IFR/LIFR from ceiling + visibility) ---
    const category = flightCategory(current.ceilingFtAgl, current.visibilitySm);
    if (category && category !== 'VFR') {
      out.push({
        id: 'flight-category',
        level: category === 'MVFR' ? 'watch' : 'caution',
        metric: 'Flight category',
        value: `${category} (${CATEGORY_LABEL[category]})`,
        // The AIM defines these categories and nothing else; it is not
        // regulatory and does not carry the pilot's VFR weather minimums. The
        // guidance used to name 14 CFR 91.155 while citing the AIM, so the one
        // link offered could not support the one rule named. Below-VFR
        // conditions are described here in terms the AIM does cover, and the
        // operating decision is sent to the PIC, who holds it.
        guidance:
          'Standard FAA flight category (AIM 7-1-7) from ceiling and visibility — a label for the weather, not a jump rule. Below VFR, expect the pilot’s VFR weather minimums and the cloud-clearance requirements for parachute ops to be the limiting factors; that call belongs to the PIC.',
        citation: CITATIONS.aimFlightCategory,
      });
    }

    // --- Overcast (no gaps to jump through) ---
    if (current.skyLayers.some((l) => l.cover === 'OVC')) {
      out.push({
        id: 'overcast',
        level: 'watch',
        metric: 'Sky cover',
        value: 'Overcast (OVC)',
        guidance:
          'Solid overcast leaves no gaps — jumps may not be made into or through clouds (14 CFR 105.17).',
        citation: CITATIONS.far10517,
      });
    }

    // --- Thunderstorm in present weather ---
    if (current.wxString && /TS/.test(current.wxString)) {
      out.push({
        id: 'thunderstorm',
        level: 'caution',
        metric: 'Thunderstorm',
        value: current.wxString.trim(),
        // Kept on the general-weather SIM citation: this flag invents no
        // number (it fires on TS in the METAR), and staying clear of
        // thunderstorms is genuine skydiving practice that a SIM section very
        // likely governs — it just has not been identified yet (see the
        // uspaWeather note). An unpinned SIM link is honest here; a house
        // heuristic would understate whose rule this is.
        guidance: 'Thunderstorms reported at the station — convective hazard for aircraft and canopies.',
        citation: CITATIONS.uspaWeather,
      });
    }
  }

  // --- Density altitude (loaded C-182 climb performance) ---
  if (densityAltitude) {
    const excess = densityAltitude.densityAltitudeFt - densityAltitude.fieldElevationFt;
    const level: AdvisoryLevel =
      excess >= thresholds.densityAltExcessCautionFt
        ? 'caution'
        : excess >= thresholds.densityAltExcessWatchFt
          ? 'watch'
          : 'info';
    if (level !== 'info') {
      out.push({
        id: 'density-altitude',
        level,
        metric: 'Density altitude',
        value: `${densityAltitude.densityAltitudeFt.toLocaleString()} ft (+${excess.toLocaleString()} above field)`,
        guidance:
          'High density altitude reduces a loaded jump plane’s climb performance — expect longer climbs to altitude.',
        citation: CITATIONS.faaDensityAltitude,
      });
    }
  }

  // --- Daylight / last load ---
  if (sun) {
    const minsToSunset = (sun.sunset - now) / 60000;
    if (minsToSunset <= 0) {
      out.push({
        id: 'daylight',
        level: 'caution',
        metric: 'Daylight',
        value: 'After sunset',
        guidance:
          'Parachute ops between sunset and sunrise require a light visible for at least 3 statute miles (14 CFR 105.19); USPA also requires a B license (min 50 jumps) for night jumps. Not a daytime operation.',
        citation: CITATIONS.far10519,
      });
    } else if (minsToSunset <= thresholds.lastLoadWatchMin) {
      out.push({
        id: 'daylight',
        level: 'watch',
        metric: 'Daylight',
        value: `~${Math.round(minsToSunset)} min to sunset`,
        guidance:
          'Approaching sunset — account for climb time so the load lands in daylight (after-sunset jumps trigger the 14 CFR 105.19 lighting rule).',
        citation: CITATIONS.far10519,
      });
    }
  }

  return out.sort((a, b) => severityRank(b.level) - severityRank(a.level));
}

/** Surface-wind headline: primary in the selected unit, with the other unit in
 *  parens so the reader can cross-check against BSR limits (stated in mph). */
function formatWind(speedKt: number | null, gustKt: number | null, unit: SpeedUnit): string {
  const other: SpeedUnit = unit === 'kt' ? 'mph' : 'kt';
  const gust = gustKt != null ? `gusting ${fmtSpeed(gustKt, unit)}` : null;
  if (speedKt == null) return gust ?? 'unreported';
  const base = `${fmtSpeed(speedKt, unit)} (${fmtSpeed(speedKt, other)})`;
  return gust != null ? `${base}, ${gust}` : base;
}

function severityRank(level: AdvisoryLevel): number {
  return level === 'caution' ? 2 : level === 'watch' ? 1 : 0;
}

