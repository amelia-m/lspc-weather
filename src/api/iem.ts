import { fetchJson, USE_FIXTURES } from './http';
import { fetchLatestObservation } from './nws';
import { chooseObservation, normalizeIemCurrent, type RawIemCurrents } from '../domain/iem';
import type { CurrentConditions } from '../domain/types';
import { IEM_CURRENT_FIXTURE } from './fixtures/iemCurrent';

export const IEM_BASE = import.meta.env.VITE_IEM_BASE ?? 'https://mesonet.agron.iastate.edu';

/** The Iowa Environmental Mesonet's current observation for a station, or
 *  null when it answered without one. */
export async function fetchIemCurrent(
  iemId: string,
  network: string,
  stationId: string,
): Promise<CurrentConditions | null> {
  const data = USE_FIXTURES
    ? IEM_CURRENT_FIXTURE
    : await fetchJson<RawIemCurrents>(
        `${IEM_BASE}/api/1/currents.json?station=${encodeURIComponent(iemId)}&network=${encodeURIComponent(network)}`,
      );
  const rec = data?.data?.find((r) => r.station === iemId) ?? data?.data?.[0];
  return rec ? normalizeIemCurrent(rec, stationId) : null;
}

export interface ObservationResult {
  current: CurrentConditions;
  /** When the feed that was not shown had its report taken; null when it
   *  failed or answered nothing. */
  otherObservedAt: number | null;
  /** Why a feed contributed nothing, for the source log. */
  iemError: unknown;
  nwsError: unknown;
}

/** The two fetches, injectable so the choice and its failure handling can be
 *  tested without the network (tests run in fixture mode). */
interface ObservationDeps {
  iem: (iemId: string, network: string, stationId: string) => Promise<CurrentConditions | null>;
  nws: (stationId: string) => Promise<CurrentConditions | null>;
}

const defaultObservationDeps: ObservationDeps = { iem: fetchIemCurrent, nws: fetchLatestObservation };

/**
 * Both feeds at once, the newer report shown (see chooseObservation). Rejects
 * only when neither has a report, so the card keeps its last one and Data
 * health says why.
 */
export async function fetchObservation(
  station: { id: string; iemId: string; iemNetwork: string },
  deps: ObservationDeps = defaultObservationDeps,
): Promise<ObservationResult> {
  const [iem, nws] = await Promise.allSettled([
    deps.iem(station.iemId, station.iemNetwork, station.id),
    deps.nws(station.id),
  ]);
  const iemCur = iem.status === 'fulfilled' ? iem.value : null;
  const nwsCur = nws.status === 'fulfilled' ? nws.value : null;
  const iemError = iem.status === 'rejected' ? iem.reason : iemCur ? null : new Error('IEM had no report');
  const nwsError = nws.status === 'rejected' ? nws.reason : nwsCur ? null : new Error('NWS had no report');
  const chosen = chooseObservation(iemCur, nwsCur);
  if (!chosen) {
    const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
    throw new Error(`IEM: ${msg(iemError)}; NWS: ${msg(nwsError)}`);
  }
  return { current: chosen.current, otherObservedAt: chosen.otherObservedAt, iemError, nwsError };
}
