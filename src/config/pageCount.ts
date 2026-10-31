/**
 * Where the dashboard's page views are counted: the maintainer's
 * GoatCounter site, the same `amelia-m` account as her personal site at
 * amelia-m.github.io, so the dashboard's views sit in that one dashboard
 * under /lspc-weather/ (docs/page-counts.md). Null turns counting off.
 *
 * The build's Content-Security-Policy names this URL in img-src
 * (vite.config.ts), since the count is sent as an image request; a test
 * holds the two to each other. vite.config.ts does not import this file,
 * so the policy reads as one plain list there.
 */
export const PAGE_COUNT_ENDPOINT: string | null = 'https://amelia-m.goatcounter.com/count';
