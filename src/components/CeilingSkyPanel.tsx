import type { CurrentConditions, HourlyPoint, NbmForecast, OpenMeteoCloudHour } from '../domain/types';
import { observedFlightCategory } from '../domain/flightCategory';
import { ceilingState, type CeilingState } from '../domain/normalize';
import { DATA_SOURCES } from '../config/sources';
import { CITATIONS, FAR_91155_ROWS, visibilityFigure, type Thresholds } from '../config/thresholds';
import { METAR_STATION_OFFSET, SITE, repoDoc } from '../config/site';
import { CLOUD_COMPARISON } from '../config/cloudComparison';
import { CEILING_EIGHTHS } from '../domain/cloudCoverSources';
import { Panel } from './common/Panel';
import { CeilingSkyDays } from './CeilingSkyDays';
import { buildDayBlocks, nwsCeilingForecastEnd } from '../domain/skyDays';
import { FlightCategoryPill } from './common/FlightCategoryPill';
import { SourceLink } from './common/SourceLink';
import { fmtShortHour, fmtWeekday } from './format';

/** What the Ceiling line says when no ceiling height could be computed. */
const CEILING_LABEL: Record<CeilingState, string> = {
  known: 'No ceiling',
  'height-unknown': 'Height not reported',
  unreported: 'Not reported',
};

/** The latest observation's flight category and ceiling, then one table
 *  per local day of the forecasts (CeilingSkyDays, src/domain/skyDays.ts):
 *  the NWS gridpoint's sky cover and ceiling with Open-Meteo's cloud cover
 *  beside it, and the NBM's two bulletins' sky cover, ceiling and lowest
 *  base, the heights drawn as a band; usairnet's day-table form, which
 *  jumpers know, since 2026-11-18 (docs/ceiling-sky-layout-review.md). */
