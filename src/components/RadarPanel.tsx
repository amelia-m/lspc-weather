import { useState } from 'react';
import { compass } from '../domain/units';
import { haversineMiles, initialBearingDeg } from '../domain/geo';
import { SITE } from '../config/site';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';

/** NWS radar loop (animated GIF) for the covering WSR-88D, shown as a
 *  cross-origin <img> (no fetch/CORS), with a link to the interactive radar. */
export function RadarPanel(): JSX.Element {
  const [failed, setFailed] = useState(false);
  const { dz, radarSite: r } = SITE;
  const miles = Math.round(haversineMiles(dz.lat, dz.lon, r.lat, r.lon));
  const bearing = compass(initialBearingDeg(dz.lat, dz.lon, r.lat, r.lon));
  const loop = `https://radar.weather.gov/ridge/standard/${r.id}_loop.gif`;

  return (
    <Panel title="Radar" subtitle={`${r.id} · ~${miles} mi ${bearing}`} sources={[DATA_SOURCES.radar]}>
      <p className="muted small">
        {r.name} ({r.id}) WSR-88D — covers the drop zone (~{miles} mi {bearing}).
      </p>
      {failed ? (
        <p className="muted">
          Radar image unavailable.{' '}
          <a href={DATA_SOURCES.radar.url} target="_blank" rel="noopener noreferrer">
            Open the interactive radar →
          </a>
        </p>
      ) : (
        <a href={DATA_SOURCES.radar.url} target="_blank" rel="noopener noreferrer">
          <img
            className="radar-img"
            src={loop}
            alt={`NWS ${r.id} radar loop`}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        </a>
      )}
      <p className="muted small">Tap the image for the interactive radar; the loop updates every few minutes.</p>
    </Panel>
  );
}
