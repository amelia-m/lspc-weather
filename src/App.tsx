import { useEffect, useMemo, useState } from 'react';
import { SITE } from './config/site';
import {
  resolveThresholds,
  profileLabel,
  WAIVER_TIERS,
  type Thresholds,
  type WindProfileId,
} from './config/thresholds';
import { useWeatherData } from './hooks/useWeatherData';
import { AdvisoryPanel } from './components/AdvisoryPanel';
import { MetarPanel } from './components/MetarPanel';
import { CeilingSkyPanel } from './components/CeilingSkyPanel';
import { PrecipPanel } from './components/PrecipPanel';
import { RadarPanel } from './components/RadarPanel';
import { HourlyForecastPanel } from './components/HourlyForecastPanel';
import { DriftPanel } from './components/DriftPanel';
import { TafPanel } from './components/TafPanel';
import type { SpeedUnit } from './domain/units';
import { SurfaceWindPanel } from './components/SurfaceWindPanel';
import { WindsAloftPanel } from './components/WindsAloftPanel';
import { DensityAltitudePanel } from './components/DensityAltitudePanel';
import { SunPanel } from './components/SunPanel';
import { DataFreshness } from './components/DataFreshness';
import { SettingsPanel } from './components/SettingsPanel';

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

export default function App(): JSX.Element {
  const [profile, setProfile] = useState<WindProfileId>(
    () => (safeLocalGet(PROFILE_KEY) as WindProfileId) || 'student',
  );
  useEffect(() => {
    safeLocalSet(PROFILE_KEY, profile);
  }, [profile]);

  const [overrides, setOverrides] = useState<Overrides>(() => {
    try {
      return JSON.parse(safeLocalGet(OVERRIDES_KEY) ?? '{}') as Overrides;
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

  const { snapshot, advisories, status, lastUpdated, refresh } = useWeatherData(thresholds);

  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>LSPC Weather</h1>
          <p className="app-sub">
            {SITE.dz.name} ({SITE.dz.icao}) · Weeping Water, NE · obs from {SITE.metarStation.id}
          </p>
        </div>
        <div className="toggles">
          <div className="unit-toggle" role="group" aria-label="Wind speed unit">
            {(['kt', 'mph'] as SpeedUnit[]).map((u) => (
              <button key={u} className={u === unit ? 'active' : ''} onClick={() => setUnit(u)}>
                {u}
              </button>
            ))}
          </div>
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
        </div>
      </header>

      <p className="disclaimer">
        <strong>
          In development — not endorsed or approved by USPA, LSPC, or any licensed professional.
        </strong>{' '}
        Advisory only: this dashboard flags conditions and cites guidance — it does not decide
        whether it is safe to jump. The citations to the USPA SIM, the CFRs, and other sources are{' '}
        <strong>AI-derived and may be inaccurate</strong>; verify every value against the primary
        source and with a licensed professional before relying on it. Always confirm conditions with
        current official sources, the S&amp;TA, and the pilot in command. Observations are from{' '}
        {SITE.metarStation.id} (~{SITE.metarStation.distanceMi} mi away); forecasts and winds are
        gridded to the drop zone.
      </p>

      <AdvisoryPanel advisories={advisories} />

      <div className="grid">
        <MetarPanel current={snapshot.current} unit={unit} />
        <SurfaceWindPanel
          current={snapshot.current}
          thresholds={thresholds}
          label={profileLabel(profile)}
          unit={unit}
        />
        <WindsAloftPanel levels={snapshot.windsAloft} unit={unit} />
        <DriftPanel levels={snapshot.windsAloft} />
        <HourlyForecastPanel hourly={snapshot.hourly} unit={unit} />
        <CeilingSkyPanel current={snapshot.current} hourly={snapshot.hourly} />
        <PrecipPanel hourly={snapshot.hourly} current={snapshot.current} />
        <RadarPanel />
        <TafPanel taf={snapshot.taf} />
        <DensityAltitudePanel da={snapshot.densityAltitude} />
        <SunPanel sun={snapshot.sun} />
      </div>

      <DataFreshness status={status} lastUpdated={lastUpdated} onRefresh={refresh} />

      <SettingsPanel
        thresholds={thresholds}
        base={base}
        label={profileLabel(profile)}
        modified={modified}
        onChange={setThreshold}
        onReset={resetProfile}
      />

      <footer className="app-foot">
        Data: NWS / NOAA (api.weather.gov), Open-Meteo. Built for fun — fly safe.
      </footer>
    </div>
  );
}
