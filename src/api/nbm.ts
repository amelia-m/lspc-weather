/** Offutt's TAF and KPMV's NBM bulletin come through the same relay
 *  (relay/, docs/taf-relay.md); this reads the bulletin's block from its
 *  `/nbm/KPMV` path and parses it (src/domain/nbm.ts). Nothing without the
 *  relay: the bucket's files hold every station, 28 MB each. */
import { USE_FIXTURES, fetchJson, HttpError } from './http';
import { TAF_RELAY_URL, nbmRelayUrl } from '../config/tafRelay';
import { parseNbhBlock } from '../domain/nbm';
import type { NbmForecast } from '../domain/types';
import { nbhFixtureText } from './fixtures/nbm';

export const NBM_FETCH_TIMEOUT_MS = 25_000;

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
  // As the TAF path: no retry after the relay's own answers, which come
  // after its waits on the bucket: its 502 (the bucket unreachable, no
  // file, a bad status) and its 500 (a file read and the station's block
  // not found in it, since 2026-11-04). One retry for anything else. The
  // wait outlasts the relay's time budget (relay/src/nbm.ts, 20 s), so a
  // slow whole-file read is not abandoned here while the relay finishes
  // it. The 502 is named as the bucket's, which Data health shows and the
  // live-site check notes rather than counts (src/domain/liveSite.ts); the
  // 500 is thrown as the HTTP error it is, which that check counts.
  let body: RelayNbm;
  try {
    body = await fetchJson<RelayNbm>(url, { retries: 0, timeoutMs: NBM_FETCH_TIMEOUT_MS });
  } catch (err) {
    if (err instanceof HttpError && err.status === 502) throw new Error(`NOAA's NBM bucket failed behind the relay (relay answered 502)`);
    if (err instanceof HttpError && err.status === 500) throw err;
    body = await fetchJson<RelayNbm>(url, { retries: 0, timeoutMs: NBM_FETCH_TIMEOUT_MS });
  }
  if (typeof body.text !== 'string' || typeof body.file !== 'string') throw new Error('relay answered something other than an NBM block');
  const parsed = parseNbhBlock(body.text);
  if (!parsed) throw new Error(`relay's NBM block for ${String(body.station)} did not parse`);
  return withFile(parsed, body.file);
}

function withFile(f: NbmForecast | null, file: string): NbmForecast | null {
  return f ? { ...f, file } : null;
}
