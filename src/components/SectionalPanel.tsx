import { useState } from 'react';
import { SITE } from '../config/site';
import { DATA_SOURCES, FAA_SECTIONAL_TILES } from '../config/sources';
import { TILE_PX, tilesAround } from '../domain/slippyTiles';
import { Panel } from './common/Panel';

/** Zoom 10 shows about 25 miles across a card: Plattsmouth, Weeping Water and
 *  the edge of Offutt's airspace. One step out shows the Omaha, Offutt and
 *  Lincoln Class C areas; one step in, the field and its neighbours. */
const DEFAULT_ZOOM = 10;

/** Half the window the mosaic covers, in px. Wider and taller than any card
 *  the grid lays out (about 360 px on a phone, 350 in a desktop column), so
 *  the frame never shows an edge; the frame's own size crops it. */
const HALF_WIDTH = 320;
const HALF_HEIGHT = 160;

/**
 * FAA's VFR sectional around the drop zone, from FAA's own tile service:
 * the chart a pilot plans the jump run on, with the airspace and the fields
 * around the DZ. A static view centred on the drop zone with a zoom step,
 * not a map that pans; tapping it opens SkyVector's sectional on the same
 * spot, which does pan.
 *
 * A picture of a published chart, not a reading of it: the card marks the
 * drop zone and says nothing about the airspace, which the chart itself and
 * the pilot in command answer for.
 */
export function SectionalPanel(): JSX.Element {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [failed, setFailed] = useState(false);
  const { dz } = SITE;
  const tiles = tilesAround(dz.lat, dz.lon, zoom, HALF_WIDTH, HALF_HEIGHT);

  return (
    <Panel
      title="Sectional chart"
      subtitle={`FAA VFR sectional · ${dz.icao}`}
      /* The chart's own source only: SkyVector (where a tap goes) and
         adsb.lol and adsb.fi (the traffic links) supply nothing on this
         card, and the "Data:" footer would name them as if they did. All
         three are linked in the card's body, where they say what they are. */
      sources={[DATA_SOURCES.faaSectional]}
    >
      {failed ? (
        <p className="muted">
          Chart tiles unavailable.{' '}
          <a href={DATA_SOURCES.skyvector.url} target="_blank" rel="noopener noreferrer">
            Open the sectional on SkyVector →
          </a>
        </p>
      ) : (
        <>
          <a
            className="sectional-frame"
            href={DATA_SOURCES.skyvector.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`FAA VFR sectional around ${dz.name}; opens SkyVector's sectional`}
          >
            {tiles.map((t) => (
              <img
                key={`${t.z}/${t.y}/${t.x}`}
                className="sectional-tile"
                src={FAA_SECTIONAL_TILES.url(t.z, t.y, t.x)}
                alt=""
                width={TILE_PX}
                height={TILE_PX}
                loading="lazy"
                style={{ left: `calc(50% + ${t.left}px)`, top: `calc(50% + ${t.top}px)` }}
                onError={() => setFailed(true)}
              />
            ))}
            <span className="sectional-dz" aria-hidden="true" />
          </a>
          <div className="sectional-zoom" role="group" aria-label="Chart zoom">
            <button
              type="button"
              className="fc-step"
              onClick={() => setZoom((z) => z - 1)}
              disabled={zoom <= FAA_SECTIONAL_TILES.minZoom}
              title="Zoom out"
            >
              {/* The visible word is the button's name (WCAG 2.5.3: a voice
                  user says what they see); the sign is decoration. */}
              <span aria-hidden="true">−</span> wider
            </button>
            <button
              type="button"
              className="fc-step"
              onClick={() => setZoom((z) => z + 1)}
              disabled={zoom >= FAA_SECTIONAL_TILES.maxZoom}
              title="Zoom in"
            >
              closer <span aria-hidden="true">+</span>
            </button>
          </div>
          <p className="small">
            Live air traffic on this chart:{' '}
            <a href={DATA_SOURCES.adsbTraffic.url} target="_blank" rel="noopener noreferrer">
              adsb.lol →
            </a>{' '}
            ·{' '}
            <a href={DATA_SOURCES.adsbFiTraffic.url} target="_blank" rel="noopener noreferrer">
              adsb.fi →
            </a>{' '}
            <span className="muted">
              Two volunteer networks; if one is down, try the other. Each link asks its map to open
              over the same sectional, centred on the drop zone. They show only aircraft
              broadcasting ADS-B (or located by multilateration) within range of their receivers,
              so an aircraft on neither map may still be there; neither is a traffic service.
            </span>
          </p>
          <p className="muted small">
            <span className="radar-dz-key" aria-hidden="true" /> marks the drop zone, from its
            coordinates. Tap the chart for SkyVector&rsquo;s sectional, which pans and shows the
            chart&rsquo;s edition. Not for navigation: check the current chart and NOTAMs.
          </p>
        </>
      )}
    </Panel>
  );
}
