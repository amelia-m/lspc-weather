import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CitationsPage } from '../src/components/CitationsPage';
import { CITATIONS } from '../src/config/thresholds';
import { CHECKLIST } from '../src/config/citationsChecklist';

/* The page is read at the DZ as a checklist: the claim, what the source says,
 * the questions. It is not a changelog. Sentences about what the app used to
 * claim or how it changed made a reader work out which sentence was live, so
 * the rule is that none appear; the commit log carries that history. */
describe('CitationsPage', () => {
  const html = renderToStaticMarkup(createElement(CitationsPage));

  it('asks the reader to confirm each claim against a quoted source', () => {
    expect(html).toContain('The source says (read in the SIM at uspa.org, 2026-09-22)');
    expect(html).toContain('Please confirm:');
    expect(html).toContain('Your verdict on the claim:');
    // The four FAA/CFR entries are on the list with their own readings.
    for (const id of ['A8', 'A9', 'A10']) expect(html).toContain(`${id} ·`);
  });

  it('gives every claim a verdict control and every question its own answer and note', () => {
    // One "Verdict:" line under two or three questions muddled the rulings;
    // each claim and each question now has its own input, and the page keeps
    // them in the browser until they are sent.
    const claimRadios = html.match(/name="claim-A\d+"/g) ?? [];
    const questionRadios = html.match(/name="q-A\d+:\d+"/g) ?? [];
    const notes = html.match(/class="cite-note"/g) ?? [];
    const asks = CHECKLIST.reduce((n, e) => n + e.asks.length, 0);
    expect(claimRadios).toHaveLength(CHECKLIST.length * 4);
    expect(questionRadios).toHaveLength(asks * 3);
    expect(notes).toHaveLength(asks);
    expect(html).not.toContain('Verdict:');
    expect(html).toContain('Send as a GitHub issue');
    expect(html).toContain('Copy answers');
    expect(html).toMatch(/href="https:\/\/github\.com\/amelia-m\/lspc-weather\/issues\/new\?title=/);
  });

  it('links every claim to the section it cites', () => {
    // The same links the cards show, so a reader lands on the section rather
    // than a name. Each of these is cited by at least one entry.
    for (const key of [
      'uspaStudentWinds',
      'uspaOpeningAltitude',
      'far10519',
      'uspaNightJumps',
      'uspaLicensedWinds',
      'lspcWaiver',
      'uspaWaivers',
      'uspaWeather',
      'uspaSpotting',
      'far10517',
      'aimFlightCategory',
      'faaDensityAltitude',
    ] as const) {
      expect(html, `${key} not linked`).toContain(`href="${CITATIONS[key].url}"`);
    }
  });

  it('says nothing about what the app used to claim or what changed', () => {
    const text = html.replace(/<[^>]+>/g, ' ');
    for (const history of [
      /used to/i,
      /was wrong/i,
      /correct(ed|ion) on/i,
      /no longer/i,
      /now (says|shows|prints|names|carries|reads)/i,
      /is gone/i,
      /has been (identified|fixed|changed)/i,
      /earlier version/i,
    ]) {
      expect(text, `history wording: ${history}`).not.toMatch(history);
    }
  });
});
