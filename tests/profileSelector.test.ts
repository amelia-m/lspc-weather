import { describe, expect, it } from 'vitest';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileSelector } from '../src/components/ProfileSelector';
import { LICENSES, profileLabel, WAIVER_TIERS, type License, type WindProfileId } from '../src/config/thresholds';

/* Student or Licensed first; under Student, USPA BSR or the club waiver; under
 * the waiver, the jump-count tier. The waiver is a student policy (the sign's
 * table is headed "Students"), so it is not offered beside Licensed. */
const render = (profile: WindProfileId, lastStudent: WindProfileId = 'student', license: License = 'A') =>
  renderToStaticMarkup(
    createElement(ProfileSelector, {
      profile,
      lastStudent,
      lastTier: WAIVER_TIERS[0].id,
      onChange: () => {},
      license,
      onLicenseChange: () => {},
    }),
  );
const active = (html: string) =>
  [...html.matchAll(/<button type="button" class="active" aria-pressed="true">([^<]+)<\/button>/g)].map((m) => m[1]);
const groups = (html: string) => [...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);

/** What clicking a button labelled `label` asks for. The component holds no
 *  state, so calling it and walking the element tree reaches its handlers
 *  without a DOM. */
const press = (
  profile: WindProfileId,
  lastStudent: WindProfileId,
  label: string,
  lastTier: WindProfileId = WAIVER_TIERS[0].id,
): { profile?: WindProfileId; license?: License } => {
  const got: { profile?: WindProfileId; license?: License } = {};
  let found = false;
  const walk = (n: ReactNode): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!isValidElement(n)) return;
    const p = n.props as { children?: ReactNode; onClick?: () => void };
    if (n.type === 'button' && p.children === label) {
      found = true;
      p.onClick!();
    }
    walk(p.children);
  };
  walk(
    ProfileSelector({
      profile,
      lastStudent,
      lastTier,
      onChange: (p) => (got.profile = p),
      license: 'A',
      onLicenseChange: (l) => (got.license = l),
    }),
  );
  if (!found) throw new Error(`no button "${label}"`);
  return got;
};
const click = (...args: Parameters<typeof press>): WindProfileId => {
  const got = press(...args);
  if (got.profile === undefined) throw new Error(`"${args[2]}" chose no profile`);
  return got.profile;
};

describe('the wind-limit profile selector', () => {
  it('offers Student and Licensed at the top, and no waiver beside them', () => {
    const html = render('licensed');
    expect(groups(html)).toEqual(['Jumper class', 'USPA license']);
    expect(active(html)).toEqual(['Licensed', 'A']);
    expect(html).not.toContain('LSPC waiver');
    expect(html).toContain('aria-pressed="false">Student<');
    expect(html).toContain('<button type="button"');
  });

  it('under Student, offers the USPA BSR limits or the waiver, BSR with no tiers', () => {
    const html = render('student');
    expect(groups(html)).toEqual(['Jumper class', 'Student wind limits']);
    expect(active(html)).toEqual(['Student', 'USPA BSR']);
    expect(html).not.toContain(WAIVER_TIERS[0].label);
  });

  it('on a waiver tier, shows Student, the waiver and that tier as chosen', () => {
    const tier = WAIVER_TIERS[2];
    const html = render(tier.id, tier.id);
    expect(groups(html)).toEqual(['Jumper class', 'Student wind limits', 'Waiver experience tier']);
    expect(active(html)).toEqual(['Student', 'LSPC waiver', tier.label]);
    for (const t of WAIVER_TIERS) expect(html).toContain(`>${t.label}</button>`);
  });
});

/* Under Licensed, the USPA license, which moves the drift card's Deploy
 * default (BSR 2-1 I) and no wind limit. A student has none to choose. */
describe('the license choice under Licensed', () => {
  it('offers A to D under Licensed, with the chosen one pressed', () => {
    const html = render('licensed', 'student', 'C');
    for (const l of LICENSES) expect(html).toContain(`>${l}</button>`);
    expect(active(html)).toEqual(['Licensed', 'C']);
  });

  it('is not offered on any student profile', () => {
    for (const p of ['student', WAIVER_TIERS[0].id] as WindProfileId[]) {
      expect(groups(render(p, p))).not.toContain('USPA license');
    }
  });

  it('chooses a license and leaves the profile alone', () => {
    expect(press('licensed', 'student', 'C')).toEqual({ license: 'C' });
  });

  it('names the choice on screen, not only to a screen reader', () => {
    expect(render('licensed')).toContain('<span class="license-label" aria-hidden="true">USPA license</span>');
  });

  /* A license stored from an earlier Licensed visit must not reach the drift
   * card on a student profile: a B, C or D license would open Deploy on
   * 2,500 ft, under the 3,000 ft student minimum. */
  it('reaches the drift card only on the Licensed profile', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync: (p: string, e: string) => string };
    const app = fs.readFileSync(decodeURIComponent(new URL('../src/App.tsx', import.meta.url).pathname), 'utf8');
    const drift = app.slice(app.indexOf('<DriftPanel'), app.indexOf('/>', app.indexOf('<DriftPanel')));
    expect(drift).toContain("license={profile === 'licensed' ? license : null}");
  });
});

describe('what the selector’s buttons choose', () => {
  const t21 = WAIVER_TIERS[3].id;

  it('returns from Licensed to the student choice last made, a waiver tier included', () => {
    expect(click('licensed', t21, 'Student')).toBe(t21);
    expect(click('licensed', 'student', 'Student')).toBe('student');
    expect(click(t21, t21, 'Licensed')).toBe('licensed');
  });

  it('opens the waiver on the tier last used, and BSR on the BSR limits', () => {
    // From BSR, where App holds lastStudent = 'student': the tier is its own
    // memory, so waiver 21+ → BSR → waiver comes back to 21+.
    expect(click('student', 'student', 'LSPC waiver', t21)).toBe(t21);
    expect(click('student', 'student', 'LSPC waiver')).toBe(WAIVER_TIERS[0].id);
    expect(click(t21, t21, 'USPA BSR')).toBe('student');
    expect(click(t21, t21, WAIVER_TIERS[1].label)).toBe(WAIVER_TIERS[1].id);
  });

  it('labels each student profile the way the selector names it', () => {
    expect(profileLabel('student')).toBe('Student · USPA BSR');
    expect(profileLabel(t21)).toBe(`Student · LSPC waiver · ${WAIVER_TIERS[3].label}`);
    expect(profileLabel('licensed')).toBe('Licensed');
  });
});

/* A jumper choosing a waiver tier can open the sign the tiers were read off.
 * The photo is served with the site (public/), so it opens without GitHub. */
describe('the waiver sign photo link', () => {
  it('sits under the tiers on a waiver profile, says the photo is undated, and nowhere else', () => {
    const waiver = render(WAIVER_TIERS[0].id);
    expect(waiver).toContain('class="tier-sign" href="/lspc-waiver-sign.jpg" target="_blank" rel="noopener noreferrer"');
    expect(waiver).toContain('Photo of the posted sign (undated)');
    expect(render('student')).not.toContain('tier-sign');
    expect(render('licensed')).not.toContain('tier-sign');
  });

  it('points at a photo the site actually serves, sized for the web', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as {
      readFileSync: (p: string) => Uint8Array;
    };
    const jpg = fs.readFileSync(decodeURIComponent(new URL('../public/lspc-waiver-sign.jpg', import.meta.url).pathname));
    // A JPEG (FF D8 FF), and a crop for the web rather than the 3 MB original.
    expect([...jpg.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect(jpg.length).toBeLessThan(400_000);
  });
});
