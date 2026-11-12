import { useState } from 'react';
import type { CurrentConditions, HourlyPoint, NbmForecast, NbmHour, OpenMeteoCloudHour } from '../domain/types';
import { round } from '../domain/units';
import { observedFlightCategory, CATEGORY_LABEL } from '../domain/flightCategory';
import { ceilingState, type CeilingState } from '../domain/normalize';
import { DATA_SOURCES } from '../config/sources';
import { CITATIONS, FAR_91155_ROWS, visibilityFigure, type Thresholds } from '../config/thresholds';
import { METAR_STATION_OFFSET, SITE, repoDoc } from '../config/site';
import { CLOUD_COMPARISON } from '../config/cloudComparison';
import { CEILING_EIGHTHS } from '../domain/cloudCoverSources';
import { Panel } from './common/Panel';
import { NbsDays } from './NbsDays';
import { FlightCategoryPill } from './common/FlightCategoryPill';
import { SourceLink } from './common/SourceLink';
import { fmtClock, fmtShortHour, fmtTime, fmtWeekday, localDateKey } from './format';
import { SKY_HORIZONS, THREE_DAY_H, ceilingCoverage, skyHorizonOptions, stripColumns, type StripColumn, type ThreeDayLayout } from './forecastReach';

/** A time under every third hour, as on the Precip card: twelve labels do
 *  not fit a phone-width card. The hours between follow from them (and a
 *  pointer's tooltip names each one; a phone shows no tooltip). */
const LABEL_EVERY = 3;

/** A ceiling in thousands of feet: one decimal below 10,000 ft ("4.5"),
 *  whole thousands from there ("11"), so a figure fits a column a phone
 *  makes 17 px wide. */
function fmtCeilK(ft: number): string {
  const k = ft / 1000;
  return k < 10 ? String(Math.round(k * 10) / 10) : String(Math.round(k));
}

/** What the Ceiling line says when no ceiling height could be computed. */
const CEILING_LABEL: Record<CeilingState, string> = {
  known: 'No ceiling',
  'height-unknown': 'Height not reported',
  unreported: 'Not reported',
};

/** Current ceiling + an hourly sky-cover / ceiling timeline (mirrors the
 *  usairnet cloud forecast), built from NWS gridpoint data, with Open-Meteo's
 *  cloud cover for the same hours beside it where Open-Meteo answered. */
