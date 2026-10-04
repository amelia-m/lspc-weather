import { describe, expect, it } from 'vitest';
import { VIEW_CARDS, VIEW_HASH, type CardId } from '../src/config/views';
import { PILOT_LINKS } from '../src/config/sources';

/* Every card the dashboard had must still be on a tab: splitting the page
 * must not quietly drop one. And the jumper-only and pilot-only cards must
 * stay where the split put them. */
describe('the dashboard tabs', () => {
  const ALL: CardId[] = [
    'metar', 'surfaceWind', 'ceilingSky', 'windsAloft', 'drift', 'hourly', 'daily', 'precip',
    'densityAltitude', 'sun', 'radar', 'sectional', 'taf', 'pilotLinks', 'nearbyMetars',
  ];

  it('puts every card on at least one tab, and none twice on a tab', () => {
    const shown = new Set([...VIEW_CARDS.jumpers, ...VIEW_CARDS.pilots]);
    expect([...shown].sort()).toEqual([...ALL].sort());
    for (const cards of Object.values(VIEW_CARDS)) expect(new Set(cards).size).toBe(cards.length);
  });

  it('keeps the wind limits and drift on Jumpers, and the chart, TAF and density altitude on Pilots', () => {
    for (const id of ['surfaceWind', 'drift', 'hourly', 'daily', 'precip'] as CardId[]) {
      expect(VIEW_CARDS.jumpers).toContain(id);
      expect(VIEW_CARDS.pilots).not.toContain(id);
    }
    for (const id of ['sectional', 'taf', 'densityAltitude', 'pilotLinks', 'nearbyMetars'] as CardId[]) {
      expect(VIEW_CARDS.pilots).toContain(id);
      expect(VIEW_CARDS.jumpers).not.toContain(id);
    }
  });

  it('opens Jumpers on the plain address, so existing links still land on it', () => {
    expect(VIEW_HASH.jumpers).toBe('');
    expect(VIEW_HASH.pilots).toBe('#pilots');
  });

  it('opens the Jumpers tab on the two wind cards, with drift beside the hour it follows', () => {
    expect(VIEW_CARDS.jumpers.slice(0, 3)).toEqual(['surfaceWind', 'windsAloft', 'drift']);
  });
});

describe('the pilot briefing links', () => {
  it('are all https and go to FAA or aviationweather.gov', () => {
    for (const l of PILOT_LINKS) {
      const u = new URL(l.url);
      expect(u.protocol).toBe('https:');
      expect(u.hostname).toMatch(/(^|\.)faa\.gov$|^aviationweather\.gov$/);
      expect(l.note.length).toBeGreaterThan(0);
    }
  });
});
