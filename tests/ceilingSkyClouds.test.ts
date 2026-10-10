import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CeilingSkyPanel } from '../src/components/CeilingSkyPanel';
import { CLOUD_COMPARISON } from '../src/config/cloudComparison';
import { CITATIONS } from '../src/config/thresholds';

/** The records the card's comparison figures come from. */
const ARCHIVE = 'data/parity/cloud-cover-2026-04-01-to-2026-10-09.jsonl.gz';
import { CEILING_EIGHTHS, NWS_ISSUANCES, OM_ROWS, parseCloudCoverLines, summarizeCloudCover } from '../src/domain/cloudCoverSources';
import { normalizeOpenMeteoClouds, openMeteoHourlyVariables, type RawOpenMeteo } from '../src/domain/normalize';
import type { HourlyPoint, OpenMeteoCloudHour } from '../src/domain/types';

/* Open-Meteo's cloud cover rides on the winds request and sits beside the
 * NWS sky cover on the Ceiling & sky card: a second forecast, never a
 * ceiling. */
describe('Open-Meteo cloud cover', () => {
  it('is asked for with the winds: total and the three bands', () => {
    const vars = openMeteoHourlyVariables();
    for (const v of ['cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high']) expect(vars).toContain(v);
  });

  it('normalises each hour, null where a value is missing', () => {
    const raw = {
      hourly: {
        time: ['2026-10-08T12:00:00Z', '2026-10-08T13:00:00Z'],
        cloud_cover: [40, null],
        cloud_cover_low: [10, 20],
        cloud_cover_mid: [30, 30],
        cloud_cover_high: [5, 5],
      },
    } as unknown as RawOpenMeteo;
    expect(normalizeOpenMeteoClouds(raw)).toEqual([
      { time: Date.parse('2026-10-08T12:00:00Z'), totalPct: 40, lowPct: 10, midPct: 30, highPct: 5 },
      { time: Date.parse('2026-10-08T13:00:00Z'), totalPct: null, lowPct: 20, midPct: 30, highPct: 5 },
    ]);
  });
});

