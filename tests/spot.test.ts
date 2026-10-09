import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { deployShown, estimateDrift } from '../src/domain/spot';
import { DriftPanel } from '../src/components/DriftPanel';
import type { WindsAloftLevel } from '../src/domain/types';
import { CITATIONS, type License } from '../src/config/thresholds';
import {
  fullProfile,
  REQUESTED_TOP_FT_AGL,
  SHORT_PROFILE_TOP_FT_AGL,
  shortProfile,
} from './support/openMeteoProfiles';
import { withoutGlossaryLinks } from './support/glossaryLinks';

/** Uniform 10 kt wind FROM the west (270°) at every 1,000 ft → drift TOWARD east (90°). */
function uniformLevels(count = 14): WindsAloftLevel[] {
  return Array.from({ length: count }, (_, i) => ({
    altitudeFtAgl: i * 1000,
    altitudeFtMsl: 1182 + i * 1000,
    directionDeg: 270,
    speedKt: 10,
    tempC: null,
  }));
}

describe('estimateDrift', () => {
  const opts = { exitFtAgl: 13000, deployFtAgl: 3000, fallRateMph: 120, canopyRateFpm: 1000 };

  it('drifts downwind (toward east for a west wind)', () => {
    const d = estimateDrift(uniformLevels(), opts);
    expect(d.freefall.towardDeg).toBeCloseTo(90, 1);
    expect(d.canopy.towardDeg).toBeCloseTo(90, 1);
    expect(d.total.towardDeg).toBeCloseTo(90, 1);
  });

  it('matches the closed-form distance for uniform wind', () => {
    const d = estimateDrift(uniformLevels(), opts);
    // freefall: 10 kt = 16.878 ft/s over 10,000 ft at 176 ft/s → 56.82 s → ~959 ft
    expect(d.freefall.distanceFt).toBeCloseTo(959, -1);
    // canopy: 3,000 ft at 16.667 ft/s → 180 s → 16.878 × 180 ≈ 3038 ft
    expect(d.canopy.distanceFt).toBeCloseTo(3038, -1);
    expect(d.total.distanceFt).toBeCloseTo(959 + 3038, -1);
  });

  it('is zero with no winds', () => {
    const calm = uniformLevels().map((l) => ({ ...l, speedKt: 0 }));
    const d = estimateDrift(calm, opts);
    expect(d.total.distanceFt).toBeCloseTo(0, 5);
  });

  it('extrapolates above the highest sample with its wind', () => {
    // Samples stop at 13,000 ft but exit is 18,000: the 13k→18k band must use
    // the top sample's wind, matching a fully-sampled run to 18,000 ft.
    const high = { ...opts, exitFtAgl: 18000 };
    const truncated = estimateDrift(uniformLevels(14), high); // samples to 13,000
    const full = estimateDrift(uniformLevels(19), high); // samples to 18,000
    expect(truncated.freefall.distanceFt).toBeCloseTo(full.freefall.distanceFt, 5);
    expect(truncated.total.distanceFt).toBeCloseTo(full.total.distanceFt, 5);
    // freefall: 15,000 ft at 176 ft/s → 85.23 s × 16.878 ft/s ≈ 1438 ft
    expect(truncated.freefall.distanceFt).toBeCloseTo(1438, -1);
  });

  it('yields nonzero drift from a single sample (constant wind)', () => {
    const single = uniformLevels().filter((l) => l.altitudeFtAgl === 3000);
    expect(single).toHaveLength(1);
    const d = estimateDrift(single, opts);
    // Same closed form as the fully-sampled uniform-wind case.
    expect(d.freefall.distanceFt).toBeCloseTo(959, -1);
    expect(d.canopy.distanceFt).toBeCloseTo(3038, -1);
    expect(d.total.towardDeg).toBeCloseTo(90, 1);
  });

  it('treats exit below deploy as canopy-only from exit altitude', () => {
    const d = estimateDrift(uniformLevels(), { ...opts, exitFtAgl: 2000, deployFtAgl: 6000 });
    expect(d.freefall.distanceFt).toBeCloseTo(0, 5);
    // canopy: 2,000 ft at 16.667 ft/s → 120 s × 16.878 ft/s ≈ 2025 ft
    expect(d.canopy.distanceFt).toBeCloseTo(2025, -1);
    expect(d.total.distanceFt).toBeCloseTo(d.canopy.distanceFt, 5);
  });
});

