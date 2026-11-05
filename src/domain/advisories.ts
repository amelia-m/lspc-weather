import type { Advisory, AdvisoryLevel, Citation, CurrentConditions, HourlyPoint, WeatherSnapshot } from './types';
import {
  CITATIONS,
  FLIGHT_CATEGORY_GUIDANCE,
  flightCategoryComparisonText,
  hasWindLimit,
  isEdited,
  isOwnLimit,
  visibilityGuidance,
  visibilityRowsUnder,
  type Thresholds,
} from '../config/thresholds';
import { fmtLimitSpeed, fmtSpeed, type SpeedUnit, fmtVisibilitySm } from './units';
import { observedFlightCategory, ceilingCategory, visibilityCategory, CATEGORY_LABEL, type FlightCategory } from './flightCategory';
import { CEILING_COVERS, ceilingState } from './normalize';
import { SITE } from '../config/site';
import { shortHour } from './localClock';

/**
 * Turn a weather snapshot into a list of ADVISORIES — conditions worth noting,
 * each tied to the authoritative source. This engine deliberately produces NO
 * overall go/no-go verdict. The human (jumper, S&TA, PIC) decides.
 *
 * Pure function: same input → same output, no I/O. Unit-tested.
 */

/** The IFR and LIFR flag's comparison, from the half of the report that put
 *  the category in those bands (the AIM's "and/or": either half, or both).
 *  The ceiling half needs a measured ceiling (`ceilingState` known): a
 *  `BKN///` is in no band. Its layer is the lowest ceiling-making layer at
 *  the ceiling's height; broken is said as such, since gaps are the caveat
 *  (`flightCategoryComparisonText`). Null under MVFR, or when neither half
 *  is in the bands. */
function flightCategoryComparison(c: CurrentConditions): { text: string; cites: Citation[] } | null {
  const low = (cat: FlightCategory): boolean => cat === 'IFR' || cat === 'LIFR';
  const visibility = c.visibilitySm != null && low(visibilityCategory(c.visibilitySm)) ? c.visibilitySm : null;
  const ceiling =
    ceilingState(c) === 'known' && c.ceilingFtAgl != null && low(ceilingCategory(c.ceilingFtAgl)) ? c.ceilingFtAgl : null;
  if (visibility == null && ceiling == null) return null;
  const layer =
    ceiling == null ? null : c.skyLayers.find((l) => CEILING_COVERS.includes(l.cover) && l.baseFtAgl === ceiling);
  const text = flightCategoryComparisonText({
    visibility: visibility == null ? null : `Visibility ${fmtVisibilitySm(visibility)} SM`,
    ceiling: ceiling == null ? null : `The ceiling at ${ceiling.toLocaleString('en-US')} ft AGL`,
    broken: layer?.cover === 'BKN',
  });
  const cites = [CITATIONS.far10517, ...(ceiling == null ? [] : [CITATIONS.uspaOpeningAltitude])];
  return { text, cites };
}

/** A flag's citations from a required first and any optional others: the
 *  waiver tiers' wind flags cite the club's sign and then the SIM's waiver
 *  rule (`windSecondaryCitation`), which the BSR profiles have no need of. */
const cited = (first: Citation, ...rest: (Citation | undefined)[]): [Citation, ...Citation[]] => [
  first,
  ...rest.filter((c): c is Citation => c != null),
];

/** The badge's word for each level, as Conditions to note prints it and
 *  as `#citations` B2 quotes it. `info` is the neutral badge: no flag uses
 *  it today, which B2 asks about. */
export const LEVEL_LABEL: Record<AdvisoryLevel, string> = {
  caution: 'Caution',
  watch: 'Watch',
  forecast: 'Forecast',
  info: 'Note',
};

/** The flight-category flag's level per category, and the overcast flag's.
 *  These are the app's own: AIM 7-1-7 defines the categories and no source
 *  grades them, and 105.17 bars a jump through cloud at any height without
 *  grading an overcast. Both are put to the S&TA as B2 on `#citations`
 *  (`JUDGEMENTS`, src/config/citationsChecklist.ts), which derives its
 *  wording from these so the question cannot drift from the flags. Change
 *  neither before that answer (CLAUDE.md). */
