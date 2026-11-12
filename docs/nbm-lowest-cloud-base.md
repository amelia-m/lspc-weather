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

## The three-hourly bulletin, three days out (2026-11-12)

The maintainer asked why usairnet's ceiling forecast runs further than
the card's, and then to add it (docs/usairnet-parity.md, "Why usairnet's
ceiling runs further out"): usairnet's three-day table is the NBM's
three-hourly bulletin, NBS, 6 to 72 hours from its cycle, where the
card's ceiling is the NWS gridpoint's (about a day and a half) and its
base row the hourly NBH (25 hours). So the relay now cuts KPMV's NBS
block too, on `/nbm/KPMV/nbs` (docs/taf-relay.md), the app reads it on
its own Data health row ("NBM three-day", `nbs`), and `parseNbsBlock`
dates its columns by the bulletin's `FHR` row (hours from the cycle),
which the NBH lacks. KPMV's block of the 01Z cycle that day is
`data/parity/nbm-kpmv-nbs-2026-11-12-01z.txt`; the fixture re-dates it to
the hour before now, as the NBH's is.

How the card shows it is the maintainer's to pick, and three layouts were
built to try (`ThreeDayLayout`, src/components/forecastReach.ts; the
build's `VITE_THREE_DAY` names one, `strip` by default until she picks),
each drawn from the fixture build at 390 px and kept beside this doc:

- **horizon** (`docs/img/ceiling-sky-three-day-horizon-2026-11-12.png`):
  a "3d" option on the strip's toggle. At it the strip runs past the NWS
  hours in the bulletin's own columns, wider, each with its time, the sky
  bar in the second forecast's outlined track, a dash in the NWS rows,
  and an "NBM" row under the base with the bulletin's ceiling.
- **continue** (`…-continue-…png`): the "3d" option too, no extra row:
  where the NWS ceiling forecast ends, the ceiling row goes on in the
  NBM's figures, in lighter italic type, with a title naming them.
- **strip** (`…-strip-…png`): the hourly strip as it was, no "3d"
  option, and a second strip under it, every column one of the
  bulletin's 23 times across three days, with its sky bar, ceiling and
  base, a time under every column and the weekday under each day's first.

In every layout the bulletin is a second forecast beside the NWS one,
never blended with it: a column with no NWS hour draws no NWS bar, and
nothing is flagged or coloured (the rule, CLAUDE.md). `stripColumns`
(forecastReach.ts, pure) builds the longer strip's columns: every NWS
hour in the horizon, then the bulletin's times past the last of them.
Checked in each layout's fixture build at 1280 and 390 px: no sideways
scroll of the page, no console error.

## The header lost its version (2026-11-03)

Every station's block in the bucket's NBH text began " KPMV   NBM V5.0
NBH GUIDANCE    11/03/2026  1100 UTC" through the 2026-11-03 11Z cycle,
and " KPMV   NBM  NBH GUIDANCE    11/03/2026  1200 UTC" from the 12Z one
on: the version token went, two spaces where " V5.0 " was, with no
notice found (read in the bucket's files for 10-28 12Z, 10-31 12Z, 11-01
12Z, 11-02 12Z, 11-03 00Z to 11Z, 12Z, 22Z and 23Z on 2026-11-04 about
00:30Z). The relay's pattern for the station's header required the
token, so from the 12Z file on it found no block in a file that had one
and answered 502, "NOAA's NBM bucket has no KPMV block in
blend.20261103/23/text/blend_nbhtx.t23z" (the 23Z file, 28,399,674
bytes, with KPMV's header 18,216,536 bytes in, 26 KB before the
remembered offset and well inside the window). The app's parser required
it too. Both patterns take the token as optional now, `version` is null
when the header has none, and a block the relay cannot find in a file it
read answers 500, the relay's own, which the live-site check counts as a
fault; the bucket's 502 stays a note, which is why the twelve hours of
502s showed only as notes on that day's check (the deploy's run at
20:58Z, three per page) and the error reached nobody until the run list
was read. `tests/nbm.test.ts` and `tests/nbmRelay.test.ts` carry the bare
header. Workers Builds deploys the relay from `main` (docs/taf-relay.md,
"Setting it up"), so the fix is live once merged.

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
- After the merge (PR #228, 2026-10-27 02:52Z): Cloudflare built the
  Worker from `main` and the deployed relay's `/nbm/KPMV`, asked from the
  sandbox with the site's origin, answered 404 at 02:52:58Z (the old
  Worker, which knew only the TAF path) and 200 at 02:53:14Z with the
  01Z file's block; the second ask, from memory, took 0.6 s. The Pages
  deploy of the same head and the live-site check it starts both
  passed, every page at every width, so the NBM row is on the deployed
  site and the Data health row reads as above.
