import { describe, expect, it } from 'vitest';
import { evaluateAdvisories } from '../src/domain/advisories';
import { CITATIONS, DEFAULT_THRESHOLDS, resolveThresholds } from '../src/config/thresholds';
import type { HourlyPoint, WeatherSnapshot } from '../src/domain/types';
import { normalizeMetar } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';

const now = Date.parse('2025-06-27T13:30:00Z');

/** Minimal hourly point at `now + hoursAhead`, with overrides. */
const hourAhead = (hoursAhead: number, over: Partial<HourlyPoint> = {}): HourlyPoint => ({
  time: now + hoursAhead * 3600_000,
  skyCoverPct: null,
  ceilingFtAgl: null,
  visibilitySm: null,
  windSpeedKt: null,
  windGustKt: null,
  windDirectionDeg: null,
  precipProbPct: null,
  thunderProbPct: null,
  precipAmountIn: null,
  tempC: null,
  ...over,
});

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
  it('does not flag gust spread — no published source sets a spread', () => {
    // The fixture gusts 22 kt on 12 kt sustained, a 10 kt spread that used to
    // raise "Gusty wind" at the app's own 8 kt. Nobody publishes a spread
    // threshold, so the flag went the way of the other untraceable ones.
    const out = evaluateAdvisories(snapshot(), DEFAULT_THRESHOLDS.student, now);
    expect(out.some((a) => a.id === 'gust-spread')).toBe(false);
  });

  it('every advisory carries a citation that points somewhere', () => {
    const out = evaluateAdvisories(snapshot(), DEFAULT_THRESHOLDS.student, now);
    expect(out.length).toBeGreaterThan(0);
    for (const a of out) {
      expect(a.citation.url).toMatch(/^https:\/\//);
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

  it('does not flag flight category when conditions are VFR', () => {
    // Base fixture: ceiling 4500 ft, 10 SM → VFR.
    const out = evaluateAdvisories(snapshot(), DEFAULT_THRESHOLDS.student, now);
    expect(out.some((a) => a.id === 'flight-category')).toBe(false);
  });

  it('flags an IFR flight category (from visibility) citing the AIM category def', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], visib: 2 });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    const fc = out.find((a) => a.id === 'flight-category');
    expect(fc?.level).toBe('caution');
    expect(fc?.value).toContain('IFR');
    // VFR/MVFR/IFR/LIFR are defined in the AIM, not 14 CFR 91.155.
    expect(fc?.citation.source).toContain('AIM');
  });

  it('flags a marginal (MVFR) ceiling as watch', () => {
    // Lower the BKN base to 2000 ft → MVFR ceiling.
    const current = normalizeMetar({
      ...METAR_FIXTURE[0],
      clouds: [{ cover: 'BKN', base: 2000 }],
    });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    const fc = out.find((a) => a.id === 'flight-category');
    expect(fc?.level).toBe('watch');
    expect(fc?.value).toContain('MVFR');
  });

  it('flags a thunderstorm from present weather', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wxString: 'TSRA' });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    expect(out.some((a) => a.id === 'thunderstorm' && a.level === 'caution')).toBe(true);
  });

  it('renders advisory wind values in the selected unit (mph)', () => {
    // Sustained 20 kt gusting 28 kt, over the waiver gust ceiling so both a
    // wind flag and a gust flag are on screen in the same unit.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 20, wgst: 28 });
    const t = resolveThresholds('waiver:0-5');
    const kt = evaluateAdvisories(snapshot({ current }), t, now, 'kt');
    const mph = evaluateAdvisories(snapshot({ current }), t, now, 'mph');

    expect(kt.find((a) => a.id === 'surface-wind')?.value).toContain('20 kt');
    expect(mph.find((a) => a.id === 'surface-wind')?.value).toMatch(/2[0-9] mph/);

    const gustMph = mph.find((a) => a.id === 'gust-limit');
    expect(gustMph?.value).toContain('mph');
    expect(gustMph?.value).not.toMatch(/\bkt\b/);
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

  it('states the gust and the waiver ceiling in the SAME unit', () => {
    // The 0-5 tier ceiling is 16 mph = 13.9 kt, so a 14 kt gust is genuinely
    // over it. Printing the waiver's native mph beside a kt gust read as
    // "14 vs 16" — apparent headroom, contradicting the caution being raised.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 10, wgst: 14 });
    const t = resolveThresholds('waiver:0-5');

    const inKt = evaluateAdvisories(snapshot({ current }), t, now, 'kt')
      .find((a) => a.id === 'gust-limit');
    expect(inKt?.value).toContain('gusting 14 kt');
    expect(inKt?.value).toContain('ceiling 14 kt');
    expect(inKt?.value).not.toContain('mph');

    const inMph = evaluateAdvisories(snapshot({ current }), t, now, 'mph')
      .find((a) => a.id === 'gust-limit');
    expect(inMph?.value).toContain('gusting 16 mph');
    expect(inMph?.value).toContain('ceiling 16 mph');
    expect(inMph?.value).not.toContain(' kt');
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

  it('sustained speed alone still raises the advisory when no gust is reported', () => {
    // 12 kt sustained, no gust: exactly the USPA student caution band.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 12, wgst: null });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    expect(out.find((a) => a.id === 'surface-wind')?.level).toBe('caution');
  });

  it('raises nothing below the published limit, where the old watch band used to fire', () => {
    // 11 kt sustained sat in the app's own "watch" band (caution − 2 kt) and
    // raised a flag. Nobody publishes an early-warning speed, so the only level
    // left is the sourced one and 11 kt is under it.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 11, wgst: null });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    expect(out.some((a) => a.id === 'surface-wind')).toBe(false);
  });

  it('waiver tiers flag at the posted limit, not 3 mph under it', () => {
    // The 0–5 tier posts 15 mph (13.03 kt). The app used to raise a watch from
    // 12 mph (10.4 kt) — a number that appears nowhere on the posted sign, and
    // that an 11 kt wind crossed.
    const t = resolveThresholds('waiver:0-5');
    const under = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 11, wgst: null });
    const at = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 14, wgst: null });
    expect(
      evaluateAdvisories(snapshot({ current: under }), t, now).some((a) => a.id === 'surface-wind'),
    ).toBe(false);
    expect(
      evaluateAdvisories(snapshot({ current: at }), t, now).find((a) => a.id === 'surface-wind')
        ?.level,
    ).toBe('caution');
  });

  it('surface-wind advisory fires on a gust reading alone (sustained unreported)', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: null, wgst: 14 });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    const wind = out.find((a) => a.id === 'surface-wind');
    expect(wind?.level).toBe('caution');
    expect(wind?.value).toContain('gusting 14 kt');
  });

  it('no surface-wind advisory when both sustained and gust are under the published limit', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 5, wgst: 9 });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    expect(out.some((a) => a.id === 'surface-wind')).toBe(false);
  });

  it('flags the student limit while the licensed profile stays silent', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 13, wgst: null });
    const s = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now);
    const l = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.licensed, now);
    expect(s.some((a) => a.id === 'surface-wind')).toBe(true);
    expect(l.some((a) => a.id === 'surface-wind')).toBe(false);
  });
});

