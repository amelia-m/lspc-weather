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
