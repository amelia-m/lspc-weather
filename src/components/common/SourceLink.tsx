import type { Citation } from '../../domain/types';

/** Renders a citation as an external link with an optional verify caveat. */
export function SourceLink({ citation }: { citation: Citation }): JSX.Element {
  return (
    <span className="source-link" title={citation.note ?? citation.ref}>
      <a href={citation.url} target="_blank" rel="noopener noreferrer">
        {citation.source}
      </a>
      {citation.note && <span className="source-note" aria-label={citation.note}> ⓘ</span>}
    </span>
  );
}