/* Borrowed authority: a flag firing on a number the app invented must not wear
 * a USPA or FAA source line. The citation is the only part of a flag a reader
 * can check, so a wrong one is worse than none — it looks verified. */
describe('flags whose trigger no published source sets', () => {
  /** These fired on thresholds the app invented — ceiling bands, a dew-point
   *  spread, a chance of rain, a chance of storms, a density altitude so many
   *  feet above the field, so many minutes before sunset. No rule, BSR or club
   *  policy puts a number on any of them, so there is nothing a reader could
   *  check. They were removed rather than relabelled: on a page whose premise is
   *  that every flag is traceable, an untraceable flag is the defect.
   *
   *  `daylight` is the one id that still exists: its after-sunset half fires on
   *  an astronomical fact and cites 14 CFR 105.19 (covered above). Only the
   *  "last load" watch in front of it is gone, which is why it is listed here
   *  against a snapshot where the sun has not yet set. */
  const REMOVED_FLAGS = [
    'ceiling',
    'dewpoint-spread',
    'precip',
    'thunder-forecast',
    'density-altitude',
    'daylight',
  ];

  /** Conditions that would have tripped every one of them at once. */
  function wouldHaveTripped() {
    return snapshot({
      current: normalizeMetar({
        ...METAR_FIXTURE[0],
        clouds: [{ cover: 'BKN', base: 2000 }],
        temp: 20,
        dewp: 19,
      }),
      hourly: [hourAhead(2, { precipProbPct: 60, thunderProbPct: 35 })],
      // +3,600 ft above the field — past every DA band the app used to draw
      // (2,000 / 3,500 ft student, 2,500 / 4,000 ft licensed).
      densityAltitude: {
        densityAltitudeFt: 4800,
        pressureAltitudeFt: 1500,
        isaDeviationC: 15,
        fieldElevationFt: 1200,
        humidityCorrected: false,
      },
      // 20 minutes of daylight left: inside both old "last load" watches
      // (45 min student, 30 licensed), but the sun is still up, so 105.19 —
      // the only sourced half of that flag — does not apply yet.
      sun: { sunrise: now - 8 * 3600_000, sunset: now + 20 * 60_000 },
    });
  }

  it.each(REMOVED_FLAGS)('%s does not fire, even in conditions that would trip it', (id) => {
    const out = evaluateAdvisories(wouldHaveTripped(), DEFAULT_THRESHOLDS.student, now);
    expect(out.find((a) => a.id === id)).toBeUndefined();
  });

  it('every surviving flag carries a citation to a source outside this app', () => {
    const out = evaluateAdvisories(wouldHaveTripped(), DEFAULT_THRESHOLDS.student, now);
    expect(out.length).toBeGreaterThan(0);
    for (const a of out) {
      expect(a.citation, `${a.id} has no citation`).toBeDefined();
      expect(a.citation.url, `${a.id} cites an in-app URL`).toMatch(/^https:\/\//);
    }
  });
});

/* The licensed profile is the sharp edge of the rule above: its guidance says
 * no USPA limit binds a licensed jumper, and both bands it used to fire on
 * (17 kt watch, 25 kt caution) were this dashboard's own. Nothing published
 * sets a surface-wind trigger for licensed jumpers, so no surface-wind flag
 * fires for them at any speed. The Surface wind card still prints the reading
 * and says it has no sourced limit to draw — the reader judges it. */
describe('surface wind where no published limit exists (licensed)', () => {
  const winds: Array<[number | null, number | null]> = [
    [13, null], // over the student limit
    [18, null], // over the old 17 kt watch
    [26, null], // over the old 25 kt caution
    [30, 45], // far over both, gusting harder still
    [null, 40], // gust alone, which used to be enough on its own
  ];

  it.each(winds)('raises no surface-wind flag at %s kt sustained / %s kt gust', (wspd, wgst) => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd, wgst });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.licensed, now);
    expect(out.some((a) => a.id === 'surface-wind')).toBe(false);
  });

  it('still flags the same wind for a profile whose limit someone published', () => {
    // The wind is not the difference — the existence of a source is.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 30, wgst: 45 });
    for (const id of ['student', 'waiver:0-5', 'waiver:21+'] as const) {
      const out = evaluateAdvisories(snapshot({ current }), resolveThresholds(id), now);
      expect(out.find((a) => a.id === 'surface-wind')?.level, id).toBe('caution');
    }
  });

  it('leaves the other licensed flags alone', () => {
    // Removing the wind flag must not quietly take the sourced ones with it.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 30, wgst: 45, visib: 2 });
    const out = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.licensed, now);
    expect(out.some((a) => a.id === 'visibility')).toBe(true);
    expect(out.some((a) => a.id === 'flight-category')).toBe(true);
  });
});

