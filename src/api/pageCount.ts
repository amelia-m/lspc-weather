import { PAGE_COUNT_ENDPOINT, PAGE_COUNT_HOST } from '../config/pageCount';
import { TOGGLE_HASH, countSkipReason, countUrl, countedPath, type CountContext } from '../domain/pageCount';

// The first view of a visit carries the referrer; every later `#` page was
// reached from inside the app (src/domain/pageCount.ts, `CountData`).
let countedOnce = false;

// GoatCounter's opt-out flag, the key and value count.js uses. The
// dashboard shares amelia-m.github.io's storage, so the personal site and
// the dashboard read the same flag.
const OPT_OUT_KEY = 'skipgc';

function optedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === 't';
  } catch {
    // Storage refused (some private modes): the opt-out cannot have been set.
    return false;
  }
}

/** count.js's `#toggle-goatcounter`, for the dashboard's own URL: flip the
 *  flag and say which way it went, in count.js's words. */
function toggleOptOut(): void {
  try {
    if (optedOut()) {
      localStorage.removeItem(OPT_OUT_KEY);
      window.alert('GoatCounter tracking is now ENABLED in this browser.');
    } else {
      localStorage.setItem(OPT_OUT_KEY, 't');
      window.alert(`GoatCounter tracking is now DISABLED in this browser until ${location.href} is loaded again.`);
    }
  } catch {
    window.alert('GoatCounter tracking could not be changed: this browser refused site storage.');
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
    inFrame: inFrame(),
    visibility: document.visibilityState,
    webdriver: navigator.webdriver === true,
    optedOut: optedOut(),
  };
}

function send(route: string | null, endpoint: string): void {
  if (countSkipReason(context(), PAGE_COUNT_HOST) != null) return;
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
 * Returns a function that drops a count still waiting for the tab to be
 * shown, for an effect's cleanup: a page left before it was seen is not
 * counted.
 */
export function countPage(route: string | null, endpoint: string | null = PAGE_COUNT_ENDPOINT): () => void {
  if (endpoint == null) return () => {};
  if (location.hash === TOGGLE_HASH) {
    // The opt-out link itself is not a view.
    toggleOptOut();
    return () => {};
  }
  if (document.visibilityState !== 'hidden') {
    send(route, endpoint);
    return () => {};
  }
  const onVisible = (): void => {
    if (document.visibilityState === 'hidden') return;
    document.removeEventListener('visibilitychange', onVisible);
    send(route, endpoint);
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}
