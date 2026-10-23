import { describe, expect, it } from 'vitest';
import { KT_PER_MS, pairGusts, parseNdfdGustLines, summarizeGusts, type NdfdGustRecord } from '../src/domain/ndfdGust';
import type { MetarRecord } from '../src/domain/cloudCoverSources';

const ms = (kt: number): number => kt / KT_PER_MS;
const rec = (issued: string, valid: string, gustKt: number, key = `YWUZ98_KWBN_${issued}`): NdfdGustRecord => ({
  src: 'ndfd-wgust',
  key,
  issued: `2026-07-${issued}Z`,
  ref: `2026-07-${issued}Z`,
  valid: `2026-07-${valid}Z`,
  gust: ms(gustKt),
  gridKm: 0.87,
});
const metar = (obsAt: string, wind: string): MetarRecord => ({
  src: 'metar',
  obsAt: `2026-07-${obsAt}Z`,
  raw: `KPMV ${obsAt.replace(/[-T:]/g, '').slice(0, 6)}Z AUTO ${wind} 10SM CLR 25/15 A3001`,
});

describe('parseNdfdGustLines', () => {
  it('keeps the drop zone’s gust records and drops the no-data fill, other records and other sites', () => {
    const good = rec('01T00:47', '01T02:00', 15);
    const text = [
      JSON.stringify(good),
      '',
      JSON.stringify({ ...good, gust: -4630.2 }),
      JSON.stringify({ ...good, src: 'ndfd-cig' }),
      JSON.stringify({ ...good, site: 'PMV' }),
    ].join('\n');
    expect(parseNdfdGustLines(text)).toEqual([good]);
  });
});

describe('pairGusts', () => {
  const records = [
    // Valid 12Z: issued 00:47 (11.2 h ahead), 06:47 (5.2 h), and 12:46,
    // after the hour's start, so never picked for it.
    rec('01T00:47', '01T12:00', 20),
    rec('01T06:47', '01T12:00', 17.6),
    rec('01T12:46', '01T12:00', 30),
    // The same file read twice (overlapping fetches): counted once.
    rec('01T06:47', '01T12:00', 17.6),
    // Valid 13Z: no gust reported at 12:55, so set against the steady wind.
    rec('01T06:47', '01T13:00', 14),
    // The next issuance, so 13Z and 14Z are within reach.
    rec('01T12:46', '01T18:00', 10),
  ];
  const reports = [
    metar('01T11:55', '18012G15KT'),
    // Nearer the 12Z hour than the :55: the one paired.
    metar('01T12:04', '18011G16KT'),
    metar('01T12:55', '18009KT'),
  ];

  it('takes the newest issuance far enough ahead, issued before the hour, and the report nearest it', () => {
    const [latest, six] = pairGusts(records, reports);
    const at12 = latest.pairs.find((p) => p.t === Date.parse('2026-07-01T12:00Z'))!;
    expect(at12).toMatchObject({ issued: '2026-07-01T06:47Z', fc: 18, gustDiff: 2, overSteady: null });
    expect(at12.leadH).toBeCloseTo(5.22, 2);
    const six12 = six.pairs.find((p) => p.t === Date.parse('2026-07-01T12:00Z'))!;
    expect(six12).toMatchObject({ issued: '2026-07-01T00:47Z', fc: 20, gustDiff: 4 });
  });

  it('sets the gust against the steady wind where KPMV reported none, and counts a file read twice once', () => {
    // One pair an hour whatever the files hold: the row picks one issuance.
    const [latest] = pairGusts(records, reports);
    expect(latest.pairs.find((p) => p.t === Date.parse('2026-07-01T13:00Z'))).toMatchObject({
      fc: 14,
      gustDiff: null,
      overSteady: 5,
    });
    expect(latest.pairs.filter((p) => p.t === Date.parse('2026-07-01T12:00Z'))).toHaveLength(1);
  });

  it('leaves out hours past the reach of the issuances fetched', () => {
    const lateRecords = [...records, rec('01T12:46', '03T12:00', 25)];
    const lateReports = [...reports, metar('03T11:55', '18010G20KT')];
    const [latest] = pairGusts(lateRecords, lateReports);
    // 12:46 on the 1st is the last issuance; the 3rd's noon is two days on.
    expect(latest.pairs.some((p) => p.t === Date.parse('2026-07-03T12:00Z'))).toBe(false);
  });
});

describe('summarizeGusts', () => {
  const pair = (day: string, gustDiff: number | null, fc: number, spd: number, gust: number | null) => ({
    t: Date.parse(`2026-07-${day}Z`),
    issued: '2026-07-01T00:47Z',
    leadH: 3,
    fc,
    obs: { t: Date.parse(`2026-07-${day}Z`), spd, gust, dir: 180, tempC: null, visSm: null },
    gustDiff,
    overSteady: gust == null ? fc - spd : null,
  });
  const rows = [
    {
      label: 'latest issuance',
      pairs: [
        // Four gusting hours on July 1 in Central time, the last at 03Z on
        // the 2nd (10 pm CDT on the 1st); one on the 2nd.
        pair('01T18:00', 4, 24, 14, 20),
        pair('01T19:00', 2, 22, 13, 20),
        pair('01T20:00', -3, 20, 15, 23),
        pair('02T03:00', 1, 21, 14, 20),
        pair('02T18:00', 0, 18, 12, 18),
        // No gust reported: the forecast gust at the limit, the station under.
        pair('02T19:00', null, 12, 6, null),
        // No gust reported: the station's steady wind over the limit, the
        // forecast gust under it.
        pair('02T20:00', null, 10, 13, null),
      ],
    },
  ];
  const [s] = summarizeGusts(rows, { timeZone: 'America/Chicago', limitKt: 12, minDayHours: 3 });

  it('counts the sides and spreads of the gusting hours, and the steady-wind gap of the rest', () => {
    expect(s).toMatchObject({ hours: 7, gustHours: 5, side: { above: 3, equal: 1, below: 1 } });
    expect(s.spread?.mean).toBe(0.8);
    expect(s.overSteady).toMatchObject({ n: 2, mean: 1.5 });
  });

  it('groups by reported gust size, and by day in the drop zone’s time, keeping days with enough gusting hours', () => {
    expect(s.bySize.map((g) => [g.key, g.n])).toEqual([
      ['under 18 kt', 0],
      ['18 to 22 kt', 4],
      ['23 kt or more', 1],
    ]);
    // By UTC day the 1st would hold three and the 2nd two.
    expect(s.days.map((d) => [d.key, d.n, d.mean])).toEqual([['2026-07-01', 4, 1]]);
    expect(s.dayMeans).toEqual({ n: 1, min: 1, median: 1, max: 1, under: 0, near: 1, over: 0 });
  });

  it('counts hours at a limit as the caution flag reads them: the forecast gust, the higher of the reported wind and gust', () => {
    expect(s.atLimit).toEqual({ limitKt: 12, forecastAt: 6, bothAt: 5, reportOnly: 1, hours: 7 });
  });
});