describe('citations that name a regulation', () => {
  it('the flight-category flag does not name 14 CFR 91.155 while citing the AIM', () => {
    // The AIM is non-regulatory and does not contain 91.155, so the one link
    // offered could not support the one rule named.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], visib: 2 });
    const fc = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now).find(
      (a) => a.id === 'flight-category',
    );
    expect(fc?.citation).toBe(CITATIONS.aimFlightCategory);
    expect(fc?.guidance).not.toMatch(/91\.155/);
  });

  it('neither gust spread nor winds aloft raises a flag on an invented speed', () => {
    // Both carried a real citation, but the number that made them appear was
    // the app's: an 8/10 kt spread, and 20/30 kt aloft. A flag nobody can check
    // the trigger of is still a flag nobody can check. The winds-aloft guidance
    // it used to carry now stands on the winds-aloft card for any wind.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 6, wgst: 16 });
    const windsAloft = [
      { altitudeFtAgl: 9000, altitudeFtMsl: 10182, directionDeg: 270, speedKt: 45, tempC: null },
    ];
    for (const id of ['student', 'licensed', 'waiver:0-5'] as const) {
      const out = evaluateAdvisories(snapshot({ current, windsAloft }), resolveThresholds(id), now);
      expect(out.some((a) => a.id === 'gust-spread'), `gust-spread fired for ${id}`).toBe(false);
      expect(out.some((a) => a.id === 'winds-aloft'), `winds-aloft fired for ${id}`).toBe(false);
    }
  });
});
