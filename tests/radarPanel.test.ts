import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { foldCount, folded, inView } from './support/fold';
import { describe, expect, it } from 'vitest';
import { RadarPanel } from '../src/components/RadarPanel';
import { RADAR_IMAGE_PX } from '../src/config/site';

describe('the radar card', () => {
  // The loop is lazily loaded, so until a reader scrolls to it the browser
  // knows its shape only from these attributes. Without them the box sat
  // 60 px tall and the drop-zone ring, placed in percentages of the box,
  // floated away from where it lands on the map.
  it('says in view that the marker is approximate, and folds how its place was found', () => {
    const html = renderToStaticMarkup(createElement(RadarPanel));
    expect(inView(html)).toContain(' marks the drop zone, approximately.');
    expect(inView(html)).not.toContain('county boundaries');
    expect(foldCount(html)).toBe(1);
    expect(folded(html)).toContain('which NWS does not publish: it was measured against county boundaries.');
  });

  it('gives the image its size, so its box has the map’s shape before it loads', () => {
    const html = renderToStaticMarkup(createElement(RadarPanel));
    const img = /<img[^>]*class="radar-img"[^>]*>/.exec(html)?.[0] ?? '';
    expect(img).toContain(`width="${RADAR_IMAGE_PX.width}"`);
    expect(img).toContain(`height="${RADAR_IMAGE_PX.height}"`);
    expect(img).toContain('loading="lazy"');
  });
});
