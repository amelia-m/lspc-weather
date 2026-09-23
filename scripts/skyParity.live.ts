/**
 * Live sky-decode parity check.
 *
 * Run daily by .github/workflows/sky-parity.yml, and by hand with
 * `npx vitest run --config vitest.live.config.ts`. Never by `npm test`: it
 * needs the network, and CI's fixture suite must stay hermetic.
 *
 * Why it exists: on 2026-09-23 api.weather.gov served a two-hour run of KPMV
 * observations whose decoded cloudLayers was empty while the METAR text read
 * OVC027–OVC035, and the dashboard showed "Clear" and VFR under the overcast.
 * The app now parses the sky from the METAR text itself. That makes the app's
 * own parser the thing to distrust, so this compares it, on today's report,
 * against a decoder nobody here wrote: aviationweather.gov's, which returns
 * the same METAR with its cloud layers decoded. The browser cannot use that
 * API (no CORS), a GitHub runner can.
 *
 * Only the first case fails the run. The others print what the other decodes
 * said — api.weather.gov's, and usairnet's page, a fragile scrape that must
 * never fail a run — so the log answers "who disagreed with whom" when it does.
 */
import { describe, expect, it } from 'vitest';
import { SITE } from '../src/config/site';
import {
  normalizeMetar,
  normalizeNwsObservation,
  parseSkyGroups,
  type RawMetar,
  type RawNwsObservation,
} from '../src/domain/normalize';
import { observedFlightCategory } from '../src/domain/flightCategory';
import type { SkyLayer } from '../src/domain/types';

const station = SITE.metarStation.id;
const UA = 'lspc-weather sky-parity (github.com/amelia-m/lspc-weather)';

async function get(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res;
}

/** Straight to stdout: Vitest's default reporter keeps console output from
 *  passing tests to itself, and these lines are the point of the run — the
 *  workflow log has to say who decoded what even when nothing failed. */
const say = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const NO_CLOUD = new Set(['SKC', 'CLR', 'NSC', 'NCD']);
const cloudsOnly = (layers: SkyLayer[]): SkyLayer[] => layers.filter((l) => !NO_CLOUD.has(l.cover));

const showSky = (layers: SkyLayer[]): string =>
  layers.length === 0
    ? '(none)'
    : layers.map((l) => (l.baseFtAgl == null ? l.cover : `${l.cover}${l.baseFtAgl / 100}`)).join(' ');

describe(`sky decode parity for ${station}`, () => {
  it('parses the METAR text the way aviationweather.gov decodes it', async () => {
    const res = await get(
      `https://aviationweather.gov/api/data/metar?ids=${station}&format=json`,
      'application/json',
    );
    const [awc] = (await res.json()) as RawMetar[];
    expect(awc?.rawOb, 'aviationweather.gov returned no METAR').toBeTruthy();

    const ours = parseSkyGroups(awc.rawOb);
    const theirs = normalizeMetar(awc).skyLayers;
    say(`[awc]  ${awc.rawOb}`);
    say(`[awc]  app parse: ${showSky(ours)} · aviationweather decode: ${showSky(theirs)}`);
    // aviationweather represents a clear sky as no `clouds` entries at all
    // (13 of 13 CLR reports sampled on 2026-09-23), where the app keeps the
    // CLR as a layer so an empty list can mean "not reported". Compare the
    // cloud layers, then; bases from the text are exact hundreds, and so are
    // aviationweather's.
    expect(cloudsOnly(ours)).toEqual(cloudsOnly(theirs));
  });

  it('reports how api.weather.gov decoded the same station (informational, never fails)', async () => {
    // Informational means an NWS outage must not open a parity issue: only
    // the aviationweather comparison above is allowed to fail the run.
    try {
      const res = await get(
        `https://api.weather.gov/stations/${station}/observations/latest`,
        'application/geo+json',
      );
      const obs = (await res.json()) as RawNwsObservation;
      const c = normalizeNwsObservation(obs, station);
      say(`[nws]  ${c.raw || '(no rawMessage)'}`);
      say(
        `[nws]  sky: ${showSky(c.skyLayers)} · decode check: ${c.skyDecode} · ceiling: ${c.ceilingFtAgl ?? 'none'} · category: ${observedFlightCategory(c) ?? '—'}`,
      );
    } catch (err) {
      say(`[nws]  not read: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  it('shows what usairnet says, as a third opinion (informational, never fails)', async () => {
    try {
      const res = await get(
        `https://www.usairnet.com/cgi-bin/launch/code.cgi?state=NE&sta=${station}`,
        'text/html',
      );
      const text = (await res.text())
        .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');
      const clouds = /Cloud Level\(s\): (.*?)(?= Current Conditions| Wind Data|$)/.exec(text)?.[1];
      const rule = /Flight Rule: (VFR|MVFR|IFR|LIFR)/.exec(text)?.[1];
      say(`[usairnet]  clouds: ${clouds ?? '?'} · flight rule: ${rule ?? '?'}`);
    } catch (err) {
      say(`[usairnet]  not read: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
});
