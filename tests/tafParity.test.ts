import { describe, expect, it } from 'vitest';
import { decodeTaf } from '../src/domain/taf';
import { comparePeriod, type AwcFcst } from '../src/domain/tafParity';

/* Offutt's TAF of 2026-11-03 19:00Z, and aviationweather.gov's fcsts for
 * it as served that day: period 4's QNH2972INS came back as altim 1007 hPa,
 * where 29.72 × 33.8639 is 1006.43, and the check, which then required the
 * rounded figures to agree, failed the run (docs/open-questions.md, "Done:
 * the sky-parity run of 2026-11-03"). The rule is now within 1 hPa. */
const RAW =
  'TAF KOFF 031900Z 0319/0501 33015G20KT 4800 BR SCT008 OVC010 510005 QNH2964INS TEMPO 0319/0401 33015G25KT 3200 -DZ BR OVC008 ' +
  'BECMG 0400/0401 33015G20KT 8000 BR OVC015 510005 QNH2974INS TEMPO 0401/0405 31020G35KT 4800 -DZ BR OVC008 ' +
  'BECMG 0404/0405 30010G15KT 9000 BR OVC015 620802 QNH2972INS BECMG 0410/0411 30010G15KT 9000 BR OVC025 620802 QNH2976INS ' +
  'BECMG 0422/0423 28011KT 9999 NSW BKN030 BKN080 620802 QNH2985INS TX14/0319Z TN07/0413Z';
const issued = Date.parse('2026-11-03T19:00:00Z');
const period4: AwcFcst = {
  timeFrom: 1793764800,
  timeTo: 1793786400,
  timeBec: 1793768400,
  fcstChange: 'BECMG',
  probability: null,
  wdir: 300,
  wspd: 10,
  wgst: 15,
  visib: 5.59,
  altim: 1007,
  wxString: 'BR',
  clouds: [{ cover: 'OVC', base: 1500, type: null }],
};

describe('comparePeriod', () => {
  const p = decodeTaf(RAW, issued)!.periods[4];

  it('takes a QNH within 1 hPa of aviationweather’s whole figure', () => {
    expect(p.qnhInHg).toBe(29.72);
    expect(comparePeriod(p, period4)).toEqual([]);
    expect(comparePeriod(p, { ...period4, altim: 1006 })).toEqual([]);
  });

  it('still names a QNH a hectopascal or more off, or missing on one side', () => {
    expect(comparePeriod(p, { ...period4, altim: 1005 })).toEqual(['QNH 29.72 inHg vs 1005 hPa']);
    expect(comparePeriod(p, { ...period4, altim: 1008 })).toEqual(['QNH 29.72 inHg vs 1008 hPa']);
    expect(comparePeriod(p, { ...period4, altim: null })).toEqual(['QNH 29.72 inHg vs (none) hPa']);
  });

  it('names the other elements as before', () => {
    expect(comparePeriod(p, { ...period4, wspd: 12, clouds: [{ cover: 'OVC', base: 1200 }] })).toEqual([
      'wind speed 10 vs 12',
      'clouds OVC1500 vs OVC1200',
    ]);
  });
});
