import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { evaluateAdvisories } from '../src/domain/advisories';
import { AdvisoryPanel } from '../src/components/AdvisoryPanel';
import { CeilingSkyPanel } from '../src/components/CeilingSkyPanel';
import { MetarPanel } from '../src/components/MetarPanel';
import { SurfaceWindPanel } from '../src/components/SurfaceWindPanel';
import { CITATIONS, DEFAULT_THRESHOLDS, resolveThresholds } from '../src/config/thresholds';
import type { Thresholds } from '../src/config/thresholds';
import type { SpeedUnit } from '../src/domain/units';
import type { HourlyPoint, WeatherSnapshot } from '../src/domain/types';
import { normalizeMetar, normalizeNwsObservation } from '../src/domain/normalize';
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

  /* The guidance makes two claims from two authorities: the FAA light
   * requirement and a USPA licence claim. It used to offer only 14 CFR 105.19,
   * so a reader checking the licence half landed on a reg that says nothing
   * about licences. Both must be reachable from the flag. */
  it('after-sunset advisory cites the SIM for its USPA claim, not just the reg', () => {
    const snap = snapshot({ sun: { sunrise: now - 8 * 3600_000, sunset: now - 3600_000 } });
    const day = evaluateAdvisories(snap, DEFAULT_THRESHOLDS.student, now).find(
      (a) => a.id === 'daylight',
    );
    expect(day?.guidance).toMatch(/USPA/);
    expect(day?.secondaryCitation?.url).toBe('https://www.uspa.org/sim/5-3#3A');
    // SIM 5-3 B says participants "should" meet B-licence requirements; it is
    // not a BSR, so the flag must not upgrade it to a requirement.
    expect(day?.guidance).not.toMatch(/USPA (also )?requires/i);
  });

  /* The data field being set is not the same as the reader seeing a link.
   * Deleting the secondaryCitation block from AdvisoryPanel left the whole
   * suite green, because every assertion checked the advisory object. This
   * renders the panel and looks for the second source on screen. */
  it('renders both sources on a flag that carries two', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 20, wgst: 24 });
    const advisories = evaluateAdvisories(
      snapshot({ current }),
      resolveThresholds('waiver:0-5'),
      now,
    );
    const html = renderToStaticMarkup(
      createElement(AdvisoryPanel, {
        advisories,
        profile: '0–5 jumps',
        hasSourcedWindLimit: true,
      }),
    );
    expect(html).toContain('Sources:');
    expect(html).toContain('https://www.uspa.org/sim/2-2');
    expect(html).toContain('lspc-waivered-wind-limits');
  });

  /* The waiver guidance quotes the club's numbers and then the BSR-excursion
   * rule, which is the SIM's rather than the club's. Both must be reachable
   * from the flag — the SIM citation existed in the config for a while wired to
   * nothing at all. */
  it('waiver-tier wind flag cites the SIM waiver rule as well as club policy', () => {
    const current = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 20, wgst: 24 });
    const wind = evaluateAdvisories(
      snapshot({ current }),
      resolveThresholds('waiver:0-5'),
      now,
    ).find((a) => a.id === 'surface-wind');
    expect(wind?.citation.url).toContain('lspc-waivered-wind-limits');
    expect(wind?.secondaryCitation?.url).toBe('https://www.uspa.org/sim/2-2#2B');
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
    // The ceiling keeps a decimal in kt so the posted mph figure survives the
    // conversion — see the tier-collision test below.
    expect(inKt?.value).toContain('ceiling 13.9 kt');
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

/* The two panels below are rendered to static markup rather than asserted on
 * through the evaluator alone, because the defect they fix is not in the
 * evaluator's output — it is in what the page says ABOUT that output. An empty
 * advisory list is correct for a licensed jumper at any wind speed; the bug was
 * a page that printed "no conditions flagged" over a 60 kt gust with nothing to
 * say it could never have flagged it. */

/** Render a panel with no DOM: these components are pure of effects, so static
 *  markup is enough to assert on the words a reader gets. */
const markup = (el: Parameters<typeof renderToStaticMarkup>[0]): string =>
  renderToStaticMarkup(el);

const windPanel = (t: Thresholds, label: string, unit: SpeedUnit, current: unknown): string =>
  markup(
    createElement(SurfaceWindPanel, {
      current: current as never,
      thresholds: t,
      label,
      unit,
      onUnitChange: () => {},
    }),
  );

