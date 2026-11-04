import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  OPEN_METEO_FREE_LIMITS,
  USAGE_KEEP_DAYS,
  mergeUsage,
  openMeteoCallWeight,
  parseRateLimitHeaders,
  pruneUsage,
  quotaWindowLabel,
  summarizeUsage,
  toUsageRecord,
  usageCharge,
  usageKey,
  type UsageOutcome,
  type UsageRecord,
} from '../src/domain/openMeteoUsage';
import { openMeteoDailyUrl, openMeteoWindsUrl } from '../src/domain/normalize';
import {
  clearOpenMeteoUsage,
  loadPersistedUsage,
  openMeteoUsage,
  recordOpenMeteoRequest,
} from '../src/api/openMeteoUsage';
import { DataFreshness } from '../src/components/DataFreshness';
import type { SourceKey, SourceStatus } from '../src/domain/types';

const STORAGE_KEY = 'lspc:openMeteoUsage';

/** Vitest runs in node: no localStorage unless a test installs one. */
function installStorage(seed?: string): Map<string, string> {
  const store = new Map<string, string>();
  if (seed !== undefined) store.set(STORAGE_KEY, seed);
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mock as unknown as Storage, configurable: true, writable: true });
  return store;
}
const removeStorage = (): void => void Reflect.deleteProperty(globalThis, 'localStorage');

/** 04:45:30Z: thirty seconds into a minute, so a record 30 s back is in the
 *  same minute and one 40 s back in the minute before. */
const T0 = Date.parse('2026-10-31T04:45:30Z');
const rec = (t: number, w = 1, o: UsageOutcome = 'answered', k = 'winds'): UsageRecord => ({ t, w, k, o });

describe('openMeteoCallWeight', () => {
  it("charges the app's two requests as Open-Meteo's formula does: 9.6 for the winds, 1 for the outlook", () => {
    // 96 hourly variables, two days: max(1, max(9.6, 9.6 × 2/14)). Seven
    // daily variables, ten days: 0.7, floored to 1. The formula was read in
    // the server source on 2026-10-31 (docs/open-meteo-terms.md).
    expect(openMeteoCallWeight(openMeteoWindsUrl(40.8703, -96.1085))).toBeCloseTo(9.6, 6);
    expect(openMeteoCallWeight(openMeteoDailyUrl(40.8703, -96.1085, 'America/Chicago'))).toBe(1);
  });

  it('scales with the span above fourteen days, and with models; defaults the span to seven days', () => {
    const base = 'https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2';
    // 15 variables over 28 days: 1.5 × 2 = 3 (the FAQ's example, read 2026-10-31).
    const vars = Array.from({ length: 15 }, (_, i) => `v${i}`).join(',');
    expect(openMeteoCallWeight(`${base}&hourly=${vars}&forecast_days=28`)).toBeCloseTo(3, 6);
    expect(openMeteoCallWeight(`${base}&hourly=${vars}&forecast_days=14`)).toBeCloseTo(1.5, 6);
    expect(openMeteoCallWeight(`${base}&hourly=${vars}&forecast_days=7&past_days=7`)).toBeCloseTo(1.5, 6);
    // Two models double the variables; current and daily lists count too.
    expect(openMeteoCallWeight(`${base}&hourly=${vars}&models=a,b`)).toBeCloseTo(3, 6);
    expect(openMeteoCallWeight(`${base}&hourly=a,b,c&daily=d,e&current=f,g,h,i,j,k,l`)).toBeCloseTo(1.2, 6);
    // Under ten variables, or no variables, or not a URL: 1.
    expect(openMeteoCallWeight(`${base}&hourly=a,b`)).toBe(1);
    expect(openMeteoCallWeight(base)).toBe(1);
    expect(openMeteoCallWeight('not a url')).toBe(1);
  });

  it('charges by how the attempt ended: the weight when answered or timed out, 1 when rejected, nothing when unreachable', () => {
    const winds = openMeteoWindsUrl(40.8703, -96.1085);
    expect(usageCharge(winds, 'answered')).toBeCloseTo(9.6, 6);
    // The server charges at completion and had the request; this side gave up.
    expect(usageCharge(winds, 'timeout')).toBeCloseTo(9.6, 6);
    // An HTTP error, the limiter's 429 included, is charged 1.
    expect(usageCharge(winds, 'rejected')).toBe(1);
    // A request that never arrived (no network, a CORS block) cost nothing.
    expect(usageCharge(winds, 'unreachable')).toBe(0);
  });

  it('keys a request by its URL, so the winds and the outlook differ and a URL is stable', () => {
    const winds = openMeteoWindsUrl(40.8703, -96.1085);
    const daily = openMeteoDailyUrl(40.8703, -96.1085, 'America/Chicago');
    expect(usageKey(winds)).toBe(usageKey(winds));
    expect(usageKey(winds)).not.toBe(usageKey(daily));
    expect(usageKey(winds)).toMatch(/^[0-9a-z]+$/);
  });
});

