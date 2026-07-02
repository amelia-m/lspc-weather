import { useEffect, useState } from 'react';

/**
 * Return the current timestamp, refreshed every `intervalMs`. The tick pauses
 * while the tab is hidden and fires once on refocus so a backgrounded tab
 * doesn't churn re-renders but time-based UI is fresh when you look at it
 * again.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = (): void => {
      stop();
      timer = setInterval(() => setNow(Date.now()), intervalMs);
    };
    const stop = (): void => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = (): void => {
      if (document.hidden) {
        stop();
      } else {
        setNow(Date.now());
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);

  return now;
}
