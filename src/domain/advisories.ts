import type { Advisory, AdvisoryLevel, WeatherSnapshot } from './types';
import { CITATIONS, type Thresholds } from '../config/thresholds';
import { compass, ktToMph, round } from './units';

/**
 * Turn a weather snapshot into a list of ADVISORIES — conditions worth noting,
 * each tied to the authoritative source. This engine deliberately produces NO
 * overall go/no-go verdict. The human (jumper, S&TA, PIC) decides.
 *
 * Pure function: same input → same output, no I/O. Unit-tested.
 */

// Upper-wind flags are awareness aids (freefall drift / spot length), not limits.
const WINDS_ALOFT_INFO_KT = 20;
const WINDS_ALOFT_WATCH_KT = 30;

export function evaluateAdvisories(
  snapshot: WeatherSnapshot,
  thresholds: Thresholds,
  now: number,
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
          value: formatWind(speedKt, gustKt) + (gustDriven ? ' (gusts exceed limit)' : ''),
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
        value: `gusting ${round(gustKt)} kt (${round(ktToMph(gustKt))} mph), waiver ceiling ${round(ktToMph(thresholds.gustCautionKt))} mph`,
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
        value: `${round(speedKt)} kt sustained, gusting ${round(gustKt)} kt (spread ${round(gustKt - speedKt)} kt)`,
        guidance:
          'Large gust spread means shifting, turbulent surface winds — harder canopy flight and landings.',
        citation: CITATIONS.uspaWeather,
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
        out.push({
          id: 'ceiling',
          level: ceilLevel,
          metric: 'Ceiling',
          value: `${round(c).toLocaleString()} ft AGL`,
          guidance:
            '14 CFR 105.17 prohibits jumping into or through clouds and sets cloud-clearance minimums (500 ft below / 1,000 ft above / 2,000 ft horizontal below 10,000 ft MSL).',
          citation: CITATIONS.far10517,
        });
      }
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
        guidance: 'Precipitation degrades visibility and canopy control; rain on a packed canopy adds risk.',
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

  // --- Winds aloft (freefall drift / spot awareness) ---
  if (windsAloft.length > 0) {
    const strongest = windsAloft.reduce((a, b) => (b.speedKt > a.speedKt ? b : a));
    if (strongest.speedKt >= WINDS_ALOFT_INFO_KT) {
      out.push({
        id: 'winds-aloft',
        level: strongest.speedKt >= WINDS_ALOFT_WATCH_KT ? 'watch' : 'info',
        metric: 'Winds aloft',
        value: `${strongest.speedKt} kt from ${compass(strongest.directionDeg)} at ${strongest.altitudeFtAgl.toLocaleString()} ft AGL`,
        guidance:
          'Strong upper winds increase freefall drift and lengthen the spot — plan jump run and exit separation accordingly.',
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

function formatWind(speedKt: number | null, gustKt: number | null): string {
  const gust = gustKt != null ? `gusting ${round(gustKt)} kt` : null;
  if (speedKt == null) return gust ?? 'unreported';
  const base = `${round(speedKt)} kt (${round(ktToMph(speedKt))} mph)`;
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
