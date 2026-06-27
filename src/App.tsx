import { useEffect, useState } from 'react';
import { SITE } from './config/site';
import type { JumperClass } from './domain/types';
import { useWeatherData } from './hooks/useWeatherData';
import { AdvisoryPanel } from './components/AdvisoryPanel';
import { MetarPanel } from './components/MetarPanel';
import { CeilingSkyPanel } from './components/CeilingSkyPanel';
import { SurfaceWindPanel } from './components/SurfaceWindPanel';
import { WindsAloftPanel } from './components/WindsAloftPanel';
import { DensityAltitudePanel } from './components/DensityAltitudePanel';
import { SunPanel } from './components/SunPanel';
import { DataFreshness } from './components/DataFreshness';

const CLASS_KEY = 'lspc:jumperClass';

export default function App(): JSX.Element {
  const [jumperClass, setJumperClass] = useState<JumperClass>(
    () => (localStorage.getItem(CLASS_KEY) as JumperClass) || 'student',
  );
  useEffect(() => {
    localStorage.setItem(CLASS_KEY, jumperClass);
  }, [jumperClass]);

  const { snapshot, advisories, status, lastUpdated, refresh } = useWeatherData(jumperClass);

  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>LSPC Weather</h1>
          <p className="app-sub">
            {SITE.dz.name} ({SITE.dz.icao}) · Weeping Water, NE · obs from {SITE.metarStation.id}
          </p>
        </div>
        <div className="class-toggle" role="group" aria-label="Jumper class">
          {(['student', 'licensed'] as JumperClass[]).map((c) => (
            <button
              key={c}
              className={c === jumperClass ? 'active' : ''}
              onClick={() => setJumperClass(c)}
            >
              {c}
            </button>
          ))}
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
        <SurfaceWindPanel current={snapshot.current} jumperClass={jumperClass} />
        <WindsAloftPanel levels={snapshot.windsAloft} />
        <CeilingSkyPanel current={snapshot.current} hourly={snapshot.hourly} />
        <DensityAltitudePanel da={snapshot.densityAltitude} />
        <SunPanel sun={snapshot.sun} />
      </div>

      <DataFreshness status={status} lastUpdated={lastUpdated} onRefresh={refresh} />

      <footer className="app-foot">
        Data: NWS (api.weather.gov), AviationWeather.gov, Open-Meteo. Built for fun — fly safe.
      </footer>
    </div>
  );
}
