/**
 * Live observation comparison against usairnet's decode of the same METAR.
 *
 * Runs with the other live checks (`npx vitest run --config
 * vitest.live.config.ts`, daily by .github/workflows/sky-parity.yml and every
 * fifteen minutes by .github/workflows/schulze-compare.yml while that runs)
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
 * (api.weather.gov → normalizeNwsObservation) makes of the same report, so a
 * disagreement in any of them is in the log the same day.
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
import { observedFlightCategory } from '../src/domain/flightCategory';
import { cToF, ktToMph } from '../src/domain/units';
import type { CurrentConditions, SkyLayer } from '../src/domain/types';

const station = SITE.metarStation.id;
const UA = 'lspc-weather usairnet-compare (github.com/amelia-m/lspc-weather)';
const ZONE = 'America/Chicago';

const say = (lines: string[]): void => {
  process.stdout.write(lines.join('\n') + '\n');
};

/** One machine-readable line per run, for the parity-summary workflow
 *  (domain/paritySummary.ts parses it). Printed last, after the table. */
const record = (obj: Record<string, unknown>): string => `@@parity ${JSON.stringify(obj)}`;

/** The fields usairnet prints for a station, as the page states them. */
interface UsairnetObs {
  asOf: string; // "8:15 PM", their local clock
  tempF: number | null;
  condition: string | null;
  humidityPct: number | null;
  dewpointF: number | null;
  visibilityMi: number | null;
  pressureInHg: number | null;
  flightRule: string | null;
  windMph: number | null; // 0 for "Calm"
  windDirDeg: number | null;
  clouds: string | null; // "Few at 10000 ft, Broken at 25000 ft" or "Clear"
}

/** Strip the page to text and read the block for our station. The block is
 *  "Current Conditions at|<NAME> - (KPMV)|66°|Clear|as of 8:15 PM CDST|…"
 *  once tags collapse to bars; the next "Current Conditions at" (another
 *  station on the same page) ends it. */
function parseUsairnet(html: string): UsairnetObs | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '|')
    .replace(/&deg;/g, '°')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s*\|\s*(\|\s*)+/g, '|')
    .replace(/[ \t]+/g, ' ');
  const start = text.indexOf(`(${station})`);
  if (start < 0) return null;
  const rest = text.slice(start);
  const end = rest.indexOf('Current Conditions at', 10);
  const block = end > 0 ? rest.slice(0, end) : rest;

  const num = (re: RegExp): number | null => {
    const m = block.match(re);
    return m ? Number(m[1]) : null;
  };
  const str = (re: RegExp): string | null => block.match(re)?.[1]?.trim() ?? null;

  const asOf = str(/as of (\d{1,2}:\d{2} [AP]M)/);
  if (!asOf) return null;
  const head = block.match(/\(\w{4}\)\|(-?\d+)°\|([^|]+)\|as of/);
  const windCalm = /Wind Data\|Calm/i.test(block);
  return {
    asOf,
    tempF: head ? Number(head[1]) : null,
    condition: head ? head[2].trim() : null,
    humidityPct: num(/Rel\. Humidity: (\d+)%/),
    dewpointF: num(/Dew Point: (-?\d+)°F/),
    visibilityMi: num(/Visibility: ([\d.]+) Mile/),
    pressureInHg: num(/Pressure: ([\d.]+) in/),
    flightRule: str(/Flight Rule: (\w+)/),
    windMph: windCalm ? 0 : num(/Wind Data\|(\d+) MPH/),
    windDirDeg: windCalm ? null : num(/Wind Data\|\d+ MPH\|(\d+)°/),
    clouds: str(/Cloud Level\(s\): ([^|]+)/),
  };
}

const COVER_WORD: Record<string, string> = {
  FEW: 'Few',
  SCT: 'Scattered',
  BKN: 'Broken',
  OVC: 'Overcast',
  VV: 'Obscured',
  CLR: 'Clear',
  SKC: 'Clear',
  NSC: 'Clear',
  NCD: 'Clear',
};

/** The dashboard's layers in usairnet's words, so the two strings compare. */
function cloudsInTheirWords(layers: SkyLayer[]): string {
  if (layers.length === 0) return '(not reported)';
  const clouds = layers.filter((l) => l.baseFtAgl != null);
  if (clouds.length === 0) return 'Clear';
  return clouds.map((l) => `${COVER_WORD[l.cover] ?? l.cover} at ${l.baseFtAgl} ft`).join(', ');
}

/** Lowest broken/overcast/obscured base in usairnet's cloud string, as their
 *  page implies a ceiling; they do not print one. */
function ceilingFromTheirClouds(clouds: string | null): number | null {
  if (!clouds) return null;
  let lowest: number | null = null;
  for (const m of clouds.matchAll(/(Broken|Overcast|Obscured) at (\d+) ft/g)) {
    const ft = Number(m[2]);
    if (lowest == null || ft < lowest) lowest = ft;
  }
  return lowest;
}

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

  let ours: CurrentConditions;
  try {
    const res = await fetch(`https://api.weather.gov/stations/${station}/observations/latest`, {
      headers: { 'User-Agent': UA, Accept: 'application/geo+json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ours = normalizeNwsObservation((await res.json()) as RawNwsObservation, station);
  } catch (e) {
    say([...out, `api.weather.gov could not be read: ${(e as Error).message}`, record({ kind: 'usairnet', at: startedAt, error: `nws: ${(e as Error).message}` })]);
    return;
  }

  let theirs: UsairnetObs | null;
  try {
    const res = await fetch(`https://www.usairnet.com/cgi-bin/launch/code.cgi?state=NE&sta=${station}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    theirs = parseUsairnet(await res.text());
  } catch (e) {
    say([...out, `usairnet could not be read: ${(e as Error).message}`, record({ kind: 'usairnet', at: startedAt, error: `usairnet: ${(e as Error).message}` })]);
    return;
  }
  if (theirs == null) {
    say([...out, 'usairnet page did not parse (markup changed?); nothing compared.', record({ kind: 'usairnet', at: startedAt, error: 'usairnet: page did not parse' })]);
    return;
  }

  out.push(`dashboard report: ${ours.raw || '(no METAR text)'}`);
  out.push(`observed: dashboard ${localClock(ours.observedAt)} · usairnet as of ${theirs.asOf} (both ${ZONE})`);
  const sameReport = localClock(ours.observedAt) === theirs.asOf;
  out.push(
    sameReport
      ? 'same observation on both sides'
      : 'DIFFERENT observation times — one side is a report behind; the rows below compare two reports',
  );

  const rows: [string, string, string][] = [];
  const row = (name: string, a: number | string | null | undefined, b: number | string | null | undefined): void => {
    rows.push([name, show(a), show(b)]);
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
  row('wind dir °', ours.wind.directionDeg, theirs.windDirDeg);
  row('clouds', cloudsInTheirWords(ours.skyLayers), theirs.clouds);
  row('ceiling ft (theirs implied)', ours.ceilingFtAgl, ceilingFromTheirClouds(theirs.clouds));
  row('flight rule', observedFlightCategory(ours) ?? '(withheld)', theirs.flightRule);

  let agree = 0;
  const fields: { name: string; same: boolean }[] = [];
  out.push('field                          dashboard                       usairnet');
  for (const [name, a, b] of rows) {
    const same = a === b;
    if (same) agree += 1;
    fields.push({ name, same });
    out.push(`${same ? ' ' : '≠'} ${name.padEnd(28)} ${a.padEnd(31)} ${b}`);
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
  out.push(record({ kind: 'usairnet', at: startedAt, sameReport, fields }));
  say(out);
});
