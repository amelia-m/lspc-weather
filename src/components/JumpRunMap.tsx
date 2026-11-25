import { useState } from 'react';
import { SITE } from '../config/site';
import { DATA_SOURCES, DZ_IMAGERY_TILES } from '../config/sources';
import { compass } from '../domain/units';
import { feetToPixels, jumpRunLine, jumpRunTicks, nmToPixels, offsetPixels, zoomToFit } from '../domain/jumpRunMap';
import { TILE_PX, pixelOffset, tilesAround } from '../domain/slippyTiles';
import { SelectField } from './common/SelectField';

/** About a mile and a half across a phone-width card: the field, the roads
 *  round it and room for a run either side. */
const DEFAULT_ZOOM = 14;
/** Half the window the mosaic covers, in px: wider than any card, as the
 *  Sectional card's is, so the frame never shows an edge. */
const HALF_WIDTH = 360;
const HALF_HEIGHT = 140;
/** Half the frame's height on screen (app.css `.jumprun-frame`, 320 px). */
const FRAME_HALF_HEIGHT_PX = 160;
/**
 * The image is drawn a little larger than its tiles: tiles come in whole
 * zoom levels, each twice the last, and the maintainer wanted it "slightly"
 * closer while still holding the offsets the club flies (2026-11-25: "we
 * usually don't go outside of .5 north of the pin or maybe .4 south"). At
 * zoom 14 half a nautical mile is 128 tile px; scaled by this it is 147 px
 * of the frame's 160, so that whole range shows at the opening zoom with a
 * tenth's ticks 29 px apart. The overlay is scaled with the tiles, so the
 * two stay registered.
 */
const IMAGE_SCALE = 1.15;
const SCALE_FT = 1000;

/** The offset a jump run is called with, from the GPS point: tenths of a
 *  nautical mile, as a pilot's GPS reads, toward a compass point ("0.1
 *  north"; the maintainer, 2026-11-25). Up to a mile, in whole tenths, so
 *  the box holds only values the picture can draw. */
export interface JumpRunOffset {
  tenths: number;
  towardDeg: number;
}
const OFFSET_TENTHS: readonly number[] = Array.from({ length: 11 }, (_, i) => i);
const OFFSET_TOWARD: readonly number[] = [0, 45, 90, 135, 180, 225, 270, 315];
const TOWARD_WORD: Record<number, string> = {
  0: 'north',
  45: 'north-east',
  90: 'east',
  135: 'south-east',
  180: 'south',
  225: 'south-west',
  270: 'west',
  315: 'north-west',
};
const fmtTenths = (t: number): string => (t / 10).toFixed(1);
/** The offset point is kept this near the centre, in tile px, by stepping
 *  the zoom out when an offset is set: inside the frame's half-height with
 *  10 px of margin for the diamond. 130 px, so the club's half mile (128 px
 *  at zoom 14) does not step it out. */
const OFFSET_FIT_PX = (FRAME_HALF_HEIGHT_PX - 10) / IMAGE_SCALE;
/** Ticks nearer than this run together, so the tenths give way to half
 *  miles (at the widest zoom a tenth is 6 px). */
const MIN_TICK_GAP_PX = 10;
const fitZoom = (tenths: number): number =>
  zoomToFit(tenths / 10, SITE.gpsPin.lat, OFFSET_FIT_PX, DZ_IMAGERY_TILES.minZoom, DZ_IMAGERY_TILES.maxZoom);