describe('the Ceiling & sky card with Open-Meteo beside NWS', () => {
  const t0 = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
  const hourly = [0, 1, 2].map((i) => ({
    time: t0 + i * 3_600_000,
    skyCoverPct: 55,
    ceilingFtAgl: 4500,
    precipProbPct: 0,
  })) as unknown as HourlyPoint[];
  const om: OpenMeteoCloudHour[] = [
    { time: t0, totalPct: 40, lowPct: 10, midPct: 30, highPct: 5 },
    // t0 + 1 h not served; t0 + 2 h served.
    { time: t0 + 2 * 3_600_000, totalPct: 85, lowPct: 60, midPct: 40, highPct: 20 },
  ];
  const card = (omClouds: OpenMeteoCloudHour[] | null): string =>
    renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly, omClouds }));

  it('puts each hour’s Open-Meteo figure under the NWS one, matched by time, and credits it', () => {
    const html = card(om);
    const figures = [...html.matchAll(/<span class="sky-pct om-pct">([^<]*)/g)].map((m) => m[1]);
    // The axis column's unit first, then one per hour.
    expect(figures).toEqual(['%', '40', '—', '85']);
    expect(html.match(/class="sky-bar om-bar"/g)).toHaveLength(3);
    expect(html).toContain('Open-Meteo’s cloud');
    expect(html).toContain('says nothing about a cloud base');
    expect(html).toContain('open-meteo.com');
  });

  it('names the bands in each hour’s tooltip', () => {
    expect(card(om)).toContain('Open-Meteo 40% cover (low 10%, mid 30%, high 5%)');
  });

  it('shows the NWS forecast alone when Open-Meteo did not answer', () => {
    const html = card(null);
    expect(html).not.toContain('om-bar');
    expect(html).not.toContain('om-pct');
    expect(html).not.toContain('Open-Meteo');
    expect(html).not.toContain('sky-compare');
  });

  /* The note quotes the six-month comparison. Every figure comes from
   * CLOUD_COMPARISON, and each is worked out again here from the archived
   * records, so a rerun that moves one fails this test until the card
   * quotes the new figure. */
  it('quotes the comparison, every figure worked out again from the archived records', async () => {
    const html = card(om);
    const text = (re: RegExp) => (re.exec(html)?.[0] ?? '').replace(/<[^>]+>/g, '');
    const figures = (t: string) => [...t.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));
    const c = CLOUD_COMPARISON;
    // One line shows; the full comparison is collapsed under it.
    const brief = text(/<p class="muted small sky-compare-brief">[\s\S]*?<\/p>/);
    expect(brief).toContain(c.period);
    expect(brief).toContain(`at ${CEILING_EIGHTHS}/8 cover`);
    expect(figures(brief)).toEqual([c.ceilingHours.nws, c.ceilingHours.omStart, c.noCeilingHours.nws, c.noCeilingHours.omStart, c.noCeilingHours.omDayAhead]);
    expect(/<p class="muted small sky-compare-brief">[\s\S]*?<\/p>/.exec(html)?.[0]).toContain(`href="${CITATIONS.faaSkyCover.url}"`);
    expect(html).toMatch(/<details class="sky-compare"><summary/);
    expect(html).not.toMatch(/<details class="sky-compare" open/);
    const full = /<details class="sky-compare">[\s\S]*?<\/details>/.exec(html)?.[0] ?? '';
    expect(full).toContain('docs/cloud-cover-sources.md');
    // Every figure, in the order the full note gives them, after the cut itself.
    expect(figures(full.replace(/<[^>]+>/g, ''))).toEqual([
      62.5,
      c.ceilingHours.nws, c.ceilingHours.omStart, c.ceilingHours.omDayAhead,
      c.noCeilingHours.nws, c.noCeilingHours.omStart, c.noCeilingHours.omDayAhead,
      c.noCeilingHours.omLowStart,
      0, 100, c.exactlyNoneOrAll.nws, c.exactlyNoneOrAll.omStart,
    ]);

    // Read as views.test.ts reads App.tsx: the typecheck has no Node types.
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync: (p: string) => Uint8Array };
    const zlib = (await import(/* @vite-ignore */ 'node:' + 'zlib')) as { gunzipSync: (b: Uint8Array) => Uint8Array };
    const path = decodeURIComponent(new URL(`../${ARCHIVE}`, import.meta.url).pathname);
    const records = parseCloudCoverLines(new TextDecoder().decode(zlib.gunzipSync(fs.readFileSync(path))));
    const s = summarizeCloudCover(records);
    const row = (label: string) => s.vs.find((x) => x.source === label)?.ceiling;
    const pct = (a: number, b: number) => Math.round((100 * a) / b);
    const withCeiling = (label: string) => {
      const r = row(label)!;
      return pct(r.bothYes, r.bothYes + r.reportedOnly);
    };
    const withoutCeiling = (label: string) => {
      const r = row(label)!;
      return pct(r.forecastOnly, r.forecastOnly + r.neither);
    };
    expect(c.ceilingHours).toEqual({
      nws: withCeiling(NWS_ISSUANCES[0].label),
      omStart: withCeiling(OM_ROWS.startTotal),
      omDayAhead: withCeiling(OM_ROWS.dayBeforeTotal),
    });
    expect(c.noCeilingHours).toEqual({
      nws: withoutCeiling(NWS_ISSUANCES[0].label),
      omStart: withoutCeiling(OM_ROWS.startTotal),
      omDayAhead: withoutCeiling(OM_ROWS.dayBeforeTotal),
      omLowStart: withoutCeiling(OM_ROWS.startLow),
    });
    const edges = (label: string) => {
      const v = s.vs.find((x) => x.source === label)!;
      return pct(v.noneOrAll, v.n);
    };
    expect(c.exactlyNoneOrAll).toEqual({ nws: edges(NWS_ISSUANCES[0].label), omStart: edges(OM_ROWS.startTotal) });
    const month = (iso: string | null) =>
      new Date(iso as string).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).split(' ');
    const [m0] = month(s.firstHour);
    const [m1, y1] = month(s.lastHour);
    expect(c.period).toBe(`${m0} to ${m1} ${y1}`);
  }, 30_000);
});

