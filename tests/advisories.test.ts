import { describe, expect, it } from 'vitest';
import { evaluateAdvisories } from '../src/domain/advisories';
import { DEFAULT_THRESHOLDS } from '../src/config/thresholds';
import type { WeatherSnapshot } from '../src/domain/types';
import { normalizeMetar } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';

const now = Date.parse('2025-06-27T13:30:00Z');

function snapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    current: normalizeMetar(METAR_FIXTURE[0]),
    hourly: [],
    windsAloft: [],
    sun: null,
    densityAltitude: null,
    taf: null,
    ...overrides,
  };
}

describe('evaluateAdvisories', () => {
  it('flags the gusty surface wind in the KPMV fixture', () => {
    const out = evaluateAdvisories(snapshot(), DEFAULT_THRESHOLDS.student, 'student', now);
    expect(out.some((a) => a.id === 'gust-spread')).toBe(true);
  });

  it('every advisory carries a non-empty citation URL', () => {
    const out = evaluateAdvisories(snapshot(), DEFAULT_THRESHOLDS.student, 'student', now);
    expect(out.length).toBeGreaterThan(0);
    for (const a of out) {
      expect(a.citation.url).toMatch(/^https?:\/\//);
      expect(a.citation.source.length).toBeGreaterThan(0);
    }
  });

  it('never emits a go/no-go verdict — only info/watch/caution levels', () => {
    const out = evaluateAdvisories(snapshot(), DEFAULT_THRESHOLDS.student, 'student', now);
    for (const a of out) {
      expect(['info', 'watch', 'caution']).toContain(a.level);
    }
  });

  it('flags low visibility against 14 CFR 105.17', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], visib: 2 });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, 'student', now);
    const vis = out.find((a) => a.id === 'visibility');
    expect(vis?.level).toBe('caution');
    expect(vis?.citation.source).toContain('105.17');
  });

  it('flags a thunderstorm from present weather', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wxString: 'TSRA' });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, 'student', now);
    expect(out.some((a) => a.id === 'thunderstorm' && a.level === 'caution')).toBe(true);
  });

  it('after-sunset advisory cites 14 CFR 105.19 and invents no "night rating"', () => {
    const snap = snapshot({ sun: { sunrise: now - 8 * 3600_000, sunset: now - 3600_000 } });
    const out = evaluateAdvisories(snap, DEFAULT_THRESHOLDS.student, 'student', now);
    const day = out.find((a) => a.id === 'daylight');
    expect(day?.level).toBe('caution');
    expect(day?.citation.source).toContain('105.19');
    // USPA has no "night rating" — night jumps need a B license, not a rating.
    expect(JSON.stringify(out).toLowerCase()).not.toContain('night rating');
  });

  it('student wind limits flag earlier than licensed', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 13, wgst: null });
    const s = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, 'student', now);
    const l = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.licensed, 'licensed', now);
    expect(s.some((a) => a.id === 'surface-wind')).toBe(true);
    expect(l.some((a) => a.id === 'surface-wind')).toBe(false);
  });
});
