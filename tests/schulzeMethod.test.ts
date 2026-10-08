import { describe, expect, it } from 'vitest';
import { interpolateAsSchulze, interpolateWindsAloft } from '../src/domain/windsAloft';
import {
  normalizeOpenMeteoHours,
  openMeteoHourlyVariables,
  OPEN_METEO_EXTRA_PRESSURE_LEVELS,
  OPEN_METEO_PRESSURE_LEVELS,
  type RawOpenMeteo,
} from '../src/domain/normalize';
import { mToFt } from '../src/domain/units';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WindsAloftPanel } from '../src/components/WindsAloftPanel';

/* The "as Schulze" table: his pressure levels below 18,000 ft, his datum (Open-Meteo's
 * ground), and his Surface row, inferred from his output and matched 72 of 72
 * hours (docs/markschulze-altitude-reference.md). */
const GROUND = 1145;
const lvl = (aglFt: number, dir: number, kt: number, t: number | null = null) => ({
  heightFtMsl: GROUND + aglFt,
  speedKt: kt,
  directionDeg: dir,
  tempC: t,
});

describe('interpolateAsSchulze', () => {
  it('reads the Surface row on the line between the level below the ground and the one above', () => {
    // The reference doc's own example, 02Z on 2026-10-03: 121° / 5 kt at
    // −518 ft and 119° / 10 kt at +203 ft give 120° / 8.6 kt; the tool showed
    // 120° / 9.
    const [row] = interpolateAsSchulze([lvl(-518, 121, 5), lvl(203, 119, 10), lvl(1000, 200, 20)], GROUND, [0]);
    expect(row).toMatchObject({ altitudeFtAgl: 0, directionDeg: 120, speedKt: 9 });
  });

  it('extends the two lowest levels down to the ground when none is below it', () => {
    // 10 kt at 200 ft, 20 kt at 600 ft: the line reaches 5 kt at the ground.
    const [row] = interpolateAsSchulze([lvl(200, 180, 10), lvl(600, 180, 20)], GROUND, [0]);
    expect(row.speedKt).toBe(5);
  });

  it('extends only the ground row: other rows outside the levels are left out', () => {
    const rows = interpolateAsSchulze([lvl(200, 180, 10), lvl(600, 180, 20)], GROUND, [0, 100, 400, 5000]);
    expect(rows.map((r) => r.altitudeFtAgl)).toEqual([0, 400]);
  });

  it('measures from the ground it is given, not the field', () => {
    // A row 1,000 ft above a ground 37 ft lower than the field sits 37 ft
    // lower than the default table's 1,000 ft row.
    const levels = [lvl(0, 180, 0), lvl(2000, 180, 20)];
    const asSchulze = interpolateAsSchulze(levels, GROUND, [1000])[0];
    const asApp = interpolateWindsAloft(levels, GROUND + 37, [1000])[0];
    expect(asSchulze.altitudeFtMsl).toBe(2145);
    expect(asApp.altitudeFtMsl).toBe(2182);
  });
});

