import type { ReactNode } from 'react';
import { SIM_GLOSSARY, SIM_GLOSSARY_READ, glossaryUrl, type GlossaryKey, type TermSegment } from '../../config/simGlossary';

/**
 * A word in a card's prose linked to its entry in the USPA SIM glossary
 * (src/config/simGlossary.ts), so a jumper can read USPA's own definition.
 *
 * The rule the cards follow: a term is linked at most once per card, at its
 * first use in the card's prose. Labels, table headers, readouts, input
 * prompts, the unit of a sourced figure ("3,000 ft AGL"), text that is
 * already a link, and the notes that describe a gap in this report's data
 * stay plain, and so does a term in a flag or note that already cites the
 * document it names (`linkableTerms`), or names it as the source of a figure
 * the card cites (the drift card's "the BSR minimum"). The link lands on the glossary's
 * letter heading (the page has no anchor per term), which the title says
 * along with the day the glossary was read. Styled apart from the citation
 * links (app.css, `a.sim-term`): a definition is not a source for the
 * figure beside it. External, so it opens in a new tab.
 */
export function SimTerm({ term, children }: { term: GlossaryKey; children: ReactNode }): JSX.Element {
  const { term: name, letter } = SIM_GLOSSARY[term];
  return (
    <a
      className="sim-term"
      href={glossaryUrl(term)}
      target="_blank"
      rel="noopener noreferrer"
      title={`USPA SIM glossary definition (letter ${letter}; glossary read ${SIM_GLOSSARY_READ}): ${name}`}
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
