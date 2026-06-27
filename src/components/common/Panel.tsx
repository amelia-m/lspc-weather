import type { ReactNode } from 'react';

export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>{title}</h2>
        {subtitle && <span className="panel-sub">{subtitle}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
