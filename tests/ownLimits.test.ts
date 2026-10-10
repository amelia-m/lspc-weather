import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { evaluateAdvisories } from '../src/domain/advisories';
import { AdvisoryPanel } from '../src/components/AdvisoryPanel';
import { SurfaceWindPanel } from '../src/components/SurfaceWindPanel';
import { SettingsPanel } from '../src/components/SettingsPanel';
import { HourlyLegend } from '../src/components/common/HourlyChart';
import {
  DEFAULT_THRESHOLDS,
  editableRange,
  editedLimits,
  hasWindLimit,
  isEdited,
  isOwnLimit,
  limitLines,
  ownLimits,
  resolveThresholds,
  sanitizeOverrides,
  WAIVER_TIERS,
  withOverrides,
  type Thresholds,
} from '../src/config/thresholds';
import type { WeatherSnapshot } from '../src/domain/types';
import { normalizeMetar } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';

/* Settings is "Set your own thresholds", open on Licensed only (the
 * maintainer's call, 2026-10-10). There the BSR sets no ground-wind limit,
 * so a wind limit or gust ceiling the reader sets is their own: it draws,
 * lines and flags like a published one, and everything says it is theirs. */

const now = Date.parse('2025-06-27T13:30:00Z');
const at = (wspd: number, wgst: number | null): WeatherSnapshot => ({
  current: normalizeMetar({ ...METAR_FIXTURE[0], wspd, wgst }),
  hourly: [],
  daily: [],
  windsAloft: [],
  sun: null,
  densityAltitude: null,
  taf: null,
});
const licensed = DEFAULT_THRESHOLDS.licensed;
const own = (o: Partial<Thresholds>) => withOverrides(licensed, o);
const flag = (t: Thresholds, wspd: number, wgst: number | null, id: string) =>
  evaluateAdvisories(at(wspd, wgst), t, now, 'kt').find((a) => a.id === id);
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<!-- -->/g, '');

