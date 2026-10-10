# Open questions and follow-ups

Live backlog. Closed items should be deleted rather than marked done — the
repository history is the record.

## Needs a human with a document

These cannot be settled from the code.

1. **Which 105.17 visibility row the flag should use.** The visibility flag
   fires below 3 SM, the section's row for jumps below 10,000 ft MSL. Brown's
   is at 1,182 ft MSL, so a 10,000 ft AGL exit is in the other row: 5 SM and
   1 mile from cloud. The reading is the METAR's surface visibility and the
   reg's measure is flight visibility at altitude, so the flag stays on the
   lower row and prints both (read through the eCFR 2026-09-23; A8 on the
   #citations page). Whether a surface reading should be held to the 5 SM row
   is a call for the S&TA and the PIC, not for this code.

2. **The claims still need an instructor, not another reading.** Every USPA,
   CFR and FAA citation has now been read at its source — the SIM at uspa.org
   on 2026-09-22; 14 CFR 105.17 and 105.19, AIM 7-1-7 and FAA-P-8740-2 on
   2026-09-23 — and the claims corrected against them, so the section numbers
   are no longer guesses. The club's posted tiers are a transcription of an
   undated photo of the sign, which no reading can improve on. What a reading
   could not settle is on the #citations page as each entry's "Please confirm"
   list — among them whether rounding the 14 mph student limit *down* to 12 kt
   is the right direction for a limit a jumper reads off a card (A1), and
   whether the club's posted waiver tiers have been filed as a SIM 2-2 waiver
   (A5). The page takes the answers in place — a verdict per claim, yes / no /
   not sure and a note per question, kept in the browser — and sends them as a
   prefilled GitHub issue or as copied text. The next step is an instructor or
   S&TA working through it.

3. **The app's own thresholds, for an instructor's judgement rather than a
   lookup.** Part B of the citations page — currently one entry, the 25 kt
   licensed bar scale, which triggers nothing and only sets how long a bar is
   drawn.

## To do: record the SIM change document once uspa.org lists them

The SIM page (https://www.uspa.org/sim) heads its list of change documents
"Available Change Documents", which would name the revision within the
2026 edition. The list served "Error: Downloads is currently unavailable"
to a script on 2026-10-08 and in a browser on 2026-10-09, so the reading
log pins the text by fingerprint instead (`src/config/readingLog.ts`). The
daily SIM check prints whether the list still shows that error (the
sky-parity log's "SIM edition on uspa.org" line). When it does not, read the newest change
document and record its name and date beside `SIM_EDITION` in the reading
log.

## Done: the waiver sign's photo under the tier selector

Asked for 2026-10-08, added 2026-10-09: under the LSPC waiver tier buttons
(`ProfileSelector`), "Photo of the posted sign (undated)" opens
`public/lspc-waiver-sign.jpg`, served with the site so it opens without
GitHub. It is a crop of `docs/lspc-waivered-wind-limits.jpg` (the photo as
taken, kept as the record) to the framed sign, 1,400 px wide and about
210 KB, against 3 MB for the original; a test checks the file is there.

## Open-Meteo's cloud cover: shown, not yet compared

Asked for 2026-10-08, and added the same day at the maintainer's request:
the Ceiling & sky card shows Open-Meteo's total cloud cover for each hour
as a narrow grey bar in an outlined track and a grey figure beside the NWS
sky cover, with the low/mid/high bands in each hour's tooltip. It rides on the winds request
(`OPEN_METEO_CLOUD_VARIABLES`), is left out when Open-Meteo does not
answer, and is never shown as a ceiling: Open-Meteo serves cloud as a
share of the sky (total, and bands up to 3 km, 3 to 8 km and above 8 km,
per open-meteo.com/en/docs, read 2026-10-08), with no base height. It is
grey whatever the amount, so it asserts no category; since 2026-10-09 the
NWS bars are likewise one colour whatever the cover (the few/scattered/
broken/overcast colours had no key and read as a verdict).

What the dashboard reads the sky from:

- **Now:** the KPMV METAR (Plattsmouth, about 12 mi ENE), from IEM first and
  api.weather.gov second, its sky groups parsed from the METAR text
  (`normalizeIemCurrent`, `normalizeNwsObservation`). This is the observed
  report: layer amounts and measured bases.
- **Forecast hours:** the NWS gridpoint forecast for the drop zone's own grid
  cell (`skyCover`, a percentage, and its derived ceiling), and beside it
  Open-Meteo's cloud cover.
- **10-day outlook:** Open-Meteo's daily weather code (its own reading of its
  model), or on the fallback the day's mean NWS gridpoint cover.

Still open: whether the two forecasts agree with each other, and with the
METAR, often enough to be worth both. A comparison logged over a few weeks
of real cloud (the METAR's layers against each forecast's cover for the same
hour) would answer it. The per-pressure-level cover (`cloud_cover_850hPa`
and so on) is not used: on the day it was looked at every level read 0%.

## To do, eventually: add this app to Open-Meteo's list of users

Raised 2026-10-08. Open-Meteo's README
(<https://github.com/open-meteo/open-meteo>) asks: "Do you use Open-Meteo?
Please open a pull request and add your repository or app to the list!"
This app reads its winds aloft (pressure levels, with the 10 m and 2 m
samples) and the 10-day outlook from Open-Meteo, so it qualifies. Not started: the pull request goes to another
project's repository under the maintainer's name, so it waits on the
maintainer deciding to send it. Before writing the entry, read the README's
list as it then stands for the format it uses.

## Settled: the DZ's coordinates now sit on the landing area

Raised 2026-10-08 by the maintainer, from Mark Schulze's map: the app's
point (40.8675, −96.11) and Schulze's preset for the club (40.8675006,
−96.11001) were both in the field south-west of the runway, downhill from
it. Jumpers land north or east of a barbed-wire fence that runs just west
of the runway's north–south length and just south of its leg along the
north: on the runway, the alfalfa field east of it where students are
aimed, and the pea gravel near the north-east corner, by the buildings,
where many experienced jumpers land.

The same day the maintainer gave the middle of the landing area by the
pea gravel, 40°52'13.0"N 96°06'30.5"W, and `SITE.dz` moved there
(40.8703, −96.1085: four decimals, because api.weather.gov's points
endpoint refuses more). Checked that day: it is in the same Open-Meteo
forecast cell and the same NWS gridpoint (OAX 77,42), so no forecast
changes; Open-Meteo's ground there is 355 m (1,165 ft) against 349 m at
the old point, so the model's 10 m wind now stands above the field's
published 1,182 ft and the Surface row is that wind itself
(`isSurface`, `src/domain/types.ts`); KPMV is 61° rather than 60° from it.
The link to Schulze's page carries the new point, so it shows his table
measured from 1,165 ft, as the "As Schulze" view is; his own list's pin
for the club is still in the south-west field (1,132 ft on Open-Meteo's
terrain). Logs before 2026-10-08 were taken at the old point.

## To do: re-run the Surface rows against the measured wind

On 2026-10-08 both forecast Surface rows were set by hand against KPMV's
measured wind over the 156 hours the logs held (the 10 m row nearer in 104,
Schulze's in 23, tied in 29; `docs/markschulze-altitude-reference.md`,
"Which Surface row is nearer the measured wind", which also says how).
Almost all of those hours were at the old DZ point and in two weeks of early
October. Worth re-running once the logs hold a few weeks at the landing
area, and in other seasons, ideally as a script under `scripts/` rather than
by hand, so the figure on file is not a one-off.

## Which forecast run the winds-aloft request is served

Narrowed, not settled. Seen first on 2026-09-23: for the same hour the app's
table and Mark Schulze's tool, both reading Open-Meteo, were on different
forecast runs. Checked 2026-09-24 at one level in one hour: Schulze's raw
700 hPa level matched Open-Meteo's `best_match`, `gfs_seamless` and
`ncep_hrrr_conus` exactly and none of `ecmwf_ifs025`, `gfs_global`,
`icon_seamless` or `gem_seamless`, so different models are effectively ruled
out; and the app's response carries no `Cache-Control`, `Age`, `ETag` or
`Expires` header, so nothing asks for caching, though a cache behind the API
is not excluded.

The sampler to 2026-10-05 counted it (`docs/source-parity.md`, "What the
sampler found"): different runs in 114 of 1,611 same-hour comparisons, in
short stretches up to about half an hour, on the same run agreeing to a
median 0° and 0 kt. But the rate is 2.5% (20 of 788) when the comparison
reads Schulze's hour in progress and 11.4% (89 of 782) when it reads his
next hour, which it does after half past because this card snaps to the
nearest hour; within those, 15% from :30 to :49 and 4.5% from :50. (The
other 41 comparisons, 5 of them mismatched, are the earliest, logged before
the minute was.) Against a next-hour cause on its own: the longest stretch,
28 to 36 minutes on 2026-10-01 from 08:03Z, ran almost wholly in the first
half of the hour, on the hour-in-progress request. The
minute of the hour and the `hourOffset=1` request change together, so the
logs cannot tell a new run reaching Open-Meteo's servers at different
times from something about the tool's next-hour request (its own caching,
say). The "different run" flag is also the script's heuristic (two raw
levels within 150 ft more than 5° or 2 kt apart), not a run identifier.

To separate them: fetch Schulze's `hourOffset=0` and `=1` and the app's
request for the same hours several times across :30 to :59, recording each
raw profile, so the next-hour request can be compared with itself and with
the hour-in-progress one at the same minute. Open-Meteo's responses carry no
run time; its `generationtime_ms` and the raw values are what there is.
Until then the Winds aloft card states only what was seen: on the same hour
the two can show different runs for a while, most often between half past
and ten to the hour.

A lead from the surface-wind sample of 2026-10-09
(`docs/surface-wind-sources.md`), not yet tested against the winds-aloft
request: Open-Meteo's metadata API (`/data/<model>/static/meta.json`) does
give each model's last run and when it became available, and that evening
HRRR's hourly domain (`ncep_hrrr_conus`) became available at 00:48Z and
01:52Z, the window where the mismatches cluster. For about twelve minutes
after a new 15-minute run arrived, successive requests got the new run or
the old one in turn, and Open-Meteo's model-updates page says its redundant
servers can differ "while the data is being copied" and to "wait 10
minutes after the availability time" (read 2026-10-09). Two requests a
moment apart landing on different servers would look exactly like this.
Logging that metadata beside each Schulze comparison would test it.

## Surface wind: which forecast source

Open since 2026-10-09. Whether Open-Meteo's `minutely_15` or `current` 10 m
wind is a better forecast of KPMV's measured wind than the NWS gridpoint hour
or Open-Meteo's hourly value. One two-hour sample (41 runs, 7 METAR reports,
all 5 to 6 kt) settled how the sources are built and how often they change,
and could not settle accuracy: see `docs/surface-wind-sources.md`. It needs
weeks of reports across windy, gusty and calm conditions. A sampler
(`.github/workflows/surface-wind-sample.yml`, every five minutes) runs to
2026-10-30T02:00Z for that; its records then need archiving and summarising
(`docs/surface-wind-sources.md`, "The longer sample, running"). Also seen there and not acted on: the NWS gridpoint is
served from caches that keep a copy up to an hour, and the app's fetch does
not bypass them; and Open-Meteo's hourly gust at the DZ always equalled the
15-minute step on the hour, so it behaved as the last quarter hour's maximum
rather than the hour's its docs describe (below the hour's largest 15-minute
gust at one of four hours, by 2.5 kt).
Nothing on the dashboard changed.

