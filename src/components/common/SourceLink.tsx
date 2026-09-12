import type { Citation } from '../../domain/types';

/** Renders a citation as a link with an optional verify caveat.
 *
 *  External sources open in a new tab so a jumper checking a rule does not lose
 *  the dashboard. In-app citations (the `#citations` review page) are the
 *  opposite case: a new tab would leave a second copy of the whole app running,
 *  and the reader wants to come straight back — so those navigate in place. */
export function SourceLink({ citation }: { citation: Citation }): JSX.Element {
  const inApp = citation.url.startsWith('#');
  return (
    <span className="source-link" title={citation.note ?? citation.ref}>
      <a
        href={citation.url}
        {...(inApp ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      >
        {citation.source}
      </a>
      {citation.note && <span className="source-note" aria-label={citation.note}> ⓘ</span>}
    </span>
  );
}
