import type { CurrentConditions, HourlyPoint } from '../domain/types';
import { round } from '../domain/units';
import { flightCategory, CATEGORY_LABEL } from '../domain/flightCategory';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { FlightCategoryPill } from './common/FlightCategoryPill';
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
        <p className="muted small">
          {CATEGORY_LABEL[category]}: reduced ceiling/visibility. Jumps still require VFR flight
          conditions and the 14 CFR 105.17 cloud-clearance minimums.
        </p>
      )}
      {upcoming.length === 0 ? (
        <p className="muted">No hourly forecast available.</p>
      ) : (
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
              <span className="sky-ceil">
                {h.ceilingFtAgl != null ? `${Math.round(h.ceilingFtAgl / 100) / 10}k` : '—'}
              </span>
              <span className="sky-time">{fmtTime(h.time)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="muted small">Bar height = sky cover %. Label = ceiling (thousands ft AGL).</p>
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
