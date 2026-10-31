/**
 * This browser's requests to Open-Meteo, counted the way Open-Meteo counts
 * them.
 *
 * The free API's limits are per address: 600 calls a minute, 5,000 an hour
 * and 10,000 a day, and a "call" is a request's weight, not a request. Read
 * in Open-Meteo's own server source on 2026-10-31 (open-meteo/open-meteo,
 * commit 2060d80: `calculateQueryWeight` in
 * Sources/App/Helper/Writer/ForecastApiResult.swift, charged by
 * `withFreeApiRateLimiter`; the windows in RateLimiter.swift are the
 * clock's minute, hour and UTC day, within a client's first request's
 * seconds; docs/open-meteo-terms.md, "Read again 2026-10-31"):
 *
 *   weight = max(1, max(variables / 10, variables / 10 × days / 14)) per location
 *
 * where `variables` is every hourly, daily, current and 15-minutely
 * variable asked for, times the number of models (ForecastapiController:
 * the variable count times the models' member counts, one each for the
 * models this app could name), and `days` the span of the request
 * (`forecast_days`, 7 by default for the forecast API, plus `past_days`);
 * a request the server answers with an error is charged 1 ("some users do
 * infinite retries on errors"). So the winds-aloft request (96 hourly
 * variables, two days) is 9.6 calls and the 10-day outlook (7 daily
 * variables) is 1. The server also answers with the cost in an
 * `X-RateLimit-Cost` header since a change of 2026-10-26, but the deployed
 * API did not send it on 2026-10-31, and a browser could not read it
 * without a CORS exposure anyway, so the cost is worked from the URL here,
 * by the same formula.
 *
 * Why count: a tab left open all day makes about 1,500 calls, and six or
 * seven such tabs behind one address would cross the daily limit (the
 * maintainer, 2026-10-31: start tracking the usage). This browser can see
 * only its own requests; others on the same address share the limit
 * unseen, and the Data health line says so. The arithmetic is pure; the
 * recording and the storage are src/api/openMeteoUsage.ts.
 */

/** Open-Meteo's free limits, per address, as the server source sets them
 *  by default (`CALL_LIMIT_MINUTELY`, `_HOURLY`, `_DAILY`). */
export const OPEN_METEO_FREE_LIMITS = { minute: 600, hour: 5_000, day: 10_000 } as const;

/** How many UTC days of records are kept, enough to read a fortnight's
 *  pattern off the Data health card. */
export const USAGE_KEEP_DAYS = 14;

/** How one attempt ended, which decides what the server charged for it:
 *  answered, so its weight; rejected with an HTTP error, so 1; timed out on
 *  this side, so most likely its weight, since the server charges at
 *  completion and had the request; or unreachable (a network or CORS
 *  failure, no connection), so nothing, since the request never arrived. */
export type UsageOutcome = 'answered' | 'rejected' | 'timeout' | 'unreachable';
export const USAGE_OUTCOMES: readonly UsageOutcome[] = ['answered', 'rejected', 'timeout', 'unreachable'];

/** One attempt: when (ms), its charge in Open-Meteo's calls, which request
 *  (`k`, a short hash of the URL, so two different requests failing in
 *  the same millisecond, as the winds and the outlook do when the host is
 *  unreachable, stay two records), and how it ended. */
export interface UsageRecord {
  t: number;
  w: number;
  k: string;
  o: UsageOutcome;
}

/** A short key for a request's URL (djb2, base 36): the same URL gives the
 *  same key, and the winds and outlook requests give different ones. */
export function usageKey(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = (h * 33) ^ url.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/** The weight Open-Meteo charges one request of the forecast API, from its
 *  URL. The variable lists are the comma-separated `hourly`, `daily`,
 *  `current` and `minutely_15` parameters; the span is `forecast_days`
 *  (the API's default 7 when absent) plus `past_days`; `models` multiplies
 *  the variables. A `start_date`/`end_date` span is not read (the app sends
 *  none). Never under 1. */
export function openMeteoCallWeight(url: string): number {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return 1;
  }
  const count = (name: string): number => {
    const v = params.get(name);
    return v ? v.split(',').filter((s) => s.length > 0).length : 0;
  };
  const variables = count('hourly') + count('daily') + count('current') + count('minutely_15');
  const models = Math.max(1, count('models'));
  const int = (name: string, fallback: number): number => {
    const v = Number(params.get(name));
    return Number.isFinite(v) && params.has(name) ? v : fallback;
  };
  const days = int('forecast_days', 7) + int('past_days', 0);
  const variablesFraction = (variables * models) / 10;
  const timeFraction = days / 14;
  return Math.max(1, Math.max(variablesFraction, timeFraction * variablesFraction));
}

