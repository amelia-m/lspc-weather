// Open the interactive-radar candidate links of docs/radar-interactive-link.md
// (A to F) in a browser and print, for each, what the site wrote back into
// the address bar once the map settled (its `agenda.center`, `zoom` and
// `station` decide the question the doc asks), the page's heading, and
// every host the page asked for that did not answer. Not a test and in no
// workflow: it needs the network and a browser.
//
// From the sandbox (CLAUDE.md, "The deployed site in a browser"):
//
//   LIVE_SPKI=<hashes> LIVE_USE_PROXY=1 \
//   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
//   node scripts/radarLinks.mjs [A B …] [--out <dir for screenshots>]
//
// On 2026-10-28 the sandbox could load the page but not its basemap
// (basemapstyles-api.arcgis.com) or radar tiles (opengeo.ncep.noaa.gov),
// so the map never settled and the URL was never rewritten; the doc's
// "Tried from the sandbox" has the result. Elsewhere, no env is needed.
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args[outAt + 1] : null;
const wanted = args.filter((a, i) => !a.startsWith('--') && (outAt < 0 || i !== outAt + 1));
if (out) mkdirSync(out, { recursive: true });

const doc = readFileSync(new URL('../docs/radar-interactive-link.md', import.meta.url), 'utf8');
const links = {};
for (const name of 'ABCDEF') {
  const m = doc.match(new RegExp(`\\*\\*${name} — [\\s\\S]*?\`(https://radar\\.weather\\.gov/[^\`]+)\``));
  if (m) links[name] = m[1];
}
const pw = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await pw.chromium.launch({
  ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}),
  ...(process.env.LIVE_USE_PROXY && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
  args: process.env.LIVE_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.LIVE_SPKI}`] : [],
});
for (const [name, url] of Object.entries(links)) {
  if (wanted.length && !wanted.includes(name)) continue;
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 800 : 844 } });
    const unreached = new Map();
    page.on('requestfailed', (r) => unreached.set(new URL(r.url()).host, r.failure()?.errorText ?? 'failed'));
    const result = { name, width };
    try {
      // Not 'load': with its tile host unreachable the page's load event never
      // fires, since the tiles retry without end.
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // The viewer loads its station list and tiles after `load`; give it
      // time to settle and write its state back into the URL.
      await page.waitForTimeout(20_000);
      result.rewritten = page.url() !== url;
      result.settings = await page.evaluate(() => {
        const s = location.search.split('v1_')[1];
        return s ? JSON.parse(atob(decodeURIComponent(s))).agenda : null;
      });
      result.heading = await page.evaluate(() => document.querySelector('header, h1, .search-box, [class*=station]')?.textContent?.trim().slice(0, 80) ?? null);
      result.unreached = Object.fromEntries(unreached);
      if (out) await page.screenshot({ path: `${out}/${name}-${width}.png` });
    } catch (e) {
      result.error = String(e.message).slice(0, 200);
    }
    console.log(JSON.stringify(result));
    await page.close();
  }
}
await browser.close();
