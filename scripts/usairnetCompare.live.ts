/**
 * Live observation comparison against usairnet's decode of the same METAR.
 *
 * Runs with the other live checks (`npx vitest run --config
 * vitest.live.config.ts`, daily by .github/workflows/sky-parity.yml and every
 * fifteen minutes by .github/workflows/schulze-compare.yml's sampler while that
 * runs)
 * and by hand from the sandbox with the proxy env (see CLAUDE.md). Never by
 * `npm test`: it needs the network.
 *
 * Why it exists: the Ceiling & sky card links to usairnet's KPMV page as a
 * second decode of the report the dashboard shows, and on 2026-09-23 that
 * page was what showed the dashboard's "Clear" under a 2,700 ft overcast to
 * be wrong. The sky-parity check now guards the sky parse against
 * aviationweather.gov's decoder; this prints every field usairnet shows —
 * temperature, dew point, humidity, visibility, pressure, wind, cloud
 * layers, ceiling and flight rule — beside what the dashboard's own path
 * (IEM and api.weather.gov, the newer report of the two, as
 * src/api/iem.ts's fetchObservation chooses) makes of the same report, so a
 * disagreement in any of them is in the log the same day. The record says
 * which feed served, and when each feed's report was taken.
 *
 * It is a report, not a gate. usairnet is a page scrape — its markup can
 * change any day — and a lagging page is not a bug in this app, so the run
 * never fails; a person reads the table. The two are matched by observation
 * time first: usairnet's page can be a report behind, and comparing two
 * different reports says nothing.
 */
import { it } from 'vitest';
import { SITE } from '../src/config/site';
import { normalizeNwsObservation, type RawNwsObservation } from '../src/domain/normalize';
import { chooseObservation, normalizeIemCurrent, type RawIemCurrents } from '../src/domain/iem';
import { observedFlightCategory } from '../src/domain/flightCategory';
import { cToF, ktToMph } from '../src/domain/units';
import { sunTimes } from '../src/domain/sun';
import { resolveLocalClock } from '../src/domain/localClock';
import type { CurrentConditions } from '../src/domain/types';
import {
  ceilingFromTheirClouds,
  cloudsInTheirWords,
  comparableDirection,
  parseUsairnet,
  type UsairnetObs,
} from '../src/domain/usairnet';

const station = SITE.metarStation.id;
const UA = 'lspc-weather usairnet-compare (github.com/amelia-m/lspc-weather)';
const ZONE = 'America/Chicago';

const say = (lines: string[]): void => {
  process.stdout.write(lines.join('\n') + '\n');
};

/** One machine-readable line per run, for the parity-summary workflow
 *  (domain/paritySummary.ts parses it). Printed last, after the table. */
const record = (obj: Record<string, unknown>): string => `@@parity ${JSON.stringify(obj)}`;

/** Relative humidity from temperature and dew point (Magnus), the way any
 *  decoder derives the figure usairnet prints; the METAR carries none. */
function humidityPct(tempC: number, dewpointC: number): number {
  const e = (t: number): number => Math.exp((17.625 * t) / (243.04 + t));
  return Math.round((100 * e(dewpointC)) / e(tempC));
}

const localClock = (ms: number): string =>
  new Date(ms).toLocaleTimeString('en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' });

const show = (v: number | string | null | undefined): string =>
  v == null || v === '' ? '—' : String(v);

