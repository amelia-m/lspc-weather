import { describe, expect, it } from 'vitest';
import { glossaryHeadings, isGlossaryEntry, simEditionYear, simPartText } from '../src/domain/simText';

/* A section page in the shape uspa.org serves: each part opens with an
 * anchoroffset, some parts hold anchors of their own, and the content
 * module's closing comment ends the last part (there is no <article>). */
const PAGE = `<html><body><div id="dnn_ctr1122_ContentPane"><!-- Start_Module_1122 -->
<a class="anchoroffset" name="1"></a><h2>2-1 Basic Safety Requirements</h2>
<a class="anchoroffset" name="1G"></a><h3>G. Daylight</h3><p>All student jumps</p>
<a class="anchoroffset" name="1G4"></a><p>between official sunrise and sunset.</p>
<a class="anchoroffset" name="1H"></a><h3>H. Winds</h3>
<p>Maximum ground winds</p><ul><li>For all solo students [S]<ul><li>14&nbsp;mph for ram-air canopies</li></ul></li></ul>
<script>var x = "not text";</script><style>.a{}</style>
<p>For licensed skydivers are unlimited &#8212; S&amp;TA&rsquo;s note &#99999999;</p>
<a class="anchoroffset" name="1I"></a><h3>I. Minimum Opening Altitudes</h3><p>3,000 feet AGL</p>
</div><!-- End_Module_1122 --></div><footer><p>Copyright</p></footer></body></html>`;

describe('simPartText', () => {
  it('takes a part from its anchor to the one named as its end, as words only', () => {
    expect(simPartText(PAGE, '1H', '1I')).toBe(
      'H. Winds Maximum ground winds For all solo students [S] 14 mph for ram-air canopies For licensed skydivers are unlimited — S&TA’s note &#99999999;',
    );
  });

  it('runs over an anchor inside the part, to the end it is given', () => {
    // 2-1 G holds 1G4: ending at the next anchor of any kind would cut the
    // part before the sentence the checklist quotes.
    expect(simPartText(PAGE, '1G', '1H')).toBe('G. Daylight All student jumps between official sunrise and sunset.');
  });

  it('is null for a last part whose module does not close, rather than read to the page end', () => {
    expect(simPartText(PAGE.replace('<!-- End_Module_1122 -->', ''), '1I', null)).toBeNull();
    // Another module's end is not this one's.
    expect(simPartText(PAGE.replace('<!-- End_Module_1122 -->', '<!-- End_Module_9999 -->'), '1I', null)).toBeNull();
  });

  it('ends the last part at the end of the content module, not the page', () => {
    expect(simPartText(PAGE, '1I', null)).toBe('I. Minimum Opening Altitudes 3,000 feet AGL');
  });

  it('ignores markup that leaves the words alone', () => {
    const restyled = PAGE.replace('<h3>H. Winds</h3>', '<h3 class="new">H.   Winds</h3>');
    expect(simPartText(restyled, '1H', '1I')).toBe(simPartText(PAGE, '1H', '1I'));
  });

  it('changes when a word does', () => {
    expect(simPartText(PAGE.replace('14&nbsp;mph', '15&nbsp;mph'), '1H', '1I')).not.toBe(simPartText(PAGE, '1H', '1I'));
  });

  it('is null when the page names an anchor twice, rather than read the wrong copy', () => {
    // A contents list above the parts: either copy could be taken for the
    // part, and the nav's few words must not pass for it.
    const nav = (names: string[]): string =>
      PAGE.replace('<!-- Start_Module_1122 -->', `<!-- Start_Module_1122 --><nav>${names.map((n) => `<a class="anchoroffset" name="${n}"></a>`).join('')}</nav>`);
    expect(simPartText(nav(['1G']), '1G', '1H')).toBeNull();
    // The end named again inside the part, after its start: the first copy
    // would cut the part short.
    expect(simPartText(PAGE.replace('<p>All student jumps</p>', '<p>All student jumps</p><a class="anchoroffset" name="1H"></a>'), '1G', '1H')).toBeNull();
    expect(simPartText(nav(['1H']), '1G', '1H')).toBeNull();
    expect(simPartText(nav(['1G', '1H']), '1G', '1H')).toBeNull();
  });

  it('is null when either anchor is missing or the end comes first', () => {
    expect(simPartText(PAGE, '1Z', '1I')).toBeNull();
    expect(simPartText(PAGE, '1H', '1Z')).toBeNull();
    expect(simPartText(PAGE, '1I', '1H')).toBeNull();
  });
});

/* The glossary in the shapes uspa.org served on 2026-10-09: one anchor per
 * letter heading, a range anchor beside one (A-E) and another closing the
 * last paragraph before a letter (U-Z), an anchor named RRS on an R entry,
 * the Q anchor on R's heading, the V anchor on W's and X and Y on Z's, a name
 * split across two bold runs, one entry with no <span> wrapper, and AGL in
 * definitions as well as as an entry. No C or K heading: a letter need not
 * be followed by the next one. */