export const FLIGHT_CATEGORY_LEVEL: Record<Exclude<FlightCategory, 'VFR'>, AdvisoryLevel> = {
  MVFR: 'watch',
  IFR: 'caution',
  LIFR: 'caution',
};
export const OVERCAST_LEVEL: AdvisoryLevel = 'watch';

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
    // Fires at the published CAUTION limit, or the reader's own, and nowhere
    // else. `hasWindLimit` is the gate: `windLimitCitation` holds the source
    // of a published number — the USPA student figure or the posted club
    // waiver — and is null where nobody published one. The
    // earlier "watch" band was this app's own arithmetic on those limits, and
    // for licensed jumpers (whose own guidance says no USPA limit binds them)
    // BOTH bands were invented, so that profile raises no surface-wind flag of
    // the app's: a trigger a reader cannot check is not a flag this app
    // raises. It flags only a limit the reader set as their own in Settings.
    // Silence here is not an all-clear, and two surfaces say so rather than
    // leaving it implied — SurfaceWindPanel prints the reading plus the
    // profile's guidance and its citation as a standing note, and AdvisoryPanel
    // names the gap: when this list comes back empty, or beside an own gust
    // ceiling, in its own-limits note.
    //
    // null speed/gust means the observation lacked a usable reading — that is
    // "no data", not calm. Level on the EFFECTIVE wind (max of sustained and
    // gust): a gust past the limit is still wind past the limit, and a gust
    // reading alone (sustained unreported) is enough to evaluate.
    //
    // The one exception to "published or nothing" is the reader's own limit,
    // set in Settings on Licensed (`isOwnLimit`): theirs to set and theirs to
    // check, and every sentence the flag carries says so.
    if (hasWindLimit(thresholds) && (speedKt != null || gustKt != null)) {
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
              ? isOwnLimit(thresholds, 'windCautionKt')
                ? ' (gusts at or above your limit)'
                : isEdited(thresholds, 'windCautionKt')
                  ? ' (gusts at or above the edited caution)'
                  : ' (gusts at or above the caution)'
              : ''),
          guidance: `${thresholds.windGuidance} ${windBandSentence(thresholds, unit)}`.trim(),
          // Waiver tiers: the guidance quotes the club's numbers and then the
          // BSR-excursion rule, which is the SIM's, not the club's.
          citations: cited(thresholds.windCitation, thresholds.windSecondaryCitation),
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
        value: isOwnLimit(thresholds, 'gustCautionKt')
          ? `gusting ${fmtSpeed(gustKt, unit)}, your ceiling ${fmtLimitSpeed(thresholds.gustCautionKt, unit)} (set in Settings)`
          : isEdited(thresholds, 'gustCautionKt')
            ? `gusting ${fmtSpeed(gustKt, unit)}, ceiling ${fmtLimitSpeed(thresholds.gustCautionKt, unit)} (edited in Settings)`
            : `gusting ${fmtSpeed(gustKt, unit)}, waiver ceiling ${fmtLimitSpeed(thresholds.gustCautionKt, unit)}`,
        guidance: isOwnLimit(thresholds, 'gustCautionKt')
          ? `Gusts are at or above the gust ceiling you set in Settings, which only you can check. ${thresholds.windGuidance}`
          : isEdited(thresholds, 'gustCautionKt') && thresholds.published?.gustCautionKt != null
            ? `Gusts are at or above the gust ceiling edited in Settings; the LSPC waiver's ceiling for this experience tier is ${fmtLimitSpeed(thresholds.published.gustCautionKt, unit)} (gusts measured over the last 30 min).`
            : 'Gusts are at or above the LSPC waiver gust ceiling for this experience tier (gusts measured over the last 30 min).',
        // On an own ceiling the link backs the guidance's account of the
        // BSR (no ground-wind limit for licensed jumpers), not the figure.
        citations: [thresholds.windCitation],
      });
    }

    // --- Visibility (14 CFR 105.17) ---
    // The trigger is the section's rows (`VISIBILITY_ROW`,
    // src/config/thresholds.ts): 3 SM below 10,000 ft MSL and 5 SM at or
    // above it. The rows are MSL, so a full-altitude exit from this DZ is in
    // the 5 SM row and a hop-and-pop, well under 10,000 ft MSL here, in the
    // 3 SM row; since 2026-10-31 the flag holds the reading to both (the
    // maintainer's answer to A8): it fires below 5 SM, and its value says
    // which rows the reading is under, a comparison of figures and nothing
    // more. The reading is the METAR's surface visibility and the reg's
    // measure is flight visibility at altitude; the guidance says so, names
    // both rows, then the figure the flag fires at: the rows, or a figure
    // edited in Settings.
    if (current.visibilitySm != null && current.visibilitySm < thresholds.visibilityCautionSm) {
      const under = visibilityRowsUnder(thresholds, current.visibilitySm);
      out.push({
        id: 'visibility',
        level: 'caution',
        metric: 'Visibility',
        value: `${fmtVisibilitySm(current.visibilitySm)} SM${under ? `, ${under}` : ''}`,
        guidance: visibilityGuidance(thresholds),
        citations: [CITATIONS.far10517],
      });
    }

    // --- Flight category (FAA VFR/MVFR/IFR/LIFR from ceiling + visibility) ---
    const category = observedFlightCategory(current);
    if (category && category !== 'VFR') {
      const comparison = flightCategoryComparison(current);
      out.push({
        id: 'flight-category',
        level: FLIGHT_CATEGORY_LEVEL[category],
        metric: 'Flight category',
        value: `${category} (${CATEGORY_LABEL[category]})`,
        // The AIM defines these categories and nothing else; it is not
        // regulatory and does not carry the pilot's VFR weather minimums. So
        // the one rule the guidance names by number, 91.155, is the second
        // link (read and logged like any other citation): a section named
        // under the AIM's link alone offered a source that could not support
        // it. The guidance names the parachute rule (105.17) by what it is,
        // not by number: under MVFR the flag carries only these two links,
        // and 105.17's is on the visibility flag and the Ceiling & sky card.
        // The operating decision is sent to the PIC, who holds it; the level
        // is the app's (see #citations A9).
        // Under IFR and LIFR the comparison follows, in the report's
        // figures, each section it names linked (the maintainer,
        // 2026-11-03; `flightCategoryComparisonText` says what it compares).
        guidance: comparison ? `${FLIGHT_CATEGORY_GUIDANCE} ${comparison.text}` : FLIGHT_CATEGORY_GUIDANCE,
        citations: [CITATIONS.aimFlightCategory, CITATIONS.far91155, ...(comparison?.cites ?? [])],
      });
    }

    // --- Overcast layer reported ---
    // A plain observed fact, so it may flag; the sentence claims only what
    // 105.17 says. "Solid overcast" is usairnet's phrase (the FAA's is plain
    // "Overcast"), and 105.17 bars operations into or through cloud, not under
    // it. Whether any cloud is in the way depends on the exit altitude, which
    // the app does not know, so the flag states what was reported (the
    // overcast's base, and the lowest cloud when that is lower: 105.17 is
    // about any cloud, not the overcast alone) and 105.17's rows, with the
    // field elevation because the rows are MSL and the bases AGL. No
    // instruction to compare one number: it would point at the wrong layer.
    const ft = (n: number): string => `${n.toLocaleString('en-US')} ft`;
    const ovcBases = current.skyLayers.filter((l) => l.cover === 'OVC').map((l) => l.baseFtAgl);
    if (ovcBases.length > 0) {
      const known = ovcBases.filter((b): b is number => b != null);
      const base = known.length > 0 ? Math.min(...known) : null;
      const lowest = current.skyLayers
        .filter((l) => ['FEW', 'SCT', 'BKN', 'OVC', 'VV'].includes(l.cover) && l.baseFtAgl != null)
        .reduce<{ cover: string; baseFtAgl: number } | null>(
          (lo, l) => (lo == null || l.baseFtAgl! < lo.baseFtAgl ? { cover: l.cover, baseFtAgl: l.baseFtAgl! } : lo),
          null,
        );
      const lower = lowest != null && (base == null || lowest.baseFtAgl < base) ? lowest : null;
      out.push({
        id: 'overcast',
        level: OVERCAST_LEVEL,
        metric: 'Sky cover',
        value: base != null ? `Overcast at ${ft(base)} AGL` : 'Overcast, base not reported',
        guidance:
          (base != null
            ? `Overcast (OVC) layer reported at ${ft(base)} above ${SITE.metarStation.id}`
            : `Overcast (OVC) layer reported at ${SITE.metarStation.id}, its base not measured`) +
          (lower != null ? `; the lowest cloud reported is ${lower.cover} at ${ft(lower.baseFtAgl)}` : '') +
          '. 14 CFR 105.17 bars parachute operations into or through a cloud, and requires staying at least ' +
          `500 ft below cloud under 10,000 ft MSL, 1,000 ft at or above (the field is at ${ft(SITE.dz.elevationFt)} MSL).`,
        citations: [CITATIONS.far10517],
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
        citations: [CITATIONS.uspaWeather],
      });
    }
  }

  // --- Forecast wind against the same limits (the NWS hourly forecast) ---
  // The flags above fire on the latest report, so on a calm morning before a
  // windy afternoon the list was empty while the hourly chart drew the
  // forecast well over the same limit lines (2026-10-10, the maintainer's
  // screenshot: KPMV at 10 kt, gusts forecast to 28 kt against a 17.4 kt
  // waiver ceiling). These fire on the same published limits, or the
  // reader's own, and on nothing else; they say they are a forecast, name
  // the hours, and rank below every observed flag.
  out.push(...forecastWindAdvisories(snapshot.hourly, thresholds, now, unit));

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
        citations: [CITATIONS.far10519, CITATIONS.uspaNightJumps],
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
  return level === 'caution' ? 3 : level === 'watch' ? 2 : level === 'forecast' ? 1 : 0;
}