/** One decimal, and never "-0.0": a pure east offset's y is minus nothing. */
const px1 = (v: number): string => (Math.abs(v) < 0.05 ? 0 : v).toFixed(1);
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
 * GPS point, which is the centre of the image, or through a point the
 * reader offsets from it, as a run is called ("0.1 north"), marked with a
 * diamond. Ticks across the line every 0.1 nautical mile from that point
 * make it a ruler in the unit the pilot's GPS counts (both hers,
 * 2026-11-25). The offset moves the picture only: no figure on the card
 * depends on where the run lies.
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
export function JumpRunMap({
  trackDeg,
  initialOffset,
  initialZoom,
}: {
  trackDeg: number;
  /** For tests, which cannot work the boxes: the offset the image opens on. */
  initialOffset?: JumpRunOffset;
  /** For tests, which cannot press the zoom buttons. */
  initialZoom?: number;
}): JSX.Element {
  const [tenths, setTenths] = useState(initialOffset?.tenths ?? 0);
  const [toward, setToward] = useState(initialOffset?.towardDeg ?? 0);
  const [zoom, setZoom] = useState(() => initialZoom ?? Math.min(DEFAULT_ZOOM, fitZoom(initialOffset?.tenths ?? 0)));
  const [failed, setFailed] = useState(false);
  const { dz, gpsPin } = SITE;
  const tiles = tilesAround(gpsPin.lat, gpsPin.lon, zoom, HALF_WIDTH, HALF_HEIGHT);
  const scalePx = feetToPixels(SCALE_FT, gpsPin.lat, zoom) * IMAGE_SCALE;
  const landing = pixelOffset(gpsPin, dz, zoom);
  const bearing = `${trackDeg === 0 ? 360 : trackDeg}° ${compass(trackDeg)}`;
  const offset = offsetPixels(tenths / 10, toward, gpsPin.lat, zoom);
  // The line and its ticks are drawn about the offset point, so they reach
  // that much farther: zoomed in on a long offset, a run that still crosses
  // the frame would otherwise stop short inside it.
  const reach = HALF_WIDTH + HALF_HEIGHT + Math.hypot(offset.x, offset.y);
  const line = jumpRunLine(trackDeg, reach, 70);
  const offsetPoint = `a point ${fmtTenths(tenths)} nm ${TOWARD_WORD[toward]} of the GPS point`;
  // A tenth of a nautical mile apart where that leaves room, else half a mile.
  const tenthPx = nmToPixels(0.1, gpsPin.lat, zoom);
  const tenthTicks = tenthPx >= MIN_TICK_GAP_PX;
  const ticks = tenthTicks
    ? jumpRunTicks(trackDeg, tenthPx, reach)
    : jumpRunTicks(trackDeg, tenthPx * 5, reach, 9, 9);
  const tickPath = ticks.map((t) => `M${t.a.x.toFixed(1)},${t.a.y.toFixed(1)}L${t.b.x.toFixed(1)},${t.b.y.toFixed(1)}`).join('');
  // Setting an offset steps the image out, never in, until its point is in
  // the frame; the reader's own zoom stands otherwise.
  const changeOffset = (t: number): void => {
    setTenths(t);
    setZoom((z) => Math.min(z, fitZoom(t)));
  };

  if (failed) {
    return <p className="muted small">The aerial image could not be loaded, so the jump run is not drawn. The figures above do not need it.</p>;
  }
  return (
    <figure className="jumprun">
      <div className="drift-inputs">
        <SelectField
          label="Offset from the GPS point (nautical miles)"
          value={tenths}
          options={OFFSET_TENTHS}
          format={(t) => (t === 0 ? 'none' : fmtTenths(t))}
          onChange={changeOffset}
        />
        {tenths > 0 && (
          <SelectField label="Offset toward" value={toward} options={OFFSET_TOWARD} format={(d) => TOWARD_WORD[d]} onChange={setToward} />
        )}
      </div>
      <div
        className="jumprun-frame"
        role="img"
        aria-label={`Aerial image of ${dz.name}, north up, with a line through ${tenths > 0 ? offsetPoint : 'the drop zone’s GPS point'} on a bearing of ${bearing}`}
      >
        {/* Tiles and overlay in one layer, scaled together about the centre. */}
        <div className="jumprun-layer" style={{ transform: `scale(${IMAGE_SCALE})` }}>
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
            {/* The run, drawn about the point it passes through: the GPS
                point, or the offset from it. */}
            <g transform={tenths > 0 ? `translate(${px1(offset.x)},${px1(offset.y)})` : undefined}>
              {/* Dark under light: the line reads over pale fields and dark trees. */}
              <line className="jumprun-casing" x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />
              <line className="jumprun-line" x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />
              <path className="jumprun-tick-casing" d={tickPath} />
              <path className="jumprun-tick" d={tickPath} />
              <polygon className="jumprun-arrow" points={pts(line.arrow)} />
              {/* The offset point: a diamond, a third shape beside the cross
                  and the ring. */}
              {tenths > 0 && <path className="jumprun-offset" d="M0,-6L6,0L0,6L-6,0Z" />}
            </g>
            {/* The landing area, where it lies from the GPS point. */}
            <circle className="jumprun-dz" r="7" cx={landing.x.toFixed(1)} cy={landing.y.toFixed(1)} />
            {/* The GPS point, at the centre: a cross, so the two marks differ
                by shape and not by colour. */}
            <path className="jumprun-pin-casing" d="M-8,0H8M0,-8V8" />
            <path className="jumprun-pin" d="M-8,0H8M0,-8V8" />
          </svg>
        </div>
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
      {/* A key, not a paragraph (the maintainer, 2026-11-25: the card was
          "super wordy"). North and the bar's length are on the image. */}
      <figcaption className="muted small">
        Cross: the drop zone&rsquo;s GPS point, as the maintainer believes it (2026-11-24; not confirmed against a
        pilot&rsquo;s GPS). Ring: the landing area.{tenths > 0 ? ` Diamond: ${offsetPoint}.` : ''} Ticks:{' '}
        {tenthTicks ? 'every 0.1 nautical mile' : 'every 0.5 nautical mile at this zoom'} from the{' '}
        {tenths > 0 ? 'diamond' : 'cross'}. The bearing{tenths > 0 ? ' and offset' : ''} only: where the run lies
        and exits start is the spotter&rsquo;s and the pilot&rsquo;s. Image:{' '}
        <a href={DATA_SOURCES.usgsImagery.url} target="_blank" rel="noopener noreferrer">
          {DATA_SOURCES.usgsImagery.label}
        </a>
      </figcaption>
    </figure>
  );
}
