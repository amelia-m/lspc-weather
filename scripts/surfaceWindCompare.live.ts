/**
 * Live surface-wind comparison: KPMV's METAR beside four forecasts of the
 * 10 m wind at the drop zone, with every time each source gives about itself.
 *
 * Opt-in: it is skipped unless SURFACE_WIND_SAMPLE=1. The live config
 * (vitest.live.config.ts) takes every scripts/*.live.ts, and the daily
 * sky-parity job runs that config with no path, so without the switch this
 * would run there too; it belongs to no workflow. Run it by hand from the
 * sandbox with the proxy env (see CLAUDE.md), once per sample, e.g. in a
 * shell loop every few minutes:
 *
 *   SURFACE_WIND_SAMPLE=1 NODE_USE_ENV_PROXY=1 \
 *     NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *     npx vitest run --config vitest.live.config.ts scripts/surfaceWindCompare.live.ts
 *
 * and the `@@parity` lines collected into a file, which
 * scripts/surfaceWindSummary.ts reads. Never by `npm test`: it needs the
 * network.
 *
 * Why it exists: surface wind is the most-read figure on the dashboard and
 * drives the student wind-limit flag. Open-Meteo serves a 15-minute
 * (`minutely_15`) and a `current` 10 m wind beside the hourly one the app
 * requests now, and the question (2026-10-09) was whether either is updated
 * more often, sits nearer what KPMV measures, or differs in some other way
 * that matters. What one session's sample found is in docs/source-parity.md,
 * "Surface wind: four forecasts against the METAR".
 *
 * Measurement only. It is a report, never fails on a difference, and adds no
 * threshold: the summary counts and spreads, a person reads them.
 *
 * Open-Meteo's fair use: two forecast requests a run, plus two metadata
 * requests that its model-updates page says are not counted toward limits.
 * A run every few minutes is well inside the free tier; do not loop faster.
 */
import { describe, it } from 'vitest';
import { SITE } from '../src/config/site';
import { normalizeGridpoint, normalizeNwsObservation, type RawGridpoint, type RawNwsObservation } from '../src/domain/normalize';
import { chooseObservation, normalizeIemCurrent, type RawIemCurrents } from '../src/domain/iem';
import {
  hasWind,
  compareWindResponses,
  maxAgeSeconds,
  metarWindGroup,
  openMeteoCurrent,
  openMeteoRunMeta,
  openMeteoSeries,
  SURFACE_WIND_RECORD_VERSION,
  type HrrrDiff,
  type OpenMeteoRunMeta,
  type RawOpenMeteoWind,
  type SurfaceWindRecord,
  type WindAt,
} from '../src/domain/surfaceWindSources';

const UA = 'lspc-weather surface-wind-compare (github.com/amelia-m/lspc-weather)';
const { dz } = SITE;
const station = SITE.metarStation;
const HOUR = 3_600_000;

/** The Open-Meteo domains whose run times are logged: HRRR's hourly and
 *  15-minute output, which the default model is for this point
 *  (`sameAsHrrr` checks it each run). */
const OM_DOMAINS = ['ncep_hrrr_conus', 'ncep_hrrr_conus_15min'] as const;

const say = (lines: string[]): void => {
  process.stdout.write(lines.join('\n') + '\n');
};

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The run's time budget. Every fetch, retries and body included, must end
 *  by `deadline`, so a slow or silent source is logged as that source's
 *  `…Error` and the run still prints its record, well inside vitest's
 *  60 s test timeout (vitest.live.config.ts). The NWS forecast is two
 *  requests in a row (points, then the grid), so each try gets at most
 *  PER_TRY_MS and never more than what is left. */
const RUN_BUDGET_MS = 40_000;
const PER_TRY_MS = 12_000;
let deadline = 0;

/** One GET, tried again while time is left when the connection itself
 *  fails: from the sandbox on 2026-10-09 the proxy now and then dropped a
 *  TLS handshake to api.open-meteo.com (curl's SSL_ERROR_SYSCALL) or timed
 *  out connecting, which says nothing about the source. An HTTP error
 *  status is the source's answer and is not retried. The signal also bounds
 *  reading the body, which the caller does with the same Response. */
