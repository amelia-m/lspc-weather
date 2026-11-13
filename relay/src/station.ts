/** The one station the relay serves, the path it serves it on, and the
 *  origins it answers. A file of its own, with no Worker types, so the app's
 *  config and the live-site check can import it without pulling the Worker
 *  into the app's build or the scripts' type-check. */
export const STATION = 'KOFF';
export const PATH = `/taf/${STATION}`;
/** The second thing the relay serves, on its own path: the NBM's hourly
 *  bulletin for the METAR station, cut from NOAA's bucket (nbm.ts). */
export const NBM_STATION = 'KPMV';
export const NBM_PATH = `/nbm/${NBM_STATION}`;
/** The third: the NBM's three-hourly bulletin (NBS, 6 to 72 hours ahead)
 *  for the same station, the one usairnet's three-day table reads, on a
 *  path under the hourly one's (since 2026-11-12, the maintainer's ask). */
export const NBS_PATH = `${NBM_PATH}/nbs`;
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://amelia-m.github.io',
  // `npm run dev` and `vite preview`, for a check before a deploy.
  'http://localhost:5173',
  'http://localhost:4173',
];
