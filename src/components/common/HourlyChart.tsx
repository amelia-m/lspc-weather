import { useId } from 'react';
import type { HourlyPoint } from '../../domain/types';
import { fmtLimitSpeed, toSpeed, type SpeedUnit } from '../../domain/units';
import { limitLines, type Thresholds } from '../../config/thresholds';
import { lowerLimitPublished, lowerLimitUnchecked } from '../../domain/advisories';
import { SourceLink } from './SourceLink';
import { SITE } from '../../config/site';
import { nightIntervals, skySpans } from '../../domain/sun';

/** Compact, dependency-free SVG chart of the next ~18 h: surface wind (line),
 *  gust (dashed line) on a wind-speed axis, with precip probability as
 *  background bars, and the hours between sunset and sunrise at the drop
 *  zone as a dark band behind everything, gridlines included. A sun or a
 *  moon above the plot names each day and night span it can see. */
export function HourlyChart({
  points,
  unit,
  limits,
}: {
  points: HourlyPoint[];
  unit: SpeedUnit;
  /** The jumper profile's limits, drawn as reference lines where a published
   *  source sets them (`limitLines`): the BSR student maximum, or a waiver
   *  tier's wind limit and gust ceiling. Nothing for Licensed, which has none. */
  limits?: Thresholds;
}): JSX.Element {
  // Without the colons React puts in an id, so the url(#…) reference needs
  // no escaping.
  const maskId = useId().replace(/:/g, '');
  const W = 340;
  const H = 154;
  const padL = 26;
  const padR = 8;
  // The top margin holds the sun and moon (ICON_Y), so no line or bar is
  // ever drawn through one: the plot starts below them.
  const padT = 24;
  const padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const conv = (v: number | null): number | null => (v == null ? null : toSpeed(v, unit));
  const speeds = points.map((p) => conv(p.windSpeedKt));
  const gusts = points.map((p) => conv(p.windGustKt));
  const precip = points.map((p) => p.precipProbPct);

  const lines = limitLines(limits);
  const peak = Math.max(
    20,
    ...speeds.filter((v): v is number => v != null),
    ...gusts.filter((v): v is number => v != null),
  );
  // Room above each limit line for its label, below the top gridline and so
  // clear of the sun and moon in the margin: the 21+ tier's 20 mph gust
  // ceiling would otherwise sit on the 20 mph top line, and a figure edited
  // in Settings can be anywhere. Measured in chart units, since a fixed
  // speed margin shrinks as the axis grows.
  let maxKt = Math.ceil(peak / 5) * 5;
  const labelTop = (kt: number): number => padT + (1 - toSpeed(kt, unit) / maxKt) * plotH - LIMIT_LABEL_RISE - 8;
  while (lines.some((l) => labelTop(l.kt) < padT)) maxKt += 5;

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
  // A sun over each stretch of daylight on the chart and a moon over each
  // night, at the middle of the part that is shown, so a night that runs off
  // the right edge is still labelled over its visible part. A span too
  // narrow to hold the glyph without crowding the next one gets none; the
  // band and its edge lines still mark it.
  const icons =
    n > 1
      ? skySpans(nights, t0, tN)
          .map((s) => ({ kind: s.kind, x0: xAt(s.start), x1: xAt(s.end) }))
          .filter((s) => s.x1 - s.x0 >= MIN_ICON_SPAN_PX)
          .map((s) => ({ kind: s.kind, x: (s.x0 + s.x1) / 2 }))
      : [];

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

      {/* Day and night, named above the plot. They mark the spans the band
          and its lines already draw; they are not the sun's or the moon's
          place in the sky, and the crescent is not the moon's phase. */}
      {icons.some((i) => i.kind === 'night') && (
        <defs>
          <mask id={maskId}>
            <circle r={6} fill="white" />
            <circle cx={3} cy={-2} r={5} fill="black" />
          </mask>
        </defs>
      )}
      {icons.map((i) =>
        i.kind === 'day' ? (
          <g key={`sun-${i.x}`} className="hc-sun" transform={`translate(${i.x.toFixed(1)} ${ICON_Y})`}>
            <title>daylight, sunrise to sunset</title>
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k * Math.PI) / 4;
              return (
                <line key={k} x1={6.5 * Math.cos(a)} y1={6.5 * Math.sin(a)} x2={8.5 * Math.cos(a)} y2={8.5 * Math.sin(a)} />
              );
            })}
            <circle r={4} />
          </g>
        ) : (
          <g key={`moon-${i.x}`} className="hc-moon" transform={`translate(${i.x.toFixed(1)} ${ICON_Y})`}>
            <title>night, sunset to sunrise</title>
            <circle r={5.5} mask={`url(#${maskId})`} />
          </g>
        ),
      )}

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

      {/* The profile's limits (published, or edited in Settings and labelled
          so), under the forecast lines so those
          stay readable where they cross. The same colours as the Surface
          wind card's bands; dotted, so neither is taken for the dashed gust
          line. */}
      {lines.map((l) => {
        const y = yOf(toSpeed(l.kt, unit));
        return (
          <g key={l.kind} className={`hc-limit hc-limit-${l.kind}`}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} />
          </g>
        );
      })}

      {/* gust + wind lines */}
      <path className="hc-gust" d={path(gusts)} fill="none" />
      <path className="hc-wind" d={path(speeds)} fill="none" />

      {/* The limits' labels, over the forecast lines with a halo in the
          panel's colour, so a line crossing one cannot strike it out. At
          opposite ends: the waiver's wind and gust figures are one or two
          mph apart and would print over each other. */}
      {lines.map((l) => (
        <text
          key={l.kind}
          className={`hc-limit-label hc-limit-label-${l.kind}`}
          x={l.kind === 'wind' ? padL + 2 : W - padR - 2}
          y={yOf(toSpeed(l.kt, unit)) - LIMIT_LABEL_RISE}
          textAnchor={l.kind === 'wind' ? 'start' : 'end'}
        >
          {l.kind === 'wind' ? 'limit' : 'gust ceiling'} {fmtLimitSpeed(l.kt, unit)}
          {/* A figure the reader edited is not the source's: said on the
              line itself, so a crop of the chart cannot pass it off. */}
          {l.edited ? ' (edited)' : ''}
        </text>
      ))}

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

