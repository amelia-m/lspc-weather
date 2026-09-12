import type { Advisory, AdvisoryLevel, WeatherSnapshot } from './types';
import { CITATIONS, type Thresholds } from '../config/thresholds';
import { compass, fmtSpeed, round, type SpeedUnit } from './units';
import { flightCategory, CATEGORY_LABEL } from './flightCategory';
import { relativeHumidity } from './humidity';

/**
 * Turn a weather snapshot into a list of ADVISORIES — conditions worth noting,
 * each tied to the authoritative source. This engine deliberately produces NO
 * overall go/no-go verdict. The human (jumper, S&TA, PIC) decides.
 *
 * Pure function: same input → same output, no I/O. Unit-tested.
 */

// Upper-wind flags are awareness aids (freefall drift / spot length), not limits.
// House numbers — no rule puts a speed on "the spot is getting long".
const WINDS_ALOFT_INFO_KT = 20;
const WINDS_ALOFT_WATCH_KT = 30;

// Forecast thunderstorm probability (NWS gridpoint). Convection is a serious
// hazard, so these are lower than the precip-chance thresholds. House numbers:
// nothing published says a forecast chance of storms becomes notable at 10%,
// which is why the flag cites CITATIONS.appHeuristic rather than the SIM.
const THUNDER_WATCH_PCT = 10;
const THUNDER_CAUTION_PCT = 30;

// Temp–dew point spread (°C) fog/low-cloud thresholds: ~5.4°F and ~1.8°F.
// House numbers again, and the underlying claim is meteorology rather than
// skydiving practice — see the fog flag below.
const FOG_SPREAD_WATCH_C = 3;
const FOG_SPREAD_CAUTION_C = 1;

