/**
 * Real TAF products from the NWS text-products feed
 * (api.weather.gov/products/types/TAF/locations/OMA and /LNK), saved on
 * 2026-09-24 so the decoder's tests run on text an office actually wrote
 * rather than on hand-typed examples. Both were read back through
 * `parseTaf` and `decodeTaf` the day they were saved; the expected values
 * in tests/taf.test.ts are what those runs produced, checked by eye against
 * the text.
 */
import type { RawNwsProduct } from '../../src/domain/normalize';

/** KOMA, four prevailing periods, visibilities of 4 and 6 SM with showers. */
export const KOMA_2026_09_24_0521: RawNwsProduct = {
  issuanceTime: '2026-09-24T05:21:00+00:00',
  productText: `
000
FTUS43 KOAX 240521
TAFOMA
TAF
KOMA 240521Z 2406/2506 13009KT P6SM FEW050 BKN150
     FM241600 16009KT P6SM -SHRA OVC050
     FM250000 12007KT 4SM -SHRA BR OVC024
     FM250400 12007KT 6SM -SHRA OVC017=`,
};

/** KLNK with a TEMPO group that states only a sky change. */
export const KLNK_2026_09_23_1120: RawNwsProduct = {
  issuanceTime: '2026-09-23T11:20:00+00:00',
  productText: `
000
FTUS43 KOAX 231120
TAFLNK
TAF
KLNK 231120Z 2312/2412 12006KT P6SM SCT009 OVC017
      TEMPO 2312/2313 BKN009 OVC015
     FM231500 14007KT P6SM BKN021
     FM231700 14009KT P6SM SCT025=`,
};
