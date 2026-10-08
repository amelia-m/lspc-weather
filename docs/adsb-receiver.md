# A possible ADS-B receiver at Brown's Airport

Not part of the dashboard. A record of groundwork for a receiver the club
might put at the field.

## Why

The Sectional card links to two volunteer ADS-B networks, adsb.lol and
adsb.fi, each link asking its map to open over the same sectional centred
on the drop zone (`DATA_SOURCES.adsbTraffic`, `adsbFiTraffic`). They show
only what their receivers hear, and 1090 MHz needs line of sight, so the
jump plane low over Brown's, on the climb out and the descent back, is the
traffic receivers miles away would be likeliest to miss. That is reasoning
from line of sight, not an observation: nobody has checked whether either
network drops the plane. Watching a load on both maps would answer it
before buying anything. If they do, a receiver at the field, fed to both
networks, would cover it.

What it would not do is put aircraft on the dashboard. A receiver's own map
(tar1090) runs on the club's network, which a public https site cannot read.
And neither network's data can be read from this site's pages: adsb.fi's
feed sends no CORS header (checked 2026-10-04, recorded in
`src/config/sources.ts`); adsb.lol's API answered without one the same day,
and its map's own feed needs a cookie a page on this site cannot send
(checked 2026-10-03, also in `sources.ts`). The links stay the way to see
it.

The feeder kit for adsb.fi is <https://github.com/adsbfi/adsb-fi-scripts>
(read 2026-10-08): scripts that set up an existing receiver (a decoder such
as readsb on a Raspberry Pi) to feed adsb.fi, plus an optional local
tar1090 map. It does not install the decoder.

## The panorama

A heywhatsthat.com panorama gives the theoretical range from an antenna: how
far line of sight reaches, over terrain and the curvature of the earth, at
each aircraft altitude. tar1090 can draw it on its map to compare against
what the receiver actually hears.

- **View:** <http://www.heywhatsthat.com/?view=SXF9KNRK> (ID `SXF9KNRK`)
- **Created:** 2026-10-08, by the maintainer
- **Location:** the LSPC address as entered on the site ("2617 Weeping
  Water Rd, Weeping Water, NE 68463" in the screenshot of the request)
- **Antenna height:** 30 ft above ground

Read from its API on 2026-10-08
(`/api/upintheair.json?id=SXF9KNRK&refraction=0.25&alts=457,665,1275,3048,3962`;
without `alts` it answers with an empty body): the panorama sits at
40.870836, −96.1117301, 1,214 ft (370.1 m) above sea level. Less the 30 ft
mast that is 1,184 ft of ground, against the field's 1,182 ft
(`SITE.dz.elevationFt`), and the point is about 400 m from the drop zone's
coordinates in `src/config/site.ts`. A site address is not necessarily
where an antenna would go; if one is planned, a panorama at the antenna's
own spot is worth making.

Its theoretical range, the line of sight over terrain and the earth's
curve, in nautical miles from the antenna around all 360°:

| aircraft at (MSL) | about, above the field | nearest | median | farthest |
|---|---|---|---|---|
| 1,500 ft | 300 ft | 7.5 | 12.9 | 37.3 |
| 2,182 ft | 1,000 ft | 20.7 | 29.3 | 53.2 |
| 4,183 ft | 3,000 ft | 46.5 | 57.5 | 81.0 |
| 10,000 ft | 8,800 ft | 92.9 | 105.3 | 128.7 |
| 13,000 ft | 11,800 ft | 110.8 | 123.5 | 146.8 |

So from the field itself, line of sight to the jump plane holds from a few
hundred feet up within several miles, the stretch the reasoning above
expects a receiver elsewhere to lose. This is geometry only: per tar1090's README,
heywhatsthat does not account for obstacles within about 100 ft of the
antenna, or for trees, and real reception also depends on the antenna, the
receiver and the aircraft's transponder. It says nothing about what the
networks' existing receivers hear (see above).

## Using it on a receiver

From tar1090's README ("heywhatsthat.com range outline", read 2026-10-08),
on the receiver:

```
sudo /usr/local/share/tar1090/getupintheair.sh SXF9KNRK
```

draws the outline for aircraft at 40,000 ft on the default map
(`/tar1090`). Other altitudes are given in metres, comma separated; the
README's own example loads 10,000 and 40,000 ft:

```
sudo /usr/local/share/tar1090/getupintheair.sh SXF9KNRK 3048,12192
```

A map in another place takes its instance name last. The local map the
adsb.fi kit installs is at `/adsbfi`, and its README removes it as the
`adsbfi` instance, so for that map:

```
sudo /usr/local/share/tar1090/getupintheair.sh SXF9KNRK 3048,12192 adsbfi
```

Those altitudes are above sea level. tar1090's `getupintheair.sh` passes
them unchanged to heywhatsthat's API (read 2026-10-08), and heywhatsthat's
own page refuses an outline altitude below the antenna's height above sea
level as "too low" (its page script, read the same day). For a height above
the field, add 1,182 ft (360 m): 1,000 ft above the field is about 665 m. The map's `?pTracks` view (`/tar1090/?pTracks`,
or `/adsbfi/?pTracks`) then shows what was actually received, the last 8
hours by default, to compare against the outline.
