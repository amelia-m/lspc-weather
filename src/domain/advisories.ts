import type { Advisory, AdvisoryLevel, WeatherSnapshot } from './types';
import { CITATIONS, isEdited, type Thresholds } from '../config/thresholds';
import { fmtLimitSpeed, fmtSpeed, round, type SpeedUnit } from './units';
import { observedFlightCategory, CATEGORY_LABEL } from './flightCategory';

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
          // Says what the comparison is (at or above), and not "limit": the
          // Student band is 14 mph rounded down, so a gust can reach it
          // without exceeding the BSR, and an edited band is the reader's
          // own. A one-word label asserts as much as a sentence.
          value:
            formatWind(speedKt, gustKt, unit) +
            (gustDriven
              ? isEdited(thresholds, 'windCautionKt')
                ? ' (gusts at or above the edited caution)'
                : ' (gusts at or above the caution)'
              : ''),
          guidance: `${thresholds.windGuidance} ${windBandSentence(thresholds, unit)}`.trim(),
          citation: thresholds.windCitation,
          // Waiver tiers: the guidance quotes the club's numbers and then the
          // BSR-excursion rule, which is the SIM's, not the club's.
          secondaryCitation: thresholds.windSecondaryCitation,
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
        //
        // An edited ceiling is not the waiver's, so it is not called one: the
        // citation would vouch for a number the posted sign does not carry.
        value: isEdited(thresholds, 'gustCautionKt')
          ? `gusting ${fmtSpeed(gustKt, unit)}, ceiling ${fmtLimitSpeed(thresholds.gustCautionKt, unit)} (edited in Settings)`
          : `gusting ${fmtSpeed(gustKt, unit)}, waiver ceiling ${fmtLimitSpeed(thresholds.gustCautionKt, unit)}`,
        guidance:
          isEdited(thresholds, 'gustCautionKt') && thresholds.published?.gustCautionKt != null
            ? `Gusts are at or above the gust ceiling edited in Settings; the LSPC waiver's ceiling for this experience tier is ${fmtLimitSpeed(thresholds.published.gustCautionKt, unit)} (gusts measured over the last 30 min).`
            : 'Gusts are at or above the LSPC waiver gust ceiling for this experience tier (gusts measured over the last 30 min).',
        citation: thresholds.windCitation,
      });
    }

    // --- Visibility (105.17 floor below 10k MSL is 3 SM) ---
    // The trigger is the section's lower row. Its upper row — 5 SM at or above
    // 10,000 ft MSL — is the one an exit from this DZ is in, and the guidance
    // prints it, but the reading is the METAR's surface visibility and the
    // reg's measure is flight visibility at altitude, so the flag holds a
    // surface figure only to the row it can honestly be held to.
    if (current.visibilitySm != null && current.visibilitySm < thresholds.visibilityCautionSm) {
      out.push({
        id: 'visibility',
        level: 'caution',
        metric: 'Visibility',
        value: `${round(current.visibilitySm, 1)} SM`,
        guidance:
          '14 CFR 105.17 requires at least 3 SM flight visibility below 10,000 ft MSL, and 5 SM at or above it — an exit above 10,000 ft MSL is in the 5 SM row. This reading is surface visibility from the METAR; the rule is about flight visibility at altitude.' +
          (isEdited(thresholds, 'visibilityCautionSm')
            ? ` This flag fires below ${round(thresholds.visibilityCautionSm, 1)} SM, as edited in Settings, in place of the ${round(thresholds.published?.visibilityCautionSm ?? 3, 1)} SM row it otherwise uses.`
            : ''),
        citation: CITATIONS.far10517,
      });
    }

    // --- Flight category (FAA VFR/MVFR/IFR/LIFR from ceiling + visibility) ---
    const category = observedFlightCategory(current);
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

    // --- Overcast layer reported ---
    // A plain observed fact, so it may flag; the sentence claims only what
    // 105.17 says. "Solid overcast" is usairnet's phrase (the FAA's is plain
    // "Overcast"), and 105.17 bars operations into or through cloud, not
    // under it: an overcast above exit altitude is reported here too.
    if (current.skyLayers.some((l) => l.cover === 'OVC')) {
      out.push({
        id: 'overcast',
        level: 'watch',
        metric: 'Sky cover',
        value: 'Overcast (OVC)',
        guidance:
          'Overcast (OVC) layer reported. 14 CFR 105.17 bars parachute operations into or through a cloud and sets minimum distances from cloud.',
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
  //
  // Both ends of the night: `sun` is the local solar day's, which rolls over
  // at solar midnight (about 1:25 AM CDT here), so from then until dawn it
  // holds that morning's sunrise and the coming evening's sunset. Checking
  // only "after sunset" left the hours before sunrise unflagged, though the
  // reg runs from sunset to sunrise.
  if (sun) {
    const beforeSunrise = now < sun.sunrise;
    if (beforeSunrise || now >= sun.sunset) {
      out.push({
        id: 'daylight',
        level: 'caution',
        metric: 'Daylight',
        value: beforeSunrise ? 'Before sunrise' : 'After sunset',
        // Two claims from two authorities. The flag carries the FAA one, which
        // is the harder requirement and sets the trigger; the USPA one is
        // stated as the SIM states it — "should", not "requires" — and names
        // its own section rather than riding on the reg's citation, which
        // says nothing about licences. The FAA sentence follows 105.19 (a)
        // and (b) as read on 2026-09-23: the light is the descending
        // jumper's, shown from open canopy to the surface — not a light on
        // the aircraft, which an earlier wording left open.
        guidance:
          'Between sunset and sunrise, 14 CFR 105.19 requires the jumper to display a light visible for at least 3 statute miles, from open canopy until landing. USPA counts any jump between official sunset and sunrise as a night jump, and says participants should meet USPA B-licence requirements — see SIM 5-3. Not a daytime operation.',
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

/**
 * Which figure the surface-wind band and flag use, in the words both the card
 * and the flag print. Built here rather than written into the profile's
 * guidance because it is about this app's band, which Settings can move, and
 * the guidance is about the source, which it cannot. Empty where an unedited
 * profile names only one figure, so there is nothing to tell apart.
 */
export function windBandUse(t: Thresholds, unit: SpeedUnit): string {
  const figure = fmtLimitSpeed(t.windCautionKt, unit);
  if (isEdited(t, 'windCautionKt')) {
    return `The band and flag here use ${figure}, as edited in Settings, not a published figure`;
  }
  return t.windBandCaveat ? `The band and flag here use ${figure}, ${t.windBandCaveat.bandIs}` : '';
}

/** Whether the profile's lower published limit (`windBandCaveat`) goes
 *  unchecked below the band. Readings are whole knots (a METAR's, or NWS's
 *  rounded), so once the caution is at or below the first whole knot over
 *  the lower limit, every reading over that limit flags and it is checked. */
export function lowerLimitUnchecked(t: Thresholds): boolean {
  return t.windBandCaveat != null && t.windCautionKt > Math.ceil(t.windBandCaveat.limitKt);
}

/** The flag's sentence: which figure it uses and, below it, what it leaves
 *  unchecked. */
export function windBandSentence(t: Thresholds, unit: SpeedUnit): string {
  const use = windBandUse(t, unit);
  if (!use) return '';
  return lowerLimitUnchecked(t) && t.windBandCaveat
    ? `${use}, so below the band nothing on this page flags the lower limit for ${t.windBandCaveat.appliesTo}.`
    : `${use}.`;
}
