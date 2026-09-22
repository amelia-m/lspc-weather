import { describe, expect, it } from 'vitest';
import { radarImageFraction } from '../src/domain/radarGeo';
import { DZ_ON_RADAR_IMAGE, RADAR_IMAGE_GEOREF, SITE } from '../src/config/site';

const KOAX = { lat: SITE.radarSite.lat, lon: SITE.radarSite.lon };

/**
 * The georeferencing in RADAR_IMAGE_GEOREF was measured by registering
 * KOAX_loop.gif against county geometry from api.weather.gov (see the doc
 * comment there). These assert the config still reproduces that measurement:
 * the fit put the DZ at pixel (336.05, 340.85) of the 600x550 image, and the
 * radar itself at (300.08, 282.79).
 *
 * They are not a check on NWS — if the product's extent changes these still
 * pass and the marker is silently wrong. They catch the code drifting from the
 * measurement, which is the part this repository controls.
 */
describe('radar image georeferencing reproduces the measurement', () => {
  it('puts the drop zone where the registration put it', () => {
    const f = radarImageFraction(SITE.dz.lat, SITE.dz.lon, KOAX, RADAR_IMAGE_GEOREF);
    expect(f).not.toBeNull();
    // Half a pixel of the measured position, in each axis.
    expect(f!.x * 600).toBeCloseTo(336.05, 0);
    expect(f!.y * 550).toBeCloseTo(340.85, 0);
  });

  it('puts the radar site where the registration put it', () => {
    const f = radarImageFraction(KOAX.lat, KOAX.lon, KOAX, RADAR_IMAGE_GEOREF);
    expect(f).not.toBeNull();
    expect(f!.x * 600).toBeCloseTo(300.08, 0);
    expect(f!.y * 550).toBeCloseTo(282.79, 0);
  });

  /* The obvious assumption — that a single-site image is centred on its radar
   * — is wrong in latitude, and fitting it that way was off by 8 px at the
   * 90th percentile. If someone "simplifies" centreLatOffsetDeg to zero this
   * fails rather than quietly moving the marker ~7 km north. */
  it('does not place the radar at the centre of the image', () => {
    const f = radarImageFraction(KOAX.lat, KOAX.lon, KOAX, RADAR_IMAGE_GEOREF);
    expect(f!.x).toBeCloseTo(0.5, 5); // centred in longitude
    expect(f!.y).toBeGreaterThan(0.51); // but sits below centre
  });

  it('exports a usable position for the drop zone', () => {
    expect(DZ_ON_RADAR_IMAGE).not.toBeNull();
    expect(DZ_ON_RADAR_IMAGE!.x).toBeGreaterThan(0);
    expect(DZ_ON_RADAR_IMAGE!.x).toBeLessThan(1);
  });
});

describe('no marker where there is nothing to mark', () => {
  it('returns null well outside the bbox', () => {
    // Denver, ~500 mi west: on the same latitudes, nowhere near the image.
    expect(radarImageFraction(39.74, -104.99, KOAX, RADAR_IMAGE_GEOREF)).toBeNull();
  });

  it('returns null just past each edge but a position just inside', () => {
    const half = RADAR_IMAGE_GEOREF.spanDeg / 2;
    const centreLat = KOAX.lat + RADAR_IMAGE_GEOREF.centreLatOffsetDeg;
    expect(radarImageFraction(centreLat, KOAX.lon - half - 0.01, KOAX, RADAR_IMAGE_GEOREF)).toBeNull();
    expect(radarImageFraction(centreLat, KOAX.lon + half - 0.01, KOAX, RADAR_IMAGE_GEOREF)).not.toBeNull();
  });

  /* The header and footer bars are drawn over the map, so a point can be
   * inside the bbox and still have nothing under it but NWS chrome. A marker
   * there would sit over the logo or the colour scale, pointing at nothing. */
  it('returns null under the header and footer bars', () => {
    const half = RADAR_IMAGE_GEOREF.spanDeg / 2;
    const centreLat = KOAX.lat + RADAR_IMAGE_GEOREF.centreLatOffsetDeg;
    const nearTop = centreLat + half * 0.99; // inside the bbox, behind the header
    const nearBottom = centreLat - half * 0.99;
    expect(radarImageFraction(nearTop, KOAX.lon, KOAX, RADAR_IMAGE_GEOREF)).toBeNull();
    expect(radarImageFraction(nearBottom, KOAX.lon, KOAX, RADAR_IMAGE_GEOREF)).toBeNull();
  });
});
