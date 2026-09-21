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
 *
 * The empty state is profile-aware, which is what `profile` and
 * `hasSourcedWindLimit` are for. On a profile with no published wind limit
 * (licensed) no surface-wind flag can reach this list at ANY speed, so "no
 * conditions flagged" on its own is a true statement about the app that reads
 * as a statement about the weather — an all-clear in a 60 kt gust. Naming the
 * gap costs one clause and sends the reader to the card that does print the
 * number. It is not a verdict in the other direction either: an empty list
 * still is not a stop, just a list that cannot cover wind here.
 */
export function AdvisoryPanel({
  advisories,
  profile,
  hasSourcedWindLimit,
}: {
  advisories: Advisory[];
  /** Active wind-limit profile, as shown on the header control ("Licensed"). */
  profile: string;
  /** Whether a published source sets a surface-wind limit for that profile —
   *  i.e. whether a surface-wind flag can appear in this list at all. */
  hasSourcedWindLimit: boolean;
}): JSX.Element {
  return (
    <section className="panel advisory-panel">
      <header className="panel-head">
        <h2>Conditions to note</h2>
        <span className="panel-sub">Flags only — not a go/no-go call. You decide.</span>
      </header>
      <div className="panel-body">
        {advisories.length === 0 ? (
          <p className="advisory-empty">
            No conditions flagged from the available data.{' '}
            {!hasSourcedWindLimit && (
              <>
                Surface wind is never flagged on the {profile} profile — no published source sets
                a wind limit for it — so read the speed on the Surface wind card.{' '}
              </>
            )}
            This is not clearance to jump — confirm winds, clouds, and the spot yourself and with
            the S&amp;TA.
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
