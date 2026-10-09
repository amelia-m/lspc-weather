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
 * there. Every letter used below was read on the page that day. (Some
 * letters have no heading of their own: the K anchor is on L's heading, Q
 * on R's, V on W's, and X and Y on Z's. None of them is used here.)
 *
 * `term` is the entry's name as the page's source writes it. The page sets
 * names in capitals with CSS, which is why "SAFETY and TRAINING ADVISOR"
 * shows on uspa.org in capitals throughout.
 *
 * These are links to a definition, not citations: a glossary entry backs no
 * flag and no figure, so the entries are not in CITATIONS and not in the
 * reading log (whose entries each belong to a citation or a quote on
 * #citations). For the same reason a term is not linked in a flag or note
 * that already cites the document the term names (`citesTerm`): there a
 * reader clicking "BSR" to check the figure beside it wants the citation,
 * and the glossary would answer a different question. Nor is a word linked
 * when it is part of a sourced figure ("3,000 ft AGL"), a label or a readout.
 * scripts/simText.live.ts checks daily that each entry is still a heading
 * under its letter.
 *
 * Left out on purpose, because linking a word asserts its definition applies:
 *  - WAIVER. The glossary defines it as an exception to the BSRs or a
 *    liability release; the app's "LSPC waiver" is the club's posted wind
 *    policy, and whether that is a SIM 2-2 waiver is a question #citations
 *    leaves open. A link would answer it.
 *  - NIGHT JUMP. The glossary's sentence dates a night jump from one hour
 *    after official sunset; the night flag fires on 14 CFR 105.19's sunset
 *    to sunrise. A link from the flag would put a figure in front of the
 *    reader that nothing on the page acts on.
 *  - DENSITY ALTITUDE. The glossary describes the pilot's method, from
 *    pressure altitude and temperature, which is the card's headline; but
 *    the card also gives a figure with humidity folded in, under the same
 *    name, which that method leaves out. Its note quotes the FAA's
 *    definition beside its citation, which is what a reader checking the
 *    figure wants.
 *  - MSL and WING LOADING: the cards use them only in figures, labels, a
 *    title and an input prompt.
 *  - SIM, which every SIM link already opens, and terms the app uses only in
 *    their everyday sense (drop zone, student, upwind, turbulence).
 */
import type { Citation } from '../domain/types';
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
  /** SIM sections whose citation is a citation of the document the term
   *  names: a flag or note citing one leaves the term plain. */
  namesSections?: readonly string[];
}

export const SIM_GLOSSARY = {
  sta: { term: 'SAFETY and TRAINING ADVISOR (S&TA), USPA', letter: 'S', pattern: /\bS&TA\b/ },
  // 2-1 is the Basic Safety Requirements and 2-2 "Waivers to the Basic
  // Safety Requirements", as the readings on #citations (A1, A5) record.
  bsr: {
    term: 'BASIC SAFETY REQUIREMENTS (BSRs), USPA',
    letter: 'B',
    pattern: /\bBSRs?\b/,
    namesSections: ['2-1', '2-2'],
  },
  soloStudent: { term: 'SOLO STUDENT', letter: 'S', pattern: /\bsolo students?\b/i },
  agl: { term: 'AGL', letter: 'A', pattern: /\bAGL\b/ },
  jumpRun: { term: 'JUMP RUN', letter: 'J', pattern: /\bjump run\b/i },
  exitPoint: { term: 'EXIT POINT', letter: 'E', pattern: /\bexit point\b/i },
  exitWeight: { term: 'EXIT WEIGHT', letter: 'E', pattern: /\bexit weight\b/i },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof SIM_GLOSSARY;

export const GLOSSARY_KEYS = Object.keys(SIM_GLOSSARY) as GlossaryKey[];

/** The glossary page at the entry's letter: …/sim/glossary#S. */
export const glossaryUrl = (key: GlossaryKey): string => simUrl('glossary', SIM_GLOSSARY[key].letter);

/** Whether any of a flag's or note's citations cites the document `key`
 *  names (a SIM section in its `namesSections`, at any part). */
export function citesTerm(key: GlossaryKey, citations: readonly (Citation | undefined)[]): boolean {
  const sections: readonly string[] = (SIM_GLOSSARY[key] as GlossaryEntry).namesSections ?? [];
  return citations.some((c) => c != null && sections.some((s) => c.url === simUrl(s) || c.url.startsWith(`${simUrl(s)}#`)));
}

/** The terms a flag or note with these citations may link. */
export const linkableTerms = (citations: readonly (Citation | undefined)[]): GlossaryKey[] =>
  GLOSSARY_KEYS.filter((k) => !citesTerm(k, citations));

/** A piece of a string: plain text, or the text of a term to link. */
export interface TermSegment {
  text: string;
  term?: GlossaryKey;
}

/**
 * Splits `text` so the first use of each of `keys` can be linked: the result
 * joins back to `text`, and each key appears on at most one segment, its
 * first match that overlaps no match already taken (keys are taken in the
 * order given). After an overlapping match the search resumes one character
 * past that match's start, so a use inside the overlapping span is still
 * found. Pure.
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
      re.lastIndex = start + 1;
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
 * The same over the flags of one list: each key is linked at its first use
 * across all of them, not once per flag, and a flag's `skip` keys stay plain
 * in that flag (they remain available to a later one).
 */
export function splitGlossaryTermsAcross(
  items: readonly { text: string; skip?: readonly GlossaryKey[] }[],
  keys: readonly GlossaryKey[],
): TermSegment[][] {
  let left = [...keys];
  return items.map(({ text, skip = [] }) => {
    const segs = splitGlossaryTerms(
      text,
      left.filter((k) => !skip.includes(k)),
    );
    left = left.filter((k) => !segs.some((s) => s.term === k));
    return segs;
  });
}
