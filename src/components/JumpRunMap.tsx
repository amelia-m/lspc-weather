import { useState } from 'react';
import { SITE } from '../config/site';
import { DATA_SOURCES, DZ_IMAGERY_TILES } from '../config/sources';
import { compass } from '../domain/units';
import { feetToPixels, jumpRunLine } from '../domain/jumpRunMap';
import { TILE_PX, pixelOffset, tilesAround } from '../domain/slippyTiles';

/** About a mile and a half across a phone-width card: the field, the roads
 *  round it and room for a run either side. */
const DEFAULT_ZOOM = 14;
/** Half the window the mosaic covers, in px: wider than any card, as the
 *  Sectional card's is, so the frame never shows an edge. */
const HALF_WIDTH = 360;
const HALF_HEIGHT = 130;
/** The frame's height is twice this (app.css `.jumprun-frame`). */
const SCALE_FT = 1000;

const pts = (ps: readonly { x: number; y: number }[]): string => ps.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/**
 * The jump run's bearing drawn over an aerial image of the drop zone (the
 * maintainer, 2026-11-24): a line through the drop zone's GPS point with an
 * arrow in the direction of flight, a cross on that point, a ring on the
 * landing area, and a 1,000 ft bar, the SIM's separation between solo
 * jumpers, for scale.
 *
 * Two points, because they are two places (her correction the same day):
 * the GPS pin a run is flown on (`SITE.gpsPin`, in the field south-west of
 * the runway) and the middle of the main landing area (`SITE.dz`, the pin
 * she dropped, about 1,100 ft north-north-east of it). The line goes through the
 * GPS point, which is the centre of the image.
 *
 * A picture of the bearing, not a plan: the caption says that where the run
 * lies and where exits start is the spotter's and the pilot's. No colour means anything; the line is white with a dark casing
 * so it shows over fields and trees alike.
 *
 * Static tiles and an SVG over them, as the Sectional card does it, with no
 * map library. The overlay is a one-pixel SVG at the frame's centre that
 * lets its drawing overflow, drawn in the tiles' own pixels, so it stays
 * registered with them at any card width. One pixel, not none: a browser
 * paints nothing for an SVG of zero size, overflow or not (seen in Chromium
 * 2026-11-24, where the first version drew the image and no line).
 */
export function JumpRunMap({ trackDeg }: { trackDeg: number }): JSX.Element {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [failed, setFailed] = useState(false);
  const { dz, gpsPin } = SITE;
  const tiles = tilesAround(gpsPin.lat, gpsPin.lon, zoom, HALF_WIDTH, HALF_HEIGHT);
  const line = jumpRunLine(trackDeg, HALF_WIDTH + HALF_HEIGHT, 70);
  const scalePx = feetToPixels(SCALE_FT, gpsPin.lat, zoom);
  const landing = pixelOffset(gpsPin, dz, zoom);
  const bearing = `${trackDeg === 0 ? 360 : trackDeg}° ${compass(trackDeg)}`;

  if (failed) {
    return <p className="muted small">The aerial image could not be loaded, so the jump run is not drawn. The figures above do not need it.</p>;
  }
  return (
    <figure className="jumprun">
      <div
        className="jumprun-frame"
        role="img"
        aria-label={`Aerial image of ${dz.name}, north up, with a line through the drop zone’s GPS point on a bearing of ${bearing}`}
      >
        {tiles.map((t) => (
          <img
            key={`${t.z}/${t.y}/${t.x}`}
            className="sectional-tile"
            src={DZ_IMAGERY_TILES.url(t.z, t.y, t.x)}
            alt=""
            width={TILE_PX}
            height={TILE_PX}
            loading="lazy"
            style={{ left: `calc(50% + ${t.left}px)`, top: `calc(50% + ${t.top}px)` }}
            onError={() => setFailed(true)}
          />
        ))}
        <svg className="jumprun-overlay" width="1" height="1" aria-hidden="true">
          {/* Dark under light: the line reads over pale fields and dark trees. */}
          <line className="jumprun-casing" x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />
          <line className="jumprun-line" x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />
          <polygon className="jumprun-arrow" points={pts(line.arrow)} />
          {/* The landing area, where it lies from the GPS point. */}
          <circle className="jumprun-dz" r="7" cx={landing.x.toFixed(1)} cy={landing.y.toFixed(1)} />
          {/* The GPS point, at the centre: a cross, so the two marks differ
              by shape and not by colour. */}
          <path className="jumprun-pin-casing" d="M-8,0H8M0,-8V8" />
          <path className="jumprun-pin" d="M-8,0H8M0,-8V8" />
        </svg>
        <span className="jumprun-north" aria-hidden="true">
          N ↑
        </span>
        <span className="jumprun-scale" style={{ width: `${scalePx.toFixed(1)}px` }} aria-hidden="true">
          {SCALE_FT.toLocaleString('en-US')} ft
        </span>
      </div>
      {/* A class of their own, styled as the hour stepper's buttons are: the
          Drift card's tests and the live-site check read `fc-step` as an
          hour step. */}
      <div className="sectional-zoom" role="group" aria-label="Image zoom">
        <button type="button" className="jumprun-step" onClick={() => setZoom((z) => z - 1)} disabled={zoom <= DZ_IMAGERY_TILES.minZoom}>
          − Zoom out
        </button>
        <button type="button" className="jumprun-step" onClick={() => setZoom((z) => z + 1)} disabled={zoom >= DZ_IMAGERY_TILES.maxZoom}>
          + Zoom in
        </button>
      </div>
      <figcaption className="muted small">
        North is up. The cross is the drop zone&rsquo;s GPS point as the maintainer believes it to be, the one Mark
        Schulze&rsquo;s Winds Aloft uses for the club ({gpsPin.lat.toFixed(4)}, {gpsPin.lon.toFixed(4)}; her word of
        2026-11-24, not confirmed against a pilot&rsquo;s GPS). The ring is the middle of the main landing area (
        {dz.lat.toFixed(4)}, {dz.lon.toFixed(4)}). The line is a bearing of {bearing} through the GPS point, the
        arrow the direction of flight; the bar is {SCALE_FT.toLocaleString('en-US')} ft on the ground. It shows the
        bearing and nothing else: where the run lies over the ground, and where on it exits start, is the
        spotter&rsquo;s and the pilot&rsquo;s. Image:{' '}
        <a href={DATA_SOURCES.usgsImagery.url} target="_blank" rel="noopener noreferrer">
          {DATA_SOURCES.usgsImagery.label}
        </a>
        , as taken, not as the field is today.
      </figcaption>
    </figure>
  );
}
