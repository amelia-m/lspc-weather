/** Track and log data source usage (primary vs fallback, success/failure). */

export interface SourceLog {
  timestamp: number;
  source: string;
  status: 'attempted' | 'success' | 'fallback' | 'failure';
  message: string;
  error?: string;
}

const logs: SourceLog[] = [];
const MAX_LOGS = 100; // Keep last 100 entries

/** Log a source event. */
export function logSource(
  source: string,
  status: 'attempted' | 'success' | 'fallback' | 'failure',
  message: string,
  error?: Error,
): void {
  const entry: SourceLog = {
    timestamp: Date.now(),
    source,
    status,
    message,
    error: error?.message,
  };

  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Format for console: [HH:MM:SS] SOURCE(STATUS): message
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const statusBadge = {
    attempted: '🔄',
    success: '✅',
    fallback: '⚠️',
    failure: '❌',
  }[status];

  const msg = `${statusBadge} [${time}] ${source.toUpperCase()}(${status}): ${message}`;
  if (error) {
    console.warn(msg, error);
  } else {
    console.log(msg);
  }

  // Store in sessionStorage for persistence across page reloads during debugging
  try {
    sessionStorage.setItem('lspc:sourceLogs', JSON.stringify(logs));
  } catch {
    /* storage quota or private mode */
  }
}

/** Get all logged source events. */
export function getLogs(): SourceLog[] {
  return [...logs];
}

/** Clear logs. */
export function clearLogs(): void {
  logs.length = 0;
  try {
    sessionStorage.removeItem('lspc:sourceLogs');
  } catch {
    /* storage unavailable */
  }
}

/** Load persisted logs from sessionStorage (called on app init). */
export function loadPersistedLogs(): void {
  try {
    const stored = sessionStorage.getItem('lspc:sourceLogs');
    if (stored) {
      const parsed = JSON.parse(stored) as SourceLog[];
      logs.length = 0;
      logs.push(...parsed.slice(-MAX_LOGS));
    }
  } catch {
    /* storage unavailable or malformed */
  }
}
