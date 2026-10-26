import { describe, expect, it } from 'vitest';
import { parseTaf } from '../src/domain/normalize';
import { decodeTaf, periodFlightCategory, prevailingFor, resolveTafTime, tafOnScreenGone, temperatureAsWritten, type DecodedTaf } from '../src/domain/taf';
import { KLNK_2026_09_23_1120, KOMA_2026_09_24_0521 } from './support/tafProducts';

const utc = (m: number, d: number, h: number, min = 0): number => Date.UTC(2026, m - 1, d, h, min);

function decodeProduct(product: { productText?: string; issuanceTime?: string }, station: string): DecodedTaf {
  const taf = parseTaf(product.productText!, station, product.issuanceTime);
  expect(taf).not.toBeNull();
  const d = decodeTaf(taf!.raw, taf!.issuedMs);
  expect(d).not.toBeNull();
  return d!;
}

describe('decodeTaf on a real KOMA product', () => {
  const d = decodeProduct(KOMA_2026_09_24_0521, 'KOMA');

  it('reads the validity window from the DDHH/DDHH group against the issuance month', () => {
    expect(d.station).toBe('KOMA');
    expect(d.amendment).toBeNull();
    expect(d.validFromMs).toBe(utc(9, 24, 6));
    expect(d.validToMs).toBe(utc(9, 25, 6));
  });

  it('decodes every group, leaving nothing undecoded', () => {
    expect(d.undecoded).toEqual([]);
    expect(d.periods.map((p) => p.change)).toEqual(['BASE', 'FM', 'FM', 'FM']);
    expect(d.periods.map((p) => p.raw)).toEqual([
      '13009KT P6SM FEW050 BKN150',
      'FM241600 16009KT P6SM -SHRA OVC050',
      'FM250000 12007KT 4SM -SHRA BR OVC024',
      'FM250400 12007KT 6SM -SHRA OVC017',
    ]);
  });

  it('ends each prevailing period where the next FM group starts, the last at the validity end', () => {
    expect(d.periods.map((p) => [p.fromMs, p.toMs])).toEqual([
      [utc(9, 24, 6), utc(9, 24, 16)],
      [utc(9, 24, 16), utc(9, 25, 0)],
      [utc(9, 25, 0), utc(9, 25, 4)],
      [utc(9, 25, 4), utc(9, 25, 6)],
    ]);
  });

  it('decodes wind, visibility, weather and sky per period', () => {
    const [base, , third, fourth] = d.periods;
    expect(base.wind).toEqual({ directionDeg: 130, variable: false, speedKt: 9, gustKt: null });
    expect(base.visibilitySm).toBe(6);
    expect(base.visibilityPlus).toBe(true); // P6SM
    expect(base.wxString).toBeNull();
    expect(base.skyLayers).toEqual([
      { cover: 'FEW', baseFtAgl: 5000 },
      { cover: 'BKN', baseFtAgl: 15000 },
    ]);
    expect(base.ceilingFtAgl).toBe(15000);
    expect(third.visibilitySm).toBe(4);
    expect(third.visibilityPlus).toBe(false);
    expect(third.wxString).toBe('-SHRA BR');
    expect(third.ceilingFtAgl).toBe(2400);
    // A plain 6SM is six miles, not "more than six".
    expect(fourth.visibilitySm).toBe(6);
    expect(fourth.visibilityPlus).toBe(false);
  });
});

describe('decodeTaf on a real KLNK product with a TEMPO group', () => {
  const d = decodeProduct(KLNK_2026_09_23_1120, 'KLNK');

  it('keeps the TEMPO as its own period with only the elements it states', () => {
    const tempo = d.periods.find((p) => p.change === 'TEMPO')!;
    expect(tempo.raw).toBe('TEMPO 2312/2313 BKN009 OVC015');
    expect(tempo.fromMs).toBe(utc(9, 23, 12));
    expect(tempo.toMs).toBe(utc(9, 23, 13));
    expect(tempo.wind).toBeNull();
    expect(tempo.visibilitySm).toBeNull();
    expect(tempo.wxString).toBeNull();
    expect(tempo.ceilingFtAgl).toBe(900);
  });

  it('does not let the TEMPO cut the prevailing period short', () => {
    // Only a FM group ends the period before it; a TEMPO sits inside it.
    expect(d.periods[0].change).toBe('BASE');
    expect(d.periods[0].toMs).toBe(utc(9, 23, 15));
    expect(prevailingFor(d.periods, 1)).toBe(d.periods[0]);
  });
});

