import { describe, expect, it } from 'vitest';
import { evaluateAdvisories } from '../src/domain/advisories';
import { DEFAULT_THRESHOLDS, resolveThresholds } from '../src/config/thresholds';
import type { WeatherSnapshot } from '../src/domain/types';
import { normalizeMetar } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';

const now = Date.parse('2025-06-27T13:30:00Z');

function snapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    current: normalizeMetar(METAR_FIXTURE[0]),
    hourly: [],
    daily: [],
    windsAloft: [],
    sun: null,
    densityAltitude: null,
    taf: null,
    ...overrides,
  };
}

describe('evaluateAdvisories', () => {
  it('flags the gusty surface wind in the KPMV fixture', () => {
    const out = evaluateAdvisories(snapshot(), DEFAULT_THRESHOLDS.student, now);
    expect(out.some((a) => a.id === 'gust-spread')).toBe(true);
  });

  it('every advisory carries a non-empty citation URL', () => {
    const out = evaluateAdvisories(snapshot(), DEFAULT_THRESHOLDS.student, now);
    expect(out.length).toBeGreaterThan(0);
    for (const a of out) {
      expect(a.citation.url).toMatch(/^https?:\/\//);
      expect(a.citation.source.length).toBeGreaterThan(0);
    }
  });

  it('never emits a go/no-go verdict — only info/watch/caution levels', () => {
    const out = evaluateAdvisories(snapshot(), DEFAULT_THRESHOLDS.student, now);
    for (const a of out) {
      expect(['info', 'watch', 'caution']).toContain(a.level);
    }
  });

  it('flags low visibility against 14 CFR 105.17', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], visib: 2 });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    const vis = out.find((a) => a.id === 'visibility');
    expect(vis?.level).toBe('caution');
    expect(vis?.citation.source).toContain('105.17');
  });

  it('flags a thunderstorm from present weather', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wxString: 'TSRA' });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    expect(out.some((a) => a.id === 'thunderstorm' && a.level === 'caution')).toBe(true);
  });

  it('after-sunset advisory cites 14 CFR 105.19 and invents no "night rating"', () => {
    const snap = snapshot({ sun: { sunrise: now - 8 * 3600_000, sunset: now - 3600_000 } });
    const out = evaluateAdvisories(snap, DEFAULT_THRESHOLDS.student, now);
    const day = out.find((a) => a.id === 'daylight');
    expect(day?.level).toBe('caution');
    expect(day?.citation.source).toContain('105.19');
    // USPA has no "night rating" — night jumps need a B license, not a rating.
    expect(JSON.stringify(out).toLowerCase()).not.toContain('night rating');
  });

  it('LSPC waiver (0–5 jumps) flags wind over 15 mph and gust at/over the 16 mph ceiling', () => {
    // 14 kt ≈ 16 mph sustained, gusting 15 kt ≈ 17 mph.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 14, wgst: 15 });
    const out = evaluateAdvisories(snapshot({ current }), resolveThresholds('waiver:0-5'), now);
    const wind = out.find((a) => a.id === 'surface-wind');
    const gust = out.find((a) => a.id === 'gust-limit');
    expect(wind?.level).toBe('caution');
    expect(wind?.citation.source).toContain('LSPC');
    expect(gust?.level).toBe('caution');
    expect(gust?.citation.source).toContain('LSPC');
  });

  it('non-waiver profiles do not emit a gust-limit advisory', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 14, wgst: 30 });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    expect(out.some((a) => a.id === 'gust-limit')).toBe(false);
  });

  it('unreported wind speed (null) yields no surface-wind or gust-spread advisory', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: null, wgst: null });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    expect(out.some((a) => a.id === 'surface-wind')).toBe(false);
    expect(out.some((a) => a.id === 'gust-spread')).toBe(false);
  });

  it('gust-limit and surface-wind advisories still fire on gust alone when sustained speed is null', () => {
    // waiver:0-5 gust ceiling is exceeded by a 15 kt gust even with no sustained reading;
    // the 15 kt gust also puts the effective wind over the ~13 kt sustained limit.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: null, wgst: 15 });
    const out = evaluateAdvisories(snapshot({ current }), resolveThresholds('waiver:0-5'), now);
    expect(out.find((a) => a.id === 'surface-wind')?.level).toBe('caution');
    expect(out.find((a) => a.id === 'gust-limit')?.level).toBe('caution');
  });

  it('flags gusts over the student limit even when the sustained speed is well under it', () => {
    // Sustained 7 kt is fine, but gusting 14 kt (~16 mph) exceeds the ~12 kt student caution.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 7, wgst: 14 });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    const wind = out.find((a) => a.id === 'surface-wind');
    expect(wind?.level).toBe('caution');
    expect(wind?.value).toContain('gusts exceed limit');
  });

  it('sustained speed alone still levels the advisory when no gust is reported', () => {
    // 11 kt sustained, no gust: at/above the student 10 kt watch, below the 12 kt caution.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 11, wgst: null });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    expect(out.find((a) => a.id === 'surface-wind')?.level).toBe('watch');
  });

  it('surface-wind advisory fires on a gust reading alone (sustained unreported)', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: null, wgst: 14 });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    const wind = out.find((a) => a.id === 'surface-wind');
    expect(wind?.level).toBe('caution');
    expect(wind?.value).toContain('gusting 14 kt');
  });

  it('no surface-wind advisory when both sustained and gust are under the watch level', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 5, wgst: 9 });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    expect(out.some((a) => a.id === 'surface-wind')).toBe(false);
  });

  it('student wind limits flag earlier than licensed', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 13, wgst: null });
    const s = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    const l = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.licensed, now);
    expect(s.some((a) => a.id === 'surface-wind')).toBe(true);
    expect(l.some((a) => a.id === 'surface-wind')).toBe(false);
  });
});
