/** Offutt's TAF and KPMV's NBM bulletin come through the same relay
 *  (relay/, docs/taf-relay.md); this reads the bulletin's block from its
 *  `/nbm/KPMV` path and parses it (src/domain/nbm.ts). Nothing without the
 *  relay: the bucket's files hold every station, 28 MB each. */
import { USE_FIXTURES, fetchJson, HttpError } from './http';
import { TAF_RELAY_URL, nbmRelayUrl } from '../config/tafRelay';
import { parseNbhBlock } from '../domain/nbm';
import type { NbmForecast } from '../domain/types';
import { nbhFixtureText } from './fixtures/nbm';

interface RelayNbm {
  station?: unknown;
  file?: unknown;
  cycle?: unknown;
  text?: unknown;
}

export async function fetchNbm(relayBase: string | null = TAF_RELAY_URL, now = Date.now()): Promise<NbmForecast | null> {
  if (USE_FIXTURES) return withFile(parseNbhBlock(nbhFixtureText(now)), 'fixture');
  const url = nbmRelayUrl(relayBase);
  if (url == null) return null;
  // As the TAF path: no retry after the relay's own 502, which it answers
  // after its own waits on the bucket; one retry for anything else.
  let body: RelayNbm;
  try {
    body = await fetchJson<RelayNbm>(url, { retries: 0 });
  } catch (err) {
    if (err instanceof HttpError && err.status === 502) throw err;
    body = await fetchJson<RelayNbm>(url, { retries: 0 });
  }
  if (typeof body.text !== 'string' || typeof body.file !== 'string') throw new Error('relay answered something other than an NBM block');
  const parsed = parseNbhBlock(body.text);
  if (!parsed) throw new Error(`relay's NBM block for ${String(body.station)} did not parse`);
  return withFile(parsed, body.file);
}

function withFile(f: NbmForecast | null, file: string): NbmForecast | null {
  return f ? { ...f, file } : null;
}