describe('the two tables from one response', () => {
  const ELEV_M = 349;
  const level = (p: number, gphM: number, kt: number) => ({
    [`wind_speed_${p}hPa`]: [kt],
    [`wind_direction_${p}hPa`]: [270],
    [`geopotential_height_${p}hPa`]: [gphM],
    [`temperature_${p}hPa`]: [10],
  });
  const raw = {
    elevation: ELEV_M,
    hourly: {
      time: ['2026-10-08T12:00'],
      wind_speed_10m: [4],
      wind_direction_10m: [270],
      temperature_2m: [12],
      ...level(1000, 150, 6), // underground
      ...level(975, 360, 8),
      ...level(950, 580, 10),
      ...level(900, 1050, 14),
      ...level(875, 1290, 30), // an extra level, far off the line
      ...level(850, 1540, 16),
    },
  } as unknown as RawOpenMeteo;
  const [hour] = normalizeOpenMeteoHours(raw);

  it('asks for the seven extra levels, and keeps them out of the Schulze table', () => {
    const vars = openMeteoHourlyVariables();
    for (const p of [...OPEN_METEO_PRESSURE_LEVELS, ...OPEN_METEO_EXTRA_PRESSURE_LEVELS]) expect(vars).toContain(`wind_speed_${p}hPa`);
    expect(OPEN_METEO_EXTRA_PRESSURE_LEVELS).toEqual([875, 825, 775, 725, 675, 625, 575]);
    // 875 hPa is in the default samples, not in Schulze's.
    expect(hour.samples.some((s) => s.speedKt === 30)).toBe(true);
    expect(hour.schulze.levels.some((s) => s.speedKt === 30)).toBe(false);
    // His keeps the underground 1000 hPa level and has no 10 m wind; ours the opposite.
    expect(hour.schulze.levels.some((s) => s.speedKt === 6)).toBe(true);
    expect(hour.samples.some((s) => s.speedKt === 6)).toBe(false);
    expect(hour.schulze.levels.some((s) => s.speedKt === 4)).toBe(false);
    expect(hour.schulze.groundFtMsl).toBeCloseTo(mToFt(ELEV_M), 6);
  });

  it('gives a different 3,000 ft row when the extra level lies near it', () => {
    // 875 hPa at 1,290 m, about 3,000 ft above the ground here.
    const ours = interpolateWindsAloft(hour.samples, 1182, [3000])[0];
    const his = interpolateAsSchulze(hour.schulze.levels, hour.schulze.groundFtMsl!, [3000])[0];
    expect(ours.speedKt).toBeGreaterThan(25);
    expect(his.speedKt).toBeLessThan(17);
  });
});

describe('the Winds aloft card’s two views', () => {
  const card = (method: 'all' | 'schulze', schulzeAvailable = true) =>
    renderToStaticMarkup(
      createElement(WindsAloftPanel, {
        levels: [{ altitudeFtAgl: 0, altitudeFtMsl: 1145, directionDeg: 200, speedKt: 9, tempC: 10 }],
        source: 'open-meteo',
        validity: { validMs: Date.parse('2026-10-08T03:00:00Z') },
        unit: 'kt',
        onUnitChange: () => {},
        method,
        onMethodChange: () => {},
        schulzeAvailable,
      } as never),
    );

  it('offers the switch on Open-Meteo, says how each table is built, and never calls his Surface row a 10 m wind', () => {
    const all = card('all');
    expect(all).toContain('aria-pressed="true">All levels</button>');
    expect(all).toContain('seven of them between the ones Mark Schulze’s tool samples');
    expect(all).toContain('but this table also takes samples his does not');
    expect(all).toContain('The Surface row is the model’s 10 m wind');
    const his = card('schulze');
    expect(his).toContain('aria-pressed="true">As Schulze</button>');
    expect(his).toContain('a rule inferred from his output, not read from his code');
    expect(his).toContain('In this view the Surface row is built his way');
    expect(his).not.toContain('The Surface row is the model’s 10 m wind');
    // No switch where the hour has no Schulze table (the FD fallback).
    expect(card('all', false)).not.toContain('As Schulze</button>');
  });

  it('describes the default table when "As Schulze" is chosen but this hour has none', () => {
    // A stored "schulze" choice on an hour Open-Meteo served without a
    // ground elevation: the table on screen is the default one, so the
    // text must be too, and must not point at a switch that is not there.
    const html = card('schulze', false);
    expect(html).not.toContain('As Schulze</button>');
    expect(html).toContain('The Surface row is the model’s 10\u00a0m wind');
    expect(html).toContain('but this table also takes samples his does not');
    expect(html).not.toContain('the switch above the table');
    expect(html).not.toContain('built his way');
    expect(html).not.toContain('As Schulze view');
    expect(html).toContain('<strong>Surface</strong> row is the model');
  });
});