describe('an empty advisory list is not an all-clear', () => {
  // 45 kt gusting 60, VFR, sun well up: nothing here is flaggable for a
  // licensed jumper, because no published source sets them a wind limit.
  const gale = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 45, wgst: 60 });
  const galeSnapshot = snapshot({
    current: gale,
    sun: { sunrise: now - 5 * 3600_000, sunset: now + 5 * 3600_000 },
  });

  it('licensed in a 60 kt gust really does flag nothing', () => {
    // Not a regression to fix by reintroducing a trigger — nobody published
    // one. It is the premise of the two assertions that follow.
    expect(evaluateAdvisories(galeSnapshot, DEFAULT_THRESHOLDS.licensed, now)).toHaveLength(0);
  });

  it('says why wind can never appear in the list instead of stopping at "nothing flagged"', () => {
    const out = evaluateAdvisories(galeSnapshot, DEFAULT_THRESHOLDS.licensed, now);
    const html = markup(
      createElement(AdvisoryPanel, {
        advisories: out,
        profile: 'Licensed',
        hasSourcedWindLimit: false,
      }),
    );
    expect(html).toContain('No conditions flagged');
    // The clause that keeps the empty state a statement about the app rather
    // than about the weather, plus where the reader goes for the number.
    expect(html).toContain('Surface wind is never flagged on the Licensed profile');
    expect(html).toContain('Surface wind card');
    expect(html).toContain('not clearance to jump');
  });

  it('adds the clause only where no published limit exists', () => {
    // A student's empty list means the wind WAS checked against a sourced
    // limit and came back under it. Qualifying that would be noise.
    const html = markup(
      createElement(AdvisoryPanel, {
        advisories: [],
        profile: 'Student',
        hasSourcedWindLimit: true,
      }),
    );
    expect(html).toContain('No conditions flagged');
    expect(html).not.toContain('never flagged');
    expect(html).toContain('not clearance to jump');
  });

  it('carries the licensed profile’s sourced guidance on the surface-wind card at any speed', () => {
    // The BSR-cited absence and the PIC referral are non-numeric, so removing
    // the invented 25 kt trigger did not make them uncheckable — they belong on
    // the card the way the winds-aloft guidance does, not only when a flag
    // fires (it never does here).
    for (const current of [gale, normalizeMetar({ ...METAR_FIXTURE[0], wspd: 3, wgst: null }), null]) {
      const html = windPanel(DEFAULT_THRESHOLDS.licensed, 'Licensed', 'kt', current);
      expect(html).toContain('No published limit for this profile');
      expect(html).toContain('no surface-wind flag appears under');
      expect(html).toContain('ask the PIC');
      // The BSR cited for the ABSENCE of a limit, reachable as a link.
      expect(html).toContain(CITATIONS.uspaLicensedWinds.url);
    }
  });

  it('does not caption a bandless bar "flag bands"', () => {
    const licensed = windPanel(DEFAULT_THRESHOLDS.licensed, 'Licensed', 'kt', gale);
    expect(licensed).not.toContain('flag bands');
    expect(licensed).toContain('no published limit');
    // The profiles that do draw a band keep the subtitle that describes it.
    expect(windPanel(DEFAULT_THRESHOLDS.student, 'Student', 'kt', gale)).toContain('flag bands');
  });
});

describe('waiver tiers that post different ceilings display different ceilings', () => {
  // The sign reads "gusts less than 19 mph" (10–20 jumps) and "less than
  // 20 mph" (21+). Converted and rounded to whole knots both were "17 kt", so
  // the tier a jumper earned made no visible difference and the dashboard
  // misquoted the policy on a page that asks an instructor to check it against
  // the posted sign.
  const gusty = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 12, wgst: 25 });
  const tiers = ['waiver:10-20', 'waiver:21+'] as const;

  it.each(['kt', 'mph'] as const)('gust-limit advisory distinguishes them in %s', (unit) => {
    const [a, b] = tiers.map(
      (id) =>
        evaluateAdvisories(snapshot({ current: gusty }), resolveThresholds(id), now, unit).find(
          (x) => x.id === 'gust-limit',
        )?.value,
    );
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
    // Same unit on both figures — a kt gust beside an mph ceiling reads as
    // headroom that is not there.
    expect(a).not.toContain(unit === 'kt' ? 'mph' : ' kt');
  });

  it.each(['kt', 'mph'] as const)('card legend distinguishes them in %s', (unit) => {
    const [a, b] = tiers.map((id) =>
      windPanel(resolveThresholds(id), 'LSPC waiver', unit, gusty),
    );
    const legend = (html: string): string =>
      /Gust ceiling ([^<]*)/.exec(html)?.[1].trim() ?? '';
    expect(legend(a)).toBeTruthy();
    expect(legend(a)).not.toBe(legend(b));
  });

  it('prints the posted mph figures verbatim', () => {
    // In the unit the sign is written in, the display is the sign.
    const [a, b] = tiers.map((id) => windPanel(resolveThresholds(id), 'LSPC waiver', 'mph', gusty));
    expect(a).toContain('Gust ceiling 19 mph');
    expect(b).toContain('Gust ceiling 20 mph');
  });
});

/* Read against the sources on 2026-09-23. Each pins a sentence to what its
 * section actually says, so a later edit cannot drift back to a claim the link
 * would not support. */
