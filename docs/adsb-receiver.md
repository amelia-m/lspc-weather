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

Not read from here: heywhatsthat.com is not on the sandbox allowlist, so
the details above are as given when it was created, and the panorama's
outlines have not been looked at in this repository. A site address is not
necessarily where an antenna would go; if one is planned, a panorama at the
antenna's own spot is worth making. Per tar1090's README, heywhatsthat does
not account for obstacles within about 100 ft of the antenna, or for trees.

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

The README does not say whether those altitudes are above sea level or
above the antenna, so check that before reading a low outline (the jump
plane's climb, say) as a promise. The map's `?pTracks` view (`/tar1090/?pTracks`,
or `/adsbfi/?pTracks`) then shows what was actually received, the last 8
hours by default, to compare against the outline.
