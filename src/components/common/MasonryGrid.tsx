import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * The card grid, packed vertically.
 *
 * A CSS grid gives every row the height of its tallest card, so a tall card
 * (Winds aloft, Radar) leaves a hole under each of its neighbours before the
 * next row starts, and a two-column card leaves a third-column hole beside
 * it. On a desktop screenshot of the deployed site (2026-09-24) those holes
 * added up to more empty space than card. The stylesheet asks for native
 * `grid-template-rows: masonry` where supported; no shipping browser
 * supports it, so that path has never run.
 *
 * This does the packing with the grid's own placement instead. The grid's
 * implicit rows are made a few pixels tall, each card is told how many of
 * them it spans from its measured height, and dense auto-placement then
 * drops each card into the first column with room, which is the shortest
 * one. Cards keep their DOM order and widths, the span-2 rule for the wide
 * tables keeps working, and React never moves a card between parents, so
 * card state (a toggled table, a chosen day) survives every relayout.
 *
 * The row gap is folded into each span rather than left to `row-gap`, which
 * would otherwise be repeated between every one of the small rows a card
 * spans. The class that switches the stylesheet over is added only once the
 * observer runs, so with no script (the static render the tests use) the
 * plain grid stands.
 */

/** Height of one implicit grid row. Smaller packs tighter and costs rows;
 *  four pixels leaves at most three of slack under a card. */
const ROW_UNIT_PX = 4;
/** The stylesheet's grid gap, folded into the span. */
const GAP_PX = 14;

export function MasonryGrid({ children }: { children: ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;

    const size = (el: Element): void => {
      const h = el.getBoundingClientRect().height;
      (el as HTMLElement).style.gridRowEnd = `span ${Math.max(1, Math.ceil((h + GAP_PX) / ROW_UNIT_PX))}`;
    };
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) size(e.target);
    });
    const observeAll = (): void => {
      for (const el of Array.from(grid.children)) {
        ro.observe(el);
        size(el);
      }
    };
    // Cards come and go with the data (a card with nothing to show renders
    // nothing), so new children are picked up as they appear.
    const mo = new MutationObserver(observeAll);
    mo.observe(grid, { childList: true });
    grid.classList.add('masonry');
    observeAll();
    return () => {
      ro.disconnect();
      mo.disconnect();
      grid.classList.remove('masonry');
    };
  }, []);

  return (
    <div className="grid" ref={ref}>
      {children}
    </div>
  );
}
