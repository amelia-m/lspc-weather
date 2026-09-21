import { useMemo, useState } from 'react';
import type { DailyPoint, DailySource, HourlyPoint } from '../domain/types';
import { compass, cToF, round, toSpeed, type SpeedUnit } from '../domain/units';
import { flightCategory } from '../domain/flightCategory';
import { SITE } from '../config/site';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { HourlyChart } from './common/HourlyChart';
import { FlightCategoryPill } from './common/FlightCategoryPill';
import { fmtTime } from './format';

/** 10-day outlook: daily sky, temps, wind/gust maxima, and precip chance.
 *  Tap a day to expand its hourly detail (from the NWS gridpoint forecast,
 *  which reaches ~7 days; days past that show a not-available note). Planning
 *  guidance for which days look jumpable, not a substitute for the morning-of
 *  forecast.
 *
 *  Nothing in these tables is coloured. A gust or a storm chance painted red
 *  asserts that the day is one to worry about, and no published rule sets a
 *  level at which a FORECAST gust or thunderstorm chance becomes that — the
 *  USPA and club wind limits are same-day surface limits for the jump being
 *  made, not a test to apply to a model maximum eight days out. The figures are
 *  printed plainly so the reader judges them against the limits on the surface
 *  wind card.
 *
 *  On the Open-Meteo path the Sky column shows that service's own WMO weather
 *  code as an icon and a word. The NWS gridpoint fallback publishes no such
 *  code, so the column shows the day's mean cloud cover as a percentage
 *  instead: a figure from the grid, not a one-word verdict this app derived
 *  from cutoffs of its own. */
