import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  GLOSSARY_KEYS,
  SIM_GLOSSARY,
  glossaryUrl,
  splitGlossaryTerms,
  SIM_GLOSSARY_READ,
  citesTerm,
  linkableTerms,
  splitGlossaryTermsAcross,
  type GlossaryKey,
} from '../src/config/simGlossary';
import { CITATIONS, DEFAULT_THRESHOLDS, isSimSectionUrl, resolveThresholds } from '../src/config/thresholds';
import type { Advisory, WindsAloftLevel } from '../src/domain/types';
import { normalizeMetar } from '../src/domain/normalize';
import { densityAltitude } from '../src/domain/densityAltitude';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';
import { DashboardDisclaimer } from '../src/components/DashboardDisclaimer';
import { AdvisoryPanel } from '../src/components/AdvisoryPanel';
import { SurfaceWindPanel } from '../src/components/SurfaceWindPanel';
import { DriftPanel } from '../src/components/DriftPanel';
import { DensityAltitudePanel } from '../src/components/DensityAltitudePanel';
import { CeilingSkyPanel } from '../src/components/CeilingSkyPanel';
import { WindsAloftPanel } from '../src/components/WindsAloftPanel';
import { WingLoadingPanel } from '../src/components/WingLoadingPanel';
import { SettingsPanel } from '../src/components/SettingsPanel';
import { HourlyLegend } from '../src/components/common/HourlyChart';

/* Words in the dashboard's prose linked to their entry in the USPA SIM
 * glossary (src/config/simGlossary.ts). The page has an anchor per letter
 * heading and none per term, read on 2026-10-09, so every link is the
 * glossary page at the entry's letter. */

describe('the SIM glossary entries', () => {
  it('link the glossary page at the letter the entry is filed under, and nothing else', () => {
    const citationUrls = new Set(Object.values(CITATIONS).map((c) => c.url));
    for (const key of GLOSSARY_KEYS) {
      const { term, letter } = SIM_GLOSSARY[key];
      expect(letter, key).toMatch(/^[A-Z]$/);
      // Filed under its own first letter. K, Q, V, X and Y share another
      // letter's heading on the page (L, R, W, Z), so none is a place to land.
      expect(term[0], key).toBe(letter);
      expect(['K', 'Q', 'V', 'X', 'Y'], key).not.toContain(letter);
      expect(glossaryUrl(key), key).toBe(`https://www.uspa.org/sim/glossary#${letter}`);
      // Not a SIM section, and not a citation: the reading log and the
      // section-shape test are for those.
      expect(isSimSectionUrl(glossaryUrl(key)), key).toBe(false);
      expect(citationUrls.has(glossaryUrl(key)), key).toBe(false);
    }
  });
});

describe('splitGlossaryTerms', () => {
  const linked = (segs: { text: string; term?: GlossaryKey }[]) => segs.filter((s) => s.term).map((s) => [s.term, s.text]);

  it('marks the first use of each term asked for, and gives back the text it was handed', () => {
    const text = 'The BSR sets it; the BSRs say so; ask the S&TA. Jump run, and jump run.';
    const segs = splitGlossaryTerms(text, GLOSSARY_KEYS);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(linked(segs)).toEqual([
      ['bsr', 'BSR'],
      ['sta', 'S&TA'],
      ['jumpRun', 'Jump run'],
    ]);
  });

  it('marks only the terms asked for, and only whole words', () => {
    expect(linked(splitGlossaryTerms('the BSR and the S&TA', ['sta']))).toEqual([['sta', 'S&TA']]);
    expect(linked(splitGlossaryTerms('AGLX, BSRS, s&ta', GLOSSARY_KEYS))).toEqual([]);
  });

  it('across several strings, marks each term once, at its first use, and leaves a string’s skipped terms for a later one', () => {
    const [a, b, c] = splitGlossaryTermsAcross(
      [{ text: 'Ask the S&TA; the BSR.', skip: ['bsr'] }, { text: 'The S&TA and the BSR.' }, { text: 'The BSR.' }],
      GLOSSARY_KEYS,
    );
    expect(linked(a)).toEqual([['sta', 'S&TA']]);
    expect(linked(b)).toEqual([['bsr', 'BSR']]);
    expect(linked(c)).toEqual([]);
  });

  it('where two matches overlap, keeps the one taken first and still finds the other’s first use inside the overlapped span', () => {
    // No two real entries overlap, so two made-up patterns stand in.
    const patterns = { ...SIM_GLOSSARY, jumpRun: { pattern: /jump run/ }, exitPoint: { pattern: /(run and )?exit point/ } };
    const text = 'plan jump run and exit point; then the exit point';
    const segs = splitGlossaryTerms(text, ['jumpRun', 'exitPoint'], patterns);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(linked(segs)).toEqual([
      ['jumpRun', 'jump run'],
      ['exitPoint', 'exit point'],
    ]);
    // The first "exit point", inside the span the overlapping match covered,
    // not the second.
    expect(segs.map((x) => x.text)).toEqual(['plan ', 'jump run', ' and ', 'exit point', '; then the exit point']);
  });
});

