import type { CurrentConditions, HourlyPoint } from '../domain/types';
import { round } from '../domain/units';
import { flightCategory, CATEGORY_LABEL } from '../domain/flightCategory';
import { DATA_SOURCES } from '../config/sources';
import { CITATIONS } from '../config/thresholds';
import { Panel } from './common/Panel';
import { FlightCategoryPill } from './common/FlightCategoryPill';
import { SourceLink } from './common/SourceLink';
import { fmtTime } from './format';

/** Current ceiling + an hourly sky-cover / ceiling timeline (mirrors the
 *  usairnet cloud forecast), built from NWS gridpoint data. */
export function CeilingSkyPanel({
  current,
  hourly,
}: {
  current: CurrentConditions | null;
  hourly: HourlyPoint[];
}): JSX.Element {
  const now = Date.now();
  const upcoming = hourly.filter((h) => h.time >= now - 3600_000).slice(0, 12);
  const category = current ? flightCategory(current.ceilingFtAgl, current.visibilitySm) : null;

  return (
    <Panel
      title="Ceiling & sky"
      subtitle="now + next hours"
      sources={[DATA_SOURCES.nwsObservation, DATA_SOURCES.nwsForecast, DATA_SOURCES.usairnet]}
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
          {current?.ceilingFtAgl != null
            ? `${current.ceilingFtAgl.toLocaleString()} ft AGL`
            : current
              ? 'No ceiling'
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
          <div className="sky-timeline">
          <div className="sky-col sky-axis-col" aria-hidden="true">
            <span className="sky-pct">&nbsp;</span>
            <div className="sky-axis">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
            <span className="sky-ceil">&nbsp;</span>
            <span className="sky-time">&nbsp;</span>
          </div>
          {upcoming.map((h) => (
            <div key={h.time} className="sky-col" title={describeHour(h)}>
              <span className="sky-pct">{h.skyCoverPct != null ? `${round(h.skyCoverPct)}%` : '—'}</span>
              <div className="sky-bar-track">
                <div
                  className="sky-bar"
                  style={{ height: `${h.skyCoverPct ?? 0}%` }}
                  data-cover={coverClass(h.skyCoverPct)}
                />
              </div>
              <span className="sky-ceil" title={h.ceilingFtAgl != null ? undefined : 'No ceiling (no broken/overcast layer)'}>
                {h.ceilingFtAgl != null ? `${Math.round(h.ceilingFtAgl / 100) / 10}k` : 'none'}
              </span>
              <span className="sky-time">{fmtTime(h.time)}</span>
            </div>
          ))}
          </div>
        </div>
      )}
      <p className="muted small">
        Bar height = sky cover %. Label = ceiling (thousands ft AGL); “none” = no broken/overcast
        layer, so no ceiling.
      </p>
      <p className="muted small">
        Cross-check against the{' '}
        <a href={DATA_SOURCES.usairnet.url} target="_blank" rel="noopener noreferrer">
          usairnet KPMV aviation forecast
        </a>{' '}
        — a page many jumpers use. It presents the same NWS forecast data; this card pulls it
        gridded to the DZ instead of the KPMV station page. This dashboard gathers a lot of sources
        in one place; it isn&rsquo;t a replacement for the tools you already check.
      </p>
    </Panel>
  );
}

function describeHour(h: HourlyPoint): string {
  const parts = [fmtTime(h.time)];
  if (h.skyCoverPct != null) parts.push(`${round(h.skyCoverPct)}% cover`);
  if (h.ceilingFtAgl != null) parts.push(`ceiling ${h.ceilingFtAgl.toLocaleString()} ft`);
  if (h.precipProbPct != null) parts.push(`${round(h.precipProbPct)}% precip`);
  return parts.join(' · ');
}

function coverClass(pct: number | null): string {
  if (pct == null) return 'unknown';
  if (pct < 25) return 'few';
  if (pct < 50) return 'sct';
  if (pct < 88) return 'bkn';
  return 'ovc';
}
