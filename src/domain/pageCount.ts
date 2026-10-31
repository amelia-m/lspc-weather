/**
 * Page counts for GoatCounter, decided and addressed without GoatCounter's
 * script (docs/page-counts.md).
 *
 * Its count.js would need an inline `window.goatcounter = {...}` block to
 * count the dashboard's `#` pages, and this app's policy refuses inline
 * scripts; loading it at all would also be the one third-party script the
 * app runs. GoatCounter documents its /count endpoint as safe to call from
 * an integration of one's own, with stable query parameters, so the app
 * sends that request as an image instead. What count.js decides in the
 * browser is reproduced here, from its source read on 2026-10-31
 * (github.com/arp242/goatcounter, public/count.js), with the differences
 * noted on `countSkipReason`.
 */

/** What the browser says about the page at the moment of counting. */
export interface CountContext {
  hostname: string;
  /** The page is inside a frame or iframe. */
  inFrame: boolean;
  /** document.visibilityState, where the browser has it. */
  visibility: string | undefined;
  /** navigator.webdriver: the browser is driven by automation. */
  webdriver: boolean;
  /** localStorage `skipgc` is 't': the reader opted out. */
  optedOut: boolean;
}

export type CountSkipReason = 'prerender' | 'frame' | 'other-host' | 'opted-out' | 'automated';

/**
 * Why this view should not be counted, or null to count it, on the site
 * whose host is `siteHost`. count.js's filters in its order, with two
 * differences.
 *
 * `other-host` stands where count.js has its list of local addresses and
 * its file check. Counting only on the deployed site's host covers those
 * (a dev server, a preview by any name or address, a file opened from
 * disk) and also a fork deployed elsewhere, which would count into the
 * maintainer's account under the same paths.
 *
 * `opted-out` is GoatCounter's own switch. Loading any amelia-m.github.io
 * page that runs count.js with `#toggle-goatcounter` sets `skipgc` in that
 * origin's storage, and the dashboard is served from the same origin, so a
 * browser opted out on the personal site is opted out here too.
 *
 * `automated` is the other. count.js still sends a headless browser's
 * view, flagged as a bot for the server to discard; this sends nothing. The
 * live-site workflow loads every page at three widths every day under
 * Playwright, which sets navigator.webdriver, and those loads are not
 * readers.
 */
export function countSkipReason(c: CountContext, siteHost: string): CountSkipReason | null {
  if (c.visibility === 'prerender') return 'prerender';
  if (c.inFrame) return 'frame';
  if (c.hostname !== siteHost) return 'other-host';
  if (c.optedOut) return 'opted-out';
  if (c.webdriver) return 'automated';
  return null;
}

/** The hash that toggles GoatCounter's opt-out, as count.js reads it. */
export const TOGGLE_HASH = '#toggle-goatcounter';

/**
 * The path a view is counted under: the page's path, plus the `#` page
 * when it is not the Jumpers tab. Without the hash every view would count
 * as /lspc-weather/, since a `#` page is one document to the browser.
 */
export function countedPath(pathname: string, route: string | null): string {
  return route ? `${pathname}#${route}` : pathname;
}

export interface CountData {
  path: string;
  title: string;
  /** Where the reader came from: document.referrer on the first view of a
   *  visit, empty after, since a later `#` page was reached from this one. */
  referrer: string;
  /** location.search, where campaign tags such as ?utm_source= arrive. */
  query: string;
  screenWidth: number;
}

/**
 * The /count URL for one view. Parameter names are GoatCounter's (p, t, r,
 * q, s, rnd: www.goatcounter.com/help/pixel, read 2026-10-31); like
 * count.js, an empty value is left out, and `rnd` is a cache buster the
 * server ignores.
 */
export function countUrl(endpoint: string, d: CountData, rnd: string): string {
  const params: [string, string][] = [
    ['p', d.path],
    ['r', d.referrer],
    ['t', d.title],
    ['s', String(d.screenWidth)],
    ['q', d.query],
    ['rnd', rnd],
  ];
  const query = params
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${endpoint}?${query}`;
}
