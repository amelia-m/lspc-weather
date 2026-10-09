/**
 * The text of one part of a USPA SIM section, as uspa.org serves it, reduced
 * to a stable form a fingerprint can be taken of.
 *
 * uspa.org marks each part of a section page with
 * `<a class="anchoroffset" name="1H">` (the anchors the citations link to,
 * read with curl on 2026-09-23). It also puts anchors inside some parts (2-1 G
 * holds 1G4, 1G4b and 1G5; 4-7 has one named SPACE between B and C), so a part
 * does not end at the next anchor of any kind: the caller names the anchor it
 * ends at (`until`), or null for the end of the article. Between the two,
 * scripts and styles are dropped, tags become spaces, character references are
 * decoded and whitespace (a non-breaking space included) is collapsed, so
 * markup changes that leave the words alone (a class name, a wrapper) do not
 * change the text, and any change to the words does.
 *
 * The reading log (src/config/readingLog.ts) keeps a SHA-256 of this text for
 * each SIM part the app cites or quotes, as it read on the day it was read;
 * scripts/simText.live.ts takes it again from the live page and fails when it
 * differs. That is the pin: uspa.org names its online SIM only as "2026 SIM",
 * and its list of change documents did not load (2026-10-08), so the
 * fingerprint is what records which text was read. Null when either anchor
 * is missing or named twice, or `until` comes before `anchor`: the page is
 * no longer the shape the log describes. Pure.
 */
export function simPartText(page: string, anchor: string, until: string | null): string | null {
  // An anchor the page names twice (a contents list added above the parts,
  // say) leaves no telling which one is the part: -1, as if it were gone.
  const at = (name: string): number => {
    const tag = `<a class="anchoroffset" name="${name}"`;
    const i = page.indexOf(tag);
    return i === page.lastIndexOf(tag) ? i : -1;
  };
  const start = at(anchor);
  if (start === -1) return null;
  let end: number;
  if (until != null) {
    end = at(until);
    if (end <= start) return null;
  } else {
    const articleEnd = page.indexOf('</article>', start);
    end = articleEnd > start ? articleEnd : page.length;
  }
  const text = decodeEntities(
    page
      .slice(start, end)
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The entry names filed under one letter of the SIM glossary
 * (uspa.org/sim/glossary), as the page sets them: the bold text that opens
 * each paragraph, reduced as simPartText reduces a part (tags become spaces,
 * character references decoded, whitespace collapsed).
 *
 * The glossary has one anchor per letter heading
 * (`<h4><a class="anchoroffset" name="S"></a><span>S</span></h4>`, read
 * 2026-10-09) and none per term. A letter's entries run from its anchor to
 * the next `<h4>` in the document, not to the next anchor: some anchors sit
 * inside a letter (one named RRS on an R entry, so R does not end there;
 * and the range anchors F-J, K-O, P-T and U-Z close the previous letter's
 * last paragraph, F-J a second time on F's heading), and some headings carry two or three (K's anchor is on L's
 * heading, Q's on R's, V's on W's, X's and Y's on Z's), so neither the next
 * anchor nor the next letter of the alphabet is reliably where a letter
 * ends. A letter with no heading of its own reads as the letter whose
 * heading it shares. Only a paragraph's opening bold
 * run counts as an entry name, so a term that appears inside another
 * entry's definition ("5,000 feet AGL" under AIR) is not taken for an
 * entry. Null when the anchor is missing or named twice. Pure.
 */
export function glossaryHeadings(page: string, letter: string): string[] | null {
  const tag = `<a class="anchoroffset" name="${letter}"`;
  const start = page.indexOf(tag);
  if (start === -1 || start !== page.lastIndexOf(tag)) return null;
  // The next heading, or the end of the article for the last letter, so the
  // page's footer is never read as entries.
  const rest = page.slice(start + tag.length);
  const stop = rest.search(/<h4\b|<\/article>/i);
  const section = page.slice(start, stop === -1 ? page.length : start + tag.length + stop);
  const names: string[] = [];
  for (const [, body] of section.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    // Any wrapping <span>s and empty anchors (RRS opens its paragraph),
    // then one or more bold runs: "BSR" and "s" are two runs on the page, so
    // the name is every run before the definition.
    const lead = /^(?:\s|<span\b[^>]*>|<a\b[^>]*><\/a>)*((?:<(b|strong)\b[^>]*>[\s\S]*?<\/\2>\s*)+)/i.exec(body);
    if (lead) names.push(decodeEntities(lead[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
  }
  return names;
}

/** Whether `term` is an entry name under `letter` in the glossary page.
 *  Compared with case, spaces and punctuation set aside, because the page
 *  splits a name across bold runs ("(BSR" then "s), USPA" reduce to
 *  "(BSR s ), USPA"); the whole name must match, not a part of it. Pure. */
export function isGlossaryEntry(page: string, letter: string, term: string): boolean {
  const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9&]+/g, '');
  return (glossaryHeadings(page, letter) ?? []).some((n) => squash(n) === squash(term));
}

/**
 * The edition year uspa.org's SIM landing page names in its heading, which
 * read "<h1>2026 Skydiver&#39;s Information Manual</h1>" on 2026-10-09. The
 * heading is the one place the page states the edition; the list of change
 * documents below it would say which revision, but it served "Error:
 * Downloads is currently unavailable" to a script on 2026-10-08 and to a
 * browser on 2026-10-09. Null when no h1 names "<year> Skydiver's
 * Information Manual": the page has changed shape, which is itself a reason
 * to look. Only an h1 counts: the page's other headings ("2026 SIM
 * Translations") name editions of other documents. Pure.
 */
export function simEditionYear(page: string): number | null {
  for (const [, inner] of page.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    // Not anchored, so a word added around the title ("USPA", "(SIM)") or
    // a dropped apostrophe does not read as a missing edition.
    const m = /\b(\d{4}) Skydiver(?:['’]s|s['’]?) Information Manual\b/i.exec(text);
    if (m) return Number(m[1]);
  }
  return null;
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  deg: '°',
};

/** Numeric references and the named ones a SIM page uses; any other named
 *  reference is left as written, which keeps the result deterministic. */
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      // Out of Unicode's range, String.fromCodePoint throws; such a
      // reference is left as written, like an unknown name.
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[ref.toLowerCase()] ?? whole;
  });
}
