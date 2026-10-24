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
        // Two days of sky cover, wind, temperature and chances and 30 hours
        // of ceiling, as the live grid runs a week and the ceiling about a
        // day and a half: enough for the Ceiling & sky card's 24 h and 36 h
        // views and the note where the ceiling stops, without hours that
        // have sky cover and nothing else.
        { validTime: interval(12, 12), value: 70 },
        { validTime: interval(24, 24), value: 35 },
      ],
    },
    ceilingHeight: {
      uom: 'wmoUnit:m',
      values: [
        { validTime: interval(0, 3), value: 1372 }, // ~4500 ft
        { validTime: interval(3, 6), value: 2438 }, // ~8000 ft
        { validTime: interval(9, 9), value: null }, // no ceiling
        { validTime: interval(18, 12), value: 3048 }, // ~10,000 ft
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
        { validTime: interval(3, 45), value: 28 }, // ~15 kt
      ],
    },
    windGust: {
      uom: 'wmoUnit:km_h-1',
      values: [{ validTime: interval(0, 48), value: 41 }], // ~22 kt
    },
    windDirection: {
      uom: 'wmoUnit:degree_(angle)',
      values: [{ validTime: interval(0, 48), value: 190 }],
    },
    probabilityOfPrecipitation: {
      uom: 'wmoUnit:percent',
      values: [
        { validTime: interval(0, 6), value: 15 },
        { validTime: interval(6, 42), value: 35 },
      ],
    },
    probabilityOfThunder: {
      uom: 'wmoUnit:percent',
      values: [
        { validTime: interval(0, 6), value: 5 },
        { validTime: interval(6, 42), value: 25 },
      ],
    },
    quantitativePrecipitation: {
      uom: 'wmoUnit:mm',
      values: [
        { validTime: interval(0, 6), value: 0 },
        { validTime: interval(6, 6), value: 6.35 }, // 0.25 in
      ],
    },
    temperature: {
      uom: 'wmoUnit:degC',
      values: [
        { validTime: interval(0, 3), value: 28 },
        { validTime: interval(3, 45), value: 31 },
      ],
    },
  },
};
