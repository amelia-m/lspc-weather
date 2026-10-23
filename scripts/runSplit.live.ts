/**
 * One sample of the run-split sampler (docs/run-split.md): Mark Schulze's
 * hour in progress and next hour, each set against this app's Open-Meteo
 * answer for the same valid hour, whatever the minute; and two app requests
 * a moment apart, set against each other. Prints one `@@parity` line with
 * `kind: 'runsplit'`; the arithmetic is src/domain/runSplit.ts.
 *
 * Opt-in: skipped unless RUN_SPLIT_SAMPLE=1, as surfaceWindCompare.live.ts
 * is, because the daily sky-parity job runs every scripts/*.live.ts. Run by
 * scripts/runSplitLoop.sh from .github/workflows/run-split-sample.yml, or by
 * hand from the sandbox with the proxy env (CLAUDE.md):
 *
 *   RUN_SPLIT_SAMPLE=1 npx vitest run --config vitest.live.config.ts scripts/runSplit.live.ts
 *
 * Never fails: a side it cannot read is recorded as null, with the reason.
 */
import { describe, it } from 'vitest';
import { SITE } from '../src/config/site';
import {
  coerceOpenMeteoTimes,
  normalizeOpenMeteoHours,
  openMeteoWindsUrl,
  type RawOpenMeteo,
} from '../src/domain/normalize';
import { appRawLevels, rawGap, schulzeRawLevels, type RawLevel, type RunSplitRecord } from '../src/domain/runSplit';
import { RUN_DOMAINS, runMeta, schulze, type Schulze } from './schulzeFetch';

const H = 3_600_000;

async function appHours(errors: string[], label: string): Promise<Map<number, RawLevel[]> | null> {
  try {
    const res = await fetch(openMeteoWindsUrl(SITE.dz.lat, SITE.dz.lon), {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const hours = normalizeOpenMeteoHours(coerceOpenMeteoTimes((await res.json()) as RawOpenMeteo));
    const out = new Map<number, RawLevel[]>();
    for (const h of hours) if (h.validMs != null) out.set(h.validMs, appRawLevels(h.samples, SITE.dz.elevationFt));
    return out;
  } catch (e) {
    errors.push(`open-meteo ${label}: ${(e as Error).message}`);
    return null;
  }
}

describe.skipIf(process.env.RUN_SPLIT_SAMPLE !== '1')('run split sample (opt-in: RUN_SPLIT_SAMPLE=1)', () => {
  it('records which runs the two tools and two app requests were on', async () => {
    const now = Date.now();
    const errors: string[] = [];
    const runsP = Promise.all(RUN_DOMAINS.map(async (d) => [d, await runMeta(d)] as const)).then(Object.fromEntries);
    // The app's first request and both of his at once; the app's second as
    // soon as its first has answered, so the two are a moment apart.
    const startFirst = Date.now();
    let startSecond = startFirst;
    const firstP = appHours(errors, 'first');
    const secondP = firstP.then(() => {
      startSecond = Date.now();
      return appHours(errors, 'second');
    });
    const [first, second, s0, s1] = await Promise.all([firstP, secondP, schulze(0), schulze(1)]);
    if (!s0) errors.push('schulze offset 0: unreadable');
    if (!s1) errors.push('schulze offset 1: unreadable');

    const hourInProgress = Math.floor(now / H) * H;
    const theirs = (s: Schulze | null) => (s ? schulzeRawLevels(s) : null);
    const record: RunSplitRecord = {
      kind: 'runsplit',
      v: 1,
      at: new Date(now).toISOString(),
      minute: new Date(now).getUTCMinutes(),
      hours: ([0, 1] as const).map((offset) => {
        const s = offset === 0 ? s0 : s1;
        // His `validtime` is the UTC hour he served: the hour in progress plus
        // the offset, or one later when his server handled the request after
        // the hour turned. Compared at the hour he served.
        const t = [0, 1]
          .map((k) => hourInProgress + (offset + k) * H)
          .find((x) => s != null && Number(s.validtime) === new Date(x).getUTCHours());
        const his = s && t != null ? theirs(s) : null;
        if (s && t == null) errors.push(`schulze offset ${offset}: served ${s.validtime}Z`);
        const a = t != null ? first?.get(t) : undefined;
        const b = t != null ? second?.get(t) : undefined;
        return {
          offset,
          validHour: t != null ? new Date(t).toISOString() : null,
          vsFirst: his && a ? rawGap(a, his) : null,
          vsSecond: his && b ? rawGap(b, his) : null,
        };
      }),
      self: ([0, 1] as const).map((offset) => {
        const t = hourInProgress + offset * H;
        const a = first?.get(t);
        const b = second?.get(t);
        return { offset, gap: a && b ? rawGap(a, b) : null };
      }),
      apartS: first && second ? Math.round((startSecond - startFirst) / 100) / 10 : null,
      omRuns: await runsP,
      ...(errors.length ? { errors } : {}),
    };
    const line = (h: RunSplitRecord['hours'][number]) =>
      `offset ${h.offset}: vs first ${h.vsFirst?.mismatch ?? '—'} (max ${h.vsFirst?.maxDir ?? '—'}°/${h.vsFirst?.maxSpd ?? '—'} kt), vs second ${h.vsSecond?.mismatch ?? '—'}`;
    process.stdout.write(
      [
        `run split at ${record.at} (minute ${record.minute})`,
        ...record.hours.map(line),
        `app vs app (${record.apartS ?? '—'} s apart): ${record.self.map((s) => `offset ${s.offset} ${s.gap?.mismatch ?? '—'}`).join(', ')}`,
        ...(errors.length ? [`errors: ${errors.join('; ')}`] : []),
        `@@parity ${JSON.stringify(record)}`,
        '',
      ].join('\n'),
    );
  });
});
