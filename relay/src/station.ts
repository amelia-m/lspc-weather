/** The one station the relay serves, and the path it serves it on. A file
 *  of its own, with no Worker types, so the app's config can import it
 *  (src/config/tafRelay.ts) without pulling the Worker into the app's build
 *  or the scripts' type-check. */
export const STATION = 'KOFF';
export const PATH = `/taf/${STATION}`;
