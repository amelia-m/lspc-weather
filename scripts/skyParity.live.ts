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
  parseTaf,
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

  it('derives the flight category aviationweather.gov derives from the same report', async () => {
    // The one derived value on the sky card a jumper reads as a word. Both
    // sides work from ceiling and visibility with the same bands (MVFR at a
    // 3,000 ft ceiling or 5 SM inclusive, per AIM 7-1-7), so on a report
    // where both give a category they must give the same one. The app
    // withholds VFR when no ceiling can be established; aviationweather does
    // not, so a report with no sky group is compared only when both answer.
    const res = await get(
      `https://aviationweather.gov/api/data/metar?ids=${station}&format=json`,
      'application/json',
    );
    const [awc] = (await res.json()) as RawMetar[];
    expect(awc?.rawOb, 'aviationweather.gov returned no METAR').toBeTruthy();
    const ours = observedFlightCategory(normalizeMetar(awc));
    const theirs = awc.fltCat ?? null;
    say(`[awc]  flight category: app ${ours ?? '(withheld)'} · aviationweather ${theirs ?? '(none)'}`);
    if (ours != null && theirs != null) expect(ours).toBe(theirs);
  });

  it('shows the TAF the card would show beside the one aviationweather.gov has (informational, never fails)', async () => {
    // The card shows the raw TAF text from the NWS text-products feed, first
    // station in the chain with a product. That feed can lag or list an older
    // issuance; this says whether the TAF a reader sees is the current one.
    // Informational: the products index is known to be flaky (see fetchTaf),
    // and a lag there is not a bug in this app's parse.
    try {
      const ids = SITE.tafStations.map((t) => t.id).join(',');
      const awcRes = await get(
        `https://aviationweather.gov/api/data/taf?ids=${ids}&format=json`,
        'application/json',
      );
      const awc = (await awcRes.json()) as Array<{ icaoId: string; rawTAF?: string; issueTime?: string }>;
      let shown: { station: string; raw: string; issuedMs: number | null } | null = null;
      for (const t of SITE.tafStations) {
        const loc = encodeURIComponent(t.nwsProductLocation);
        for (const url of [
          `https://api.weather.gov/products/types/TAF/locations/${loc}`,
          `https://api.weather.gov/products?type=TAF&location=${loc}&limit=1`,
        ]) {
          try {
            const list = (await (await get(url, 'application/geo+json')).json()) as {
              '@graph'?: Array<{ '@id': string; issuanceTime?: string }>;
            };
            const latest = list['@graph']?.[0];
            if (!latest) continue;
            const product = (await (await get(latest['@id'], 'application/geo+json')).json()) as {
              productText?: string;
              issuanceTime?: string;
            };
            const taf = parseTaf(product.productText ?? '', t.id, product.issuanceTime ?? latest.issuanceTime);
            if (taf) shown = { station: taf.station, raw: taf.raw, issuedMs: taf.issuedMs };
            break;
          } catch {
            // try the other list form, then the next station
          }
        }
        if (shown) break;
      }
      if (!shown) {
        say('[taf]  the NWS products feed listed no TAF for any station in the chain');
        return;
      }
      const theirs = awc.find((x) => x.icaoId === shown!.station);
      const squash = (x: string): string => x.replace(/\s+/g, ' ').trim();
      const same = theirs?.rawTAF != null && squash(theirs.rawTAF) === squash(shown.raw);
      say(`[taf]  card shows ${shown.station}, issued ${shown.issuedMs != null ? new Date(shown.issuedMs).toISOString() : '?'}`);
      say(`[taf]  aviationweather has ${theirs ? `${theirs.icaoId}, issued ${theirs.issueTime ?? '?'}` : 'no TAF for that station'}`);
      say(`[taf]  same text: ${same ? 'yes' : 'NO'}`);
      if (!same && theirs?.rawTAF) {
        say(`[taf]  card:  ${squash(shown.raw).slice(0, 200)}`);
        say(`[taf]  theirs: ${squash(theirs.rawTAF).slice(0, 200)}`);
      }
    } catch (err) {
      say(`[taf]  not compared: ${err instanceof Error ? err.message : String(err)}`);
    }
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
