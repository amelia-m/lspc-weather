import type { SourceKey, SourceStatus } from '../domain/types';
import { USE_FIXTURES } from '../api/http';
import { DATA_SOURCES, type DataSource } from '../config/sources';
import { fmtAgo } from './format';

const LABELS: Record<SourceKey, string> = {
  metar: 'METAR (KPMV)',
  nws: 'NWS forecast',
  windsAloft: 'Winds aloft',
  taf: 'TAF',
  daily: '10-day outlook',
};

const SOURCE_LINKS: Record<SourceKey, DataSource> = {
  metar: DATA_SOURCES.nwsObservation,
  nws: DATA_SOURCES.nwsForecast,
  windsAloft: DATA_SOURCES.openMeteo,
  taf: DATA_SOURCES.taf,
  daily: DATA_SOURCES.openMeteo,
};

export function DataFreshness({
  status,
  lastUpdated,
  onRefresh,
}: {
  status: Record<SourceKey, SourceStatus>;
  lastUpdated: number | null;
  onRefresh: () => void;
}): JSX.Element {
  const refreshing = Object.values(status).some((s) => s.pending);
  return (
    <section className="panel freshness">
      <header className="panel-head">
        <h2>Data health</h2>
        <button className="refresh-btn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
        </button>
      </header>
      <div className="panel-body">
        {USE_FIXTURES && (
          <p className="fixtures-banner">
            Showing <strong>sample data</strong> (offline / dev mode), not live weather.
          </p>
        )}
        <ul className="source-list">
          {(Object.keys(LABELS) as SourceKey[]).map((k) => (
            <li key={k} className={statusClass(status[k])}>
              <span className="source-dot" aria-hidden />
              <span className="source-name">
                <a href={SOURCE_LINKS[k].url} target="_blank" rel="noopener noreferrer">
                  {LABELS[k]}
                </a>
              </span>
              <span className="source-meta">
                {status[k].pending
                  ? 'fetching…'
                  : status[k].error
                    ? `error: ${status[k].error}`
                    : status[k].stale
                      ? 'stale'
                      : fmtAgo(status[k].fetchedAt)}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted small">Updated {fmtAgo(lastUpdated)}.</p>
      </div>
    </section>
  );
}

function statusClass(s: SourceStatus): string {
  if (s.pending) return 'source pending';
  if (s.error) return 'source error';
  if (s.stale) return 'source stale';
  if (s.ok) return 'source ok';
  return 'source idle';
}
