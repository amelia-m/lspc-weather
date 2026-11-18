import type { DayBlock, DaySlot } from '../domain/skyDays';
import { SLOTS_PER_DAY } from '../domain/skyDays';
import type { HourlyPoint, NbmHour, OpenMeteoCloudHour } from '../domain/types';
import { round } from '../domain/units';
import { AUTOMATED_TOP_FT } from '../domain/stationPairs';
import { fmtShortHour, fmtTime, fmtWeekday } from './format';

/**
 * The Ceiling & sky card's body: one table per local day, eight three-hour
 * columns, the rows grouped by source, and the cloud heights drawn as a
 * band the way up a jumper sees them (the "day table" and "cloud profile"
 * mock-ups of docs/ceiling-sky-layout-review.md, built together at the
 * maintainer's word of 2026-11-18). The blocks come from
 * src/domain/skyDays.ts; this only draws them.
 *
 * Rows: the time of each slot; the NWS forecast's sky cover as a bar and
 * a figure; Open-Meteo's cloud cover figure where it answered; the NBM
 * three-hourly bulletin's sky cover the same way; the heights band; then
 * the heights printed, the NWS ceiling, the NBM ceiling and the NBM base,
 * in thousands of feet, "no" for none. The band: ground at the bottom,
 * 12,000 ft (the ceilometer's reach at KPMV) at the top, the NBM base a
 * short bar at its height, the NBM ceiling a fill from it up (cloud above
 * it), the NWS ceiling a tick while that forecast runs, night slots shaded
 * behind. It is a picture of the printed rows and adds no figure; an
 * empty band under a low sky-cover row is the clear day it is. A cell
 * with nothing in it is blank, not a dash: a dash read as missing data.
 * The day's NWS hours open under the table ("hourly"), today's open.
 *
 * Every bar is one colour whatever its amount, every figure one colour
 * per source, and nothing here is a warning or a verdict (CLAUDE.md).
 */
const BAND_W = 800;
const BAND_H = 120;
const TOP_FT = AUTOMATED_TOP_FT;
const yOf = (ft: number): number => BAND_H - (Math.min(ft, TOP_FT) / TOP_FT) * BAND_H;

/** A height in thousands of feet: a decimal under 10,000 ("4.5"), whole
 *  thousands from there ("11"), to fit a column a phone makes 30 px. */
const fmtK = (ft: number): string => (ft < 10_000 ? String(Math.round(ft / 100) / 10) : String(Math.round(ft / 1000)));

/** A height figure's text: the figure, "no" for none, blank for not given. */
const heightText = (ft: number | null | undefined): string => (ft === undefined ? '' : ft === null ? 'no' : fmtK(ft));

function nwsCeilingText(h: HourlyPoint | null): string {
  if (!h || !h.ceilingForecast) return '';
  return h.ceilingFtAgl != null ? fmtK(h.ceilingFtAgl) : 'no';
}

function Band({ slots }: { slots: DaySlot[] }): JSX.Element {
  const w = BAND_W / SLOTS_PER_DAY;
  const night: JSX.Element[] = [];
  const marks: JSX.Element[] = [];
  slots.forEach((s, i) => {
    const x = i * w;
    if (s.night) night.push(<rect key={`n${i}`} className="csd-night" x={x} y={0} width={w} height={BAND_H} />);
    const ceil = s.nbs?.ceilingFtAgl;
    if (ceil != null) {
      const y = yOf(ceil);
      marks.push(<rect key={`c${i}`} className="csd-oc" x={x + 2} y={0} width={w - 4} height={Math.max(0, y)} />);
    }
    const base = baseOf(s);
    if (base != null) {
      const y = Math.min(BAND_H - 4, Math.max(0, yOf(base) - 2));
      marks.push(<rect key={`b${i}`} className="csd-base" x={x + 2} y={y} width={w - 4} height={4} />);
    }
    if (s.nws?.ceilingForecast && s.nws.ceilingFtAgl != null) {
      const y = yOf(s.nws.ceilingFtAgl);
      marks.push(<line key={`w${i}`} className="csd-nws-ceil" x1={x + 2} x2={x + w - 2} y1={y} y2={y} />);
    }
  });
  return (
    <svg className="csd-band" viewBox={`0 0 ${BAND_W} ${BAND_H}`} preserveAspectRatio="none" aria-hidden="true">
      {night}
      {[3000, 6000, 9000].map((ft) => (
        <line key={ft} className="csd-grid" x1={0} x2={BAND_W} y1={yOf(ft)} y2={yOf(ft)} />
      ))}
      {marks}
    </svg>
  );
}

