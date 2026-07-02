/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Content-Security-Policy for the production build. GitHub Pages cannot set
// response headers, so the policy ships as a <meta> tag injected at build time
// (apply: 'build' keeps dev untouched — the dev server relies on inline
// preamble scripts that this policy would block).
// - style-src needs 'unsafe-inline' because React style={{...}} attributes
//   are inline styles.
// - img-src allows radar.weather.gov for the radar loop image.
// - connect-src covers the two live APIs (NWS and Open-Meteo).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://radar.weather.gov",
  'connect-src https://api.weather.gov https://api.open-meteo.com',
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

// base is set for GitHub Pages project-site hosting at /lspc-weather/.
// Override with BASE_PATH env when deploying elsewhere (e.g. '/').
export default defineConfig({
  base: process.env.BASE_PATH ?? '/lspc-weather/',
  plugins: [react(), cspMetaPlugin()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
