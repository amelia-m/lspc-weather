import { useState } from 'react';
import { compass } from '../domain/units';
import { haversineMiles, initialBearingDeg } from '../domain/geo';
import { DZ_ON_RADAR_IMAGE, SITE } from '../config/site';
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
    <Panel className="panel-secondary" title="Radar" subtitle={`${r.id} · ~${miles} mi ${bearing}`} sources={[DATA_SOURCES.radar]}>
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
        <a
          className="radar-frame"
          href={DATA_SOURCES.radar.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="radar-img"
            src={loop}
            alt={`NWS ${r.id} radar loop`}
            loading="lazy"
            onError={() => setFailed(true)}
          />
          {/* Positioned in percentages so it tracks the image at any card
              width. Rendered as DOM rather than composited into the image: the
              source is an animated GIF and a canvas would freeze it to one
              frame, and an overlay stays sharp when the 600x550 image is
              scaled. (An earlier version of this comment blamed the CSP, and
              the one after it blamed canvas cross-origin taint. Neither is the
              reason — taint blocks reading pixels back out, not drawing over
              them.) */}
          {DZ_ON_RADAR_IMAGE && (
            <span
              className="radar-dz"
              style={{
                left: `${DZ_ON_RADAR_IMAGE.x * 100}%`,
                top: `${DZ_ON_RADAR_IMAGE.y * 100}%`,
              }}
              aria-hidden="true"
            />
          )}
        </a>
      )}
      {/* Both of these describe the image, so both go when it does. They used
          to sit outside the branch above: on a failed load the card said a ring
          marked the drop zone with no ring on screen, and invited the reader to
          tap an image that was not there. */}
      {!failed && (
        <>
          {DZ_ON_RADAR_IMAGE && (
            <p className="muted small">
              <span className="radar-dz-key" aria-hidden="true" /> marks the drop zone. Its position
              is derived from the DZ coordinates and the image&rsquo;s georeferencing, which NWS
              does not publish — it was measured against county boundaries, so read it as
              approximate.
            </p>
          )}
          <p className="muted small">
            Tap the image for the interactive radar; the loop updates every few minutes.
          </p>
        </>
      )}
    </Panel>
  );
}