export function CeilingSkyPanel({
  current,
  hourly,
  omClouds = null,
  nbm = null,
  nbs = null,
  threeDay = 'days',
  thresholds,
  initialHours = SKY_HORIZONS[0],
}: {
  current: CurrentConditions | null;
  hourly: HourlyPoint[];
  /** The horizon the strip opens at; the reader's toggle moves it. A prop so
   *  a static render (the tests) can draw the longer strips. */
  initialHours?: number;
  /** Open-Meteo's hourly cloud cover (`snapshot.openMeteoClouds`); null on
   *  the FD fallback and until it loads, and the card then shows the NWS
   *  forecast alone. Each figure is matched to an NWS hour by its time. */
  omClouds?: OpenMeteoCloudHour[] | null;
  /** The NBM's hourly bulletin for KPMV (`snapshot.nbm`), through the
   *  relay; null without it. Its lowest cloud base is a row under the
   *  ceiling, matched to each NWS hour by time. */
  nbm?: NbmForecast | null;
  /** The NBM's three-hourly bulletin (`snapshot.nbs`), 6 to 72 hours from
   *  its cycle, the one usairnet's three-day table reads; null without the
   *  relay. Shown as `threeDay` says. */
  nbs?: NbmForecast | null;
  /** Which of the three-day layouts to draw (forecastReach.ts); the
   *  maintainer is trying them (2026-11-12). */
  threeDay?: ThreeDayLayout;
  /** The thresholds the flags are read against, for the sentence naming the
   *  figure the visibility flag fires at; without them the card names none
   *  rather than guess past a Settings edit. */
  thresholds?: Pick<Thresholds, 'visibilityCautionSm' | 'published' | 'visibilityRow'>;
}): JSX.Element {
  const [hours, setHours] = useState<number>(initialHours);
  const now = Date.now();
  const future = hourly.filter((h) => h.time >= now - 3600_000);
  // The three-day option only where the three-hourly bulletin is in hand
  // and the layout draws it on this strip; the 'strip' layout draws it as
  // a strip of its own below, whatever the toggle says.
  const onStrip = (threeDay === 'horizon' || threeDay === 'continue') && (nbs?.hours.length ?? 0) > 0;
  const options = [...skyHorizonOptions(future.length), ...(onStrip && future.length > SKY_HORIZONS[SKY_HORIZONS.length - 1] ? [THREE_DAY_H] : [])];
  const effectiveHours = options.includes(hours) ? hours : SKY_HORIZONS[0];
  const extended = effectiveHours > SKY_HORIZONS[0];
  // The strip's columns: the NWS hours in the horizon, and past the last of
  // them the three-hourly bulletin's own times (only reached by the 3-day
  // option, since the NWS hourly forecast runs well past 36 h).
  const columns = future.length > 0 ? stripColumns(future[0].time, effectiveHours, future, nbm?.hours, onStrip ? nbs?.hours : null) : [];
  const upcoming = columns.flatMap((c) => (c.nws ? [c.nws] : []));
  const coverage = ceilingCoverage(upcoming);
  // A strip that crosses midnight names the new day under its first hour:
  // 36 hours print the same clock times twice, and a phone shows no tooltip.
  // Each hour's date once: the card re-renders on every observation poll.
  const dayKeys = columns.map((c) => localDateKey(c.time));
  const crossesDay = dayKeys.length > 0 && dayKeys[0] !== dayKeys[dayKeys.length - 1];
  // Matched hour for hour by valid time; an hour Open-Meteo did not serve
  // shows no second bar rather than a borrowed neighbour's.
  const omAt = new Map((omClouds ?? []).map((c) => [c.time, c]));
  const showOm = upcoming.some((h) => omAt.get(h.time)?.totalPct != null);
  // The NBM's hours by time, as Open-Meteo's: a row only where a bulletin
  // reaches this strip, the hourly one first and the three-hourly one at
  // its times past it. The base is what its name says, the lowest layer
  // whether or not a ceiling is present, from a blend of models, so it can
  // sit under the NWS ceiling above it or disagree with "no". Printed, not
  // flagged: no published limit applies to a cloud base.
  const nbmOf = (c: StripColumn): NbmHour | null => c.nbh ?? c.nbs;
  const showBase = columns.some((c) => nbmOf(c)?.lowestBaseFtAgl !== undefined);
  // The NBM's own ceiling: a row of its own under the base in the 'horizon'
  // layout; in 'continue' it fills the ceiling row's dashes past the NWS
  // ceiling's end, marked as the NBM's.
  const showNbmCeil = onStrip && threeDay === 'horizon' && columns.some((c) => nbmOf(c)?.ceilingFtAgl !== undefined);
  const nbmCeilText = (h: NbmHour | null): string => (h?.ceilingFtAgl === undefined ? '—' : h.ceilingFtAgl === null ? 'no' : fmtCeilK(h.ceilingFtAgl));
  const nbmCeilTitle = (h: NbmHour | null): string =>
    h?.ceilingFtAgl === undefined ? 'No NBM ceiling figure for this hour' : h.ceilingFtAgl === null ? 'NBM: no ceiling' : `NBM ceiling ${h.ceilingFtAgl.toLocaleString()} ft AGL`;
  const spanH = columns.length > 1 ? Math.round((columns[columns.length - 1].time - columns[0].time) / 3_600_000) : 0;
  const showNbsStrip = threeDay === 'strip' && (nbs?.hours.length ?? 0) > 0;
  const showNbsDays = threeDay === 'days' && (nbs?.hours.length ?? 0) > 0;
  const nbsShown = showNbsStrip || showNbsDays || (onStrip && columns.some((c) => c.nbs));
  const category = current ? observedFlightCategory(current) : null;

  return (
    <Panel
      title="Ceiling & sky"
      // The first column is the hour under way, so twelve columns look eleven
      // hours past it.
      subtitle={spanH > 0 ? `now + next ${spanH} h` : 'now + next hours'}
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
        <p className="muted small">
          {CATEGORY_LABEL[category]}: reduced ceiling/visibility. 14 CFR 105.17 bars parachute ops
          into or through cloud and sets flight visibility and distance from cloud: below 10,000 ft
          MSL, 3 SM and 500 ft below / 1,000 ft above / 2,000 ft horizontal; at or above 10,000 ft
          MSL, 5 SM and 1,000 ft below / 1,000 ft above / 1 mile horizontal.{' '}
          {thresholds && `The visibility flag ${visibilityFigure(thresholds)} `}
          Source:{' '}
          <SourceLink citation={CITATIONS.far10517} />. The pilot&rsquo;s basic VFR weather minimums
          are 14 CFR 91.155, by airspace class and altitude, for aircraft other than helicopters:{' '}
          {FAR_91155_ROWS} 105.17&rsquo;s table has no airspace column, so the Class G figures do not
          loosen the parachute operation. Which airspace is over the DZ is on the sectional chart
          (Pilots tab). Source: <SourceLink citation={CITATIONS.far91155} />
        </p>
      )}
      {columns.length > 0 && options.length > 1 && (
        <div className="range-toggle" role="group" aria-label="Sky forecast horizon">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              className={o === effectiveHours ? 'active' : ''}
              aria-pressed={o === effectiveHours}
              onClick={() => setHours(o)}
            >
              {o}h
            </button>
          ))}
        </div>
      )}
      {columns.length === 0 ? (
        <p className="muted">No hourly forecast available.</p>
      ) : (
        <div className="sky-scroll">
          {/* Past twelve hours the columns keep a readable width and the
              strip scrolls sideways inside the card, as the TAF table does,
              rather than squeezing 36 figures into a phone's width. */}
          <div className={extended ? 'sky-timeline ceiling-timeline extended' : 'sky-timeline ceiling-timeline'}>
          {/* The units, once for each row, so a figure in a column a
              phone makes 17 px wide is only its digits. */}
          <div className="sky-col sky-axis-col" aria-hidden="true">
            <span className="sky-pct">%</span>
            {showOm && <span className="sky-pct om-pct">%</span>}
            <div className="sky-axis">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
            <span className="sky-ceil">k ft</span>
            {showBase && <span className="sky-ceil sky-base">base</span>}
            {showNbmCeil && <span className="sky-ceil sky-base">NBM</span>}
            <span className="sky-time">&nbsp;</span>
            {crossesDay && <span className="sky-time sky-day">&nbsp;</span>}
          </div>
          {columns.map((c, i) => {
            const h = c.nws;
            const om = h ? omAt.get(h.time) : undefined;
            const n = nbmOf(c);
            // A column past the NWS hours is the three-hourly bulletin's
            // alone: wider, so its time label fits, and its sky bar in the
            // outlined track the second forecast uses.
            const nbsOnly = h == null;
            const nbmCeil = n?.ceilingFtAgl;
            // Only with the three-hourly bulletin on the strip (onStrip),
            // as the note and the source link that explain the lighter
            // figure are: without it an NBH ceiling in a gap of the NWS
            // forecast would print unexplained (found in review, 2026-11-12).
            const continued = onStrip && threeDay === 'continue' && (h == null || !h.ceilingForecast) && nbmCeil !== undefined;
            return (
            <div key={c.time} className={nbsOnly ? 'sky-col nbs-col' : 'sky-col'} title={h ? describeHour(h, om) : describeNbm(c.time, n)}>
              <span className={nbsOnly ? 'sky-pct nbm-pct' : 'sky-pct'}>
                {h ? (h.skyCoverPct != null ? round(h.skyCoverPct) : '—') : n?.skyCoverPct != null ? round(n.skyCoverPct) : '—'}
                <span className="sr-only">{h ? (h.skyCoverPct != null ? '% sky cover, NWS' : 'sky cover not reported') : n?.skyCoverPct != null ? '% sky cover, NBM' : 'NBM sky cover not given'}</span>
              </span>
              {showOm && (
                <span className="sky-pct om-pct">
                  {om?.totalPct != null ? round(om.totalPct) : '—'}
                  <span className="sr-only">{om?.totalPct != null ? '% cloud cover, Open-Meteo' : 'Open-Meteo cloud cover not served'}</span>
                </span>
              )}
              <div className="sky-bar-track">
                {/* One colour whatever the amount: the bar shows how much
                    sky is covered and asserts no category. Which hours have
                    a ceiling the label under it says. */}
                {h ? (
                  <div className="sky-bar" style={{ height: `${h.skyCoverPct ?? 0}%` }} />
                ) : (
                  <div className="om-track nbm-track">
                    <div className="sky-bar om-bar" style={{ height: `${n?.skyCoverPct ?? 0}%` }} />
                  </div>
                )}
                {/* Open-Meteo's in an outlined track of its own, so an
                    almost clear hour still shows as a column with little in
                    it rather than as nothing. Neutral, whatever the amount:
                    a second forecast beside the first. */}
                {showOm && h && (
                  <div className="om-track">
                    <div className="sky-bar om-bar" style={{ height: `${om?.totalPct ?? 0}%` }} />
                  </div>
                )}
              </div>
              {/* "no" only inside the ceiling forecast, where a missing
                  ceiling is NWS's "no ceiling"; past it, a dash, or in the
                  'continue' layout the NBM's figure, marked as its. */}
              {continued ? (
                <span className="sky-ceil nbm-fig" title={nbmCeilTitle(n)}>
                  {nbmCeilText(n)}
                  <span className="sr-only">{nbmCeil === null ? ' NBM: no ceiling' : ' thousand ft NBM ceiling'}</span>
                </span>
              ) : (
              <span
                className="sky-ceil"
                title={
                  h?.ceilingFtAgl != null
                    ? undefined
                    : h?.ceilingForecast
                      ? 'No ceiling (no broken/overcast layer)'
                      : 'No ceiling forecast for this hour'
                }
              >
                {h?.ceilingFtAgl != null ? fmtCeilK(h.ceilingFtAgl) : h?.ceilingForecast ? 'no' : '—'}
                <span className="sr-only">
                  {h?.ceilingFtAgl != null ? ' thousand ft ceiling' : h?.ceilingForecast ? ' ceiling' : ' ceiling not forecast'}
                </span>
              </span>
              )}
              {/* The NBM's lowest cloud base under the ceiling, in the same
                  units: "no" where the bulletin says no layer, a dash where
                  it gives no figure for the hour. */}
              {showBase && (() => {
                const base = n?.lowestBaseFtAgl;
                return (
                  <span
                    className="sky-base"
                    title={base === undefined ? 'No NBM figure for this hour' : base === null ? 'NBM: no cloud layer' : `NBM lowest cloud base ${base.toLocaleString()} ft AGL`}
                  >
                    {base === undefined ? '—' : base === null ? 'no' : fmtCeilK(base)}
                    <span className="sr-only">{base === undefined ? ' NBM base not given' : base === null ? ' NBM no layer' : ' thousand ft NBM lowest base'}</span>
                  </span>
                );
              })()}
              {showNbmCeil && (
                <span className="sky-base" title={nbmCeilTitle(n)}>
                  {nbmCeilText(n)}
                  <span className="sr-only">{nbmCeil === undefined ? ' NBM ceiling not given' : nbmCeil === null ? ' NBM no ceiling' : ' thousand ft NBM ceiling'}</span>
                </span>
              )}
              <span className="sky-time">{nbsOnly || i % LABEL_EVERY === 0 ? fmtShortHour(c.time) : '\u00a0'}</span>
              {crossesDay && (
                <span className="sky-time sky-day">
                  {i > 0 && dayKeys[i] !== dayKeys[i - 1] ? fmtWeekday(c.time) : '\u00a0'}
                </span>
              )}
            </div>
            );
          })}
          </div>
        </div>
      )}
      {showNbsStrip && nbs && <NbsStrip nbs={nbs} />}
      {showNbsDays && nbs && <NbsDays nbs={nbs} timeZone={SITE.timeZone} />}
      {/* Where the forecast ends is a fact of the copy the card has; why is
          not. Its usual reach is given as the usual, since a copy a day old
          (an outage, or an edge serving an older one) ends sooner. */}
      {coverage?.kind === 'end' && (
        <p className="muted small">
          No ceiling forecast from {fmtClock(coverage.from)}: the NWS ceiling forecast the card has ends
          there (it normally runs about a day and a half from when it was issued), so later hours show
          sky cover only, and a dash where the ceiling would be.
        </p>
      )}
      {coverage?.kind === 'none' && (
        <p className="muted small">
          The NWS forecast the card has gives no ceiling for any of these hours; the ceiling row shows
          a dash.
        </p>
      )}
      {coverage?.kind === 'gaps' && (
        <p className="muted small">
          The NWS forecast gives no ceiling for some of these hours; a dash marks them.
        </p>
      )}
      {showBase && nbm && (
        <p className="muted small">
          The “base” row is the lowest cloud base in the NWS National Blend of Models&rsquo; hourly bulletin
          for {nbm.station} (the {String(new Date(nbm.cycleMs).getUTCHours()).padStart(2, '0')}Z cycle, read through the relay): the lowest layer
          whether or not a ceiling is present, a few or scattered layer included, from a blend of models
          and humidity (MDL&rsquo;s definition, read 2026-10-26). In thousands of ft AGL; “no” = no layer.
          A second forecast beside the NWS ceiling above it, which it can disagree with; it raises no
          flag.
        </p>
      )}
      {nbsShown && nbs && (
        <p className="muted small">
          {threeDay === 'strip' || threeDay === 'days' ? 'The three-day block' : 'Past the NWS hourly forecast, and the 72h option,'} {threeDay === 'strip' || threeDay === 'days' ? 'is' : 'the strip reads'} the
          NWS National Blend of Models&rsquo; three-hourly bulletin for {nbs.station} (NBS, the{' '}
          {String(new Date(nbs.cycleMs).getUTCHours()).padStart(2, '0')}Z cycle, read through the relay): its sky cover, ceiling and lowest
          cloud base at three-hour steps, 6 to 72 hours from its cycle, the bulletin usairnet&rsquo;s three-day table reads.
          {threeDay === 'continue' && ' Where the NWS ceiling forecast ends, the ceiling row goes on in the NBM’s figures, in the lighter type.'}
          {threeDay === 'horizon' && ' The “NBM” row is its ceiling, under its base.'}
          {' '}A second forecast, never blended with the NWS one; it raises no flag.
        </p>
      )}
      <p className="muted small">
        Bar height and the figure above it = sky cover %. Label under it = ceiling in thousands of
        ft AGL; “no” = no broken/overcast layer, so no ceiling. A time under every {LABEL_EVERY} hours.
        {showOm && (
          <>
            {' '}
            Beside each, the narrow outlined grey bar and the lower, grey figure are Open-Meteo&rsquo;s cloud
            cover for the same hour: a second model&rsquo;s share of the sky under cloud, which says
            nothing about a cloud base. The ceiling labels are the NWS forecast&rsquo;s alone. The two
            can disagree; both are forecasts.
          </>
        )}
      </p>
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