async function get(url: string, accept = 'application/json'): Promise<Response> {
  let lastErr: unknown = new Error('no time left in the run');
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1_000));
    const left = deadline - Date.now();
    if (left < 1_000) break;
    let res: Response;
      try {
        res = await fetch(url, {
          headers: { 'User-Agent': UA, Accept: accept },
          signal: AbortSignal.timeout(Math.min(PER_TRY_MS, left)),
        });
      } catch (e) {
      lastErr = e;
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return res;
  }
  const cause = lastErr instanceof Error && lastErr.cause ? ` (${msg(lastErr.cause)})` : '';
  throw new Error(`${new URL(url).host}: ${msg(lastErr)}${cause}`);
}

/** A second bound beside get's: rejects a second after the deadline,
 *  whatever the task is still doing, so the run always reaches its record. */
function bounded<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('ran past the run’s time budget')),
      Math.max(0, deadline - Date.now()) + 1_000,
    );
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}
const r1 = (v: number | null): number | null => (v == null ? null : Math.round(v * 10) / 10);

/** Open-Meteo's surface wind request: `current`, two hours back and three
 *  forward of hourly steps, two hours back and an hour and a quarter forward
 *  of 15-minute steps, all three variables, knots, Unix times. `model`
 *  pins one model; without it the default ("best match") answers. */
