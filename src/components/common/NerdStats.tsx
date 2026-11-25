import type { ReactNode } from 'react';

/**
 * "Stats for nerds": the fold at the foot of a card for what a reader can
 * skip and still read the card right (the maintainer, 2026-11-25: the cards
 * were "super wordy"; "important warnings stay out. details on data-source
 * comparisons get hidden"; and of the name, "this is a fun project and
 * skydivers are generally unserious except when it comes to safety").
 *
 * What may go in: how one data source compared with another, and how a
 * figure is worked out. What may not, since most readers never open a
 * fold: a warning or a caveat that changes how a figure is read or acted
 * on, a limit and its source, what a report cannot show, a standing note
 * that replaced a removed flag, a dated fact about the drop zone a figure
 * rests on, and a data credit. docs/card-fold-triage-2026-11-25.md has the
 * card-by-card reading.
 *
 * One per card, closed by default, the same words on every card. Native
 * `<details>`: the text stays in the page, for find-in-page and the tests.
 */
export function NerdStats({ children }: { children: ReactNode }): JSX.Element {
  return (
    <details className="nerd-stats">
      <summary className="small">Stats for nerds</summary>
      {children}
    </details>
  );
}
