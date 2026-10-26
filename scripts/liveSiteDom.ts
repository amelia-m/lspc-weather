/**
 * The part of the live-site check that runs inside the page. Kept apart
 * from scripts/liveSite.ts, which runs the browser on import, so a check
 * from the sandbox can hand the same function to a page of its own.
 *
 * page.evaluate serialises a function's source and runs it in the page, so
 * nothing from this module's scope may be used inside the function: it
 * sees only the DOM. Nor may it hold a nested function: tsx compiles one
 * with esbuild's `__name` wrapper, which the page does not have.
 */
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import type { OverflowingBox } from '../src/domain/liveSite';

/** Every element whose right edge lies past the viewport's and that the
 *  page cannot clip, in document order (ancestors before their
 *  descendants), each with the index of its nearest such ancestor, so
 *  `overflowReport` can keep the innermost. Issue #208 (2026-10-24)
 *  recorded a 323 px page in a 320 px viewport and nothing else, so the
 *  element could not be found afterwards.
 *
 *  A cell of the TAF table sits 170 px past the edge at 320 px and widens
 *  nothing: its scroller clips it. So an element is left out when an
 *  ancestor with `overflow-x` other than visible clips it. The one way out
 *  of such a box is the fault of 2026-10-24 itself: an absolutely
 *  positioned element is placed against its containing block, so it
 *  escapes every static ancestor up to the first positioned one, and a
 *  scroller that is not itself positioned cannot hold it (`.sky-scroll`
 *  widened the page to 847 px that way). A fixed element escapes them all. */
export function collectOverflowing(): OverflowingBox[] {
  const edge = document.documentElement.clientWidth + 1;
  const indexOf = new Map<Element, number>();
  const out: OverflowingBox[] = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= edge) continue;
    // Written out rather than as a helper: tsx compiles a nested function
    // with esbuild's `__name` wrapper, which page.evaluate's copy of this
    // function cannot find in the page (ReferenceError, 2026-10-26).
    let clipped = false;
    let position = getComputedStyle(el).position;
    for (let a = el.parentElement; a && a !== document.body && position !== 'fixed'; a = a.parentElement) {
      const as = getComputedStyle(a);
      if (position === 'absolute' && as.position === 'static') continue;
      if (as.overflowX !== 'visible') {
        clipped = true;
        break;
      }
      position = as.position;
    }
    if (clipped) continue;
    let parent: number | null = null;
    for (let a = el.parentElement; a; a = a.parentElement) {
      const i = indexOf.get(a);
      if (i != null) {
        parent = i;
        break;
      }
    }
    indexOf.set(el, out.length);
    const classes = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    out.push({
      path: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${classes}`,
      right: Math.round(r.right),
      width: Math.round(r.width),
      parent,
    });
  }
  return out;
}
