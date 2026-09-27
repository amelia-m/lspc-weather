import { useState } from 'react';
import type { WeatherSnapshot, WindsAloftLevel, WindsAloftValidity } from '../domain/types';
import { chooseForecastHour, selectionAfterStep } from '../domain/forecastHour';
import type { WindsHourNav } from '../components/WindsAloftPanel';
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
 */
export function useWindsHour(snapshot: WeatherSnapshot): {
  levels: WindsAloftLevel[];
  validity: WindsAloftValidity | null | undefined;
  nav: WindsHourNav | null;
} {
  const now = useNow(60_000);
  const [selectedMs, setSelectedMs] = useState<number | null>(null);
  const hours = snapshot.windsAloftHours;
  const chosen = chooseForecastHour(hours, selectedMs, now);
  if (!hours || !chosen) {
    return { levels: snapshot.windsAloft, validity: snapshot.windsAloftValidity, nav: null };
  }
  return {
    levels: chosen.levels,
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
