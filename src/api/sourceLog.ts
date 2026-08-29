/** Source-event log: which provider served each source, and whether it was the
 *  primary, a fallback, or a failure. This lives in the api layer, not domain,
 *  because it is pure I/O — console output, localStorage persistence, Date.now()
 *  and mutable module state — none of which belongs beside the pure, unit-tested
 *  domain calculations. Storage access mirrors the safeLocal* helpers in nws.ts. */

import type { SourceKey } from '../domain/types';

export type SourceLogStatus = 'attempted' | 'success' | 'fallback' | 'failure';

export interface SourceLog {
  timestamp: number;
  source: SourceKey;
  status: SourceLogStatus;
  message: string;
  error?: string;
}

const STORAGE_KEY = 'lspc:sourceLogs';

/** Ring-buffer size. At ~5 entries per 10-minute poll cycle a 100-entry buffer
 *  only spans ~3 hours, so a morning fallback would already be gone by an
 *  afternoon review; 200 plus the success-first eviction below keeps the
 *  interesting entries around for a full day at the drop zone. */
const MAX_LOGS = 200;

const SOURCE_KEYS: readonly SourceKey[] = ['nws', 'metar', 'windsAloft', 'taf', 'daily'];
const STATUSES: readonly SourceLogStatus[] = ['attempted', 'success', 'fallback', 'failure'];

/** Console chatter only. The deployed GitHub Pages build would otherwise emit
 *  hundreds of emoji lines a day and bury ErrorBoundary's console.error, so the
 *  same gate http.ts uses for its debug output applies here. Recording and
 *  persistence stay on in production — the panel is used live at the DZ. */
const CONSOLE_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEBUG_LOGS === 'true';

function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — ignore */
  }
}
function safeLocalRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode / unavailable — ignore */
  }
}

const listeners = new Set<() => void>();

let logs: SourceLog[] = [];
/** Cached frozen copy of `logs`, replaced only when the buffer actually
 *  changes. Consumers subscribe with useSyncExternalStore, which compares
 *  snapshots by identity — returning a fresh array per read would re-render the
 *  panel on every poll of the store (and React would flag an infinite loop). */
let snapshot: readonly SourceLog[] = Object.freeze([]);

/** Publish the working buffer as a new immutable snapshot and wake subscribers.
 *  Persistence rides along so the log survives a tab close: the point of the
 *  feature is noticing a discrepancy now and reviewing it hours later. */
function commit(): void {
  snapshot = Object.freeze(logs.slice());
  safeLocalSet(STORAGE_KEY, JSON.stringify(snapshot));
  for (const listener of listeners) listener();
}

/** Trim to MAX_LOGS by dropping the oldest 'success' entry first, and only
 *  falling back to the oldest entry overall once no successes are left.
 *  Successes are the routine noise (five per cycle, every cycle); the
 *  failures and fallbacks are the reason anyone opens the log, so plain FIFO
 *  would evict exactly the entries worth keeping. */
function evictToCap(buffer: SourceLog[]): void {
  while (buffer.length > MAX_LOGS) {
    const oldestSuccess = buffer.findIndex((entry) => entry.status === 'success');
    buffer.splice(oldestSuccess >= 0 ? oldestSuccess : 0, 1);
  }
}

/** Rebuild one persisted entry, or null if it is not a well-formed log record.
 *  localStorage is user-writable and survives reloads, so a single malformed
 *  entry reaching the panel (which calls `source.toUpperCase()`) would throw
 *  into the root ErrorBoundary on every load until storage is cleared by hand.
 *  Fields are copied one by one rather than spread so unknown keys cannot ride
 *  along into the snapshot. */
function toSourceLog(value: unknown): SourceLog | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!Number.isFinite(raw.timestamp)) return null;
  if (!SOURCE_KEYS.includes(raw.source as SourceKey)) return null;
  if (!STATUSES.includes(raw.status as SourceLogStatus)) return null;
  if (typeof raw.message !== 'string') return null;
  if (raw.error !== undefined && typeof raw.error !== 'string') return null;

  const entry: SourceLog = {
    timestamp: raw.timestamp as number,
    source: raw.source as SourceKey,
    status: raw.status as SourceLogStatus,
    message: raw.message,
  };
  if (raw.error !== undefined) entry.error = raw.error as string;
  return entry;
}

const STATUS_BADGE: Record<SourceLogStatus, string> = {
  attempted: '🔄',
  success: '✅',
  fallback: '⚠️',
  failure: '❌',
};

/**
 * Record one source event.
 *
 * `source` is a SourceKey rather than a free string so log entries join to the
 * Data health map — the panel and the status record must name the same source
 * or the log cannot answer "why is winds aloft stale?".
 *
 * `error` is `unknown` because a rejected promise can carry anything: a thrown
 * string, a number, a DOMException. It is normalized the same way markStale
 * does in useWeatherData (`instanceof Error ? .message : String(err)`), so a
 * non-Error rejection still records its reason instead of `undefined`.
 */
export function logSource(
  source: SourceKey,
  status: SourceLogStatus,
  message: string,
  error?: unknown,
): void {
  const entry: SourceLog = { timestamp: Date.now(), source, status, message };
  // Only when a reason was actually passed — an absent error must not become
  // the string "undefined" in the panel.
  if (error !== undefined) {
    entry.error = error instanceof Error ? error.message : String(error);
  }

  logs.push(entry);
  evictToCap(logs);
  commit();

  if (CONSOLE_ENABLED) {
    const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const line = `${STATUS_BADGE[status]} [${time}] ${source.toUpperCase()}(${status}): ${message}`;
    if (entry.error !== undefined) {
      console.warn(line, entry.error);
    } else {
      console.log(line);
    }
  }
}

/** The current log, as a snapshot whose identity is stable until the log
 *  changes. Safe to use directly as a useSyncExternalStore getSnapshot. */
export function getLogs(): readonly SourceLog[] {
  return snapshot;
}

/** Subscribe to log changes; returns the unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Drop everything, in memory and in storage — otherwise a "clear" would come
 *  back on the next reload. */
export function clearLogs(): void {
  logs = [];
  snapshot = Object.freeze([]);
  safeLocalRemove(STORAGE_KEY);
  for (const listener of listeners) listener();
}

/** Restore the log written by an earlier session (called once on app init).
 *
 * The in-memory buffer is replaced only after the stored value has parsed to an
 * array and each entry has been validated: a stored `null`, `5` or `"x"` used
 * to empty the buffer first and then throw into a silent catch, losing this
 * session's entries with no trace. Individual malformed entries are dropped
 * silently — a corrupt record is not worth an error the user cannot act on.
 */
export function loadPersistedLogs(): void {
  const stored = safeLocalGet(STORAGE_KEY);
  if (stored == null) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return;
  }
  if (!Array.isArray(parsed)) return;

  const restored: SourceLog[] = [];
  for (const item of parsed) {
    const entry = toSourceLog(item);
    if (entry !== null) restored.push(entry);
  }
  evictToCap(restored);

  logs = restored;
  commit();
}
