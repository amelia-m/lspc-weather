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
import { logSource } from '../api/sourceLog';
import type {
  Advisory,
  SourceKey,
  SourceStatus,
  WeatherSnapshot,
  WindsAloftValidity,
} from '../domain/types';
import type { SpeedUnit } from '../domain/units';
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

export function useWeatherData(thresholds: Thresholds, unit: SpeedUnit = 'kt'): WeatherData {
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
                  dewpointC: current.dewpointC,
                })
              : prev.densityAltitude,
        }));
        logSource('metar', 'success', `METAR from ${metarStation.id}`);
        // The two decodes of the report disagreeing is worth a log line of its
        // own: the chip on Data health shows it now, and this is how it is
        // reconstructed later from a laptop (window.LSPC_DEBUG.getLogs()).
        if (current?.skyDecode !== undefined && current.skyDecode !== 'agrees') {
          logSource('metar', 'fallback', `sky decode: ${current.skyDecode} (${current.raw})`);
        }
        updateSource('metar', okStatus());
      })
      .catch((e) => {
        logSource('metar', 'failure', 'METAR fetch failed', e);
        markStale('metar', e);
      });

    const hourlyP = fetchHourly(dz.lat, dz.lon)
      .then((hourly) => {
        setSnapshot((prev) => ({ ...prev, hourly }));
        logSource('nws', 'success', `NWS hourly (${hourly.length} hours)`);
        updateSource('nws', okStatus());
      })
      .catch((e) => {
        logSource('nws', 'failure', 'NWS hourly fetch failed', e);
        markStale('nws', e);
      });

    const windsP = fetchWindsAloft(dz.lat, dz.lon, dz.elevationFt, WINDS_ALOFT_LEVELS_AGL, now)
      .then(({ levels, validity }) => {
        setSnapshot((prev) => ({
          ...prev,
          windsAloft: levels,
          windsAloftSource: 'open-meteo',
          windsAloftValidity: validity,
        }));
        logSource('windsAloft', 'success', `Open-Meteo winds aloft ${describeValidity(validity)}`);
        updateSource('windsAloft', okStatus());
      })
      .catch(async (e) => {
        logSource('windsAloft', 'failure', 'Open-Meteo unreachable, trying NOAA FD fallback', e);
        // Open-Meteo unreachable (some networks block that host) — fall back
        // to the NOAA FD winds-aloft product on api.weather.gov. The 0 AGL
        // target is dropped here as well as by interpolateWindsAloft, which no
        // longer extrapolates below the lowest sample: asking for a level the
        // bulletin cannot answer and discarding the answer is wasted work, and
        // leaving the filter also keeps this call honest if the interpolator's
        // contract ever loosens again.
        try {
          const fd = await fetchWindsAloftFd(
            SITE.fdWindsStation,
            dz.elevationFt,
            WINDS_ALOFT_LEVELS_AGL.filter((a) => a > 0),
            now,
          );
          if (fd && fd.levels.length > 0) {
            setSnapshot((prev) => ({
              ...prev,
              windsAloft: fd.levels,
              windsAloftSource: 'nws-fd',
              windsAloftValidity: fd.validity,
            }));
            logSource(
              'windsAloft',
              'fallback',
              `NOAA FD fallback (${fd.levels.length} levels) ${describeValidity(fd.validity)}`,
            );
            updateSource('windsAloft', okStatus());
            return;
          }
        } catch (fdError) {
          logSource('windsAloft', 'failure', 'NOAA FD fallback also failed', fdError);
          /* report the original Open-Meteo error below */
        }
        markStale('windsAloft', e);
      });

    const tafP = fetchTafAny(SITE.tafStations)
      .then((taf) => {
        setSnapshot((prev) => ({ ...prev, taf }));
        if (taf) {
          logSource('taf', 'success', `TAF from ${taf.station}`);
          updateSource('taf', okStatus());
        } else {
          // The whole chain came back product-less: an NWS feed gap, not a
          // success. Mark it so Data health shows the gap and the quick
          // retry / next poll keeps trying.
          const err = new Error(
            `NWS product feed listed no TAF for ${SITE.tafStations.map((s) => s.id).join('/')}`,
          );
          logSource('taf', 'failure', 'No TAF in NWS feed', err);
          markStale('taf', err);
        }
      })
      .catch((e) => {
        logSource('taf', 'failure', 'TAF fetch failed', e);
        markStale('taf', e);
      });

    const dailyP = fetchDailyForecast(dz.lat, dz.lon)
      .then((daily) => {
        setSnapshot((prev) => ({ ...prev, daily, dailySource: 'open-meteo' }));
        logSource('daily', 'success', `Open-Meteo daily (${daily.length} days)`);
        updateSource('daily', okStatus());
      })
      .catch(async (e) => {
        logSource('daily', 'failure', 'Open-Meteo unreachable, trying NWS gridpoint fallback', e);
        // Open-Meteo unreachable — aggregate the NWS gridpoint hourlies into
        // a ~7-day outlook instead (same host as the working forecast).
        try {
          const daily = await fetchDailyFromGridpoint(dz.lat, dz.lon, SITE.timeZone);
          if (daily.length > 0) {
            setSnapshot((prev) => ({ ...prev, daily, dailySource: 'nws-gridpoint' }));
            logSource('daily', 'fallback', `NWS gridpoint fallback (${daily.length} days)`);
            updateSource('daily', okStatus());
            return;
          }
        } catch (npError) {
          logSource('daily', 'failure', 'NWS gridpoint fallback also failed', npError);
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
    () => evaluateAdvisories(snapshot, thresholds, now, unit),
    [snapshot, thresholds, now, unit],
  );

  const decoratedStatus = useMemo(() => withStaleness(status), [status]);

  return { snapshot, advisories, status: decoratedStatus, loading, lastUpdated, refresh };
}

/**
 * Render a winds-aloft valid time for the source log.
 *
 * The winds-aloft success line used to be the constant "Open-Meteo winds
 * aloft", which could not answer the only question anyone opens the log for:
 * WHICH forecast hour the numbers on screen were. Both the Zulu stamp (what
 * Mark Schulze's Winds Aloft prints) and the signed offset from the clock go in,
 * so a disagreement reported hours later is still diagnosable from the log
 * alone. Time is read here, in the hook, rather than in any src/domain module.
 */
function describeValidity(validity: WindsAloftValidity): string {
  if (validity.validMs == null) return 'valid time not stated by source';
  const d = new Date(validity.validMs);
  const zulu = `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
  const offsetMin = Math.round((validity.validMs - Date.now()) / 60_000);
  // ASCII sign, not a typographic minus: log lines get grepped and pasted.
  const offset = `${offsetMin >= 0 ? '+' : '-'}${Math.abs(offsetMin)} min vs now`;
  const extra = [
    validity.forUseRaw ? `for use ${validity.forUseRaw}Z` : null,
    validity.basedOnMs != null ? `based on ${new Date(validity.basedOnMs).toISOString()}` : null,
  ].filter((p): p is string => p != null);
  return `valid ${d.toISOString()} (${zulu}, ${offset})${extra.length ? `, ${extra.join(', ')}` : ''}`;
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
