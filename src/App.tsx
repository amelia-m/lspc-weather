import { useEffect, useMemo, useState } from 'react';
import { SITE } from './config/site';
import {
  resolveThresholds,
  profileLabel,
  WAIVER_TIERS,
  type WindProfileId,
} from './config/thresholds';
import { useWeatherData } from './hooks/useWeatherData';
import { AdvisoryPanel } from './components/AdvisoryPanel';
import { MetarPanel } from './components/MetarPanel';
import { CeilingSkyPanel } from './components/CeilingSkyPanel';
import { PrecipPanel } from './components/PrecipPanel';
import { RadarPanel } from './components/RadarPanel';
import { TafPanel } from './components/TafPanel';
import { SurfaceWindPanel } from './components/SurfaceWindPanel';
import { WindsAloftPanel } from './components/WindsAloftPanel';
import { DensityAltitudePanel } from './components/DensityAltitudePanel';
import { SunPanel } from './components/SunPanel';
import { DataFreshness } from './components/DataFreshness';

const PROFILE_KEY = 'lspc:windProfile';

export default function App(): JSX.Element {
  const [profile, setProfile] = useState<WindProfileId>(
    () => (localStorage.getItem(PROFILE_KEY) as WindProfileId) || 'student',
  );
  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, profile);
  }, [profile]);

  const isWaiver = profile.startsWith('waiver');
  const thresholds = useMemo(() => resolveThresholds(profile), [profile]);
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
        <MetarPanel current={snapshot.current} />
        <SurfaceWindPanel
          current={snapshot.current}
          thresholds={thresholds}
          label={profileLabel(profile)}
        />
        <WindsAloftPanel levels={snapshot.windsAloft} />
        <CeilingSkyPanel current={snapshot.current} hourly={snapshot.hourly} />
        <PrecipPanel hourly={snapshot.hourly} current={snapshot.current} />
        <RadarPanel />
        <TafPanel taf={snapshot.taf} />
        <DensityAltitudePanel da={snapshot.densityAltitude} />
        <SunPanel sun={snapshot.sun} />
      </div>

      <DataFreshness status={status} lastUpdated={lastUpdated} onRefresh={refresh} />

      <footer className="app-foot">
        Data: NWS / NOAA (api.weather.gov), Open-Meteo. Built for fun — fly safe.
      </footer>
    </div>
  );
}
