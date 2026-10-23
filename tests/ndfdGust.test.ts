import { describe, expect, it } from 'vitest';
import {
  largestMisses,
  pairGusts,
  pairNdfdWind,
  parseNdfdWindLines,
  summarizeGusts,
  summarizeNdfdWind,
  type NdfdGustRecord,
} from '../src/domain/ndfdGust';
import { KT_PER_MPS } from '../src/domain/units';
import type { MetarRecord } from '../src/domain/cloudCoverSources';

const ms = (kt: number): number => kt / KT_PER_MPS;
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

describe('parseNdfdWindLines, the gust', () => {
  it('keeps the drop zone’s gust records and drops the no-data fill, other records and other sites', () => {
    const good = rec('01T00:47', '01T02:00', 15);
    const text = [
      JSON.stringify(good),
      '',
      JSON.stringify({ ...good, gust: -4630.2 }),
      JSON.stringify({ ...good, src: 'ndfd-cig' }),
      JSON.stringify({ ...good, site: 'PMV' }),
    ].join('\n');
    expect(parseNdfdWindLines(text).gust).toEqual([good]);
  });
});

describe('pairGusts', () => {
  const records = [
    // Valid 12Z: issued 00:47 (11.2 h ahead), 06:47 (5.2 h), and 12:46,
    // after the hour's start, so never picked for it.
    rec('01T00:47', '01T12:00', 20),
    rec('01T06:47', '01T12:00', 17.6),
    rec('01T12:46', '01T12:00', 30),
    // Valid 13Z: no gust reported at 12:55, so set against the steady wind.
    rec('01T06:47', '01T13:00', 14),
    // A later issuance, so 13Z is within reach.
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

  it('sets the gust against the steady wind where KPMV reported none', () => {
    const [latest] = pairGusts(records, reports);
    expect(latest.pairs.find((p) => p.t === Date.parse('2026-07-01T13:00Z'))).toMatchObject({
      fc: 14,
      gustDiff: null,
      overSteady: 5,
    });
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
  const pair = (day: string, gustDiff: number | null, fc: number, spd: number, gust: number | null, fcWind: number | null = null) => ({
    t: Date.parse(`2026-07-${day}Z`),
    issued: '2026-07-01T00:47Z',
    leadH: 3,
    fc,
    fcWind,
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

  it('groups by month in the drop zone’s time, as it does by day', () => {
    // 03Z on July 1 is 10 pm CDT on June 30.
    const [m] = summarizeGusts([{ label: 'x', pairs: [pair('01T03:00', 2, 20, 14, 18)] }], {
      timeZone: 'America/Chicago',
      limitKt: 12,
      minDayHours: 3,
    });
    expect(m.byMonth.map((g) => g.key)).toEqual(['2026-06']);
  });

  it('reads the forecast as the flag does, the higher of its wind and gust, and counts the gust under the wind', () => {
    // Gust 10 under the limit, wind 13 over it: the flag would fire.
    const [w] = summarizeGusts([{ label: 'x', pairs: [pair('01T18:00', null, 10, 13, null, 13), pair('01T19:00', null, 14, 9, null, 9)] }], {
      timeZone: 'America/Chicago',
      limitKt: 12,
      minDayHours: 3,
    });
    expect(w.atLimit).toMatchObject({ forecastAt: 2, bothAt: 1, reportOnly: 0 });
    expect(w.gustUnderWind).toEqual({ compared: 2, under: 1 });
  });

  it('counts hours at a limit: the forecast gust, and the higher of the reported wind and gust', () => {
    expect(s.atLimit).toEqual({ limitKt: 12, forecastAt: 6, bothAt: 5, reportOnly: 1, hours: 7 });
  });
});

const spdRec = (issued: string, valid: string, kt: number) => ({
  src: 'ndfd-wspd' as const,
  key: `YCUZ98_KWBN_${issued}`,
  issued: `2026-07-${issued}Z`,
  valid: `2026-07-${valid}Z`,
  spd: ms(kt),
});
const dirRec = (issued: string, valid: string, dir: number) => ({
  src: 'ndfd-wdir' as const,
  key: `YBUZ98_KWBN_${issued}`,
  issued: `2026-07-${issued}Z`,
  valid: `2026-07-${valid}Z`,
  dir,
});

describe('parseNdfdWindLines', () => {
  it('sorts the three elements apart from one file, dropping fills, other sites and other records', () => {
    const lines = [
      spdRec('01T00:47', '01T12:00', 10),
      { ...spdRec('01T00:47', '01T13:00', 10), spd: -4630 },
      dirRec('01T00:46', '01T12:00', 200),
      { ...dirRec('01T00:46', '01T12:00', 200), site: 'PMV' },
      rec('01T00:47', '01T12:00', 15),
      { src: 'ndfd-truncated', key: 'x', issued: '2026-07-01T00:47Z', kept: 3 },
    ].map((r) => JSON.stringify(r));
    const w = parseNdfdWindLines(lines.join('\n'));
    expect([w.spd.length, w.gust.length, w.dir.length]).toEqual([1, 1, 1]);
  });
});

describe('pairNdfdWind', () => {
  const wind = {
    // The direction file stamped a minute before its speed file, as the
    // archive's often are: each element is picked on its own.
    spd: [spdRec('01T06:47', '01T12:00', 9.6), spdRec('01T00:47', '01T12:00', 20), spdRec('01T12:46', '01T18:00', 5)],
    gust: [rec('01T06:47', '01T12:00', 15.4)],
    dir: [dirRec('01T06:46', '01T12:00', 200), dirRec('01T00:46', '01T12:00', 90)],
  };
  const reports = [metar('01T11:55', '19012G20KT')];

  it('picks each element’s newest issuance far enough ahead and gives the kept pairs’ shape', () => {
    const [latest, six] = pairNdfdWind(wind, reports);
    expect(latest.pairs).toHaveLength(1);
    const p = latest.pairs[0];
    expect(p.issued).toBe('2026-07-01T06:47Z');
    expect(p.fc.windSpeed).toBeCloseTo(9.6, 6);
    expect(p.fc.windGust).toBeCloseTo(15.4, 6);
    expect(p.fc.windDirection).toBe(200);
    // Six hours ahead: the 00:47 speed and 00:46 direction; no gust that early.
    expect(six.pairs[0].fc).toMatchObject({ windDirection: 90 });
    expect(six.pairs[0].fc.windSpeed).toBeCloseTo(20, 6);
    expect(six.pairs[0].fc.windGust).toBeUndefined();
  });

  it('keeps an hour with only a direction, as the kept pairing does', () => {
    const [latest] = pairNdfdWind({ spd: [], gust: [], dir: [dirRec('01T06:46', '01T12:00', 200)] }, reports);
    expect(latest.pairs).toHaveLength(1);
    expect(latest.pairs[0]).toMatchObject({ issued: '2026-07-01T06:46Z', fc: { windDirection: 200 } });
  });

  it('leaves out an hour with no report near it', () => {
    const [latest] = pairNdfdWind(wind, []);
    expect(latest.pairs).toEqual([]);
  });
});

describe('pairGusts with the speed', () => {
  it('counts an hour with a forecast speed and no gust apart, rather than pairing it', () => {
    const [latest] = pairGusts([], [metar('01T11:55', '19012G20KT')], [spdRec('01T06:47', '01T12:00', 14)]);
    expect(latest).toMatchObject({ pairs: [], withoutGust: 1 });
  });

  it('gives each hour the forecast wind at the same lead, in whole knots', () => {
    const [latest] = pairGusts([rec('01T06:47', '01T12:00', 15.4)], [metar('01T11:55', '19012G20KT')], [
      spdRec('01T06:47', '01T12:00', 9.6),
    ]);
    expect(latest.pairs[0]).toMatchObject({ fc: 15, fcWind: 10 });
  });
});

describe('summarizeNdfdWind', () => {
  it('gives the speed and direction spreads as windDiffs reads them, and the speed by UTC block', () => {
    const at = (iso: string, spdKt: number, dir: number, obsSpd: number, obsDir: number | null) => ({
      t: Date.parse(iso),
      issued: '2026-07-01T00:47Z',
      fc: { windSpeed: spdKt, windDirection: dir },
      obs: { t: Date.parse(iso), spd: obsSpd, gust: null, dir: obsDir, tempC: null, visSm: null },
    });
    const [w] = summarizeNdfdWind([
      {
        label: 'latest issuance',
        pairs: [
          at('2026-07-01T07:00Z', 9.6, 200, 12, 190), // −2 kt, +10°
          at('2026-07-01T19:00Z', 14.4, 350, 12, 10), // +2 kt, −20° the short way
          at('2026-07-01T20:00Z', 5, 90, 0, null), // +5 kt; calm, no direction
        ],
      },
    ]);
    expect(w.hours).toBe(3);
    expect(w.speed).toMatchObject({ n: 3, mean: 1.67 });
    expect(w.dir).toMatchObject({ n: 2, mean: -5 });
    expect(w.speedByUtcBlock).toEqual([
      { key: '06–11Z', n: 1, mean: -2 },
      { key: '18–23Z', n: 2, mean: 3.5 },
    ]);
  });
});

describe('largestMisses', () => {
  it('takes the largest misses either way, largest first, earlier first on a tie, gusting hours only', () => {
    const p = (h: string, d: number | null) => ({
      t: Date.parse(`2026-07-01T${h}:00Z`),
      issued: '2026-07-01T00:47Z',
      leadH: 3,
      fc: 10,
      fcWind: 5,
      obs: { t: 0, spd: 10, gust: d == null ? null : 10 - d, dir: 180, tempC: null, visSm: null },
      gustDiff: d,
      overSteady: d == null ? 0 : null,
    });
    const top = largestMisses([p('01', 3), p('02', -24), p('03', null), p('04', 24), p('05', -5)], 3);
    expect(top.map((x) => x.gustDiff)).toEqual([-24, 24, -5]);
  });
});