function describeHour(h: HourlyPoint, om?: OpenMeteoCloudHour): string {
  const parts = [fmtTime(h.time)];
  if (h.skyCoverPct != null) parts.push(`NWS ${round(h.skyCoverPct)}% cover`);
  if (om?.totalPct != null) {
    const bands = [
      om.lowPct != null ? `low ${round(om.lowPct)}%` : null,
      om.midPct != null ? `mid ${round(om.midPct)}%` : null,
      om.highPct != null ? `high ${round(om.highPct)}%` : null,
    ].filter(Boolean);
    parts.push(`Open-Meteo ${round(om.totalPct)}% cover${bands.length ? ` (${bands.join(', ')})` : ''}`);
  }
  if (h.ceilingFtAgl != null) parts.push(`ceiling ${h.ceilingFtAgl.toLocaleString()} ft`);
  else if (!h.ceilingForecast) parts.push('ceiling not forecast');
  if (h.precipProbPct != null) parts.push(`${round(h.precipProbPct)}% precip`);
  return parts.join(' · ');
}

function describeNbm(time: number, n: NbmHour | null): string {
  const parts = [fmtTime(time)];
  if (n?.skyCoverPct != null) parts.push(`NBM ${round(n.skyCoverPct)}% cover`);
  if (n?.ceilingFtAgl != null) parts.push(`NBM ceiling ${n.ceilingFtAgl.toLocaleString()} ft`);
  else if (n?.ceilingFtAgl === null) parts.push('NBM: no ceiling');
  if (n?.lowestBaseFtAgl != null) parts.push(`NBM base ${n.lowestBaseFtAgl.toLocaleString()} ft`);
  if (!n) parts.push('no NBM figures');
  return parts.join(' · ');
}

