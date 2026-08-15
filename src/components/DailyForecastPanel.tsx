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
 *  forecast. */
export function DailyForecastPanel({
  daily,
  source,
  hourly,
  unit,
}: {
  daily: DailyPoint[];
  source: DailySource | null | undefined;
  hourly: HourlyPoint[];
  unit: SpeedUnit;
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
                    <td className="daily-sky" title={wx.label}>
                      <span className="daily-icon" aria-hidden>
                        {wx.icon}
                      </span>{' '}
                      {wx.label}
                    </td>
                    <td>{tempRange(d.tempMaxC, d.tempMinC)}</td>
                    <td className={windClass(d.gustMaxKt)}>{windText(d, unit)}</td>
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
          aggregated from the NWS gridpoint forecast (~7 days instead of 10; the sky icon is
          derived from cloud cover and precip chance).
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
                      <td className={windClass(h.windGustKt)}>{hourWind(h, unit)}</td>
                      <td>{h.skyCoverPct != null ? `${round(h.skyCoverPct)}%` : '—'}</td>
                      <td>{h.tempC != null ? `${round(cToF(h.tempC))}°F` : '—'}</td>
                      <td>{h.precipProbPct != null ? `${round(h.precipProbPct)}%` : '—'}</td>
                      <td className={h.thunderProbPct != null && h.thunderProbPct >= 30 ? 'aloft-strong' : ''}>
                        {h.thunderProbPct != null ? `${round(h.thunderProbPct)}%` : '—'}
                      </td>
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

/** Highlight days/hours whose gust would trip even the licensed watch level. */
const windClass = (gustKt: number | null): string =>
  gustKt != null && gustKt >= 25 ? 'aloft-strong' : '';

/** WMO weather interpretation codes → compact icon + label. */
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
