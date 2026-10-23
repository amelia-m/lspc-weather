import { useEffect, useState } from 'react';

/** How far a data file published beside the site has got: still loading, not
 *  published yet (404), unreadable, or in hand. */
export type SiteJsonState = 'loading' | 'missing' | 'error' | 'ready';

/**
 * A JSON file a workflow or script publishes beside the site (the #parity
 * summary, the #wind-errors data), fetched relative to the page so it works
 * under the Pages subpath and a local build alike, and revalidated rather
 * than taken from the browser's cache: the file changes with each publish.
 */
export function useSiteJson<T>(path: string): { state: SiteJsonState; data: T | null } {
  const [state, setState] = useState<SiteJsonState>('loading');
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}${path}`, { cache: 'no-cache' })
      .then(async (res) => {
        if (res.status === 404) return 'missing' as const;
        if (!res.ok) return 'error' as const;
        const body = (await res.json()) as T;
        if (!cancelled) setData(body);
        return 'ready' as const;
      })
      .catch(() => 'error' as const)
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return { state, data };
}
