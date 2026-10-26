/**
 * The part of the live-site check that runs inside the page. Kept apart
 * from scripts/liveSite.ts, which runs the browser on import, so a check
 * from the sandbox can hand the same function to a page of its own.
 *
 * page.evaluate serialises a function's source and runs it in the page, so
 * nothing from this module's scope may be used inside the function: it
 * sees only the DOM.
 */
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import type { OverflowingBox } from '../src/domain/liveSite';

/** Every element whose right edge lies past the viewport's, in document
 *  order (ancestors before their descendants), each with the index of its
 *  nearest overflowing ancestor, so `overflowReport` can keep the innermost.
 *  Issue #208 (2026-10-24) recorded a 323 px page in a 320 px viewport and
 *  nothing else, so the element could not be found afterwards. */
export function collectOverflowing(): OverflowingBox[] {
  const edge = document.documentElement.clientWidth + 1;
  const indexOf = new Map<Element, number>();
  const out: OverflowingBox[] = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= edge) continue;
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