describe('decodeTaf on the change groups NWS offices rarely write here', () => {
  const raw = [
    'TAF AMD KOFF 022000Z 0220/0324 15011KT 9999 SCT020',
    'TEMPO 0220/0222 -TSRA BKN020CB',
    'PROB30 TEMPO 0300/0304 1 1/2SM +TSRA BR OVC008CB WS020/21040KT',
    'BECMG 0306/0308 VRB03KT P6SM NSW SKC TX25/0318Z TN12/0309Z',
  ].join('\n     ');
  const d = decodeTaf(raw, utc(10, 2, 20))!;

  it('reads the AMD header and an ICAO 9999 visibility as "more than six miles"', () => {
    expect(d.amendment).toBe('AMD');
    expect(d.periods[0].visibilitySm).toBe(6);
    expect(d.periods[0].visibilityPlus).toBe(true);
  });

  it('folds "PROB30 TEMPO" into one period carrying the probability', () => {
    expect(d.periods.map((p) => p.change)).toEqual(['BASE', 'TEMPO', 'PROB', 'BECMG']);
    const prob = d.periods[2];
    expect(prob.probability).toBe(30);
    expect(prob.fromMs).toBe(utc(10, 3, 0));
    expect(prob.toMs).toBe(utc(10, 3, 4));
  });

  it('reads a whole-and-fraction visibility, the wind-shear group and a CB layer', () => {
    const prob = d.periods[2];
    expect(prob.visibilitySm).toBe(1.5);
    expect(prob.wxString).toBe('+TSRA BR');
    expect(prob.windShear).toBe('WS020/21040KT');
    expect(prob.skyLayers).toEqual([{ cover: 'OVC', baseFtAgl: 800 }]);
    expect(prob.ceilingFtAgl).toBe(800);
  });

  it('reads a variable wind, NSW and SKC on a BECMG, and the temperature groups as the forecast’s', () => {
    const becmg = d.periods[3];
    expect(becmg.wind).toEqual({ directionDeg: null, variable: true, speedKt: 3, gustKt: null });
    expect(becmg.wxString).toBe('NSW');
    expect(becmg.skyLayers).toEqual([{ cover: 'SKC', baseFtAgl: null }]);
    expect(becmg.ceilingFtAgl).toBeNull();
    expect(d.temperatures.map((t) => t.raw)).toEqual(['TX25/0318Z', 'TN12/0309Z']);
    expect(d.undecoded).toEqual([]);
  });

  it('ends the base period where the BECMG window starts, as a FM group would', () => {
    expect(d.periods[0].toMs).toBe(utc(10, 3, 6));
  });

  it('keeps the base period running to the validity end when no FM or BECMG follows', () => {
    const only = decodeTaf('KOMA 022000Z 0220/0324 15011KT P6SM SCT020 TEMPO 0220/0222 BKN020', utc(10, 2, 20))!;
    expect(only.periods[0].toMs).toBe(utc(10, 4, 0));
  });
});

describe('decodeTaf on the KOFF TAF aviationweather.gov served on 2026-09-24', () => {
  // USAF format: metre visibilities, QNH groups, and a BECMG for every
  // change. Read from the sky-parity run of that morning; aviationweather's
  // own decode of it agreed with this one on every period once the base
  // period ended at the first BECMG.
  const raw =
    'TAF KOFF 240200Z 2402/2508 12006KT 9999 SCT100 BKN200 QNH3025INS BECMG 2409/2410 14006KT 9999 VCSH BKN080 OVC180 QNH3025INS BECMG 2415/2416 16009KT 9000 -RA OVC060 QNH3021INS BECMG 2421/2422 13006KT 6000 -RA OVC025 QNH3016INS BECMG 2501/2502 13006KT 4800 -RA BR OVC010 QNH3019INS BECMG 2505/2506 13006KT 4800 -RA BR OVC007 QNH3018INS TX19/2420Z TN15/2411Z';
  const d = decodeTaf(raw, utc(9, 24, 2))!;

  it('decodes six periods, the base ending at the first BECMG window', () => {
    expect(d.periods.map((p) => p.change)).toEqual(['BASE', 'BECMG', 'BECMG', 'BECMG', 'BECMG', 'BECMG']);
    expect(d.periods[0].toMs).toBe(utc(9, 24, 9));
    expect(d.periods[1].fromMs).toBe(utc(9, 24, 9));
    expect(d.periods[1].toMs).toBe(utc(9, 24, 10));
  });

  it('converts metre visibilities and reads each period’s QNH and the forecast’s temperatures', () => {
    expect(d.periods[2].visibilitySm).toBe(5.59); // 9000 m
    expect(d.periods[4].visibilitySm).toBe(2.98); // 4800 m
    expect(d.periods[1].wxString).toBe('VCSH');
    expect(d.periods.map((p) => p.qnhInHg)).toEqual([30.25, 30.25, 30.21, 30.16, 30.19, 30.18]);
    expect(d.temperatures.map((t) => [t.kind, t.tempC])).toEqual([
      ['max', 19],
      ['min', 15],
    ]);
    expect(d.undecoded).toEqual([]);
  });
});

