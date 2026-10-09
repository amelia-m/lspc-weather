/**
 * The USPA SIM glossary entries the dashboard links its own words to, so a
 * jumper who meets "S&TA" or "BSR" on a card can read USPA's definition.
 *
 * Read in the online SIM at uspa.org on 2026-10-09 (SIM_GLOSSARY_READ), at
 * https://www.uspa.org/sim/glossary, the page USPA's own SIM pages link from
 * their footer (as /SIM/Glossary, which serves the same text). The glossary
 * has no anchor per term, and no copy-link icon of the kind the SIM's
 * section pages have. What it has is one anchor per letter heading,
 * `<a class="anchoroffset" name="S">` above "S", so a link lands on the
 * letter the entry is filed under, not on the entry; the reader scrolls from
 * there. Every letter used below was read on the page that day. (The W
 * heading carries the V anchor too, and the Z heading X and Y; none of
 * those three letters is used here.)
 *
 * `term` is the entry's name as the page's source writes it. The page sets
 * names in capitals with CSS, which is why "SAFETY and TRAINING ADVISOR"
 * shows on uspa.org in capitals throughout.
 *
 * These are links, not citations: a glossary definition backs no flag and no
 * figure, so the entries are not in CITATIONS and not in the reading log
 * (whose entries each belong to a citation or a quote on #citations).
 * scripts/simText.live.ts checks daily that each entry is still filed under
 * its letter.
 *
 * Left out on purpose:
 *  - WAIVER. The glossary defines it as an exception to the BSRs or a
 *    liability release; the app's "LSPC waiver" is the club's posted wind
 *    policy, and whether that is a SIM 2-2 waiver is a question #citations
 *    leaves open. A link would answer it.
 *  - NIGHT JUMP. The glossary's sentence dates a night jump from one hour
 *    after official sunset; the night flag fires on 14 CFR 105.19's sunset
 *    to sunrise. A link from the flag would put a figure in front of the
 *    reader that nothing on the page acts on.
 *  - SIM, which every SIM link already opens, and terms the app uses only in
 *    their everyday sense (drop zone, student, upwind, turbulence).
 */
import { simUrl } from './thresholds';

/** When the glossary was read, at uspa.org, for every entry below. */
export const SIM_GLOSSARY_READ = '2026-10-09';

export interface GlossaryEntry {
  /** The entry's name as the glossary's source writes it. */
  term: string;
  /** The letter heading's anchor the entry is filed under. */
  letter: string;
  /** How the dashboard's prose writes the term. */
  pattern: RegExp;
}

export const SIM_GLOSSARY = {
  sta: { term: 'SAFETY and TRAINING ADVISOR (S&TA), USPA', letter: 'S', pattern: /\bS&TA\b/ },
  bsr: { term: 'BASIC SAFETY REQUIREMENTS (BSRs), USPA', letter: 'B', pattern: /\bBSRs?\b/ },
  soloStudent: { term: 'SOLO STUDENT', letter: 'S', pattern: /\bsolo students?\b/i },
  agl: { term: 'AGL', letter: 'A', pattern: /\bAGL\b/ },
  msl: { term: 'MSL', letter: 'M', pattern: /\bMSL\b/ },
  densityAltitude: { term: 'DENSITY ALTITUDE', letter: 'D', pattern: /\bdensity altitude\b/i },
  jumpRun: { term: 'JUMP RUN', letter: 'J', pattern: /\bjump run\b/i },
  exitPoint: { term: 'EXIT POINT', letter: 'E', pattern: /\bexit point\b/i },
  exitWeight: { term: 'EXIT WEIGHT', letter: 'E', pattern: /\bexit weight\b/i },
  wingLoading: { term: 'WING LOADING', letter: 'W', pattern: /\bwing loading\b/i },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof SIM_GLOSSARY;

export const GLOSSARY_KEYS = Object.keys(SIM_GLOSSARY) as GlossaryKey[];

/** The glossary page at the entry's letter: …/sim/glossary#S. */
export const glossaryUrl = (key: GlossaryKey): string => simUrl('glossary', SIM_GLOSSARY[key].letter);

/** A piece of a string: plain text, or the text of a term to link. */
export interface TermSegment {
  text: string;
  term?: GlossaryKey;
}

/**
 * Splits `text` so the first use of each of `keys` can be linked: the result
 * joins back to `text`, and each key appears on at most one segment, its
 * first match. Where a match would overlap one already taken (keys are taken
 * in the order given), that key's next match is used instead. Pure.
 */
export function splitGlossaryTerms(
  text: string,
  keys: readonly GlossaryKey[],
  // The entries' patterns; a test passes its own to reach the overlap rule,
  // which no two entries above trigger.
  patterns: Record<GlossaryKey, { pattern: RegExp }> = SIM_GLOSSARY,
): TermSegment[] {
  const found: { key: GlossaryKey; start: number; end: number }[] = [];
  for (const key of keys) {
    const { pattern } = patterns[key];
    const re = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const start = m.index;
      const end = start + m[0].length;
      if (!found.some((f) => start < f.end && f.start < end)) {
        found.push({ key, start, end });
        break;
      }
    }
  }
  found.sort((a, b) => a.start - b.start);
  const out: TermSegment[] = [];
  let at = 0;
  for (const f of found) {
    if (f.start > at) out.push({ text: text.slice(at, f.start) });
    out.push({ text: text.slice(f.start, f.end), term: f.key });
    at = f.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

/**
 * The same over several strings rendered one after another in a card: each
 * key is linked at its first use across all of them, not once per string.
 */
export function splitGlossaryTermsAcross(texts: readonly string[], keys: readonly GlossaryKey[]): TermSegment[][] {
  let left = [...keys];
  return texts.map((t) => {
    const segs = splitGlossaryTerms(t, left);
    left = left.filter((k) => !segs.some((s) => s.term === k));
    return segs;
  });
}