/** How many hours ahead the forecast wind flags read: today's flying, as a
 *  jumper planning loads reads the hourly chart, not tomorrow's. */
export const FORECAST_FLAG_HOURS = 12;

const MS_H = 3_600_000;
/** "10am", at the drop zone: the hourly chart's own label (`shortHour`). */
const hourLabel = (ms: number): string => shortHour(ms, SITE.timeZone);

/** The hours as runs of consecutive hours, "10am–7pm, 9pm–10pm". Each
 *  forecast point stands for the hour that starts at its time, so a run ends
 *  an hour after its last point. */
export function hourRuns(times: readonly number[]): string {
  const runs: [number, number][] = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];
    if (last && t - last[1] <= MS_H) last[1] = t;
    else runs.push([t, t]);
  }
  return runs.map(([a, b]) => `${hourLabel(a)}–${hourLabel(b + MS_H)}`).join(', ');
}

/** The forecast hours in the coming FORECAST_FLAG_HOURS, the one in progress
 *  included, with wind and gust in whole knots. The gridpoint serves km/h,
 *  so a gust converts to 17.44 kt; a METAR reports whole knots, and held
 *  unrounded such a gust raised a flag against the 17.4 kt ceiling and then
 *  printed its peak as "17 kt", under the figure the flag said it reached. */
