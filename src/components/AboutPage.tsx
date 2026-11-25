import { SITE_PAGES } from './sitePages';
import { PageLink } from './AppFooter';
import { OpenMeteoCredit } from './OpenMeteoCredit';
import { Panel } from './common/Panel';

/**
 * About this site (`#about`, since 2026-11-25): what belongs to no one card
 * or page. The maintainer, that day, of the dashboard's footer: "this block
 * is getting huge", and of the three options put to her, names only in the
 * footer and a small About page. So this page holds the full statement of
 * Open-Meteo's credit and what the dashboard changes in its data, the line
 * that says what each page behind the dashboard is, and who makes the site
 * and how. Nothing here is a limit or a reading of the weather.
 */
export function AboutPage(): JSX.Element {
  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>About this site</h1>
          <p className="app-sub">
            Where the data come from, the pages behind the dashboard, and who makes it ·{' '}
            <a href="#">back to the dashboard</a>
          </p>
        </div>
      </header>

      <Panel title="Where the data come from">
        <p className="muted small">
          Observations: Iowa Environmental Mesonet and NWS / NOAA (api.weather.gov). Each card names its own
          sources in its Data line.
        </p>
        <p className="muted small">
          <OpenMeteoCredit scope="dashboard" />
        </p>
      </Panel>

      <Panel title="The pages behind the dashboard">
        <ul className="about-pages">
          {SITE_PAGES.map((page) => (
            <li key={page.href}>
              <PageLink page={page} />
              <span className="muted small">: {page.about}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Who makes it, and how">
        <p className="muted small">
          Nearly all of this site was written by AI coding agents (Anthropic&rsquo;s Claude Code) at the
          maintainer&rsquo;s direction. She sets what it should do, decides what ships, and supplies the facts
          about the drop zone, which the cards date and attribute to her. The cited rules were read at their
          sources by the agents; no instructor or other licensed professional has reviewed them, and the{' '}
          <a href="#citations">citations page</a> asks one to.
        </p>
      </Panel>
    </div>
  );
}