/** Every glossary link in the markup, as the keys it links. */
const linkedTerms = (html: string): GlossaryKey[] => {
  const out: GlossaryKey[] = [];
  for (const m of html.matchAll(/<a class="sim-term" href="([^"]*)"[^>]*title="USPA SIM glossary definition \(letter [A-Z]; glossary read ([^)]*)\): ([^"]*)">/g)) {
    expect(m[2]).toBe(SIM_GLOSSARY_READ);
    const name = m[3].replace(/&amp;/g, '&');
    const key = GLOSSARY_KEYS.find((k) => SIM_GLOSSARY[k].term === name);
    expect(key, name).toBeDefined();
    expect(m[1]).toBe(glossaryUrl(key!));
    out.push(key!);
  }
  return out;
};

/** The deepest an <a> sits inside another: 1 when no link is in a link. */
const linkDepth = (html: string): number => {
  let depth = 0;
  let max = 0;
  for (const m of html.matchAll(/<a\b|<\/a>/g)) {
    depth += m[0] === '</a>' ? -1 : 1;
    max = Math.max(max, depth);
  }
  return max;
};

const noop = () => {};
const levels: WindsAloftLevel[] = [0, 1000, 3000, 5000, 7000, 10000, 13000].map((ft) => ({
  altitudeFtAgl: ft,
  altitudeFtMsl: ft + 1182,
  directionDeg: 270,
  speedKt: 10 + ft / 1000,
  tempC: 15,
}));
const current = normalizeMetar(METAR_FIXTURE[0]);
// An MVFR ceiling, so the sky card prints its 14 CFR 105.17 note.
const mvfr = normalizeMetar({
  ...METAR_FIXTURE[0],
  rawOb: METAR_FIXTURE[0].rawOb.replace('BKN045', 'BKN020'),
  clouds: [{ cover: 'BKN', base: 2000 }],
});
const flags: Advisory[] = [
  {
    id: 'surface-wind',
    level: 'caution',
    metric: 'Surface wind',
    value: '20 kt',
    guidance: DEFAULT_THRESHOLDS.student.windGuidance,
    citation: CITATIONS.uspaStudentWinds,
    secondaryCitation: CITATIONS.uspaWaivers,
  },
  {
    id: 'other',
    level: 'info',
    metric: 'Other',
    value: 'n/a',
    guidance: 'A second flag that names the S&TA and the BSR again.',
    citation: CITATIONS.uspaWeather,
  },
];
const r = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);
const surface = (id: Parameters<typeof resolveThresholds>[0]) =>
  r(createElement(SurfaceWindPanel, { current, thresholds: resolveThresholds(id), label: 'x', unit: 'kt', onUnitChange: noop }));

