import { SITE_PAGES, type SitePage } from './sitePages';
import { OpenMeteoCredit } from './OpenMeteoCredit';

export function PageLink({ page }: { page: SitePage }): JSX.Element {
  return page.external ? (
    <a href={page.href} target="_blank" rel="noopener noreferrer">
      {page.label}
    </a>
  ) : (
    <a href={page.href}>{page.label}</a>
  );
}

/** The dashboard's footer: where the data come from, with Open-Meteo's
 *  credit, its licence and the fact that its data are reworked here (the
 *  fuller statement is on `#about`); the names of the pages behind the
 *  dashboard; and a sign-off. Short on purpose: a page's description is on
 *  the page and on `#about`, not here. */
export function AppFooter(): JSX.Element {
  return (
    <footer className="app-foot">
      Data: Iowa Environmental Mesonet and NWS / NOAA (api.weather.gov). <OpenMeteoCredit scope="footer" />
      <nav className="app-foot-links" aria-label="More about this site">
        <a href="#about">About this site</a>
        {SITE_PAGES.map((page) => (
          <PageLink key={page.href} page={page} />
        ))}
      </nav>
      {/* On its own line, last: it is a sign-off, not part of the account
          of where the data come from. */}
      Built for fun. Fly safe.
    </footer>
  );
}
