import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { activeSection } from '../src/domain/sectionNav';
import { VIEW_SECTIONS } from '../src/config/sections';
import { VIEW_CARDS, type View } from '../src/config/views';
import { SectionBar } from '../src/components/SectionBar';
import { Panel } from '../src/components/common/Panel';
import { CardAnchor } from '../src/components/common/cardAnchor';

/* The section bar (option B of docs/mockups/layout-options-2026-11-25.html):
 * tried at beta/ from 2026-11-25, the layout since 2026-11-27. */
describe('which section the reader is in', () => {
  // A phone: one column, the sections in order down the page.
  const column = (scrolled: number) =>
    [
      { id: 'wind', top: 600 - scrolled },
      { id: 'aloft', top: 1800 - scrolled },
      { id: 'sky', top: 3000 - scrolled },
    ] as const;

  it('is the first at the top of the page, above every section', () => {
    expect(activeSection(column(0), 120)).toBe('wind');
  });

  it('changes as a section’s first card comes up to the line, and holds inside the section', () => {
    expect(activeSection(column(1679), 120)).toBe('wind'); // aloft's card at 121
    expect(activeSection(column(1680), 120)).toBe('aloft'); // at 120
    expect(activeSection(column(2500), 120)).toBe('aloft'); // deep in it, sky not yet up
    expect(activeSection(column(2990), 120)).toBe('sky');
  });

  it('is the lowest section at the foot of the page, which a short last section never reaches otherwise', () => {
    const foot = [
      { id: 'outlook', top: -400 },
      { id: 'radar', top: 300 },
    ];
    expect(activeSection(foot, 120)).toBe('outlook');
    expect(activeSection(foot, 120, { atEnd: true })).toBe('radar');
  });

  it('with cards level in a row, as a wide screen packs them, takes the one chosen from the bar, else the first', () => {
    const row = [
      { id: 'wind', top: 10 },
      { id: 'aloft', top: 10 },
      { id: 'sky', top: 900 },
    ];
    expect(activeSection(row, 120)).toBe('wind');
    expect(activeSection(row, 120, { chosen: 'aloft' })).toBe('aloft');
    // A choice that is not among the level cards does not win.
    expect(activeSection(row, 120, { chosen: 'sky' })).toBe('wind');
  });

  it('is nothing with no section on the page', () => {
    expect(activeSection([], 120)).toBeNull();
  });
});

describe('the sections of each tab', () => {
  it('are five at most, each a card that tab shows, in the page’s order, each named', () => {
    for (const view of Object.keys(VIEW_SECTIONS) as View[]) {
      const sections = VIEW_SECTIONS[view];
      expect(sections.length).toBeLessThanOrEqual(5);
      expect(new Set(sections.map((s) => s.id)).size).toBe(sections.length);
      const at = sections.map((s) => VIEW_CARDS[view].indexOf(s.card));
      expect(at.every((i) => i >= 0), view).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
      for (const s of sections) expect(s.label.length).toBeGreaterThan(0);
    }
    // The Jumpers bar opens on the ground wind, the page's first card.
    expect(VIEW_SECTIONS.jumpers[0].card).toBe(VIEW_CARDS.jumpers[0]);
    // Two cards need no bar.
    expect(VIEW_SECTIONS.canopy).toEqual([]);
  });
});

describe('the section bar', () => {
  it('is a labelled list of buttons, each an icon with its word, the first current', () => {
    const html = renderToStaticMarkup(createElement(SectionBar, { sections: VIEW_SECTIONS.jumpers }));
    expect(html).toMatch(/^<nav class="section-bar" aria-label="Jump to a section">/);
    const buttons = [...html.matchAll(/<button type="button"([^>]*)><svg viewBox="0 0 24 24" aria-hidden="true"><path d="[^"]+"><\/path><\/svg>([^<]+)<\/button>/g)];
    expect(buttons.map((m) => m[2])).toEqual(['Wind', 'Aloft', 'Sky', 'Outlook', 'Radar']);
    expect(buttons.map((m) => m[1].includes('aria-current="true"'))).toEqual([true, false, false, false, false]);
    expect(html).not.toContain('disabled');
  });

  it('is not drawn for a tab with no sections', () => {
    expect(renderToStaticMarkup(createElement(SectionBar, { sections: VIEW_SECTIONS.canopy }))).toBe('');
  });
});

describe('a card as the bar’s target', () => {
  const card = createElement(Panel, { title: 'Winds aloft', children: 'x' });

  it('carries its id where the dashboard names it, and nothing otherwise', () => {
    const named = renderToStaticMarkup(createElement(CardAnchor.Provider, { value: 'windsAloft' }, card));
    expect(named).toMatch(/^<section class="panel" data-card="windsAloft">/);
    expect(renderToStaticMarkup(card)).toMatch(/^<section class="panel">/);
  });
});
