import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvisoryPanel } from '../src/components/AdvisoryPanel';
import { DataFreshness } from '../src/components/DataFreshness';
import type { SourceKey, SourceStatus } from '../src/domain/types';

/* Both cards used to render their own <section class="panel"> and header by
 * hand. Going through Panel must not change what the stylesheet sees: the
 * named class on the card, a header control as a direct child of the header
 * (inside the subtitle span it would inherit muted small type, and a control
 * overlaying the Refresh button is a phone-width defect this app has had), and
 * a custom footer in the panel-sources slot instead of the "Data:" list. */

const idle: SourceStatus = { ok: true, fetchedAt: null, stale: false, error: null, pending: false };
const status: Record<SourceKey, SourceStatus> = {
  metar: idle,
  nws: idle,
  windsAloft: idle,
  taf: idle,
  daily: idle,
};

describe('cards that go through Panel', () => {
  it('keeps the advisory card’s accent class and its own footer', () => {
    const html = renderToStaticMarkup(
      createElement(AdvisoryPanel, { advisories: [], profile: 'Student', hasSourcedWindLimit: true }),
    );
    expect(html).toContain('<section class="panel advisory-panel">');
    expect(html).toMatch(/<footer class="panel-sources">Flag values from:/);
    expect(html).not.toContain('Data:');
  });

  it('keeps the Refresh button a direct child of the Data health header', () => {
    const html = renderToStaticMarkup(
      createElement(DataFreshness, { status, lastUpdated: null, onRefresh: () => {} }),
    );
    expect(html).toContain('<section class="panel freshness">');
    // h2 then the button, with nothing wrapping the button.
    expect(html).toMatch(/<\/h2><button class="refresh-btn"/);
    expect(html).not.toMatch(/<span class="panel-sub"><button/);
  });
});

describe('MasonryGrid without a layout engine', () => {
  it('renders the plain grid, leaving the packing to the browser', async () => {
    // Vitest runs in node: no ResizeObserver, no layout. The static render
    // must be the aligned grid the stylesheet falls back to, with the cards
    // in DOM order and no masonry class, so a test render never depends on
    // measurements it cannot make.
    const { MasonryGrid } = await import('../src/components/common/MasonryGrid');
    const html = renderToStaticMarkup(
      createElement(MasonryGrid, null, createElement('section', { className: 'panel' }, 'a'), createElement('section', { className: 'panel' }, 'b')),
    );
    expect(html).toBe('<div class="grid"><section class="panel">a</section><section class="panel">b</section></div>');
  });
});