/** The charge for one attempt by how it ended (`UsageOutcome`). */
export function usageCharge(url: string, outcome: UsageOutcome): number {
  switch (outcome) {
    case 'answered':
    case 'timeout':
      return openMeteoCallWeight(url);
    case 'rejected':
      return 1;
    case 'unreachable':
      return 0;
  }
}

export interface UsageWindow {
  requests: number;
  calls: number;
}

export interface UsageDay extends UsageWindow {
  /** The UTC day, "2026-10-31". */
  day: string;
}

export interface UsageSummary {
  /** The UTC calendar hour and day holding `now`: the limiter's windows,
   *  give or take the seconds of this client's first request. The minute
   *  window (600) is not summarised: ten minutes apart, the app's requests
   *  cannot reach it. */
  hour: UsageWindow;
  day: UsageWindow;
  /** Each UTC day with records, newest first, today included. */
  days: UsageDay[];
}

const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const floorTo = (ms: number, unit: number): number => Math.floor(ms / unit) * unit;

const sum = (records: readonly UsageRecord[]): UsageWindow => ({
  requests: records.length,
  calls: records.reduce((acc, r) => acc + r.w, 0),
});

/** The records read against the clock at `now`. */
export function summarizeUsage(records: readonly UsageRecord[], now: number): UsageSummary {
  const hourStart = floorTo(now, 3_600_000);
  const dayStart = floorTo(now, 86_400_000);
  const inWindow = (start: number, length: number) => records.filter((r) => r.t >= start && r.t < start + length);
  const byDay = new Map<string, UsageRecord[]>();
  for (const r of records) {
    const d = utcDay(r.t);
    const rs = byDay.get(d);
    if (rs) rs.push(r);
    else byDay.set(d, [r]);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, rs]) => ({ day, ...sum(rs) }));
  return {
    hour: sum(inWindow(hourStart, 3_600_000)),
    day: sum(inWindow(dayStart, 86_400_000)),
    days,
  };
}

/** Two sets of records as one, in time order, each record once: what
 *  storage holds (another tab's, or an earlier session's) with what this
 *  tab holds. Records carry no id, so one is the same as another when its
 *  time, request, charge and outcome all are; two tabs recording the same
 *  request in the same millisecond would merge to one, which undercounts
 *  by one and takes two tabs' timers to coincide to the millisecond. */
export function mergeUsage(a: readonly UsageRecord[], b: readonly UsageRecord[]): UsageRecord[] {
  const seen = new Set<string>();
  const out: UsageRecord[] = [];
  for (const r of [...a, ...b]) {
    const key = `${r.t}:${r.k}:${r.w}:${r.o}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out.sort((x, y) => x.t - y.t);
}

/** The records worth keeping at `now`: the last `USAGE_KEEP_DAYS` UTC days,
 *  today included, and nothing from the future (a clock set back). */
export function pruneUsage(records: readonly UsageRecord[], now: number): UsageRecord[] {
  const oldest = floorTo(now, 86_400_000) - (USAGE_KEEP_DAYS - 1) * 86_400_000;
  return records.filter((r) => r.t >= oldest && r.t <= now);
}

/** A stored record, or null: storage is user-writable and survives
 *  reloads, so each field is checked before it is summed. */
export function toUsageRecord(value: unknown): UsageRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.t !== 'number' || !Number.isFinite(raw.t)) return null;
  if (typeof raw.w !== 'number' || !Number.isFinite(raw.w) || raw.w < 0) return null;
  if (typeof raw.k !== 'string') return null;
  if (!USAGE_OUTCOMES.includes(raw.o as UsageOutcome)) return null;
  return { t: raw.t, w: raw.w, k: raw.k, o: raw.o as UsageOutcome };
}