describe('decodeTaf on a KOFF TAF with USAF in-period remarks', () => {
  // As aviationweather.gov served it on 2026-10-03. `WND 14006KT AFT 0306`
  // is a remark (the wind after 03/06Z), not the period's wind, and its
  // 0306 is a day-and-hour, not 306 m of visibility. Before this was read,
  // period 0 came out 140° and 0.19 SM, and the daily TAF decode comparison
  // failed against aviationweather's 110° and 6+ (also on Oct 1 and 2).
  const raw =
    'TAF KOFF 030200Z 0302/0408 11006KT 9999 SKC QNH3019INS WND 14006KT AFT 0306 BECMG 0315/0316 17010G15KT 9999 FEW250 QNH3009INS BECMG 0323/0324 VRB06KT 9999 FEW100 QNH3011INS TX22/0321Z TN09/0311Z';
  const d = decodeTaf(raw, utc(10, 3, 2))!;

  it('takes the period\'s wind and visibility from its own groups, not the remark', () => {
    expect(d.periods[0].wind).toMatchObject({ directionDeg: 110, speedKt: 6, variable: false });
    expect(d.periods[0].visibilitySm).toBe(6);
    expect(d.periods[0].visibilityPlus).toBe(true);
  });

  it('lists the remark undecoded, and reads the QNH beside it', () => {
    expect(d.undecoded).toEqual(['WND', '14006KT', 'AFT', '0306']);
    expect(d.periods[0].qnhInHg).toBe(30.19);
  });

  it('leaves the times in a "last amendment" remark undecoded too', () => {
    const last = decodeTaf('TAF KOFF 030200Z 0302/0408 11006KT 9999 SKC LAST NO AMDS AFT 0303 NEXT 0315', utc(10, 3, 2))!;
    expect(last.periods[0].visibilitySm).toBe(6);
    expect(last.periods[0].visibilityPlus).toBe(true);
    expect(last.undecoded).toEqual(['LAST', 'NO', 'AMDS', 'AFT', '0303', 'NEXT', '0315']);
  });
});

describe('periodFlightCategory', () => {
  it('reads a TEMPO after a BECMG against the BECMG conditions, not the base ones', () => {
    // Base: 9999 (6+ SM). BECMG: 4800 m, 2.98 SM. The TEMPO states only a
    // 2,000 ft ceiling: MVFR on the base visibility, IFR on the BECMG's.
    const d = decodeTaf(
      'KOFF 240200Z 2402/2508 12006KT 9999 SCT100 BECMG 2409/2410 4800 -RA BR OVC010 TEMPO 2412/2414 BKN020',
      utc(9, 24, 2),
    )!;
    expect(d.periods[2].change).toBe('TEMPO');
    expect(periodFlightCategory(d.periods, 2)).toBe('IFR');
    expect(periodFlightCategory(d.periods, 1)).toBe('IFR'); // the BECMG row itself
    expect(periodFlightCategory(d.periods, 0)).toBe('VFR');
  });

  it('lets an NSW on a BECMG clear the weather for the rows after it', () => {
    const d = decodeTaf(
      'KOFF 240200Z 2402/2508 12006KT 4800 -RA OVC010 BECMG 2409/2410 P6SM NSW SCT050 TEMPO 2412/2414 BKN030',
      utc(9, 24, 2),
    )!;
    expect(prevailingFor(d.periods, 2)?.wxString).toBeNull();
    expect(periodFlightCategory(d.periods, 2)).toBe('MVFR');
  });

  it('keeps a later BECMG weather unstated after an earlier NSW BECMG', () => {
    const d = decodeTaf(
      'KOFF 261000Z 2610/2716 13012G18KT 8000 -RA OVC006 QNH3001INS BECMG 2611/2612 13012G18KT 9000 -DZ BR OVC015 QNH3000INS BECMG 2613/2614 14012G18KT 9999 NSW SCT010 OVC030 QNH2999INS BECMG 2617/2618 15010KT 9999 BKN030 OVC140 QNH2992INS',
      utc(9, 26, 10),
    )!;
    const later = d.periods.find((p) => p.raw.startsWith('BECMG 2617/2618'))!;
    expect(later.wxString).toBeNull();
    expect(prevailingFor(d.periods, d.periods.indexOf(later))?.wxString).toBeNull();
  });
});

