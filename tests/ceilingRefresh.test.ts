import { describe, expect, it } from 'vitest';
import {
  chartInputs,
  type ChartData,
  fetchCoverage,
  newest,
  earliestNewest,
  omWindNewest,
  refreshWindow,
  shrinkage,
} from '../src/domain/ceilingRefresh';
// Raw import: the typecheck has no Node types for the tests.
import publishedText from '../public/ceiling-errors/ceiling-errors.json?raw';

// The weekly refresh of the ceiling-error page's data file
// (.github/workflows/ceiling-data-refresh.yml; docs/ceiling-heights.md,
// "The chart").

const published = JSON.parse(publishedText) as ChartData;
const copy = (): ChartData => JSON.parse(publishedText) as ChartData;

describe('chartInputs', () => {
  it('takes every dated ceiling archive, and every dated drop-zone cloud-cover and METAR fetch, in name order', () => {
    const names = [
      'metar-2026-10-15-to-2026-10-17.jsonl.gz',
      'ceiling-2026-10-10-to-2026-10-17.jsonl.gz',
      'cloud-cover-2026-04-01-to-2026-10-09.jsonl.gz',
      'metar-2026-10-10-to-2026-10-15.jsonl.gz',
      'ceiling-2026-04-01-to-2026-10-09.jsonl.gz',
      // Not the chart's: the station comparison's archive, a report, logs.
      'cloud-cover-stations-2026-04-01-to-2026-10-09.jsonl.gz',
      'ceiling-same-hours-2026-10-13-to-2026-10-17.md',
      'logs-to-2026-10-05.jsonl.gz',
      'ndfd-api-check-2026-10-13T1800Z.jsonl.gz',
      'surfacewind-2026-10-09.log',
    ];
    expect(chartInputs(names)).toEqual({
      ceiling: ['ceiling-2026-04-01-to-2026-10-09.jsonl.gz', 'ceiling-2026-10-10-to-2026-10-17.jsonl.gz'],
      cover: [
        'cloud-cover-2026-04-01-to-2026-10-09.jsonl.gz',
        'metar-2026-10-10-to-2026-10-15.jsonl.gz',
        'metar-2026-10-15-to-2026-10-17.jsonl.gz',
      ],
    });
  });

  it('names exactly the files the published data file was built from', () => {
    // Keys only: a glob that is not eager loads nothing.
    const names = Object.keys(import.meta.glob('../data/parity/*')).map((p) => p.split('/').pop() ?? p);
    const { ceiling, cover } = chartInputs(names);
    expect(published.sources.ceiling).toEqual(ceiling);
    expect(published.sources.cover).toEqual(cover);
  });
});

describe('newest', () => {
  it('compares instants, not strings, and is null for none', () => {
    // 19:30+01:00 is 18:30Z: later as text, earlier in time.
    expect(newest(['2026-10-16T18:47Z', '2026-10-16T19:30+01:00', '2026-10-16T06:46Z'])).toBe('2026-10-16T18:47Z');
    expect(newest([])).toBeNull();
    expect(() => newest(['yesterday'])).toThrow(/not a time/);
  });
});

