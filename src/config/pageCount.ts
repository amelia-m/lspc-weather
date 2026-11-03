/**
 * Where the dashboard's page views are counted: the maintainer's
 * GoatCounter site `amelia-m`, the same one her personal site counts to,
 * so the dashboard's views sit in that one dashboard under /lspc-weather/
 * paths, which its path filter tells from the personal site's (they start
 * `/`). On 2026-11-02 this pointed at a site of its own, `lspc-weather`,
 * which did not exist on the account: its root page answered "error 400:
 * no site at this domain" (the maintainer's browser, 2026-11-03; the count
 * endpoint presumed the same), and a day's views were counted nowhere.
 * Back here since
 * 2026-11-03; a site of its own is one line to change if one is made
 * (docs/page-counts.md). Null turns counting off.
 *
 * The build's Content-Security-Policy names this URL in img-src
 * (vite.config.ts), since the count is sent as an image request; a test
 * holds the two to each other. vite.config.ts does not import this file,
 * so the policy reads as one plain list there.
 */
export const PAGE_COUNT_ENDPOINT: string | null = 'https://amelia-m.goatcounter.com/count';

/** The one host whose views are counted: the deployed site. A fork of this
 *  public repository deployed to its own github.io, a preview and a dev
 *  server all have another host, and would otherwise count into the
 *  maintainer's account under the same paths. */
export const PAGE_COUNT_HOST = 'amelia-m.github.io';
