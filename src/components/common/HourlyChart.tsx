import type { HourlyPoint } from '../../domain/types';
import { toSpeed, type SpeedUnit } from '../../domain/units';
import { SITE } from '../../config/site';
import { nightIntervals } from '../../domain/sun';

/** Compact, dependency-free SVG chart of the next ~18 h: surface wind (line),
 *  gust (dashed line) on a wind-speed axis, with precip probability as
 *  background bars, and the hours between sunset and sunrise at the drop
 *  zone as a dark band behind everything, gridlines included. */
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

  // Night at the drop zone, sunset to sunrise: the same times the 14 CFR
  // 105.19 night flag and the Daylight card use (domain/sun.ts), so the shade
  // starts where the flag would. A plain fact of the sky, drawn in a neutral
  // shade with no word on it. The points are hourly, so time maps linearly
  // onto the same axis the lines use.
  const t0 = points[0]?.time;
  const tN = points[n - 1]?.time;
  const xAt = (t: number): number => padL + ((t - t0) / (tN - t0)) * plotW;
  const nights = n > 1 ? nightIntervals(SITE.dz.lat, SITE.dz.lon, t0, tN) : [];

  return (
    <svg className="hchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hourly wind forecast">
      {/* night, sunset to sunrise, as a dark band: drawn first so the
          gridlines, the (translucent) precip bars and the lines all sit on
          top of it. A grey band read lighter than the day around it on this
          dark theme; dark reads as night. */}
      {nights.map(([a, b]) => (
        <rect
          key={a}
          className="hc-night"
          x={xAt(a)}
          y={padT}
          width={Math.max(0, xAt(b) - xAt(a))}
          height={plotH}
        />
      ))}
      {/* A thin line at each sunset and sunrise inside the chart. No fill
          can get much darker than this dark panel (black is about 1.25:1
          against it), so the band's own edge is low contrast; the lines
          mark where night starts and ends. */}
      {nights
        .flatMap(([a, b]) => [a, b])
        .filter((t) => t > t0 && t < tN)
        .map((t) => (
          <line key={`edge-${t}`} className="hc-night-edge" x1={xAt(t)} y1={padT} x2={xAt(t)} y2={padT + plotH} />
        ))}

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

/** Each mark the chart draws, by its swatch class, and its name. */
const LEGEND: readonly (readonly [string, string])[] = [
  ['wind', 'wind'],
  ['gust', 'gust'],
  ['precip', 'precip chance'],
  ['night', 'sunset to sunrise'],
];

/** The chart's key, one copy for every card that shows the chart, so a key
 *  cannot drift from the marks it names. */
export function HourlyLegend({ unit }: { unit: SpeedUnit }): JSX.Element {
  return (
    <p className="hc-legend">
      {/* Each swatch and its words wrap as one, so a narrow card never
          leaves a swatch at the end of one line and its name on the next. */}
      {LEGEND.map(([key, label]) => (
        <span key={key} className="hc-legend-item">
          <span className={`hc-key hc-key-${key}`} /> {key === 'gust' ? `${label} (${unit})` : label}
        </span>
      ))}
    </p>
  );
}
