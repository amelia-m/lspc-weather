import type { HourlyPoint } from '../../domain/types';
import { toSpeed, type SpeedUnit } from '../../domain/units';
import { SITE } from '../../config/site';

/** Compact, dependency-free SVG chart of the next ~18 h: surface wind (line),
 *  gust (dashed line) on a wind-speed axis, with precip probability as faint
 *  background bars. */
export function HourlyChart({
  points,
  unit,
}: {
  points: HourlyPoint[];
  unit: SpeedUnit;
}): JSX.Element {
  const W = 340;
  const H = 140;
  const padL = 26;
  const padR = 8;
  const padT = 10;
  const padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const conv = (v: number | null): number | null => (v == null ? null : toSpeed(v, unit));
  const speeds = points.map((p) => conv(p.windSpeedKt));
  const gusts = points.map((p) => conv(p.windGustKt));
  const precip = points.map((p) => p.precipProbPct);

  const peak = Math.max(
    20,
    ...speeds.filter((v): v is number => v != null),
    ...gusts.filter((v): v is number => v != null),
  );
  const maxKt = Math.ceil(peak / 5) * 5;

  const n = points.length;
  const xOf = (i: number): number => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yOf = (kt: number): number => padT + (1 - kt / maxKt) * plotH;

  const path = (vals: (number | null)[]): string => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  const gridKt = [0, maxKt / 2, maxKt];
  const barW = n > 1 ? Math.max(2, plotW / n - 2) : plotW;

  // Label roughly every 3 hours.
  const labelEvery = Math.max(1, Math.round(n / 6));

  return (
    <svg className="hchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hourly wind forecast">
      {/* y gridlines + labels (kt) */}
      {gridKt.map((kt) => (
        <g key={kt}>
          <line className="hc-grid" x1={padL} y1={yOf(kt)} x2={W - padR} y2={yOf(kt)} />
          <text className="hc-axis" x={padL - 4} y={yOf(kt) + 3} textAnchor="end">
            {Math.round(kt)}
          </text>
        </g>
      ))}

      {/* precip probability bars (background) */}
      {precip.map((p, i) =>
        p != null && p > 0 ? (
          <rect
            key={i}
            className="hc-precip"
            x={xOf(i) - barW / 2}
            y={padT + (1 - p / 100) * plotH}
            width={barW}
            height={(p / 100) * plotH}
          />
        ) : null,
      )}

      {/* gust + wind lines */}
      <path className="hc-gust" d={path(gusts)} fill="none" />
      <path className="hc-wind" d={path(speeds)} fill="none" />

      {/* x labels */}
      {points.map((p, i) =>
        i % labelEvery === 0 ? (
          <text key={p.time} className="hc-axis" x={xOf(i)} y={H - 6} textAnchor="middle">
            {hourLabel(p.time)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

const hourLabel = (ms: number): string =>
  new Date(ms)
    .toLocaleTimeString('en-US', { hour: 'numeric', timeZone: SITE.timeZone })
    .replace(' ', '')
    .toLowerCase();