/**
 * The integral extrapolates a constant wind below the lowest level, which is
 * right — a drift figure missing the bottom of the descent is too short, and
 * too short is the direction that hurts. But the assumption is invisible in the
 * result, so the estimate reports how far it reached.
 *
 * The arrangement that produces it is the NOAA FD fallback: its lowest level is
 * 3,000 ft MSL, so at this field elevation the winds-aloft table's lowest row is
 * 2,000 ft AGL and everything under that is assumed.
 */
describe('estimateDrift reports how far below the levels it had to assume', () => {
  const opts = { exitFtAgl: 13000, deployFtAgl: 3000, fallRateMph: 120, canopyRateFpm: 1000 };

  /** Levels as the FD path yields them at NE69: nothing below 2,000 ft AGL. */
  const fdLevels = (): WindsAloftLevel[] =>
    uniformLevels().filter((l) => l.altitudeFtAgl >= 2000);

  it('is zero when the levels reach the ground', () => {
    expect(estimateDrift(uniformLevels(), opts).lowestLevelFtAgl).toBe(0);
  });

  it('is the lowest level when the source stops above the ground', () => {
    expect(estimateDrift(fdLevels(), opts).lowestLevelFtAgl).toBe(2000);
  });

  /* It reports the altitude the wind is taken FROM, not the depth of descent
   * affected. Those differ when deployment is below the lowest level, and
   * reporting the depth made the card name a wind "at 1,500 ft" that had
   * actually come from the 2,000 ft level — an altitude no level sits at. */
  it('names the level the wind comes from, not the depth below deployment', () => {
    const d = estimateDrift(fdLevels(), { ...opts, deployFtAgl: 1500 });
    expect(d.lowestLevelFtAgl).toBe(2000);
  });

  it('does not claim an extrapolation when there is nothing to integrate', () => {
    expect(estimateDrift([], opts).lowestLevelFtAgl).toBe(0);
  });

  /* The drift number itself must not change: dropping the fabricated rows from
   * the table was a display fix, and the integral covered that depth with the
   * same constant wind before and after. A uniform wind makes them identical. */
  it('leaves the drift figure unchanged under a uniform wind', () => {
    const withGround = estimateDrift(uniformLevels(), opts);
    const withoutGround = estimateDrift(fdLevels(), opts);
    expect(withoutGround.canopy.distanceFt).toBeCloseTo(withGround.canopy.distanceFt, 5);
    expect(withoutGround.total.distanceFt).toBeCloseTo(withGround.total.distanceFt, 5);
  });
});

/* The card names its data source in the footer, and named Open-Meteo whatever
 * it was handed — so on the NOAA FD fallback it credited a source the numbers
 * had not come from, on the one path where the distinction matters most. */
describe('the drift card credits the source the numbers came from', () => {
  const levels = uniformLevels();
  const markup = (source?: 'open-meteo' | 'nws-fd'): string =>
    renderToStaticMarkup(
      createElement(DriftPanel, { levels, source } as never),
    );

  it('names Open-Meteo on the primary path', () => {
    expect(markup('open-meteo')).toContain('Open-Meteo');
  });

  it('credits the NOAA FD product on the fallback path, naming Open-Meteo only as the usual source', () => {
    const html = markup('nws-fd');
    const [credited, usually] = html.slice(html.indexOf('panel-sources')).split(' · usually ');
    expect(credited).toContain('NOAA winds aloft (FD)');
    expect(credited).toContain('fallback in use');
    expect(credited).not.toContain('>Open-Meteo<');
    expect(usually).toContain('>Open-Meteo<');
  });
});

/**
 * The integral extrapolates a constant wind ABOVE the highest level too (see
 * `integrate`), for the same reason as below the lowest: the alternative is a
 * drift figure that is short by however much of the descent went unaccounted.
 * The assumption is just as invisible at the top, so the estimate reports how
 * high the levels reached and the card compares that with the exit the reader
 * chose. The arrangement that produces it is a report answering for fewer
 * levels than were asked for — Open-Meteo serving nulls above 700 hPa
 * ends the profile at 9,000 ft AGL under a 10,000 ft exit.
 */
describe('estimateDrift reports how high the levels reached', () => {
  const opts = { exitFtAgl: 10000, deployFtAgl: 3000, fallRateMph: 120, canopyRateFpm: 1000 };

  it('is the configured top when the profile is complete', () => {
    expect(estimateDrift(fullProfile(), opts).highestLevelFtAgl).toBe(REQUESTED_TOP_FT_AGL);
  });

  it('is the highest level present when the profile stops short', () => {
    expect(estimateDrift(shortProfile(), opts).highestLevelFtAgl).toBe(SHORT_PROFILE_TOP_FT_AGL);
  });

  it('is null when there is nothing to integrate', () => {
    expect(estimateDrift([], opts).highestLevelFtAgl).toBeNull();
  });
});

