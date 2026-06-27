import { useEffect, useRef } from 'react';

/**
 * Run `callback` immediately, then every `intervalMs`. Polling pauses while the
 * tab is hidden and fires once on refocus so a backgrounded tab doesn't hammer
 * the APIs but is fresh when you look at it again.
 */
export function usePolling(callback: () => void, intervalMs: number): void {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = (): void => {
      stop();
      timer = setInterval(() => saved.current(), intervalMs);
    };
    const stop = (): void => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = (): void => {
      if (document.hidden) {
        stop();
      } else {
        saved.current();
        start();
      }
    };

    saved.current(); // initial fetch
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);
}