/** How far a limit's label baseline sits above its line; the label's 8px
 *  glyphs rise above that. */
const LIMIT_LABEL_RISE = 2.5;

/** Where the sun and moon sit: the middle of the chart's top margin. */
const ICON_Y = 11;
/** The narrowest day or night span, in chart units, that gets a glyph: a
 *  little over the sun's 17-unit width, so two glyphs never touch. */
const MIN_ICON_SPAN_PX = 20;

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
 *  cannot drift from the marks it names. Given the same `limits` as the
 *  chart, it names the limit lines too, whose profile they are, and the
 *  source that sets them, or that a figure was edited in Settings, in which
 *  case the source does not set it. */
export function HourlyLegend({
  unit,
  limits,
  profile,
}: {
  unit: SpeedUnit;
  limits?: Thresholds;
  /** The profile's name as the header selector shows it. */
  profile?: string;
}): JSX.Element {
  const lines = limitLines(limits);
  const edited = lines.filter((l) => l.edited);
  return (
    <>
      <p className="hc-legend">
        {/* Each swatch and its words wrap as one, so a narrow card never
            leaves a swatch at the end of one line and its name on the next. */}
        {LEGEND.map(([key, label]) => (
          <span key={key} className="hc-legend-item">
            <span className={`hc-key hc-key-${key}`} /> {key === 'gust' ? `${label} (${unit})` : label}
          </span>
        ))}
        {lines.map((l) => (
          <span key={l.kind} className="hc-legend-item">
            <span className={`hc-key hc-key-limit-${l.kind}`} /> {l.kind === 'wind' ? 'wind limit' : 'gust ceiling'}
          </span>
        ))}
      </p>
      {lines.length > 0 && limits?.windLimitCitation && (
        <p className="muted small">
          Limit lines: {profile ?? 'this profile'}. Source: <SourceLink citation={limits.windLimitCitation} />.
          {edited.length > 0 &&
            ` The ${edited.map((l) => (l.kind === 'wind' ? 'wind limit' : 'gust ceiling')).join(' and ')} ${
              edited.length > 1 ? 'are' : 'is'
            } edited in Settings, so the source does not set ${edited.length > 1 ? 'them' : 'it'}; the published figures are on the Surface wind card.`}
          {/* The BSR's second student figure, which no line here marks: the
              Surface wind card's sentence and test (lowerLimitPublished,
              lowerLimitUnchecked), so the two cannot disagree. */}
          {lowerLimitUnchecked(limits) && ` ${lowerLimitPublished(limits, unit)} The limit line is not it.`}
        </p>
      )}
    </>
  );
}
