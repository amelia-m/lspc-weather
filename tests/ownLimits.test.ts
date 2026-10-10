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
    expect(f?.guidance).toContain('you set in Settings');
    expect(f?.value).not.toContain('waiver');
  });

  it('draws the band and names it as theirs on the Surface wind card, with no source link for it', () => {
    const card = (t: Thresholds) =>
      html(createElement(SurfaceWindPanel, { current: at(18, 22).current, thresholds: t, label: 'Licensed', unit: 'kt', onUnitChange: () => {} }));
    const set = card(own({ windCautionKt: 15, gustCautionKt: 20 }));
    expect(set).toContain('band-caution');
    expect(set).toContain('Your limit ≥ 15 kt');
    expect(set).toContain('Your gust ceiling 20 kt');
    expect(set).toContain('Licensed — your own limits');
    expect(set).toContain('Your own, set in Settings. No published source sets a wind limit or gust ceiling for this profile');
    const unset = card(withOverrides(licensed));
    expect(unset).not.toContain('band-caution');
    expect(unset).toContain('You can set your own limit in Settings');
  });

  it('draws the chart lines as theirs', () => {
    expect(limitLines(own({ windCautionKt: 15 }))).toEqual([{ kind: 'wind', kt: 15, edited: false, own: true }]);
    expect(limitLines(withOverrides(licensed))).toEqual([]);
    const legend = html(createElement(HourlyLegend, { unit: 'kt', limits: own({ windCautionKt: 15 }), profile: 'Licensed' }));
    expect(legend).toContain('your wind limit');
    expect(legend).toContain('Limit lines: your own, set in Settings.');
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
    expect(p).not.toContain('may be retired');
  });
});

describe('stored values', () => {
  it('drops a stored student edit and keeps a licensed own limit', () => {
    expect(
      sanitizeOverrides({ student: { windCautionKt: 20 }, licensed: { windCautionKt: 15, gustCautionKt: 20, visibilityCautionSm: 4, foo: 1 } }),
    ).toEqual({ licensed: { windCautionKt: 15, gustCautionKt: 20, visibilityCautionSm: 4 } });
    expect(sanitizeOverrides({ licensed: { windCautionKt: 'x' } })).toEqual({});
  });
});
