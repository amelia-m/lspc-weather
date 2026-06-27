import type { RawNwsProduct } from '../../domain/normalize';

/** Sample NWS TAF text product for KOFF (Offutt), shaped like
 *  /products/{id}. Includes a comms header + a TEMPO thunderstorm group. */
export const TAF_FIXTURE: RawNwsProduct = {
  issuanceTime: new Date(Date.now() - 40 * 60_000).toISOString(),
  productText: `000
FTUS43 KOAX 271720
TAFOFF
TAF
KOFF 271720Z 2718/2824 21012G20KT P6SM SCT050 BKN120
     TEMPO 2720/2723 5SM TSRA BKN030CB
     FM280200 19008KT P6SM SCT080
     FM281400 20010KT P6SM SCT050=`,
};
