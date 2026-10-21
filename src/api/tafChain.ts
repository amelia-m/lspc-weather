/**
 * The TAF station chain, apart from the fetching so that the sky-parity
 * script (scripts/skyParity.live.ts) runs the card's own rules with its own
 * requests: it imports this module alone, which reaches nothing but the
 * domain and so type-checks with the scripts.
 */
import { tafStanding } from '../domain/taf';
import type { TafForecast, TafPassedOver } from '../domain/types';

export interface TafStationRef {
  id: string;
  nwsProductLocation: string;
}

/** Injectable dependencies so the fallback logic is unit-testable. */
interface TafChainDeps {
  fetchOne: (station: string, productLocation: string) => Promise<TafForecast | null>;
  now?: () => number;
}

/**
 * Try each TAF station in preference order and return the first TAF still
 * in force (its `station` field says which one the card is showing). A
 * station yielding no product is normal (see fetchTaf, src/api/nws.ts) and
 * falls through; so does one whose latest TAF has ended or carries no
 * forecast (`tafStanding`). Each is recorded in `passedOver`, so the card
 * and Data health can say why they show a farther station. A TAF whose end cannot be read is kept: the
 * card prints its text either way. A fetch error also falls through so one
 * bad request doesn't blank the card, and is recorded in `passedOver` too:
 * a broken relay would otherwise show only as Omaha's TAF on a card and a
 * Data health row that both look fine. If nothing succeeded and ANY station
 * errored, the last error propagates — "KOFF has no product (as always) and
 * the rest failed" must read as a failure, not as "no TAF anywhere".
 */
export async function fetchTafChain(
  stations: readonly TafStationRef[],
  deps: TafChainDeps,
): Promise<TafForecast | null> {
  let lastErr: unknown = null;
  const passedOver: TafPassedOver[] = [];
  for (const s of stations) {
    try {
      const taf = await deps.fetchOne(s.id, s.nwsProductLocation);
      if (!taf) {
        passedOver.push({ station: s.id, none: true });
        continue;
      }
      const standing = tafStanding(taf.raw, taf.issuedMs, (deps.now ?? Date.now)());
      if (standing.state === 'ended') {
        passedOver.push({ station: taf.station, endedMs: standing.atMs });
        continue;
      }
      if (standing.state === 'no-forecast') {
        passedOver.push({ station: taf.station, noForecast: standing.word });
        continue;
      }
      return passedOver.length ? { ...taf, passedOver } : taf;
    } catch (err) {
      lastErr = err;
      // The status is read off the error rather than by its class: this
      // module stays free of src/api/http.ts so the scripts can import it.
      const status = (err as { status?: unknown })?.status;
      passedOver.push({
        station: s.id,
        failed: err instanceof Error ? err.message : String(err),
        ...(typeof status === 'number' ? { status } : {}),
      });
    }
  }
  if (lastErr) throw lastErr;
  return null;
}