describe('refreshWindow', () => {
  const now = new Date('2026-10-26T07:41Z');

  it('starts each part on the day of its newest record, not the day after, and ends on the last whole UTC day', () => {
    const w = refreshWindow({ lastIssued: '2026-10-16T18:47Z', lastReport: '2026-10-17T00:15Z', lastOmWind: '2026-10-18T23:00Z', lastNdfdWind: '2026-10-18T18:47Z', now });
    expect(w.end).toBe('2026-10-25');
    expect(w.ceiling).toEqual({ start: '2026-10-16', end: '2026-10-25' });
    expect(w.metar).toEqual({ start: '2026-10-17', end: '2026-10-25' });
    expect(w.omWind).toEqual({ start: '2026-10-18', end: '2026-10-25' });
    expect(w.ndfdWind).toEqual({ start: '2026-10-18', end: '2026-10-25' });
  });

  it('ends on the day before now at either end of a UTC day', () => {
    const at = (t: string) => refreshWindow({ lastIssued: '2026-10-01T00:46Z', lastReport: '2026-10-01T00:15Z', lastOmWind: '2026-10-01T23:00Z', lastNdfdWind: '2026-10-01T18:47Z', now: new Date(t) }).end;
    expect(at('2026-10-26T00:00Z')).toBe('2026-10-25');
    expect(at('2026-10-26T23:59Z')).toBe('2026-10-25');
    expect(at('2026-11-01T00:30Z')).toBe('2026-10-31');
  });

  it('leaves a part alone once it holds a record on the last whole day, and fetches it while it holds only the day before', () => {
    const current = refreshWindow({ lastIssued: '2026-10-25T00:46Z', lastReport: '2026-10-25T23:55Z', lastOmWind: '2026-10-25T23:00Z', lastNdfdWind: '2026-10-25T18:47Z', now });
    expect(current.ceiling).toBeNull();
    expect(current.metar).toBeNull();
    expect(current.omWind).toBeNull();
    const behind = refreshWindow({ lastIssued: '2026-10-24T18:47Z', lastReport: '2026-10-24T23:55Z', lastOmWind: '2026-10-24T23:00Z', lastNdfdWind: '2026-10-24T18:47Z', now });
    expect(behind.ceiling).toEqual({ start: '2026-10-24', end: '2026-10-25' });
    expect(behind.metar).toEqual({ start: '2026-10-24', end: '2026-10-25' });
    expect(behind.omWind).toEqual({ start: '2026-10-24', end: '2026-10-25' });
  });

  it('refuses when the archive holds no records', () => {
    const kept = { lastIssued: '2026-10-24T18:47Z', lastReport: '2026-10-24T23:55Z', lastOmWind: '2026-10-24T23:00Z', lastNdfdWind: '2026-10-24T18:47Z', now };
    expect(() => refreshWindow({ ...kept, lastIssued: null })).toThrow(/NDFD.*archive/);
    expect(() => refreshWindow({ ...kept, lastReport: null })).toThrow(/KPMV.*archive/);
  });

  it('does not let a missing Open-Meteo archive stop the ceiling side: it fetches none and says so', () => {
    const kept = { lastIssued: '2026-10-24T18:47Z', lastReport: '2026-10-24T23:55Z', lastOmWind: null, lastNdfdWind: null, now };
    const w = refreshWindow(kept);
    expect(w.ceiling).toEqual({ start: '2026-10-24', end: '2026-10-25' });
    expect(w).toMatchObject({ omWind: null, omWindMissing: true, ndfdWind: null, ndfdWindMissing: true });
    expect(refreshWindow({ ...kept, lastOmWind: '2026-10-24T23:00Z', lastNdfdWind: '2026-10-24T18:47Z' }).omWindMissing).toBe(false);
  });
});

describe('earliestNewest', () => {
  it('takes the earliest of the groups’ newest, so a lagging NDFD element is fetched again', () => {
    expect(
      earliestNewest([
        ['2026-10-20T18:47Z', '2026-10-19T18:47Z'],
        ['2026-10-22T18:46Z'],
        ['2026-10-22T18:47Z'],
      ]),
    ).toBe('2026-10-20T18:47Z');
    expect(earliestNewest([['2026-10-20T18:47Z'], []])).toBeNull();
    expect(earliestNewest([])).toBeNull();
  });
});

describe('omWindNewest', () => {
  const runs = ['historical', 'previous_day1'];

  it('takes the earlier of the two runs’ newest hours, so a lagging run is fetched again', () => {
    const records = [
      { run: 'historical', valid: '2026-10-20T23:00Z' },
      { run: 'previous_day1', valid: '2026-10-22T23:00Z' },
      { run: 'historical', valid: '2026-10-19T23:00Z' },
    ];
    expect(omWindNewest(records, runs)).toBe('2026-10-20T23:00Z');
  });

  it('is null when either run has no records', () => {
    expect(omWindNewest([{ run: 'historical', valid: '2026-10-20T23:00Z' }], runs)).toBeNull();
    expect(omWindNewest([], runs)).toBeNull();
  });
});

