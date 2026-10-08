import { describe, expect, it } from 'vitest';
import { simPartText } from '../src/domain/simText';

/* A section page in the shape uspa.org serves: each part opens with an
 * anchoroffset, the article closes the last. */
const PAGE = `<html><body><article>
<a class="anchoroffset" name="1"></a><h2>2-1 Basic Safety Requirements</h2>
<a class="anchoroffset" name="1H"></a><h3>H. Winds</h3>
<p>Maximum ground winds</p><ul><li>For all solo students [S]<ul><li>14&nbsp;mph for ram-air canopies</li></ul></li></ul>
<script>var x = "not text";</script><style>.a{}</style>
<p>For licensed skydivers are unlimited &#8212; S&amp;TA&rsquo;s note</p>
<a class="anchoroffset" name="1I"></a><h3>I. Minimum Opening Altitudes</h3><p>3,000 feet AGL</p>
</article><footer>Copyright</footer></body></html>`;

describe('simPartText', () => {
  it('takes a part from its anchor to the next, as words only', () => {
    expect(simPartText(PAGE, '1H')).toBe(
      'H. Winds Maximum ground winds For all solo students [S] 14 mph for ram-air canopies For licensed skydivers are unlimited — S&TA’s note',
    );
  });

  it('ends the last part at the end of the article, not the page', () => {
    expect(simPartText(PAGE, '1I')).toBe('I. Minimum Opening Altitudes 3,000 feet AGL');
  });

  it('ignores markup that leaves the words alone', () => {
    const restyled = PAGE.replace('<h3>H. Winds</h3>', '<h3 class="new">H.   Winds</h3>');
    expect(simPartText(restyled, '1H')).toBe(simPartText(PAGE, '1H'));
  });

  it('changes when a word does', () => {
    expect(simPartText(PAGE.replace('14&nbsp;mph', '15&nbsp;mph'), '1H')).not.toBe(simPartText(PAGE, '1H'));
  });

  it('is null for an anchor the page does not have', () => {
    expect(simPartText(PAGE, '1Z')).toBeNull();
  });
});