it('prints the dashboard’s decode of the latest observation beside usairnet’s', async () => {
  const startedAt = new Date().toISOString();
  const out: string[] = ['', `=== ${station}: dashboard vs usairnet ===`];

  // The dashboard's own choice: both feeds, the newer report. The fetches
  // are written out here rather than imported from src/api, which reads
  // import.meta.env and so does not load under the live config.
  const { iemId, iemNetwork } = SITE.metarStation;
  const [iemRes, nwsRes] = await Promise.allSettled([
    (async () => {
      const res = await fetch(
        `https://mesonet.agron.iastate.edu/api/1/currents.json?station=${iemId}&network=${iemNetwork}`,
        { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rec = ((await res.json()) as RawIemCurrents).data?.find((r) => r.station === iemId);
      return rec ? normalizeIemCurrent(rec, station) : null;
    })(),
    (async () => {
      const res = await fetch(`https://api.weather.gov/stations/${station}/observations/latest`, {
        headers: { 'User-Agent': UA, Accept: 'application/geo+json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return normalizeNwsObservation((await res.json()) as RawNwsObservation, station);
    })(),
  ]);
  const iemCur = iemRes.status === 'fulfilled' ? iemRes.value : null;
  const nwsCur = nwsRes.status === 'fulfilled' ? nwsRes.value : null;
  const feedErr = (r: PromiseSettledResult<unknown>): string | null =>
    r.status === 'rejected' ? (r.reason as Error).message : null;
  const chosen = chooseObservation(iemCur, nwsCur);
  if (!chosen) {
    const msg = `iem: ${feedErr(iemRes) ?? 'no report'}; nws: ${feedErr(nwsRes) ?? 'no report'}`;
    say([...out, `neither observation feed could be read (${msg})`, record({ kind: 'usairnet', at: startedAt, error: msg })]);
    return;
  }
  const ours: CurrentConditions = chosen.current;
  const iemObsAt = iemCur ? new Date(iemCur.observedAt).toISOString() : null;
  const nwsObsAt = nwsCur ? new Date(nwsCur.observedAt).toISOString() : null;

  let theirs: UsairnetObs | null;
  try {
    const res = await fetch(`https://www.usairnet.com/cgi-bin/launch/code.cgi?state=NE&sta=${station}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    theirs = parseUsairnet(await res.text(), station);
  } catch (e) {
    say([...out, `usairnet could not be read: ${(e as Error).message}`, record({ kind: 'usairnet', at: startedAt, error: `usairnet: ${(e as Error).message}` })]);
    return;
  }
  if (theirs == null) {
    say([...out, 'usairnet page did not parse (markup changed?); nothing compared.', record({ kind: 'usairnet', at: startedAt, error: 'usairnet: page did not parse' })]);
    return;
  }

  // The newest report in NWS's own list for the station, beside the one its
  // `latest` endpoint (the dashboard's source) returned: when the dashboard
  // is the side behind, this says whether the report had not reached NWS
  // yet or had reached its list but not `latest`. Informational; a failure
  // here leaves the field out.
  let nwsNewestAt: string | null = null;
  try {
    const res = await fetch(`https://api.weather.gov/stations/${station}/observations?limit=1`, {
      headers: { 'User-Agent': UA, Accept: 'application/geo+json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      const list = (await res.json()) as { features?: { properties?: { timestamp?: string } }[] };
      nwsNewestAt = list.features?.[0]?.properties?.timestamp ?? null;
    }
  } catch {
    // leave it null
  }

  // When NOAA's raw METAR file for the station was last written, as a
  // reference clock for the timing records: it had each report 4 to 5
  // minutes after it was taken on 2026-09-27, the quickest of every source
  // timed. The first line is the report time, "2026/09/29 19:15".
  // Informational; a failure leaves it null.
  let rawFileObsAt: string | null = null;
  try {
    const res = await fetch(`https://tgftp.nws.noaa.gov/data/observations/metar/stations/${station}.TXT`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(20_000),
    });
    const m = res.ok ? (await res.text()).match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})/) : null;
    if (m) rawFileObsAt = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00.000Z`;
  } catch {
    // leave it null
  }

  out.push(`dashboard report (via ${chosen.source.toUpperCase()}): ${ours.raw || '(no METAR text)'}`);
  out.push(
    `feeds: IEM ${iemObsAt?.slice(11, 16) ?? `none (${feedErr(iemRes) ?? 'no report'})`}` +
      ` · NWS latest ${nwsObsAt?.slice(11, 16) ?? `none (${feedErr(nwsRes) ?? 'no report'})`}` +
      ` · NOAA raw file ${rawFileObsAt?.slice(11, 16) ?? 'unread'}`,
  );
  out.push(`observed: dashboard ${localClock(ours.observedAt)} · usairnet as of ${theirs.asOf} (both ${ZONE})`);
  const sameReport = localClock(ours.observedAt) === theirs.asOf;
  // usairnet gives a bare local clock; resolved to the date nearest the
  // dashboard's report so the two can be subtracted. Positive: the
  // dashboard had the newer report.
  const theirObsMs = resolveLocalClock(theirs.asOf, ours.observedAt, ZONE);
  const obsGapMin = theirObsMs == null ? null : Math.round((ours.observedAt - theirObsMs) / 60_000);
  const startedMs = Date.parse(startedAt);
  out.push(
    sameReport
      ? 'same observation on both sides'
      : `DIFFERENT observation times — ${
          obsGapMin == null ? 'one side' : obsGapMin > 0 ? `usairnet is ${obsGapMin} min` : `the dashboard is ${-obsGapMin} min`
        } behind; the rows below compare two reports`,
  );
  out.push(
    `ages at sampling: dashboard report ${Math.round((startedMs - ours.observedAt) / 60_000)} min` +
      (theirObsMs != null ? `, usairnet report ${Math.round((startedMs - theirObsMs) / 60_000)} min` : '') +
      (nwsNewestAt ? `; newest in NWS's list ${new Date(nwsNewestAt).toISOString().slice(11, 16)}Z` : ''),
  );

  // Each row keeps the numeric gap (dashboard minus usairnet) where both
  // sides are numbers, so the summary can say how far apart the values were,
  // not only whether they matched. Wind direction is the signed angular
  // difference; text fields (clouds, flight rule) have no gap.
  const rows: [string, string, string, number | null][] = [];
  const angular = (a: number, b: number): number => ((a - b + 540) % 360) - 180;
  const row = (
    name: string,
    a: number | string | null | undefined,
    b: number | string | null | undefined,
    kind: 'number' | 'angle' | 'text' = 'number',
  ): void => {
    const na = typeof a === 'number' ? a : typeof a === 'string' && a !== '' && !Number.isNaN(Number(a)) ? Number(a) : null;
    const nb = typeof b === 'number' ? b : typeof b === 'string' && b !== '' && !Number.isNaN(Number(b)) ? Number(b) : null;
    const delta =
      kind === 'text' || na == null || nb == null ? null : kind === 'angle' ? angular(na, nb) : Math.round((na - nb) * 100) / 100;
    rows.push([name, show(a), show(b), delta]);
  };
  row('temperature °F', ours.tempC == null ? null : Math.round(cToF(ours.tempC)), theirs.tempF);
  row('dew point °F', ours.dewpointC == null ? null : Math.round(cToF(ours.dewpointC)), theirs.dewpointF);
  row(
    'humidity % (derived)',
    ours.tempC != null && ours.dewpointC != null ? humidityPct(ours.tempC, ours.dewpointC) : null,
    theirs.humidityPct,
  );
  row('visibility mi', ours.visibilitySm, theirs.visibilityMi);
  row('pressure inHg', ours.altimeterInHg == null ? null : ours.altimeterInHg.toFixed(2), theirs.pressureInHg?.toFixed(2));
  row('wind mph', ours.wind.speedKt == null ? null : Math.round(ktToMph(ours.wind.speedKt)), theirs.windMph);
  row('wind gust mph', ours.wind.gustKt == null ? null : Math.round(ktToMph(ours.wind.gustKt)), theirs.windGustMph);
  row('wind dir °', comparableDirection(ours.wind.speedKt, ours.wind.directionDeg), theirs.windDirDeg, 'angle');
  row('clouds', cloudsInTheirWords(ours.skyLayers), theirs.clouds, 'text');
  row('ceiling ft (theirs implied)', ours.ceilingFtAgl, ceilingFromTheirClouds(theirs.clouds));
  row('flight rule', observedFlightCategory(ours) ?? '(withheld)', theirs.flightRule, 'text');
  // The night-jump flag hangs on the app's computed sunset; the page prints
  // an almanac for the same day. Compared as minutes past local midnight so
  // the gap is a number. The page's almanac is for KPMV, 0.19° east of the
  // DZ, so its sun runs about three-quarters of a minute ahead of ours.
  const sun = sunTimes(SITE.dz.lat, SITE.dz.lon, new Date());
  const minutesOfDay = (clock: string | null): number | null => {
    const m = clock?.match(/^(\d{1,2}):(\d{2}) ([AP]M)$/);
    if (!m) return null;
    const h = (Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0);
    return h * 60 + Number(m[2]);
  };
  row('sunrise (min past midnight)', minutesOfDay(localClock(sun.sunrise)), minutesOfDay(theirs.sunrise));
  row('sunset (min past midnight)', minutesOfDay(localClock(sun.sunset)), minutesOfDay(theirs.sunset));

  let agree = 0;
  const fields: { name: string; same: boolean; delta?: number }[] = [];
  out.push('field                          dashboard                       usairnet             Δ');
  for (const [name, a, b, delta] of rows) {
    const same = a === b;
    if (same) agree += 1;
    fields.push(delta == null ? { name, same } : { name, same, delta });
    out.push(`${same ? ' ' : '≠'} ${name.padEnd(28)} ${a.padEnd(31)} ${b.padEnd(20)} ${delta == null ? '' : delta}`);
  }
  out.push(`${agree} of ${rows.length} fields agree${sameReport ? '' : ' (different reports, so differences are expected)'}`);
  // Seen on the first run: dew point 56 against 57 °F, humidity 70 against 72,
  // on a report reading "19/14 … T01900135". The dashboard reads the remarks'
  // T group (13.5 °C); usairnet the body's whole degrees (14 °C). A one-degree
  // gap in those two rows is that, not a decode difference.
  const off = (name: string): number | null => {
    const r = rows.find((x) => x[0] === name);
    return r && r[1] !== '—' && r[2] !== '—' ? Math.abs(Number(r[1]) - Number(r[2])) : null;
  };
  if ((off('temperature °F') ?? 0) === 1 || (off('dew point °F') ?? 0) === 1) {
    out.push('note: a 1 °F gap in temperature or dew point is the METAR body’s whole degrees against the T group’s tenths, which the dashboard reads');
  }
  out.push(
    record({
      kind: 'usairnet',
      at: startedAt,
      sameReport,
      // 2: usairnet's page parsed for gusts, present weather and "Solid
      // Overcast", and a calm wind compared as no direction. The summary
      // leaves the rows those changed out of older records.
      v: 2,
      ourObsAt: new Date(ours.observedAt).toISOString(),
      ourSource: chosen.source,
      rawFileObsAt,
      theirWind: theirs.windText,
      iemObsAt,
      nwsObsAt,
      theirObsAt: theirObsMs == null ? null : new Date(theirObsMs).toISOString(),
      obsGapMin,
      nwsNewestAt,
      fields,
    }),
  );
  say(out);
});
