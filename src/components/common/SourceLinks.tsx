import type { DataSource } from '../../config/sources';

/** The links in a card's "Data:" footer, each followed by its licence where
 *  the source has one: CC BY asks for the licence link beside the data, not
 *  only somewhere on the page. */
export function SourceLinks({ sources }: { sources: DataSource[] }): JSX.Element {
  return (
    <>
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && ' · '}
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {s.label}
          </a>
          {s.licence && (
            <>
              {' ('}
              <a href={s.licence.url} target="_blank" rel="noopener noreferrer">
                {s.licence.label}
              </a>
              {')'}
            </>
          )}
        </span>
      ))}
    </>
  );
}