## Live-site smoke test

Run against live data on 2026-09-22 (first time the app had ever been exercised
against anything but the fixtures in `src/api/fixtures/`). Every source
answered: NWS observation (KPMV), NWS gridpoint hourly (168 points), Open-Meteo
winds aloft and 10-day daily, the TAF chain, and the NOAA FD winds fallback.

Settled:

- **Winds-aloft valid time is right.** At 04:01Z the card showed 0400Z, one
  minute behind — the hourly snap working as documented. Cross-checked against
  Mark Schulze's tool at the same hour and coordinates: identical at 13,000 ft
  (303° / 20 kt / −4 °C).
- **TAF falls back as designed.** KOFF yielded no product, KOMA did — the
  behaviour `SITE.tafStations` predicts.
- **The FD fallback was wrong, and is fixed.** See the commit; it printed the
  bulletin's 3,000 ft MSL wind as the Surface row.
- **The sky decode was wrong on live data, and is fixed.** Seen in a screenshot
  of the deployed site on 2026-09-23: "Sky: Clear", "No ceiling", VFR and no
  flag while the raw METAR on the same card read `OVC027`. api.weather.gov's
  `cloudLayers` was `[]` for seven consecutive reports and stayed so when
  re-read; the usairnet KPMV page the card links to decoded the same METAR
  as "Solid Overcast at 2700 ft", MVFR (fetched 2026-09-23, once
  `www.usairnet.com` was allowlisted). The normaliser now reads the sky from
  the METAR text; see CLAUDE.md.
