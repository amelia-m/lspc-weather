import { describe, expect, it } from 'vitest';
import {
  normalizeOpenMeteo,
  openMeteoHourlyVariables,
  OPEN_METEO_HEIGHT_LEVELS_M,
  type RawOpenMeteo,
} from '../src/domain/normalize';
import { interpolateWindsAloft } from '../src/domain/windsAloft';
import { mToFt } from '../src/domain/units';

/* Between the 10 m wind and the lowest pressure level above ground (950 hPa,
 * about 730 ft up at NE69) the table used to draw a straight line through
 * the canopy layer. Open-Meteo's own 80, 120 and 180 m winds now fill it. */
const ELEV_M = 349;
const FIELD_FT = mToFt(ELEV_M);
const raw = (withHeights: boolean): RawOpenMeteo =>
  ({
    elevation: ELEV_M,
    hourly: {
      time: ['2026-10-08T12:00'],
      wind_speed_10m: [4],
      wind_direction_10m: [180],
      temperature_2m: [10],
      ...(withHeights
        ? {
            wind_speed_80m: [12],
            wind_direction_80m: [200],
            temperature_80m: [9],
            wind_speed_120m: [20],
            wind_direction_120m: [210],
            temperature_120m: [9],
            wind_speed_180m: [16],
            wind_direction_180m: [220],
            temperature_180m: [8],
          }
        : {}),
      wind_speed_950hPa: [10],
      wind_direction_950hPa: [240],
      geopotential_height_950hPa: [ELEV_M + 223],
      temperature_950hPa: [7],
    },
  }) as unknown as RawOpenMeteo;

const at = (r: RawOpenMeteo, agl: number) =>
  interpolateWindsAloft(normalizeOpenMeteo(r, Date.parse('2026-10-08T12:00Z')).samples, FIELD_FT, [agl])[0];

describe('the canopy-layer heights', () => {
  it('are asked for, wind and temperature, at 80, 120 and 180 m', () => {
    const vars = openMeteoHourlyVariables();
    expect(OPEN_METEO_HEIGHT_LEVELS_M).toEqual([80, 120, 180]);
    for (const h of OPEN_METEO_HEIGHT_LEVELS_M) {
      for (const v of [`wind_speed_${h}m`, `wind_direction_${h}m`, `temperature_${h}m`]) expect(vars).toContain(v);
    }
  });

  it('fill the 500 ft row from the 120 and 180 m winds instead of a line from 10 m to 950 hPa', () => {
    // 500 ft = 152 m, 54% of the way from 120 m (20 kt, 210°, 9 °C) to
    // 180 m (16 kt, 220°, 8 °C).
    const row = at(raw(true), 500);
    expect(row.speedKt).toBe(18);
    expect(row.directionDeg).toBe(215);
    expect(row.tempC).toBe(8);
    // Without them, the same row is the 10 m → 950 hPa line: 8 kt.
    expect(at(raw(false), 500).speedKt).toBe(8);
  });

  it('skips a height the response left empty', () => {
    const r = raw(true) as unknown as { hourly: Record<string, unknown[]> };
    r.hourly.wind_speed_120m = [null];
    // 500 ft now lies between 80 m (12 kt) and 180 m (16 kt): 15 kt, not 18.
    expect(at(r as unknown as RawOpenMeteo, 500).speedKt).toBe(15);
  });
});
