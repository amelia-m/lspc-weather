import { REPO_URL } from '../config/site';
import { OpenMeteoCredit } from './OpenMeteoCredit';

/** The ceiling-error charts' page, served from public/ceiling-errors/. The
 *  trailing slash matters: the page fetches its data file relative to it. */
export const CEILING_ERRORS_URL = `${import.meta.env.BASE_URL}ceiling-errors/`;

/** The dashboard's footer: where the data come from, Open-Meteo's licence
 *  credit, the pages behind the dashboard, and a sign-off. */
export function AppFooter(): JSX.Element {
  return (
    <footer className="app-foot">
      Data: Iowa Environmental Mesonet and NWS / NOAA (api.weather.gov). <OpenMeteoCredit scope="dashboard" />
      <br />
      <a href="#citations">Citations to verify</a> — what this dashboard claims, and what nobody
      has checked yet.
      <br />
      <a href="#parity">How different from other sources</a> — the winds table against Mark
      Schulze&rsquo;s and the observation against usairnet&rsquo;s, from the comparison logs.
      <br />
      {/* A static page beside the app (public/ceiling-errors/), not a route:
          it reads its own data file and draws its own charts. */}
      <a href={CEILING_ERRORS_URL}>Ceiling forecast errors</a> — the NWS forecast ceiling against
      KPMV&rsquo;s reports, hour by hour.
      <br />
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
        Source on GitHub
      </a>{' '}
      — the code, the citations&rsquo; readings, and the open questions.
      {/* On its own line, last: it is a sign-off, not part of the account
          of where the data come from. */}
      <br />
      Built for fun — fly safe.
    </footer>
  );
}
