import type { DailyPoint } from '../domain/types';
import { cToF, round, toSpeed, type SpeedUnit } from '../domain/units';
import { SITE } from '../config/site';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';

/** 10-day outlook: daily sky, temps, wind/gust maxima, and precip chance —
 *  planning guidance for which days look jumpable, not a substitute for the
 *  morning-of forecast. */
export function DailyForecastPanel({
  daily,
  unit,
}: {
  daily: DailyPoint[];
  unit: SpeedUnit;
}): JSX.Element {
  return (
    <Panel title="10-day outlook" subtitle="daily planning" sources={[DATA_SOURCES.openMeteo]}>
      {daily.length === 0 ? (
        <p className="muted">No daily forecast available.</p>
      ) : (
        <div className="daily-scroll">
          <table className="daily-table">
            <thead>
              <tr>
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
                return (
                  <tr key={d.date}>
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
      <p className="muted small">
        Model forecast for the DZ (daily maxima; wind/gust are 10 m surface values). Confidence
        drops fast past a few days — use this for planning which days to watch, and check current
        conditions and the hourly forecast before jumping.
      </p>
    </Panel>
  );
}

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

/** Highlight days whose peak gust would trip even the licensed watch level. */
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
