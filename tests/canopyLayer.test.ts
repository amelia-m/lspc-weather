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
    expect(row.tempC).toBe(8.5);
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

/* NE69 at the point used until 2026-10-08: the field 37 ft above Open-Meteo's
 * ground (at the landing area since, 17 ft above it, with the 10 m sample
 * standing over the field; that path is isSurface's), and on some days
 * 975 hPa between the 80 and 120 m heights. The heights go on the 10 m
 * sample's datum (the model's ground), the pressure level at its own
 * geopotential height, and the profile is read in height order. */
describe('the canopy-layer heights at the real field offset, with a pressure level among them', () => {
  const field = mToFt(ELEV_M) + 37;
  const r = {
    elevation: ELEV_M,
    hourly: {
      time: ['2026-10-08T12:00'],
      wind_speed_10m: [4],
      wind_direction_10m: [180],
      temperature_2m: [10],
      wind_speed_80m: [10],
      wind_direction_80m: [190],
      wind_speed_120m: [20],
      wind_direction_120m: [210],
      wind_speed_180m: [24],
      wind_direction_180m: [220],
      // 975 hPa 100 m above the model's ground: between 80 and 120 m.
      wind_speed_975hPa: [16],
      wind_direction_975hPa: [200],
      geopotential_height_975hPa: [ELEV_M + 100],
    },
  } as unknown as RawOpenMeteo;
  const samples = normalizeOpenMeteo(r, Date.parse('2026-10-08T12:00Z')).samples;
  const row = (agl: number) => interpolateWindsAloft(samples, field, [agl])[0];

  it('places the heights on the model ground and reads the profile in height order', () => {
    // 80 m, 975 hPa (100 m), 120 m: ascending, whatever order they were added.
    const heights = samples.map((x) => x.heightFtMsl).sort((a, b) => a - b);
    expect(heights).toEqual([10, 80, 100, 120, 180].map((h) => mToFt(ELEV_M + h)));
    // 300 ft above the field = 102.7 m above the model's ground: just above
    // 975 hPa (16 kt) toward 120 m (20 kt), 17 kt. On the 80 m → 120 m line,
    // as if 975 hPa were missing or misplaced, it would be 16.
    expect(row(300).speedKt).toBe(17);
    // 500 ft above the field = 163.7 m: 120 m (20 kt) toward 180 m (24 kt).
    expect(row(500).speedKt).toBe(23);
  });
});
