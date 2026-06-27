import type { RawMetar } from '../../domain/normalize';

/** Sample KPMV METAR matching the AviationWeather.gov /api/data/metar JSON
 *  shape. Tuned to exercise a few advisories (gusty wind, BKN ceiling).
 *  Observation time is anchored to ~20 min ago so it always reads as current. */
export const METAR_FIXTURE: RawMetar[] = [
  {
    icaoId: 'KPMV',
    obsTime: Math.floor((Date.now() - 20 * 60_000) / 1000),
    rawOb:
      'KPMV 271300Z AUTO 19012G22KT 10SM BKN045 28/19 A2996 RMK AO2 SLP142 T02780189',
    temp: 27.8,
    dewp: 18.9,
    wdir: 190,
    wspd: 12,
    wgst: 22,
    visib: 10,
    altim: 1014.6, // hPa ≈ 29.96 inHg
    wxString: null,
    clouds: [
      { cover: 'FEW', base: 3500 },
      { cover: 'BKN', base: 4500 },
    ],
  },
];
