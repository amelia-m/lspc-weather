import { fetchJson, USE_FIXTURES } from './http';
import { IEM_BASE } from './iem';
import { IEM_NEBRASKA_FIXTURE } from './fixtures/iemNebraska';
import type { RawIemCurrent, RawIemCurrents } from '../domain/iem';

/** The latest observation at every station in an IEM network, one request:
 *  the Nearby METARs card reads six of Nebraska's 46 from it. IEM sends a
 *  CORS header, so the browser reads it directly, as it does KPMV's. */
export async function fetchIemNetwork(network: string): Promise<RawIemCurrent[]> {
  const data = USE_FIXTURES
    ? IEM_NEBRASKA_FIXTURE
    : await fetchJson<RawIemCurrents>(`${IEM_BASE}/api/1/currents.json?network=${encodeURIComponent(network)}`);
  return data?.data ?? [];
}