export function DailyForecastPanel({
  daily,
  source,
  hourly,
  unit,
  onUnitChange,
}: {
  daily: DailyPoint[];
  source: DailySource | null | undefined;
  hourly: HourlyPoint[];
  unit: SpeedUnit;
  /** Page-wide unit setter, handed to the header toggle. Required rather than
   *  optional, like the other wind cards: the outlook prints its wind maxima
   *  bare under a "Wind (kt)" column heading, so the unit is only ever legible
   *  from that heading and its switch.
   *
   *  The header is the one place that stays put while a day is expanded — the
   *  day rows and the detail pane below them are already the card's own
   *  interaction, and a unit switch buried in there would move or vanish as
   *  days are opened and closed. */
  onUnitChange: (u: SpeedUnit) => void;
}): JSX.Element {
  const fallback = source === 'nws-gridpoint';
  const [selected, setSelected] = useState<string | null>(null);

  // Group hourly points by local (DZ) calendar day so a selected outlook day
  // maps to its hours regardless of the UTC boundary.
  const hourlyByDay = useMemo(() => groupByLocalDay(hourly), [hourly]);
  const lastCoveredDay = useMemo(() => {
    let max: string | null = null;
    for (const key of hourlyByDay.keys()) if (max == null || key > max) max = key;
    return max;
  }, [hourlyByDay]);

  const toggle = (key: string): void => setSelected((cur) => (cur === key ? null : key));

  return (
    <Panel
      title="10-day outlook"
      subtitle={fallback ? 'NWS ~7-day fallback' : 'daily planning'}
      sources={[fallback ? DATA_SOURCES.nwsForecast : DATA_SOURCES.openMeteo]}
      unit={unit}
      onUnitChange={onUnitChange}
    >
      {daily.length === 0 ? (
        <p className="muted">No daily forecast available.</p>
      ) : (
        <div className="daily-scroll">
          <table className="daily-table">
            <thead>
              <tr>
                <th aria-label="expand" />
                <th>Day</th>
                <th>Sky</th>
                <th>Hi/Lo °F</th>
                <th>Wind ({unit})</th>
                <th>Rain</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d, i) => {
                const wx = weatherCode(d.weatherCode);
                const key = localDayKey(d.date);
                // Fallback path: the same hourlies these days were aggregated
                // from are already grouped here, so the cover figure comes from
                // the grid rather than from anything derived about the day.
                const skyAvgPct = fallback ? meanSkyCoverPct(hourlyByDay.get(key)) : null;
                const isOpen = selected === key;
                return (
                  <tr
                    key={d.date}
                    className={`daily-row${isOpen ? ' selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggle(key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle(key);
                      }
                    }}
                  >
                    <td className="daily-caret" aria-hidden>
                      {isOpen ? '▾' : '▸'}
                    </td>
                    <td>{dayLabel(d.date, i)}</td>
                    {fallback ? (
                      <td className="daily-sky" title="Mean cloud cover over the day’s forecast hours">
                        {skyAvgPct != null ? `${round(skyAvgPct)}% cover` : '—'}
                      </td>
                    ) : (
                      <td className="daily-sky" title={wx.label}>
                        <span className="daily-icon" aria-hidden>
                          {wx.icon}
                        </span>{' '}
                        {wx.label}
                      </td>
                    )}
                    <td>{tempRange(d.tempMaxC, d.tempMinC)}</td>
                    <td>{windText(d, unit)}</td>
                    <td>{d.precipProbMaxPct != null ? `${round(d.precipProbMaxPct)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <DayDetail
          dayKey={selected}
          points={hourlyByDay.get(selected) ?? []}
          lastCoveredDay={lastCoveredDay}
          unit={unit}
          onClose={() => setSelected(null)}
        />
      )}

      {fallback && (
        <p className="muted small">
          <strong>Fallback source:</strong> Open-Meteo was unreachable, so these days are
          aggregated from the NWS gridpoint forecast (~7 days instead of 10). Sky shows the day’s
          mean cloud cover, not an icon: a weather icon is the forecasting service's own reading of
          its model, this source publishes none, and the cutoffs this app used to derive one from
          cloud cover and rain chance were its own. Rain chance is in its own column.
        </p>
      )}
      <p className="muted small">
        Model forecast for the DZ (daily maxima; wind/gust are 10 m surface values). Tap a day for
        its hourly breakdown. Confidence drops fast past a few days — use this for planning which
        days to watch, and check current conditions before jumping.
      </p>
    </Panel>
  );
}

/** Expanded hourly view for one selected outlook day. */
function DayDetail({
  dayKey,
  points,
  lastCoveredDay,
  unit,
  onClose,
}: {
  dayKey: string;
  points: HourlyPoint[];
  lastCoveredDay: string | null;
  unit: SpeedUnit;
  onClose: () => void;
}): JSX.Element {
  const heading = dayHeading(dayKey);
  return (
    <div className="daily-detail">
      <div className="daily-detail-head">
        <strong>Hourly — {heading}</strong>
        <button className="refresh-btn" onClick={onClose}>
          Hide
        </button>
      </div>
      {points.length === 0 ? (
        <p className="muted small">
          Hourly forecast isn’t available this far out.{' '}
          {lastCoveredDay
            ? `The NWS gridpoint forecast reaches only about ${horizonDays(lastCoveredDay)} days out (through ${dayHeading(
                lastCoveredDay,
              )}).`
            : 'The hourly forecast has not loaded — check Data health below.'}
        </p>
      ) : (
        <>
          <HourlyChart points={points} unit={unit} />
          <p className="hc-legend">
            <span className="hc-key hc-key-wind" /> wind &nbsp;
            <span className="hc-key hc-key-gust" /> gust ({unit}) &nbsp;
            <span className="hc-key hc-key-precip" /> precip&nbsp;chance
          </p>
          <div className="daily-scroll">
            <table className="daily-table hourly-detail-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Flight</th>
                  <th>Wind ({unit})</th>
                  <th>Sky</th>
                  <th>Vis</th>
                  <th>Temp</th>
                  <th>Rain</th>
                  <th>Storm</th>
                </tr>
              </thead>
              <tbody>
                {points.map((h) => {
                  const cat = flightCategory(h.ceilingFtAgl, h.visibilitySm);
                  return (
                    <tr key={h.time}>
                      <td>{fmtTime(h.time)}</td>
                      <td>{cat ? <FlightCategoryPill category={cat} /> : '—'}</td>
                      <td>{hourWind(h, unit)}</td>
                      <td>{h.skyCoverPct != null ? `${round(h.skyCoverPct)}%` : '—'}</td>
                      <td>{h.visibilitySm != null ? `${round(h.visibilitySm, 1)} SM` : '—'}</td>
                      <td>{h.tempC != null ? `${round(cToF(h.tempC))}°F` : '—'}</td>
                      <td>{h.precipProbPct != null ? `${round(h.precipProbPct)}%` : '—'}</td>
                      <td>{h.thunderProbPct != null ? `${round(h.thunderProbPct)}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- helpers ---- */

const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SITE.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** yyyy-mm-dd in the DZ time zone — a stable per-local-day key. */
const localDayKey = (ms: number): string => dayKeyFmt.format(ms);

function groupByLocalDay(points: HourlyPoint[]): Map<string, HourlyPoint[]> {
  const map = new Map<string, HourlyPoint[]>();
  for (const h of points) {
    const key = localDayKey(h.time);
    const arr = map.get(key);
    if (arr) arr.push(h);
    else map.set(key, [h]);
  }
  return map;
}

const keyToNoonUtc = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12);
};

/** Whole days from today (DZ local) to the given day key — the hourly horizon. */
const horizonDays = (lastKey: string): number => {
  const today = keyToNoonUtc(localDayKey(Date.now()));
  return Math.max(1, Math.round((keyToNoonUtc(lastKey) - today) / 86_400_000));
};

/** "Wed, Jul 9" from a yyyy-mm-dd day key, rendered in the DZ time zone.
 *  Noon UTC keeps the date stable when formatted back into the DZ zone. */
const dayHeading = (key: string): string =>
  new Date(keyToNoonUtc(key)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: SITE.timeZone,
  });

const dayLabel = (ms: number, index: number): string =>
  index === 0
    ? 'Today'
    : new Date(ms).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
        timeZone: SITE.timeZone,
      });

const tempRange = (maxC: number | null, minC: number | null): string => {
  const f = (c: number | null): string => (c != null ? `${round(cToF(c))}°` : '—');
  return `${f(maxC)}/${f(minC)}`;
};

/** Compact "12 g 20" (units live in the column header). */
const windText = (d: DailyPoint, unit: SpeedUnit): string => {
  if (d.windMaxKt == null) return '—';
  const base = `${round(toSpeed(d.windMaxKt, unit))}`;
  return d.gustMaxKt != null ? `${base} g ${round(toSpeed(d.gustMaxKt, unit))}` : base;
};

/** Per-hour wind with direction, e.g. "SW 12 g 20". */
const hourWind = (h: HourlyPoint, unit: SpeedUnit): string => {
  if (h.windSpeedKt == null) return '—';
  const dir = h.windDirectionDeg != null ? `${compass(h.windDirectionDeg)} ` : '';
  const base = `${dir}${round(toSpeed(h.windSpeedKt, unit))}`;
  return h.windGustKt != null ? `${base} g ${round(toSpeed(h.windGustKt, unit))}` : base;
};

/** Mean sky cover across a day's forecast hours, or null when none carry it.
 *  Used only on the gridpoint fallback, where the day has no published weather
 *  code and the outlook shows the cover figure in its place. */
function meanSkyCoverPct(points: HourlyPoint[] | undefined): number | null {
  const vals = (points ?? []).map((p) => p.skyCoverPct).filter((v): v is number => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** WMO weather interpretation codes → compact icon + label. Open-Meteo's own
 *  codes only; nothing in this app derives one. */
function weatherCode(code: number | null): { icon: string; label: string } {
  if (code == null) return { icon: '·', label: '—' };
  if (code === 0) return { icon: '☀️', label: 'Clear' };
  if (code === 1) return { icon: '🌤️', label: 'Mostly clear' };
  if (code === 2) return { icon: '⛅', label: 'Partly cloudy' };
  if (code === 3) return { icon: '☁️', label: 'Overcast' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'Fog' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: 'Drizzle' };
  if (code >= 61 && code <= 67) return { icon: '🌧️', label: 'Rain' };
  if (code >= 71 && code <= 77) return { icon: '🌨️', label: 'Snow' };
  if (code >= 80 && code <= 82) return { icon: '🌦️', label: 'Showers' };
  if (code === 85 || code === 86) return { icon: '🌨️', label: 'Snow showers' };
  if (code >= 95) return { icon: '⛈️', label: 'Thunderstorm' };
  return { icon: '·', label: `Code ${code}` };
}
