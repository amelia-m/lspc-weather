import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  LSPC_STUDENT_NAVIGATOR_SIZES,
  NAVIGATOR_CHART,
  STUDENT_RIG_WEIGHT_LB,
} from '../src/config/canopies';
import { againstChart, exitWeightLb, sizesWithin, wingLoading } from '../src/domain/wingLoading';
import { WingLoadingPanel } from '../src/components/WingLoadingPanel';
import { CITATIONS } from '../src/config/thresholds';
import { withoutGlossaryLinks } from './support/glossaryLinks';

const size = (a: number) => NAVIGATOR_CHART.find((s) => s.areaSqFt === a)!;

describe('the Navigator chart as transcribed', () => {
  it('carries PD’s Student and Max figures for every size, in pounds and kilograms', () => {
    // TABLE-0122 Rev.A, as the maintainer transcribed it on 2026-10-08.
    expect(NAVIGATOR_CHART.map((s) => [s.areaSqFt, s.maxExit.student])).toEqual([
      [200, [140, 64]],
      [220, [176, 80]],
      [240, [216, 98]],
      [260, [255, 116]],
      [280, [270, 123]],
      [300, [290, 132]],
    ]);
    expect(size(260).maxExit.intermediate).toEqual([280, 127]);
    expect(size(300).maxExit.max).toEqual([350, 159]);
  });

  it('offers the club’s sizes, and a 32 lb rig, per the maintainer', () => {
    expect(LSPC_STUDENT_NAVIGATOR_SIZES).toEqual([200, 220, 260, 280]);
    expect(STUDENT_RIG_WEIGHT_LB).toBe(32);
    for (const a of LSPC_STUDENT_NAVIGATOR_SIZES) expect(size(a)).toBeDefined();
  });
});

describe('exit weight and wing loading', () => {
  it('adds gear to body weight and divides by area', () => {
    expect(exitWeightLb(180, 32)).toBe(212);
    expect(wingLoading(212, 260)).toBeCloseTo(0.815, 3);
  });

  it('gives the margin to PD’s figure, either side of it', () => {
    expect(againstChart(212, size(260), 'student')).toEqual({ maxLb: 255, marginLb: 43 });
    expect(againstChart(212, size(200), 'student')).toEqual({ maxLb: 140, marginLb: -72 });
  });

  it('lists the offered sizes whose Student figure the exit weight is within, at the figure inclusive', () => {
    expect(sizesWithin(212, NAVIGATOR_CHART, LSPC_STUDENT_NAVIGATOR_SIZES, 'student')).toEqual([260, 280]);
    expect(sizesWithin(176, NAVIGATOR_CHART, LSPC_STUDENT_NAVIGATOR_SIZES, 'student')).toEqual([220, 260, 280]);
    // 240 is on the chart but not offered.
    expect(sizesWithin(216, NAVIGATOR_CHART, LSPC_STUDENT_NAVIGATOR_SIZES, 'student')).toEqual([260, 280]);
    expect(sizesWithin(300, NAVIGATOR_CHART, LSPC_STUDENT_NAVIGATOR_SIZES, 'student')).toEqual([]);
  });
});

describe('the exit weight & wing loading card', () => {
  it('starts with no body weight, and works nothing out until one is entered', () => {
    const html = renderToStaticMarkup(createElement(WingLoadingPanel));
    expect(html).toContain('placeholder="enter" value=""');
    expect(withoutGlossaryLinks(html)).toContain('Enter a body weight to work out exit weight and wing loading.');
    expect(html).not.toContain('Wing loading</dt>');
    expect(html).toContain(`value="${STUDENT_RIG_WEIGHT_LB}"`);
  });

  it('states the comparison with PD’s figure, the sizes at or above it, and leaves the call to the instructor', () => {
    const html = renderToStaticMarkup(createElement(WingLoadingPanel, { initialBodyLb: 180 }));
    // Navigator 280 by default.
    expect(html).toContain('<dt>Exit weight</dt><dd>212 lb (96 kg)</dd>');
    expect(html).toContain('<dt>Wing loading</dt><dd>0.76 lb/sq ft</dd>');
    expect(html).toContain('<dt>PD Student max, 280</dt><dd>270 lb (123 kg)</dd>');
    expect(html).toContain('<dt>Against it</dt><dd>58 lb under</dd>');
    expect(html).toContain('<dt>Sizes whose PD Student max is at or above this weight</dt><dd class="wl-list">260, 280</dd>');
    expect(html).toContain('the comparison above uses the Student figure only');
    expect(html).toContain(`href="${CITATIONS.pdWingLoadingGuide.url}"`);
    expect(html).toContain('which canopy a student jumps is the instructor’s call.');
    expect(html).toContain(`href="${CITATIONS.pdNavigator.url}"`);
    // A comparison, not a verdict.
    expect(html).not.toMatch(/\b(safe|unsafe|OK|approved|cleared)\b/);
  });

  it('rounds the exit weight before comparing, so the figures shown never disagree', () => {
    // 238.4 + 32 = 270.4: shown as 270, which is PD's 280 Student figure.
    const html = renderToStaticMarkup(createElement(WingLoadingPanel, { initialBodyLb: 238.4 }));
    expect(html).toContain('<dt>Exit weight</dt><dd>270 lb (122 kg)</dd>');
    expect(html).toContain('<dt>Against it</dt><dd>at it</dd>');
    expect(html).toContain('<dt>Sizes whose PD Student max is at or above this weight</dt><dd class="wl-list">280</dd>');
  });

  it('says which entry to check rather than asking again for a weight it has', () => {
    expect(renderToStaticMarkup(createElement(WingLoadingPanel, { initialBodyLb: 5000 }))).toContain(
      'Check the body weight: a number of pounds above 0 and up to 500.',
    );
    expect(renderToStaticMarkup(createElement(WingLoadingPanel, { initialBodyLb: -5 }))).toContain('Check the body weight');
  });
});