/* The card's default exit is 10,000 ft. Over the short profile the top 1,000 ft
 * of that descent is carried by the 9,000 ft wind, and the card has to say so
 * in the same plain terms the bottom note uses. Over a complete profile no
 * exit the selector offers is above the top level, so the note must not
 * appear — the previous silence was correct there, and only there. */
describe('the drift card says when it assumes the top wind up to exit', () => {
  const markup = (levels: WindsAloftLevel[]): string =>
    renderToStaticMarkup(
      createElement(DriftPanel, { levels, source: 'open-meteo' } as never),
    );
  const short = SHORT_PROFILE_TOP_FT_AGL.toLocaleString();

  it('names the highest level and the depth it stands in for', () => {
    const html = markup(shortProfile());
    expect(html).toContain(
      `No winds above ${short} ft AGL — this assumes the ${short} ft wind up to exit.`,
    );
    expect(html).toContain('so the top 1,000 ft of the descent carries that wind');
  });

  it('is silent when the levels reach the exit altitude', () => {
    const html = markup(fullProfile());
    expect(html).not.toContain('No winds above');
    expect(html).not.toContain('up to exit');
  });
});

/* The drift card's caveat named a "jumpmaster/pilot" as who makes the spot.
 * SIM 4-7 A makes it each skydiver's responsibility, done by the spotters on
 * the load; the SIM's "jumpmaster" is the night-jump and briefing word. */
describe('the drift card says who chooses the spot, with the SIM behind it', () => {
  it('names the spotter, links SIM 4-7 A, and no longer says jumpmaster', () => {
    const html = renderToStaticMarkup(
      createElement(DriftPanel, { levels: uniformLevels(), source: 'open-meteo' } as never),
    );
    expect(withoutGlossaryLinks(html)).toContain('choosing the exit point is the spotter’s job, not this card’s');
    expect(html).toContain(`href="${CITATIONS.uspaSpottingWho.url}"`);
    expect(CITATIONS.uspaSpottingWho.url).toBe('https://www.uspa.org/sim/4-7#7A');
    expect(html.toLowerCase()).not.toContain('jumpmaster');
  });
});

/* The Deploy box opens on the BSR 2-1 I minimum for the profile and the
 * license chosen under Licensed: 3,000 ft for students and A-license
 * holders, 2,500 ft for B, C and D. */
describe('the drift card’s deploy default', () => {
  const markup = (license?: License | null): string =>
    renderToStaticMarkup(
      createElement(DriftPanel, { levels: uniformLevels(), source: 'open-meteo', license } as never),
    );
  const licenseLine = 'The license is the one chosen under Licensed at the top of the page.';

  it('opens Deploy on 3,000 ft for a student, and names students', () => {
    const html = markup(null);
    expect(html).toMatch(/<option value="3000" selected="">/);
    expect(html).toContain('Deploy opens on 3,000 ft, the BSR minimum for students, listed below.');
    expect(html).not.toContain(licenseLine);
    // "Listed below": the BSR paragraph, with its link.
    expect(html).toContain('B-license 2,500 ft');
    expect(html).toContain(`href="${CITATIONS.uspaOpeningAltitude.url}"`);
  });

  it('treats a card handed no license as a student', () => {
    expect(markup()).toContain('the BSR minimum for students, listed below.');
  });

  it('opens Deploy on 3,000 ft for an A license', () => {
    const html = markup('A');
    expect(html).toMatch(/<option value="3000" selected="">/);
    expect(html).toContain(`Deploy opens on 3,000 ft, the BSR minimum for A-license holders, listed below. ${licenseLine}`);
  });

  it('shows the wanted deploy while it is under the exit, and the highest option under the exit otherwise', () => {
    const options = [2000, 2500, 3000, 3500, 4000];
    expect(deployShown(3000, 10000, options)).toEqual({ ft: 3000, held: false });
    expect(deployShown(2500, 3000, options)).toEqual({ ft: 2500, held: false });
    expect(deployShown(3000, 3000, options)).toEqual({ ft: 2500, held: true });
    expect(deployShown(4000, 3500, options)).toEqual({ ft: 3000, held: true });
    expect(deployShown(3000, 2000, options)).toEqual({ ft: 3000, held: false });
  });

  it('opens Deploy on 2,500 ft for B, C and D, naming the license', () => {
    for (const l of ['B', 'C', 'D'] as const) {
      const html = markup(l);
      expect(html).toMatch(/<option value="2500" selected="">/);
      expect(html).toContain(`Deploy opens on 2,500 ft, the BSR minimum for ${l}-license holders, listed below.`);
    }
  });
});

