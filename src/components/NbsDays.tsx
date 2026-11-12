import type { NbmForecast, NbmHour } from '../domain/types';
import { round } from '../domain/units';
import { AUTOMATED_TOP_FT } from '../domain/stationPairs';
import { fmtShortHour, fmtTime, fmtWeekday, localDateKey } from './format';

/**
 * The NBM's three-hourly bulletin (NBS) as stacked day blocks: one block
 * per local day, eight three-hour slots across it, so a phone shows a
 * whole day across the card and three days down it with nothing to scroll
 * sideways (the 'days' layout, forecastReach.ts; the maintainer's ask of
 * 2026-11-12 for something better than a second scrolling strip).
 *
 * Each block: the hours along the top, the sky cover as a bar and a figure
 * in each slot, then the cloud heights drawn as a band (the lowest cloud
 * base as a filled area, the ceiling as a tick, both on one scale from the
 * ground to 12,000 ft, the ceilometer's reach at KPMV) and printed under it
 * in thousands of feet, as the hourly strip prints them. The band is a
 * picture of the printed figures and adds none: a slot with no layer draws
 * nothing and prints "no"; a slot the bulletin gives no figure for prints a
 * dash. The bulletin is a second forecast beside the NWS one, in the muted
 * colour the card's second forecasts use; nothing here flags or colours a
 * figure as a warning (the rule, CLAUDE.md).
 *
 * Slots are by local hour (floor(hour / 3)), so the days line up down the
 * card whatever hour the bulletin starts at: its first day begins partway
 * through and its leading slots are empty.
 */
const SLOTS = 8;
const BAND_H = 40;
const BAND_W = 100;
const TOP_FT = AUTOMATED_TOP_FT;

const fmtK = (ft: number): string => (ft / 1000 < 10 ? String(Math.round(ft / 100) / 10) : String(Math.round(ft / 1000)));
const localHour = (ms: number, timeZone: string): number =>
  Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(ms));

/** The band's y for a height: the ground at the bottom, 12,000 ft and
 *  above at the top. */
const yOf = (ft: number): number => BAND_H - (Math.min(ft, TOP_FT) / TOP_FT) * BAND_H;

/** The heights band of one day: the base as a filled step area across the
 *  slots that have one, the ceiling as a tick where there is one. SVG in
 *  the slots' own coordinates (one slot = BAND_W / 8 wide), scaled to the
 *  block's width by the stylesheet. */
function band(slots: (NbmHour | null)[]): JSX.Element {
  const w = BAND_W / SLOTS;
  const parts: JSX.Element[] = [];
  slots.forEach((h, i) => {
    const x = i * w;
    const base = h?.lowestBaseFtAgl;
    if (base != null) {
      const y = yOf(base);
      parts.push(<rect key={`b${i}`} className="nbs-base-area" x={x + 1} y={y} width={w - 2} height={BAND_H - y} />);
    }
    const ceil = h?.ceilingFtAgl;
    if (ceil != null) {
      const y = yOf(ceil);
      parts.push(<line key={`c${i}`} className="nbs-ceil-tick" x1={x + 1} x2={x + w - 1} y1={y} y2={y} />);
    }
  });
  return (
    <svg className="nbs-band" viewBox={`0 0 ${BAND_W} ${BAND_H}`} preserveAspectRatio="none" aria-hidden="true">
      <line className="nbs-band-grid" x1="0" x2={BAND_W} y1={yOf(TOP_FT / 2)} y2={yOf(TOP_FT / 2)} />
      {parts}
    </svg>
  );
}

