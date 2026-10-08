import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { READING_LOG, SIM_EDITION, SIM_LAST_READ, citationsOf, type CitationKey } from '../src/config/readingLog';
import { CITATIONS, isSimSectionUrl, simUrl } from '../src/config/thresholds';
import { CitationsPage } from '../src/components/CitationsPage';
import { CHECKLIST, SIM_READ } from '../src/config/citationsChecklist';

/* The reading log is the record of when each cited or quoted section was
 * last read. Every citation must have exactly one entry, its note must carry
 * that entry's date, and every SIM entry must be pinned to the part its
 * citations link to, or that #citations quotes. */
describe('the reading log', () => {
  const cited = (Object.entries(CITATIONS) as [CitationKey, unknown][]).filter(([, c]) => typeof (c as { url?: unknown }).url === 'string');

  it('has exactly one entry for every citation, and no entry for a citation that does not exist', () => {
    for (const [key] of cited) {
      expect(READING_LOG.filter((r) => citationsOf(r).includes(key)), key).toHaveLength(1);
    }
    for (const r of READING_LOG) for (const key of citationsOf(r)) expect(CITATIONS, r.section).toHaveProperty(key);
  });

  it('gives each entry one address: every citation it covers links to the same section', () => {
    for (const r of READING_LOG.filter((e) => e.kind === 'cited')) {
      const urls = new Set(citationsOf(r).map((k) => (CITATIONS as Record<string, { url: string }>)[k].url));
      expect(urls.size, r.section).toBe(1);
    }
  });

  it('ties every quoting entry it names to a checklist entry that read the SIM', () => {
    // A part only quoted on #citations is linked by its own anchor (the
    // types make it a pinned SIM part); a cited part may name entries that
    // quote it without citing it. Each id named must be an entry that read
    // the SIM. Whether the quote is in that part needs the page:
    // scripts/simText.live.ts checks it daily.
    expect(READING_LOG.some((r) => r.kind === 'quoted')).toBe(true);
    for (const r of READING_LOG) {
      for (const id of r.quotedIn ?? []) {
        const entry = CHECKLIST.find((e) => e.id === id);
        expect(entry, `${r.section}: ${id}`).toBeDefined();
        expect(entry!.found?.read, `${r.section}: ${id}`).toContain(SIM_READ);
      }
    }
  });

  it('marks every checklist entry that cites or quotes the SIM as having read it', () => {
    // scripts/simText.live.ts checks the quotes of the entries whose reading
    // is SIM_READ; an entry with its own wording would drop out unnoticed.
    // A citation left on the SIM's index is not counted: no section was
    // identified, so there is no part to have read.
    const quoting = new Set(READING_LOG.flatMap((r) => r.quotedIn ?? []));
    const simEntries = CHECKLIST.filter((e) => quoting.has(e.id) || e.sources.some((s) => isSimSectionUrl(s.url ?? '')));
    expect(simEntries.length).toBeGreaterThan(0);
    for (const e of simEntries) expect(e.found?.read, e.id).toContain(SIM_READ);
  });

  it('holds every dated citation note to its entry’s date', () => {
    // Skipping the sources nobody has read at the source, the club's sign
    // (read from a photo) and PD's chart (from a transcription): their notes
    // date the transcription instead.
    for (const r of READING_LOG.filter((e) => e.lastRead != null)) {
      for (const key of citationsOf(r)) {
        const note = (CITATIONS as Record<string, { note?: string }>)[key].note ?? '';
        const dates = note.match(/\b20\d\d-\d\d-\d\d\b/g) ?? [];
        // A note may also name an edition's date (Title 14 as current on
        // 2026-09-21, AIM Change 3 effective 2026-07-09); the reading's own
        // date must be among them.
        if (dates.length > 0) expect(dates, key).toContain(r.lastRead);
      }
    }
  });

  it('pins every SIM entry to the part its links land on, with a fingerprint', () => {
    const simEntries = READING_LOG.filter((r) => r.simPart);
    expect(simEntries.length).toBeGreaterThan(0);
    for (const r of simEntries) {
      const { section, anchor, sha256, chars } = r.simPart!;
      expect(sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(chars).toBeGreaterThan(0);
      expect(r.lastRead).toBe(SIM_LAST_READ);
      for (const key of citationsOf(r)) {
        expect((CITATIONS as Record<string, { url: string }>)[key].url, key).toBe(simUrl(section, anchor));
      }
    }
    // Every citation that links into the SIM is pinned.
    for (const [key, c] of cited) {
      if (isSimSectionUrl((c as { url: string }).url)) {
        expect(READING_LOG.find((r) => citationsOf(r).includes(key))?.simPart, key).toBeDefined();
      }
    }
  });
});

describe('the reading log on #citations', () => {
  const html = renderToStaticMarkup(createElement(CitationsPage));

  it('lists every entry with its date, and says where a source was not read itself', () => {
    expect(html.match(/<ul class="reading-log">[\s\S]*?<\/ul>/)![0].match(/<li>/g)).toHaveLength(READING_LOG.length);
    expect(html).toContain(`last read ${SIM_LAST_READ} · ${SIM_EDITION}`);
    expect(html).toContain('not read at the source');
    expect(html).toContain('USPA SIM 2-1 H, Winds');
    expect(html).toContain('text fingerprint <code');
    // A part only quoted is linked at its own anchor on uspa.org.
    expect(html).toContain('href="https://www.uspa.org/sim/3-1#Blicense"');
  });
});