/** The 'strip' layout's second strip: the three-hourly bulletin on its
 *  own, every column one of its times, the same rows as the hourly strip
 *  (sky cover as a bar and a figure, ceiling, base) in the outlined track
 *  the second forecasts use. A time under every column, since each is
 *  three hours, and the weekday under the first of each day. */
function NbsStrip({ nbs }: { nbs: NbmForecast }): JSX.Element {
  const cols = nbs.hours;
  const dayKeys = cols.map((h) => localDateKey(h.time));
  const ceil = (h: NbmHour): string => (h.ceilingFtAgl === undefined ? '—' : h.ceilingFtAgl === null ? 'no' : fmtCeilK(h.ceilingFtAgl));
  const base = (h: NbmHour): string => (h.lowestBaseFtAgl === undefined ? '—' : h.lowestBaseFtAgl === null ? 'no' : fmtCeilK(h.lowestBaseFtAgl));
  return (
    <div className="nbs-strip">
      <p className="small nbs-strip-title">
        Next three days, every 3 h: NBM three-hourly bulletin ({String(new Date(nbs.cycleMs).getUTCHours()).padStart(2, '0')}Z cycle)
      </p>
      <div className="sky-scroll">
        <div className="sky-timeline ceiling-timeline extended nbs-timeline">
          <div className="sky-col sky-axis-col" aria-hidden="true">
            <span className="sky-pct nbm-pct">%</span>
            <div className="sky-axis">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
            <span className="sky-ceil">k ft</span>
            <span className="sky-ceil sky-base">base</span>
            <span className="sky-time">&nbsp;</span>
            <span className="sky-time sky-day">&nbsp;</span>
          </div>
          {cols.map((h, i) => (
            <div key={h.time} className="sky-col nbs-col" title={describeNbm(h.time, h)}>
              <span className="sky-pct nbm-pct">
                {h.skyCoverPct != null ? round(h.skyCoverPct) : '—'}
                <span className="sr-only">{h.skyCoverPct != null ? '% sky cover, NBM' : 'NBM sky cover not given'}</span>
              </span>
              <div className="sky-bar-track">
                <div className="om-track nbm-track">
                  <div className="sky-bar om-bar" style={{ height: `${h.skyCoverPct ?? 0}%` }} />
                </div>
              </div>
              <span className="sky-ceil" title={h.ceilingFtAgl === undefined ? 'No NBM ceiling figure' : h.ceilingFtAgl === null ? 'NBM: no ceiling' : `NBM ceiling ${h.ceilingFtAgl.toLocaleString()} ft AGL`}>
                {ceil(h)}
                <span className="sr-only">{h.ceilingFtAgl === undefined ? ' NBM ceiling not given' : h.ceilingFtAgl === null ? ' NBM no ceiling' : ' thousand ft NBM ceiling'}</span>
              </span>
              <span className="sky-base" title={h.lowestBaseFtAgl === undefined ? 'No NBM figure' : h.lowestBaseFtAgl === null ? 'NBM: no cloud layer' : `NBM lowest cloud base ${h.lowestBaseFtAgl.toLocaleString()} ft AGL`}>
                {base(h)}
                <span className="sr-only">{h.lowestBaseFtAgl === undefined ? ' NBM base not given' : h.lowestBaseFtAgl === null ? ' NBM no layer' : ' thousand ft NBM lowest base'}</span>
              </span>
              <span className="sky-time">{fmtShortHour(h.time)}</span>
              <span className="sky-time sky-day">{i === 0 || dayKeys[i] !== dayKeys[i - 1] ? fmtWeekday(h.time) : '\u00a0'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
