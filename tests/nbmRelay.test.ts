import { describe, expect, it, vi } from 'vitest';
import { handle, type RelayDeps } from '../relay/src/relay';
import { NBM_BUCKET, NBM_CACHE_SECONDS, NBM_KNOWN_OFFSET, NBM_LOOKBACK_HOURS, NBM_PATH, NBM_WINDOW, cutStationBlock, nbmFileFor } from '../relay/src/nbm';
import { nbmRelayUrl } from '../src/config/tafRelay';
import { parseNbhBlock } from '../src/domain/nbm';

const SITE_ORIGIN = 'https://amelia-m.github.io';
const BASE = 'https://lspc-taf-relay.example.workers.dev';
const FILES = import.meta.glob('../data/parity/nbm-kpmv-2026-10-24-03z.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const KPMV = Object.values(FILES)[0].split('\n\n')[0];
const other = (id: string) => KPMV.replace(/^ KPMV /, ` ${id} `.padEnd(6));

/** A stand-in bulletin: filler, two other stations, KPMV, a buoy with a
 *  five-character id, another station; blocks parted by a line of spaces,
 *  as the bucket's files are. KPMV's block sits `at` bytes in. */
const GAP = '\n' + ' '.repeat(60) + '\n';
function bulletin(at: number): { text: string; at: number } {
  const before = `${other('KOMA')}${GAP}${other('KOFF')}${GAP}`;
  const filler = 'x'.repeat(Math.max(0, at - before.length)) + '\n';
  const text = `${filler}${before}${KPMV}${GAP}${other('45001').replace(/^ 45001 /, ' 45001  ')}${GAP}${other('KPMZ')}\n`;
  return { text, at: text.indexOf(' KPMV ') };
}

// 2026-10-27 02:17Z: the 01Z file is there (landed 02:06Z) and covers the hour under way; 02Z is not there yet.
const T0 = Date.UTC(2026, 9, 27, 2, 17);

function deps(text: string, opts: { missingHours?: number; rangeStatus?: number; headStatus?: Record<number, number> } = {}) {
  const missing = opts.missingHours ?? 1;
  const fetch = vi.fn<RelayDeps['fetch']>(async (url, init) => {
    const method = init.method ?? 'GET';
    const hour = Number(/\/(\d{2})\/text\//.exec(url)?.[1]);
    const exists = hour <= 2 - missing;
    if (method === 'HEAD') return new Response(null, { status: opts.headStatus?.[hour] ?? (exists ? 200 : 404) });
    if (!exists) return new Response('<?xml?>', { status: 404 });
    const range = new Headers(init.headers).get('range');
    if (range) {
      // A bucket that will not answer a range sends the whole file (200).
      if (opts.rangeStatus) return new Response(text, { status: opts.rangeStatus });
      const [a, b] = range.replace('bytes=', '').split('-').map(Number);
      return new Response(text.slice(a, b + 1), { status: 206 });
    }
    return new Response(text, { status: 200 });
  });
  const clock = { t: T0 };
  return { fetch, memo: { body: null, at: 0 }, nbm: { body: null, at: 0, offset: NBM_KNOWN_OFFSET }, now: () => clock.t, clock } satisfies RelayDeps & { clock: { t: number } };
}

const req = (path: string, init: { origin?: string; method?: string } = {}) =>
  new Request(`${BASE}${path}`, { method: init.method ?? 'GET', headers: init.origin ? { origin: init.origin } : {} });

describe('cutStationBlock', () => {
  it('cuts the station’s block from its header to the line before the next station’s', () => {
    const b = bulletin(5000);
    const cut = cutStationBlock(b.text, 'KPMV')!;
    expect(cut.at).toBe(b.at);
    expect(cut.block).toBe(KPMV);
    expect(cut.complete).toBe(true);
    expect(parseNbhBlock(cut.block)!.hours).toHaveLength(25);
  });
  it('says when the text ends inside the block, as a window can, and finds nothing for a station not there', () => {
    const b = bulletin(5000);
    const cut = cutStationBlock(b.text.slice(0, b.at + 200), 'KPMV')!;
    expect(cut.complete).toBe(false);
    expect(cutStationBlock(b.text, 'KLNK')).toBeNull();
    // KPMZ's header must not read as KPMV's.
    expect(cutStationBlock(b.text.slice(b.at + 10), 'KPMV')).toBeNull();
  });

  it('is whole once the blank line after the block is in the text, though the next header is not', () => {
    const b = bulletin(5000);
    const cut = cutStationBlock(b.text.slice(0, b.at + KPMV.length + GAP.length), 'KPMV')!;
    expect(cut.complete).toBe(true);
    expect(cut.block).toBe(KPMV);
  });

  it('ends at a five-character station’s header too', () => {
    const b = bulletin(5000);
    const buoy = cutStationBlock(b.text, '45001')!;
    expect(buoy.complete).toBe(true);
    expect(buoy.block.startsWith(' 45001 ')).toBe(true);
    expect(buoy.block).not.toContain('KPMZ');
  });
});

describe('the NBM path of the relay', () => {
  it('finds the newest file by HEAD, cuts KPMV’s block from a window around the known offset, and answers it as JSON with the CORS header', async () => {
    const b = bulletin(NBM_KNOWN_OFFSET + 4000);
    const d = deps(b.text);
    const res = await handle(req(NBM_PATH, { origin: SITE_ORIGIN }), d);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(SITE_ORIGIN);
    expect(res.headers.get('cache-control')).toBe(`public, max-age=${NBM_CACHE_SECONDS}`);
    const body = (await res.json()) as { station: string; product: string; file: string; cycle: string; text: string };
    expect(body).toMatchObject({ station: 'KPMV', product: 'NBH', cycle: '2026-10-27T01:00:00.000Z' });
    expect(body.file).toBe(nbmFileFor(Date.UTC(2026, 9, 27, 1)));
    expect(body.text).toBe(KPMV);
    // At 02:17Z the hour under way is 02Z, which only the 01Z cycle's hours
    // cover (a cycle's begin the hour after it): one HEAD, then one window
    // read, never the whole file. The 02Z file, if there, is not asked for.
    const calls = d.fetch.mock.calls.map(([u, i]) => `${i.method ?? 'GET'} ${u.replace(NBM_BUCKET, '')} ${new Headers(i.headers).get('range') ?? ''}`.trim());
    expect(calls).toEqual([
      `HEAD /${nbmFileFor(Date.UTC(2026, 9, 27, 1))}`,
      `GET /${nbmFileFor(Date.UTC(2026, 9, 27, 1))} bytes=${NBM_KNOWN_OFFSET - NBM_WINDOW}-${NBM_KNOWN_OFFSET + NBM_WINDOW}`,
    ]);
    expect(new Headers(d.fetch.mock.calls[1][1].headers).get('user-agent')).toMatch(/lspc-weather/);
    // The block's place is remembered for the next window.
    expect(d.nbm.offset).toBe(b.at);
  });

  it('reads the whole file when the block is not in the window, and remembers where it was', async () => {
    const b = bulletin(NBM_KNOWN_OFFSET + 3 * NBM_WINDOW);
    const d = deps(b.text);
    const res = await handle(req(NBM_PATH, { origin: SITE_ORIGIN }), d);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { text: string }).text).toBe(KPMV);
    const gets = d.fetch.mock.calls.filter(([, i]) => (i.method ?? 'GET') === 'GET');
    expect(gets).toHaveLength(2);
    expect(new Headers(gets[1][1].headers).get('range')).toBeNull();
    expect(d.nbm.offset).toBe(b.at);
  });

  it('reads the whole file when the window ends inside the block, rather than answering a cut-off block', async () => {
    // The block begins 500 bytes before the window's end: its header is in
    // the window, its last rows are not.
    const b = bulletin(NBM_KNOWN_OFFSET + NBM_WINDOW - 500);
    const d = deps(b.text);
    const res = await handle(req(NBM_PATH, { origin: SITE_ORIGIN }), d);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { text: string }).text).toBe(KPMV);
    expect(d.fetch.mock.calls.filter(([, i]) => (i.method ?? 'GET') === 'GET')).toHaveLength(2);
  });

  it('reads the whole file the bucket sends for a range (200) once, not again', async () => {
    const b = bulletin(NBM_KNOWN_OFFSET + 4000);
    const d = deps(b.text, { rangeStatus: 200 });
    const res = await handle(req(NBM_PATH, { origin: SITE_ORIGIN }), d);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { text: string }).text).toBe(KPMV);
    expect(d.fetch.mock.calls.filter(([, i]) => (i.method ?? 'GET') === 'GET')).toHaveLength(1);
    expect(d.nbm.offset).toBe(b.at);
  });

  it('moves on to the older file when a HEAD fails, as a late or ailing bucket still has that one', async () => {
    const b = bulletin(NBM_KNOWN_OFFSET + 4000);
    const d = deps(b.text, { headStatus: { 1: 503 } });
    const res = await handle(req(NBM_PATH, { origin: SITE_ORIGIN }), d);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { file: string }).file).toBe(nbmFileFor(Date.UTC(2026, 9, 27, 0)));
    expect(d.fetch.mock.calls.filter(([, i]) => i.method === 'HEAD')).toHaveLength(2);
  });

  it('asks the bucket once per cache period however many readers ask, then again', async () => {
    const d = deps(bulletin(NBM_KNOWN_OFFSET + 4000).text);
    await handle(req(NBM_PATH, { origin: SITE_ORIGIN }), d);
    const n = d.fetch.mock.calls.length;
    await handle(req(NBM_PATH, { origin: SITE_ORIGIN }), d);
    expect(d.fetch.mock.calls.length).toBe(n);
    d.clock.t += (NBM_CACHE_SECONDS + 1) * 1000;
    await handle(req(NBM_PATH, { origin: SITE_ORIGIN }), d);
    expect(d.fetch.mock.calls.length).toBeGreaterThan(n);
  });

  it('answers 502, keeping nothing, when no file of the last hours is there, or the block is not in it', async () => {
    const none = deps(bulletin(NBM_KNOWN_OFFSET + 4000).text, { missingHours: NBM_LOOKBACK_HOURS + 2 });
    const res = await handle(req(NBM_PATH, { origin: SITE_ORIGIN }), none);
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toMatch(/NBM bucket has no NBH file/);
    expect(none.nbm.body).toBeNull();
    const without = deps(bulletin(NBM_KNOWN_OFFSET + 4000).text.replace(/ KPMV /g, ' KXXX '));
    expect((await handle(req(NBM_PATH, { origin: SITE_ORIGIN }), without)).status).toBe(502);
  });

  it('keeps the relay’s rules: another origin refused, GET only, and the TAF path untouched', async () => {
    const d = deps(bulletin(NBM_KNOWN_OFFSET + 4000).text);
    expect((await handle(req(NBM_PATH, { origin: 'https://example.com' }), d)).status).toBe(403);
    expect((await handle(req(NBM_PATH, { origin: SITE_ORIGIN, method: 'POST' }), d)).status).toBe(405);
    expect((await handle(req(NBM_PATH, { origin: SITE_ORIGIN, method: 'OPTIONS' }), d)).status).toBe(204);
    expect((await handle(req('/nbm/KOMA', { origin: SITE_ORIGIN }), d)).status).toBe(404);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('is where the app asks, under the relay’s address, and nowhere without one', () => {
    expect(nbmRelayUrl(`${BASE}/`)).toBe(`${BASE}${NBM_PATH}`);
    expect(nbmRelayUrl(null)).toBeNull();
  });
});
