import { useEffect, useState, useSyncExternalStore } from 'react';
import { getLogs, clearLogs, subscribe, type SourceLog } from '../api/sourceLog';
import type { SourceKey } from '../domain/types';

/** Human-readable column labels for the typed source keys. The keys are
 *  identifiers ('windsAloft'), not prose, and the log rows are read at a glance
 *  while chasing a bad fetch — so spell them the way the Data health card does
 *  rather than shouting the camelCase identifier back at the reader. */
const SOURCE_LABELS: Record<SourceKey, string> = {
  nws: 'NWS HOURLY',
  metar: 'METAR',
  windsAloft: 'WINDS ALOFT',
  taf: 'TAF',
  daily: 'DAILY',
};

/** One shared formatter instead of a fresh options object per row. Logs are
 *  wall-clock timestamps compared against a fetch that just happened, so 24-hour
 *  local time with seconds is the useful resolution. */
const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Keystrokes must not be stolen from anything the user is typing into. The
 *  toggle calls preventDefault(), so without this guard a capital D typed into a
 *  future text field would never reach it. */
function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** Optional debug panel showing data source fetch history.
 *
 *  Opens with Shift+D, closes with Shift+D or Escape. A touch device has no
 *  keyboard at all, so the component also publishes `window.LSPC_DEBUG.toggle()`
 *  — the only way in from a phone's remote-debug console. That registration
 *  lives here rather than in App because `visible` is local state; App has no
 *  handle on it and could only install a no-op. */
export function DebugSourcePanel(): JSX.Element | null {
  const [visible, setVisible] = useState(false);

  /** The log store is a module-level ring buffer mutated by every fetch. Reading
   *  it through useSyncExternalStore renders exactly once per log event —
   *  the previous 500 ms poll reconciled ~100 rows twice a second forever,
   *  including on a backgrounded tab, and still lagged Clear Logs by up to half
   *  a second because clearing mutates the array without touching state. */
  const logs = useSyncExternalStore(subscribe, getLogs);

  // Expose the manual toggle for keyboard-less devices; tear it down with the
  // component so a stale setter can never outlive the mount that owns it.
  useEffect(() => {
    window.LSPC_DEBUG = { toggle: () => setVisible((v) => !v), getLogs };
    return () => {
      delete window.LSPC_DEBUG;
    };
  }, []);

  /** Shift+D toggles; Escape closes. Keyed off `e.code` because `e.key` reports
   *  'd' when Caps Lock is on (Shift inverts the case) and reports a non-Latin
   *  letter entirely on a Cyrillic/Greek layout — both make the documented
   *  shortcut unreachable. The modifier exclusions matter because Ctrl+Shift+D
   *  is "bookmark all tabs" in Chrome and responsive-design mode in Firefox;
   *  preventDefault() on those would break the browser, not the page. */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTextEntryTarget(e.target)) return;
      if (e.code === 'KeyD' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setVisible((v) => !v);
        return;
      }
      if (visible && e.key === 'Escape') {
        e.preventDefault();
        setVisible(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  /** The panel is a fixed-position overlay anchored to the bottom of the
   *  viewport, where on a phone it sits on top of the Data health card's
   *  Refresh button. The class lets the stylesheet reserve scroll room under the
   *  page content so nothing stays permanently covered while it is open. */
  useEffect(() => {
    if (!visible) return;
    document.body.classList.add('debug-panel-open');
    return () => document.body.classList.remove('debug-panel-open');
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h3>Source Logs (Shift+D to toggle)</h3>
        <button
          type="button"
          className="debug-close"
          onClick={() => setVisible(false)}
          aria-label="Close debug panel"
        >
          ✕
        </button>
      </div>
      <div className="debug-controls">
        <button type="button" onClick={() => clearLogs()}>
          Clear Logs
        </button>
        <span className="debug-count">{logs.length} entries</span>
      </div>
      <div className="debug-logs">
        {logs.length === 0 ? (
          <p className="debug-empty">No logs yet</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`debug-log debug-log-${log.status}`}>
              <span className="debug-time">{TIME_FMT.format(log.timestamp)}</span>
              <span className="debug-source">{SOURCE_LABELS[log.source]}</span>
              <span className="debug-status">{log.status}</span>
              <span className="debug-message">{log.message}</span>
              {log.error && <span className="debug-error">{log.error}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Declared optional: the property only exists while DebugSourcePanel is
 *  mounted. Vouching for it unconditionally would lie exactly when it matters —
 *  after a render crash the ErrorBoundary caught, when App never mounted and a
 *  console user reaches for the debug API. */
declare global {
  interface Window {
    LSPC_DEBUG?: { toggle: () => void; getLogs: () => readonly SourceLog[] };
  }
}
