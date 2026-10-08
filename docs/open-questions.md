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

2. **Density altitude: the card's number is not the pamphlet's.** FAA-P-8740-2
   (read 2026-09-23) supports the card's claim — reduced rate of climb, longer
   takeoff — but states no 120 ft/°C coefficient (its rule-of-thumb chart
   implies roughly 100–115) and explicitly leaves humidity *out* of the
   density-altitude computation, treating it as an engine-power effect. The
   card folds humidity in via virtual temperature, so on a humid day its
   headline figure will not match the one the PIC computes from ASOS or an
   E6B. Decide whether the dry-air figure should be the headline with the
   humidity correction as a separate line. A10 on the #citations page.

3. **The claims still need an instructor, not another reading.** Every USPA,
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

4. **The app's own thresholds, for an instructor's judgement rather than a
   lookup.** Part B of the citations page — currently one entry, the 25 kt
   licensed bar scale, which triggers nothing and only sets how long a bar is
   drawn.

## To do: link the waiver sign's photo under the tier selector

Asked for 2026-10-08. Under the LSPC waiver tier buttons (the
`tier-toggle` row in `src/components/ProfileSelector.tsx`, shown on the
Jumpers tab once Student and then "LSPC waiver" are picked), a link straight to the photo of the posted sign,
`docs/lspc-waivered-wind-limits.jpg`, so a jumper choosing a tier can see
the sign the tiers were transcribed from.

Today the only way there is the `lspcWaiver` citation, which links to the
transcription (`docs/lspc-waivered-wind-limits.md` on GitHub) and the photo
from that. To decide: link the image on GitHub (`${REPO_URL}/blob/main/...`,
like the citation) or serve a copy from the site under `public/` (opens
without GitHub, but then two copies to keep the same; a test could compare
them). Either way the link should say the photo is undated, as the
citation's note does.

## To do, later: a licence setting under Licensed

Asked for 2026-10-08. The Licensed profile covers A, B, C and D licences,
whose BSR minimum opening altitudes differ (2-1 I: 3,000 ft for students and
A-license holders, 2,500 ft for B, C and D). The drift card's Deploy box
therefore opens on 3,000 ft whatever the profile (`DEFAULT_DEPLOY_FT`), with
a note saying B to D are lower. A licence choice under the Student/Licensed
switch (`src/components/ProfileSelector.tsx`) would let the default follow
the licence. Nothing else in the app reads a licence today: no BSR wind
limit applies to licensed jumpers, so the surface-wind card would not change.

## To do: look into Open-Meteo's cloud cover

Asked for 2026-10-08. Open-Meteo serves cloud cover as a percentage three
ways: total, low/mid/high bands (`cloud_cover_low` and so on), and per
pressure level (`cloud_cover_850hPa` and so on). None of them gives a cloud
base height, and on the day it was looked at every pressure level read 0%
with only high cloud forecast, so there was nothing to compare.

What the dashboard reads the sky from today:

- **Now:** the KPMV METAR (Plattsmouth, about 12 mi ENE), from IEM first and
  api.weather.gov second, its sky groups parsed from the METAR text
  (`normalizeIemCurrent`, `normalizeNwsObservation`). This is the observed
  report: layer amounts and measured bases.
- **Forecast hours:** the NWS gridpoint forecast for the drop zone's own grid
  cell (`skyCover`, a percentage, and its derived ceiling), on the Ceiling &
  sky card and the hourly detail of the 10-day outlook.
- **10-day outlook:** Open-Meteo's daily weather code (its own reading of its
  model), or on the fallback the day's mean NWS gridpoint cover.

Questions to settle before adding any of it: what a per-level cloud
percentage means against an exit altitude and 14 CFR 105.17's cloud
clearances (it is a model's cloud fraction in a layer, not a base); whether
it agrees with the METAR often enough to be worth a second sky figure on
the page; and how it would be shown without reading as a ceiling. A
comparison logged over a few weeks of real cloud (METAR bases against the
level where Open-Meteo's cover first rises) would answer the second.

## To do, eventually: add this app to Open-Meteo's list of users

Raised 2026-10-08. Open-Meteo's README
(<https://github.com/open-meteo/open-meteo>) asks: "Do you use Open-Meteo?
Please open a pull request and add your repository or app to the list!"
This app reads its winds aloft (pressure levels, with the 10 m and 2 m
samples) and the 10-day outlook from Open-Meteo, so it qualifies. Not started: the pull request goes to another
project's repository under the maintainer's name, so it waits on the
maintainer deciding to send it. Before writing the entry, read the README's
list as it then stands for the format it uses.

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

## Winds aloft

The sub-surface question that sat here is settled and fixed: pressure levels
below the model's terrain are dropped in `normalizeOpenMeteo`. Evidence, the
measurements behind it, and — importantly — the sources that could *not* be read
are in [`subsurface-pressure-levels.md`](subsurface-pressure-levels.md). The share this
entry used to quote (~4%, rising to ~15%) was a property of the **fixture**,
which sets `elevation: 360`; live Open-Meteo returns 349, which put the 10 m
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