- **The Licensed profile reads correctly with no flag**: card header "Licensed —
  no published limit", no band, the standing note and BSR citation present, and
  the advisory list naming the gap.

Still unexercised:

- **The deployed site, in a browser, on live data.** The data checks above ran
  the app's own fetch and render code under Node (`renderToStaticMarkup`, the
  way the advisory tests work). <https://amelia-m.github.io/lspc-weather/> has
  never been loaded: Playwright's Chromium does not trust the sandbox's
  TLS-intercepting proxy CA, so it cannot open any https:// page, and the fixes
  for that are blocked.

  Layout *was* checked, on the production bundle served over local http with
  fixtures, at 1280/390/320 px — see CLAUDE.md for the recipe. The radar card,
  the DZ marker's placement, the CSP and horizontal overflow are all verified
  that way. What is left unverified is the combination: real data arriving over
  the real network into a real browser, and the radar `<img>` actually being
  fetched cross-origin from radar.weather.gov rather than fulfilled locally.

## The Student profile models no canopy type

BSR 2-1 H states two maximum ground winds for solo students: 14 mph on ram-air
canopies, 10 mph on round reserves. The app has one Student profile with one
band, set to the 14 mph figure, so a student on a round reserve gets no flag at
their own published limit. The Surface wind card now says so rather than leaving
the silence to be read as an all-clear, but saying so is not the same as
handling it.

