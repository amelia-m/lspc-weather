import { useCallback, useMemo, useState } from 'react';
import { fetchHourly, fetchLatestObservation, fetchTaf } from '../api/nws';
import { fetchWindsAloft } from '../api/openMeteo';
import { evaluateAdvisories } from '../domain/advisories';
import { densityAltitude } from '../domain/densityAltitude';
import { sunTimes } from '../domain/sun';
import type { Advisory, SourceKey, SourceStatus, WeatherSnapshot } from '../domain/types';
import type { Thresholds } from '../config/thresholds';
import { SITE, WINDS_ALOFT_LEVELS_AGL } from '../config/site';
import { useNow } from './useNow';
import { usePolling } from './usePolling';

const STALE_AFTER_MS = 30 * 60 * 1000;
const REFRESH_MS = 10 * 60 * 1000;

const okStatus = (): SourceStatus => ({ ok: true, fetchedAt: Date.now(), stale: false, error: null });
const idleStatus = (): SourceStatus => ({ ok: false, fetchedAt: null, stale: false, error: null });

export interface WeatherData {
  snapshot: WeatherSnapshot;
  advisories: Advisory[];
  status: Record<SourceKey, SourceStatus>;
  loading: boolean;
  lastUpdated: number | null;
  refresh: () => void;
}

const EMPTY_SNAPSHOT: WeatherSnapshot = {
  current: null,
  hourly: [],
  windsAloft: [],
  sun: null,
  densityAltitude: null,
  taf: null,
};

export function useWeatherData(thresholds: Thresholds): WeatherData {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot>(EMPTY_SNAPSHOT);
  const [status, setStatus] = useState<Record<SourceKey, SourceStatus>>({
    metar: idleStatus(),
    nws: idleStatus(),
    windsAloft: idleStatus(),
    taf: idleStatus(),
  });
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const now = Date.now();
    const { dz, metarStation } = SITE;

    const updateSource = (key: SourceKey, next: SourceStatus): void =>
      setStatus((prev) => ({ ...prev, [key]: next }));

    const markStale = (key: SourceKey, err: unknown): void =>
      setStatus((prev) => ({
        ...prev,
        // Keep the last-good fetchedAt so the freshness panel still shows when
        // the data we're displaying was actually retrieved; just flag it stale.
        [key]: {
          ...prev[key],
          ok: false,
          stale: true,
          error: err instanceof Error ? err.message : String(err),
        },
      }));

    // Each source is fetched and applied independently so one failure doesn't
    // blank the others; on error we keep prior data and mark it stale.
    const metarP = fetchLatestObservation(metarStation.id)
      .then((current) => {
        setSnapshot((prev) => ({
          ...prev,
          current,
          densityAltitude:
            current?.altimeterInHg != null && current.tempC != null
              ? densityAltitude({
                  elevationFt: dz.elevationFt,
                  altimeterInHg: current.altimeterInHg,
                  oatC: current.tempC,
                })
              : prev.densityAltitude,
        }));
        updateSource('metar', okStatus());
      })
      .catch((e) => markStale('metar', e));

    const hourlyP = fetchHourly(dz.lat, dz.lon)
      .then((hourly) => {
        setSnapshot((prev) => ({ ...prev, hourly }));
        updateSource('nws', okStatus());
      })
      .catch((e) => markStale('nws', e));

    const windsP = fetchWindsAloft(dz.lat, dz.lon, dz.elevationFt, WINDS_ALOFT_LEVELS_AGL, now)
      .then((windsAloft) => {
        setSnapshot((prev) => ({ ...prev, windsAloft }));
        updateSource('windsAloft', okStatus());
      })
      .catch((e) => markStale('windsAloft', e));

    const tafP = fetchTaf(SITE.tafStation.id, SITE.tafStation.nwsProductLocation)
      .then((taf) => {
        setSnapshot((prev) => ({ ...prev, taf }));
        updateSource('taf', okStatus());
      })
      .catch((e) => markStale('taf', e));

    // Sun is computed locally and never fails.
    setSnapshot((prev) => ({ ...prev, sun: sunTimes(dz.lat, dz.lon, new Date(now)) }));

    void Promise.allSettled([metarP, hourlyP, windsP, tafP]).then(() => {
      setLastUpdated(Date.now());
      setLoading(false);
    });
  }, []);

  usePolling(refresh, REFRESH_MS);

  // Ticks every minute so time-based advisories (sunset countdowns, "after
  // sunset") stay current between the 10-minute data polls.
  const now = useNow(60_000);

  const advisories = useMemo(
    () => evaluateAdvisories(snapshot, thresholds, now),
    [snapshot, thresholds, now],
  );

  const decoratedStatus = useMemo(() => withStaleness(status), [status]);

  return { snapshot, advisories, status: decoratedStatus, loading, lastUpdated, refresh };
}

function withStaleness(status: Record<SourceKey, SourceStatus>): Record<SourceKey, SourceStatus> {
  const now = Date.now();
  const out = {} as Record<SourceKey, SourceStatus>;
  for (const key of Object.keys(status) as SourceKey[]) {
    const s = status[key];
    out[key] = { ...s, stale: s.stale || (s.fetchedAt != null && now - s.fetchedAt > STALE_AFTER_MS) };
  }
  return out;
}
