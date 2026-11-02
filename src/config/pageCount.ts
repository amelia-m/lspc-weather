/**
 * Where the dashboard's page views are counted: a GoatCounter site of its
 * own, `lspc-weather`, on the maintainer's account (the maintainer,
 * 2026-11-02: apart from her personal site's, which the same account
 * counts under `amelia-m`, so the two never mix in one dashboard; until
 * then the views went to that site under /lspc-weather/ paths). Its
 * dashboard is https://lspc-weather.goatcounter.com (docs/page-counts.md).
 * Null turns counting off.
 *
 * The build's Content-Security-Policy names this URL in img-src
 * (vite.config.ts), since the count is sent as an image request; a test
 * holds the two to each other. vite.config.ts does not import this file,
 * so the policy reads as one plain list there.
 */
export const PAGE_COUNT_ENDPOINT: string | null = 'https://lspc-weather.goatcounter.com/count';

/** The one host whose views are counted: the deployed site. A fork of this
 *  public repository deployed to its own github.io, a preview and a dev
 *  server all have another host, and would otherwise count into the
 *  maintainer's account under the same paths. */
export const PAGE_COUNT_HOST = 'amelia-m.github.io';
