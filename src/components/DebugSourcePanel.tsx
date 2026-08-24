import { useState, useEffect } from 'react';
import { getLogs, clearLogs, type SourceLog } from '../domain/sourceLogging';

/** Optional debug panel showing data source fetch history.
 *  Toggle with Shift+D (or call window.LSPC_DEBUG.toggle()). */
export function DebugSourcePanel(): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState<SourceLog[]>([]);

  // Refresh logs every 500ms while visible
  useEffect(() => {
    if (!visible) return;
    setLogs(getLogs());
    const timer = setInterval(() => {
      setLogs(getLogs());
    }, 500);
    return () => clearInterval(timer);
  }, [visible]);

  // Keyboard shortcut: Shift+D to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
              <span className="debug-time">
                {new Date(log.timestamp).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span className="debug-source">{log.source.toUpperCase()}</span>
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

// Expose toggle in window for manual access
declare global {
  interface Window {
    LSPC_DEBUG: { toggle: () => void; getLogs: () => SourceLog[] };
  }
}
