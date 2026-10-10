import type { Advisory } from '../domain/types';
import { Panel } from './common/Panel';
import { SourceLinks } from './common/SourceLinks';
import { SourceLink } from './common/SourceLink';
import { SimTerm, SimTermSegments } from './common/SimTerm';
import { DATA_SOURCES } from '../config/sources';
import { GLOSSARY_KEYS, citesTerm, splitGlossaryTermsAcross } from '../config/simGlossary';

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
 * `hasWindLimit` are for. On a profile with no wind limit, published or the
 * reader's own (licensed with none set), no surface-wind flag can reach this
 * list at ANY sustained speed, so "no
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
  hasWindLimit,
  editedLimits = [],
  ownLimits = [],
  forPilots = false,
}: {
  advisories: Advisory[];
  /** Active wind-limit profile, as shown on the header control ("Licensed"). */
  profile: string;
  /** Whether the profile has a surface-wind limit, published or the
   *  reader's own (`hasWindLimit` in thresholds.ts) — i.e. whether a
   *  surface-wind flag can appear in this list at all. */
  hasWindLimit: boolean;
  /** Names of the limits edited in Settings for this profile, if any. */
  editedLimits?: string[];
  /** Names of the reader's own limits set in Settings, where no source
   *  publishes one (Licensed). */
  ownLimits?: string[];
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
  // in it is linked at its first use in the list, not once per flag, and
  // never in a flag that already cites the document the term names (the
  // student wind flag's "BSR" sits beside its SIM 2-1 link).
  const guidance = splitGlossaryTermsAcross(
    advisories.map((a) => ({
      text: a.guidance,
      skip: GLOSSARY_KEYS.filter((k) => citesTerm(k, [a.citation, a.secondaryCitation])),
    })),
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
        {ownLimits.length > 0 && (
          <p className="advisory-edited muted small">
            <strong>Your own limits, from Settings:</strong> {ownLimits.join(', ')}. No published
            source sets them for this profile; the flags here fire at your figures.
            {/* A gust ceiling alone flags gusts and nothing else: said here,
                in either state of the list, or a steady wind with no gust
                group reads as covered beside any other flag. */}
            {!hasWindLimit &&
              ' You have set no wind limit, so the sustained wind is not flagged at any speed: read it on the Surface wind card.'}
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
            {/* With an own gust ceiling, the note above already says the
                steady wind goes unflagged. */}
            {!forPilots && !hasWindLimit && ownLimits.length === 0 && (
              <>
                Surface wind is never flagged on the {profile} profile unless you set your own wind
                limit in Settings — no published source sets one — so read the speed on the Surface
                wind card.{' '}
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
