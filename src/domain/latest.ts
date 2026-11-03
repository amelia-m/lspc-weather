/**
 * Whether a refresh's result for a source may be applied: it is at least
 * as new as the refresh that last settled that source, success or
 * failure. The hook refreshes every source
 * on its timer, on the tab's return and on the Refresh button, each a full
 * round of requests whether or not one is in flight, and a winds request
 * can take a minute (20 s, three attempts). Without this, whichever answer
 * lands last wins, an earlier request's included: the step-back
 * docs/nws-gridpoint-age.md was written to stop, for the sources that
 * have no dedupe of their own (`fetchFreshGrid` has one). Pure: the
 * applied sequence per source comes in, the caller records the new one.
 */
export function isLatest(applied: Readonly<Record<string, number | undefined>>, key: string, seq: number): boolean {
  return seq >= (applied[key] ?? 0);
}