describe('own limits on Licensed', () => {
  it('counts a set limit as the reader’s own, whatever its value, and not as an edit', () => {
    // 25 kt is also Licensed's bar scale; a limit of 25 is still one set.
    for (const kt of [15, 25]) {
      const t = own({ windCautionKt: kt });
      expect(isOwnLimit(t, 'windCautionKt')).toBe(true);
      expect(hasWindLimit(t)).toBe(true);
      expect(isEdited(t, 'windCautionKt')).toBe(false);
    }
    expect(hasWindLimit(withOverrides(licensed))).toBe(false);
    expect(ownLimits(own({ windCautionKt: 15, gustCautionKt: 20 }))).toEqual(['windCautionKt', 'gustCautionKt']);
    expect(editedLimits(own({ windCautionKt: 15, gustCautionKt: 20 }))).toEqual([]);
  });

  it('takes no own limit on a student profile', () => {
    for (const id of ['student', WAIVER_TIERS[0].id] as const) {
      expect(ownLimits(withOverrides(resolveThresholds(id), { windCautionKt: 15 }))).toEqual([]);
    }
  });

  it('flags wind at the reader’s own limit, and says it is theirs', () => {
    expect(flag(withOverrides(licensed), 18, null, 'surface-wind')).toBeUndefined();
    const f = flag(own({ windCautionKt: 15 }), 18, null, 'surface-wind');
    expect(f?.guidance).toContain('The band and flag here use 15 kt, your own limit from Settings; no published source sets one for this profile.');
    expect(flag(own({ windCautionKt: 15 }), 12, 17, 'surface-wind')?.value).toContain('(gusts at or above your limit)');
  });

  it('flags gusts at the reader’s own ceiling, not as a waiver ceiling', () => {
    const f = flag(own({ gustCautionKt: 18 }), 10, 20, 'gust-limit');
    expect(f?.value).toBe('gusting 20 kt, your ceiling 18 kt (set in Settings)');
    expect(f?.guidance).toContain('you set in Settings, which only you can check');
    // The link under it backs the profile's guidance, which the flag quotes
    // (the BSR sets no ground-wind limit for licensed jumpers), not the figure.
    expect(f?.guidance).toContain('No USPA ground-wind limit for licensed jumpers');
    expect(f?.value).not.toContain('waiver');
  });

  const card = (t: Thresholds) =>
    html(createElement(SurfaceWindPanel, { current: at(18, 22).current, thresholds: t, label: 'Licensed', unit: 'kt', onUnitChange: () => {} }));
  /** The card's note on what this dashboard does, the paragraph before the
   *  BSR's guidance. */
  const ownNote = (h: string) => /<p class="muted small"><strong>No published limit for this profile[\s\S]*?<\/p>/.exec(h)?.[0] ?? '';

  it('draws the band and names it as theirs on the Surface wind card, with no link for the figure', () => {
    const set = card(own({ windCautionKt: 15, gustCautionKt: 20 }));
    expect(set).toContain('band-caution');
    expect(set).toContain('Your limit ≥ 15 kt');
    expect(set).toContain('Your gust ceiling 20 kt');
    expect(set).toContain('Licensed — your own limits');
    const note = ownNote(set);
    expect(note).toContain('Your wind limit and your gust ceiling come from Settings, not a published source, and only you can check them');
    expect(note).not.toContain('No wind limit is set');
    expect(note).not.toContain('<a ');
    const unset = card(withOverrides(licensed));
    expect(unset).not.toContain('band-caution');
    expect(ownNote(unset)).toContain('You can set your own limit in Settings');
  });

  it('names the figures in the note even with no wind reading', () => {
    const noWind = html(
      createElement(SurfaceWindPanel, { current: null, thresholds: own({ windCautionKt: 15 }), label: 'Licensed', unit: 'kt', onUnitChange: () => {} }),
    );
    expect(ownNote(noWind)).toContain('Your wind limit (15 kt) comes from Settings, not a published source');
  });

  it('with only a gust ceiling set, draws that and does not say there is no band', () => {
    const gustOnly = card(own({ gustCautionKt: 20 }));
    expect(gustOnly).toContain('band-gust');
    expect(gustOnly).not.toContain('band-caution');
    expect(ownNote(gustOnly)).toContain('Your gust ceiling comes from Settings, not a published source');
    expect(gustOnly).not.toContain('no band to draw');
    // The steady wind is still unchecked, and the card says so.
    expect(ownNote(gustOnly)).toContain('No wind limit is set, so the sustained wind draws no band and raises no flag at any speed.');
  });

  it('draws the chart lines as theirs', () => {
    expect(limitLines(own({ windCautionKt: 15 }))).toEqual([{ kind: 'wind', kt: 15, edited: false, own: true }]);
    expect(limitLines(withOverrides(licensed))).toEqual([]);
    const legend = html(createElement(HourlyLegend, { unit: 'kt', limits: own({ windCautionKt: 15 }), profile: 'Licensed' }));
    expect(legend).toContain('your wind limit');
    expect(legend).toContain('Limit lines: your own, set in Settings.');
  });

  it('says the steady wind goes unflagged when only a gust ceiling is set, with other flags listed or none', () => {
    const steady = 'You have set no wind limit, so the sustained wind is not flagged at any speed';
    const overcast = { id: 'overcast', level: 'caution' as const, metric: 'Sky', value: 'OVC015', guidance: 'g', citation: { source: 's', ref: 'r', url: 'https://example.org/' } };
    for (const advisories of [[], [overcast]]) {
      const list = html(createElement(AdvisoryPanel, { advisories, profile: 'Licensed', hasWindLimit: false, ownLimits: ['Your gust ceiling'] }));
      expect(list).toContain(steady);
      // Not "surface wind is never flagged": the gust ceiling flags gusts.
      expect(list).not.toContain('Surface wind is never flagged');
    }
    const withWind = html(createElement(AdvisoryPanel, { advisories: [], profile: 'Licensed', hasWindLimit: true, ownLimits: ['Your wind limit', 'Your gust ceiling'] }));
    expect(withWind).not.toContain(steady);
  });

  it('names them on the advisory list', () => {
    const list = html(createElement(AdvisoryPanel, { advisories: [], profile: 'Licensed', hasWindLimit: true, ownLimits: ['Your wind limit'] }));
    expect(list).toContain('Your own limits, from Settings:</strong> Your wind limit.');
    expect(list).not.toContain('never flagged');
  });
});

