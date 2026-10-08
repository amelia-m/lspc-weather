import { useState } from 'react';
import type { WeatherSnapshot, WindsAloftLevel, WindsAloftValidity, WindsMethod } from '../domain/types';
import { chooseForecastHour, selectionAfterStep } from '../domain/forecastHour';
import { tableGroundFtMsl } from '../domain/windsAloft';
import type { WindsHourNav } from '../components/common/ForecastHourNav';
import { useNow } from './useNow';

/**
 * The winds-aloft hour both the Winds aloft and drift cards show, and the
 * buttons that step it. Held here rather than in the winds card so the drift
 * estimate always uses the hour the table shows.
 *
 * Following the clock is re-evaluated every minute, not only at the 10-minute
 * data poll, so the table moves on at half past when it should. Stepping back
 * onto the hour nearest the clock returns to following it (see
 * `selectionAfterStep`).
 *
 * On a source with a single hour (the NOAA FD fallback) there is nothing to
 * step: the snapshot's own levels and validity pass through and `nav` is null.
 *
 * `method` picks which of the hour's two tables both cards use: every sample
 * (the default) or as Mark Schulze's tool builds his. Only the Open-Meteo
 * hours carry the second; `schulzeAvailable` says whether this one does, and
 * where it does not, the default table passes through whatever was asked.
 */
export function useWindsHour(
  snapshot: WeatherSnapshot,
  method: WindsMethod = 'all',
): {
  levels: WindsAloftLevel[];
  validity: WindsAloftValidity | null | undefined;
  nav: WindsHourNav | null;
  schulzeAvailable: boolean;
  /** The ground Mark Schulze's table counts its altitudes from (Open-Meteo's
   *  terrain at the point), ft MSL, read off the his-way table's 0 ft row;
   *  null where this hour has no such table. */
  schulzeGroundFtMsl: number | null;
} {
  const now = useNow(60_000);
  const [selectedMs, setSelectedMs] = useState<number | null>(null);
  const hours = snapshot.windsAloftHours;
  const chosen = chooseForecastHour(hours, selectedMs, now);
  if (!hours || !chosen) {
    return {
      levels: snapshot.windsAloft,
      validity: snapshot.windsAloftValidity,
      nav: null,
      schulzeAvailable: false,
      schulzeGroundFtMsl: null,
    };
  }
  const schulzeAvailable = (chosen.schulzeLevels?.length ?? 0) > 0;
  return {
    levels: method === 'schulze' && schulzeAvailable ? chosen.schulzeLevels! : chosen.levels,
    schulzeAvailable,
    schulzeGroundFtMsl: chosen.schulzeLevels ? tableGroundFtMsl(chosen.schulzeLevels) : null,
    validity: { validMs: chosen.validMs },
    nav: {
      canBack: chosen.canBack,
      canForward: chosen.canForward,
      following: chosen.following,
      onStep: (delta) => {
        const next = selectionAfterStep(hours, chosen.validMs, delta, now);
        if (next !== undefined) setSelectedMs(next);
      },
      onFollow: () => setSelectedMs(null),
    },
  };
}
