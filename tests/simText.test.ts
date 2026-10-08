import { describe, expect, it } from 'vitest';
import { simPartText } from '../src/domain/simText';

/* A section page in the shape uspa.org serves: each part opens with an
 * anchoroffset, some parts hold anchors of their own, the article closes
 * the last part. */
const PAGE = `<html><body><article>
<a class="anchoroffset" name="1"></a><h2>2-1 Basic Safety Requirements</h2>
<a class="anchoroffset" name="1G"></a><h3>G. Daylight</h3><p>All student jumps</p>
<a class="anchoroffset" name="1G4"></a><p>between official sunrise and sunset.</p>
<a class="anchoroffset" name="1H"></a><h3>H. Winds</h3>
<p>Maximum ground winds</p><ul><li>For all solo students [S]<ul><li>14&nbsp;mph for ram-air canopies</li></ul></li></ul>
<script>var x = "not text";</script><style>.a{}</style>
<p>For licensed skydivers are unlimited &#8212; S&amp;TA&rsquo;s note &#99999999;</p>
<a class="anchoroffset" name="1I"></a><h3>I. Minimum Opening Altitudes</h3><p>3,000 feet AGL</p>
</article><footer>Copyright</footer></body></html>`;

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

  it('ends the last part at the end of the article, not the page', () => {
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
      PAGE.replace('<article>', `<article><nav>${names.map((n) => `<a class="anchoroffset" name="${n}"></a>`).join('')}</nav>`);
    expect(simPartText(nav(['1H']), '1G', '1H')).toBeNull();
    expect(simPartText(nav(['1G', '1H']), '1G', '1H')).toBeNull();
  });

  it('is null when either anchor is missing or the end comes first', () => {
    expect(simPartText(PAGE, '1Z', '1I')).toBeNull();
    expect(simPartText(PAGE, '1H', '1Z')).toBeNull();
    expect(simPartText(PAGE, '1I', '1H')).toBeNull();
  });
});
