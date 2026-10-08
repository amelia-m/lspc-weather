import { Fragment, useEffect, useMemo, useState } from 'react';
import { SITE } from './config/site';
import {
  resolveThresholds,
  withOverrides,
  editedLimits,
  EDITABLE_LIMITS,
  EDITABLE_LIMIT_KEYS,
  isEditable,
  type EditableLimit,
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
import {
  advisoriesFor,
  VIEW_CARDS,
  VIEW_HASH,
  VIEW_LABEL,
  VIEW_USES_PROFILE,
  type CardId,
  type View,
} from './config/views';
import { HourlyForecastPanel } from './components/HourlyForecastPanel';
import { DailyForecastPanel } from './components/DailyForecastPanel';
import { DriftPanel } from './components/DriftPanel';
import { TafPanel } from './components/TafPanel';
import type { SpeedUnit, TempUnit } from './domain/units';
import type { WindsMethod } from './domain/types';
import { SurfaceWindPanel } from './components/SurfaceWindPanel';
import { WindsAloftPanel } from './components/WindsAloftPanel';
import { DensityAltitudePanel } from './components/DensityAltitudePanel';
import { SunPanel } from './components/SunPanel';
import { WingLoadingPanel } from './components/WingLoadingPanel';
import { DashboardDisclaimer } from './components/DashboardDisclaimer';
import { ProfileSelector } from './components/ProfileSelector';
import { AppFooter } from './components/AppFooter';
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
/** The student choice last made (BSR or a waiver tier), so Licensed and back
 *  returns to it; see ProfileSelector. */
const LAST_STUDENT_KEY = 'lspc:lastStudentProfile';
const LAST_TIER_KEY = 'lspc:lastWaiverTier';
const OVERRIDES_KEY = 'lspc:thresholdOverrides';
const UNIT_KEY = 'lspc:windUnit';
const TEMP_UNIT_KEY = 'lspc:tempUnit';
const WINDS_METHOD_KEY = 'lspc:windsMethod';

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
 *  under valid profile ids whose values are finite numbers for the limits
 *  Settings offers on that profile (`isEditable`); drop everything else. A stored value for any other field would change what a flag fires
 *  on with no row to see it and no "(edited)" mark anywhere. */
function sanitizeOverrides(raw: unknown): Overrides {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Overrides = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (!VALID_PROFILE_IDS.includes(id as WindProfileId)) continue;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const base = resolveThresholds(id as WindProfileId);
    const clean: Partial<Thresholds> = {};
    for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
      if (!(EDITABLE_LIMIT_KEYS as string[]).includes(key)) continue;
      if (!isEditable(base, key as EditableLimit)) continue;
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
  // The student choice and the waiver tier last made, so Licensed and back,
  // or BSR and back to the waiver, returns to them (ProfileSelector). The
  // profile itself is the truth when it is a student one.
  const [lastStudent, setLastStudent] = useState<WindProfileId>(() => {
    if (profile !== 'licensed') return profile;
    const stored = toWindProfileId(safeLocalGet(LAST_STUDENT_KEY));
    return stored !== 'licensed' ? stored : 'student';
  });
  const [lastTier, setLastTier] = useState<WindProfileId>(() => {
    if (profile.startsWith('waiver')) return profile;
    const stored = toWindProfileId(safeLocalGet(LAST_TIER_KEY));
    return stored.startsWith('waiver') ? stored : WAIVER_TIERS[0].id;
  });
  const chooseProfile = (p: WindProfileId): void => {
    setProfile(p);
    if (p !== 'licensed') {
      setLastStudent(p);
      safeLocalSet(LAST_STUDENT_KEY, p);
    }
    if (p.startsWith('waiver')) {
      setLastTier(p);
      safeLocalSet(LAST_TIER_KEY, p);
    }
  };

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
  // °F unless a reader chose °C. Before this setting the cards disagreed
  // (Current conditions and density altitude printed °C, the outlook °F,
  // winds aloft both), so either default changes some card; °F is the unit
  // most jumpers here read a temperature in.
  const [tempUnit, setTempUnit] = useState<TempUnit>(() => (safeLocalGet(TEMP_UNIT_KEY) === 'C' ? 'C' : 'F'));
  useEffect(() => {
    safeLocalSet(TEMP_UNIT_KEY, tempUnit);
  }, [tempUnit]);
  const temp = { tempUnit, onTempUnitChange: setTempUnit };

  const base = useMemo(() => resolveThresholds(profile), [profile]);
  const profileOverride = overrides[profile];
  const thresholds = useMemo<Thresholds>(
    () => withOverrides(base, profileOverride),
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

  const view: View = route === 'pilots' ? 'pilots' : 'jumpers';
  // The Pilots tab has no Settings, so its flags fire on the profile's
  // published figures, not on edits a reader made for a jumper profile on
  // the other tab: an edit there would otherwise move the visibility flag a
  // pilot sees, from a control the pilot cannot see. (The profile itself
  // only sets the jumper wind flags, which that tab leaves off.)
  const advisoryThresholds = VIEW_USES_PROFILE[view] ? thresholds : base;
  const { snapshot, advisories, status, lastUpdated, refresh } = useWeatherData(advisoryThresholds, unit);
  // Every level by default; "as Schulze" rebuilds the table his way so a
  // reader can check one against the other (WindsAloftPanel).
  const [windsMethod, setWindsMethod] = useState<WindsMethod>(() =>
    safeLocalGet(WINDS_METHOD_KEY) === 'schulze' ? 'schulze' : 'all',
  );
  useEffect(() => {
    safeLocalSet(WINDS_METHOD_KEY, windsMethod);
  }, [windsMethod]);
  const winds = useWindsHour(snapshot, windsMethod);
  const provenance = useMemo(() => deriveProvenance(snapshot), [snapshot]);

  // Every hook above runs in both views, so switching routes cannot change hook
  // order. The weather polling keeps running behind the citations page, which is
  // what you want when someone ducks in to check a reference and comes back.
  if (route === 'citations') return <CitationsPage />;
  if (route === 'parity') return <ParityRoute />;

  const cards: Record<CardId, JSX.Element> = {
    metar: <MetarPanel current={snapshot.current} unit={unit} onUnitChange={setUnit} {...temp} />,
    surfaceWind: (
      <SurfaceWindPanel
        current={snapshot.current}
        thresholds={thresholds}
        label={profileLabel(profile)}
        unit={unit}
        onUnitChange={setUnit}
      />
    ),
    ceilingSky: (
      <CeilingSkyPanel current={snapshot.current} hourly={snapshot.hourly} omClouds={snapshot.openMeteoClouds ?? null} />
    ),
    windsAloft: (
      <WindsAloftPanel
        levels={winds.levels}
        source={snapshot.windsAloftSource}
        validity={winds.validity}
        hourNav={winds.nav}
        unit={unit}
        onUnitChange={setUnit}
        {...temp}
        method={windsMethod}
        onMethodChange={setWindsMethod}
        schulzeAvailable={winds.schulzeAvailable}
        schulzeGroundFtMsl={winds.schulzeGroundFtMsl}
      />
    ),
    drift: (
      <DriftPanel
        levels={winds.levels}
        source={snapshot.windsAloftSource}
        validMs={winds.validity?.validMs ?? null}
        hourNav={winds.nav}
      />
    ),
    hourly: (
      <HourlyForecastPanel
        hourly={snapshot.hourly}
        unit={unit}
        onUnitChange={setUnit}
        limits={thresholds}
        profile={profileLabel(profile)}
      />
    ),
    daily: (
      <DailyForecastPanel
        daily={snapshot.daily}
        source={snapshot.dailySource}
        hourly={snapshot.hourly}
        unit={unit}
        onUnitChange={setUnit}
        {...temp}
        limits={thresholds}
        profile={profileLabel(profile)}
      />
    ),
    precip: <PrecipPanel hourly={snapshot.hourly} current={snapshot.current} />,
    densityAltitude: <DensityAltitudePanel da={snapshot.densityAltitude} {...temp} />,
    sun: <SunPanel sun={snapshot.sun} />,
    wingLoading: <WingLoadingPanel />,
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
            {SITE.dz.name} ({SITE.dz.icao}) · Weeping Water, NE · obs from {SITE.metarStation.id}
          </p>
        </div>
        {/* The kt/mph switch sits on each card that shows a wind speed AND
            here, because one card cannot host its own copy: "Conditions to
            note" prints wind in the active unit but renders through
            AdvisoryPanel, not Panel, so it has nowhere to put a toggle. On a
            375-px phone that panel is the one on screen at load while the
            nearest card toggle is below the fold — a reader who needs mph to
            check a flag against a limit quoted in mph would have to scroll past
            the flag to find the switch (on the Jumpers tab; the Pilots list
            carries no wind flag, but the cards there print speeds). Beside it stay the controls with no
            per-card home at all: the wind-limit profile and waiver tier are
            page-wide policy, not a display preference. They are a jumper's
            limits, so the Pilots tab shows neither (VIEW_USES_PROFILE). */}
        <div className="toggles">
          {VIEW_USES_PROFILE[view] && <ProfileSelector profile={profile} lastStudent={lastStudent} lastTier={lastTier} onChange={chooseProfile} />}
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

      <DashboardDisclaimer />

      <AdvisoryPanel
        advisories={advisoriesFor(view, advisories)}
        profile={profileLabel(profile)}
        /* Not "is the wind high" — whether a source published a limit to flag
           it against. On the licensed profile nobody did, so the Jumpers list
           cannot carry surface wind at any speed and says so when it is
           otherwise empty; the Pilots list carries no jumper wind flag on
           any profile and says that instead (forPilots). Same null that
           gates the flag and the card's band. */
        hasSourcedWindLimit={thresholds.windLimitCitation !== null}
        editedLimits={editedLimits(advisoryThresholds).map((k) => EDITABLE_LIMITS[k].label)}
        forPilots={!VIEW_USES_PROFILE[view]}
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

      {VIEW_USES_PROFILE[view] && (
        <SettingsPanel
          thresholds={thresholds}
          base={base}
          label={profileLabel(profile)}
          modified={modified}
          onChange={setThreshold}
          onReset={resetProfile}
        />
      )}

      <AppFooter />
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