describe('summarizeUsage', () => {
  it('reads the records against the UTC hour and day holding now, and lists each day', () => {
    const records = [
      rec(T0 - 30_000, 9.6), // this hour
      rec(T0 - 10 * 60_000, 1), // this hour
      rec(T0 - 3 * 3_600_000, 9.6), // today (01:45Z), not this hour
      rec(T0 - 5 * 3_600_000, 9.6), // yesterday, 23:45Z
      rec(T0 - 5 * 3_600_000, 1, 'rejected'), // yesterday, a failure
    ];
    const s = summarizeUsage(records, T0);
    expect(s.hour).toEqual({ requests: 2, calls: 10.6 });
    expect(s.day).toEqual({ requests: 3, calls: 20.2 });
    expect(s.days).toEqual([
      { day: '2026-10-31', requests: 3, calls: 20.2 },
      { day: '2026-10-30', requests: 2, calls: 10.6 },
    ]);
  });

  it('is empty with no records', () => {
    const s = summarizeUsage([], T0);
    expect(s.day).toEqual({ requests: 0, calls: 0 });
    expect(s.days).toEqual([]);
  });

  it('states the free limits the server source sets by default', () => {
    expect(OPEN_METEO_FREE_LIMITS).toEqual({ minute: 600, hour: 5000, day: 10000 });
  });
});

describe('mergeUsage', () => {
  it('joins two tabs’ records in time order, each once', () => {
    const a = [rec(T0 - 2000, 9.6), rec(T0 - 1000, 1)];
    const b = [rec(T0 - 1000, 1), rec(T0 - 3000, 9.6, 'rejected')];
    expect(mergeUsage(a, b)).toEqual([rec(T0 - 3000, 9.6, 'rejected'), rec(T0 - 2000, 9.6), rec(T0 - 1000, 1)]);
    // The same millisecond with a different charge or outcome is two records.
    expect(mergeUsage([rec(T0, 9.6)], [rec(T0, 1), rec(T0, 9.6, 'rejected')])).toHaveLength(3);
  });

  it('keeps the winds and the outlook apart when both fail in the same millisecond', () => {
    // Offline, the two requests start together and reject together; they
    // are two records, not one, because their URLs differ (`k`).
    const same = [rec(T0, 0, 'unreachable', 'winds'), rec(T0, 0, 'unreachable', 'daily')];
    expect(mergeUsage([], same)).toHaveLength(2);
    expect(mergeUsage(same, same)).toHaveLength(2);
  });
});

describe('pruneUsage', () => {
  it('keeps the last fourteen UTC days, today included, and nothing from the future', () => {
    const dayMs = 86_400_000;
    const todayStart = Math.floor(T0 / dayMs) * dayMs;
    const kept = pruneUsage(
      [
        rec(todayStart - (USAGE_KEEP_DAYS - 1) * dayMs), // the oldest day kept, at its start
        rec(todayStart - (USAGE_KEEP_DAYS - 1) * dayMs - 1), // a millisecond older: dropped
        rec(T0),
        rec(T0 + 1), // the future: dropped
      ],
      T0,
    );
    expect(kept.map((r) => r.t)).toEqual([todayStart - (USAGE_KEEP_DAYS - 1) * dayMs, T0]);
  });
});

