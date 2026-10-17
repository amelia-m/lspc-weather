/**
 * Load the deployed site in a browser and say whether a reader would meet a
 * fault: every page (Jumpers, Pilots, #citations, #parity, the ceiling-error
 * page) at 1280, 390 and 320 px, live data. What counts as a fault is
 * src/domain/liveSite.ts; this file drives the browser and prints.
 * Run daily and after each deploy by .github/workflows/live-site.yml, which
 * opens an issue labelled `live-site` when a page fails.
 *
 *   npx tsx scripts/liveSite.ts
 *
 * The sandbox's browser trusts the egress proxy only when told its CA keys
 * (CLAUDE.md, "The deployed site in a browser"); there, run with
 *   LIVE_SPKI=<hashes> LIVE_USE_PROXY=1 \
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
 * A GitHub runner needs none of that.
 *
 * Exit status 1 when any page fails at any width (on both of its loads).
 */
// The functions handed to page.evaluate run in the page, so they need the
// DOM's types; the scripts' tsconfig has only Node's.
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { judgeLoad, pagePasses, type LoadObservation, type LoadVerdict, type SourceRow } from '../src/domain/liveSite';

const BASE = process.env.LIVE_SITE_URL ?? 'https://amelia-m.github.io/lspc-weather/';
const PAGES: { name: string; path: string }[] = [
  { name: 'Jumpers', path: '' },
  { name: 'Pilots', path: '#pilots' },
  { name: 'Citations', path: '#citations' },
  { name: 'Parity', path: '#parity' },
  { name: 'Ceiling errors', path: 'ceiling-errors/index.html' },
];
const WIDTHS = [1280, 390, 320];
// How long a card may stay pending before the check counts it. The app
// polls the observation every 2 minutes; the first fetch of every source
// has come back within 20 seconds in every load from the sandbox.
const SETTLE_MS = 60_000;

