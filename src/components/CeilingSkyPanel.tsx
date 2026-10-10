import type { CurrentConditions, HourlyPoint, OpenMeteoCloudHour } from '../domain/types';
import { round } from '../domain/units';
import { observedFlightCategory, CATEGORY_LABEL } from '../domain/flightCategory';
import { ceilingState, type CeilingState } from '../domain/normalize';
import { DATA_SOURCES } from '../config/sources';
import { CITATIONS } from '../config/thresholds';
import { METAR_STATION_OFFSET, SITE, repoDoc } from '../config/site';
import { CLOUD_COMPARISON } from '../config/cloudComparison';
import { CEILING_EIGHTHS } from '../domain/cloudCoverSources';
import { Panel } from './common/Panel';
import { FlightCategoryPill } from './common/FlightCategoryPill';
import { SourceLink } from './common/SourceLink';
import { fmtShortHour, fmtTime } from './format';

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
}: {
  current: CurrentConditions | null;
  hourly: HourlyPoint[];
  /** Open-Meteo's hourly cloud cover (`snapshot.openMeteoClouds`); null on
   *  the FD fallback and until it loads, and the card then shows the NWS
   *  forecast alone. Each figure is matched to an NWS hour by its time. */
  omClouds?: OpenMeteoCloudHour[] | null;
}): JSX.Element {
  const now = Date.now();
  const upcoming = hourly.filter((h) => h.time >= now - 3600_000).slice(0, 12);
  // Matched hour for hour by valid time; an hour Open-Meteo did not serve
  // shows no second bar rather than a borrowed neighbour's.
  const omAt = new Map((omClouds ?? []).map((c) => [c.time, c]));
  const showOm = upcoming.some((h) => omAt.get(h.time)?.totalPct != null);
  const category = current ? observedFlightCategory(current) : null;

  return (
    <Panel
      title="Ceiling & sky"
      subtitle="now + next hours"
      sources={[
        DATA_SOURCES.iemObservation,
        DATA_SOURCES.nwsObservation,
        DATA_SOURCES.nwsForecast,
        ...(showOm ? [DATA_SOURCES.openMeteo] : []),
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
        // It says what 105.17 says and no more. It used to add that jumps
        // "require VFR flight conditions" under the same source line; the
        // section never mentions VFR (read 2026-09-23) — the pilot's VFR
        // minimums are 91.155, which this app does not cite. Both altitude
        // rows are printed because an exit from this DZ is above 10,000 ft
        // MSL, where the figures are the higher ones.
        <p className="muted small">
          {CATEGORY_LABEL[category]}: reduced ceiling/visibility. 14 CFR 105.17 bars parachute ops
          into or through cloud and sets flight visibility and distance from cloud: below 10,000 ft
          MSL, 3 SM and 500 ft below / 1,000 ft above / 2,000 ft horizontal; at or above 10,000 ft
          MSL, 5 SM and 1,000 ft below / 1,000 ft above / 1 mile horizontal. Source:{' '}
          <SourceLink citation={CITATIONS.far10517} />
        </p>
      )}
      {upcoming.length === 0 ? (
        <p className="muted">No hourly forecast available.</p>
      ) : (
        <div className="sky-scroll">
          <div className="sky-timeline ceiling-timeline">
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
            <span className="sky-time">&nbsp;</span>
          </div>
          {upcoming.map((h, i) => {
            const om = omAt.get(h.time);
            return (
            <div key={h.time} className="sky-col" title={describeHour(h, om)}>
              <span className="sky-pct">
                {h.skyCoverPct != null ? round(h.skyCoverPct) : '—'}
                <span className="sr-only">{h.skyCoverPct != null ? '% sky cover, NWS' : 'sky cover not reported'}</span>
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
                <div className="sky-bar" style={{ height: `${h.skyCoverPct ?? 0}%` }} />
                {/* Open-Meteo's in an outlined track of its own, so an
                    almost clear hour still shows as a column with little in
                    it rather than as nothing. Neutral, whatever the amount:
                    a second forecast beside the first. */}
                {showOm && (
                  <div className="om-track">
                    <div className="sky-bar om-bar" style={{ height: `${om?.totalPct ?? 0}%` }} />
                  </div>
                )}
              </div>
              <span className="sky-ceil" title={h.ceilingFtAgl != null ? undefined : 'No ceiling (no broken/overcast layer)'}>
                {h.ceilingFtAgl != null ? fmtCeilK(h.ceilingFtAgl) : 'no'}
                <span className="sr-only">{h.ceilingFtAgl != null ? ' thousand ft ceiling' : ' ceiling'}</span>
              </span>
              <span className="sky-time">{i % LABEL_EVERY === 0 ? fmtShortHour(h.time) : '\u00a0'}</span>
            </div>
            );
          })}
          </div>
        </div>
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
            Against {SITE.metarStation.id}, {CLOUD_COMPARISON.period}, hours at {CEILING_EIGHTHS}/8
            cover or more: with a ceiling, NWS {CLOUD_COMPARISON.ceilingHours.nws}%, Open-Meteo{' '}
            {CLOUD_COMPARISON.ceilingHours.omStart}%; with none, NWS {CLOUD_COMPARISON.noCeilingHours.nws}%,
            Open-Meteo {CLOUD_COMPARISON.noCeilingHours.omStart}% (
            {CLOUD_COMPARISON.noCeilingHours.omDayAhead}% a day ahead). Source:{' '}
            <SourceLink citation={CITATIONS.faaSkyCover} />
          </p>
          <details className="sky-compare">
            <summary className="small">How the two compared, in full</summary>
            <p className="muted small">
              {CEILING_EIGHTHS}/8 ({CEILING_EIGHTHS * 12.5}%) is the least a broken layer covers.{' '}
              {SITE.metarStation.id} is about {Math.round(METAR_STATION_OFFSET.distanceMi)} mi away. On
              hours it reported a ceiling: NWS {CLOUD_COMPARISON.ceilingHours.nws}%; Open-Meteo{' '}
              {CLOUD_COMPARISON.ceilingHours.omStart}% in the first hours of its runs and{' '}
              {CLOUD_COMPARISON.ceilingHours.omDayAhead}% a day ahead. With no ceiling: NWS{' '}
              {CLOUD_COMPARISON.noCeilingHours.nws}%; Open-Meteo {CLOUD_COMPARISON.noCeilingHours.omStart}%
              and {CLOUD_COMPARISON.noCeilingHours.omDayAhead}%; Open-Meteo&rsquo;s low-cloud share
              (below 3 km, in each hour&rsquo;s tooltip on a desktop){' '}
              {CLOUD_COMPARISON.noCeilingHours.omLowStart}%. Some no-ceiling hours may have had cloud
              above 12,000 ft, which the station does not report. Neither forecast was measured at the
              lead the card shows: NWS from four issuances a day, Open-Meteo at its runs&rsquo; first
              hours and a day ahead. Exactly 0% or 100%: NWS on{' '}
              {CLOUD_COMPARISON.exactlyNoneOrAll.nws}% of hours, Open-Meteo on{' '}
              {CLOUD_COMPARISON.exactlyNoneOrAll.omStart}%.{' '}
              <a href={repoDoc('docs/cloud-cover-sources.md')} target="_blank" rel="noopener noreferrer">
                The comparison
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
  if (h.precipProbPct != null) parts.push(`${round(h.precipProbPct)}% precip`);
  return parts.join(' · ');
}