describe('toUsageRecord', () => {
  it('accepts a well-formed record and rejects the rest', () => {
    expect(toUsageRecord({ t: 1, w: 9.6, k: 'a', o: 'answered', extra: 1 })).toEqual({ t: 1, w: 9.6, k: 'a', o: 'answered' });
    for (const bad of [
      null,
      5,
      [],
      { t: 'x', w: 1, k: 'a', o: 'answered' },
      { t: 1, w: -1, k: 'a', o: 'answered' },
      { t: 1, w: 1, k: 'a' },
      { t: 1, w: 1, k: 'a', o: 'ok' },
      { t: 1, w: 1, o: 'answered' },
      { t: NaN, w: 1, k: 'a', o: 'answered' },
    ]) {
      expect(toUsageRecord(bad)).toBeNull();
    }
  });
});

describe('the recorder', () => {
  afterEach(() => {
    clearOpenMeteoUsage();
    removeStorage();
  });

  it('records each attempt with its charge, persists, and restores', () => {
    const store = installStorage();
    const winds = openMeteoWindsUrl(40.8703, -96.1085);
    recordOpenMeteoRequest(winds, 'rejected', T0 - 2000);
    recordOpenMeteoRequest(winds, 'unreachable', T0 - 1000);
    recordOpenMeteoRequest(winds, 'answered', T0);
    // Three attempts, charged 1, 0 and 9.6.
    expect(openMeteoUsage(T0).day).toEqual({ requests: 3, calls: 10.6 });
    const stored = JSON.parse(store.get(STORAGE_KEY)!) as UsageRecord[];
    expect(stored).toEqual([
      { t: T0 - 2000, w: 1, k: usageKey(winds), o: 'rejected' },
      { t: T0 - 1000, w: 0, k: usageKey(winds), o: 'unreachable' },
      { t: T0, w: 9.6, k: usageKey(winds), o: 'answered' },
    ]);
    clearOpenMeteoUsage();
    expect(openMeteoUsage(T0).day.requests).toBe(0);
    store.set(STORAGE_KEY, JSON.stringify([...stored, { t: 'bad' }, { t: T0 - 30 * 86_400_000, w: 1, k: 'x', o: 'answered' }]));
    loadPersistedUsage(T0);
    // The malformed record and the one past fourteen days are dropped.
    expect(openMeteoUsage(T0).days).toEqual([{ day: '2026-10-31', requests: 3, calls: 10.6 }]);
  });

  it('keeps another tab’s records when it writes', () => {
    // Two tabs of one browser: each loads once, then writes; the count the
    // card claims is the browser's, so a write merges what storage holds.
    const store = installStorage();
    const winds = openMeteoWindsUrl(40.8703, -96.1085);
    recordOpenMeteoRequest(winds, 'answered', T0 - 60_000); // this tab, loaded and written
    const otherTab = JSON.stringify([...(JSON.parse(store.get(STORAGE_KEY)!) as UsageRecord[]), { t: T0 - 30_000, w: 1, k: 'daily', o: 'answered' }]);
    store.set(STORAGE_KEY, otherTab); // the other tab wrote meanwhile
    recordOpenMeteoRequest(winds, 'answered', T0);
    expect(openMeteoUsage(T0).day).toEqual({ requests: 3, calls: 20.2 });
    expect(JSON.parse(store.get(STORAGE_KEY)!)).toHaveLength(3);
  });

  it('reads storage on the first read without an explicit load, so a restored fortnight shows at once', () => {
    installStorage(JSON.stringify([{ t: T0 - 86_400_000, w: 9.6, k: 'winds', o: 'answered' }]));
    expect(openMeteoUsage(T0).days).toEqual([{ day: '2026-10-30', requests: 1, calls: 9.6 }]);
  });

  it('is call-safe without storage and with a stored value that is not an array', () => {
    expect(() => recordOpenMeteoRequest('https://api.open-meteo.com/v1/forecast?hourly=a', 'answered', T0)).not.toThrow();
    expect(openMeteoUsage(T0).day.requests).toBe(1);
    clearOpenMeteoUsage();
    installStorage('{"not":"an array"}');
    loadPersistedUsage(T0);
    expect(openMeteoUsage(T0).day.requests).toBe(0);
  });
});

