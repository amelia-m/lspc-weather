import { useCallback, useMemo, useRef, useState } from 'react';
import {
  fetchDailyFromGridpoint,
  fetchHourly,
  fetchLatestObservation,
  fetchTafAny,
  fetchWindsAloftFd,
} from '../api/nws';
import { fetchDailyForecast, fetchWindsAloft } from '../api/openMeteo';
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
/** How soon to re-try after a cycle with failures (see quick-retry below). */
const QUICK_RETRY_MS = 45 * 1000;

const okStatus = (): SourceStatus => ({
  ok: true,
  fetchedAt: Date.now(),
  stale: false,
  error: null,
  pending: false,
});
const idleStatus = (): SourceStatus => ({
  ok: false,
  fetchedAt: null,
  stale: false,
  error: null,
  pending: false,
});

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
  daily: [],
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
    daily: idleStatus(),
  });
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick-retry bookkeeping: one early re-fetch per failure streak, so a
  // transient blip (e.g. a mobile network timing out one API) self-heals in
  // ~45 s instead of waiting out the 10-minute poll — without tightening the
  // poll loop against an API that is actually down.
  const refreshRef = useRef<() => void>(() => {});
  const quickRetryUsed = useRef(false);
  const quickRetryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(() => {
    const now = Date.now();
    const { dz, metarStation } = SITE;
    clearTimeout(quickRetryTimer.current);
    let failures = 0;

    // Flag every source as in-flight so the UI can show that a refresh is
    // actually happening — a hung request otherwise looks like a dead button.
    setStatus((prev) => {
      const out = {} as Record<SourceKey, SourceStatus>;
      for (const key of Object.keys(prev) as SourceKey[]) {
        out[key] = { ...prev[key], pending: true };
      }
      return out;
    });

    // Each settle bumps the panel's "Updated" line, so fast sources register
    // immediately instead of waiting for the slowest fetch to time out.
    const updateSource = (key: SourceKey, next: SourceStatus): void => {
      setLastUpdated(Date.now());
      setStatus((prev) => ({ ...prev, [key]: next }));
    };

    const markStale = (key: SourceKey, err: unknown): void => {
      failures++;
      setLastUpdated(Date.now());
      setStatus((prev) => ({
        ...prev,
        // Keep the last-good fetchedAt so the freshness panel still shows when
        // the data we're displaying was actually retrieved; just flag it stale.
        [key]: {
          ...prev[key],
          ok: false,
          stale: true,
          error: err instanceof Error ? err.message : String(err),
          pending: false,
        },
      }));
    };

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
        setSnapshot((prev) => ({ ...prev, windsAloft, windsAloftSource: 'open-meteo' }));
        updateSource('windsAloft', okStatus());
      })
      .catch(async (e) => {
        // Open-Meteo unreachable (some networks block that host) — fall back
        // to the NOAA FD winds-aloft product on api.weather.gov. No surface
        // (0 AGL) target: the bulletin's lowest level is 3,000 ft MSL and
        // extrapolating it to the ground would overstate surface wind.
        try {
          const fd = await fetchWindsAloftFd(
            SITE.fdWindsStation,
            dz.elevationFt,
            WINDS_ALOFT_LEVELS_AGL.filter((a) => a > 0),
          );
          if (fd && fd.length > 0) {
            setSnapshot((prev) => ({ ...prev, windsAloft: fd, windsAloftSource: 'nws-fd' }));
            updateSource('windsAloft', okStatus());
            return;
          }
        } catch {
          /* report the original Open-Meteo error below */
        }
        markStale('windsAloft', e);
      });

    const tafP = fetchTafAny(SITE.tafStations)
      .then((taf) => {
        setSnapshot((prev) => ({ ...prev, taf }));
        updateSource('taf', okStatus());
      })
      .catch((e) => markStale('taf', e));

    const dailyP = fetchDailyForecast(dz.lat, dz.lon)
      .then((daily) => {
        setSnapshot((prev) => ({ ...prev, daily, dailySource: 'open-meteo' }));
        updateSource('daily', okStatus());
      })
      .catch(async (e) => {
        // Open-Meteo unreachable — aggregate the NWS gridpoint hourlies into
        // a ~7-day outlook instead (same host as the working forecast).
        try {
          const daily = await fetchDailyFromGridpoint(dz.lat, dz.lon, SITE.timeZone);
          if (daily.length > 0) {
            setSnapshot((prev) => ({ ...prev, daily, dailySource: 'nws-gridpoint' }));
            updateSource('daily', okStatus());
            return;
          }
        } catch {
          /* report the original Open-Meteo error below */
        }
        markStale('daily', e);
      });

    // Sun is computed locally and never fails.
    setSnapshot((prev) => ({ ...prev, sun: sunTimes(dz.lat, dz.lon, new Date(now)) }));

    void Promise.allSettled([metarP, hourlyP, windsP, tafP, dailyP]).then(() => {
      setLoading(false);
      if (failures === 0) {
        quickRetryUsed.current = false;
      } else if (!quickRetryUsed.current) {
        quickRetryUsed.current = true;
        quickRetryTimer.current = setTimeout(() => refreshRef.current(), QUICK_RETRY_MS);
      }
    });
  }, []);
  refreshRef.current = refresh;

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
