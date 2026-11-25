import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  estimateExitSeparation,
  groundSpeedKt,
  secondsToCover,
  standardTempC,
  trueAirspeedKt,
  windAtAltitude,
  windOnTrack,
} from '../src/domain/exitSeparation';
import { ExitSeparation } from '../src/components/ExitSeparation';
import { DriftPanel } from '../src/components/DriftPanel';
import { EXIT_SEPARATION_FT, JUMP_RUN_AIRSPEED_KT } from '../src/config/thresholds';
import { CHECKLIST } from '../src/config/citationsChecklist';
import type { WindsAloftLevel } from '../src/domain/types';

/* Seconds between groups on jump run (the maintainer, 2026-11-24): SIM 4-7
 * C's two ground distances over a ground speed worked from the jump run's
 * bearing, the plane's indicated airspeed and the forecast wind at exit
 * altitude. */

const FIELD_FT = 1182;
const level = (agl: number, dir: number, kt: number, tempC: number | null = standardTempC(agl + FIELD_FT)): WindsAloftLevel => ({
  altitudeFtAgl: agl,
  altitudeFtMsl: agl + FIELD_FT,
  directionDeg: dir,
  speedKt: kt,
  tempC,
});
/** A table with a west wind of 35 kt at 10,000 ft AGL. */
const WEST_35 = [level(9000, 270, 30), level(10000, 270, 35), level(11000, 270, 40)];

describe('the wind on a jump run', () => {
  it('splits the wind into the part along the run and the part across it', () => {
    expect(windOnTrack(270, 30, 270)).toEqual({ headwindKt: 30, crosswindKt: expect.closeTo(0, 6) });
    // Downwind: a tailwind is a negative headwind.
    expect(windOnTrack(270, 30, 90).headwindKt).toBeCloseTo(-30, 6);
    // Across: all crosswind, whichever side it is on.
    expect(windOnTrack(270, 30, 360).crosswindKt).toBeCloseTo(30, 6);
    expect(windOnTrack(270, 30, 180).crosswindKt).toBeCloseTo(30, 6);
    // 30° off the nose of a 40 kt wind: 34.6 along, 20 across.
    const off = windOnTrack(300, 40, 270);
    expect(off.headwindKt).toBeCloseTo(34.64, 2);
    expect(off.crosswindKt).toBeCloseTo(20, 6);
  });

  it('reads the wind at the exit altitude from its row, or between two rows along their vectors', () => {
    expect(windAtAltitude(WEST_35, 10000)).toMatchObject({ directionDeg: 270, speedKt: 35, altitudeFtMsl: 11182 });
    const mid = windAtAltitude(WEST_35, 9500)!;
    expect(mid.speedKt).toBeCloseTo(32.5, 6);
    expect(mid.altitudeFtMsl).toBe(10682);
    // 350° and 010° at 20 kt meet in the north, not the south: averaging the
    // bearings as numbers would say 180°.
    const north = windAtAltitude([level(9000, 350, 20), level(10000, 10, 20)], 9500)!;
    expect(Math.min(north.directionDeg, 360 - north.directionDeg)).toBeLessThan(0.001);
    expect(north.speedKt).toBeCloseTo(20 * Math.cos((10 * Math.PI) / 180), 6);
  });

  it('assumes no wind above or below the rows the table has', () => {
    expect(windAtAltitude(WEST_35, 12000)).toBeNull();
    expect(windAtAltitude(WEST_35, 8000)).toBeNull();
    expect(windAtAltitude([], 10000)).toBeNull();
  });

  it('keeps a temperature only where both rows have one', () => {
    expect(windAtAltitude([level(9000, 270, 30, -4), level(10000, 270, 35, -6)], 9500)!.tempC).toBeCloseTo(-5, 6);
    expect(windAtAltitude([level(9000, 270, 30, null), level(10000, 270, 35, -6)], 9500)!.tempC).toBeNull();
  });
});

describe('true airspeed from indicated', () => {
  it('is the indicated airspeed at sea level on a standard day, and about 93 kt from 80 at 10,000 ft', () => {
    expect(trueAirspeedKt(80, 0, 15)).toBeCloseTo(80, 6);
    // The standard atmosphere's density ratio at 10,000 ft is 0.7385 (any
    // published table): 80 / sqrt(0.7385) = 93.1.
    expect(trueAirspeedKt(80, 10000, null)).toBeCloseTo(93.1, 1);
    expect(trueAirspeedKt(80, 10000, standardTempC(10000))).toBeCloseTo(93.1, 1);
  });

  it('rises with the temperature, since warm air is thinner', () => {
    expect(trueAirspeedKt(80, 10000, standardTempC(10000) + 15)).toBeGreaterThan(trueAirspeedKt(80, 10000, null) + 2);
  });
});

