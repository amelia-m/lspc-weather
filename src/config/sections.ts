import type { CardId, View } from './views';

/**
 * The trial layout's sections: the places its bar jumps to on each tab, each
 * the first card of a run of cards that read together (src/config/views.ts
 * has the order). Five at most, each an icon with its word: an icon alone is
 * a guess, and more than five do not fit a phone's width at a size a thumb
 * can hit. The Canopy tab is two cards and has no bar.
 */
export type SectionIcon = 'wind' | 'aloft' | 'sky' | 'outlook' | 'radar' | 'now' | 'chart' | 'taf';

export interface ViewSection {
  id: string;
  label: string;
  icon: SectionIcon;
  /** The card the bar scrolls to: the section's first. */
  card: CardId;
}

export const VIEW_SECTIONS: Readonly<Record<View, readonly ViewSection[]>> = {
  jumpers: [
    { id: 'wind', label: 'Wind', icon: 'wind', card: 'surfaceWind' },
    { id: 'aloft', label: 'Aloft', icon: 'aloft', card: 'windsAloft' },
    { id: 'sky', label: 'Sky', icon: 'sky', card: 'metar' },
    { id: 'outlook', label: 'Outlook', icon: 'outlook', card: 'daily' },
    { id: 'radar', label: 'Radar', icon: 'radar', card: 'radar' },
  ],
  pilots: [
    { id: 'now', label: 'Now', icon: 'now', card: 'metar' },
    { id: 'chart', label: 'Chart', icon: 'chart', card: 'sectional' },
    { id: 'taf', label: 'TAF', icon: 'taf', card: 'taf' },
    { id: 'aloft', label: 'Aloft', icon: 'aloft', card: 'densityAltitude' },
    { id: 'radar', label: 'Radar', icon: 'radar', card: 'radar' },
  ],
  canopy: [],
};