const GLOSSARY_BODY = `<h1><strong>Glossary</strong></h1>
<h4><a class="anchoroffset" name="A-E"></a><a class="anchoroffset" name="A"></a><span>A</span></h4>
<p><span><b><span style="text-transform:uppercase">AGL </span></b> Above ground level. Refers to altitude, e.g., 5,000 feet AGL.</span></p>
<p><span><b><span style="text-transform:uppercase">AIR </span></b>Acronym for &ldquo;altitude aware, in control, and relaxed.&rdquo;</span></p>
<p><span><b><span style="text-transform:uppercase">ALTIMETER </span></b> A device that measures height above the surface (AGL).</span></p>
<h4><a class="anchoroffset" name="B"></a><span>B</span></h4>
<p><span><b><span style="text-transform:uppercase">BASIC SAFETY REQUIREMENTS (BSR</span></b><b>s<span style="text-transform:uppercase">), USPA </span></b>Minimum standards published by USPA.</span></p>
<h4><a class="anchoroffset" name="J"></a><span>J</span></h4>
<p><b>JUMP RUN</b>The flight of the aircraft prior to exit.</p>
<h4><a class="anchoroffset" name="Q"></a><a class="anchoroffset" name="R"></a><span>R</span></h4>
<p><span><b><span>RAM-AIR PARACHUTE </span></b>A parachute with a canopy.</span></p>
<p><span><a class="anchoroffset" name="RRS"></a><b><span>RATING-RENEWAL SEMINAR, USPA </span></b>A continuing program.</span></p>
<p><span><b><span>RESERVE PARACHUTE </span></b>An approved parachute.</span></p>
<h4><a class="anchoroffset" name="S"></a><span>S</span></h4>
<p><span><b><span>SAFETY and TRAINING ADVISOR (S&amp;TA), USPA </span></b>A local person.</span></p>
<p><b><span style="text-transform:uppercase">SPOTTING </span></b>Selecting the correct ground reference point.<a class="anchoroffset" name="U-Z"></a>&nbsp;</p>
<h4><a class="anchoroffset" name="U"></a><span>U</span></h4>
<p><span><b><span>UPWIND </span></b>The direction from which the wind is blowing.</span></p>
<h4><a class="anchoroffset" name="W"></a><a class="anchoroffset" name="V"></a><span>W</span></h4>
<p><span><b><span>WAIVER </span></b>1. Exception to the BSRs.</span></p>
<p><span><b><span>WING LOADING </span></b>The jumper&rsquo;s exit weight divided by the area.</span></p>
<h4><a class="anchoroffset" name="X"></a><a class="anchoroffset" name="Y"></a><a class="anchoroffset" name="Z"></a><span>Z</span></h4>
<p><span><b><span>ZOO DIVE </span></b>A skydive that becomes chaotic.</span></p>`;
/* Wrapped as the page wraps it: the glossary is module 1175, and another
 * module (1110, a script on the live page) follows it. */
const GLOSSARY = `<!-- Start_Module_1175 --><div>${GLOSSARY_BODY}</div><!-- End_Module_1175 --><!-- Start_Module_1110 --><div><p><b>NOT AN ENTRY </b>another module.</p></div><!-- End_Module_1110 -->`;

describe('glossaryHeadings', () => {
  it('reads the entry names under a letter, and only the names', () => {
    expect(glossaryHeadings(GLOSSARY, 'A')).toEqual(['AGL', 'AIR', 'ALTIMETER']);
    expect(glossaryHeadings(GLOSSARY, 'S')).toEqual(['SAFETY and TRAINING ADVISOR (S&TA), USPA', 'SPOTTING']);
  });

  it('ends a letter at the next heading, not at the next anchor', () => {
    // RRS is an anchor inside R; the entries after it are still R's.
    expect(glossaryHeadings(GLOSSARY, 'R')).toEqual(['RAM-AIR PARACHUTE', 'RATING-RENEWAL SEMINAR, USPA', 'RESERVE PARACHUTE']);
    // W's heading also carries V, which sits right after it; U-Z closes
    // SPOTTING's paragraph, and S runs past it.
    expect(glossaryHeadings(GLOSSARY, 'W')).toEqual(['WAIVER', 'WING LOADING']);
    expect(glossaryHeadings(GLOSSARY, 'S')).toEqual(['SAFETY and TRAINING ADVISOR (S&TA), USPA', 'SPOTTING']);
    expect(glossaryHeadings(GLOSSARY, 'U')).toEqual(['UPWIND']);
  });

  it('ends a letter at the next heading, not at the next letter of the alphabet', () => {
    // No K heading follows J here.
    expect(glossaryHeadings(GLOSSARY, 'J')).toEqual(['JUMP RUN']);
  });

  it('turns tags into spaces, so a name split across bold runs shows the split', () => {
    expect(glossaryHeadings(GLOSSARY, 'B')).toEqual(['BASIC SAFETY REQUIREMENTS (BSR s ), USPA']);
  });

  it('reads a letter with no heading of its own as the letter whose heading carries its anchor', () => {
    expect(glossaryHeadings(GLOSSARY, 'Q')).toEqual(glossaryHeadings(GLOSSARY, 'R'));
    expect(glossaryHeadings(GLOSSARY, 'V')).toEqual(glossaryHeadings(GLOSSARY, 'W'));
  });

  it('ends the last letter at the end of its content module, not in the next module', () => {
    // The module after the glossary holds a bold-led paragraph (the shape a
    // footer address block would take); it is not a Z entry.
    expect(glossaryHeadings(GLOSSARY, 'Z')).toEqual(['ZOO DIVE']);
  });

  it('is null for every letter when its module does not close, rather than read on', () => {
    // Its own end gone: another module's end must not be taken for it.
    const unclosed = GLOSSARY.replace('<!-- End_Module_1175 -->', '');
    expect(glossaryHeadings(unclosed, 'Z')).toBeNull();
    expect(glossaryHeadings(unclosed, 'A')).toBeNull();
    expect(glossaryHeadings(GLOSSARY_BODY, 'A')).toBeNull();
  });

  it('is null when the letter’s anchor is missing or named twice', () => {
    expect(glossaryHeadings(GLOSSARY, 'K')).toBeNull();
    expect(glossaryHeadings(GLOSSARY + '<a class="anchoroffset" name="A"></a>', 'A')).toBeNull();
  });
});