describe('ground speed along the run, and the seconds', () => {
  it('takes the headwind off, and the crab angle’s share for a crosswind', () => {
    expect(groundSpeedKt(95, 35, 0)).toBe(60);
    expect(groundSpeedKt(95, -20, 0)).toBe(115);
    // A 3-4-5 triangle: 100 kt through the air, 60 across, 80 along.
    expect(groundSpeedKt(100, 0, 60)).toBe(80);
  });

  it('has no ground speed when the crosswind is at or above the airspeed, and none to count from at or below zero', () => {
    expect(groundSpeedKt(80, 0, 80)).toBeNull();
    expect(groundSpeedKt(80, 90, 0)).toBe(-10);
    expect(secondsToCover(1000, -10)).toBeNull();
    expect(secondsToCover(1000, 0)).toBeNull();
  });

  it('rounds the seconds up, the distances being minimums', () => {
    // 60 kt is 101.3 ft/s: 1,000 ft in 9.87 s, 1,500 ft in 14.81 s.
    expect(secondsToCover(1000, 60)).toBe(10);
    expect(secondsToCover(1500, 60)).toBe(15);
    // 90 kt is 151.9 ft/s: 1,000 ft in 6.58 s.
    expect(secondsToCover(1000, 90)).toBe(7);
    // Up, not to the nearest: 70 kt is 118.1 ft/s, 1,000 ft in 8.46 s.
    expect(secondsToCover(1000, 70)).toBe(9);
  });

  it('puts them together from a bearing and an indicated airspeed', () => {
    const est = estimateExitSeparation(WEST_35, { exitFtAgl: 10000, trackDeg: 270, indicatedKt: 80 })!;
    expect(est.headwindKt).toBeCloseTo(35, 6);
    // 80 kt indicated at 11,182 ft MSL on a standard day is 94.8 kt true.
    expect(est.tasKt).toBeCloseTo(94.85, 1);
    expect(est.groundSpeedKt).toBeCloseTo(59.85, 1);
    expect(est.tempForecast).toBe(true);
    expect(estimateExitSeparation(WEST_35, { exitFtAgl: 12500, trackDeg: 270, indicatedKt: 80 })).toBeNull();
  });
});

