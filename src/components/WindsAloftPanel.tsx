import { useState } from 'react';
import type { WindsAloftLevel, WindsAloftSource } from '../domain/types';
import { compass, cToF, fmtSpeed, round, type SpeedUnit } from '../domain/units';
import { SITE } from '../config/site';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';

/** Altitudes (ft AGL) shown when the card is collapsed. LSPC jumps top out
 *  around 10,000 ft, so the default view stops there and keeps the low levels
 *  that matter for the landing pattern and opening (surface, 1k, 3k) plus a
 *  couple in between for the exit/freefall drift. Expanding reveals every
 *  1,000-ft level up to 13k. */
const COLLAPSED_ALTITUDES_FT = new Set([0, 1000, 3000, 5000, 7000, 10000]);

/** Winds aloft at jump altitudes — the skydiver-specific centerpiece. An arrow
 *  points the direction the wind is blowing TOWARD (drift direction). */
export function WindsAloftPanel({
  levels,
  source,
  unit,
}: {
  levels: WindsAloftLevel[];
  source: WindsAloftSource | null | undefined;
  unit: SpeedUnit;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const fallback = source === 'nws-fd';
  const collapsedLevels = levels.filter((l) => COLLAPSED_ALTITUDES_FT.has(l.altitudeFtAgl));
  const shown = expanded ? levels : collapsedLevels;
  const toggleable = levels.length > collapsedLevels.length;
  return (
    <Panel
      title="Winds aloft"
      subtitle={fallback ? 'NOAA FD fallback' : 'freefall drift / spot'}
      sources={
        fallback
          ? [DATA_SOURCES.fdWinds]
          : [DATA_SOURCES.openMeteo, DATA_SOURCES.markschulze]
      }
    >
      {levels.length === 0 ? (
        <p className="muted">No winds-aloft data.</p>
      ) : (
        <table className="aloft-table">
          <thead>
            <tr>
              <th>Alt (AGL)</th>
              <th>Wind</th>
              <th>Speed</th>
              <th>Temp</th>
              <th aria-label="drift" />
            </tr>
          </thead>
          <tbody>
            {[...shown].reverse().map((l) => (
              <tr key={l.altitudeFtAgl}>
                <td>{l.altitudeFtAgl === 0 ? 'Surface' : `${l.altitudeFtAgl.toLocaleString()} ft`}</td>
                <td>
                  {compass(l.directionDeg)} ({l.directionDeg}°)
                </td>
                <td className={l.speedKt >= 30 ? 'aloft-strong' : ''}>{fmtSpeed(l.speedKt, unit)}</td>
                <td>{l.tempC != null ? `${l.tempC}°C / ${round(cToF(l.tempC))}°F` : '—'}</td>
                <td>
                  <span
                    className="aloft-arrow"
                    style={{ transform: `rotate(${(l.directionDeg + 180) % 360}deg)` }}
                    aria-hidden
                  >
                    ↑
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {toggleable && (
        <button
          type="button"
          className="aloft-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show fewer altitudes' : 'Show all altitudes (to 13,000 ft)'}
        </button>
      )}
      <p className="muted small">Arrow shows drift direction (where wind pushes you).</p>
      {!expanded && toggleable && (
        <p className="muted small">
          Showing key altitudes to 10,000 ft (LSPC&rsquo;s usual max). Expand for every 1,000-ft
          level up to 13k.
        </p>
      )}
      {fallback ? (
        <p className="muted small">
          <strong>Fallback source:</strong> Open-Meteo was unreachable, so these levels are
          interpolated from the NOAA winds-aloft (FD) forecast for {SITE.fdWindsStation} (Omaha,
          ~30 mi from the DZ) — 3/6/9/12k-ft MSL levels, the same bulletin jump pilots brief from.
          The surface row is omitted (the bulletin&rsquo;s lowest level is 3,000 ft MSL); see the
          Surface wind card for ground wind.
        </p>
      ) : (
        <>
          <p className="muted small">
            Same Open-Meteo data source as{' '}
            <a href={DATA_SOURCES.markschulze.url} target="_blank" rel="noopener noreferrer">
              Mark Schulze’s Winds Aloft
            </a>
            , the popular skydiving winds tool.
          </p>
          <p className="muted small">
            Each 1,000-ft level is <strong>linearly interpolated</strong> from the model’s
            pressure-level winds (Open-Meteo gives wind at fixed pressure surfaces — e.g.
            925/850/700 hPa — with their geopotential heights, which we convert to ft MSL and
            interpolate to these AGL altitudes). Direction is interpolated along the shortest
            compass arc. These are a model <strong>forecast</strong> for the DZ, not a measured
            sounding, so treat them as guidance.
          </p>
        </>
      )}
    </Panel>
  );
}