Two ways to close it, both needing a decision this repo cannot make from code:

- **Model canopy type** — a second Student profile, or a toggle. Correct, and it
  costs a UI control on the most-read card.
- **Drop the round-reserve figure** from the guidance and scope the profile to
  ram-air explicitly. Cheaper, but it hides a published limit.

Worth asking an instructor first whether LSPC puts any student on a round
reserve. If nobody does, the second option is honest and the first is dead
weight — but that is a fact about the DZ, not about the BSRs, and nothing in
this repository establishes it.

A lead, 2026-10-08: the maintainer believes most of the club's student rigs
carry an Aerodyne Smart reserve
(<https://www.flyaerodyne.com/reserve-canopy-smart.html>). The Smart is a
ram-air reserve, by its maker's description as commonly known, not by a
reading: the page was not opened, because `www.flyaerodyne.com` is not on the
sandbox's allowlist. If an instructor confirms it for every student rig, no
student here jumps a round reserve, which is the fact the second option
waits on. "Most" is not "every": a rig with a round reserve would still need
the 10 mph figure.

## Winds aloft

The sub-surface question that sat here is settled and fixed: pressure levels
below the model's terrain are dropped in `normalizeOpenMeteo`. Evidence, the
measurements behind it, and — importantly — the sources that could *not* be read
are in [`subsurface-pressure-levels.md`](subsurface-pressure-levels.md). The share this
entry used to quote (~4%, rising to ~15%) was a property of the **fixture**,
which sets `elevation: 360`; live Open-Meteo returned 349 at the point used
until 2026-10-08 (355 at the landing area since), which put the 10 m
sample below the field elevation and the sub-surface share at 0% in all 384
hours. The fix is worth having anyway — see the commit and the comment in
`normalizeOpenMeteo` — because which side of that 10-metre line the DEM lands
on is not something this app controls, and an hour missing `wind_speed_10m`
would have built the Surface row 70% out of a wind stamped below ground.

## Radar card: a pin at the drop zone

**Done** — approach 2, on measured georeferencing. `RADAR_IMAGE_GEOREF` in
`src/config/site.ts` carries the constants and the method; `radarImageFraction`
in `src/domain/radarGeo.ts` derives the position from the DZ and radar
coordinates.

What was measured, on 2026-09-22: the RIDGE "standard" image is equirectangular
over a bbox that is square in degrees (4.287° a side), centred on the radar in
longitude and 0.060° north of it in latitude, rendered into 600×550 px. Fitted
by projecting ~11,000 county-boundary vertices from
`api.weather.gov/zones/county/…` into the image and minimising their distance to
the drawn lines: median residual 0 px, 90th percentile 1 px. Mercator and
azimuthal-equidistant models fitted an order of magnitude worse. Repeated on
KUEX and KDMX, which agree to ±0.002°, so the figures describe the product
rather than one image.

Worth knowing if this needs revisiting:

- NWS publishes **no** georeferencing for these files. `/ridge/standard/`
  contains GIFs and nothing else — no world file, no `.aux.xml` — and
  radar.weather.gov's own viewer uses the same file as an ungeoreferenced
  picture. Nothing upstream promises the extent will hold, so if NWS changes the
  product the marker moves silently. Re-measure with the method above.
- The obvious assumption, that a single-site image is centred on its radar, is
  **wrong** in latitude and was off by 8 px (~7 km) at the 90th percentile.
  `tests/radarGeo.test.ts` fails if someone simplifies that offset away.
- The header and footer bars are drawn over the map, so a point can be inside
  the bbox and still have nothing under it but NWS chrome. `radarImageFraction`
  returns null there.

Approach 3 (centring the interactive-radar link on the DZ) is still open, but
no longer opaque. The `?settings=v1_<base64>` parameter is base64 JSON, and
both the site's encoder and its reader were read from its bundles on
2026-09-23 — see [`radar-interactive-link.md`](radar-interactive-link.md).
The reading says a single-station view is re-centred on the radar once the
station list loads, so "centred on the DZ" and "KOAX's own product" cannot be
had in one link; only the national mosaic takes a centre. That is a code
reading, not an observation: no URL has been opened in a browser from here.
The doc lists six links (A–F) for a person to open on a phone and desktop, and
what to look for; B is the one that settles it. Until then the card keeps its
plain station link.

## Mark Schulze's Winds Aloft: AGL or MSL?

**Settled: AGL.** Evidence and a re-check recipe in
[`markschulze-altitude-reference.md`](markschulze-altitude-reference.md). The
winds-aloft card now says so, since it is the cross-check it sends jumpers to.