function omUrl(model?: string): string {
  const vars = 'wind_speed_10m,wind_direction_10m,wind_gusts_10m';
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${dz.lat}&longitude=${dz.lon}` +
    `&current=${vars}&hourly=${vars}&minutely_15=${vars}` +
    `&past_hours=2&forecast_hours=3&past_minutely_15=8&forecast_minutely_15=5` +
    `&wind_speed_unit=kn&timeformat=unixtime&timezone=UTC` +
    (model ? `&models=${model}` : '')
  );
}

describe.skipIf(process.env.SURFACE_WIND_SAMPLE !== '1')('surface wind sample (opt-in: SURFACE_WIND_SAMPLE=1)', () => {
  it('logs every source’s surface wind at the drop zone, with each source’s own times', { timeout: 60_000 }, async () => {
    const at = new Date().toISOString();
    const atMs = Date.parse(at);
    deadline = atMs + RUN_BUDGET_MS;
    const rec: SurfaceWindRecord = {
      kind: 'surfacewind',
      v: SURFACE_WIND_RECORD_VERSION,
      at,
      dz: `${dz.lat},${dz.lon}`,
    };

    const [metarR, nwsR, omR, omHrrrR, ...metaR] = await Promise.allSettled([
      // The METAR as the dashboard picks it: IEM and NWS, the newer report.
      // Fetched here rather than through src/api, which reads import.meta.env
      // and so does not load under the live config (usairnetCompare does the
      // same).
      bounded((async () => {
        const [iem, nws] = await Promise.allSettled([
          (async () => {
            const res = await get(
              `https://mesonet.agron.iastate.edu/api/1/currents.json?station=${station.iemId}&network=${station.iemNetwork}`,
            );
            const row = ((await res.json()) as RawIemCurrents).data?.find((x) => x.station === station.iemId);
            return row ? normalizeIemCurrent(row, station.id) : null;
          })(),
          (async () => {
            const res = await get(`https://api.weather.gov/stations/${station.id}/observations/latest`, 'application/geo+json');
            return normalizeNwsObservation((await res.json()) as RawNwsObservation, station.id);
          })(),
        ]);
        const iemCur = iem.status === 'fulfilled' ? iem.value : null;
        const nwsCur = nws.status === 'fulfilled' ? nws.value : null;
        const chosen = chooseObservation(iemCur, nwsCur);
        if (!chosen) {
          throw new Error(
            `iem: ${iem.status === 'rejected' ? msg(iem.reason) : 'no report'}; nws: ${nws.status === 'rejected' ? msg(nws.reason) : 'no report'}`,
          );
        }
        const c = chosen.current;
        return {
          source: chosen.source,
          obsAt: new Date(c.observedAt).toISOString(),
          wind: {
            t: new Date(c.observedAt).toISOString(),
            dir: c.wind.directionDeg,
            spd: c.wind.speedKt,
            gust: c.wind.gustKt,
          },
          group: metarWindGroup(c.raw),
          iemObsAt: iemCur ? new Date(iemCur.observedAt).toISOString() : null,
          nwsObsAt: nwsCur ? new Date(nwsCur.observedAt).toISOString() : null,
        };
      })()),
      // The NWS gridpoint, as fetchHourly reads it, and the hourly product's
      // timestamps beside it.
      bounded((async () => {
        const point = (await (await get(`https://api.weather.gov/points/${dz.lat},${dz.lon}`, 'application/geo+json')).json()) as {
          properties: { forecastGridData: string; forecastHourly: string };
        };
        const [grid, hourly] = await Promise.allSettled([
          get(point.properties.forecastGridData, 'application/geo+json'),
          get(point.properties.forecastHourly, 'application/geo+json'),
        ]);
        if (grid.status === 'rejected') throw grid.reason;
        const res = grid.value;
        const fetchedAt = new Date().toISOString();
        const raw = (await res.json()) as RawGridpoint & { properties: { updateTime?: string } };
        let hourlyUpdateTime: string | null = null;
        let hourlyGeneratedAt: string | null = null;
        if (hourly.status === 'fulfilled') {
          const p = ((await hourly.value.json()) as { properties?: { updateTime?: string; generatedAt?: string } }).properties;
          hourlyUpdateTime = p?.updateTime ?? null;
          hourlyGeneratedAt = p?.generatedAt ?? null;
        }
        const hourStart = Math.floor(atMs / HOUR) * HOUR;
        const hours: WindAt[] = normalizeGridpoint(raw)
          .filter((h) => h.time >= hourStart - 2 * HOUR && h.time <= hourStart + 2 * HOUR)
          .map((h) => ({ t: new Date(h.time).toISOString(), dir: h.windDirectionDeg, spd: r1(h.windSpeedKt), gust: r1(h.windGustKt) }));
        return {
          fetchedAt,
          updateTime: raw.properties.updateTime ?? null,
          lastModified: res.headers.get('last-modified'),
          expires: res.headers.get('expires'),
          maxAgeS: maxAgeSeconds(res.headers.get('cache-control')),
          hourlyUpdateTime,
          hourlyGeneratedAt,
          hours,
        };
      })()),
      bounded((async () => {
        const res = await get(omUrl());
        return { res, fetchedAt: new Date().toISOString(), raw: (await res.json()) as RawOpenMeteoWind };
      })()),
      bounded((async () => (await (await get(omUrl('ncep_hrrr_conus'))).json()) as RawOpenMeteoWind)()),
      ...OM_DOMAINS.map((d) =>
        bounded(
          (async () =>
            openMeteoRunMeta(
              (await (await get(`https://api.open-meteo.com/data/${d}/static/meta.json`)).json()) as Parameters<
                typeof openMeteoRunMeta
              >[0],
            ))(),
        ),
      ),
    ]);

    if (metarR.status === 'fulfilled') rec.metar = metarR.value;
    else rec.metarError = msg(metarR.reason);
    if (nwsR.status === 'fulfilled') rec.nws = nwsR.value;
    else rec.nwsError = msg(nwsR.reason);
    // Open-Meteo's response is read here rather than in its task, beside the
    // HRRR one it is compared with; a response in an unexpected shape is
    // logged as omError like a failed request, so the record still prints.
    if (omHrrrR.status === 'rejected') rec.omHrrrError = msg(omHrrrR.reason);
    if (omR.status === 'fulfilled') {
      try {
        const { raw, res, fetchedAt } = omR.value;
        const current = openMeteoCurrent(raw);
        const hourly = openMeteoSeries(raw.hourly);
        const m15 = openMeteoSeries(raw.minutely_15);
        // An answer with no wind in it is a failed request, not a forecast.
        if (!hasWind([current ? [current] : [], hourly, m15])) throw new Error('no wind values in the response');
        let sameAsHrrr: boolean | null = null;
        let hrrrMaxDiff: HrrrDiff | undefined;
        if (omHrrrR.status === 'fulfilled') {
          // An HRRR answer with no wind in it (no steps, or all null: the
          // model not yet available) is an HRRR failure, recorded as such
          // rather than counted as "default model is not HRRR". A body that
          // cannot be read at all throws and is recorded by the catch. Its
          // own try, so it never discards the default model's good record.
          try {
            const h = omHrrrR.value;
            const hc = openMeteoCurrent(h);
            const hHourly = openMeteoSeries(h.hourly);
            const hM15 = openMeteoSeries(h.minutely_15);
            if (!hasWind([hc ? [hc] : [], hHourly, hM15])) {
              rec.omHrrrError = 'no wind values in the response';
            } else {
              const cmp = compareWindResponses([
                [current ? [current] : [], hc ? [hc] : []],
                [hourly, hHourly],
                [m15, hM15],
              ]);
              sameAsHrrr = cmp.same;
              hrrrMaxDiff = cmp.diff;
            }
          } catch (e) {
            rec.omHrrrError = `unreadable response: ${msg(e)}`;
          }
        }
        rec.om = {
          fetchedAt,
          generationMs: raw.generationtime_ms ?? null,
          gridLat: raw.latitude ?? null,
          gridLon: raw.longitude ?? null,
          elevationM: raw.elevation ?? null,
          current,
          hourly,
          m15,
          lastModified: res.headers.get('last-modified'),
          cacheControl: res.headers.get('cache-control'),
          sameAsHrrr,
          ...(hrrrMaxDiff ? { hrrrMaxDiff } : {}),
        };
      } catch (e) {
        delete rec.om;
        rec.omError = `unreadable response: ${msg(e)}`;
      }
    } else {
      rec.omError = msg(omR.reason);
    }
    const omMeta: Record<string, OpenMeteoRunMeta | null> = {};
    OM_DOMAINS.forEach((d, i) => {
      const m = metaR[i];
      omMeta[d] = m.status === 'fulfilled' ? m.value : null;
      if (m.status === 'rejected') (rec.omMetaErrors ??= {})[d] = msg(m.reason);
    });
    rec.omMeta = omMeta;

    // A short human-readable table, then the record.
    const fmt = (w: WindAt | null | undefined): string =>
      w == null ? '—' : `${w.dir ?? 'VRB/calm'}° ${w.spd ?? '?'} kt${w.gust != null ? ` G${w.gust}` : ''} @${w.t.slice(11, 16)}Z`;
    const hourNear = rec.om?.hourly.reduce<WindAt | null>(
      (b, w) => (b == null || Math.abs(Date.parse(w.t) - atMs) < Math.abs(Date.parse(b.t) - atMs) ? w : b),
      null,
    );
    const nwsHour = rec.nws?.hours.find((h) => Date.parse(h.t) === Math.floor(atMs / HOUR) * HOUR);
    say([
      '',
      `=== surface wind at ${dz.lat},${dz.lon}, run ${at.slice(0, 19)}Z ===`,
      `METAR ${station.id} (${rec.metar?.source ?? '—'}): ${rec.metar ? `${rec.metar.group ?? '?'} ${fmt(rec.metar.wind)}` : rec.metarError}`,
      `NWS gridpoint hour: ${rec.nws ? fmt(nwsHour) : rec.nwsError}  updateTime ${rec.nws?.updateTime ?? '—'}  hourly product updateTime ${rec.nws?.hourlyUpdateTime ?? '—'}`,
      `Open-Meteo hourly (nearest): ${rec.om ? fmt(hourNear) : rec.omError}`,
      `Open-Meteo current: ${rec.om ? fmt(rec.om.current) : rec.omError}  same as HRRR: ${rec.om?.sameAsHrrr ?? rec.omHrrrError ?? '—'}`,
      ...OM_DOMAINS.map((d) => `  ${d}: init ${omMeta[d]?.init ?? '—'} avail ${omMeta[d]?.avail ?? '—'}`),
      `@@parity ${JSON.stringify(rec)}`,
    ]);
  });
});
