/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { connectSources } from './src/config/tafRelay';

// Content-Security-Policy for the production build. GitHub Pages cannot set
// response headers, so the policy ships as a <meta> tag injected at build time
// (apply: 'build' keeps dev untouched — the dev server relies on inline
// preamble scripts that this policy would block).
// - style-src needs 'unsafe-inline' because React style={{...}} attributes
//   are inline styles.
// - img-src allows radar.weather.gov for the radar loop image,
//   tiles.arcgis.com for FAA's VFR sectional tiles on the Sectional card,
//   basemap.nationalmap.gov for USGS's aerial imagery under the jump-run
//   line on the Drift card (`DZ_IMAGERY_TILES`; a test holds the two), and
//   GoatCounter's /count URL alone, which page counts are sent to as an image
//   request (src/config/pageCount.ts, docs/page-counts.md).
// - connect-src covers the live APIs (NWS, Open-Meteo, and the Iowa
//   Environmental Mesonet for the observation), the TAF relay once it is
//   set (src/config/tafRelay.ts, `connectSources`), and 'self', for the
//   parity summary the #parity page fetches from beside the site.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://radar.weather.gov https://tiles.arcgis.com https://basemap.nationalmap.gov https://amelia-m.goatcounter.com/count",
  `connect-src 'self' ${connectSources().join(' ')}`,
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

function cspMetaPlugin(): Plugin {
  return {
    name: 'inject-csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

// The trial layout's address: the same page, served again from beta/ beside
// the site (the maintainer, 2026-11-25: launch it "as an alternate view,
// possibly at a new address"). The built page names its script, stylesheet
// and icon by full path under the base, so a copy one folder down loads the
// same files; the app reads its own address to know it is the trial
// (`isBetaPath`, src/domain/sectionNav.ts). GitHub Pages serves files only,
// so the folder has to hold a real index.html.
function betaPagePlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'copy-page-to-beta',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      mkdirSync(resolve(outDir, 'beta'), { recursive: true });
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, 'beta', 'index.html'));
    },
  };
}

// base is set for GitHub Pages project-site hosting at /lspc-weather/.
// Override with BASE_PATH env when deploying elsewhere (e.g. '/').
export default defineConfig({
  base: process.env.BASE_PATH ?? '/lspc-weather/',
  plugins: [react(), cspMetaPlugin(), betaPagePlugin()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
