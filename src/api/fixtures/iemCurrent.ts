import type { RawIemCurrents } from '../../domain/iem';

/** Sample IEM currents answer for KPMV, the shape of
 *  api/1/currents.json?station=PMV&network=NE_ASOS. The same sky, wind and
 *  temperatures as the NWS fixture, one report later (5 min ago against its
 *  20), which is how the two feeds usually stand: IEM has the newest report
 *  and NWS the one before. That keeps fixture mode showing IEM as the source
 *  and NWS's older time on Data health, and the advisory output unchanged. */
export const IEM_CURRENT_FIXTURE: RawIemCurrents = {
  data: [
    {
      station: 'PMV',
      utc_valid: new Date(Math.floor((Date.now() - 5 * 60_000) / 60_000) * 60_000).toISOString(),
      raw: 'KPMV 271320Z AUTO 19012G22KT 10SM FEW035 BKN045 28/19 A2996 RMK AO2 T02780189',
      tmpf: 82.0,
      dwpf: 66.0,
      drct: 190.0,
      sknt: 12.0,
      gust: 22.0,
      vsby: 10.0,
      alti: 29.96,
      wxcodes: null,
      skyc1: 'FEW',
      skyl1: 3500,
      skyc2: 'BKN',
      skyl2: 4500,
      skyc3: null,
      skyl3: null,
      skyc4: null,
      skyl4: null,
    },
  ],
};
