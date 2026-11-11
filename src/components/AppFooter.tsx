import { REPO_URL } from '../config/site';
import { OpenMeteoCredit } from './OpenMeteoCredit';

/** The ceiling-error charts' page, served from public/ceiling-errors/. By
 *  its file, not its folder: Pages serves the folder's index.html, but the
 *  dev server answers the folder with the dashboard itself. The page fetches
 *  its data file relative to this. */
export const CEILING_ERRORS_URL = `${import.meta.env.BASE_URL}ceiling-errors/index.html`;

/** The talk on how this dashboard was built, served from public/talk/: a
 *  reveal.js deck rendered by scripts/renderTalk.sh from
 *  docs/talks/lincoln-ai-meetup/talk.qmd (the maintainer, 2026-11-11: a
 *  page linked at the bottom of the main dashboard). By its file, as the
 *  ceiling page is. */
export const TALK_URL = `${import.meta.env.BASE_URL}talk/index.html`;

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
      <a href="#wind-errors">How far the wind forecasts were from KPMV</a> — forecast minus reported
      surface wind, NWS and Open-Meteo, as histograms.
      <br />
      {/* A static page beside the app (public/ceiling-errors/), not a route:
          it reads its own data file and draws its own charts. */}
      <a href={CEILING_ERRORS_URL}>Ceiling forecast errors</a> — the NWS forecast ceiling, and the
      rain and thunder chances, against KPMV&rsquo;s reports, hour by hour.
      <br />
      <a href={TALK_URL}>How this was built</a> — a short talk on the project&rsquo;s development
      with AI agents, with every claim traced to the repository.
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