export function evaluateAdvisories(
  snapshot: WeatherSnapshot,
  thresholds: Thresholds,
  now: number,
  unit: SpeedUnit = 'kt',
): Advisory[] {
  const out: Advisory[] = [];
  const { current, hourly, windsAloft, sun, densityAltitude } = snapshot;

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

    // --- Gust spread (turbulent / shifty landings) ---
    // Needs both values; skipped when the sustained speed is unreported.
    if (speedKt != null && gustKt != null && gustKt - speedKt >= thresholds.gustSpreadWatchKt) {
      out.push({
        id: 'gust-spread',
        level: 'watch',
        metric: 'Gusty wind',
        value: `${fmtSpeed(speedKt, unit)} sustained, gusting ${fmtSpeed(gustKt, unit)} (spread ${fmtSpeed(gustKt - speedKt, unit)})`,
        guidance:
          'Large gust spread means shifting, turbulent surface winds — harder canopy flight and landings. ' +
          'The spread that trips this flag is a dashboard threshold; the source below is the wind rule that applies to the selected profile.',
        // The profile's own wind citation, not the generic SIM index: on a
        // waiver tier that is the club policy, which states an explicit gust
        // ceiling in mph for exactly this jumper — the most useful thing a
        // reader of a gust flag can be handed. The adjacent surface-wind and
        // gust-limit advisories already cite it.
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

    // --- Ceiling / cloud base ---
    if (current.ceilingFtAgl != null) {
      const c = current.ceilingFtAgl;
      const ceilLevel: AdvisoryLevel =
        c < thresholds.ceilingCautionFt ? 'caution' : c < thresholds.ceilingWatchFt ? 'watch' : 'info';
      if (ceilLevel !== 'info') {
        // No regulation sets a minimum ceiling for a jump, and this flag's
        // bands (5,000/3,000 student, 4,000/2,500 licensed) are the app's own.
        // It previously cited 14 CFR 105.17, which reads as though the reg
        // prohibits the ceiling on screen; 105.17 governs cloud CLEARANCE and
        // flight visibility and names no ceiling. The clearance requirement is
        // still WHY a low base matters — it is what the cited rule actually
        // says — so the guidance explains that relationship instead, and the
        // ceiling number is cited as the house threshold it is. (105.17 itself
        // is linked from the visibility and overcast flags and from the
        // Ceiling & sky card.)
        out.push({
          id: 'ceiling',
          level: ceilLevel,
          metric: 'Ceiling',
          value: `${round(c).toLocaleString()} ft AGL`,
          guidance:
            'A dashboard threshold, not a regulatory one — no rule sets a minimum ceiling. A low base matters because you still have to stay clear of cloud: 14 CFR 105.17 requires 500 ft below / 1,000 ft above / 2,000 ft horizontal below 10,000 ft MSL, and no jumping into or through cloud, so the usable airspace under the base is smaller than the base itself.',
          citation: CITATIONS.appHeuristic,
        });
      }
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

    // --- Fog / low cloud from a tight temp–dew point spread ---
    if (current.tempC != null && current.dewpointC != null) {
      const spreadC = current.tempC - current.dewpointC;
      if (spreadC <= FOG_SPREAD_WATCH_C) {
        const rh = relativeHumidity(current.tempC, current.dewpointC);
        out.push({
          id: 'dewpoint-spread',
          level: spreadC <= FOG_SPREAD_CAUTION_C ? 'caution' : 'watch',
          metric: 'Fog / low cloud',
          value: `${round(spreadC * 1.8)}°F temp–dew point spread, ${round(rh)}% RH`,
          // Atmospheric physics, not skydiving practice: USPA has no view on
          // dew-point spread, and the 3 °C / 1 °C bands are the app's. The
          // authority here would be a meteorological one (NWS / AMS), but no
          // URL for that can be verified from this environment, and inventing
          // one would repeat the defect being fixed. So this cites the house
          // threshold and leaves the physics unattributed rather than
          // misattributed.
          guidance:
            'A small temperature–dew point spread with high humidity favors fog and low ceilings — watch for reduced visibility and a dropping cloud base, especially near dawn. The spread this flags at is a dashboard threshold; the underlying behaviour is meteorology, not a skydiving rule.',
          citation: CITATIONS.appHeuristic,
        });
      }
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

  // --- Precip probability (max over the next ~6 hours) ---
  const precipMax = maxNear(hourly, now, 6, (h) => h.precipProbPct);
  if (precipMax != null) {
    const level: AdvisoryLevel =
      precipMax >= thresholds.precipCautionPct
        ? 'caution'
        : precipMax >= thresholds.precipWatchPct
          ? 'watch'
          : 'info';
    if (level !== 'info') {
      out.push({
        id: 'precip',
        level,
        metric: 'Precipitation',
        value: `${round(precipMax)}% chance (next 6 h)`,
        // The 25/50% (student) and 30/60% (licensed) bands are the app's own;
        // no BSR or SIM section puts a percentage on a chance of rain.
        guidance:
          'Precipitation degrades visibility and canopy control; rain on a packed canopy adds risk. The chance this flags at is a dashboard threshold.',
        citation: CITATIONS.appHeuristic,
      });
    }
  }

  // --- Forecast thunderstorm chance (max over the next ~6 hours) ---
  const thunderMax = maxNear(hourly, now, 6, (h) => h.thunderProbPct);
  if (thunderMax != null && thunderMax >= THUNDER_WATCH_PCT) {
    out.push({
      id: 'thunder-forecast',
      level: thunderMax >= THUNDER_CAUTION_PCT ? 'caution' : 'watch',
      metric: 'Thunderstorm chance',
      value: `${round(thunderMax)}% chance (next 6 h)`,
      // Same reasoning as the precipitation flag: the hazard is real, the
      // 10%/30% trigger is the app's. The OBSERVED-thunderstorm flag above
      // still cites the SIM, because that one asserts no number.
      guidance:
        'Forecast thunderstorms bring lightning, gust fronts, and rapid condition changes — a convective hazard for the jump plane and canopies. Watch the radar and sky. The forecast chance this flags at is a dashboard threshold.',
      citation: CITATIONS.appHeuristic,
    });
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

  // --- Winds aloft (freefall drift / spot awareness) ---
  if (windsAloft.length > 0) {
    const strongest = windsAloft.reduce((a, b) => (b.speedKt > a.speedKt ? b : a));
    if (strongest.speedKt >= WINDS_ALOFT_INFO_KT) {
      out.push({
        id: 'winds-aloft',
        level: strongest.speedKt >= WINDS_ALOFT_WATCH_KT ? 'watch' : 'info',
        metric: 'Winds aloft',
        value: `${fmtSpeed(strongest.speedKt, unit)} from ${compass(strongest.directionDeg)} at ${strongest.altitudeFtAgl.toLocaleString()} ft AGL`,
        // Kept on the SIM citation: exit separation and spotting in strong
        // upper winds is skydiving practice, and the audit wants this pinned to
        // a real SIM section rather than removed. What was borrowed authority
        // was the TRIGGER — 20/30 kt is the app's — so the guidance says so and
        // the citation stays attached to the practice claim it supports.
        guidance:
          'Strong upper winds increase freefall drift and lengthen the spot — plan jump run and exit separation accordingly. The speed this flags at is a dashboard threshold.',
        citation: CITATIONS.uspaWeather,
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

/** Max of a field over hourly points within `hours` of `now`. */
function maxNear(
  hourly: WeatherSnapshot['hourly'],
  now: number,
  hours: number,
  pick: (h: WeatherSnapshot['hourly'][number]) => number | null,
): number | null {
  const windowEnd = now + hours * 3600_000;
  let max: number | null = null;
  for (const h of hourly) {
    if (h.time < now - 3600_000 || h.time > windowEnd) continue;
    const v = pick(h);
    if (v != null && (max == null || v > max)) max = v;
  }
  return max;
}
