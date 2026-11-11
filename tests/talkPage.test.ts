import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppFooter, TALK_URL } from '../src/components/AppFooter';
import talkPage from '../public/talk/index.html?raw';
import talkSource from '../docs/talks/lincoln-ai-meetup/talk.qmd?raw';

/* The talk on how the dashboard was built is a page of the site
 * (public/talk/index.html, rendered by scripts/renderTalk.sh from
 * docs/talks/lincoln-ai-meetup/talk.qmd), linked from the dashboard's
 * footer (the maintainer, 2026-11-11). These hold the link to the file, the
 * file to its source, and the public copy to the contract's rules: no claim
 * references (the draft keeps them), no session link, no run or issue id. */
describe('the talk page', () => {
  it('is linked from the footer, by its file', () => {
    const html = renderToStaticMarkup(createElement(AppFooter));
    expect(TALK_URL.endsWith('talk/index.html')).toBe(true);
    expect(html).toContain(`href="${TALK_URL}"`);
    expect(html).toContain('How this was built');
  });

  it('is the rendered deck, self-contained, with the claim references stripped', () => {
    expect(talkPage).toContain('class="reveal"');
    // Every spoken slide of the source is in the page.
    for (const title of ['Why I built it', 'The sites behind it', 'The rule that shaped everything', 'AI disclosure', 'What you could reuse']) {
      expect(talkSource).toContain(`## ${title}`);
      expect(talkPage).toContain(title);
    }
    expect(talkPage).not.toContain('class="ref"');
    expect(talkPage).toContain('rel="icon"');
    // reveal.js is embedded, not fetched: the page works from the file alone.
    expect(talkPage).not.toMatch(/<script[^>]+src="https?:/);
  });

  it('shows none of the identifiers the contract keeps off the slides', () => {
    for (const forbidden of ['claude.ai/code/session', 'actions/runs/', 'Claude-Session', '/home/user/', 'github.com/amelia-m/lspc-weather/issues/']) {
      expect(talkPage, forbidden).not.toContain(forbidden);
    }
  });
});
