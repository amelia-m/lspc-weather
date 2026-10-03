import { Fragment, useEffect, useMemo, useState } from 'react';
import { METAR_STATION_OFFSET, REPO_URL, SITE } from './config/site';
import { DATA_SOURCES } from './config/sources';
import {
  resolveThresholds,
  profileLabel,
  WAIVER_TIERS,
  type Thresholds,
  type WindProfileId,
} from './config/thresholds';
import { useWeatherData } from './hooks/useWeatherData';
import { useWindsHour } from './hooks/useWindsHour';
import { AdvisoryPanel } from './components/AdvisoryPanel';
import { MetarPanel } from './components/MetarPanel';
import { CeilingSkyPanel } from './components/CeilingSkyPanel';
import { PrecipPanel } from './components/PrecipPanel';
import { RadarPanel } from './components/RadarPanel';
import { SectionalPanel } from './components/SectionalPanel';
import { PilotLinksPanel } from './components/PilotLinksPanel';
import { NearbyMetarsPanel } from './components/NearbyMetarsPanel';
import { VIEW_CARDS, VIEW_HASH, VIEW_LABEL, type CardId, type View } from './config/views';
import { HourlyForecastPanel } from './components/HourlyForecastPanel';
import { DailyForecastPanel } from './components/DailyForecastPanel';
import { DriftPanel } from './components/DriftPanel';
import { TafPanel } from './components/TafPanel';
import type { SpeedUnit } from './domain/units';
import { SurfaceWindPanel } from './components/SurfaceWindPanel';
import { WindsAloftPanel } from './components/WindsAloftPanel';
import { DensityAltitudePanel } from './components/DensityAltitudePanel';
import { SunPanel } from './components/SunPanel';
import { DataFreshness } from './components/DataFreshness';
import { SettingsPanel } from './components/SettingsPanel';
import { MasonryGrid } from './components/common/MasonryGrid';
import { CitationsPage } from './components/CitationsPage';
import { ParityPage, type ParityState } from './components/ParityPage';
import type { ParitySummary } from './domain/paritySummary';
import { UnitToggle } from './components/common/UnitToggle';
import { deriveProvenance } from './domain/sourceProvenance';
import { clearLogs, getLogs, loadPersistedLogs, type SourceLog } from './api/sourceLog';

const PROFILE_KEY = 'lspc:windProfile';
const OVERRIDES_KEY = 'lspc:thresholdOverrides';
const UNIT_KEY = 'lspc:windUnit';

type Overrides = Partial<Record<WindProfileId, Partial<Thresholds>>>;

// localStorage can throw (private mode, disabled cookies, quota). Guard every
// access so a storage failure degrades to in-memory state instead of a
// white-screen on mount. Mirrors the helpers in api/nws.ts.
function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — ignore */
  }
}

const VALID_PROFILE_IDS: readonly WindProfileId[] = [
  'student',
  'licensed',
  ...WAIVER_TIERS.map((t) => t.id),
];

/** Validate a persisted profile id; anything unknown falls back to 'student'. */
function toWindProfileId(raw: string | null): WindProfileId {
  return VALID_PROFILE_IDS.includes(raw as WindProfileId) ? (raw as WindProfileId) : 'student';
}

/** Sanitize persisted threshold overrides. localStorage is user-writable, so a
 *  corrupt or tampered value (a string where a number belongs, an unknown
 *  profile key) would silently break threshold comparisons. Keep only entries
 *  under valid profile ids whose values are finite numbers for numeric keys
 *  that exist in that profile's base Thresholds; drop everything else. */
function sanitizeOverrides(raw: unknown): Overrides {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Overrides = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (!VALID_PROFILE_IDS.includes(id as WindProfileId)) continue;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const base = resolveThresholds(id as WindProfileId);
    const clean: Partial<Thresholds> = {};
    for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
      const baseValue = (base as unknown as Record<string, unknown>)[key];
      if (typeof baseValue === 'number' && typeof value === 'number' && Number.isFinite(value)) {
        (clean as Record<string, number>)[key] = value;
      }
    }
    if (Object.keys(clean).length > 0) out[id as WindProfileId] = clean;
  }
  return out;
}