describe('fetchCoverage', () => {
  const window = { start: '2026-10-16', end: '2026-10-19' };

  it('counts only records after the newest already kept', () => {
    const times = ['2026-10-16T18:47Z', '2026-10-17T00:46Z', '2026-10-19T18:47Z'];
    expect(fetchCoverage(times, '2026-10-16T18:47Z', window).newer).toBe(2);
    expect(fetchCoverage(times, '2026-10-19T18:47Z', window).newer).toBe(0);
    expect(fetchCoverage([], '2026-10-16T18:47Z', window).newer).toBe(0);
  });

  it('names each day of the window, first and last included, that holds no record', () => {
    expect(fetchCoverage(['2026-10-17T06:46Z', '2026-10-18T12:46Z'], '2026-10-16T18:47Z', window).emptyDays).toEqual([
      '2026-10-16',
      '2026-10-19',
    ]);
  });
});

describe('shrinkage', () => {
  it('finds nothing when the new file holds what the published one does, or more', () => {
    expect(shrinkage(published, copy())).toEqual([]);
    const more = copy();
    more.sources.ceiling.push('ceiling-2026-10-16-to-2026-10-25.jsonl.gz');
    more.sources.kept += 160;
    more.reports.count += 500;
    more.points[0].rows[0].hours += 168;
    expect(shrinkage(published, more)).toEqual([]);
  });

  it('names a source the new file no longer reads', () => {
    const next = copy();
    next.sources.cover = next.sources.cover.slice(1);
    expect(shrinkage(published, next)).toEqual([`source ${published.sources.cover[0]} (--cover) is no longer read`]);
  });

  it('names fewer kept snapshots, fewer reports, or reports that end sooner', () => {
    const next = copy();
    next.sources.kept -= 1;
    next.reports.count -= 1;
    next.reports.span = { from: published.reports.span!.from, to: '2026-10-15T23:55Z' };
    expect(shrinkage(published, next)).toEqual([
      `kept snapshots ${published.sources.kept - 1}, published ${published.sources.kept}`,
      `KPMV reports ${published.reports.count - 1}, published ${published.reports.count}`,
      `reports end 2026-10-15T23:55Z, published ${published.reports.span!.to}`,
    ]);
  });

  it('names a row that lost hours even while another gained them', () => {
    const next = copy();
    next.points[0].rows[0].hours -= 1;
    next.points[0].rows[1].hours += 50;
    const { site } = published.points[0];
    const { label, hours } = published.points[0].rows[0];
    expect(shrinkage(published, next)).toEqual([`point ${site}: row "${label}" ${hours - 1} h, published ${hours}`]);
  });

  it('names a point, an issuance count, a row and a chance element that went missing or fell', () => {
    const next = copy();
    const gone = next.points.pop()!;
    next.points[0].issuances.count -= 1;
    next.points[1].rows.pop();
    next.chances!.elements[0].rows = [];
    const problems = shrinkage(published, next);
    expect(problems).toContain(`point ${gone.site} is gone`);
    expect(problems).toContain(
      `point ${published.points[0].site}: ${published.points[0].issuances.count - 1} issuances, published ${published.points[0].issuances.count}`,
    );
    expect(problems).toContain(`point ${published.points[1].site}: row "${published.points[1].rows[published.points[1].rows.length - 1].label}" is gone`);
    expect(problems.filter((p) => p.startsWith(`chances ${published.chances!.elements[0].key}:`))).toHaveLength(
      published.chances!.elements[0].rows.length,
    );
  });

  it('names a whole chances section that went missing, and a change of version', () => {
    const next = copy();
    next.chances = null;
    next.version = 3;
    const problems = shrinkage(published, next);
    expect(problems[0]).toBe('version 3, published 2');
    expect(problems.filter((p) => p.startsWith('chances '))).toHaveLength(
      published.chances!.elements.reduce((n, e) => n + e.rows.length, 0),
    );
  });
});
