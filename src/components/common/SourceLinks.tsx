import type { DataSource } from '../../config/sources';

/** The links in a card's "Data:" footer, each followed by its licence where
 *  the source has one: CC BY asks for the licence link beside the data, not
 *  only somewhere on the page. */
export function SourceLinks({ sources }: { sources: DataSource[] }): JSX.Element {
  return (
    <>
      {sources.map((s, i) => (
        // Not the URL alone: two sources can share one (the NBM's hourly
        // and three-hourly bulletins both link MDL's text-bulletin page,
        // and the Ceiling & sky card lists both), and React needs each
        // child's key unique to keep them apart across an update.
        <span key={`${s.label}|${s.url}`}>
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
