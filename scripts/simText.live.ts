/**
 * Has any SIM part this app cites or quotes changed since it was read, and
 * is every SIM quote on #citations in a part the reading log ties to it?
 *
 * For each SIM entry in the reading log (src/config/readingLog.ts), fetches
 * the section page from uspa.org as a browser would, reduces the cited part
 * with simPartText (src/domain/simText.ts), and compares its SHA-256 with
 * the fingerprint the log took on the day it was read. A difference fails
 * the run: USPA revised the words, and the claims that cite that part need
 * reading against the new text before the log's date can move. Run daily by
 * .github/workflows/sky-parity.yml with the other live checks.
 *
 * PRINT_SIM_FINGERPRINTS=1 prints the current fingerprints instead of
 * comparing, for taking them when a part is read again.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { READING_LOG, type CitationKey, type SourceReading } from '../src/config/readingLog';
import { CHECKLIST, SIM_READ } from '../src/config/citationsChecklist';
import { CITATIONS, simUrl } from '../src/config/thresholds';
import { simPartText } from '../src/domain/simText';

const parts = READING_LOG.filter((r) => r.simPart != null);
const pages = new Map<string, Promise<string>>();
const page = (section: string): Promise<string> => {
  if (!pages.has(section)) {
    pages.set(
      section,
      fetch(simUrl(section), {
        headers: { 'User-Agent': 'Mozilla/5.0 (lspc-weather SIM text check)' },
        signal: AbortSignal.timeout(30_000),
      }).then((r) => {
        if (!r.ok) throw new Error(`uspa.org/sim/${section}: HTTP ${r.status}`);
        return r.text();
      }),
    );
  }
  return pages.get(section)!;
};

/** Each part's text, reduced once however many checks read it; null when the
 *  page no longer has the part where the log says it is. */
const partTexts = new Map<SourceReading, Promise<string | null>>();
const partText = (r: SourceReading): Promise<string | null> => {
  if (!partTexts.has(r)) {
    const { section, anchor, until } = r.simPart!;
    partTexts.set(r, page(section).then((p) => simPartText(p, anchor, until)));
  }
  return partTexts.get(r)!;
};
const missing = (r: SourceReading): string =>
  `#${r.simPart!.anchor} to ${r.simPart!.until ?? 'the end of the article'} is no longer on uspa.org/sim/${r.simPart!.section}`;

describe('cited and quoted SIM parts, against the text they were read in', () => {
  for (const r of parts) {
    const { section, anchor, sha256, chars } = r.simPart!;
    it(`${r.section} (#${anchor})`, async () => {
      const text = await partText(r);
      expect(text, missing(r)).not.toBeNull();
      const now = createHash('sha256').update(text!).digest('hex');
      if (process.env.PRINT_SIM_FINGERPRINTS === '1') {
        process.stdout.write(`@@sim ${section}#${anchor} ${now} ${text!.length}\n`);
        return;
      }
      process.stdout.write(`${section}#${anchor}: ${now === sha256 ? 'unchanged' : 'CHANGED'} since ${r.lastRead}\n`);
      expect(
        { sha256: now, chars: text!.length },
        `SIM ${section} part ${anchor} has changed since it was read on ${r.lastRead}: read it again, check the claims that cite it, then take its fingerprint again (PRINT_SIM_FINGERPRINTS=1)`,
      ).toEqual({ sha256, chars });
    });
  }
});

/* The quotes on #citations, against the parts they are tied to. A part is
 * tied to a checklist entry when one of the entry's sources links to it, or
 * the log lists the entry in its `quotedIn`. Every “…” in the `says` lines
 * of an entry that read the SIM must be found in one of its parts, as whole
 * words, punctuation and case aside (the page sets the BSR's lists as list
 * items, which the checklist writes with semicolons and dashes). That
 * catches a quote no part backs, and a `quotedIn` naming the wrong entry.
 * Not checked: the claim's own wording, and lines quoting the CFR or the
 * club's document, which A3 and A5 read beside the SIM and are told apart
 * by how the line starts; a SIM quote put on such a line would be skipped. */
const words = (s: string): string => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
const NOT_SIM = /^(14 CFR|The club document)/;
const simEntries = CHECKLIST.filter((e) => e.found?.read.includes(SIM_READ));

describe('SIM quotes on #citations, in the parts they are tied to', () => {
  it('finds the entries that read the SIM', () => {
    // A reworded SIM_READ would otherwise leave this block with nothing to
    // check, and a green run.
    expect(simEntries.length).toBeGreaterThan(0);
  });
  for (const entry of simEntries) {
    it(entry.id, async () => {
      const tied = parts.filter(
        (r) =>
          r.quotedIn?.includes(entry.id) ||
          entry.sources.some((s) => (r.citations as CitationKey[]).some((k) => CITATIONS[k].url === s.url)),
      );
      expect(tied.length, `${entry.id} is tied to no SIM part in the reading log`).toBeGreaterThan(0);
      const texts: string[] = [];
      for (const r of tied) {
        const text = await partText(r);
        expect(text, missing(r)).not.toBeNull();
        texts.push(words(text!));
      }
      for (const line of entry.found!.says.filter((l) => !NOT_SIM.test(l))) {
        for (const [, quote] of line.matchAll(/“([^”]+)”/g)) {
          expect(
            texts.some((t) => t.includes(words(quote))),
            `${entry.id}: “${quote}” is in none of ${tied.map((r) => r.section).join('; ')}`,
          ).toBe(true);
        }
      }
    });
  }
});
