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
 * It also reads the edition year from the SIM landing page's heading and
 * fails when it is not SIM_EDITION_YEAR: a new edition means every part
 * above is to be read again in it, whether or not its words changed.
 *
 * PRINT_SIM_FINGERPRINTS=1 prints the current fingerprints instead of
 * comparing, for taking them when a part is read again.
 *
 * It also checks that each SIM glossary entry the cards link to is still
 * filed under the letter its link lands on (last block below).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { READING_LOG, SIM_EDITION_YEAR, citationsOf, type SourceReading } from '../src/config/readingLog';
import { CHECKLIST, SIM_READ } from '../src/config/citationsChecklist';
import { CITATIONS, SIM_INDEX_URL, simUrl } from '../src/config/thresholds';
import { glossaryHeadings, isGlossaryEntry, refusalDetail, simEditionYear, simPartText } from '../src/domain/simText';
import { GLOSSARY_KEYS, SIM_GLOSSARY } from '../src/config/simGlossary';

const parts = READING_LOG.filter((r) => r.simPart != null);

/* Every request to uspa.org goes through one queue, a few seconds apart:
 * about eight a run (the landing page, the sections, the glossary), which
 * went out back to back until 2026-10-09, when Cloudflare in front of
 * uspa.org refused every one from that day's runner with a 403. Whether the
 * pace had anything to do with it is not known; spacing them costs the run
 * about twenty seconds. A refusal's error carries refusalDetail, so the
 * next one says whether it was a block or a bot check, and every failure
 * names the request it was. */
const GAP_MS = 3_000;
let lastRequest: Promise<unknown> = Promise.resolve();
const get = (url: string, label: string): Promise<string> => {
  const request = lastRequest.then(async () => {
    let r: Response;
    try {
      r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (lspc-weather SIM text check)' },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      throw new Error(`${label}: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
    }
    if (!r.ok) {
      // The status is the finding; a body that will not read only loses
      // the detail.
      const body = await r.text().catch(() => '');
      throw new Error(`${label}: HTTP ${r.status}${refusalDetail(body, (n) => r.headers.get(n))}`);
    }
    try {
      return await r.text();
    } catch (err) {
      throw new Error(`${label}: HTTP ${r.status}, body unread: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  lastRequest = request.catch(() => undefined).then(() => new Promise((done) => setTimeout(done, GAP_MS)));
  return request;
};

/** Each section page, fetched once however many checks read it. */
const pages = new Map<string, Promise<string>>();
const page = (section: string): Promise<string> => {
  if (!pages.has(section)) pages.set(section, get(simUrl(section), `uspa.org/sim/${section}`));
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
  r.simPart!.until == null
    ? `#${r.simPart!.anchor} is no longer on uspa.org/sim/${r.simPart!.section}, is there twice, or no longer sits in a content module that closes (<!-- Start_Module_N --> ... <!-- End_Module_N -->)`
    : `#${r.simPart!.anchor} to #${r.simPart!.until} is no longer on uspa.org/sim/${r.simPart!.section}, in that order and once each`;

describe('the SIM edition uspa.org names', () => {
  it(`is still the ${SIM_EDITION_YEAR} SIM`, async () => {
    const landing = await get(SIM_INDEX_URL, 'uspa.org/sim');
    const year = simEditionYear(landing);
    // Informational: whether the change-document list showed its error.
    // Its absence is not proof the list loaded (it could be reworded, or
    // drawn by script), so that case says to look rather than "served".
    const downloads = /Downloads is currently unavailable/i.test(landing)
      ? 'showed "Downloads is currently unavailable"'
      : `showed no error: look at ${SIM_INDEX_URL} for the newest change document`;
    process.stdout.write(`SIM edition on uspa.org: ${year ?? 'not found'}; change-document list ${downloads}\n`);
    // Taking fingerprints for a new edition is the step before moving the
    // year, so print mode reports the edition and does not fail on it.
    if (process.env.PRINT_SIM_FINGERPRINTS === '1') return;
    expect(year, `the SIM page no longer has a heading naming the edition: look at ${SIM_INDEX_URL}`).not.toBeNull();
    expect(
      year,
      `uspa.org now names the ${year} SIM: read every cited and quoted part in it, check the claims, take new fingerprints (PRINT_SIM_FINGERPRINTS=1), then move SIM_EDITION_YEAR and SIM_LAST_READ in src/config/readingLog.ts`,
    ).toBe(SIM_EDITION_YEAR);
  });
});

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
 * catches a quote no part backs, and a `quotedIn` moved off the entry whose
 * quote the part backs, unless another of the entry's parts holds the same
 * words; an id left in `quotedIn` after its entry stops quoting the part
 * only ties one more part, and is not caught.
 * Not checked: the claim's own wording, and lines quoting the CFR or the
 * club's document, which A3 and A5 read beside the SIM and are told apart
 * by how the line starts; a SIM quote put on such a line would be skipped. */
const words = (s: string): string => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
const NOT_SIM = /^(14 CFR|The club document)/;
const simEntries = CHECKLIST.filter((e) => e.found?.read.includes(SIM_READ));

describe('SIM quotes on #citations, in the parts they are tied to', () => {
  it('finds the entries that read the SIM', () => {
    // That every entry citing or quoting the SIM says SIM_READ, so none
    // drops out of this set, is tests/readingLog.test.ts's to hold.
    expect(simEntries.length).toBeGreaterThan(0);
  });
  for (const entry of simEntries) {
    it(entry.id, async () => {
      const tied = parts.filter(
        (r) =>
          r.quotedIn?.includes(entry.id) ||
          entry.sources.some((s) => citationsOf(r).some((k) => CITATIONS[k].url === s.url)),
      );
      expect(tied.length, `${entry.id} is tied to no SIM part in the reading log`).toBeGreaterThan(0);
      const found = await Promise.all(tied.map(partText));
      tied.forEach((r, i) => expect(found[i], missing(r)).not.toBeNull());
      const texts = found.map((t) => words(t!));
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

/* The SIM glossary entries the cards link to (src/config/simGlossary.ts).
 * The glossary has no anchor per term, so each link lands on the letter
 * heading the entry is filed under; this checks the entry is still an entry
 * name under that heading (glossaryHeadings, src/domain/simText.ts, which
 * says where a letter ends and what counts as a name), so a link does not
 * send a reader to a letter that no longer holds the term. Its definition is
 * not fingerprinted. */
describe('SIM glossary entries the cards link, under the letter each link lands on', () => {
  for (const key of GLOSSARY_KEYS) {
    const { term, letter } = SIM_GLOSSARY[key];
    it(`${term} (#${letter})`, async () => {
      const glossary = await page('glossary');
      const names = glossaryHeadings(glossary, letter);
      expect(names, `#${letter} is no longer on uspa.org/sim/glossary, is there twice, or no longer sits in a content module that closes (<!-- Start_Module_N --> ... <!-- End_Module_N -->)`).not.toBeNull();
      expect(
        isGlossaryEntry(glossary, letter, term),
        `${term} is no longer an entry under ${letter} in the SIM glossary; its entries there: ${names!.join(' | ')}`,
      ).toBe(true);
    });
  }
});
