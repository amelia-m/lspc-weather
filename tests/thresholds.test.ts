import { describe, expect, it } from 'vitest';
import type { Citation } from '../src/domain/types';
import { fmtLimitSpeed } from '../src/domain/units';
import {
  CITATIONS,
  recommendedDeployFt,
  resolveThresholds,
  WAIVER_TIERS,
  type WindProfileId,
} from '../src/config/thresholds';

describe('recommendedDeployFt', () => {
  it('uses the student/A-license BSR minimum (3,000 ft) for students', () => {
    expect(recommendedDeployFt('student')).toBe(3000);
  });

  it('uses the licensed (B-license) BSR minimum (2,500 ft) for licensed', () => {
    expect(recommendedDeployFt('licensed')).toBe(2500);
  });

  it('treats every waiver tier as student-category (3,000 ft)', () => {
    for (const tier of WAIVER_TIERS) {
      expect(recommendedDeployFt(tier.id)).toBe(3000);
    }
  });
});

/* The citations are the product: the dashboard flags a condition and hands the
 * jumper the rule to check. These tests guard the three properties that make a
 * citation checkable — it has to point somewhere, it must not claim more
 * precision than the link delivers, and where no published rule sets the number
 * it must say so instead of borrowing someone else's authority. */

const entries = Object.entries(CITATIONS) as Array<[string, Citation]>;

/** The one citation that is not an outside document: the app's own thresholds,
 *  which link to the in-app page listing them for review. */