describe('Data health shows the count beside the limits', () => {
  const status = Object.fromEntries(
    (['metar', 'nws', 'windsAloft', 'taf', 'daily', 'nbm'] as SourceKey[]).map((k) => [
      k,
      { ok: true, pending: false, stale: false, error: null, fetchedAt: T0 } as SourceStatus,
    ]),
  ) as Record<SourceKey, SourceStatus>;
  const html = (usage: ReturnType<typeof summarizeUsage> | null) =>
    renderToStaticMarkup(createElement(DataFreshness, { status, lastUpdated: T0, onRefresh: () => {}, openMeteoUsage: usage })).replace(
      /<!-- -->/g,
      '',
    );

  it('names today’s and this hour’s requests and calls, the limits, and what it cannot see', () => {
    const usage = summarizeUsage([rec(T0 - 30_000, 9.6), rec(T0 - 40_000, 1), rec(T0 - 3 * 3_600_000, 9.6)], T0);
    const out = html(usage);
    expect(out).toContain('This browser’s requests to Open-Meteo');
    expect(out).toContain('today 3, about 20.2 calls of its 10,000 a day for one address');
    expect(out).toContain('this hour 2, about 10.6 of 5,000');
    expect(out).toContain('Other browsers on the same address share those limits and are not counted here');
    expect(out).toContain('<td>2026-10-31</td><td>3</td><td>20.2</td>');
    // A sum of fractions prints whole when it is whole: 9.6 × 5 + 1 × 2.
    const whole = summarizeUsage([...Array.from({ length: 5 }, (_, i) => rec(T0 - i, 9.6)), rec(T0 - 9, 1), rec(T0 - 8, 1)], T0);
    expect(html(whole)).toContain('today 7, about 50 calls');
    expect(html(whole)).not.toContain('50.0');
  });

  it('shows nothing with no requests made, or no summary given', () => {
    expect(html(summarizeUsage([], T0))).not.toContain('This browser');
    expect(html(null)).not.toContain('This browser');
  });
});

