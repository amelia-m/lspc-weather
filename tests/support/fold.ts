/* A card's folds: "Stats for nerds" (src/components/common/NerdStats.tsx:
 * comparisons between data sources and how a figure is worked out) and
 * "How to read this" (ReadingKey.tsx: a key to a table). Warnings, limits
 * and credits stay in view (the maintainer, 2026-11-25). */
const FOLD = /<details class="nerd-stats">[\s\S]*?<\/details>/g;
const KEY = /<details class="reading-key">[\s\S]*?<\/details>/g;

/** The "Stats for nerds" fold's markup, or '' when the card has none. */
export const folded = (html: string): string => (html.match(FOLD) ?? []).join('');

/** The "How to read this" fold's markup, or ''. */
export const keyFolded = (html: string): string => (html.match(KEY) ?? []).join('');

/** The card with both folds taken out: what shows without a tap. */
export const inView = (html: string): string => html.replace(FOLD, '').replace(KEY, '');

/** How many "Stats for nerds" folds the card has. One at most. */
export const foldCount = (html: string): number => (html.match(FOLD) ?? []).length;
