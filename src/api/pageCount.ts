import { PAGE_COUNT_ENDPOINT } from '../config/pageCount';
import { countSkipReason, countUrl, countedPath, type CountContext } from '../domain/pageCount';

// The first view of a visit carries the referrer; every later `#` page was
// reached from inside the app (src/domain/pageCount.ts, `CountData`).
let countedOnce = false;

function optedOut(): boolean {
  try {
    return localStorage.getItem('skipgc') === 't';
  } catch {
    // Storage refused (some private modes): the opt-out cannot have been set.
    return false;
  }
}

function inFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin parent refuses the comparison, which only a frame does.
    return true;
  }
}

function context(): CountContext {
  return {
    hostname: location.hostname,
    protocol: location.protocol,
    inFrame: inFrame(),
    visibility: document.visibilityState,
    webdriver: navigator.webdriver === true,
    optedOut: optedOut(),
  };
}

function send(route: string | null, endpoint: string): void {
  if (countSkipReason(context()) != null) return;
  const url = countUrl(
    endpoint,
    {
      path: countedPath(location.pathname, route),
      title: document.title,
      referrer: countedOnce ? '' : document.referrer,
      query: location.search,
      screenWidth: window.screen.width,
    },
    Math.random().toString(36).slice(2, 7),
  );
  countedOnce = true;
  // An image request, which the policy's img-src allows for this URL alone.
  // GoatCounter answers with a 1x1 GIF; nothing is added to the page.
  new Image().src = url;
}

/**
 * Count a view of the dashboard page `route` (null for the Jumpers tab).
 * A tab opened in the background is counted when it is first shown, as
 * count.js does, so a link opened and never looked at is not a view.
 */
export function countPage(route: string | null, endpoint: string | null = PAGE_COUNT_ENDPOINT): void {
  if (endpoint == null) return;
  if (document.visibilityState !== 'hidden') {
    send(route, endpoint);
    return;
  }
  const onVisible = (): void => {
    if (document.visibilityState === 'hidden') return;
    document.removeEventListener('visibilitychange', onVisible);
    send(route, endpoint);
  };
  document.addEventListener('visibilitychange', onVisible);
}
