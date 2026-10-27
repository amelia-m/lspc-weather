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
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://amelia-m.github.io',
  // `npm run dev` and `vite preview`, for a check before a deploy.
  'http://localhost:5173',
  'http://localhost:4173',
];
