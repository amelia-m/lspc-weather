import { describe, expect, it } from 'vitest';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileSelector } from '../src/components/ProfileSelector';
import { profileLabel, WAIVER_TIERS, type WindProfileId } from '../src/config/thresholds';

/* Student or Licensed first; under Student, USPA BSR or the club waiver; under
 * the waiver, the jump-count tier. The waiver is a student policy (the sign's
 * table is headed "Students"), so it is not offered beside Licensed. */
const render = (profile: WindProfileId, lastStudent: WindProfileId = 'student') =>
  renderToStaticMarkup(createElement(ProfileSelector, { profile, lastStudent, onChange: () => {} }));
const active = (html: string) =>
  [...html.matchAll(/<button class="active" aria-pressed="true">([^<]+)<\/button>/g)].map((m) => m[1]);
const groups = (html: string) => [...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);

/** What clicking a button labelled `label` asks for. The component holds no
 *  state, so calling it and walking the element tree reaches its handlers
 *  without a DOM. */
const click = (profile: WindProfileId, lastStudent: WindProfileId, label: string): WindProfileId => {
  let got: WindProfileId | undefined;
  const walk = (n: ReactNode): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!isValidElement(n)) return;
    const p = n.props as { children?: ReactNode; onClick?: () => void };
    if (n.type === 'button' && p.children === label) p.onClick!();
    walk(p.children);
  };
  walk(ProfileSelector({ profile, lastStudent, onChange: (p) => (got = p) }));
  if (got === undefined) throw new Error(`no button "${label}"`);
  return got;
};

describe('the wind-limit profile selector', () => {
  it('offers Student and Licensed at the top, and no waiver beside them', () => {
    const html = render('licensed');
    expect(groups(html)).toEqual(['Jumper class']);
    expect(active(html)).toEqual(['Licensed']);
    expect(html).not.toContain('LSPC waiver');
    expect(html).toContain('aria-pressed="false">Student<');
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

describe('what the selector’s buttons choose', () => {
  const t21 = WAIVER_TIERS[3].id;

  it('returns from Licensed to the student choice last made, a waiver tier included', () => {
    expect(click('licensed', t21, 'Student')).toBe(t21);
    expect(click('licensed', 'student', 'Student')).toBe('student');
    expect(click(t21, t21, 'Licensed')).toBe('licensed');
  });

  it('opens the waiver on the tier last used, or the first tier, and BSR on the BSR limits', () => {
    expect(click('student', t21, 'LSPC waiver')).toBe(t21);
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
