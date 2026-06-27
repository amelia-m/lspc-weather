import type { RawNwsObservation } from '../../domain/normalize';

/** Sample NWS latest-observation for KPMV, matching
 *  /stations/{id}/observations/latest. Anchored ~20 min ago. Tuned to
 *  exercise advisories (gusty wind, BKN ceiling). */
export const OBSERVATION_FIXTURE: RawNwsObservation = {
  properties: {
    station: 'https://api.weather.gov/stations/KPMV',
    timestamp: new Date(Date.now() - 20 * 60_000).toISOString(),
    rawMessage:
      'KPMV 271300Z AUTO 19012G22KT 10SM BKN045 28/19 A2996 RMK AO2 SLP142 T02780189',
    temperature: { unitCode: 'wmoUnit:degC', value: 27.8 },
    dewpoint: { unitCode: 'wmoUnit:degC', value: 18.9 },
    windDirection: { unitCode: 'wmoUnit:degree_(angle)', value: 190 },
    windSpeed: { unitCode: 'wmoUnit:km_h-1', value: 22.2 }, // ~12 kt
    windGust: { unitCode: 'wmoUnit:km_h-1', value: 40.7 }, // ~22 kt
    barometricPressure: { unitCode: 'wmoUnit:Pa', value: 101490 },
    visibility: { unitCode: 'wmoUnit:m', value: 16090 }, // 10 SM
    presentWeather: [],
    cloudLayers: [
      { base: { unitCode: 'wmoUnit:m', value: 1067 }, amount: 'FEW' }, // ~3500 ft
      { base: { unitCode: 'wmoUnit:m', value: 1372 }, amount: 'BKN' }, // ~4500 ft
    ],
  },
};
