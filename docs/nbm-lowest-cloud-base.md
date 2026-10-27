# The NBM's lowest cloud base on the Ceiling & sky card

Since 2026-10-27 the Ceiling & sky card has a "base" row under the NWS
ceiling: the lowest cloud base in the NWS National Blend of Models'
hourly bulletin for KPMV (the NBH), the row usairnet plots as "Lowest
cloud base" (docs/usairnet-parity.md, "Where usairnet's rows come from").
Asked for by the maintainer on 2026-10-27, after the units were read
from MDL on the 26th.

## What it is

MDL's "NBM v5.0 Text Bulletin Card" (vlab.noaa.gov/web/mdl/nbm-textcard-v5.0,
read 2026-10-26; the hourly card's key is
`data/parity/nbm-textcard-v5.0-key-2026-10-26.txt`): `LCB` is "lowest
cloud base, 100s feet (>5000 ft reported to the nearest 1000 ft;
-88=unlimited)", -99 missing. MDL's elements page: "Lowest cloud base
whether or not a ceiling is present (could be FEW or SCT layer)", "a
50/50 blend of model diagnostic cloud information and RH derived clouds".
So it is not the ceiling: a few or scattered layer counts, and it can sit
under a ceiling, or under the NWS forecast's "no ceiling", without
contradiction. The card says so in its note, and prints the figure in
the same thousands of feet as the ceiling, "no" for -88, a dash where the
bulletin gives none.

It raises no flag and takes no colour: no published limit applies to a
lowest cloud base, and the row is the muted colour the card's second
forecast (Open-Meteo's cloud cover) already uses.

## How it reaches the browser

NOAA's open data bucket (`noaa-nbm-grib2-pds.s3.amazonaws.com`) serves
each hour's NBH as one file for every station, about 28 MB, with a CORS
header; no reader should fetch that for a 2 KB block. The TAF relay
(`relay/`, docs/taf-relay.md) has a second path, `/nbm/KPMV`
(`relay/src/nbm.ts`), that cuts the block out:

- **Which file.** Each hour's bulletin lands 40 to 70 minutes after its
  hour (read 2026-10-27: the 00Z file at 01:13Z, the 01Z at 02:06Z, the
  02Z before 02:47Z; HEAD answers 200 or 404), and its hours begin the
  hour after its cycle, so the newest file never covers the hour under
  way: with it the card's first column, the hour under way, was always a
  dash (seen at 02:47Z with the 02Z file in place). The relay takes the
  newest cycle whose hours cover that hour, the one before it, then
  older ones, asking HEAD for each; the later columns are an hour less
  fresh than the newest file would make them, and the first is filled.
- **Which bytes.** KPMV's block began 18,242,995 bytes in, in every file
  read from 2026-10-24 to 10-27, files of two sizes included. The relay
  reads a Range of 1.5 MB either side of the last place it found the
  block (that figure to start), and the whole file only when the block is
  not whole within the window. Nothing promises the offset; the window
  and the fallback are what make it safe to start from.
- **What it answers.** JSON: the station, `NBH`, the bucket file, the
  cycle, and the block's text; kept in the Worker's memory ten minutes,
  as the TAF is for five. The same origin rule as the TAF path, and 502
  for every way the bucket can fail. All of one answer's requests share
  a 20-second budget, and the app waits 25, so a slow whole-file read is
  finished rather than abandoned. A HEAD that fails moves on to the hour
  before; a bucket that answers a range with the whole file is read once;
  the block ends at the line of spaces after it or at any station's
  header, five-character ids included. The card names the bulletin by its
  cycle, not an issue time: the file lands about an hour after the cycle.
  The live-site check notes the bucket failing behind the relay (the
  app names the relay's 502 as the bucket's) and counts any other failure
  of the row, as the TAF row is judged.

The app parses the block (`src/domain/nbm.ts`, pure, tested against the
saved block of 2026-10-24 03Z): fields by position, three characters
each after a five-character label, since "-88-88140" is three fields;
the hours from the cycle's own hour, an hour not after the last being
the next day's, so the 23Z cycle's hours, which all begin at 00, are the
next day's from the first (the key: "date as in line 1, unless past
23Z"; a first version started from -1 and dated that cycle's hours a day
early, found in review on 2026-10-27 against the bucket's 23Z file). A
second station's header ends the block whatever the relay cut. `src/api/nbm.ts` reads the relay's path with the TAF path's retry
rule (none after the relay's own 502); the fixtures re-date the saved
block to the hour before now (`src/api/fixtures/nbm.ts`). Data health
has a row for it, shown only with the relay set; the source log records
the cycle and file.

## Checked

- `npm test`: the parser, the relay path (a stand-in bucket: HEAD, the
  window, the whole-file fallback, the memo, the refusals) and the card,
  each test proven by breaking what it names.
- `npx wrangler@4.151.3 dev` in `relay/` against the real bucket from the
  sandbox, 2026-10-27 about 02:50Z: `/nbm/KPMV` from the site's origin
  answered 200 with `Access-Control-Allow-Origin`, `max-age=600`, and
  KPMV's block of the 01Z file (`blend.20261027/01/text/blend_nbhtx.t01z`,
  38 lines, the `LCB` row among them), found in the first window read;
  the second ask answered from memory in 8 ms; another origin got 403,
  `/nbm/KOMA` 404, and the TAF path still answered 200. The runtime's
  own log showed only its telemetry hosts refused by the sandbox's proxy.
- The app built with `TAF_RELAY_URL` set to that local Worker, served
  at `localhost:4173` and loaded in Chromium on live data through the
  sandbox's proxy (CLAUDE.md, "The deployed site in a browser"), about
  03:05Z: both relay paths answered 200 among the live APIs' requests;
  the card's base row read 6, 6, 6, 7, 6, 5, 5, 3, 1.9, 1.9, 0.8, 0.8
  thousand ft for the next twelve hours; Data health's rows "TAF ·
  primary · KOFF · via the relay" and "NBM cloud base · primary · KPMV
  NBH 01Z · NOAA's bucket via the relay"; no script errors; the page no
  wider than the viewport at 1280 and 390 px, and at 320 px in the
  fixture build (the strip's base row and axis label in place at all
  three). (A first try loaded
  nothing: with a proxy set, Chromium sent the localhost page through it
  and got 405s, until `<-loopback>` was added to the proxy bypass list.)