describe('isGlossaryEntry', () => {
  it('finds a whole entry name under its letter, however the page splits it', () => {
    expect(isGlossaryEntry(GLOSSARY, 'A', 'AGL')).toBe(true);
    expect(isGlossaryEntry(GLOSSARY, 'B', 'BASIC SAFETY REQUIREMENTS (BSRs), USPA')).toBe(true);
    expect(isGlossaryEntry(GLOSSARY, 'S', 'SAFETY and TRAINING ADVISOR (S&TA), USPA')).toBe(true);
    expect(isGlossaryEntry(GLOSSARY, 'J', 'JUMP RUN')).toBe(true);
  });

  it('does not take a word in a definition, or part of a name, for an entry', () => {
    expect(isGlossaryEntry(GLOSSARY, 'W', 'BSRs')).toBe(false);
    expect(isGlossaryEntry(GLOSSARY, 'W', 'exit weight')).toBe(false);
    expect(isGlossaryEntry(GLOSSARY, 'S', 'SAFETY')).toBe(false);
    // Under another letter, an entry is not found.
    expect(isGlossaryEntry(GLOSSARY, 'B', 'AGL')).toBe(false);
  });
});

describe('simEditionYear', () => {
  // The heading as uspa.org served it on 2026-10-09, inside the page's
  // other markup.
  const LANDING = `<html><body><h1 class="logo">USPA</h1>
<div class="content"><h1>2026 Skydiver&#39;s Information Manual</h1>
<p>The USPA Skydiver&rsquo;s Information Manual (SIM) is the foundational textbook</p>
<h2>2026 SIM Translations</h2></div></body></html>`;

  it('reads the year from the heading, past other headings', () => {
    expect(simEditionYear(LANDING)).toBe(2026);
  });

  it('follows the heading when USPA publishes a new edition', () => {
    expect(simEditionYear(LANDING.replace('<h1>2026 ', '<h1>2027 '))).toBe(2027);
  });

  it('reads a curly apostrophe or markup inside the heading the same', () => {
    expect(simEditionYear(LANDING.replace('Skydiver&#39;s', 'Skydiver&rsquo;s'))).toBe(2026);
    expect(simEditionYear(LANDING.replace('<h1>2026 ', '<h1><span>2026</span> '))).toBe(2026);
  });

  it('takes the edition from the h1 only, not a year in another heading', () => {
    // An h2 naming another year (a translation, a preview of the next
    // edition) must not move the edition the page states.
    // Placed above the h1, so a reader taking the first matching heading
    // of any level would return it.
    const preview = LANDING.replace('<div class="content">', '<h2>2027 Skydiver&#39;s Information Manual preview</h2><div class="content">');
    expect(simEditionYear(preview)).toBe(2026);
  });

  it('reads a title with words added around it, or no apostrophe', () => {
    expect(simEditionYear(LANDING.replace('Information Manual</h1>', 'Information Manual (SIM)</h1>'))).toBe(2026);
    expect(simEditionYear(LANDING.replace('<h1>2026 Skydiver&#39;s', '<h1>USPA 2026 Skydivers'))).toBe(2026);
    expect(simEditionYear(LANDING.replace('Skydiver&#39;s', 'Skydivers&rsquo;'))).toBe(2026);
  });

  it('is null when no heading names an edition, rather than a year from elsewhere', () => {
    // "2026 SIM Translations" is an h2; the year must come from the h1.
    expect(simEditionYear(LANDING.replace(/<h1>2026[^<]*<\/h1>/, '<h1>Skydiver&#39;s Information Manual</h1>'))).toBeNull();
    expect(simEditionYear('<html></html>')).toBeNull();
  });
});
