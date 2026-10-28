// Open the interactive-radar candidate links of docs/radar-interactive-link.md
// (A to F) in a browser and print, for each, the blob the page was given,
// the map's own centre and zoom once settled (the site never writes its
// state back into the address bar; the centre is read from its OpenLayers
// view, which decides the question the doc asks), the page's heading, and
// every host the page asked for that did not answer. Not a test and in no
// workflow: it needs the network and a browser.
//
// From the sandbox (CLAUDE.md, "The deployed site in a browser"):
//
//   LIVE_SPKI=<hashes> LIVE_USE_PROXY=1 \
//   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
//   node scripts/radarLinks.mjs [A B …] [--out <dir for screenshots>]
//
// The viewer's basemap, tiles and geocoder hosts were allowlisted for the
// sandbox on 2026-10-28; its basemap art (cdn.arcgis.com) is not, and the
// map draws without it. The doc's "Settled in a browser" has the result.
// Elsewhere, no env is needed.
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
      // The site does not write its settled state back into the address bar
      // (seen 2026-10-28: the URL stayed byte for byte the one opened once
      // the map had drawn), so the centre is read from the map object the
      // page's Vue components hold: the first component property with a
      // getCenter() method.
      result.map = await page.evaluate(() => {
        const seen = new Set();
        // OpenLayers: getCenter() is [x, y] in Web Mercator metres (EPSG:3857);
        // a Mapbox-style map would give {lng, lat}. Both are returned as
        // [lon, lat] in degrees, the blob's own order.
        const toLonLat = (c) => {
          if (Array.isArray(c)) {
            const R = 6378137;
            return [(c[0] / R) * (180 / Math.PI), (2 * Math.atan(Math.exp(c[1] / R)) - Math.PI / 2) * (180 / Math.PI)];
          }
          return [c.lng, c.lat];
        };
        const found = (m) => ({ center: toLonLat(m.getCenter()).map((d) => Math.round(d * 10000) / 10000), zoom: m.getZoom() });
        const walk = (vm, depth) => {
          if (!vm || depth > 4 || seen.has(vm)) return null;
          seen.add(vm);
          for (const key of Object.keys(vm.$data ?? {}).concat(Object.keys(vm))) {
            try {
              const v = vm[key];
              if (v && typeof v.getCenter === 'function' && typeof v.getZoom === 'function') return found(v);
            } catch {
              // a getter that throws is not the map
            }
          }
          for (const c of vm.$children ?? []) {
            const r = walk(c, depth + 1);
            if (r) return r;
          }
          return null;
        };
        for (const el of document.querySelectorAll('*')) {
          const vm = el.__vue__;
          if (!vm) continue;
          const r = walk(vm.$root ?? vm, 0);
          if (r) return r;
        }
        return null;
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
