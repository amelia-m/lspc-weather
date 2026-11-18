import type { DayBlock, DaySlot } from '../domain/skyDays';
import { SLOTS_PER_DAY, slotBase } from '../domain/skyDays';
import type { HourlyPoint, NbmHour, OpenMeteoCloudHour } from '../domain/types';
import { round } from '../domain/units';
import { AUTOMATED_TOP_FT } from '../domain/stationPairs';
import { fmtShortHour, fmtTime, fmtWeekday } from './format';

/**
 * The Ceiling & sky card's body: one table per local day, eight three-hour
 * columns, the rows grouped by source, and the cloud heights drawn as a
 * band the way up a jumper sees them (the "day table" and "cloud profile"
 * mock-ups of docs/ceiling-sky-layout-review.md, built together at the
 * maintainer's word of 2026-11-18; read again the same day in
 * docs/ceiling-sky-rebuild-review.md, whose findings shaped what follows).
 * The blocks come from src/domain/skyDays.ts; this only draws them.
 *
 * Rows: the time of each slot; the NWS forecast's sky cover as a bar and
 * a figure; Open-Meteo's cloud cover figure where it answered; the NBM
 * three-hourly bulletin's sky cover the same way; the heights band; then
 * the heights printed, the NWS ceiling, the NBM ceiling and the NBM base,
 * in thousands of feet, "no" for none. A row is drawn only on a day with
 * a figure in it: a labelled row with nothing across a whole day read as
 * missing data, and so did a dash, so an empty cell is blank.
 *
 * The band: ground at the bottom, 12,000 ft (the ceilometer's reach at
 * KPMV) at the top. Each column is one bulletin's: the three-hourly one's
 * base and ceiling where the slot has its column, the hourly one's base
 * alone before that (slotBase). The base is a short bar at its height,
 * the NBM ceiling a fill from it up (cloud above it), the NWS ceiling a
 * line across the column while that forecast runs; a height at or above
 * 12,000 ft is a mark on the top edge, the row has the figure, since a
 * ceiling there drew nothing and read as a clear day. Night slots are
 * shaded behind. It is a picture of the printed rows and adds no figure.
 *
 * The day's NWS hours open under the table ("hourly"), today's open; when
 * two slots or fewer of today remain, today is its hours alone, since a
 * full table for one column said the same thing twice.
 *
 * Every bar is one colour whatever its amount, every figure one colour
 * per source, and nothing here is a warning or a verdict (CLAUDE.md).
 */
const BAND_W = 800;
const BAND_H = 120;
const TOP_FT = AUTOMATED_TOP_FT;
const yOf = (ft: number): number => BAND_H - (Math.min(ft, TOP_FT) / TOP_FT) * BAND_H;
/** Today is its hourly rows alone with this many slots or fewer left by
 *  the clock (from 6 PM): a full table for one or two columns said the
 *  same hours twice, the slots and the open detail. */
const HOURS_ALONE_SLOTS = 2;

/** A height in thousands of feet: a decimal under 10,000 ("4.5"), whole
 *  thousands from there ("11"), to fit a column a phone makes 30 px. */
const fmtK = (ft: number): string => (ft < 10_000 ? String(Math.round(ft / 100) / 10) : String(Math.round(ft / 1000)));

/** A height figure's text: the figure, "no" for none, blank for not given. */
const heightText = (ft: number | null | undefined): string => (ft === undefined ? '' : ft === null ? 'no' : fmtK(ft));

function nwsCeilingText(h: HourlyPoint | null): string {
  if (!h || !h.ceilingForecast) return '';
  return h.ceilingFtAgl != null ? fmtK(h.ceilingFtAgl) : 'no';
}

/** "3pm" and "3p": the long form on a phone wider than 360 px, the short
 *  one under it, where "12am" clipped to "12ar" in a 26 px column (the
 *  stylesheet shows one). */
function HourLabel({ time }: { time: number }): JSX.Element {
  const long = fmtShortHour(time);
  return (
    <>
      <span className="csd-tl">{long}</span>
      <span className="csd-ts">{long.replace('am', 'a').replace('pm', 'p')}</span>
    </>
  );
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
      marks.push(
        ceil >= TOP_FT ? (
          <rect key={`c${i}`} className="csd-oc csd-edge" x={x + 2} y={0} width={w - 4} height={4} />
        ) : (
          <rect key={`c${i}`} className="csd-oc" x={x + 2} y={0} width={w - 4} height={yOf(ceil)} />
        ),
      );
    }
    const base = slotBase(s)?.ft;
    if (base != null) {
      const y = Math.min(BAND_H - 4, Math.max(0, yOf(base) - 2));
      marks.push(<rect key={`b${i}`} className="csd-base" x={x + 10} y={y} width={w - 20} height={4} />);
    }
    if (s.nws?.ceilingForecast && s.nws.ceilingFtAgl != null) {
      const y = yOf(s.nws.ceilingFtAgl);
      marks.push(<line key={`w${i}`} className="csd-nws-ceil" x1={x} x2={x + w} y1={y} y2={y} />);
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
  const base = slotBase(s);
  if (base) parts.push(base.ft != null ? `NBM base ${base.ft.toLocaleString()} ft` : 'NBM: no layer');
  if (s.night) parts.push('night');
  return parts.join(' · ');
}