// The module path is an argument so the sandbox can name its global copy;
// on a runner the workflow installs `playwright` beside the script.
const pw = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await pw.chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  // The proxy is given as Chromium's own flags, not Playwright's `proxy`
  // option: Playwright adds a rule sending localhost through the proxy too,
  // which answered a local build (LIVE_SITE_URL=http://localhost:…) 405.
  args: [
    ...(process.env.LIVE_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.LIVE_SPKI}`] : []),
    ...(process.env.LIVE_USE_PROXY && process.env.HTTPS_PROXY
      ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=localhost;127.0.0.1']
      : []),
  ],
});
const siteOrigin = new URL(BASE).origin;

async function load(page: { name: string; path: string }, width: number): Promise<LoadObservation> {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  const o: LoadObservation = {
    page: page.name,
    width,
    pageErrors: [],
    ownFailures: [],
    otherFailures: [],
    consoleErrors: [],
    scrollWidth: 0,
    viewportWidth: width,
    crashed: false,
    sources: null,
    checks: [],
  };
  const own = (url: string) => url.startsWith(siteOrigin);
  const short = (url: string) => url.replace(/\?.*$/, '?…').slice(0, 120);
  p.on('pageerror', (e: Error) => o.pageErrors.push(e.message.slice(0, 200)));
  p.on('console', (m: { type(): string; text(): string }) => {
    if (m.type() === 'error') o.consoleErrors.push(m.text().slice(0, 160));
  });
  p.on('response', (r: { status(): number; url(): string }) => {
    if (r.status() >= 400) (own(r.url()) ? o.ownFailures : o.otherFailures).push(`${r.status()} ${short(r.url())}`);
  });
  p.on('requestfailed', (r: { url(): string; failure(): { errorText: string } | null }) => {
    // A request the page itself abandoned (a navigation, an aborted retry)
    // is not a failure of the server.
    const why = r.failure()?.errorText ?? 'failed';
    if (why === 'net::ERR_ABORTED') return;
    (own(r.url()) ? o.ownFailures : o.otherFailures).push(`${why} ${short(r.url())}`);
  });
  try {
    await p.goto(BASE + page.path, { waitUntil: 'networkidle', timeout: 90_000 });
  } catch (e) {
    o.pageErrors.push(`page did not load: ${(e as Error).message.split('\n')[0]}`);
  }
  // Scroll to the end and back so lazily loaded images (the radar loop) are
  // asked for, then wait for the Data health card to settle.
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p
    .waitForFunction(() => !document.querySelector('li.source.pending'), null, { timeout: SETTLE_MS })
    .catch(() => undefined);
  await p.waitForTimeout(2000);

  const seen = await p.evaluate(() => {
    const text = document.body.innerText;
    const rows = [...document.querySelectorAll('li.source')].map((li) => ({
      name: (li.querySelector('.source-name')?.textContent ?? '').trim().split('\n')[0],
      state: (li.className.split(' ').find((c: string) => c !== 'source') ?? 'idle') as SourceRow['state'],
      meta: (li.querySelector('.source-meta')?.textContent ?? '').trim(),
    }));
    const radar = document.querySelector<HTMLImageElement>('img.radar-img');
    return {
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      crashed: text.includes('Something went wrong'),
      rows,
      radar: radar ? { complete: radar.complete, natural: radar.naturalWidth } : null,
      radarFailed: text.includes('Radar image unavailable'),
      paritySummary: text.includes('The summary could not be read') ? 'error' : text.includes('Loading the latest summary') ? 'loading' : 'ok',
      ceilingMeta: document.querySelector('#meta .error')?.textContent ?? null,
      ceilingCharts: document.querySelectorAll('#ch-size svg, #ch-spread svg, #ch-band svg').length,
      panels: document.querySelectorAll('.panel').length,
    };
  });
  o.scrollWidth = seen.scrollWidth;
  o.viewportWidth = seen.viewportWidth;
  o.crashed = seen.crashed;
  o.sources = seen.rows.length ? seen.rows : null;
  if (page.name === 'Jumpers') {
    o.checks.push({
      name: 'radar image drew',
      ok: !seen.radarFailed && !!seen.radar?.complete && (seen.radar?.natural ?? 0) > 0,
      detail: seen.radarFailed ? 'the card says the image is unavailable' : `naturalWidth ${seen.radar?.natural ?? 'no image'}`,
    });
  }
  if (page.name === 'Parity') o.checks.push({ name: 'parity summary loaded', ok: seen.paritySummary === 'ok', detail: seen.paritySummary });
  if (page.name === 'Ceiling errors') {
    o.checks.push({ name: 'ceiling data file loaded', ok: seen.ceilingMeta == null, detail: seen.ceilingMeta ?? undefined });
    o.checks.push({ name: 'ceiling charts drew', ok: seen.ceilingCharts === 3, detail: `${seen.ceilingCharts} of 3` });
  } else {
    o.checks.push({ name: 'cards rendered', ok: seen.panels > 0, detail: `${seen.panels} panels` });
  }
  await ctx.close();
  return o;
}

let failed = 0;
for (const page of PAGES) {
  for (const width of WIDTHS) {
    const verdicts: LoadVerdict[] = [];
    // A second load only when the first had a fault (pagePasses).
    for (let attempt = 0; attempt < 2 && !pagePasses(verdicts); attempt++) verdicts.push(judgeLoad(await load(page, width)));
    const pass = pagePasses(verdicts);
    if (!pass) failed++;
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${page.name} at ${width} px${verdicts.length > 1 ? ` (${verdicts.length} loads)` : ''}`);
    verdicts.forEach((v, i) => {
      const tag = verdicts.length > 1 ? `load ${i + 1} ` : '';
      for (const f of v.faults) console.log(`       ${tag}fault: ${f}`);
      for (const n of v.notes) console.log(`       ${tag}note: ${n}`);
    });
  }
}
await browser.close();
console.log(failed ? `${failed} page and width combinations failed on both loads.` : 'Every page passed at every width.');
process.exit(failed ? 1 : 0);
