import type { ReactNode } from 'react';
import { SIM_GLOSSARY, glossaryUrl, type GlossaryKey, type TermSegment } from '../../config/simGlossary';

/**
 * A word in a card's prose linked to its entry in the USPA SIM glossary
 * (src/config/simGlossary.ts), so a jumper can read USPA's own definition.
 *
 * The rule the cards follow: a term is linked at most once per card, at its
 * first use in the card's prose. Labels, table headers, readouts, text that
 * is already a link, and the notes that describe a gap in this report's data
 * stay plain. The link lands on the glossary's letter heading (the page has
 * no anchor per term), which the title says. External, so it opens in a new
 * tab like the citation links.
 */
export function SimTerm({ term, children }: { term: GlossaryKey; children: ReactNode }): JSX.Element {
  const { term: name, letter } = SIM_GLOSSARY[term];
  return (
    <a
      className="sim-term"
      href={glossaryUrl(term)}
      target="_blank"
      rel="noopener noreferrer"
      title={`USPA SIM glossary, under ${letter}: ${name}`}
    >
      {children}
    </a>
  );
}

/** Segments from splitGlossaryTerms, with each term linked. */
export function SimTermSegments({ segments }: { segments: TermSegment[] }): JSX.Element {
  return (
    <>
      {segments.map((s, i) =>
        s.term ? (
          <SimTerm key={i} term={s.term}>
            {s.text}
          </SimTerm>
        ) : (
          s.text
        ),
      )}
    </>
  );
}
