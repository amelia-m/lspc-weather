import type { SourceKey, SourceStatus } from '../domain/types';
import { USE_FIXTURES } from '../api/http';
import { fmtAgo } from './format';

const LABELS: Record<SourceKey, string> = {
  metar: 'METAR (KPMV)',
  nws: 'NWS forecast',
  windsAloft: 'Winds aloft',
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
  return (
    <section className="panel freshness">
      <header className="panel-head">
        <h2>Data health</h2>
        <button className="refresh-btn" onClick={onRefresh}>
          ↻ Refresh
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
              <span className="source-name">{LABELS[k]}</span>
              <span className="source-meta">
                {status[k].error
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
  if (s.error) return 'source error';
  if (s.stale) return 'source stale';
  if (s.ok) return 'source ok';
  return 'source idle';
}
