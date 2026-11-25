import { createContext } from 'react';

/**
 * Which card a Panel is, so the trial layout's section bar can find it on
 * the page (`data-card` on the card's element). A context and not a prop:
 * the dashboard builds each card in one place and the grid's children must
 * stay the cards themselves (MasonryGrid sizes its direct children), so a
 * wrapper element is not an option, and a Provider adds none.
 */
export const CardAnchor = createContext<string | null>(null);