describe('guidance matches the section as read', () => {
  it('prints both 105.17 visibility rows, since an exit from this DZ is above 10,000 ft MSL', () => {
    // Brown's is at 1,182 ft MSL; a 10,000 ft AGL exit is in the 5 SM row.
    const current = normalizeMetar({ ...METAR_FIXTURE[0], visib: 2 });
    const vis = evaluateAdvisories(snapshot({ current }), DEFAULT_THRESHOLDS.student, now).find(
      (a) => a.id === 'visibility',
    );
    expect(vis?.guidance).toMatch(/3 SM/);
    expect(vis?.guidance).toMatch(/5 SM/);
    expect(vis?.guidance).toMatch(/10,000 ft MSL/);
    // And still fires at the lower row: the reading is surface visibility, and
    // the reg's measure is flight visibility at altitude.
    expect(DEFAULT_THRESHOLDS.student.visibilityCautionSm).toBe(3);
  });

  it('says whose light 105.19 requires, and from when', () => {
    // 105.19(b): displayed by the person descending, from a properly
    // functioning open parachute until the surface. Not a light on the plane.
    const snap = snapshot({ sun: { sunrise: now - 8 * 3600_000, sunset: now - 3600_000 } });
    const day = evaluateAdvisories(snap, DEFAULT_THRESHOLDS.student, now).find(
      (a) => a.id === 'daylight',
    );
    expect(day?.guidance).toMatch(/the jumper to display a light/);
    expect(day?.guidance).toMatch(/3 statute miles/);
    expect(day?.guidance).toMatch(/open canopy/);
  });

  it('the sky card states 105.17 and no longer claims jumps "require VFR flight conditions"', () => {
    // 105.17 never mentions VFR; the pilot's minimums are 91.155, which the
    // app does not cite. MVFR ceiling so the note renders.
    const current = normalizeMetar({
      ...METAR_FIXTURE[0],
      clouds: [{ cover: 'BKN', base: 2000 }],
    });
    const html = markup(createElement(CeilingSkyPanel, { current, hourly: [] }));
    expect(html).not.toMatch(/VFR flight conditions/);
    expect(html).toMatch(/into or through cloud/);
    expect(html).toMatch(/5 SM/);
    expect(html).toMatch(/1 mile horizontal/);
    expect(html).toContain(CITATIONS.far10517.url);
  });
});

/* Seen on the deployed site on 2026-09-23: the KPMV METAR read OVC027 while
 * the Current conditions card said "Clear", the Ceiling card "No ceiling", the
 * pill VFR, and no flag fired — because api.weather.gov's decoded cloudLayers
 * was empty and the app trusted it over the METAR text. These render the two
 * cards and the flags from that report, and from a report with no sky at all. */
describe('a live observation whose API decode is empty', () => {
  const live = (rawMessage: string) =>
    normalizeNwsObservation(
      {
        properties: {
          timestamp: '2026-09-23T03:55:00+00:00',
          rawMessage,
          visibility: { unitCode: 'wmoUnit:m', value: 16090 },
          cloudLayers: [],
        },
      },
      'KPMV',
    );
  const overcast = live('KPMV 230355Z AUTO 08003KT 10SM OVC027 15/13 A3028 RMK AO2 T01530132');
  const unreported = live('');

  it('flags the overcast and the MVFR category from the METAR text', () => {
    const out = evaluateAdvisories(snapshot({ current: overcast }), DEFAULT_THRESHOLDS.student, now);
    expect(out.some((a) => a.id === 'overcast')).toBe(true);
    expect(out.find((a) => a.id === 'flight-category')?.value).toContain('MVFR');
  });

  it('says "OVC 2,700 ft", not "Clear", on the Current conditions card', () => {
    const html = markup(createElement(MetarPanel, { current: overcast, unit: 'kt', onUnitChange: () => {} }));
    expect(html).toContain('OVC 2,700 ft');
    expect(html).not.toMatch(/>Clear</);
  });

  it('says "Height not reported" for a BKN///, not "No ceiling", and shows no VFR pill', () => {
    const heightless = live('KPMV 230355Z AUTO 08003KT 10SM BKN/// 15/13 A3028 RMK AO2');
    const sky = markup(createElement(CeilingSkyPanel, { current: heightless, hourly: [] }));
    expect(sky).toContain('Height not reported');
    expect(sky).not.toContain('No ceiling');
    expect(sky).not.toContain('VFR');
    const metar = markup(createElement(MetarPanel, { current: heightless, unit: 'kt', onUnitChange: () => {} }));
    expect(metar).toMatch(/<dd>BKN<\/dd>/);
  });

  it('says "Not reported" rather than "Clear" or "No ceiling" when there is no sky group, and shows no VFR pill', () => {
    const metar = markup(createElement(MetarPanel, { current: unreported, unit: 'kt', onUnitChange: () => {} }));
    expect(metar).toContain('Not reported');
    expect(metar).not.toMatch(/>Clear</);
    const sky = markup(createElement(CeilingSkyPanel, { current: unreported, hourly: [] }));
    expect(sky).toContain('Not reported');
    expect(sky).not.toContain('No ceiling');
    expect(sky).not.toContain('VFR');
    expect(evaluateAdvisories(snapshot({ current: unreported }), DEFAULT_THRESHOLDS.student, now).some((a) => a.id === 'flight-category')).toBe(false);
  });
});
