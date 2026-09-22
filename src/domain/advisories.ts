import type { Advisory, AdvisoryLevel, WeatherSnapshot } from './types';
import { CITATIONS, type Thresholds } from '../config/thresholds';
import { fmtLimitSpeed, fmtSpeed, round, type SpeedUnit } from './units';
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
  const { current, sun } = snapshot;

  // --- Surface wind ---
  if (current) {
    const { speedKt, gustKt } = current.wind;
    // Fires at the published CAUTION limit and nowhere else. `windLimitCitation`
    // is the gate: it holds the source of that number — the USPA student figure
    // or the posted club waiver — and is null where nobody published one. The
    // earlier "watch" band was this app's own arithmetic on those limits, and
    // for licensed jumpers (whose own guidance says no USPA limit binds them)
    // BOTH bands were invented, so that profile now raises no surface-wind flag
    // at all: a trigger a reader cannot check is not a flag this app raises.
    // Silence here is not an all-clear, and two surfaces say so rather than
    // leaving it implied — SurfaceWindPanel prints the reading plus the
    // profile's guidance and its citation as a standing note, and AdvisoryPanel
    // names the gap when this list comes back empty.
    //
    // null speed/gust means the observation lacked a usable reading — that is
    // "no data", not calm. Level on the EFFECTIVE wind (max of sustained and
    // gust): a gust past the limit is still wind past the limit, and a gust
    // reading alone (sustained unreported) is enough to evaluate.
    if (thresholds.windLimitCitation && (speedKt != null || gustKt != null)) {
      const limitKt = thresholds.windCautionKt;
      const effectiveKt = Math.max(speedKt ?? -Infinity, gustKt ?? -Infinity);
      if (effectiveKt >= limitKt) {
        // Gust-driven: the gust crossed the limit but the sustained speed did not.
        const gustDriven = gustKt != null && gustKt >= limitKt && (speedKt == null || speedKt < limitKt);
        out.push({
          id: 'surface-wind',
          level: 'caution',
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
        //
        // The ceiling goes through fmtLimitSpeed so the tier's own posted
        // figure survives the conversion: the 10–20 and 21+ tiers post 19 and
        // 20 mph, which are the same number once rounded to whole knots. The
        // GUST is a reading and stays whole — the station reports knots.
        value: `gusting ${fmtSpeed(gustKt, unit)}, waiver ceiling ${fmtLimitSpeed(thresholds.gustCautionKt, unit)}`,
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
        // Cites SIM 4-5 (Weather), whose "Hazardous Weather" part covers
        // thunderstorms generating spontaneously and the turbulence that comes
        // with convection. The flag invents no number — it fires on TS in the
        // METAR — so the citation carries the practice, not a trigger.
        guidance: 'Thunderstorms reported at the station — convective hazard for aircraft and canopies.',
        citation: CITATIONS.uspaWeather,
      });
    }
  }

  // No density-altitude flag: the FAA-cited claim it carried (a loaded jump
  // plane climbs worse in high DA) is real at any DA, but the ft-above-field
  // bands that decided when to raise it were the app's own. The claim now
  // stands on the density-altitude card, which prints the figure for the reader
  // to judge — see DensityAltitudePanel.

  // --- Daylight (14 CFR 105.19) ---
  // Fires on an astronomical fact, not on a chosen number: the reg's trigger IS
  // sunset. The "last load" watch that used to precede it (45 min student /
  // 30 licensed) was the app's own — nobody publishes a minutes-before-sunset
  // figure, and the Sun card already shows the time remaining.
  if (sun) {
    const minsToSunset = (sun.sunset - now) / 60000;
    if (minsToSunset <= 0) {
      out.push({
        id: 'daylight',
        level: 'caution',
        metric: 'Daylight',
        value: 'After sunset',
        // Two claims from two authorities. The flag carries the FAA one, which
        // is the harder requirement and sets the trigger; the USPA one is
        // stated as the SIM states it — "should", not "requires" — and names
        // its own section rather than riding on the reg's citation, which
        // says nothing about licences.
        guidance:
          'Parachute ops between sunset and sunrise require a light visible for at least 3 statute miles (14 CFR 105.19). USPA counts any jump between official sunset and sunrise as a night jump, and says participants should meet USPA B-licence requirements (50 jumps) — see SIM 5-3. Not a daytime operation.',
        citation: CITATIONS.far10519,
        secondaryCitation: CITATIONS.uspaNightJumps,
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

