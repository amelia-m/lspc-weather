import { describe, expect, it } from 'vitest';
// Raw imports: the typecheck has no Node types for the tests.
import appPage from '../index.html?raw';
import ceilingPage from '../public/ceiling-errors/index.html?raw';
import viteConfig from '../vite.config.ts?raw';

// Before the icon was named, every page load asked for /favicon.ico at the
// domain root (amelia-m.github.io/favicon.ico, outside the project site) and
// logged a 404; seen loading the deployed site on 2026-10-17. The two pages
// reach the one icon by different routes: Vite rewrites the app's
// root-absolute href under the base, and nothing rewrites the static
// ceiling-error page, so it climbs out of its folder. These hold both routes
// to the same file in public/.

const PUBLIC_SVGS = import.meta.glob('../public/**/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const ORIGIN = 'https://pages.example';
// The base the deploy builds with: the config's default, since deploy.yml
// sets no BASE_PATH.
const BASE = /process\.env\.BASE_PATH \?\? '([^']+)'/.exec(viteConfig)?.[1] ?? '';

function iconLink(html: string): { href: string; type: string } | null {
  const tag = /<link\b[^>]*\brel="icon"[^>]*>/.exec(html)?.[0];
  if (!tag) return null;
  return {
    href: /\bhref="([^"]+)"/.exec(tag)?.[1] ?? '',
    type: /\btype="([^"]+)"/.exec(tag)?.[1] ?? '',
  };
}

/** Where the browser fetches a page's icon from on the deployed site. */
function servedAt(href: string, pagePath: string): URL {
  // Vite prefixes the base onto a root-absolute public URL in index.html;
  // a relative one resolves against the page as any browser would.
  return href.startsWith('/') ? new URL(BASE + href.slice(1), ORIGIN) : new URL(href, ORIGIN + BASE + pagePath);
}

/** The file in public/ that Pages serves at that URL, if there is one. */
function publicFile(url: URL): string | undefined {
  if (url.origin !== ORIGIN || !url.pathname.startsWith(BASE)) return undefined;
  return PUBLIC_SVGS[`../public/${url.pathname.slice(BASE.length)}`];
}

function imgSrc(csp: string): string {
  // From the first source onward, so the config's prose about img-src does
  // not match.
  return /img-src ('[^;"]+)/.exec(csp)?.[1] ?? '';
}

describe('the site icon', async () => {
  // Read from disk: vitest stubs CSS imports (a `?raw` import of a .css file
  // comes back empty), as tests/hourlyChart.test.ts found. The specifier is
  // built so the typecheck, which has no Node types here, does not resolve it.
  const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync: (p: string, e: string) => string };
  const appCss = fs.readFileSync(decodeURIComponent(new URL('../src/styles/app.css', import.meta.url).pathname), 'utf8');

  it('reads the base from the build config', () => {
    expect(BASE).toBe('/lspc-weather/');
  });

  it('is named by both pages, as an SVG, at one URL under the base', () => {
    const app = iconLink(appPage);
    const ceiling = iconLink(ceilingPage);
    expect(app).not.toBeNull();
    expect(ceiling).not.toBeNull();
    expect(app?.type).toBe('image/svg+xml');
    expect(ceiling?.type).toBe('image/svg+xml');
    const fromApp = servedAt(app?.href ?? '', '');
    const fromCeiling = servedAt(ceiling?.href ?? '', 'ceiling-errors/index.html');
    expect(fromApp.href).toBe(`${ORIGIN}${BASE}favicon.svg`);
    expect(fromCeiling.href).toBe(fromApp.href);
  });

  it('is a file in public/ that is an SVG document', () => {
    const svg = publicFile(servedAt(iconLink(appPage)?.href ?? '', ''));
    expect(svg).toBeDefined();
    expect(svg?.trimStart()).toMatch(/^<svg\b[^>]*\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg?.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('is same-origin under both policies, whose img-src is self plus the radar, sectional and count URLs', () => {
    // The app's policy is injected at build time from vite.config.ts. The
    // GoatCounter URL is page counting's (tests/pageCount.test.ts), a single
    // path rather than a host.
    expect(imgSrc(viteConfig)).toBe(
      "'self' data: https://radar.weather.gov https://tiles.arcgis.com https://amelia-m.goatcounter.com/count",
    );
    expect(imgSrc(ceilingPage)).toBe("'self' data:");
    const svg = publicFile(servedAt(iconLink(appPage)?.href ?? '', '')) ?? '';
    // Nothing for the icon to fetch: the only URL in it is the SVG namespace.
    expect(svg.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:|url\(|href=/);
  });

  it('is drawn only in the accent blues, never a colour the app reads as a claim', () => {
    // A red, amber or green tab icon would say something about the
    // conditions on every page load (CLAUDE.md, "A number is not the only
    // way to assert something"). The two blues are the dashboard's accent and
    // the ceiling-error page's light-scheme accent.
    const accents = [appCss, ceilingPage].map((css) => /--accent:\s*(#[0-9a-f]{6})/i.exec(css)?.[1]?.toLowerCase());
    expect(accents).toEqual(['#4aa8ff', '#2a78d6']);
    // Comments out: the file's own explains the choice in these words.
    const svg = (publicFile(servedAt(iconLink(appPage)?.href ?? '', '')) ?? '').replace(/<!--[\s\S]*?-->/g, '');
    const colours = new Set((svg.match(/#[0-9a-f]{3,8}\b/gi) ?? []).map((c) => c.toLowerCase()));
    expect([...colours].sort()).toEqual([...accents].sort());
    expect(svg).not.toMatch(/\b(?:rgb|hsl)a?\(|\b(?:red|green|orange|yellow|amber)\b/i);
  });
});
