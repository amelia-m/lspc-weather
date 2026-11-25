import { REPO_URL } from '../config/site';

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

/**
 * The pages behind the dashboard, each with the line that says what it is.
 * The footer lists the names; `#about` lists them with their lines (the
 * maintainer, 2026-11-25: the footer "is getting huge. list the links, but
 * move much of the prose to the other pages"; she chose names in the footer
 * and a small About page). One list, so a page added here is on both.
 */
export interface SitePage {
  label: string;
  href: string;
  /** What the page is, in a line: printed on `#about`, not in the footer. */
  about: string;
  /** Off the site, so it opens in a new tab. */
  external?: boolean;
}

export const SITE_PAGES: readonly SitePage[] = [
  { label: 'Citations to verify', href: '#citations', about: 'what this dashboard claims, and what nobody has checked yet.' },
  {
    label: 'How different from other sources',
    href: '#parity',
    about: 'the winds table against Mark Schulze’s and the observation against usairnet’s, from the comparison logs.',
  },
  {
    label: 'How far the wind forecasts were from KPMV',
    href: '#wind-errors',
    about: 'forecast minus reported surface wind, NWS and Open-Meteo, as histograms.',
  },
  {
    label: 'How the winds aloft table is built',
    href: '#winds-method',
    about: 'its levels, its Surface row, and how it compares with Mark Schulze’s tool.',
  },
  // A static page beside the app (public/ceiling-errors/), not a route: it
  // reads its own data file and draws its own charts.
  {
    label: 'Ceiling forecast errors',
    href: CEILING_ERRORS_URL,
    about: 'the NWS forecast ceiling, and the rain and thunder chances, against KPMV’s reports, hour by hour.',
  },
  {
    label: 'How this was built',
    href: TALK_URL,
    about: 'a short talk on the project’s development with AI agents, with every claim traced to the repository.',
  },
  { label: 'Source on GitHub', href: REPO_URL, about: 'the code, the citations’ readings, and the open questions.', external: true },
];
