import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileSelector } from '../src/components/ProfileSelector';
import { WAIVER_TIERS, type WindProfileId } from '../src/config/thresholds';

/* Student or Licensed first; under Student, USPA BSR or the club waiver; under
 * the waiver, the jump-count tier. The waiver is a student policy (the sign's
 * table is headed "Students"), so it is not offered beside Licensed. */
const render = (profile: WindProfileId) =>
  renderToStaticMarkup(createElement(ProfileSelector, { profile, onChange: () => {} }));
const active = (html: string) => [...html.matchAll(/<button class="active">([^<]+)<\/button>/g)].map((m) => m[1]);
const groups = (html: string) => [...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);

describe('the wind-limit profile selector', () => {
  it('offers Student and Licensed at the top, and no waiver beside them', () => {
    const html = render('licensed');
    expect(groups(html)).toEqual(['Jumper class']);
    expect(active(html)).toEqual(['Licensed']);
    expect(html).not.toContain('LSPC waiver');
  });

  it('under Student, offers the USPA BSR limits or the waiver, BSR with no tiers', () => {
    const html = render('student');
    expect(groups(html)).toEqual(['Jumper class', 'Student wind limits']);
    expect(active(html)).toEqual(['Student', 'USPA BSR']);
    expect(html).not.toContain(WAIVER_TIERS[0].label);
  });

  it('on a waiver tier, shows Student, the waiver and that tier as chosen', () => {
    const tier = WAIVER_TIERS[2];
    const html = render(tier.id);
    expect(groups(html)).toEqual(['Jumper class', 'Student wind limits', 'Waiver experience tier']);
    expect(active(html)).toEqual(['Student', 'LSPC waiver', tier.label]);
    for (const t of WAIVER_TIERS) expect(html).toContain(`>${t.label}</button>`);
  });
});
