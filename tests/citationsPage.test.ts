import { afterEach, describe, expect, it, vi } from 'vitest';
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
    expect(html).toContain('The source says (read in the online SIM at uspa.org (the 2026 SIM), 2026-10-08)');
    expect(html).toContain('Please confirm:');
    expect(html).toContain('Your verdict on the claim:');
    // The four FAA/CFR entries are on the list with their own readings.
    for (const id of ['A8', 'A9', 'A10', 'A11']) expect(html).toContain(`${id} ·`);
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

  it('keeps the export text on the page, and labels each question group by its question', () => {
    // The clipboard needs a permission some browsers withhold and the issue
    // link has a length limit, so the Markdown the buttons send is rendered
    // too — otherwise a "select the text" fallback points at nothing.
    const exported = html.match(/<textarea[^>]*aria-label="Answers as text"[^>]*>([^<]*)<\/textarea>/);
    expect(exported?.[1]).toContain('Citations review by');
    expect(exported?.[1]).toContain('(no answers yet)');
    // A screen reader names a radio group by its label; "A1 question 1" said
    // which group, not what was asked. Each group is labelled by the element
    // that carries the question text.
    for (const entry of CHECKLIST) {
      entry.asks.forEach((_ask, i) => {
        const id = `q-${entry.id}:${i}-text`;
        expect(html).toContain(`id="${id}"`);
        expect(html).toContain(`aria-labelledby="${id}"`);
      });
    }
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
      'uspaSpottingWho',
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

/* "PIC" is the CFR's own abbreviation (14 CFR 1.1 defines "pilot in
 * command"), but a jumper reading a card or this page should not have to
 * know it. Text a reader sees spells it out. */
describe('reader-facing text spells out pilot in command', () => {
  it('has no bare "PIC" anywhere in the app’s source outside comments', () => {
    // Every string and JSX text a reader can see is in src/: flag guidance,
    // card text, citation notes and the checklist. Comments may use the
    // abbreviation; they are stripped first.
    const modules = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(modules).length).toBeGreaterThan(20);
    for (const [path, raw] of Object.entries(modules)) {
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect(code, path).not.toMatch(/\bPIC\b/);
    }
  });
});

/* The page reads a moved entry's answers by its answer key (A8 on the 5 SM
 * row), so a verdict stored against the old wording is not shown checked. */
describe('CitationsPage with an entry whose answers moved', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('../src/config/citationsChecklist');
    vi.resetModules();
  });

  it('shows the answers stored under the new key, not the old', async () => {
    vi.resetModules();
    vi.doMock('../src/config/citationsChecklist', async (orig) => {
      const real = await orig<typeof import('../src/config/citationsChecklist')>();
      const a8 = real.CHECKLIST.find((e) => e.id === 'A8')!;
      return {
        ...real,
        CHECKLIST: [
          { ...a8, answerKey: 'A8@new', otherWordings: [{ answerKey: 'A8', value: 'Flag fires below 3 SM' }] },
        ],
      };
    });
    const stored = (claims: Record<string, string>, questions: Record<string, unknown>) =>
      vi.stubGlobal('localStorage', {
        getItem: () => JSON.stringify({ reviewer: '', date: '', claims, questions }),
        setItem: () => {},
        removeItem: () => {},
      });
    const { CitationsPage: Page } = await import('../src/components/CitationsPage');
    const checked = () =>
      (renderToStaticMarkup(createElement(Page)).match(/<input[^>]*checked=""[^>]*>/g) ?? []).join('\n');

    stored({ A8: 'correct' }, { 'A8:0': { answer: 'yes' } });
    expect(checked()).toBe('');
    // Not shown as an answer, but not dropped unseen either.
    expect(renderToStaticMarkup(createElement(Page))).toContain(
      'You answered an earlier wording of this entry (Flag fires below 3 SM).',
    );

    stored({ 'A8@new': 'correct' }, { 'A8@new:0': { answer: 'yes' } });
    const now = checked();
    expect(now).toContain('name="claim-A8" checked="" value="correct"');
    // The form's names stay on the entry id.
    expect(now).toContain('name="q-A8:0" checked="" value="yes"');
    expect(renderToStaticMarkup(createElement(Page))).not.toContain('earlier wording');
  });
});