export function CeilingSkyPanel({
  current,
  hourly,
  omClouds = null,
  nbm = null,
  nbs = null,
  thresholds,
  now = Date.now(),
}: {
  current: CurrentConditions | null;
  hourly: HourlyPoint[];
  /** Open-Meteo's hourly cloud cover (`snapshot.openMeteoClouds`); null on
   *  the FD fallback and until it loads, and the card then shows the NWS
   *  forecast alone. Each figure is matched to an NWS hour by its time. */
  omClouds?: OpenMeteoCloudHour[] | null;
  /** The NBM's hourly bulletin for KPMV (`snapshot.nbm`), through the
   *  relay; null without it. Its lowest cloud base, matched by hour. */
  nbm?: NbmForecast | null;
  /** The NBM's three-hourly bulletin (`snapshot.nbs`), 6 to 72 hours from
   *  its cycle, the one usairnet's three-day table reads; null without the
   *  relay. Its sky cover, ceiling and base fill the days past the hourly
   *  forecasts' reach. */
  nbs?: NbmForecast | null;
  /** The thresholds the flags are read against, for the sentence naming the
   *  figure the visibility flag fires at; without them the card names none
   *  rather than guess past a Settings edit. */
  thresholds?: Pick<Thresholds, 'visibilityCautionSm' | 'published' | 'visibilityRow'>;
  /** The clock, for a static render at a known hour (the tests); the app
   *  passes nothing and the card reads it. */
  now?: number;
}): JSX.Element {
  const blocks = buildDayBlocks({
    now,
    hourly,
    om: omClouds,
    nbh: nbm?.hours,
    nbs: nbs?.hours,
    dz: SITE.dz,
    timeZone: SITE.timeZone,
  });
  const showOm = blocks.some((b) => b.slots.some((s) => s.om?.totalPct != null) || b.hours.some((h) => h.om?.totalPct != null));
  const showBase = blocks.some((b) => b.slots.some((s) => s.nbh?.lowestBaseFtAgl !== undefined || s.nbs?.lowestBaseFtAgl !== undefined));
  const nbsShown = blocks.some((b) => b.slots.some((s) => s.nbs));
  const lastSlot = blocks.flatMap((b) => b.slots).filter((s) => s.time != null).pop();
  const ceilingEnds = nwsCeilingForecastEnd(hourly, now);
  const category = current ? observedFlightCategory(current) : null;

  return (
    <Panel
      title="Ceiling & sky"
      subtitle={lastSlot?.time != null ? `now to ${fmtWeekday(lastSlot.time)} ${fmtShortHour(lastSlot.time)}` : 'now on'}
      sources={[
        DATA_SOURCES.iemObservation,
        DATA_SOURCES.nwsObservation,
        DATA_SOURCES.nwsForecast,
        ...(showOm ? [DATA_SOURCES.openMeteo] : []),
        ...(showBase ? [DATA_SOURCES.nbm] : []),
        ...(nbsShown ? [DATA_SOURCES.nbs] : []),
        DATA_SOURCES.usairnet,
      ]}
    >
      <div className="ceil-now">
        <span className="ceil-label">Flight category</span>
        <span className="ceil-value">
          {category ? <FlightCategoryPill category={category} /> : '—'}
        </span>
      </div>
      <div className="ceil-now">
        <span className="ceil-label">Ceiling</span>
        <span className="ceil-value">
          {/* "No ceiling" is a reading — a CLR or FEW/SCT sky. A BKN/// (a
              ceiling layer whose height the sensor could not measure) and an
              observation with no sky group at all are different things and
              must not read as the better one. */}
          {current?.ceilingFtAgl != null
            ? `${current.ceilingFtAgl.toLocaleString()} ft AGL`
            : current
              ? CEILING_LABEL[ceilingState(current)]
              : '—'}
        </span>
      </div>
      {category != null && category !== 'VFR' && (
        // Naming the regulation and rendering no link left the reader with a
        // section number and nowhere to check it — the citation layer exists
        // precisely so that does not happen.
        //
        // It says what 105.17 says and no more under 105.17's link. It used
        // to add that jumps "require VFR flight conditions" under the same
        // source line; the section never mentions VFR (read 2026-09-23 and
        // 2026-11-03). The pilot's VFR minimums are 91.155, which has its
        // own sentence and link below (since 2026-11-03): its figures turn on
        // the airspace class and on day or night, and the app reads the
        // airspace no more than it reads which band the climb is in, so
        // every row is printed (FAR_91155_ROWS, one string with the citation
        // and #citations A9) and the sectional named. 105.17's table has no
        // airspace column, so Class G's 1 SM does not loosen the jump; the
        // sentence says so. Both 105.17 altitude rows
        // are printed because a full-altitude exit from this DZ is above
        // 10,000 ft MSL, where the figures are the higher ones, and a
        // hop-and-pop is not; then how the flag holds the reading to them,
        // as the flag says it (`visibilityFigure`).
        // The category's own label is the pill above; "reduced
        // ceiling/visibility" was the app's gloss on the AIM's label and went
        // on 2026-11-22 with the fold of 91.155's rows, which a reader needs
        // once (docs/card-wording-review-2026-11-21.md, C4): the rows stay in
        // the HTML, closed, so the card's tests and the citation's ref read
        // them as before.
        <>
          <p className="muted small">
            14 CFR 105.17 bars parachute ops into or through cloud and sets flight visibility and
            distance from cloud: below 10,000 ft MSL, 3 SM and 500 ft below / 1,000 ft above / 2,000 ft
            horizontal; at or above 10,000 ft MSL, 5 SM and 1,000 ft below / 1,000 ft above / 1 mile
            horizontal.{' '}
            {thresholds && `The visibility flag ${visibilityFigure(thresholds)} `}
            Source:{' '}
            <SourceLink citation={CITATIONS.far10517} />. The pilot&rsquo;s basic VFR weather minimums
            are 14 CFR 91.155, by airspace class and altitude (every row below); 105.17&rsquo;s table has
            no airspace column, so the Class G figures do not loosen the parachute operation. Which
            airspace is over the DZ is on the sectional chart (Pilots tab). Source:{' '}
            <SourceLink citation={CITATIONS.far91155} />
          </p>
          <details className="far-rows">
            <summary className="small">14 CFR 91.155&rsquo;s rows, for aircraft other than helicopters</summary>
            <p className="muted small">{FAR_91155_ROWS}</p>
          </details>
        </>
      )}
      {blocks.length === 0 ? (
        <p className="muted">No hourly forecast available.</p>
      ) : (
        <CeilingSkyDays blocks={blocks} showOm={showOm} timeZone={SITE.timeZone} />
      )}
      {ceilingEnds != null && (
        // One line for the whole card, day and hour: a later day with no
        // ceiling row then needs no explaining of its own, and an end at
        // local midnight is named (nwsCeilingForecastEnd).
        <p className="muted small csd-ends">
          NWS ceiling forecast ends {fmtWeekday(ceilingEnds)} {fmtShortHour(ceilingEnds)}; its sky row runs on.
        </p>
      )}
      <p className="muted small">
        Each day across, every 3 h, in the drop zone&rsquo;s time; the dark columns are night there, sunset to
        sunrise, the same times the night flag uses, a three-hour slot going by its greater part. Sky cover
        % as a bar and a figure: the NWS forecast&rsquo;s{showOm && ', Open-Meteo\u2019s cloud cover (OM) as a figure beside it,'} and
        the NBM&rsquo;s. Heights in thousands of ft AGL; &ldquo;no&rdquo; = no broken/overcast layer (ceiling)
        or no layer at all (base); a blank cell is a slot that forecast does not cover or gives no figure for, and a
        row is left out of a day it has no figure in. The band is the heights, ground to 12,000 ft: the NBM&rsquo;s
        lowest base a short bar at its height, its ceiling as cloud above it, the NWS ceiling a line across the
        column while that forecast runs; a mark on the top edge is a height at or above 12,000 ft, the row has the
        figure. &ldquo;hourly&rdquo; opens the day&rsquo;s NWS hours, scrolling sideways; today is its hours alone
        when two slots or fewer remain.
      </p>
      {(showBase || nbsShown) && (nbm || nbs) && (
        <p className="muted small">
          The NBM rows are the NWS National Blend of Models&rsquo; bulletins for {(nbs ?? nbm)!.station}, read through the
          relay{nbm && ' (hourly, 25 hours'}{nbm && nbs && '; '}{nbs && `${nbm ? '' : ' ('}three-hourly, 6 to 72 hours, the bulletin usairnet\u2019s three-day table reads`}
          {(nbm || nbs) && ')'}; each bulletin&rsquo;s cycle is on Data health. Their base is the lowest cloud base
          whether or not a ceiling is present, a few or scattered layer included, from a blend of models and humidity
          (MDL&rsquo;s definition, read 2026-10-26). A column is one bulletin&rsquo;s: the three-hourly one&rsquo;s where
          it has a column there, the hourly one&rsquo;s base alone before it begins, dotted; the hourly rows&rsquo; base
          is the hourly bulletin&rsquo;s. A second forecast beside the NWS one, which it can disagree with; neither
          raises a flag.
        </p>
      )}
      {/* How each forecast compared with KPMV, so a reader can weigh them by
          the kind of hour: one measure for both, the 5/8 that AC 00-45H's
          sky table gives as the least a broken layer covers, cited. The
          figures are CLOUD_COMPARISON's, which a test works out again from
          the archived records; measured, not a threshold, and nothing here
          flags or colours an hour. One line shows; the rest is collapsed. */}
      {showOm && (
        <>
          <p className="muted small sky-compare-brief">
            Against {SITE.metarStation.id}, {CLOUD_COMPARISON.period}, the share of hours each forecast
            reached {CEILING_EIGHTHS}/8 cover: with a ceiling, NWS {CLOUD_COMPARISON.ceilingHours.nws}%,
            Open-Meteo {CLOUD_COMPARISON.ceilingHours.omStart}% ({CLOUD_COMPARISON.ceilingHours.omDayAhead}% a
            day ahead); with none, NWS {CLOUD_COMPARISON.noCeilingHours.nws}%, Open-Meteo{' '}
            {CLOUD_COMPARISON.noCeilingHours.omStart}% ({CLOUD_COMPARISON.noCeilingHours.omDayAhead}% a day
            ahead). Open-Meteo&rsquo;s first figure is its best case, the first hours of its runs.
          </p>
          <details className="sky-compare">
            <summary className="small">How the two compared, in full</summary>
            <p className="muted small">
              Each figure is the share of hours a forecast was at or above {CEILING_EIGHTHS}/8 (
              {CEILING_EIGHTHS * 12.5}%), the least a broken layer covers.{' '}
              {SITE.metarStation.id} is about {Math.round(METAR_STATION_OFFSET.distanceMi)} mi away. On
              hours it reported a ceiling: NWS {CLOUD_COMPARISON.ceilingHours.nws}%; Open-Meteo{' '}
              {CLOUD_COMPARISON.ceilingHours.omStart}% in the first hours of its runs and{' '}
              {CLOUD_COMPARISON.ceilingHours.omDayAhead}% a day ahead. With no ceiling: NWS{' '}
              {CLOUD_COMPARISON.noCeilingHours.nws}%; Open-Meteo {CLOUD_COMPARISON.noCeilingHours.omStart}%
              and {CLOUD_COMPARISON.noCeilingHours.omDayAhead}%; Open-Meteo&rsquo;s low-cloud share
              (below 3 km, in each hour&rsquo;s tooltip where hovering shows one){' '}
              {CLOUD_COMPARISON.noCeilingHours.omLowStart}%. Some no-ceiling hours may have had cloud
              above 12,000 ft, which the station does not report. Neither forecast was measured at the
              lead the card shows: NWS from four issuances a day, Open-Meteo at its runs&rsquo; first
              hours and a day ahead. Exactly 0% or 100%: NWS on{' '}
              {CLOUD_COMPARISON.exactlyNoneOrAll.nws}% of hours, Open-Meteo on{' '}
              {CLOUD_COMPARISON.exactlyNoneOrAll.omStart}%. Sources:{' '}
              <SourceLink citation={CITATIONS.faaSkyCover} />;{' '}
              <a href={repoDoc('docs/cloud-cover-sources.md')} target="_blank" rel="noopener noreferrer">
                the comparison
              </a>
              .
            </p>
          </details>
        </>
      )}
      {/* Only what is particular to this card. Confirming conditions with
          official sources, the S&TA and the PIC is the page's to say, in its
          banner. */}
      <p className="muted small">
        Same NWS forecast as the{' '}
        <a href={DATA_SOURCES.usairnet.url} target="_blank" rel="noopener noreferrer">
          usairnet KPMV page
        </a>
        , here for the drop zone&rsquo;s own grid point rather than the station.
      </p>
    </Panel>
  );
}
