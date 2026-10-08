/**
 * The text of one part of a USPA SIM section, as uspa.org serves it, reduced
 * to a stable form a fingerprint can be taken of.
 *
 * uspa.org marks each part of a section page with
 * `<a class="anchoroffset" name="1H">` (the anchors the citations link to,
 * read with curl on 2026-09-23). A part runs from its anchor to the next one;
 * the last runs to the end of the article. Scripts and styles are dropped,
 * tags become spaces, character references are decoded and whitespace is
 * collapsed, so markup changes that leave the words alone (a class name, a
 * wrapper) do not change the text, and any change to the words does.
 *
 * The reading log (src/config/readingLog.ts) keeps a SHA-256 of this text for
 * each cited part as it read on the day it was read; scripts/simText.live.ts
 * takes it again from the live page and fails when it differs. That is the
 * pin: uspa.org names its online SIM only as "2026 SIM", and its list of
 * change documents did not load (2026-10-08), so the fingerprint is what
 * records which text was read. Pure.
 */
export function simPartText(page: string, anchor: string): string | null {
  const marks = [...page.matchAll(/<a class="anchoroffset" name="([^"]+)"/g)].map((m) => ({
    name: m[1],
    at: m.index ?? 0,
  }));
  const i = marks.findIndex((m) => m.name === anchor);
  if (i === -1) return null;
  const start = marks[i].at;
  const next = marks[i + 1]?.at;
  const articleEnd = page.indexOf('</article>', start);
  const end = next ?? (articleEnd > start ? articleEnd : page.length);
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
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED[ref.toLowerCase()] ?? whole;
  });
}
