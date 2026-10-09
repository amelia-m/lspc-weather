import type { Advisory } from '../domain/types';
import { Panel } from './common/Panel';
import { SourceLinks } from './common/SourceLinks';
import { SourceLink } from './common/SourceLink';
import { SimTerm, SimTermSegments } from './common/SimTerm';
import { DATA_SOURCES } from '../config/sources';
import { GLOSSARY_KEYS, splitGlossaryTermsAcross } from '../config/simGlossary';

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
 *
 * Edited limits get the same treatment, in either state. A flag fires on the
 * figure in Settings, so with a limit raised there this list can be empty
 * while a published one is crossed, and the "(edited)" marks sit on the cards
 * further down. The list says which it is using.
 *
 * On the Pilots tab (`forPilots`) the jumper ground-wind flags are left out
 * (`advisoriesFor`), and the list says so in either state: without it, a
 * pilot reading an empty list, or one with only a visibility flag, could take
 * the wind as having been checked.
 */
export function AdvisoryPanel({
  advisories,
  profile,
  hasSourcedWindLimit,
  editedLimits = [],
  forPilots = false,
}: {
  advisories: Advisory[];
  /** Active wind-limit profile, as shown on the header control ("Licensed"). */
  profile: string;
  /** Whether a published source sets a surface-wind limit for that profile —
   *  i.e. whether a surface-wind flag can appear in this list at all. */
  hasSourcedWindLimit: boolean;
  /** Names of the limits edited in Settings for this profile, if any. */
  editedLimits?: string[];
  /** The Pilots tab's list: no jumper ground-wind flags, and published
   *  figures only (no Settings on that tab, so no edits to report). */
  forPilots?: boolean;
}): JSX.Element {
  // Only what evaluateAdvisories reads: the observation and the computed
  // sun times. It listed the NWS forecast and Open-Meteo too, which no flag
  // reads, and now that a licence link rides on Open-Meteo that would credit
  // forecast data as the flags' source.
  const footer = (
    <>
      Flag values from:{' '}
      <SourceLinks
        sources={[DATA_SOURCES.iemObservation, DATA_SOURCES.nwsObservation, DATA_SOURCES.computed]}
      />
      . Guidance sources are linked on each flag above.
    </>
  );
  // Each flag's guidance is a plain string from the domain; a glossary term
  // in it is linked at its first use in the list, not once per flag.
  const guidance = splitGlossaryTermsAcross(
    advisories.map((a) => a.guidance),
    GLOSSARY_KEYS,
  );
  return (
    <Panel
      className="advisory-panel"
      title="Conditions to note"
      subtitle="Flags only — not a go/no-go call. You decide."
      footer={footer}
    >
      <>
        {editedLimits.length > 0 && (
          <p className="advisory-edited muted small">
            <strong>Edited in Settings:</strong> {editedLimits.join(', ')}. The flags here fire at
            the edited figures, not the published ones, so a published limit can be crossed with
            nothing listed. Settings shows the published figure beside each edited one.
          </p>
        )}
        {forPilots && (
          <p className="advisory-edited muted small">
            <strong>Jumper wind limits are not flagged here.</strong> The ground-wind limits for
            students and the club waiver are on the Jumpers tab; the observed wind is on the Current
            conditions card.
          </p>
        )}
        {advisories.length === 0 ? (
          <p className="advisory-empty">
            No conditions flagged from the available data.{' '}
            {!forPilots && !hasSourcedWindLimit && (
              <>
                Surface wind is never flagged on the {profile} profile — no published source sets
                a wind limit for it — so read the speed on the Surface wind card.{' '}
              </>
            )}
            {forPilots ? (
              'This is not clearance to fly the load: the pilot in command decides.'
            ) : (
              <>
                This is not clearance to jump — confirm winds, clouds, and the spot yourself and with
                the <SimTerm term="sta">S&amp;TA</SimTerm>.
              </>
            )}
          </p>
        ) : (
          <ul className="advisory-list">
            {advisories.map((a, i) => (
              <li key={a.id} className={`advisory advisory-${a.level}`}>
                <div className="advisory-top">
                  <span className={`advisory-badge badge-${a.level}`}>{LEVEL_LABEL[a.level]}</span>
                  <span className="advisory-metric">{a.metric}</span>
                  <span className="advisory-value">{a.value}</span>
                </div>
                <p className="advisory-guidance">
                  <SimTermSegments segments={guidance[i]} />
                </p>
                <div className="advisory-cite">
                  {a.secondaryCitation ? 'Sources: ' : 'Source: '}
                  <SourceLink citation={a.citation} />
                  {a.secondaryCitation && (
                    <>
                      {' · '}
                      <SourceLink citation={a.secondaryCitation} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </>
    </Panel>
  );
}
