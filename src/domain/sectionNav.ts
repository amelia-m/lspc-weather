/**
 * The trial layout's section bar: which address shows it, and which section
 * the reader is in.
 *
 * The maintainer, 2026-11-25, of three layouts mocked up for her
 * (docs/mockups/layout-options-2026-11-25.html): "Build b first but for now
 * let's launch it as an alternate view, possibly at a new address". Option B
 * keeps the page as it is and adds a bar of labelled icons that jumps
 * between sections. It is served from `beta/` beside the site (the build
 * copies the page there, vite.config.ts), so the standard address and
 * everything behind it are unchanged while it is tried.
 *
 * Pure: the page passes in what it measured.
 */

/** Whether this address is the trial layout's: the site's `beta/` folder,
 *  with or without its index file or the closing slash. */
export function isBetaPath(pathname: string): boolean {
  return /\/beta(\/(index\.html)?)?$/.test(pathname);
}

export interface SectionTop {
  id: string;
  /** The top of the section's first card, in px from the top of the
   *  viewport: negative once it has scrolled past. */
  top: number;
}

/**
 * The section the reader is in: the one whose card's top is nearest above a
 * line a little way down the viewport, so a section becomes current as its
 * first card arrives and stays current while the reader is inside it. Above
 * every section (the top of the page, in the flags), the first is current.
 * At the foot of the page the lowest section is, since a short last section
 * can never reach the line.
 *
 * Nearest above the line, not last in the list: at desktop widths the grid
 * packs cards into columns, so the sections' tops are not in list order,
 * and two sections' cards can stand side by side at one height. Of cards
 * level with each other (within `LEVEL_PX`) the one the reader last chose
 * from the bar wins, so tapping "Wind" does not light "Aloft" beside it;
 * with no choice among them, the first in the list, the reading order.
 */
const LEVEL_PX = 4;

export function activeSection(
  tops: readonly SectionTop[],
  line: number,
  opts: { atEnd?: boolean; chosen?: string | null } = {},
): string | null {
  if (tops.length === 0) return null;
  const above = tops.filter((t) => t.top <= line);
  // At the foot, the card lowest on the page; inside the page, the lowest
  // of those above the line; above them all, the highest.
  const pool = opts.atEnd ? tops : above.length > 0 ? above : tops;
  const lowest = opts.atEnd || above.length > 0;
  const best = pool.reduce((a, b) => ((lowest ? b.top > a.top : b.top < a.top) ? b : a)).top;
  const level = pool.filter((t) => Math.abs(t.top - best) <= LEVEL_PX);
  return (level.find((t) => t.id === opts.chosen) ?? level[0]).id;
}
