import { useCallback, useMemo, useState } from 'react';
import { fetchMetar } from '../api/aviationweather';
import { fetchHourly } from '../api/nws';
import { fetchWindsAloft } from '../api/openMeteo';
import { evaluateAdvisories } from '../domain/advisories';
import { densityAltitude } from '../domain/densityAltitude';
import { sunTimes } from '../domain/sun';
import type {
  Advisory,
  JumperClass,
  SourceKey,
  SourceStatus,
  WeatherSnapshot,
} from '../domain/types';
import { DEFAULT_THRESHOLDS } from '../config/thresholds';
import { SITE, WINDS_ALOFT_LEVELS_AGL } from '../config/site';
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
};

export function useWeatherData(jumperClass: JumperClass): WeatherData {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot>(EMPTY_SNAPSHOT);
  const [status, setStatus] = useState<Record<SourceKey, SourceStatus>>({
    metar: idleStatus(),
    nws: idleStatus(),
    windsAloft: idleStatus(),
  });
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const now = Date.now();
    const { dz, metarStation } = SITE;

    const updateSource = (key: SourceKey, next: SourceStatus): void =>
      setStatus((prev) => ({ ...prev, [key]: next }));

    // Each source is fetched and applied independently so one failure doesn't
    // blank the others; on error we keep prior data and mark it stale.
    const metarP = fetchMetar(metarStation.id)
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
      .catch((e) => markStale('metar', e, updateSource));

    const hourlyP = fetchHourly(dz.lat, dz.lon)
      .then((hourly) => {
        setSnapshot((prev) => ({ ...prev, hourly }));
        updateSource('nws', okStatus());
      })
      .catch((e) => markStale('nws', e, updateSource));

    const windsP = fetchWindsAloft(dz.lat, dz.lon, dz.elevationFt, WINDS_ALOFT_LEVELS_AGL, now)
      .then((windsAloft) => {
        setSnapshot((prev) => ({ ...prev, windsAloft }));
        updateSource('windsAloft', okStatus());
      })
      .catch((e) => markStale('windsAloft', e, updateSource));

    // Sun is computed locally and never fails.
    setSnapshot((prev) => ({ ...prev, sun: sunTimes(dz.lat, dz.lon, new Date(now)) }));

    void Promise.allSettled([metarP, hourlyP, windsP]).then(() => {
      setLastUpdated(Date.now());
      setLoading(false);
    });
  }, []);

  usePolling(refresh, REFRESH_MS);

  const advisories = useMemo(
    () => evaluateAdvisories(snapshot, DEFAULT_THRESHOLDS[jumperClass], jumperClass, Date.now()),
    [snapshot, jumperClass],
  );

  const decoratedStatus = useMemo(() => withStaleness(status), [status]);

  return { snapshot, advisories, status: decoratedStatus, loading, lastUpdated, refresh };
}

function markStale(
  key: SourceKey,
  err: unknown,
  update: (k: SourceKey, s: SourceStatus) => void,
): void {
  update(key, {
    ok: false,
    fetchedAt: null,
    stale: true,
    error: err instanceof Error ? err.message : String(err),
  });
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
