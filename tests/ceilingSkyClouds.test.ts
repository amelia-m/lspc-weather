import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { foldCount, folded, inView } from './support/fold';
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
  // A fixed clock: 2026-11-18 20:00Z, 2 PM Central; three hours from it.
  const NOW = Date.UTC(2026, 10, 18, 20);
  const hourly = [0, 1, 2].map((i) => ({
    time: NOW + i * 3_600_000,
    skyCoverPct: 55,
    ceilingFtAgl: 4500,
    ceilingForecast: true,
    precipProbPct: 0,
  })) as unknown as HourlyPoint[];
  const om: OpenMeteoCloudHour[] = [
    { time: NOW, totalPct: 40, lowPct: 10, midPct: 30, highPct: 5 },
    // NOW + 1 h not served; NOW + 2 h served.
    { time: NOW + 2 * 3_600_000, totalPct: 85, lowPct: 60, midPct: 40, highPct: 20 },
  ];
  const card = (omClouds: OpenMeteoCloudHour[] | null): string =>
    renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly, omClouds, now: NOW }));

  it('prints Open-Meteo’s figure in its own row at the slot’s hour, and every hour in the hourly detail, matched by time, and credits it', () => {
    const html = card(om);
    // The table's OM row: the 2 PM slot holds NOW's figure; the other slots are blank.
    const omRow = html.slice(html.indexOf('>OM %</th>'), html.indexOf('</tr>', html.indexOf('>OM %</th>')));
    expect([...omRow.matchAll(/<td class="muted(?: night)?">([^<]*)<\/td>/g)].map((m) => m[1]).filter(Boolean)).toEqual(['40']);
    // The hourly detail: 40, blank, 85.
    const detail = html.slice(html.indexOf('csd-hourly-table'));
    const omDetail = detail.slice(detail.indexOf('>OM %</th>'), detail.indexOf('</tr>', detail.indexOf('>OM %</th>')));
    expect([...omDetail.matchAll(/<td class="muted(?: night)?">([^<]*)<\/td>/g)].map((m) => m[1])).toEqual(['40', '', '85']);
    expect(html).toContain('Open-Meteo’s cloud cover');
    expect(html).toContain('open-meteo.com');
  });

  it('names the bands in each hour’s tooltip', () => {
    expect(card(om)).toContain('Open-Meteo 40% cover (low 10%, mid 30%, high 5%)');
  });

  it('shows the NWS forecast alone when Open-Meteo did not answer', () => {
    const html = card(null);
    expect(html).not.toContain('>OM %</th>');
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
    // Behind the card's one fold, closed (2026-11-25: comparisons of data
    // sources are hidden); the line that stood above it repeated its
    // figures and is gone, so nothing of the comparison shows untapped.
    expect(foldCount(html)).toBe(1);
    expect(html).not.toContain('sky-compare-brief');
    expect(inView(html)).not.toContain('sky-compare');
    expect(inView(html)).not.toContain(`${c.ceilingHours.nws}%`);
    expect(folded(html)).not.toMatch(/<details class="nerd-stats" open/);
    const full = /<p class="muted small sky-compare">[\s\S]*?<\/p>/.exec(folded(html))?.[0] ?? '';
    expect(text(/<p class="muted small sky-compare">[\s\S]*?<\/p>/)).toContain(`compared with KPMV, ${c.period}.`);
    expect(full).toContain(`at or above ${CEILING_EIGHTHS}/8`);
    expect(full).toContain('docs/cloud-cover-sources.md');
    expect(full).toContain(`href="${CITATIONS.faaSkyCover.url}"`);
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
describe('the Ceiling & sky day tables', () => {
  const NOW = Date.UTC(2026, 10, 18, 20);
  const covers = [0, 10, 30, 60, 95, 100, 20, 40, 70, 90, 5, 50];
  const hourly = covers.map((pct, i) => ({
    time: NOW + i * 3_600_000,
    skyCoverPct: pct,
    ceilingFtAgl: pct >= 50 ? (pct === 100 ? 11_000 : 4500) : null,
    // Inside the ceiling forecast, so a null ceiling is NWS's "no ceiling".
    ceilingForecast: true,
    visibilityForecast: true,
    precipProbPct: 0,
  })) as unknown as HourlyPoint[];
  const om: OpenMeteoCloudHour[] = hourly.map((h) => ({ time: h.time, totalPct: 2, lowPct: 1, midPct: 1, highPct: 0 }));
  const html = renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly, omClouds: om, now: NOW }));

  it('draws every NWS bar alike, whatever the cover: its height is its only mark', () => {
    const bars = [...html.matchAll(/<i class="csd-bar" style="height:([\d.]+)%"><\/i>/g)].map((m) => Number(m[1]));
    // Wednesday's slots from the hour under way: 2 PM (the noon slot's
    // hour under way), 3 PM, 6 PM and 9 PM, covers 0, 10, 95 and 40; then
    // Thursday's midnight slot, 5.
    expect(bars).toEqual([0, 10, 95, 40, 5]);
    expect(html).not.toMatch(/csd-bar [a-z-]*(few|scattered|broken|overcast|clear|warn)/);
  });

  it('prints the figures the bars stand for, and a ceiling of 10,000 ft or more in whole thousands', () => {
    const row = (label: string) => {
      const at = html.indexOf(`>${label}</th>`);
      return [...html.slice(at, html.indexOf('</tr>', at)).matchAll(/<td[^>]*>(?:<span[^>]*>.*?<span class="csd-fig">)?([^<]*)/g)].map((m) => m[1]);
    };
    // Wednesday's table (the first): 2 PM, 3 PM, 6 PM, 9 PM.
    expect(row('NWS ceil').filter(Boolean)).toEqual(['no', 'no', '4.5', 'no']);
    // The hourly detail has every hour: 11,000 ft prints "11".
    const detail = html.slice(html.indexOf('csd-hourly-table'));
    expect(detail).toContain('>11</td>');
    expect(detail).toContain('>4.5</td>');
    expect(detail).toContain('>no</td>');
  });

  it('labels every slot with its hour and leaves the slots before now blank, not dashed', () => {
    const head = html.slice(html.indexOf('<tr class="csd-time">'), html.indexOf('</tr>', html.indexOf('<tr class="csd-time">')));
    const labels = [...head.matchAll(/<th class="(?:night)?" scope="col">(?:<span class="csd-tl">([^<]*)<\/span><span class="csd-ts">([^<]*)<\/span>)?<\/th>/g)].map((m) => [m[1] ?? '', m[2] ?? '']);
    // The long form, and the short one a phone under 360 px shows instead (the stylesheet picks).
    expect(labels.map((l) => l[0])).toEqual(['', '', '', '', '2pm', '3pm', '6pm', '9pm']);
    expect(labels.map((l) => l[1])).toEqual(['', '', '', '', '2p', '3p', '6p', '9p']);
    // No dash anywhere in the tables (the head's "—" for no observation is another thing).
    expect(html.slice(html.indexOf('class="csd-day"'))).not.toContain('—');
  });

  it('colours the NWS bars from one rule in the stylesheet, not by amount', async () => {
    // The colour lives in CSS, so the markup alone cannot show it: no rule
    // may pick a sky bar's colour by an attribute or its height.
    // Read from disk (as sunArc.test.ts does): Vitest hands a CSS import
    // over as an empty string.
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync: (p: string, e: string) => string };
    const css = fs.readFileSync(decodeURIComponent(new URL('../src/styles/app.css', import.meta.url).pathname), 'utf8');
    expect(css).not.toMatch(/csd-bar\[/);
    expect(css).toMatch(/\.csd-bar \{[^}]*background: var\(--sky-cover\)/);
  });
});