export function NbsDays({ nbs, timeZone }: { nbs: NbmForecast; timeZone: string }): JSX.Element {
  // The bulletin's columns by local day, each day's by slot.
  const days = new Map<string, (NbmHour | null)[]>();
  for (const h of nbs.hours) {
    const key = localDateKey(h.time);
    const slots = days.get(key) ?? Array.from({ length: SLOTS }, () => null);
    slots[Math.floor(localHour(h.time, timeZone) / 3)] = h;
    days.set(key, slots);
  }
  const cycle = `${String(new Date(nbs.cycleMs).getUTCHours()).padStart(2, '0')}Z`;
  return (
    <div className="nbs-days">
      <p className="small nbs-days-title">
        Next three days, every 3 h: the NBM&rsquo;s three-hourly bulletin ({cycle} cycle), a second forecast
      </p>
      {[...days.entries()].map(([key, slots]) => {
        const first = slots.find((s) => s != null);
        return (
          <div key={key} className="nbs-day">
            <div className="nbs-day-title">
              {first ? fmtWeekday(first.time) : key}
              <span className="muted"> {first ? new Date(first.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone }) : ''}</span>
            </div>
            <div className="nbs-grid">
              <span className="nbs-unit">&nbsp;</span>
              {slots.map((h, i) => (
                <span key={`t${i}`} className="nbs-hour">
                  {h ? fmtShortHour(h.time) : ' '}
                </span>
              ))}
              <span className="nbs-unit">sky %</span>
              {slots.map((h, i) => (
                <span key={`s${i}`} className="nbs-slot" title={h ? describe(h) : undefined}>
                  <span className="nbs-pct">{h?.skyCoverPct != null ? round(h.skyCoverPct) : h ? '—' : ' '}</span>
                  <span className="nbs-track">
                    {h?.skyCoverPct != null && <span className="nbs-bar" style={{ height: `${h.skyCoverPct}%` }} />}
                  </span>
                </span>
              ))}
              <span className="nbs-unit nbs-unit-band">
                <span>12k</span>
                <span>0</span>
              </span>
              <span className="nbs-band-cell">{band(slots)}</span>
              <span className="nbs-unit">ceil</span>
              {slots.map((h, i) => (
                <span key={`c${i}`} className="nbs-fig" title={h ? (h.ceilingFtAgl == null ? (h.ceilingFtAgl === null ? 'NBM: no ceiling' : 'No NBM ceiling figure') : `NBM ceiling ${h.ceilingFtAgl.toLocaleString()} ft AGL`) : undefined}>
                  {h ? (h.ceilingFtAgl === undefined ? '—' : h.ceilingFtAgl === null ? 'no' : fmtK(h.ceilingFtAgl)) : ' '}
                </span>
              ))}
              <span className="nbs-unit">base</span>
              {slots.map((h, i) => (
                <span key={`b${i}`} className="nbs-fig muted" title={h ? (h.lowestBaseFtAgl == null ? (h.lowestBaseFtAgl === null ? 'NBM: no cloud layer' : 'No NBM base figure') : `NBM lowest cloud base ${h.lowestBaseFtAgl.toLocaleString()} ft AGL`) : undefined}>
                  {h ? (h.lowestBaseFtAgl === undefined ? '—' : h.lowestBaseFtAgl === null ? 'no' : fmtK(h.lowestBaseFtAgl)) : ' '}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      <p className="muted small nbs-days-key">
        Sky % and bar = the bulletin&rsquo;s sky cover. The band is its cloud heights, ground to 12,000 ft: the
        shaded area the lowest cloud base (any layer, a few or scattered one included), the tick a ceiling.
        Under it the same in thousands of ft AGL; &ldquo;no&rdquo; = no layer, or no ceiling.
      </p>
    </div>
  );
}

function describe(h: NbmHour): string {
  const parts = [fmtTime(h.time)];
  if (h.skyCoverPct != null) parts.push(`NBM ${round(h.skyCoverPct)}% cover`);
  if (h.ceilingFtAgl != null) parts.push(`ceiling ${h.ceilingFtAgl.toLocaleString()} ft`);
  else if (h.ceilingFtAgl === null) parts.push('no ceiling');
  if (h.lowestBaseFtAgl != null) parts.push(`base ${h.lowestBaseFtAgl.toLocaleString()} ft`);
  else if (h.lowestBaseFtAgl === null) parts.push('no layer');
  return parts.join(' · ');
}