describe('the Drift card’s exit separation', () => {
  const section = (props: Partial<Parameters<typeof ExitSeparation>[0]> = {}) =>
    renderToStaticMarkup(createElement(ExitSeparation, { levels: WEST_35, exitFtAgl: 10000, ...props }));
  const row = (html: string, label: string): string | null =>
    html.match(new RegExp(`<dt>${label}</dt><dd>(.*?)</dd>`))?.[1]?.replace(/<[^>]+>/g, '') ?? null;
  const SOLO = 'Solo jumpers, at least 1,000 ft: between exits';
  const GROUPS = 'Small groups, at least 1,500 ft: between exits';

  it('opens on a run into the forecast wind and on the club’s slower jump-run airspeed, and says where each came from', () => {
    const html = section();
    expect(html).toContain('Forecast wind at 10,000 ft AGL: from W (270°) at 35 kt.');
    expect(html).toContain('Jump run toward (° true; into the forecast wind)');
    expect(html).toContain('<option value="270" selected="">270° W</option>');
    expect(row(html, 'Headwind on a run toward 270° W')).toBe('35 kt');
    expect(row(html, 'Crosswind on it')).toBe('0 kt');
    // The low end of the maintainer's 75 to 80 kt, dated and attributed.
    expect(JUMP_RUN_AIRSPEED_KT).toEqual({ low: 75, high: 80 });
    expect(html).toMatch(/Airspeed on jump run \(kt indicated\)<input[^>]*value="75"/);
    expect(html).toContain(
      'LSPC’s Cessna 182s typically fly jump run at about 75 to 80 kt indicated (the maintainer, 2026-11-24; confirmation asked on the citations page), so the airspeed box opens on 75 kt.',
    );
    // 75 kt indicated is 88.9 kt true there, 53.9 kt over the ground:
    // 1,000 ft in 10.99 s, 1,500 ft in 16.48 s.
    expect(row(html, 'True airspeed, from 75 kt indicated')).toBe('about 89 kt');
    expect(row(html, 'Ground speed, an estimate')).toBe('about 54 kt');
    expect(row(html, SOLO)).toBe('11 s');
    expect(row(html, GROUPS)).toBe('17 s');
  });

  it('counts nothing with the airspeed box cleared, and asks for it', () => {
    const html = section({ initialIndicatedKt: null });
    expect(html).toMatch(/Airspeed on jump run \(kt indicated\)<input[^>]*value=""/);
    expect(html).not.toContain('<strong>');
    expect(row(html, SOLO)).toBeNull();
    expect(html).toContain('Enter the plane’s indicated airspeed on jump run for the seconds between groups.');
  });

  it('has no box for a ground speed: the estimate is the card’s, the measured one the pilot’s', () => {
    const html = section();
    expect(html.match(/<input/g)).toHaveLength(1);
    expect(html).not.toMatch(/GPS ground speed/);
    expect(html).toContain('the pilot’s GPS reads the real one.');
  });

  it('works the SIM’s two distances into seconds from the bearing and the indicated airspeed', () => {
    const html = section({ initialIndicatedKt: 80 });
    expect(row(html, 'True airspeed, from 80 kt indicated')).toBe('about 95 kt');
    expect(row(html, 'Ground speed, an estimate')).toBe('about 60 kt');
    expect(row(html, SOLO)).toBe('10 s');
    expect(row(html, GROUPS)).toBe('15 s');
    expect(html).toContain('Ground speed is an estimate from the forecast wind and temperature; the pilot’s GPS reads the real one.');
  });

  it('gives fewer seconds across the wind than into it', () => {
    const across = section({ initialIndicatedKt: 80, initialTrackDeg: 0 });
    expect(across).toContain('Jump run toward (° true)<select');
    expect(row(across, 'Headwind on a run toward 360° N')).toBe('0 kt');
    expect(row(across, 'Crosswind on it')).toBe('35 kt');
    // sqrt(94.85² − 35²) = 88.2 kt: 1,000 ft in 6.72 s.
    expect(row(across, 'Ground speed, an estimate')).toBe('about 88 kt');
    expect(row(across, SOLO)).toBe('7 s');
    // Downwind: a tailwind, named as one.
    expect(row(section({ initialIndicatedKt: 80, initialTrackDeg: 90 }), 'Tailwind on a run toward 90° E')).toBe('35 kt');
  });

  it('gives no count when the plane makes no ground, or cannot hold the line, and says which', () => {
    const calm = [level(10000, 270, 120)];
    const head = section({ levels: calm, initialIndicatedKt: 80 });
    expect(head).toContain('The forecast headwind on this bearing is at or above the plane’s true airspeed');
    expect(row(head, SOLO)).toBeNull();
    const cross = section({ levels: calm, initialIndicatedKt: 80, initialTrackDeg: 0 });
    expect(cross).toContain('The forecast crosswind on this bearing is at or above the plane’s true airspeed');
    expect(row(cross, SOLO)).toBeNull();
  });

  it('says when the table has no wind at the exit altitude, and offers nothing to enter', () => {
    const none = section({ exitFtAgl: 12500 });
    expect(none).toContain('The winds table has no row at 12,500 ft AGL for this hour, so there is no wind to work a ground speed from, and no count of seconds.');
    expect(none).not.toContain('<input');
    expect(none).not.toContain('<select');
    expect(row(none, SOLO)).toBeNull();
  });

  it('calls a calm a calm: no direction printed, and no bearing said to be into the wind', () => {
    const html = section({ levels: [level(10000, 0, 0)], initialIndicatedKt: 80 });
    expect(html).toContain('Forecast wind at 10,000 ft AGL: calm.');
    expect(html).not.toContain('into the forecast wind');
    expect(html).not.toContain('from N (0°)');
    // The plane's own speed is all of it.
    expect(row(html, 'Ground speed, an estimate')).toBe('about 95 kt');
  });

  it('says the standard temperature stood in where the forecast has none', () => {
    const html = section({ levels: [level(10000, 270, 35, null)], initialIndicatedKt: 80 });
    expect(html).toContain('the forecast wind and a standard temperature (the forecast has none)');
  });

  it('ties its distances to the SIM, says what it leaves out, and links the section', () => {
    const html = section({ initialIndicatedKt: 80 });
    expect(html).toContain('The distances are SIM 4-7 C’s, which gives none for larger groups; seconds are rounded up.');
    expect(html).toContain('Separation at exit only: drift after it is not worked out.');
    expect(html).toContain('href="https://www.uspa.org/sim/4-7#7C"');
  });

  it('is on the Drift card, under the spot, at the card’s exit altitude', () => {
    const levels = Array.from({ length: 14 }, (_, i) => level(i * 1000, 270, 10 + i * 2.5));
    const html = renderToStaticMarkup(createElement(DriftPanel, { levels, source: 'open-meteo' }));
    expect(html.indexOf('Exit separation on jump run')).toBeGreaterThan(html.indexOf('drift-spot'));
    expect(html).toContain('Forecast wind at 10,000 ft AGL: from W (270°) at 35 kt.');
  });
});

describe('the distances', () => {
  it('are the two SIM 4-7 C gives, in the words the citations page quotes and the daily SIM check holds to the section', () => {
    expect(EXIT_SEPARATION_FT.map((s) => s.ft)).toEqual([1000, 1500]);
    const a7 = CHECKLIST.find((c) => c.id === 'A7')!;
    const says = a7.found!.says.join(' ');
    for (const s of EXIT_SEPARATION_FT) {
      expect(says).toContain(`“Provide at least ${s.ft.toLocaleString('en-US')} feet of ground separation between`);
    }
  });
});