/* The NWS bars show an amount, not a category: one colour from clear to
 * overcast (the few/scattered/broken/overcast colours read as a verdict and
 * carried no key). Twelve hours fit the card with a time under every third,
 * and Open-Meteo's bar sits in an outlined track so a near-clear hour still
 * shows. */
describe('the Ceiling & sky timeline', () => {
  const t0 = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
  const covers = [0, 10, 30, 60, 95, 100, 20, 40, 70, 90, 5, 50];
  const hourly = covers.map((pct, i) => ({
    time: t0 + i * 3_600_000,
    skyCoverPct: pct,
    ceilingFtAgl: pct >= 50 ? 4500 : null,
    precipProbPct: 0,
  })) as unknown as HourlyPoint[];
  const om: OpenMeteoCloudHour[] = hourly.map((h) => ({ time: h.time, totalPct: 2, lowPct: 1, midPct: 1, highPct: 0 }));
  const html = renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly, omClouds: om }));

  it('draws every NWS bar alike, whatever the cover', () => {
    // Overcast and clear hours carry the same markup apart from their height.
    expect(html).not.toContain('data-cover');
    const bars = [...html.matchAll(/<div class="sky-bar" style="height:([\d.]+)%"><\/div>/g)].map((m) => Number(m[1]));
    expect(bars).toEqual(covers);
  });

  it('puts each Open-Meteo bar in a track of its own, even at 2%', () => {
    expect(html.match(/<div class="om-track"><div class="sky-bar om-bar" style="height:2%"><\/div><\/div>/g)).toHaveLength(12);
  });

  it('labels every third hour and leaves the rest blank', () => {
    const times = [...html.matchAll(/<span class="sky-time">([^<]*)<\/span>/g)].map((m) => m[1]);
    // The axis column's blank first, then twelve hours.
    expect(times).toHaveLength(13);
    const hours = times.slice(1);
    hours.forEach((t, i) => (i % 3 === 0 ? expect(t).toMatch(/^\d{1,2}(am|pm)$/) : expect(t).toBe(' ')));
  });

  it('says “no” for an hour with no ceiling, apart from the “—” of a figure not reported', () => {
    const ceil = [...html.matchAll(/<span class="sky-ceil"[^>]*>([^<]*)/g)].map((m) => m[1]).slice(1);
    expect(ceil[0]).toBe('no');
    expect(ceil[3]).toBe('4.5');
  });

  it('reads every figure to a screen reader with its unit, which the hidden axis column prints', () => {
    expect(html).toContain('60<span class="sr-only">% sky cover, NWS</span>');
    expect(html).toContain('2<span class="sr-only">% cloud cover, Open-Meteo</span>');
    expect(html).toContain('4.5<span class="sr-only"> thousand ft ceiling</span>');
    expect(html).toContain('no<span class="sr-only"> ceiling</span>');
  });

  it('prints a ceiling of 10,000 ft or more in whole thousands, to fit a phone column', () => {
    const high = renderToStaticMarkup(
      createElement(CeilingSkyPanel, {
        current: null,
        hourly: [{ time: t0, skyCoverPct: 70, ceilingFtAgl: 10_600, precipProbPct: 0 }] as unknown as HourlyPoint[],
        omClouds: null,
      }),
    );
    expect(high).toContain('11<span class="sr-only"> thousand ft ceiling</span>');
  });

  it('colours the NWS bars from one rule in the stylesheet, not by amount', async () => {
    // The colour lives in CSS, so the markup alone cannot show it: no rule
    // may pick a sky bar's colour by an attribute or its height.
    // Read from disk (as sunArc.test.ts does): Vitest hands a CSS import
    // over as an empty string.
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync: (p: string, e: string) => string };
    const css = fs.readFileSync(decodeURIComponent(new URL('../src/styles/app.css', import.meta.url).pathname), 'utf8');
    expect(css).not.toMatch(/sky-bar\[/);
    expect(css).toMatch(/\.ceiling-timeline \.sky-bar:not\(\.om-bar\) \{[^}]*background: var\(--sky-cover\)/);
  });
});
