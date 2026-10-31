import type { SourceKey, SourceStatus } from '../domain/types';
import type { SourceProvenance } from '../domain/sourceProvenance';
import { USE_FIXTURES } from '../api/http';
import { DATA_SOURCES, type DataSource } from '../config/sources';
import { TAF_RELAY_SET } from '../config/tafRelay';
import { Panel } from './common/Panel';
import { fmtAgo, shortError } from './format';
import { OPEN_METEO_FREE_LIMITS, USAGE_KEEP_DAYS, type UsageSummary } from '../domain/openMeteoUsage';

const LABELS: Record<SourceKey, string> = {
  metar: 'METAR (KPMV)',
  nws: 'NWS forecast',
  windsAloft: 'Winds aloft',
  taf: 'TAF',
  daily: '10-day outlook',
  nbm: 'NBM cloud base',
};

const SOURCE_LINKS: Record<SourceKey, DataSource> = {
  metar: DATA_SOURCES.iemObservation,
  nws: DATA_SOURCES.nwsForecast,
  windsAloft: DATA_SOURCES.openMeteo,
  taf: DATA_SOURCES.taf,
  daily: DATA_SOURCES.openMeteo,
  nbm: DATA_SOURCES.nbm,
};

/** The rows shown: the NBM's only where the relay is set (or the fixtures
 *  stand in for it), since nothing fetches it otherwise and an idle row
 *  would read as a source that never answers. */
const ROWS = (Object.keys(LABELS) as SourceKey[]).filter((k) => k !== 'nbm' || TAF_RELAY_SET || USE_FIXTURES);

/** Calls as Open-Meteo counts them, to one decimal where fractional (a
 *  winds request is 9.6), whole where not: a sum of 9.6s is rounded first,
 *  so 106.00000000000001 prints "106", not "106.0". */
const fmtCalls = (n: number): string => {
  const tenths = Math.round(n * 10) / 10;
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
};

export function DataFreshness({
  status,
  provenance,
  lastUpdated,
  onRefresh,
  openMeteoUsage,
}: {
  status: Record<SourceKey, SourceStatus>;
  provenance?: Partial<Record<SourceKey, SourceProvenance>>;
  lastUpdated: number | null;
  onRefresh: () => void;
  /** This browser's requests to Open-Meteo against the free limits
   *  (src/domain/openMeteoUsage.ts); absent when none has been made. */
  openMeteoUsage?: UsageSummary | null;
}): JSX.Element {
  const refreshing = Object.values(status).some((s) => s.pending);
  return (
    <Panel
      className="freshness"
      title="Data health"
      action={
        <button className="refresh-btn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
        </button>
      }
    >
      <>
        {USE_FIXTURES && (
          <p className="fixtures-banner">
            Showing <strong>sample data</strong> (offline / dev mode), not live weather.
          </p>
        )}
        <ul className="source-list">
          {ROWS.map((k) => {
            const prov = provenance?.[k];
            return (
              <li key={k} className={statusClass(status[k])} data-flags={prov?.flags?.join(' ') || undefined}>
                <span className="source-dot" aria-hidden />
                <span className="source-info">
                  <span className="source-name">
                    <a href={(prov?.source ?? SOURCE_LINKS[k]).url} target="_blank" rel="noopener noreferrer">
                      {LABELS[k]}
                    </a>
                  </span>
                  {prov && (
                    <span className="source-detail">
                      <span className={`source-chip ${prov.fallback ? 'fallback' : 'primary'}`}>
                        {prov.fallback ? 'fallback' : 'primary'}
                      </span>
                      {prov.detail}
                    </span>
                  )}
                </span>
                <span className="source-meta" title={status[k].error ?? undefined}>
                  {status[k].pending
                    ? 'fetching…'
                    : status[k].error
                      ? `error: ${shortError(status[k].error)}`
                      : status[k].stale
                        ? 'stale'
                        : fmtAgo(status[k].fetchedAt)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="muted small">Updated {fmtAgo(lastUpdated)}.</p>
        {openMeteoUsage && openMeteoUsage.days.length > 0 && (
          // What this browser has asked Open-Meteo, in the units its free
          // limits are set in: a request of many variables counts as
          // several calls (the winds request as 9.6), and the limits are per
          // address, which other browsers on the same network share unseen.
          // A count, not a verdict: the figures and the limits, side by side.
          <div className="om-usage">
            <p className="muted small">
              <strong>This browser’s requests to Open-Meteo</strong> (which counts a request of many
              variables as several calls; the winds request is {fmtCalls(9.6)}): today{' '}
              {openMeteoUsage.day.requests}, about {fmtCalls(openMeteoUsage.day.calls)} calls of its{' '}
              {OPEN_METEO_FREE_LIMITS.day.toLocaleString('en-US')} a day for one address; this hour{' '}
              {openMeteoUsage.hour.requests}, about {fmtCalls(openMeteoUsage.hour.calls)} of{' '}
              {OPEN_METEO_FREE_LIMITS.hour.toLocaleString('en-US')}. Other browsers on the same address
              share those limits and are not counted here. UTC days.
            </p>
            <details className="om-usage-days">
              <summary className="muted small">By UTC day, the last {USAGE_KEEP_DAYS} days</summary>
              <table className="om-usage-table">
                <thead>
                  <tr>
                    <th scope="col">UTC day</th>
                    <th scope="col">Requests</th>
                    <th scope="col">Calls</th>
                  </tr>
                </thead>
                <tbody>
                  {openMeteoUsage.days.map((d) => (
                    <tr key={d.day}>
                      <td>{d.day}</td>
                      <td>{d.requests}</td>
                      <td>{fmtCalls(d.calls)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        )}
      </>
    </Panel>
  );
}

function statusClass(s: SourceStatus): string {
  if (s.pending) return 'source pending';
  if (s.error) return 'source error';
  if (s.stale) return 'source stale';
  if (s.ok) return 'source ok';
  return 'source idle';
}