describe('fetchJson tells the counter about every attempt', () => {
  it('reports a failed attempt and then the answered retry', async () => {
    const { fetchJson } = await import('../src/api/http');
    const seen: string[] = [];
    let calls = 0;
    const stub = async () => {
      calls += 1;
      if (calls === 1) return new Response('down', { status: 503 });
      return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const real = globalThis.fetch;
    globalThis.fetch = stub as unknown as typeof fetch;
    try {
      const out = await fetchJson<{ ok: boolean }>('https://api.open-meteo.com/v1/forecast?hourly=a', {
        retries: 1,
        onAttempt: (ok) => seen.push(ok),
      });
      expect(out).toEqual({ ok: true });
      expect(seen).toEqual(['rejected', 'answered']);
    } finally {
      globalThis.fetch = real;
    }
  });

  it('reports an answered request once, even when its body will not parse', async () => {
    // A 200 with a cut or non-JSON body is a request the server charged in
    // full; reporting it answered and then failed would count it twice.
    const { fetchJson } = await import('../src/api/http');
    const seen: string[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async () => new Response('not json', { status: 200 })) as unknown as typeof fetch;
    try {
      await expect(fetchJson('https://api.open-meteo.com/v1/forecast?hourly=a', { retries: 1, onAttempt: (o) => seen.push(o) })).rejects.toThrow();
      expect(seen).toEqual(['answered', 'answered']);
    } finally {
      globalThis.fetch = real;
    }
  });

  it('tells a request that never arrived from one that timed out', async () => {
    const { fetchJson } = await import('../src/api/http');
    const seen: string[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    try {
      await expect(fetchJson('https://api.open-meteo.com/v1/forecast?hourly=a', { retries: 0, onAttempt: (o) => seen.push(o) })).rejects.toThrow();
      expect(seen).toEqual(['unreachable']);
    } finally {
      globalThis.fetch = real;
    }
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    globalThis.fetch = (async () => {
      throw abort;
    }) as unknown as typeof fetch;
    seen.length = 0;
    try {
      await expect(fetchJson('https://api.open-meteo.com/v1/forecast?hourly=a', { retries: 0, onAttempt: (o) => seen.push(o) })).rejects.toThrow();
      expect(seen).toEqual(['timeout']);
    } finally {
      globalThis.fetch = real;
    }
  });
});

/* The server's own count, off the X-RateLimit headers the deployed API has
 * sent and exposed to browsers since 2026-11-04 (read that day: Cost 9.6
 * for the winds request, Limit 600, Remaining 577.4, Reset in epoch
 * seconds, Window 60). The window reported is whichever has the least
 * remaining. */
const HEADERS: Record<string, string> = {
  'x-ratelimit-cost': '9.6',
  'x-ratelimit-limit': '600.0',
  'x-ratelimit-remaining': '577.4',
  'x-ratelimit-reset': '1793777868',
  'x-ratelimit-window': '60',
};
const lookup = (h: Record<string, string>) => (name: string) => h[name.toLowerCase()] ?? null;

describe('parseRateLimitHeaders', () => {
  it('reads the five headers as the server sends them', () => {
    expect(parseRateLimitHeaders(lookup(HEADERS), T0)).toEqual({
      at: T0,
      cost: 9.6,
      limit: 600,
      remaining: 577.4,
      window: 60,
      resetMs: 1793777868000,
    });
  });

  it('gives nothing without the limit, remaining and window, and no cost or reset without theirs', () => {
    const without = (name: string) => lookup(Object.fromEntries(Object.entries(HEADERS).filter(([k]) => k !== name)));
    expect(parseRateLimitHeaders(without('x-ratelimit-limit'), T0)).toBeNull();
    expect(parseRateLimitHeaders(without('x-ratelimit-remaining'), T0)).toBeNull();
    expect(parseRateLimitHeaders(without('x-ratelimit-window'), T0)).toBeNull();
    expect(parseRateLimitHeaders(lookup({ ...HEADERS, 'x-ratelimit-window': '0' }), T0)).toBeNull();
    expect(parseRateLimitHeaders(lookup({ ...HEADERS, 'x-ratelimit-remaining': 'many' }), T0)).toBeNull();
    expect(parseRateLimitHeaders(without('x-ratelimit-cost'), T0)).toMatchObject({ cost: null, limit: 600 });
    expect(parseRateLimitHeaders(without('x-ratelimit-reset'), T0)).toMatchObject({ resetMs: null });
    expect(parseRateLimitHeaders(() => null, T0)).toBeNull();
  });

  it('names the windows the limiter has', () => {
    expect(quotaWindowLabel(60)).toBe('this minute');
    expect(quotaWindowLabel(3600)).toBe('this hour');
    expect(quotaWindowLabel(86400)).toBe('today');
    expect(quotaWindowLabel(90)).toBe('this 90 s window');
  });

  it('is carried by the summary, null before any answer', () => {
    expect(summarizeUsage([], T0).server).toBeNull();
    const q = parseRateLimitHeaders(lookup(HEADERS), T0)!;
    expect(summarizeUsage([], T0, q).server).toBe(q);
  });
});

describe('the recorder keeps the server’s newest figures', () => {
  afterEach(() => {
    clearOpenMeteoUsage();
    removeStorage();
  });

  it('takes them off an answer’s headers, keeps the last when an answer has none, and clears with the rest', () => {
    installStorage();
    const winds = openMeteoWindsUrl(40.8703, -96.1085);
    expect(openMeteoUsage(T0).server).toBeNull();
    recordOpenMeteoRequest(winds, 'answered', T0 - 1000, new Headers(HEADERS));
    expect(openMeteoUsage(T0).server).toMatchObject({ at: T0 - 1000, cost: 9.6, remaining: 577.4, window: 60 });
    // A rejected attempt carries headers too (a 429 says what is left).
    recordOpenMeteoRequest(winds, 'rejected', T0 - 500, new Headers({ ...HEADERS, 'x-ratelimit-remaining': '0', 'x-ratelimit-cost': '1.0' }));
    expect(openMeteoUsage(T0).server).toMatchObject({ at: T0 - 500, cost: 1, remaining: 0 });
    // An answer without the headers leaves the last reading in place.
    recordOpenMeteoRequest(winds, 'answered', T0, new Headers({ 'content-type': 'application/json' }));
    expect(openMeteoUsage(T0).server).toMatchObject({ at: T0 - 500, remaining: 0 });
    recordOpenMeteoRequest(winds, 'timeout', T0);
    expect(openMeteoUsage(T0).server).toMatchObject({ at: T0 - 500 });
    expect(openMeteoUsage(T0).day.requests).toBe(4);
    clearOpenMeteoUsage();
    expect(openMeteoUsage(T0).server).toBeNull();
  });
});

describe('Data health shows the server’s own count', () => {
  const status = Object.fromEntries(
    (['metar', 'nws', 'windsAloft', 'taf', 'daily', 'nbm'] as SourceKey[]).map((k) => [
      k,
      { ok: true, pending: false, stale: false, error: null, fetchedAt: T0 } as SourceStatus,
    ]),
  ) as Record<SourceKey, SourceStatus>;
  const html = (usage: ReturnType<typeof summarizeUsage>) =>
    renderToStaticMarkup(createElement(DataFreshness, { status, lastUpdated: T0, onRefresh: () => {}, openMeteoUsage: usage })).replace(
      /<!-- -->/g,
      '',
    );

  it('prints what is left of the window the server named, its age, and the cost, as the server’s', () => {
    const q = parseRateLimitHeaders(lookup(HEADERS), T0 - 3 * 60_000)!;
    const out = html(summarizeUsage([rec(T0 - 30_000, 9.6)], T0, q));
    expect(out).toContain('Open-Meteo’s own count for this address');
    expect(out).toContain('577.4 of 600 calls left this minute, every browser on the address included; that request cost 9.6.');
    expect(out).toContain('names whichever of its minute, hour and day windows has the least left');
    // The day window, when the server names it, and no cost when it sent none.
    const day = html(summarizeUsage([rec(T0 - 30_000, 9.6)], T0, { ...q, window: 86400, limit: 10_000, remaining: 412, cost: null }));
    expect(day).toContain('412 of 10,000 calls left today, every browser on the address included.');
    expect(day).not.toContain('that request cost');
  });

  it('prints nothing of the server before an answer carried its figures', () => {
    expect(html(summarizeUsage([rec(T0 - 30_000, 9.6)], T0))).not.toContain('own count');
  });
});

describe('fetchJson hands the answer’s headers to the counter', () => {
  it('with an answered and with a rejected attempt, and none for one that never arrived', async () => {
    const { fetchJson } = await import('../src/api/http');
    const seen: [string, string | null | undefined][] = [];
    let calls = 0;
    const real = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('Failed to fetch');
      // A 5xx, which fetchJson retries; the limiter's 429 is a 4xx and is
      // not, so the headers it carries reach the counter on the one attempt.
      if (calls === 2) return new Response('down', { status: 503, headers: { ...HEADERS, 'x-ratelimit-remaining': '0' } });
      return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json', ...HEADERS } });
    }) as unknown as typeof fetch;
    try {
      await fetchJson('https://api.open-meteo.com/v1/forecast?hourly=a', {
        retries: 2,
        onAttempt: (o, h) => seen.push([o, h === undefined ? undefined : h.get('x-ratelimit-remaining')]),
      });
      expect(seen).toEqual([
        ['unreachable', undefined],
        ['rejected', '0'],
        ['answered', '577.4'],
      ]);
    } finally {
      globalThis.fetch = real;
    }
  });
});