describe('CITATIONS', () => {
  it.each(entries)('%s links somewhere with a source and a ref', (_key, citation) => {
    expect(citation.source.trim()).not.toBe('');
    expect(citation.ref.trim()).not.toBe('');
    // An external authority must be reachable over https; the house-heuristic
    // citation deliberately points inward, because there is no outside document
    // to point at — that is the whole claim it makes.
    expect(citation.url).toMatch(/^https:\/\//);
  });

  it.each(entries)('%s carries a verification caveat', (_key, citation) => {
    // Every figure here is AI-derived; the caveat is what keeps the UI honest
    // (SourceLink renders it as the ⓘ tooltip). A citation without one reads as
    // verified when nothing in this repo has verified it.
    expect(citation.note?.trim()).toBeTruthy();
  });
});

describe('USPA SIM citations', () => {
  const sim = entries.filter(([, c]) => c.url.startsWith('https://www.uspa.org/sim'));

  it('covers the SIM citations actually in the map', () => {
    expect(sim.length).toBeGreaterThan(0);
  });

  it.each(sim)('%s uses the repo-wide SIM URL shape', (_key, citation) => {
    // Either the section index or /sim/<section> — no deep anchors or PDF
    // mirrors, which are the shapes most likely to rot or 404.
    expect(citation.url).toMatch(/^https:\/\/www\.uspa\.org\/sim(\/\d+-\d+)?$/);
  });

  it.each(sim)('%s: the source string agrees with the URL it points at', (_key, citation) => {
    // The inconsistency this audit was for: a source reading "Section 2-1"
    // while the link drops the reader on the SIM contents page. Either the
    // source names the section the URL opens, or it names no section at all.
    const named = /Section (\d+-\d+)/.exec(citation.source)?.[1] ?? null;
    const linked = /\/sim\/(\d+-\d+)$/.exec(citation.url)?.[1] ?? null;
    expect(named).toBe(linked);
  });

  it('says so in the note when it can only offer the SIM contents page', () => {
    // A generic link is allowed — guessing a section number for a claim nobody
    // has checked would send a jumper to the wrong rule while looking
    // authoritative — but it has to be visibly deliberate, not an oversight.
    for (const [key, citation] of sim) {
      if (/\/sim\/\d+-\d+$/.test(citation.url)) continue;
      expect(citation.note, `${key} links to the SIM index without saying why`).toMatch(
        /not been identified/,
      );
    }
  });
});

describe('citations all point outside this app', () => {
  it('offers no in-app escape hatch for an unsourced number', () => {
    // There used to be an `appHeuristic` citation so a flag firing on a number
    // the app invented could still show a "Source:" line. That let an
    // untraceable threshold stay on the dashboard wearing an honest-looking
    // label. The flags that needed it were removed instead, and nothing here
    // may link inside the app again.
    for (const [key, c] of Object.entries(CITATIONS)) {
      expect(c.url, `${key} links inside the app`).toMatch(/^https:\/\//);
    }
  });
});

describe('wind-limit profiles', () => {
  const profiles: WindProfileId[] = ['student', 'licensed', ...WAIVER_TIERS.map((t) => t.id)];

  it.each(profiles)('%s cites a source from the CITATIONS map', (id) => {
    // Every profile's wind flag must be traceable; an inline one-off citation
    // would escape the consistency checks above.
    expect(Object.values(CITATIONS)).toContain(resolveThresholds(id).windCitation);
  });

  it('cites the club waiver, not the BSR, for the waivered tiers', () => {
    // The tier numbers come from the sign at the DZ, not from USPA — citing the
    // BSR there would credit USPA with limits it never set.
    for (const tier of WAIVER_TIERS) {
      expect(resolveThresholds(tier.id).windCitation).toBe(CITATIONS.lspcWaiver);
    }
  });

  it.each(profiles)('%s either cites a real source for its bands or shows none', (id) => {
    const cite = resolveThresholds(id).windLimitCitation;
    if (cite === null) return; // no published limit — the card draws no band
    expect(Object.values(CITATIONS)).toContain(cite);
  });

  it('shows no limit band for licensed, because nobody published one', () => {
    // 17/25 kt are the app's own numbers and the licensed guidance says USPA
    // sets no limit, so there is nothing to draw and nothing to cite. null is
    // the honest value; the card renders the observation alone, and
    // evaluateAdvisories reads the same null to withhold the flag.
    expect(resolveThresholds('licensed').windLimitCitation).toBeNull();
  });

  it('carries no threshold that no published source sets', () => {
    // These fields drove flags on numbers the app invented: an early "watch"
    // band under every wind limit, density altitude so many feet above the
    // field, so many minutes before sunset. The flags went, so the config
    // went with them — a tunable left behind for a flag that no longer exists
    // reads as a live control.
    const RETIRED = [
      'windWatchKt',
      'densityAltExcessWatchFt',
      'densityAltExcessCautionFt',
      'lastLoadWatchMin',
    ];
    for (const id of profiles) {
      const keys = Object.keys(resolveThresholds(id));
      for (const gone of RETIRED) {
        expect(keys, `${id} still carries ${gone}`).not.toContain(gone);
      }
    }
  });

  it('still carries the thresholds a published source does set', () => {
    // The counterpart to the test above: this sweep removes unsourced numbers,
    // not every number. The USPA student figure, the posted waiver wind and
    // gust limits and the 14 CFR 105.17 visibility floor all stay.
    expect(resolveThresholds('student').windCautionKt).toBe(12);
    expect(resolveThresholds('student').visibilityCautionSm).toBe(3);
    for (const tier of WAIVER_TIERS) {
      const t = resolveThresholds(tier.id);
      expect(t.windCautionKt).toBeCloseTo(tier.windMph * 0.868976, 5);
      expect(t.gustCautionKt).toBeCloseTo(tier.gustMph * 0.868976, 5);
    }
  });

  it('keeps the published sources for the bands that have one', () => {
    expect(resolveThresholds('student').windLimitCitation).toBe(CITATIONS.uspaStudentWinds);
    for (const tier of WAIVER_TIERS) {
      expect(resolveThresholds(tier.id).windLimitCitation).toBe(CITATIONS.lspcWaiver);
    }
  });

  it('carries no unsourced pilot-takeoff folklore in any profile guidance', () => {
    // A "~30–35 mph" figure for when pilots will not take off sat under a USPA
    // citation with no source at all; takeoff limits belong to the PIC and the
    // aircraft's operating limitations, not to USPA.
    for (const id of profiles) {
      const guidance = resolveThresholds(id).windGuidance;
      expect(guidance).not.toMatch(/30\s*[–-]\s*35/);
      expect(guidance).not.toMatch(/will not take off/i);
    }
  });

  it('gives the licensed profile guidance a reader can act on with no flag to carry it', () => {
    // The sweep that removed the invented 25 kt trigger must not have taken the
    // sourced CLAIM with it. Nothing flags surface wind for a licensed jumper,
    // so this sentence is the only thing the app has to say about their wind —
    // it has to name no threshold (nothing published one) and still refer the
    // reader somewhere real. SurfaceWindPanel prints it beside windCitation.
    const t = resolveThresholds('licensed');
    expect(t.windLimitCitation).toBeNull();
    expect(t.windGuidance).toMatch(/pilot in command|PIC/);
    expect(t.windGuidance).toMatch(/ask the PIC/);
    // No number dressed up as a limit: the referral is the whole point.
    expect(t.windGuidance).not.toMatch(/\d+\s*(kt|mph)/);
    expect(t.windCitation).toBe(CITATIONS.uspaLicensedWinds);
  });

  it('keeps the two top waiver tiers distinguishable in both display units', () => {
    // The posted sign reads "gusts less than 19 mph" at 10–20 jumps and "less
    // than 20 mph" at 21+. Stored in knots those are 16.51 and 17.38, which
    // both print "17 kt" at whole knots — so selecting the tier you earned
    // changed nothing on screen and the card misquoted the sign it cites.
    const a = resolveThresholds('waiver:10-20');
    const b = resolveThresholds('waiver:21+');
    expect(a.gustCautionKt).not.toBe(b.gustCautionKt);
    for (const unit of ['kt', 'mph'] as const) {
      expect(fmtLimitSpeed(a.gustCautionKt!, unit)).not.toBe(fmtLimitSpeed(b.gustCautionKt!, unit));
    }
    // In mph the display lands back on the sign's own whole numbers.
    expect(fmtLimitSpeed(a.gustCautionKt!, 'mph')).toBe('19 mph');
    expect(fmtLimitSpeed(b.gustCautionKt!, 'mph')).toBe('20 mph');
  });

  it('does not cite the student wind limit at licensed jumpers', () => {
    // The licensed guidance says no USPA wind limit binds them; pointing at a
    // citation labelled "student ground-wind limits" contradicted the text.
    expect(resolveThresholds('licensed').windCitation).toBe(CITATIONS.uspaLicensedWinds);
    expect(resolveThresholds('student').windCitation).toBe(CITATIONS.uspaStudentWinds);
  });
});

/* Every citation in the map should be reachable from the app. `uspaWaivers` was
 * added with a doc comment saying it was cited for the authority the club
 * exercises, and then not wired to anything — a citation nobody can reach is
 * research, not a source line. The flag half of this is in advisories.test.ts. */
describe('no citation is defined and then left unreachable', () => {
  it('cites the SIM waiver rule alongside club policy on the waiver tiers', () => {
    const t = resolveThresholds('waiver:0-5');
    expect(t.windCitation).toBe(CITATIONS.lspcWaiver);
    expect(t.windSecondaryCitation).toBe(CITATIONS.uspaWaivers);
    // The guidance sentence that second citation exists for.
    expect(t.windGuidance).toMatch(/excursion above the USPA BSR/);
  });

  it('leaves no citation in the map that nothing references', () => {
    // Scans the source for `CITATIONS.<key>`. The definitions themselves use a
    // bare key (`uspaWaivers: {`), so only real uses match — including the
    // profile fields in this file, which is how most citations reach a card. A
    // citation is only worth having if something renders it; one that nothing
    // reads is a claim the reader cannot reach, and its doc comment will
    // describe a source line that does not exist.
    const modules = import.meta.glob('../src/**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const source = Object.values(modules).join('\n');
    const unreferenced = Object.keys(CITATIONS).filter(
      (key) => !source.includes(`CITATIONS.${key}`),
    );
    expect(unreferenced, 'citations nothing in src/ renders').toEqual([]);
  });
});
