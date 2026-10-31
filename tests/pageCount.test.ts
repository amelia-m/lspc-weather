import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config.ts?raw';
import { PAGE_COUNT_ENDPOINT, PAGE_COUNT_HOST } from '../src/config/pageCount';
import { connectSources } from '../src/config/tafRelay';
import { countSkipReason, countUrl, countedPath, type CountContext } from '../src/domain/pageCount';

// A reader on the deployed site: every filter clear.
const reader: CountContext = {
  hostname: 'amelia-m.github.io',
  inFrame: false,
  visibility: 'visible',
  webdriver: false,
  optedOut: false,
};

describe('countSkipReason', () => {
  it('counts a reader on the deployed site', () => {
    expect(countSkipReason(reader, PAGE_COUNT_HOST)).toBeNull();
  });

  it('skips a browser opted out with #toggle-goatcounter on the same origin', () => {
    expect(countSkipReason({ ...reader, optedOut: true }, PAGE_COUNT_HOST)).toBe('opted-out');
  });

  it('skips automation, so the daily live-site check is not counted as readers', () => {
    expect(countSkipReason({ ...reader, webdriver: true }, PAGE_COUNT_HOST)).toBe('automated');
  });

  it('counts only on the deployed site: not a dev server, a preview by any name, a file or a fork', () => {
    // A file opened from disk has an empty hostname.
    for (const hostname of ['localhost', '127.0.0.1', '[::1]', 'mybox.local', '192.168.1.20', '', 'someone.github.io']) {
      expect(countSkipReason({ ...reader, hostname }, PAGE_COUNT_HOST), hostname).toBe('other-host');
    }
    expect(PAGE_COUNT_HOST).toBe('amelia-m.github.io');
  });

  it('skips a frame and a prerender', () => {
    expect(countSkipReason({ ...reader, inFrame: true }, PAGE_COUNT_HOST)).toBe('frame');
    expect(countSkipReason({ ...reader, visibility: 'prerender' }, PAGE_COUNT_HOST)).toBe('prerender');
  });
});

describe('countedPath', () => {
  it('counts the Jumpers tab as the page itself', () => {
    expect(countedPath('/lspc-weather/', null)).toBe('/lspc-weather/');
  });

  it('keeps the # page, which the browser treats as one document', () => {
    expect(countedPath('/lspc-weather/', 'citations')).toBe('/lspc-weather/#citations');
    expect(countedPath('/lspc-weather/', 'pilots')).toBe('/lspc-weather/#pilots');
  });
});

describe('countUrl', () => {
  const data = {
    path: '/lspc-weather/#parity',
    title: 'LSPC Weather — Skydiving conditions for NE69',
    referrer: 'https://bsky.app/',
    query: '?utm_source=bluesky',
    screenWidth: 390,
  };

  it("sends GoatCounter's parameters, encoded", () => {
    const url = new URL(countUrl('https://amelia-m.goatcounter.com/count', data, 'ab12c'));
    expect(url.origin + url.pathname).toBe('https://amelia-m.goatcounter.com/count');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      p: '/lspc-weather/#parity',
      r: 'https://bsky.app/',
      t: data.title,
      s: '390',
      q: '?utm_source=bluesky',
      rnd: 'ab12c',
    });
    // The # page travels in the query, not as the URL's own fragment.
    expect(url.hash).toBe('');
  });

  it('leaves out empty values, as count.js does', () => {
    const url = new URL(countUrl('https://x.example/count', { ...data, referrer: '', query: '' }, 'r'));
    expect([...url.searchParams.keys()]).toEqual(['p', 't', 's', 'rnd']);
  });
});

describe('the policy and the endpoint', () => {
  it('allows images from the count URL, and only that path on the host', () => {
    expect(PAGE_COUNT_ENDPOINT).not.toBeNull();
    const imgSrc = /img-src ('[^;"]+)/.exec(viteConfig)?.[1] ?? '';
    expect(imgSrc.split(' ')).toContain(PAGE_COUNT_ENDPOINT);
    expect(imgSrc.split(' ')).not.toContain('https://amelia-m.goatcounter.com');
  });

  it('does not open connect-src or script-src to GoatCounter', () => {
    // connect-src is built from connectSources(), so test what it returns,
    // and that the config builds connect-src from nothing else.
    expect(connectSources().join(' ')).not.toContain('goatcounter');
    expect(/`connect-src[^`]*`/.exec(viteConfig)?.[0]).toBe("`connect-src 'self' ${connectSources().join(' ')}`");
    expect(/script-src[^"]*/.exec(viteConfig)?.[0]).toBe("script-src 'self'");
  });
});