/** Each card, and the terms its prose links: each once. */
const CARDS: [string, () => string, GlossaryKey[]][] = [
  ['the banner', () => r(createElement(DashboardDisclaimer)), ['sta']],
  [
    'Conditions to note, empty',
    () => r(createElement(AdvisoryPanel, { advisories: [], profile: 'Student', hasSourcedWindLimit: true })),
    ['sta'],
  ],
  [
    'Conditions to note, two flags naming the same terms',
    () => r(createElement(AdvisoryPanel, { advisories: flags, profile: 'Student', hasSourcedWindLimit: true })),
    // The wind flag cites SIM 2-1 and 2-2, so its "BSR" stays plain; the
    // second flag cites neither, so the term's first link is there.
    ['soloStudent', 'sta', 'bsr'],
  ],
  // The guidance note cites SIM 2-1, so its "BSR" stays plain.
  ['Surface wind, Licensed', () => surface('licensed'), ['soloStudent', 'sta']],
  ['Surface wind, Student', () => surface('student'), ['soloStudent']],
  [
    'the hourly chart key, Student',
    () => r(createElement(HourlyLegend, { unit: 'kt', limits: resolveThresholds('student'), profile: 'P' })),
    ['soloStudent'],
  ],
  [
    'Freefall drift',
    () => r(createElement(DriftPanel, { levels, source: 'open-meteo' } as never)),
    // "the BSR minimum" names the source of a figure the card cites, and
    // "3,000 ft AGL" is that figure: both plain.
    ['sta', 'exitPoint'],
  ],
  [
    'Density altitude',
    () =>
      r(
        createElement(DensityAltitudePanel, {
          da: densityAltitude({ elevationFt: 1182, altimeterInHg: 29.92, oatC: 25, dewpointC: 15 }),
        }),
      ),
    // The glossary's definition is a method the card's figure does not follow.
    [],
  ],
  // AGL and MSL appear there only in a caption and in 105.17's figures.
  ['Ceiling & sky, MVFR', () => r(createElement(CeilingSkyPanel, { current: mvfr, hourly: [] })), []],
  [
    'Winds aloft',
    () =>
      r(
        createElement(WindsAloftPanel, {
          levels,
          source: 'open-meteo',
          validity: { validMs: Date.now() + 105 * 60_000 },
          unit: 'kt',
          onUnitChange: noop,
        }),
      ),
    // Not the quoted “MSL”: that is the label on Schulze's page.
    ['jumpRun', 'agl'],
  ],
  ['Exit weight & wing loading', () => r(createElement(WingLoadingPanel)), ['exitWeight']],
  [
    'Settings',
    () =>
      r(
        createElement(SettingsPanel, {
          thresholds: DEFAULT_THRESHOLDS.student,
          base: DEFAULT_THRESHOLDS.student,
          label: 'x',
          modified: false,
          onChange: noop,
          onReset: noop,
        }),
      ),
    ['bsr'],
  ],
];

describe('glossary links on the cards', () => {
  it.each(CARDS)('%s links its terms, each once', (_name, render, expected) => {
    expect(linkedTerms(render())).toEqual(expected);
  });

  it.each(CARDS)('%s puts no link inside another', (_name, render) => {
    expect(linkDepth(render())).toBe(1);
  });

  it('links no term in a flag or note that cites the document the term names', () => {
    // A block that links SIM 2-1 or 2-2 (the BSRs, and waivers to them)
    // carries no glossary link for BSR. Checked on the cards where such a
    // block names the BSR: the student wind flag and the Licensed guidance.
    const blocks = (html: string) => html.match(/<li\b[\s\S]*?<\/li>|<p\b[\s\S]*?<\/p>/g) ?? [];
    let checked = 0;
    for (const [, render] of CARDS) {
      for (const block of blocks(render())) {
        if (!/uspa\.org\/sim\/2-[12]\b/.test(block)) continue;
        expect(block).not.toContain(glossaryUrl('bsr'));
        if (/\bBSR\b/.test(block.replace(/<a\b[\s\S]*?<\/a>/g, ''))) checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it('puts the wing loading card’s link in its standing note, not the input prompt', () => {
    const html = r(createElement(WingLoadingPanel));
    const note = /<p class="muted small">PD’s maximum[\s\S]*?<\/p>/.exec(html)?.[0] ?? '';
    expect(linkedTerms(note)).toEqual(['exitWeight']);
    expect(html).toContain('<p class="muted small">Enter a body weight to work out exit weight and wing loading.</p>');
  });
});

describe('citesTerm', () => {
  it('takes a citation of SIM 2-1 or 2-2, at any part, as citing the BSRs, and nothing else', () => {
    for (const c of [CITATIONS.uspaStudentWinds, CITATIONS.uspaLicensedWinds, CITATIONS.uspaOpeningAltitude, CITATIONS.uspaWaivers]) {
      expect(citesTerm('bsr', [c]), c.url).toBe(true);
    }
    for (const c of [CITATIONS.uspaWeather, CITATIONS.uspaSpotting, CITATIONS.far10517, CITATIONS.lspcWaiver, undefined]) {
      expect(citesTerm('bsr', [c]), c?.url).toBe(false);
    }
    // Only the BSRs name a cited document.
    expect(linkableTerms([CITATIONS.uspaStudentWinds, CITATIONS.uspaWaivers])).toEqual(GLOSSARY_KEYS.filter((k) => k !== 'bsr'));
  });
});