const cell = (s: DaySlot, extra = ''): string => `${extra}${s.night ? ' night' : ''}`.trim();

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
        const heading = (
          <div className="csd-day-h">
            <span>
              {fmtWeekday(b.firstTime)} <span className="muted">{date}{b.today ? ' · today' : ''}</span>
            </span>
          </div>
        );
        if (b.today && b.slotsLeft <= HOURS_ALONE_SLOTS && b.hours.length > 0) {
          return (
            <div key={b.key} className="csd-day csd-today-hours">
              {heading}
              <HourlyDetail hours={b.hours} showOm={showOm} />
            </div>
          );
        }
        const anyNws = b.slots.some((s) => s.nws);
        const anyOm = showOm && b.slots.some((s) => s.om?.totalPct != null);
        const anyNbs = b.slots.some((s) => s.nbs);
        const anyNwsCeil = b.slots.some((s) => nwsCeilingText(s.nws) !== '');
        const anyBase = b.slots.some((s) => slotBase(s) !== undefined);
        return (
          <div key={b.key} className="csd-day">
            {heading}
            <table className="csd-table">
              <thead>
                <tr className="csd-time">
                  <th className="csd-lab" scope="row"></th>
                  {b.slots.map((s) => (
                    <th key={s.index} className={cell(s)} scope="col">
                      {s.time != null && <HourLabel time={s.time} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anyNws && (
                  <tr className="csd-row-bar">
                    <th className="csd-lab" scope="row">NWS %</th>
                    {b.slots.map((s) => (
                      <td key={s.index} className={cell(s)} title={slotTitle(s)}>
                        {s.nws && <BarCell pct={s.nws.skyCoverPct} cls="nws" />}
                      </td>
                    ))}
                  </tr>
                )}
                {anyOm && (
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
                    <span>9</span>
                    <span>6</span>
                    <span>3</span>
                    <span>0</span>
                  </th>
                  <td colSpan={SLOTS_PER_DAY} className="csd-band-cell">
                    <Band slots={b.slots} />
                  </td>
                </tr>
                {anyNwsCeil && (
                  <tr>
                    <th className="csd-lab" scope="row">NWS ceil</th>
                    {b.slots.map((s) => (
                      <td key={s.index} className={cell(s)}>
                        {nwsCeilingText(s.nws)}
                      </td>
                    ))}
                  </tr>
                )}
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
                    {b.slots.map((s) => {
                      const base = slotBase(s);
                      // The hourly bulletin's figures carry a dotted underline:
                      // the key names it, and a phone shows no tooltip.
                      return (
                        <td key={s.index} className={cell(s, base?.from === 'nbh' ? 'muted csd-hb' : 'muted')}>
                          {heightText(base === undefined ? undefined : base.ft)}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
            {b.hours.length > 0 && (
              <details className="csd-hourly" open={b.today}>
                <summary>hourly ({b.hours.length} h)</summary>
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
 *  and the NBM hourly bulletin's base (the only one it has by the hour),
 *  in a grid that scrolls sideways inside the card when a full day's 24
 *  columns are more than a phone holds. */
function HourlyDetail({ hours, showOm }: { hours: DayBlock['hours']; showOm: boolean }): JSX.Element {
  type Hour = DayBlock['hours'][number];
  // A row only where the day has a figure in it, as the tables above.
  const rows = (
    [
      { label: 'NWS %', cls: '', of: (h: Hour) => (h.nws.skyCoverPct != null ? String(round(h.nws.skyCoverPct)) : '') },
      ...(showOm ? [{ label: 'OM %', cls: 'muted', of: (h: Hour) => (h.om?.totalPct != null ? String(round(h.om.totalPct)) : '') }] : []),
      { label: 'NWS ceil', cls: '', of: (h: Hour) => nwsCeilingText(h.nws) },
      { label: 'NBM base', cls: 'muted csd-hb', of: (h: Hour) => heightText(h.nbh?.lowestBaseFtAgl) },
    ] as { label: string; cls: string; of: (h: Hour) => string }[]
  ).filter((r) => hours.some((h) => r.of(h) !== ''));
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
