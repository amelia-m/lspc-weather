import type { ReactNode } from 'react';
import type { DataSource } from '../../config/sources';

export function Panel({
  title,
  subtitle,
  sources,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Data source(s) for this card; rendered as a linked "Data:" footer. */
  sources?: DataSource[];
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>{title}</h2>
        {subtitle && <span className="panel-sub">{subtitle}</span>}
      </header>
      <div className="panel-body">{children}</div>
      {sources && sources.length > 0 && (
        <footer className="panel-sources">
          Data:{' '}
          {sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            </span>
          ))}
        </footer>
      )}
    </section>
  );
}
