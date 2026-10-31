/** localStorage behind try/catch: it throws in private windows, with
 *  cleared or blocked site data, and over quota, and every reader here has
 *  to degrade to "nothing stored" rather than fail. One copy for the grid
 *  cache (nws.ts), the source log (sourceLog.ts) and the Open-Meteo usage
 *  records (openMeteoUsage.ts), which each carried their own until
 *  2026-10-31. */
export function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — ignore */
  }
}
export function safeLocalRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode / unavailable — ignore */
  }
}
