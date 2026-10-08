import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  advisoriesFor,
  VIEW_CARDS,
  VIEW_HASH,
  VIEW_USES_PROFILE,
  type CardId,
} from '../src/config/views';
import { evaluateAdvisories } from '../src/domain/advisories';
import { normalizeMetar } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';
import { resolveThresholds, withOverrides } from '../src/config/thresholds';
import { AdvisoryPanel } from '../src/components/AdvisoryPanel';
import type { WeatherSnapshot } from '../src/domain/types';
import { pilotLinks } from '../src/config/sources';

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
    for (const l of pilotLinks(Date.parse('2026-10-08T12:00:00Z'))) {
      const u = new URL(l.url);
      expect(u.protocol).toBe('https:');
      expect(u.hostname).toMatch(/(^|\.)faa\.gov$|^aviationweather\.gov$/);
      expect(l.note.length).toBeGreaterThan(0);
    }
  });
});

/* The wind-limit profile picks a jumper's ground-wind limit. On the Pilots
 * tab it is not offered, and the two flags it drives are left off. Tested in
 * conditions that trip both, on a waiver tier, which has both. */
describe('the Pilots tab and the jumper wind limits', () => {
  const now = Date.parse('2025-06-27T13:30:00Z');
  const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 25, wgst: 35, visib: 2 });
  const snapshot: WeatherSnapshot = {
    current,
    hourly: [],
    daily: [],
    windsAloft: [],
    sun: null,
    densityAltitude: null,
    taf: null,
  };
  const all = evaluateAdvisories(snapshot, resolveThresholds('waiver:0-5'), now, 'kt');

  it('offers the profile and Settings on the Jumpers tab only, and fires Pilots flags on published figures', async () => {
    // The wiring lives in App.tsx, which no test renders (it fetches). Read it.
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync: (p: string, e: string) => string };
    const app = fs.readFileSync(decodeURIComponent(new URL('../src/App.tsx', import.meta.url).pathname), 'utf8');
    expect(VIEW_USES_PROFILE).toEqual({ jumpers: true, pilots: false });
    expect(app).toMatch(/const advisoryThresholds = VIEW_USES_PROFILE\[view\] \? thresholds : base;/);
    expect(app).toMatch(/useWeatherData\(advisoryThresholds, unit\)/);
    expect(app).toMatch(/advisories=\{advisoriesFor\(view, advisories\)\}/);
    expect(app).toMatch(/forPilots=\{!VIEW_USES_PROFILE\[view\]\}/);
    expect(app).toMatch(/\{VIEW_USES_PROFILE\[view\] && <ProfileSelector profile=\{profile\} onChange=\{setProfile\} \/>\}/);
    expect(app).toMatch(/\{VIEW_USES_PROFILE\[view\] && \(\s*<SettingsPanel/);
  });

  it('would fire the Pilots visibility flag even with a Jumpers edit that silences it', () => {
    // What advisoryThresholds guards against: Student with visibility edited
    // to 1 SM, in 2 SM.
    const hazy = { ...snapshot, current: normalizeMetar({ ...METAR_FIXTURE[0], visib: 2 }) };
    const student = resolveThresholds('student');
    const edited = withOverrides(student, { visibilityCautionSm: 1 });
    expect(evaluateAdvisories(hazy, edited, now, 'kt').some((a) => a.id === 'visibility')).toBe(false);
    expect(evaluateAdvisories(hazy, student, now, 'kt').some((a) => a.id === 'visibility')).toBe(true);
  });

  it('leaves the jumper wind flags off the Pilots list, and keeps the rest', () => {
    const ids = all.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['surface-wind', 'gust-limit', 'visibility']));
    expect(advisoriesFor('jumpers', all).map((a) => a.id)).toEqual(ids);
    const pilots = advisoriesFor('pilots', all).map((a) => a.id);
    expect(pilots).not.toContain('surface-wind');
    expect(pilots).not.toContain('gust-limit');
    expect(pilots).toEqual(ids.filter((id) => id !== 'surface-wind' && id !== 'gust-limit'));
  });

  it('says on the Pilots list where the jumper wind limits are, empty or not', () => {
    const panel = (advisories: typeof all, forPilots: boolean, hasSourcedWindLimit = true) =>
      renderToStaticMarkup(
        createElement(AdvisoryPanel, { advisories, profile: 'Licensed', hasSourcedWindLimit, forPilots }),
      );
    for (const list of [[], advisoriesFor('pilots', all)]) {
      const html = panel(list, true, false);
      expect(html).toContain('Jumper wind limits are not flagged here.');
      // The Licensed profile's own note is a jumper's, not a pilot's.
      expect(html).not.toContain('never flagged on the Licensed profile');
    }
    expect(panel([], true)).toContain('not clearance to fly the load: the pilot in command decides.');
    expect(panel([], false)).toContain('not clearance to jump');
    expect(panel(all, false)).not.toContain('Jumper wind limits are not flagged here.');
  });
});

describe('the pilot links open on the drop zone where the service allows', () => {
  const links = pilotLinks(Date.parse('2026-10-08T12:00:00Z'));
  const byLabel = (start: string) => new URL(links.find((l) => l.label.startsWith(start))!.url);

  it('centres the GFA and the SIGMET map on the drop zone', () => {
    for (const start of ['Graphical Forecasts', 'SIGMETs']) {
      const u = byLabel(start);
      expect(u.pathname).toBe('/gfa/');
      expect(u.searchParams.get('center')).toBe('40.8675,-96.11');
      expect(Number(u.searchParams.get('zoom'))).toBeGreaterThanOrEqual(7);
    }
    // The public SIGMET map, not the signed-in "SIGMET Preview" at /sigmet/.
    expect(byLabel('SIGMETs').searchParams.get('tab')).toBe('sigmet');
    // Each names its tab, or the GFA reopens on the last one used.
    expect(byLabel('Graphical Forecasts').searchParams.get('tab')).toBe('gairmet');
  });

  it('opens Plattsmouth in the current Chart Supplement edition', () => {
    const u = byLabel('Chart Supplement');
    expect(u.pathname).toMatch(/\/dafd\/search\/results\/$/);
    expect(u.searchParams.get('ident')).toBe('KPMV');
    expect(u.searchParams.get('cycle')).toBe('2609');
    expect(new URL(pilotLinks(Date.parse('2026-11-01T00:00:00Z')).find((l) => l.label.startsWith('Chart'))!.url).searchParams.get('cycle')).toBe('2611');
  });
});

