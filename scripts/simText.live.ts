/**
 * Has any SIM part this app cites changed since it was read?
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
import { READING_LOG } from '../src/config/readingLog';
import { simPartText } from '../src/domain/simText';

const parts = READING_LOG.filter((r) => r.simPart != null);
const pages = new Map<string, Promise<string>>();
const page = (section: string): Promise<string> => {
  if (!pages.has(section)) {
    pages.set(
      section,
      fetch(`https://www.uspa.org/sim/${section}`, {
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

describe('cited SIM parts, against the text they were read in', () => {
  for (const r of parts) {
    const { section, anchor, sha256, chars } = r.simPart!;
    it(`${r.section} (#${anchor})`, async () => {
      const text = simPartText(await page(section), anchor);
      expect(text, `#${anchor} is no longer on uspa.org/sim/${section}`).not.toBeNull();
      const now = createHash('sha256').update(text!).digest('hex');
      if (process.env.PRINT_SIM_FINGERPRINTS) {
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