describe('the Set your own thresholds panel', () => {
  const panel = (t: Thresholds, base: Thresholds) =>
    html(createElement(SettingsPanel, { thresholds: t, base, label: 'x', modified: false, onChange: () => {}, onReset: () => {} }));

  it('is closed on every student profile, and says why', () => {
    for (const id of ['student', ...WAIVER_TIERS.map((w) => w.id)] as const) {
      const p = panel(resolveThresholds(id), resolveThresholds(id));
      expect(p).toContain('Set your own thresholds');
      expect(p).toContain('Not on a student profile.');
      expect(p).not.toContain('<input');
    }
  });

  it('on Licensed, offers an empty wind limit and gust ceiling and says where they appear', () => {
    const p = panel(withOverrides(licensed), licensed);
    expect(p).toContain('appears in the charts, the Surface wind card and the flags');
    expect(p).toContain('Your wind limit');
    expect(p).toContain('Your gust ceiling');
    expect(p.match(/placeholder="none" value=""/g)).toHaveLength(2);
    // The field takes its bounds from editableRange, as the stored-value
    // check does; the visibility minimum is on the field's own step.
    const wind = editableRange(licensed, 'windCautionKt');
    expect(p.match(new RegExp(`min="${wind.min}" max="${wind.max}" placeholder="none"`, 'g'))).toHaveLength(2);
    expect(p).toContain(`step="0.5" min="${editableRange(licensed, 'visibilityCautionSm').min}" value="3"`);
    expect(editableRange(licensed, 'visibilityCautionSm').min % 0.5).toBe(0);
    expect(p).not.toContain('may be retired');
  });
});

describe('stored values', () => {
  it('drops a stored student edit and keeps a licensed own limit', () => {
    expect(
      sanitizeOverrides({ student: { windCautionKt: 20 }, licensed: { windCautionKt: 15, gustCautionKt: 20, visibilityCautionSm: 4, foo: 1 } }),
    ).toEqual({ licensed: { windCautionKt: 15, gustCautionKt: 20, visibilityCautionSm: 4 } });
    expect(sanitizeOverrides({ licensed: { windCautionKt: 'x' } })).toEqual({});
    // An own limit outside what the field accepts: 0 would flag a calm, and
    // a huge one only stretches the charts.
    expect(sanitizeOverrides({ licensed: { windCautionKt: 0, gustCautionKt: 1e9 } })).toEqual({});
    // The edges are kept: the field's clamp lands on them.
    expect(sanitizeOverrides({ licensed: { windCautionKt: 1, gustCautionKt: 100 } })).toEqual({
      licensed: { windCautionKt: 1, gustCautionKt: 100 },
    });
    expect(sanitizeOverrides({ licensed: { visibilityCautionSm: -1 } })).toEqual({});
    // What the field accepts is what is kept: editableRange's edges.
    for (const key of ['windCautionKt', 'gustCautionKt', 'visibilityCautionSm'] as const) {
      const { min, max } = editableRange(licensed, key);
      expect(sanitizeOverrides({ licensed: { [key]: min } })).toEqual({ licensed: { [key]: min } });
      expect(sanitizeOverrides({ licensed: { [key]: min - 0.01 } })).toEqual({});
      if (Number.isFinite(max)) expect(sanitizeOverrides({ licensed: { [key]: max + 0.01 } })).toEqual({});
    }
  });
});