describe('decodeTaf on the edges of the format', () => {
  it('reads a calm wind, a fractional visibility and a vertical-visibility ceiling', () => {
    const p = decodeTaf('KOMA 302320Z 0100/0124 00000KT 1/2SM FG VV002', null)!.periods[0];
    expect(p.wind).toEqual({ directionDeg: null, variable: false, speedKt: 0, gustKt: null });
    expect(p.visibilitySm).toBe(0.5);
    expect(p.wxString).toBe('FG');
    expect(p.ceilingFtAgl).toBe(200);
  });

  it('reads gusts and a lowest-of-several ceiling', () => {
    const p = decodeTaf('KOMA 302320Z 0100/0124 21012G20KT P6SM SCT050 BKN120 OVC200', null)!.periods[0];
    expect(p.wind).toEqual({ directionDeg: 210, variable: false, speedKt: 12, gustKt: 20 });
    expect(p.ceilingFtAgl).toBe(12000);
  });

  it('resolves period times without an issuance time as null, and still decodes the elements', () => {
    const d = decodeTaf('KOMA 302320Z 0100/0124 13009KT P6SM SKC', null)!;
    expect(d.validFromMs).toBeNull();
    expect(d.periods[0].fromMs).toBeNull();
    expect(d.periods[0].wind?.speedKt).toBe(9);
  });

  it('decodes a NIL forecast to no periods and rejects text with no TAF header', () => {
    expect(decodeTaf('KOMA 240521Z NIL', null)?.periods).toEqual([]);
    expect(decodeTaf('garbage here', null)).toBeNull();
    expect(decodeTaf('', null)).toBeNull();
  });

  it('stops at RMK so remark tokens are not read as groups', () => {
    const d = decodeTaf('KOMA 302320Z 0100/0124 13009KT P6SM SKC RMK NXT FCST BY 00Z', null)!;
    expect(d.periods).toHaveLength(1);
    expect(d.undecoded).toEqual([]);
  });
});

describe('temperatureAsWritten', () => {
  // Offutt's TAF of 2026-10-24 10Z, whose TN aviationweather.gov dated a
  // day early. Issued 241000Z: the app puts TN12/2510Z on the 25th at 10Z.
  const issued = Date.UTC(2026, 9, 24, 10);
  const d = decodeTaf('TAF KOFF 241000Z 2410/2516 13009KT 9999 SCT180 QNH3012INS TX26/2420Z TN12/2510Z', issued)!;
  it('is true when the group sits on the day and hour its text gives', () => {
    expect(d.temperatures.map(temperatureAsWritten)).toEqual([true, true]);
    expect(d.temperatures[1].atMs).toBe(Date.UTC(2026, 9, 25, 10));
  });
  it('is false for a time off the text, as aviationweather.gov dated that TN', () => {
    expect(temperatureAsWritten({ ...d.temperatures[1], atMs: Date.UTC(2026, 9, 24, 10) })).toBe(false);
    expect(temperatureAsWritten({ ...d.temperatures[1], atMs: null })).toBe(false);
  });
  it('reads an hour of 24 as midnight ending that day', () => {
    const e = decodeTaf('TAF KOFF 241000Z 2410/2516 13009KT 9999 SCT180 TX26/2424Z', issued)!;
    expect(e.temperatures[0].atMs).toBe(Date.UTC(2026, 9, 25, 0));
    expect(temperatureAsWritten(e.temperatures[0])).toBe(true);
  });
});

describe('resolveTafTime', () => {
  it('reads a day below the issuance day as next month, across a year end', () => {
    expect(resolveTafTime(1, 12, 0, utc(12, 31, 23))).toBe(Date.UTC(2027, 0, 1, 12));
  });

  it('reads hour 24 as midnight ending that day', () => {
    expect(resolveTafTime(24, 24, 0, utc(9, 24, 5))).toBe(utc(9, 25, 0));
  });

  it('is null without a reference time', () => {
    expect(resolveTafTime(24, 6, 0, null)).toBeNull();
  });
});