/** Which page or dashboard tab is showing. A hash rather than a router: the
 *  app is a single page served from a GitHub Pages subpath, and `#citations`,
 *  `#parity` or `#pilots` needs no server rewrite, no dependency, and
 *  survives a reload and a shared link. No hash is the Jumpers tab. */
function useRoute(): 'citations' | 'parity' | 'pilots' | null {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHashChange = (): void => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  if (hash === '#citations') return 'citations';
  if (hash === '#parity') return 'parity';
  if (hash === VIEW_HASH.pilots) return 'pilots';
  return null;
}

/** The parity page with its data: the summary the parity-summary workflow
 *  last published beside the site. Fetched relative to the page so it works
 *  under the Pages subpath and under a local build alike. */
function ParityRoute(): JSX.Element {
  const [state, setState] = useState<ParityState>('loading');
  const [summary, setSummary] = useState<ParitySummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}parity/summary.json`, { cache: 'no-cache' })
      .then(async (res) => {
        if (res.status === 404) return 'missing' as const;
        if (!res.ok) return 'error' as const;
        const data = (await res.json()) as ParitySummary;
        if (!cancelled) setSummary(data);
        return 'ready' as const;
      })
      .catch(() => 'error' as const)
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return <ParityPage summary={summary} state={state} />;
}

export default function App(): JSX.Element {
  const route = useRoute();
  /* Rehydrate the source log from localStorage before the first fetch runs, so
     a reload while chasing a flaky upstream keeps the history that explains it,
     and publish it on window for devtools. There is deliberately no in-page log
     viewer: the winds-aloft card states its own forecast valid time and Data
     health names the provider per source, which covers the everyday "why does
     this disagree with another tool" question without a debug surface. */
  useEffect(() => {
    loadPersistedLogs();
    window.LSPC_DEBUG = { getLogs, clearLogs };
    return () => {
      delete window.LSPC_DEBUG;
    };
  }, []);

  const [profile, setProfile] = useState<WindProfileId>(() =>
    toWindProfileId(safeLocalGet(PROFILE_KEY)),
  );
  useEffect(() => {
    safeLocalSet(PROFILE_KEY, profile);
  }, [profile]);

  const [overrides, setOverrides] = useState<Overrides>(() => {
    try {
      return sanitizeOverrides(JSON.parse(safeLocalGet(OVERRIDES_KEY) ?? '{}'));
    } catch {
      return {};
    }
  });
  useEffect(() => {
    safeLocalSet(OVERRIDES_KEY, JSON.stringify(overrides));
  }, [overrides]);

  const [unit, setUnit] = useState<SpeedUnit>(
    () => (safeLocalGet(UNIT_KEY) as SpeedUnit) || 'kt',
  );
  useEffect(() => {
    safeLocalSet(UNIT_KEY, unit);
  }, [unit]);

  const isWaiver = profile.startsWith('waiver');
  const base = useMemo(() => resolveThresholds(profile), [profile]);
  const profileOverride = overrides[profile];
  const thresholds = useMemo<Thresholds>(
    () => ({ ...base, ...(profileOverride ?? {}) }),
    [base, profileOverride],
  );
  const modified = !!profileOverride && Object.keys(profileOverride).length > 0;

  const setThreshold = (key: keyof Thresholds, value: number): void =>
    setOverrides((prev) => {
      const next: Partial<Thresholds> = { ...(prev[profile] ?? {}) };
      if (value === (base[key] as number)) delete next[key];
      else (next[key] as number) = value;
      const out = { ...prev, [profile]: next };
      if (Object.keys(next).length === 0) delete out[profile];
      return out;
    });
  const resetProfile = (): void =>
    setOverrides((prev) => {
      const out = { ...prev };
      delete out[profile];
      return out;
    });

  const { snapshot, advisories, status, lastUpdated, refresh } = useWeatherData(thresholds, unit);
  const winds = useWindsHour(snapshot);
  const provenance = useMemo(() => deriveProvenance(snapshot), [snapshot]);

  // Every hook above runs in both views, so switching routes cannot change hook
  // order. The weather polling keeps running behind the citations page, which is
  // what you want when someone ducks in to check a reference and comes back.
  if (route === 'citations') return <CitationsPage />;
  if (route === 'parity') return <ParityRoute />;
  const view: View = route === 'pilots' ? 'pilots' : 'jumpers';

  const cards: Record<CardId, JSX.Element> = {
    metar: <MetarPanel current={snapshot.current} unit={unit} onUnitChange={setUnit} />,
    surfaceWind: (
      <SurfaceWindPanel
        current={snapshot.current}
        thresholds={thresholds}
        label={profileLabel(profile)}
        wind500={winds.now500}
        unit={unit}
        onUnitChange={setUnit}
      />
    ),
    ceilingSky: <CeilingSkyPanel current={snapshot.current} hourly={snapshot.hourly} />,
    windsAloft: (
      <WindsAloftPanel
        levels={winds.levels}
        source={snapshot.windsAloftSource}
        validity={winds.validity}
        hourNav={winds.nav}
        unit={unit}
        onUnitChange={setUnit}
      />
    ),
    drift: (
      <DriftPanel
        levels={winds.levels}
        profile={profile}
        source={snapshot.windsAloftSource}
        validMs={winds.validity?.validMs ?? null}
        stepped={winds.nav != null && !winds.nav.following}
      />
    ),
    hourly: <HourlyForecastPanel hourly={snapshot.hourly} unit={unit} onUnitChange={setUnit} />,
    daily: (
      <DailyForecastPanel
        daily={snapshot.daily}
        source={snapshot.dailySource}
        hourly={snapshot.hourly}
        unit={unit}
        onUnitChange={setUnit}
      />
    ),
    precip: <PrecipPanel hourly={snapshot.hourly} current={snapshot.current} />,
    densityAltitude: <DensityAltitudePanel da={snapshot.densityAltitude} />,
    sun: <SunPanel sun={snapshot.sun} />,
    radar: <RadarPanel />,
    sectional: <SectionalPanel />,
    taf: <TafPanel taf={snapshot.taf} status={status.taf} />,
    pilotLinks: <PilotLinksPanel />,
    nearbyMetars: <NearbyMetarsPanel />,
  };

  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>LSPC Weather</h1>
          <p className="app-sub">
            {SITE.dz.name} ({SITE.dz.icao}) · Weeping Water, NE · obs from {SITE.metarStation.id} ·{' '}
            <a href={DATA_SOURCES.skyvector.url} target="_blank" rel="noopener noreferrer">
              sectional chart
            </a>
          </p>
        </div>
        {/* The kt/mph switch sits on each card that shows a wind speed AND
            here, because one card cannot host its own copy: "Conditions to
            note" prints wind in the active unit but renders through
            AdvisoryPanel, not Panel, so it has nowhere to put a toggle. On a
            375-px phone that panel is the one on screen at load while the
            nearest card toggle is below the fold — a reader who needs mph to
            check a flag against a limit quoted in mph would have to scroll past
            the flag to find the switch. Beside it stay the controls with no
            per-card home at all: the wind-limit profile and waiver tier are
            page-wide policy, not a display preference. */}
        <div className="toggles">
          <div className="class-toggle" role="group" aria-label="Wind-limit profile">
            <button className={profile === 'student' ? 'active' : ''} onClick={() => setProfile('student')}>
              Student
            </button>
            <button
              className={profile === 'licensed' ? 'active' : ''}
              onClick={() => setProfile('licensed')}
            >
              Licensed
            </button>
            <button
              className={isWaiver ? 'active' : ''}
              onClick={() => setProfile(isWaiver ? profile : WAIVER_TIERS[0].id)}
            >
              LSPC waiver
            </button>
          </div>
          {isWaiver && (
            <div className="tier-toggle" role="group" aria-label="Waiver experience tier">
              {WAIVER_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  className={tier.id === profile ? 'active' : ''}
                  onClick={() => setProfile(tier.id)}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          )}
          {/* Rendered outside a UnitToggleScope, so it names itself "Wind speed
              unit" — there is no card heading up here to borrow. */}
          <UnitToggle unit={unit} onChange={setUnit} />
        </div>
      </header>

      {/* Links, not buttons: each tab is an address (#pilots, or none for
          Jumpers), so the browser's back button, a reload and a shared link
          all land on the same tab. */}
      <nav className="view-tabs" aria-label="Dashboard view">
        {(Object.keys(VIEW_CARDS) as View[]).map((v) => (
          <a
            key={v}
            href={VIEW_HASH[v] || '#'}
            className={v === view ? 'active' : ''}
            aria-current={v === view ? 'page' : undefined}
          >
            {VIEW_LABEL[v]}
          </a>
        ))}
      </nav>

      <p className="disclaimer">
        <strong>
          In development — not endorsed or approved by USPA, LSPC, or any licensed professional.
        </strong>{' '}
        Advisory only: this dashboard flags conditions and cites guidance — it does not decide
        whether it is safe to jump. The citations to the USPA SIM, the CFRs and the FAA began as AI
        recollections and were read at their sources on 2026-09-22 and 2026-09-23; the club wind
        tiers are transcribed from a photo of the posted sign.{' '}
        <strong>None of that is a licensed professional&rsquo;s sign-off</strong> — verify every
        value against the primary source before relying on it. Always confirm conditions with
        current official sources, the S&amp;TA, and the pilot in command. Observations are from{' '}
        {SITE.metarStation.id} (~{Math.round(METAR_STATION_OFFSET.distanceMi)} mi{' '}
        {METAR_STATION_OFFSET.compass}); forecasts and winds are
        gridded to the drop zone.
      </p>

      <AdvisoryPanel
        advisories={advisories}
        profile={profileLabel(profile)}
        /* Not "is the wind high" — whether a source published a limit to flag
           it against. On the licensed profile nobody did, so the list below
           cannot carry surface wind at any speed and says so when it is
           otherwise empty. Same null that gates the flag and the card's band. */
        hasSourcedWindLimit={thresholds.windLimitCitation !== null}
      />

      {/* The cards each tab shows, in its order: src/config/views.ts. Order
          matters most on mobile, where the grid is a single linear column; at
          wider widths MasonryGrid drops each card into the shortest column, so
          a later card can sit above an earlier one. The key includes the view
          so switching tabs remounts the grid and it packs afresh. */}
      <MasonryGrid key={view}>
        {VIEW_CARDS[view].map((id) => (
          <Fragment key={id}>{cards[id]}</Fragment>
        ))}
      </MasonryGrid>

      <DataFreshness
        status={status}
        provenance={provenance}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
      />

      <SettingsPanel
        thresholds={thresholds}
        base={base}
        label={profileLabel(profile)}
        modified={modified}
        onChange={setThreshold}
        onReset={resetProfile}
      />

      <footer className="app-foot">
        Data: Iowa Environmental Mesonet, NWS / NOAA (api.weather.gov), Open-Meteo. Built for fun — fly safe.
        <br />
        <a href="#citations">Citations to verify</a> — what this dashboard claims, and what nobody
        has checked yet.
        <br />
        <a href="#parity">How different from other sources</a> — the winds table against Mark
        Schulze&rsquo;s and the observation against usairnet&rsquo;s, from the comparison logs.
        <br />
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          Source on GitHub
        </a>{' '}
        — the code, the citations&rsquo; readings, and the open questions.
      </footer>
    </div>
  );
}

/** Console-only handle on the fetch history. Declared optional because the
 *  property exists only while App is mounted — notably absent if the
 *  ErrorBoundary caught a crash during the first render, which is exactly when
 *  someone would reach for it. */
declare global {
  interface Window {
    LSPC_DEBUG?: { getLogs: () => readonly SourceLog[]; clearLogs: () => void };
  }
}