function slotTitle(s: DaySlot): string | undefined {
  if (s.time == null) return undefined;
  const parts = [fmtTime(s.time)];
  if (s.nws?.skyCoverPct != null) parts.push(`NWS ${round(s.nws.skyCoverPct)}% cover`);
  if (s.om?.totalPct != null) parts.push(`Open-Meteo ${round(s.om.totalPct)}% cover`);
  if (s.nbs?.skyCoverPct != null) parts.push(`NBM ${round(s.nbs.skyCoverPct)}% cover`);
  if (s.nws?.ceilingForecast) parts.push(s.nws.ceilingFtAgl != null ? `NWS ceiling ${s.nws.ceilingFtAgl.toLocaleString()} ft` : 'NWS: no ceiling');
  if (s.nbs?.ceilingFtAgl !== undefined) parts.push(s.nbs?.ceilingFtAgl != null ? `NBM ceiling ${s.nbs.ceilingFtAgl.toLocaleString()} ft` : 'NBM: no ceiling');
  const base = baseOf(s);
  if (base !== undefined) parts.push(base != null ? `NBM base ${base.toLocaleString()} ft` : 'NBM: no layer');
  if (s.night) parts.push('night');
  return parts.join(' · ');
}

const cell = (s: DaySlot, extra = ''): string => `${extra}${s.night ? ' night' : ''}`.trim();

/** The slot's NBM base: the hourly bulletin's where it gives one (null,
 *  "no layer", is a figure too), else the three-hourly bulletin's.
 *  `??` would skip the hourly null and print the three-hourly figure for
 *  an hour the hourly bulletin called clear (found in test, 2026-11-18). */
const baseOf = (s: DaySlot): number | null | undefined =>
  s.nbh?.lowestBaseFtAgl !== undefined ? s.nbh.lowestBaseFtAgl : s.nbs?.lowestBaseFtAgl;
const baseSource = (s: DaySlot): string | undefined =>
  s.nbh?.lowestBaseFtAgl !== undefined ? 'from the hourly bulletin' : s.nbs?.lowestBaseFtAgl !== undefined ? 'from the three-hourly bulletin' : undefined;

function BarCell({ pct, cls }: { pct: number | null | undefined; cls: string }): JSX.Element {
  return (
    <span className={`csd-barcell ${cls}`}>
      <span className="csd-track">{pct != null && <i className="csd-bar" style={{ height: `${pct}%` }} />}</span>
      <span className="csd-fig">{pct != null ? round(pct) : ''}</span>
    </span>
  );
}

