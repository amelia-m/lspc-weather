/* A card's "Stats for nerds" fold (src/components/common/NerdStats.tsx):
 * what is behind it, and what a reader sees without opening it. The fold
 * holds comparisons between data sources and how a figure is worked out;
 * warnings, limits and credits stay in view (the maintainer, 2026-11-25). */
const FOLD = /<details class="nerd-stats">[\s\S]*?<\/details>/g;

/** The fold's markup, or '' when the card has none. */
export const folded = (html: string): string => (html.match(FOLD) ?? []).join('');

/** The card with its fold taken out: what shows without a tap. */
export const inView = (html: string): string => html.replace(FOLD, '');

/** How many folds the card has. One at most, by the component's rule. */
export const foldCount = (html: string): number => (html.match(FOLD) ?? []).length;
