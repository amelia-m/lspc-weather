import { useId } from 'react';
import type { SkyPhase } from '../../domain/sun';
import { fmtTime } from '../format';

/** "3h 20m", the form the Daylight card already counts down in. */
const dur = (ms: number): string => {
  const mins = Math.max(0, Math.round(ms / 60_000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

// The arc: a half circle standing on the horizon line, with room above its
// top for the sun's rays (16 px) and below the line for the labels.
const CX = 150;
const CY = 108;
const R = 88;

/**
 * How far through the day or the night it is, as a sun (by day) or a moon
 * (by night) part-way along an arc from one end of the period to the other:
 * sunrise to sunset, or sunset to the next sunrise, the same times the
 * 14 CFR 105.19 night flag uses.
 *
 * The marker's place on the arc is the share of the period gone, by the
 * clock. It is not where the sun or the moon is in the sky: the real sun is
 * not at the top at the halfway minute, and the real moon keeps its own
 * schedule and may not be up at all. Nor is the crescent the moon's phase,
 * which nothing here computes. The card says so in words, since a picture
 * of a moon reads as a claim about the moon.
 */
export function SunArc({ phase, now }: { phase: SkyPhase; now: number }): JSX.Element {
  const maskId = useId();
  const day = phase.phase === 'day';
  const f = Math.min(1, Math.max(0, phase.fraction));
  const theta = Math.PI * (1 - f);
  const x = CX + R * Math.cos(theta);
  const y = CY - R * Math.sin(theta);
  const left = CX - R;
  const right = CX + R;
  const since = `${dur(now - phase.startMs)} since ${day ? 'sunrise' : 'sunset'}`;
  const until = `${dur(phase.endMs - now)} to ${day ? 'sunset' : 'sunrise'}`;
  return (
    <div className="sun-arc">
      <svg viewBox="0 0 300 130" role="img" aria-label={`${day ? 'Day' : 'Night'}: ${since}, ${until}.`}>
        <line className="sun-arc-horizon" x1={10} y1={CY} x2={290} y2={CY} />
        <path className="sun-arc-track" d={`M ${left} ${CY} A ${R} ${R} 0 0 1 ${right} ${CY}`} fill="none" />
        <path
          className={`sun-arc-done ${day ? 'is-day' : 'is-night'}`}
          d={`M ${left} ${CY} A ${R} ${R} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`}
          fill="none"
        />
        {day ? (
          <g className="sun-arc-sun" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return (
                <line key={i} x1={12 * Math.cos(a)} y1={12 * Math.sin(a)} x2={16 * Math.cos(a)} y2={16 * Math.sin(a)} />
              );
            })}
            <circle r={8} />
          </g>
        ) : (
          <g className="sun-arc-moon" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
            <mask id={maskId}>
              <circle r={10} fill="white" />
              <circle cx={5} cy={-3} r={8.5} fill="black" />
            </mask>
            <circle r={9} mask={`url(#${maskId})`} />
          </g>
        )}
        <text className="sun-arc-label" x={left} y={CY + 16} textAnchor="middle">
          {day ? 'sunrise' : 'sunset'} {fmtTime(phase.startMs)}
        </text>
        <text className="sun-arc-label" x={right} y={CY + 16} textAnchor="middle">
          {day ? 'sunset' : 'sunrise'} {fmtTime(phase.endMs)}
        </text>
      </svg>
      <p className="sun-arc-text">
        {since} · {until}
      </p>
      <p className="muted small">
        How far through the {day ? 'day' : 'night'} it is, by the clock; not where the{' '}
        {day ? 'sun is in the sky' : 'moon is in the sky, or its phase'}.
      </p>
    </div>
  );
}
