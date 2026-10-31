/** Records this browser's requests to Open-Meteo, in memory and in
 *  localStorage, so the Data health card can say how many calls it has
 *  made against the free limits (src/domain/openMeteoUsage.ts has the
 *  arithmetic and why). Lives in the api layer: storage, Date.now() and
 *  module state. */
import {
  mergeUsage,
  pruneUsage,
  summarizeUsage,
  toUsageRecord,
  usageCharge,
  usageKey,
  type UsageOutcome,
  type UsageRecord,
  type UsageSummary,
} from '../domain/openMeteoUsage';
import { safeLocalGet, safeLocalRemove, safeLocalSet } from './safeStorage';

const STORAGE_KEY = 'lspc:openMeteoUsage';

let records: UsageRecord[] = [];
/** Whether storage has been read into `records` this session: done on the
 *  first read or write, so a restored fortnight shows on the first render
 *  rather than after some later state change. */
let loaded = false;

/** The records in storage, validated: a stored value that is not an array,
 *  or a record that does not parse, is dropped without a trace. */
function readStored(): UsageRecord[] {
  const stored = safeLocalGet(STORAGE_KEY);
  if (stored == null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: UsageRecord[] = [];
  for (const item of parsed) {
    const r = toUsageRecord(item);
    if (r !== null) out.push(r);
  }
  return out;
}

/** Restore the records an earlier session, or another tab, wrote. */
export function loadPersistedUsage(now: number = Date.now()): void {
  records = pruneUsage(mergeUsage(readStored(), records), now);
  loaded = true;
}

/** One attempt at an Open-Meteo request, however it ended. Called per
 *  attempt (fetchJson's `onAttempt`), since each attempt is a request the
 *  server may charge. One read of storage, merged with this tab's records
 *  and the new one, then one write: two tabs of the same browser each
 *  record their own requests, and the count the card claims is the
 *  browser's, so neither may overwrite the other's; and the first record
 *  of a session is the load, not a load and then a re-read. */
export function recordOpenMeteoRequest(url: string, outcome: UsageOutcome, now: number = Date.now()): void {
  const fresh: UsageRecord = { t: now, w: usageCharge(url, outcome), k: usageKey(url), o: outcome };
  records = pruneUsage(mergeUsage(readStored(), [...records, fresh]), now);
  loaded = true;
  safeLocalSet(STORAGE_KEY, JSON.stringify(records));
}

/** What this browser has asked Open-Meteo, read against the clock. */
export function openMeteoUsage(now: number = Date.now()): UsageSummary {
  if (!loaded) loadPersistedUsage(now);
  return summarizeUsage(pruneUsage(records, now), now);
}

/** Drop everything, in memory and in storage. */
export function clearOpenMeteoUsage(): void {
  records = [];
  loaded = false;
  safeLocalRemove(STORAGE_KEY);
}
