import type { Advisory } from '../domain/types';
import { SourceLink } from './common/SourceLink';
import { DATA_SOURCES } from '../config/sources';

const LEVEL_LABEL: Record<Advisory['level'], string> = {
  caution: 'Caution',
  watch: 'Watch',
  info: 'Note',
};

/**
 * "Conditions to note" — the headline panel. It lists flagged conditions with
 * the value and its source. It deliberately renders NO overall go/no-go
 * verdict: the jumper / S&TA / PIC decides.
 */
export function AdvisoryPanel({ advisories }: { advisories: Advisory[] }): JSX.Element {
  return (
    <section className="panel advisory-panel">
      <header className="panel-head">
        <h2>Conditions to note</h2>
        <span className="panel-sub">Flags only — not a go/no-go call. You decide.</span>
      </header>
      <div className="panel-body">
        {advisories.length === 0 ? (
          <p className="advisory-empty">
            No conditions flagged from the available data. This is not clearance to jump —
            confirm winds, clouds, and the spot yourself and with the S&amp;TA.
          </p>
        ) : (
          <ul className="advisory-list">
            {advisories.map((a) => (
              <li key={a.id} className={`advisory advisory-${a.level}`}>
                <div className="advisory-top">
                  <span className={`advisory-badge badge-${a.level}`}>{LEVEL_LABEL[a.level]}</span>
                  <span className="advisory-metric">{a.metric}</span>
                  <span className="advisory-value">{a.value}</span>
                </div>
                <p className="advisory-guidance">{a.guidance}</p>
                <div className="advisory-cite">
                  Source: <SourceLink citation={a.citation} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <footer className="panel-sources">
        Flag values from:{' '}
        {[DATA_SOURCES.nwsObservation, DATA_SOURCES.nwsForecast, DATA_SOURCES.openMeteo].map(
          (s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            </span>
          ),
        )}
        . Guidance sources are linked on each flag above.
      </footer>
    </section>
  );
}