describe('decodeTaf: the groups a joint-use airport’s TAF adds', () => {
  // Offutt's TAF of 2026-10-20 10Z, as aviationweather.gov served it.
  const OFFUTT = 'TAF KOFF 201000Z 2010/2116 16009KT 9999 FEW130 QNH3017INS TX20/2020Z TN07/2010Z';
  const issued = Date.parse('2026-10-20T10:00:00Z');

  it('reads the lowest altimeter setting into its period, and TX/TN as the forecast’s temperatures', () => {
    const d = decodeTaf(OFFUTT, issued)!;
    expect(d.periods).toHaveLength(1);
    expect(d.periods[0].qnhInHg).toBe(30.17);
    expect(d.temperatures).toEqual([
      { kind: 'max', tempC: 20, atMs: Date.parse('2026-10-20T20:00:00Z'), raw: 'TX20/2020Z' },
      { kind: 'min', tempC: 7, atMs: Date.parse('2026-10-20T10:00:00Z'), raw: 'TN07/2010Z' },
    ]);
    // Nothing left over: these were the card's "Not decoded" line.
    expect(d.undecoded).toEqual([]);
  });

  it('decodes the FAA handbook’s own example, a QNH in a BECMG group and TX/TN after it', () => {
    // FAA-H-8083-28B, 27.4.2.10.4 (read 2026-10-21), with a base group added
    // before the handbook's BECMG so it is a whole TAF.
    const d = decodeTaf(
      'KXXX 041100Z 0412/0512 18005KT 9999 SKC QNH3008INS BECMG 0511/0512 16005KT 9999 NSW SKC QNH3006INS TX28/0420Z TN22/0410Z',
      Date.parse('2026-10-04T11:00:00Z'),
    )!;
    expect(d.periods.map((p) => [p.change, p.qnhInHg])).toEqual([
      ['BASE', 30.08],
      ['BECMG', 30.06],
    ]);
    expect(d.temperatures.map((t) => [t.kind, t.tempC, new Date(t.atMs!).toISOString()])).toEqual([
      ['max', 28, '2026-10-04T20:00:00.000Z'],
      ['min', 22, '2026-10-04T10:00:00.000Z'],
    ]);
    expect(d.undecoded).toEqual([]);
  });

  it('keeps the TX/TN groups out of the period they are written in', () => {
    const d = decodeTaf(OFFUTT, issued)!;
    expect(d.periods[0].raw).toBe('16009KT 9999 FEW130 QNH3017INS');
  });

  it('lists a second QNH in one period rather than replacing the first', () => {
    const d = decodeTaf('KOFF 201000Z 2010/2116 16009KT 9999 FEW130 QNH3017INS QNH3009INS', issued)!;
    expect(d.periods[0].qnhInHg).toBe(30.17);
    expect(d.undecoded).toEqual(['QNH3009INS']);
  });

  it('reads an M before a temperature as minus, and leaves an NWS TAF with none', () => {
    const d = decodeTaf('KOFF 201000Z 2010/2116 16009KT 9999 FEW130 TNM03/2110Z', issued)!;
    expect(d.temperatures[0]).toMatchObject({ kind: 'min', tempC: -3 });
    const nws = decodeTaf('KOMA 240521Z 2406/2506 13009KT P6SM FEW050 BKN150', Date.parse('2026-09-24T05:21:00Z'))!;
    expect(nws.temperatures).toEqual([]);
    expect(nws.periods[0].qnhInHg).toBeNull();
  });
});

describe('tafOnScreenGone', () => {
  it('drops the TAF on screen when its own station was found ended or cancelled, and keeps it when it only failed', () => {
    expect(tafOnScreenGone('KOMA', [{ station: 'KOFF', none: true }, { station: 'KOMA', noForecast: 'CNL' }])).toBe(true);
    expect(tafOnScreenGone('KOMA', [{ station: 'KOMA', endedMs: 0 }])).toBe(true);
    expect(tafOnScreenGone('KOMA', [{ station: 'KOMA', failed: 'HTTP 500', status: 500 }])).toBe(false);
    expect(tafOnScreenGone('KOMA', [{ station: 'KLNK', noForecast: 'NIL' }])).toBe(false);
  });
});
