import type { ReactNode } from 'react';

/**
 * "How to read this": the fold for a key to a table (the maintainer,
 * 2026-11-25, of the keys the fold triage left to her: "Fold as described").
 * A key says what the columns, marks and words mean; it is not analysis, so
 * it does not go under "Stats for nerds" (NerdStats), and a card may have
 * one of each. The Hourly wind card's key was already folded this way.
 *
 * As with that fold, a caveat does not go in: "a description of the
 * weather and not a jump rule" and a TAF's "Not decoded" stay in view
 * beside the tables they qualify.
 */
export function ReadingKey({ children }: { children: ReactNode }): JSX.Element {
  return (
    <details className="reading-key">
      <summary className="small">How to read this</summary>
      {children}
    </details>
  );
}