function comingHours(hourly: readonly HourlyPoint[], now: number): { time: number; wind: number | null; gust: number | null }[] {
  return hourly
    .filter((h) => h.time + MS_H > now && h.time < now + FORECAST_FLAG_HOURS * MS_H)
    .map((h) => ({
      time: h.time,
      wind: h.windSpeedKt == null ? null : Math.round(h.windSpeedKt),
      gust: h.windGustKt == null ? null : Math.round(h.windGustKt),
    }));
}

/** The forecast's surface wind against the profile's caution and the
 *  waiver's gust ceiling, the same limits and the same tests as the flags on
 *  the latest report. Pure. */
export function forecastWindAdvisories(
  hourly: readonly HourlyPoint[],
  t: Thresholds,
  now: number,
  unit: SpeedUnit,
): Advisory[] {
  const out: Advisory[] = [];
  const hours = comingHours(hourly, now);
  // Which flag on the report this one stands ahead of, by its metric.
  const asForecast = (metric: string): string =>
    `A forecast, not a reading: the ${metric} flag fires if ${SITE.metarStation.id} reports it.`;

  if (hasWindLimit(t)) {
    const over = hours.filter((h) => Math.max(h.wind ?? -Infinity, h.gust ?? -Infinity) >= t.windCautionKt);
    if (over.length > 0) {
      const peak = Math.max(...over.map((h) => Math.max(h.wind ?? -Infinity, h.gust ?? -Infinity)));
      const which = isOwnLimit(t, 'windCautionKt')
        ? 'your own limit, set in Settings'
        : isEdited(t, 'windCautionKt')
          ? 'the caution as edited in Settings'
          : 'the surface-wind caution';
      out.push({
        id: 'forecast-wind',
        level: 'forecast',
        metric: 'Forecast wind',
        value: `${hourRuns(over.map((h) => h.time))}, to ${fmtSpeed(peak, unit)}`,
        guidance:
          (`The NWS hourly forecast for the drop zone, gusts included, is at or above ${fmtLimitSpeed(t.windCautionKt, unit)}, ` +
          `${which}, in these hours of the next ${FORECAST_FLAG_HOURS}. ${asForecast('Surface wind')} ${t.windGuidance} ` +
          // Which of the source's figures the flag uses, as the flag on the
          // report says: on Student, the BSR's 14 mph and not its 10 mph.
          windBandSentence(t, unit)).trim(),
        citations: cited(t.windCitation, t.windSecondaryCitation),
      });
    }
  }

  if (t.gustCautionKt != null) {
    const ceiling = t.gustCautionKt;
    const over = hours.filter((h) => h.gust != null && h.gust >= ceiling);
    if (over.length > 0) {
      const peak = Math.max(...over.map((h) => h.gust as number));
      // As the Gust limit flag on the report words each case: an own ceiling
      // quotes the profile's guidance the BSR link backs; an edited one names
      // the waiver's own figure, so the link does not vouch for the edit;
      // the waiver's states what it is measured on, which a forecast is not.
      const which = isOwnLimit(t, 'gustCautionKt')
        ? 'the gust ceiling you set in Settings, which only you can check'
        : isEdited(t, 'gustCautionKt')
          ? 'the gust ceiling as edited in Settings'
          : 'the LSPC waiver gust ceiling for this experience tier, which the waiver sets on gusts measured over the last 30 min';
      const after = isOwnLimit(t, 'gustCautionKt')
        ? ` ${t.windGuidance}`
        : isEdited(t, 'gustCautionKt') && t.published?.gustCautionKt != null
          ? ` The LSPC waiver's ceiling for this experience tier is ${fmtLimitSpeed(t.published.gustCautionKt, unit)} (gusts measured over the last 30 min).`
          : '';
      out.push({
        id: 'forecast-gust',
        level: 'forecast',
        metric: 'Forecast gusts',
        value: `${hourRuns(over.map((h) => h.time))}, to ${fmtSpeed(peak, unit)}`,
        guidance:
          `The NWS hourly forecast for the drop zone has gusts at or above ${fmtLimitSpeed(ceiling, unit)}, ${which}, ` +
          `in these hours of the next ${FORECAST_FLAG_HOURS}. ${asForecast('Gust limit')}${after}`.trim(),
        citations: [t.windCitation],
      });
    }
  }
  return out;
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
  if (isOwnLimit(t, 'windCautionKt')) {
    return `The band and flag here use ${figure}, your own limit from Settings; no published source sets one for this profile`;
  }
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

/** The lower published figure itself, in a sentence: the Surface wind card
 *  and the hourly chart's legend each say it, and each then says what of
 *  theirs does not check it. Empty where the profile has none. */
export function lowerLimitPublished(t: Thresholds, unit: SpeedUnit): string {
  const c = t.windBandCaveat;
  return c ? `A lower maximum ground wind, ${fmtLimitSpeed(c.limitKt, unit)}, is published for ${c.appliesTo}.` : '';
}

/** A sentence about the lower limit, followed by the drop zone's fact that
 *  it binds nobody here (`windBandCaveat.notHere`) where the profile has
 *  one. The card, the chart's legend and the flag each end their sentence
 *  with it, so the three cannot say the fact differently. */
export function withNotHere(sentence: string, t: Thresholds): string {
  const fact = t.windBandCaveat?.notHere;
  return fact ? `${sentence} ${fact}` : sentence;
}

/** The flag's sentence: which figure it uses and, below it, what it leaves
 *  unchecked. */
export function windBandSentence(t: Thresholds, unit: SpeedUnit): string {
  const use = windBandUse(t, unit);
  if (!use) return '';
  if (!lowerLimitUnchecked(t) || !t.windBandCaveat) return `${use}.`;
  return withNotHere(`${use}, so below the band nothing on this page flags the lower limit for ${t.windBandCaveat.appliesTo}.`, t);
}
