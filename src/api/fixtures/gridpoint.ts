import type { RawGridpoint } from '../../domain/normalize';
import { interval } from './_time';

/** Minimal NWS gridpoint sample (forecastGridData), anchored to the current
 *  hour so the timeline always renders. Durations use ISO8601 intervals exactly
 *  like the live API. */
export const GRIDPOINT_FIXTURE: RawGridpoint = {
  properties: {
    skyCover: {
      uom: 'wmoUnit:percent',
      values: [
        { validTime: interval(0, 3), value: 55 },
        { validTime: interval(3, 3), value: 40 },
        { validTime: interval(6, 6), value: 25 },
      ],
    },
    ceilingHeight: {
      uom: 'wmoUnit:m',
      values: [
        { validTime: interval(0, 3), value: 1372 }, // ~4500 ft
        { validTime: interval(3, 6), value: 2438 }, // ~8000 ft
      ],
    },
    visibility: {
      uom: 'wmoUnit:m',
      values: [{ validTime: interval(0, 12), value: 16093 }], // 10 SM
    },
    windSpeed: {
      uom: 'wmoUnit:km_h-1',
      values: [
        { validTime: interval(0, 3), value: 22 }, // ~12 kt
        { validTime: interval(3, 6), value: 28 }, // ~15 kt
      ],
    },
    windGust: {
      uom: 'wmoUnit:km_h-1',
      values: [{ validTime: interval(0, 9), value: 41 }], // ~22 kt
    },
    windDirection: {
      uom: 'wmoUnit:degree_(angle)',
      values: [{ validTime: interval(0, 9), value: 190 }],
    },
    probabilityOfPrecipitation: {
      uom: 'wmoUnit:percent',
      values: [
        { validTime: interval(0, 6), value: 15 },
        { validTime: interval(6, 6), value: 35 },
      ],
    },
    temperature: {
      uom: 'wmoUnit:degC',
      values: [
        { validTime: interval(0, 3), value: 28 },
        { validTime: interval(3, 6), value: 31 },
      ],
    },
  },
};