export function CeilingSkyDays({ blocks, showOm, timeZone }: { blocks: DayBlock[]; showOm: boolean; timeZone: string }): JSX.Element {
  return (
    <div className="csd">
      {blocks.map((b) => {
        const date = new Date(b.firstTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });
        const anyNbs = b.slots.some((s) => s.nbs);
        const anyBase = b.slots.some((s) => baseOf(s) !== undefined);
        return (
          <div key={b.key} className="csd-day">
            <div className="csd-day-h">
              <span>
                {fmtWeekday(b.firstTime)} <span className="muted">{date}{b.today ? ' · today' : ''}</span>
              </span>
            </div>
            <table className="csd-table">
              <thead>
                <tr className="csd-time">
                  <th className="csd-lab" scope="row"></th>
                  {b.slots.map((s) => (
                    <th key={s.index} className={cell(s)} scope="col">
                      {s.time != null ? fmtShortHour(s.time) : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="csd-row-bar">
                  <th className="csd-lab" scope="row">NWS %</th>
                  {b.slots.map((s) => (
                    <td key={s.index} className={cell(s)} title={slotTitle(s)}>
                      {s.nws && <BarCell pct={s.nws.skyCoverPct} cls="nws" />}
                    </td>
                  ))}
                </tr>
                {showOm && (
                  <tr>
                    <th className="csd-lab" scope="row">OM %</th>
                    {b.slots.map((s) => (
                      <td key={s.index} className={cell(s, 'muted')}>
                        {s.om?.totalPct != null ? round(s.om.totalPct) : ''}
                      </td>
                    ))}
                  </tr>
                )}
                {anyNbs && (
                  <tr className="csd-row-bar">
                    <th className="csd-lab" scope="row">NBM %</th>
                    {b.slots.map((s) => (
                      <td key={s.index} className={cell(s)} title={slotTitle(s)}>
                        {s.nbs && <BarCell pct={s.nbs.skyCoverPct} cls="nbm" />}
                      </td>
                    ))}
                  </tr>
                )}
                <tr className="csd-row-band">
                  <th className="csd-lab csd-ylab" scope="row">
                    <span>12k</span>
                    <span>6</span>
                    <span>0</span>
                  </th>
                  <td colSpan={SLOTS_PER_DAY} className="csd-band-cell">
                    <Band slots={b.slots} />
                  </td>
                </tr>
                <tr>
                  <th className="csd-lab" scope="row">NWS ceil</th>
                  {b.slots.map((s) => (
                    <td key={s.index} className={cell(s)}>
                      {nwsCeilingText(s.nws)}
                    </td>
                  ))}
                </tr>
                {anyNbs && (
                  <tr>
                    <th className="csd-lab" scope="row">NBM ceil</th>
                    {b.slots.map((s) => (
                      <td key={s.index} className={cell(s, 'muted')}>
                        {heightText(s.nbs?.ceilingFtAgl)}
                      </td>
                    ))}
                  </tr>
                )}
                {anyBase && (
                  <tr>
                    <th className="csd-lab" scope="row">NBM base</th>
                    {b.slots.map((s) => (
                      <td key={s.index} className={cell(s, 'muted')} title={baseSource(s)}>
                        {heightText(baseOf(s))}
                      </td>
                    ))}
                  </tr>
                )}
                {b.nwsCeilingEnds != null && (
                  <tr className="csd-ends">
                    <td colSpan={SLOTS_PER_DAY + 1}>NWS ceiling forecast ends {fmtShortHour(b.nwsCeilingEnds)}; its sky row runs on</td>
                  </tr>
                )}
              </tbody>
            </table>
            {b.hours.length > 0 && (
              <details className="csd-hourly" open={b.today}>
                <summary>hourly</summary>
                <HourlyDetail hours={b.hours} showOm={showOm} />
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The day's NWS hours: time, sky cover, Open-Meteo's, the NWS ceiling
 *  and the NBM hourly base, in a grid that scrolls sideways inside the
 *  card when a full day's 24 columns are more than a phone holds. */
function HourlyDetail({ hours, showOm }: { hours: DayBlock['hours']; showOm: boolean }): JSX.Element {
  const rows: { label: string; cls: string; of: (h: DayBlock['hours'][number]) => string }[] = [
    { label: 'NWS %', cls: '', of: (h) => (h.nws.skyCoverPct != null ? String(round(h.nws.skyCoverPct)) : '') },
    ...(showOm ? [{ label: 'OM %', cls: 'muted', of: (h: DayBlock['hours'][number]) => (h.om?.totalPct != null ? String(round(h.om.totalPct)) : '') }] : []),
    { label: 'ceil', cls: '', of: (h) => nwsCeilingText(h.nws) },
    { label: 'base', cls: 'muted', of: (h) => heightText(h.nbh?.lowestBaseFtAgl) },
  ];
  return (
    <div className="csd-hourly-scroll">
      <table className="csd-hourly-table">
        <thead>
          <tr>
            <th className="csd-lab" scope="row"></th>
            {hours.map((h) => (
              <th key={h.nws.time} className={h.night ? 'night' : ''} scope="col" title={describeHour(h.nws, h.om, h.nbh)}>
                {fmtShortHour(h.nws.time).replace('am', 'a').replace('pm', 'p')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th className="csd-lab" scope="row">{r.label}</th>
              {hours.map((h) => (
                <td key={h.nws.time} className={`${r.cls}${h.night ? ' night' : ''}`.trim()}>
                  {r.of(h)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function describeHour(h: HourlyPoint, om: OpenMeteoCloudHour | null, nbh: NbmHour | null): string {
  const parts = [fmtTime(h.time)];
  if (h.skyCoverPct != null) parts.push(`NWS ${round(h.skyCoverPct)}% cover`);
  if (om?.totalPct != null) {
    const bands = [
      om.lowPct != null ? `low ${round(om.lowPct)}%` : null,
      om.midPct != null ? `mid ${round(om.midPct)}%` : null,
      om.highPct != null ? `high ${round(om.highPct)}%` : null,
    ].filter(Boolean);
    parts.push(`Open-Meteo ${round(om.totalPct)}% cover${bands.length ? ` (${bands.join(', ')})` : ''}`);
  }
  if (h.ceilingFtAgl != null) parts.push(`ceiling ${h.ceilingFtAgl.toLocaleString()} ft`);
  else if (!h.ceilingForecast) parts.push('ceiling not forecast');
  if (nbh?.lowestBaseFtAgl != null) parts.push(`NBM base ${nbh.lowestBaseFtAgl.toLocaleString()} ft`);
  if (h.precipProbPct != null) parts.push(`${round(h.precipProbPct)}% precip`);
  return parts.join(' · ');
}
