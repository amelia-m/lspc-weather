import type { CurrentConditions, HourlyPoint, OpenMeteoCloudHour } from '../domain/types';
import { round } from '../domain/units';
import { observedFlightCategory, CATEGORY_LABEL } from '../domain/flightCategory';
import { ceilingState, type CeilingState } from '../domain/normalize';
import { DATA_SOURCES } from '../config/sources';
import { CITATIONS } from '../config/thresholds';
import { Panel } from './common/Panel';
import { FlightCategoryPill } from './common/FlightCategoryPill';
import { SourceLink } from './common/SourceLink';
import { fmtShortHour, fmtTime } from './format';

/** A time under every third hour, as on the Precip card: twelve labels do
 *  not fit a phone-width card, and every hour's tooltip names its time. */
const LABEL_EVERY = 3;

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
              <span className="sky-pct">{h.skyCoverPct != null ? round(h.skyCoverPct) : '—'}</span>
              {showOm && (
                <span className="sky-pct om-pct">{om?.totalPct != null ? round(om.totalPct) : '—'}</span>
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
                {h.ceilingFtAgl != null ? Math.round(h.ceilingFtAgl / 100) / 10 : '–'}
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
        ft AGL; “–” = no broken/overcast layer, so no ceiling. A time under every {LABEL_EVERY} hours.
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
