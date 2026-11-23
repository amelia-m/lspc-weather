# Working notes for this repo

A skydiving weather dashboard for the Lincoln Sport Parachute Club (Brown's
Airport, NE69). Read `README.md` for what it shows. This file is the standing
context for working on it.

`.agents/project-profile.md` (a draft since 2026-11-23) holds what the maintainer's global rules ask a project to settle: attribution, who may push and merge, which review runs.

## The rule that governs everything here

**The dashboard never gives a go/no-go verdict.** It flags a condition and
hands the reader the rule behind it so a human (the jumper, the S&TA, the
pilot in command) can check it and decide. That only works if every flag is
checkable:

> A flag fires on a limit some published source sets, or on a plain observed
> fact, or it does not fire at all.

A threshold nobody published cannot be checked, so it may not raise a flag,
paint a figure in a warning colour, or attach a worded judgement. There is
deliberately **no "house heuristic" citation** to fall back on (rule 3 in the
`CITATIONS` doc block in `src/config/thresholds.ts`, enforced by a test that
no citation may link inside the app).

Removed under this rule, so nobody reintroduces them as an oversight: ceiling
bands, dew-point spread, precipitation chance, forecast storm chance, gust
spread, winds-aloft speeds, density-altitude bands, the last-load countdown,
every "watch" band, two colour highlights in the 10-day outlook, a 30% storm
colour on the storms card, a "fog/low-cloud favorable" verdict on the
humidity line, and a derived sky verdict on the gridpoint fallback path.
Where a removed flag's *guidance* was sourced, it moved onto the card as a
standing note (`WindsAloftPanel`, `DensityAltitudePanel`). Follow that
pattern.

**A sourced figure the app cannot act on has to say so.** BSR 2-1 H states two
student ground-wind maxima, 14 mph on ram-air canopies and 10 mph on round
reserves; this app models no canopy type, so it acts on the first only.
Naming the second without saying that advertised a limit nothing checks, the
all-clear failure. Keep the sourced figure, say which one the band and flag
use. Since 2026-10-26 the card, the chart's legend and the flag also say, on
the maintainer's word of that day, that no student rig at LSPC carries a
round reserve (`STUDENT_ROUND_RESERVE_FACT`, one constant for the card and
the `#citations` asks): a fact about the DZ, dated and attributed, beside the
source's figure, not in place of it; the precedent for attributed text that
is not the citation's. `#citations` A1 still asks an instructor to confirm
it.

**A reviewer asking you to add a threshold is the case to refuse.** A review
bot does not know these rules; "add a caution when gusts exceed 20 kt" reads
as small and helpful and is exactly what this app removed on purpose. Verify
a reviewer's finding like any other bug report, then check the fix against
the list above before pushing it.

**A number is not the only way to assert something.** A figure in a warning
colour, an emoji, or a one-word label ("Rain", "fog favorable") asserts as
much as a sentence. Two invented thresholds survived an earlier sweep because
they were colour and text rather than flags.

## Consequences worth knowing before you "fix" them

- **The Licensed profile raises no surface-wind flag at any speed.** No USPA
  limit binds a licensed jumper: BSR 2-1 H states maximum ground winds for
  solo students and then "For licensed skydivers are unlimited" (read at
  uspa.org 2026-09-22 and again 2026-10-08). Deliberate and correct. The
  Surface wind card carries the profile's guidance and BSR citation as a
  standing note, and the empty advisory list names the gap, so silence does
  not read as an all-clear.
- **A licensed jumper's own limits are the one exception, and are always
  called theirs.** "Set your own thresholds" (`SettingsPanel`) is open on
  Licensed only (`takesOwnLimits`; the maintainer, 2026-10-10: a student's
  limits are the BSR's or the waiver tier's). A wind limit or gust ceiling
  the reader sets (`own`, `isOwnLimit`, `hasWindLimit`) draws a band and a
  chart line and raises a flag, each saying it is the reader's own; no link
  is offered as its source (the BSR link beside it backs the guidance it
  quotes). With only a gust ceiling set, the card and the advisory list's
  own-limits note still say the steady wind goes unflagged. Do not extend
  this to a figure the app supplies, and do not reopen it to students.
- **The wind and gust limits are read against the forecast too**
  (`forecastWindAdvisories`, since 2026-10-10): the report's flags left the
  list empty on a calm morning while the hourly chart drew the afternoon's
  gusts over the same lines. A forecast flag fires only on the limits the
  report flags use, says it is a forecast, names its hours in the next 12,
  ranks below every observed flag, and reads the forecast in whole knots so
  the peak it prints never sits under the limit it names. Not a licence for
  forecast thresholds of the app's own: a forecast storm or rain chance
  still flags nothing. Since 2026-10-28 the Surface wind card carries a
  standing note on the forecast gust (`FORECAST_GUST_NOTE`, the maintainer's
  call): six months against KPMV's reports, the side and typical size of the
  difference, dated to docs/nws-gust-archive.md and held to it by a test.
  Figures beside the flag, not a correction to it.
- **The Surface wind card is first on the Jumpers tab: one bar with every
  mark labelled, then one line per limit** (the maintainer, 2026-10-10). Its
  first line says what it is (2026-10-30, "make it very clear"): "Observed at
  KPMV (11 mi ENE of the DZ), <time>: the latest report, not a forecast"
  (`.wind-observed`, from `METAR_STATION_OFFSET`, a test pins it). The
  forecast reaches the Jumpers tab only through the Forecast flag and the
  hourly chart; Open-Meteo's 10 m wind is on the Winds aloft card's Surface
  row and nowhere else (2026-10-30: not beside the observation). The other
  way round, yes: since 2026-10-31 the Winds aloft card shows the same
  report under its table, labelled with station, distance and time (the
  `observed` prop; `tests/windsObserved.test.ts`). Each mark carries its
  figure on the bar (limits above, wind and gust below, pushed apart when
  close, `spreadLabels`), and each limit's line names it, what it is held
  to (the caution the higher of wind and gust, the gust ceiling the gust)
  and how far over or under the reading is, worked from the figures as
  printed so they add up in mph. One fill colour: a green end read as
  "fine". Do not bring back a legend in place of the labels, or a bar per
  limit.
- **The Ceiling & sky card is one table per local day** (since 2026-11-18,
  the maintainer's word after three readings: docs/ceiling-sky-layout-review.md,
  docs/data-viz-notes.md, docs/cloud-forecast-layouts-elsewhere.md): eight
  three-hour columns, the same hour in the same column of every day,
  usairnet's form, which fits a phone where one wide table does not.
  `src/domain/skyDays.ts` builds the blocks (pure; a slot's time is the
  three-hourly bulletin's column or the earliest hour a forecast has in it;
  figures read at that time exactly), `CeilingSkyDays.tsx` draws them.
  Rules that should stay: every figure printed; a blank cell where a
  forecast does not reach, never a dash (it read as missing data); the
  heights band the right way up (the base a bar at its height, cloud above
  a ceiling; the first version filled from the ground to the base and read
  backwards); one colour per source, none per value; night shaded by the
  slot's greater part (`spanIsNight`); no chip, icon or sky word for a
  slot. From the same day's second reading (docs/ceiling-sky-rebuild-review.md):
  a band column and its base cell are one bulletin's (`slotBase`: the
  three-hourly's where the slot has its column, else the hourly's, dotted);
  a height at or above 12,000 ft is a strip on the top edge, not a height-0
  fill; a row is drawn only on a day with a figure in it; where the NWS
  ceiling forecast ends is one line under the tables, read over the whole
  list (`nwsCeilingForecastEnd`, since a per-day search missed an end at
  local midnight); today is its hourly rows alone from 6 PM (`slotsLeft`,
  by the clock, not the forecast's reach, or a short fixture trips it). The
  strip, its 12/24/36 toggle and the four trial layouts are gone; do not
  bring a scrolling strip back.
- **The visibility flag holds the surface reading to both 105.17 rows**
  (`VISIBILITY_ROW = 'both'`, the maintainer's answer of 2026-10-31 to A8:
  the rows are MSL, so a 10,000 ft AGL exit is in the 5 SM row and a
  hop-and-pop in the 3 SM row). It fires below 5 SM and its value says which
  rows the reading is under (`visibilityRowsUnder`); the guidance carries
  the DZ fact the 3 SM row rests on, dated and attributed
  (`HOP_AND_POP_FACT`), and A8 asks an instructor to confirm both. The two
  single-row settings stay in `VISIBILITY_ROWS`; every test passes with any
  of the three. Neither figure is the app's.
- **The flight-category flag prints a comparison under IFR and LIFR** (the
  maintainer, 2026-11-03): the reported visibility against 3 SM, the lowest
  row of 105.17's table, and the reported ceiling against 2,000 ft AGL, the
  lowest opening altitude in BSR 2-1 I, with 105.17's cloud rules and a
  broken layer's gaps as the caveat (`flightCategoryComparisonText`; an
  advisory's `citations` is one ordered list, the trigger's source first).
  The 2,000 ft derives from one table of 2-1 I's altitudes
  (`OPENING_ALTITUDES_FT_AGL`), which the drift card and A2 read too. MVFR
  gets none, since the figures do not settle it (docs/open-questions.md,
  "Settled: the flight categories against 105.17 and BSR 2-1 I"). The
  flag's level and the overcast flag's Watch are still the app's, put to the
  S&TA as B2 on `#citations` since 2026-11-05 (`JUDGEMENTS`, a `judgement`
  entry: questions only, no claim verdict). Change neither before that
  answer.
- **Wind limits render with a decimal in knots** (`fmtLimitSpeed`): the
  waiver's top gust ceilings are 19 and 20 mph, and rounded to whole knots
  both printed "17 kt", so the tier a jumper earned changed nothing on
  screen. Readings stay whole, as a METAR reports.
- **`compass()` is 16-point.** An 8-point label put 060° in "NE", a 15° error
  that matters over a 10,000 ft freefall.
- **The sky is read from the METAR text, not from the API's `cloudLayers`.**
  On 2026-09-23 api.weather.gov served seven consecutive KPMV observations
  with `cloudLayers: []` and an empty `textDescription` while `rawMessage`
  read `OVC027` to `OVC035`, still empty twenty minutes later (a gap, not a
  lag); the dashboard showed "Clear", "No ceiling" and VFR under a 2,700 ft
  overcast, found from a screenshot of the deployed site.
  `normalizeNwsObservation` parses the sky groups from the text and uses
  the decoded layers only when the text has none; do not "simplify" it
  back. An empty `skyLayers` means *not reported*, the cards say so, and
  `observedFlightCategory` never shows VFR from a report with no ceiling in
  it (visibility alone can establish MVFR/IFR/LIFR, not VFR). The API also
  serves records with no `rawMessage` but a full decode (37 of the last 40
  at KLNK and KAUS, 4 of 40 at KPMV), its decode gives `CLR` a base of
  3,810 m where the text has none, and aviationweather.gov represents a
  clear sky as no `clouds` entries; every comparison allows for those three
  shapes, so do not tighten them without re-sampling. Two watches: the
  METAR row on Data health grades the two decodes against each other
  (`skyDecode`, amber when missing or disagreeing), and
  `.github/workflows/sky-parity.yml` compares the parse against
  aviationweather.gov's decoder daily. `normalizeIemCurrent` reads IEM's
  record in the same order.
- **The observation is read from IEM first, NWS second, and the newer report
  wins** (`src/domain/iem.ts`, `src/api/iem.ts`), polled every 2 minutes.
  Timed 2026-09-27: IEM had each KPMV report 4 to 6 minutes after it was
  taken, api.weather.gov 24 to 33. aviationweather.gov and NOAA's raw files
  are as quick but send no CORS header. NWS is kept because IEM is a
  university service with no uptime promise; a tie goes to IEM.
  Temperatures come from the METAR text on both feeds (`tempsFromRaw`: the
  T group, else the body group), the decode only when the text has none:
  IEM's `dwpf` is whole °F and converts back a tenth off, and NWS's decode
  can be null while the text has the figure (read 2026-10-09).
- **The NWS gridpoint is fetched with `cache: 'no-cache'`, and the newer copy
  is kept** (`fetchFreshGrid`, `newerGridpoint`, since 2026-10-23). NWS sends
  a `max-age` up to an hour and Chromium answered the ten-minute refresh
  from disk, pinned to one edge copy while other edges served a newer
  forecast: behind the newest known forecast at 10.9% of refreshes (mean
  7.2 min) over 13 days of samples, 6.0% (3.9 min) with the guard. A
  cache-busting query parameter gets a 400. See docs/nws-gridpoint-age.md.
- **Offutt's TAF comes through a relay of the maintainer's** (`relay/`, a
  Cloudflare Worker at `lspc-taf-relay.amelia-m.workers.dev`, deployed
  2026-10-27; `TAF_RELAY_URL` in `src/config/tafRelay.ts`; docs/taf-relay.md).
  Workers Builds deploys `relay/` from `main` on merge, so a relay change
  needs no deploy step (seen 2026-11-03). The USAF issues the TAF,
  api.weather.gov does not carry it, aviationweather.gov sends no CORS
  header, and a workflow copying it was ruled out on GitHub's Actions terms
  ("part of a serverless application", read 2026-10-20). The Worker fetches
  fixed things only (the TAF; since 2026-10-27 KPMV's block of the NBM's
  hourly bulletin, `/nbm/KPMV`; since 2026-11-12 its three-hourly bulletin,
  `/nbm/KPMV/nbs`, 6 to 72 hours, the one usairnet's three-day table reads;
  docs/nbm-lowest-cloud-base.md) and answers only the site's origins. Its
  entry module exports only the handler: Cloudflare's runtime refuses any
  other named export.
- **Sunrise and sunset are NOAA's method, held to NOAA's own script.**
  `src/domain/sun.ts` ports NOAA's Solar Calculator
  (gml.noaa.gov/grad/solcalc/main.js); its tests match that script to 5 ms,
  and rounded to the minute it matched the US Naval Observatory's API in 56
  of 56 events across 2026 (read 2026-10-03). It replaced a simplified
  formula that put sunset 2 to 3 minutes late, so the 14 CFR 105.19 night
  flag fired late. Do not swap in a shorter formula without re-running that
  comparison.
- **Schulze's "Surface" row is not a surface wind.** It is a straight line
  through his raw pressure levels read at 0 ft (here between his 1000 hPa
  level, underground at this DZ, and 975 hPa), matched in 72 of 72 hours at
  four sites on 2026-10-03; it reads like the wind a couple of hundred feet
  up and runs above the 10 m wind this app shows, most at night
  (`docs/markschulze-altitude-reference.md`, "How the surface row was worked
out"). Against KPMV's measured wind the 10 m row was nearer in 104
  of 156 hours to 2026-10-08 (his 23, tied 29; same doc, "Which Surface row
is nearer the measured wind"), 51/11/17 over 79 hours at the landing area
to 10-17 (`scripts/surfaceRows.ts`), and 249/47/73 over 369 hours to 11-04
(same doc, "Again, to 2026-11-04"). A point about heights, not a fault in his
  tool.
- **The winds-aloft table can differ from Mark Schulze's, and each cause is
  known.** Both read Open-Meteo; from 2026-09-23 the app sampled the same
  pressure levels below 18,000 ft (`OPEN_METEO_PRESSURE_LEVELS`, thirteen
  of his twenty) and the same hour agreed within 4° and 1 kt everywhere.
  Since 2026-10-08 the app also samples the 80, 120 and 180 m winds
  (`OPEN_METEO_HEIGHT_LEVELS_M`, the canopy layer), which decide the 500 ft
  row his table lacks and can move the compared 1,000 ft row on
  high-pressure hours, and the default table takes seven pressure levels
  his does not (`OPEN_METEO_EXTRA_PRESSURE_LEVELS`). The card's "As
  Schulze" view rebuilds the hour his way (`interpolateAsSchulze`), and the
  comparison logs both tables against his (`asSchulze` beside `aligned`),
  so `#parity` shows the app reproduces his table and how far the default
  moves from it. Keep "As Schulze" his method exactly; improvements go in
  the default. The two can be on different forecast runs for the same hour
  (114 of 1,611 comparisons to 2026-10-05, mostly between half past and ten
  to the hour): settled 2026-10-27 by the run-split sampler
  (docs/run-split.md), it is the minute a new HRRR run reaches Open-Meteo's
  servers, not his next-hour request. Run `scripts/schulzeCompare.live.ts`
  before touching the interpolation.

## Citations

Every USPA, CFR and FAA reference began as an AI recollection (the club's
posted tiers are a transcription of an undated photo of the sign, and say
so). The **USPA SIM** sections were read at uspa.org on 2026-09-22 (every
cited part again 2026-10-08), the **CFR sections, AIM 7-1-7 and
FAA-P-8740-2** on 2026-09-23 (105.17, 105.19 and 91.155 again 2026-11-03),
and the claims corrected against them. A reading is not an instructor's
sign-off, and the difference is not a detail to smooth over. The page at
`#citations` (`src/components/CitationsPage.tsx`, data in
`src/config/citationsChecklist.ts`) records per claim what the section says,
when and where it was read, and what a reading could not settle, and takes
the reviewer's answers (a verdict per claim, an answer and note per
question, kept in the browser by `src/api/citationAnswers.ts`, sent as a
prefilled GitHub issue or copied text by `src/domain/citationAnswers.ts`).
It says nothing about what the app used to claim; a test rejects that
wording. History lives in the commit log.

When each cited or quoted section was last read, in which edition and how,
is `src/config/readingLog.ts`, listed at the end of `#citations`; every
citation has exactly one entry there and its note's date must be the entry's
(a test holds both). uspa.org names its online SIM only as the "2026 SIM" and
revises it within an edition (its change-document list, seen 2026-10-10,
held only 2021-2022 and 2023-2024 revisions), so each cited or quoted SIM
part is also pinned by a SHA-256 of its text (`simPartText`,
`src/domain/simText.ts`, from the part's anchor to the next part's).
`scripts/simText.live.ts` takes it again daily and fails when a part's words
change or its anchors are gone, when a quote in a SIM-reading entry's
"source says" lines is in none of the parts tied to that entry (CFR and club
quotes and the questions are skipped), when uspa.org cannot be fetched, or
when the SIM page names an edition other than `SIM_EDITION_YEAR`
(`simEditionYear`): a new edition means reading every part again. After reading a part again, take its
fingerprint with `PRINT_SIM_FINGERPRINTS=1`, and move `SIM_LAST_READ` only if
every part was read that day.

Words the SIM glossary defines link to it from the cards' prose (`SimTerm`,
`src/config/simGlossary.ts`, read 2026-10-09): each term at most once per
card, never in a label, caption, input prompt, readout, the unit of a sourced
figure, or an existing link. The glossary has anchors per letter heading
only (`…/sim/glossary#S`; K, Q, V, X and Y have none), so do not invent a
per-term fragment. They are links to a definition, not citations: in neither
`CITATIONS` nor the reading log, styled apart, and a term stays plain in a
flag or note that already cites the document it names (`linkableTerms`).
Linking a word asserts its definition applies: "waiver" stays unlinked (A5
still asks whether the club's tiers were filed as a SIM 2-2 waiver), "night
jump" (the glossary's one-hour figure is not the night flag's trigger),
"density altitude" (the card quotes the FAA's definition and adds a "With
humidity" row the glossary's method leaves out). `scripts/simText.live.ts`
checks daily that each linked term is still a heading under its letter
(`glossaryHeadings`).

When touching a citation:

- `source` and `url` must name the same section, or neither may. A test
  enforces this.
- Where the governing section is unknown, the citation stays on the document
  index **and says so in its note**: a confidently wrong section number sends
  a jumper to the wrong rule while looking authoritative.
- Never write that a citation has been checked unless you opened the
  document. Say what you read and when ("read in the online SIM at uspa.org
  on <date>"), not "verified": the website's SIM on one day is not a printed
  edition.
- SIM links carry the page's own part anchor (`…/sim/2-1#1H` for 2-1 H; the
  served HTML marks each part with `<a class="anchoroffset" name="1H">`,
  readable with curl, read 2026-09-23). The scheme is the section's digit
  within its chapter plus the part letter, and a test checks the anchor
  names the part. Add an anchor only after reading it on the page.
- `www.ecfr.gov` answers a script with a 302 to a bot-check host. The eCFR
  API serves the same text with `--compressed`:
  `https://www.ecfr.gov/api/versioner/v1/full/<date>/title-14.xml?part=105&section=105.17`.
  Leave citation URLs on the human-facing pages; say in the note that the
  API was read and which "current as of" date it served.

## What can and cannot be verified from a sandbox

Outbound network access goes through a policy-enforcing egress proxy; a
change to the environment's allowlist applies to a running session as soon
as it is saved. Allowlisted, with subdomains: `*.weather.gov`,
`aviationweather.gov`, `gml.noaa.gov`, `tgftp.nws.noaa.gov` (NOAA's raw METAR
and TAF files), Open-Meteo, USPA, eCFR, FAA, FAASafety, usairnet,
markschulze.net, `amelia-m.github.io`, `mesonet.agron.iastate.edu` (IEM,
since 2026-09-29); since 2026-10-03 `aa.usno.navy.mil` (the US Naval
Observatory's sun and moon API), `skyvector.com`, `tiles.arcgis.com` (FAA's
VFR sectional tiles) and `*.blob.core.windows.net` (GitHub's artifact
downloads redirect there); since 2026-10-08 `github.com`, the ADS-B networks
(`adsb.lol`, `adsb.fi` with `globe.` and `opendata.`, `airplanes.live`,
`opensky-network.org`, `api.adsb.one`), map tiles (`tile.openstreetmap.org`,
`*.tile.openstreetmap.de`, `server.arcgisonline.com`,
`services.arcgisonline.com`), `earthdata.nasa.gov` and `heywhatsthat.com`
(docs/adsb-receiver.md); since 2026-10-20 `docs.github.com` and
`developers.cloudflare.com`; since 2026-10-26 `vlab.noaa.gov` and
`blend.mdl.nws.noaa.gov` (MDL's NBM text card and bulletin viewer),
`nomads.ncep.noaa.gov` (NOAA's copy of the NBM bulletins; the S3 bucket
`noaa-nbm-grib2-pds` answered before) and `www.flyaerodyne.com`; since 2026-10-27
`lspc-taf-relay.amelia-m.workers.dev`; since 2026-10-28
`basemapstyles-api.arcgis.com`, `opengeo.ncep.noaa.gov` and
`geocode.arcgis.com` (radar.weather.gov's viewer, docs/radar-interactive-link.md;
its basemap art at
`cdn.arcgis.com` is not, and the map draws without it). Reachable is not
readable: `globe.adsb.fi`, `api.adsb.one` and `airplanes.live` answer a
script with Cloudflare's 403. Comparison artifacts can be read with
`curl -sL https://api.github.com/repos/amelia-m/lspc-weather/actions/artifacts/<id>/zip`
(the session's GitHub proxy supplies the credential); `gh api` refuses to
follow that redirect.

Checkable from here, and checked: the live NWS and Open-Meteo paths, the TAF
chain and the NOAA FD winds fallback, by running the app's own fetch and
domain code under Node; component output on live data via
`renderToStaticMarkup` (how the FD fallback's fake Surface row was found);
the radar GIF and its georeferencing; the SIM, CFR, AIM and FAA sections
behind the citations; the usairnet KPMV page as a second decode of the same
METAR (plain HTML, with a browser User-Agent).

Not covered by `npm test`, so do not imply a green suite covers them:

- **The deployed site in a browser, against live data: checkable since
  2026-10-17.** Playwright's Chromium does not trust the proxy's
  TLS-intercepting CA on its own (`~/.pki/nssdb` is empty and `certutil` is
  not installed), but `--ignore-certificate-errors-spki-list` takes the
  hashes of the proxy's own CA certificates from `/root/.ccr/ca-bundle.crt`
  (subjects with `O = Anthropic`); with them and the session proxy it loads
  <https://amelia-m.github.io/lspc-weather/> and the live APIs and still
  rejects any other certificate (without the flag the same load fails with
`ERR_CERT_AUTHORITY_INVALID`):

  ```
  d=$(mktemp -d)   # fresh, so no certificate from an earlier split is trusted
  spki=$(csplit -s -z -f $d/ca- /root/.ccr/ca-bundle.crt '/-----BEGIN CERTIFICATE-----/' '{*}';
    for f in $d/ca-*; do openssl x509 -in $f -noout -subject | grep -q Anthropic &&
      openssl x509 -in $f -pubkey -noout | openssl pkey -pubin -outform der |
      openssl dgst -sha256 -binary | base64; done | sort -u | paste -sd,)
  # in the script:
  # chromium.launch({ executablePath, proxy: { server: process.env.HTTPS_PROXY },
  #   args: [`--ignore-certificate-errors-spki-list=${spki}`] })
  ```

  Through the proxy, Open-Meteo's requests can fail on the first try as
  "blocked by CORS policy" and succeed on the app's retry: the proxy's own
  answer on a slow request, which a reader's browser and a GitHub runner
  never meet. Both pages name `public/favicon.svg` since 2026-10-17 (the app as
  `/favicon.svg`, which Vite rewrites under the base; the ceiling-error
  page as `../favicon.svg`; before that the browser asked for
  `/favicon.ico` and got a 404; `tests/favicon.test.ts` pins the links and
  the file).
  docs/open-questions.md, "Viewing the deployed site from the sandbox", has
  the rest.

  For a change not yet deployed, serve the production build over local http
  and let Playwright fulfil cross-origin images itself (how the radar marker
  was verified):

  ```
  BASE_PATH=/ VITE_USE_FIXTURES=true npm run build
  (cd dist && npx http-server -p 8788 -s &)
  # in the script: page.route('https://radar.weather.gov/**', r => r.fulfill({ body: localGif }))
  ```

  That exercises the real bundle under the real CSP at 1280/390/320 px. To
  have live data too with a local server (the relay under `wrangler dev`,
  say), give Chromium the proxy and the SPKI list as above **and**
  `bypass: '<-loopback>,localhost'`, or the localhost page goes through the
  proxy, which answers plain HTTP with 405 (2026-10-27). A Node render is
  not a substitute for either: `renderToStaticMarkup` runs no effects,
  loads no images, applies no CSS.
- CI runs the same fixture-backed suite. Nothing in `npm test` touches the
  network.

**The sandbox cannot delete a remote branch**, and the failure looks like
success: `git push origin --delete <branch>` prints "Everything up-to-date"
and exits 0 while the ref stays, and `gh api -X DELETE
/repos/.../git/refs/heads/<branch>` answers 403 (a policy denial, checked
2026-10-17 and 10-18); the GitHub MCP server has no delete. A merged branch
is the maintainer's to tidy; put the list in `docs/open-questions.md`.

**And a merged-looking branch is not an unused one.** These `claude/*`
branches are not one per PR: a session keeps one and reuses it, so between
merges a live branch has no commits outside `main`. On 2026-10-17 that
reading put `claude/fervent-feynman-zm42xw` on a deletable list hours after
it had merged eight PRs (#167-#174). Only the branch's PR list (`gh api
"/repos/<owner>/<repo>/pulls?state=all&head=<owner>:<branch>"`) and its last
push date say whether anyone is using it.

Two habits: `NODE_USE_ENV_PROXY=1` plus
`NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` makes Node's fetch go through
the proxy; and `markschulze.net` 403s without a `Referer`.

NOAA's NDFD archive (`noaa-ndfd-pds.s3.amazonaws.com/wmo/<element>/`) is the
NWS gridpoint's past, large but quick from here. A header's third letter is
the region: `U` is CONUS (`YWUZ98`, gust, 3-day), `A` Puerto Rico (`YWAZ88`),
so list by the full header. The CONUS 3-day files come every half hour at
30 to 57 MB; the comparisons take the last in each of 00, 06, 12 and 18Z,
120 files a month, and `scripts/cloudCoverFetch.py` with `WORKERS=6` fetched
a month of gust (about 6 GB) in about a minute and a half (2026-10-23).
Which NDFD elements match the API value for value is in
docs/open-questions.md, "Forecasts kept for later": search the docs before
calling anything there unchecked.

Open-Meteo's daily request limit is per address, and the sandbox leaves by a
pool of shared addresses (eight seen in 160.79.106.0/24 on 2026-11-19 via
Cloudflare's `/cdn-cgi/trace` on an allowlisted host it fronts), so it
can be refused for a day by other tenants: "Daily API request limit
exceeded." Five times so far (2026-09-23, 10-10, 11-12, 11-13, 11-19), each
with `X-RateLimit-Remaining: 0.0` of 10,000 and a reset moments after
midnight UTC, when nothing of this repo was running
(docs/open-questions.md, "How the sandbox hits the limit"). A key on
Open-Meteo's paid tier would give the sandbox a quota of its own, the
maintainer's call. GitHub runners have their own addresses and have never
met it (no 429 in about 2,000 archived requests read 2026-10-10), so a heavy
Open-Meteo fetch runs as a workflow (`.github/workflows/cloud-cover-fetch.yml`,
by hand, added 2026-10-11); a script that fetches from here gives up on the daily-limit 429
rather than retry it (`scripts/cloudCoverFetch.py` does) and fetches in
parts. Readers' browsers call from their own addresses. The free API charges
a request its weight, variables over ten (times days over fourteen above
fourteen), read in its server source 2026-10-31 (docs/open-meteo-terms.md):
the app's winds request is 9.6 calls, so 10,000 a day is about a thousand of
them, not a thing to spend on a test of the limit. Each browser counts its
own requests the same way (`src/domain/openMeteoUsage.ts`, every attempt
through `fetchJson`'s `onAttempt`, since 2026-10-31) and Data health shows the count by UTC day for a fortnight; since
2026-11-04 the API exposes its own count in `X-RateLimit-*` headers (windows
roll per client from its first request), which Data health prints for the
address from the newest answer (`parseRateLimitHeaders`, `ServerQuota`) and
keeps per request so the By-day table shows the day's tightest
(`tightestOf`).

## Conventions

- **Every finding goes in the repo in the same piece of work.** A fetch, a
  test result, a comparison, a dead end worth not repeating: write it in the
  relevant `docs/*.md`, `docs/open-questions.md` (anything waiting on the
  maintainer) or here, with any data under `data/parity/` beside the script
  that made it. A reply in the chat is not a record (on 2026-10-13 two
  investigations were reported only there until the maintainer asked). A
  project hook (`.claude/settings.json`, UserPromptSubmit) repeats this on
  every prompt.
- **Record it briefly.** A record is the outcome and what it rests on: the
  date, the figure, the file, the run or issue number, who decided. Not the
  process: no narrative of the attempts, no restating a question once it is
  settled (replace the history with the result and a pointer), no repeating
  in open-questions what a doc already says (one line and the doc's section
  name), no "what follows is the question as it stood" tail. A sentence over
  a paragraph, a figure over an adjective. Every session reads these files,
  so their length is a cost: on 2026-11-20, at the maintainer's word,
  docs/open-questions.md was cut from 25,000 words to 15,000 and this file
  from 9,800 to about 6,000 with nothing lost. An entry that outgrows a
  screen is the sign to condense it.
- **Comments explain WHY, with domain context.** Calibrate on
  `src/domain/densityAltitude.ts`. Never write a comment describing behaviour
  the code does not have; several did, and each misled a later reader.
- `src/domain/` is **pure**: no I/O, no `Date.now()`, no mutable module
  state. Time is passed in. Side-effecting helpers live in `src/api/`.
- New domain module ⇒ new tests under `tests/`. Vitest runs in a `node`
  environment over `tests/**/*.test.ts`; no jsdom. Component behaviour is
  tested with `react-dom/server`'s `renderToStaticMarkup`.
- A removed flag is tested by asserting it is absent **in conditions that
  would previously have tripped it**.
- **Prove a new test by breaking the thing it names.** Revert the behaviour,
  watch the test fail, restore (with sed or a scripted edit, never `git
  checkout` on an uncommitted file: a fix was lost that way twice). Two
  tests here passed identically with the code they claimed to pin deleted:
  one put its fixture on the wrong side of a boundary, one asserted that a
  set built from `CITATIONS` contained a `CITATIONS` url.
- **Changing a function's contract stales comments that describe it
  elsewhere.** `interpolateWindsAloft` stopped extrapolating and silently
  falsified a comment in `spot.ts` justifying its own extrapolation
"matching `sampleAt`", a rationale in `useWeatherData.ts` and the card
text in `WindsAloftPanel`. After changing what a function
  guarantees, grep for its name and read every hit.
- **Before writing that something was not checked, search the docs for
  it.** On 2026-10-23 an open question said the NDFD gust's match to the API
  was "not yet checked"; it had been, 42 of 42 hours, three hundred lines
  further down the same file.
- **Open-Meteo's data carry its credit wherever they are shown**, the
  repository included: a doc quoting its figures gets the credit under its
  title, a figure drawn from it a credit line (`histogramGridSvg`'s
  `credit`), an archive of it a line in `data/parity/README.md`
  (docs/open-meteo-terms.md).
- Derive values rather than writing them down twice: a hand-written
  `distanceMi: 12` had drifted from the real 11.54 (`src/domain/geo.ts`).

## Verifying UI work

Playwright is available. It reaches https:// sites only with the proxy's CA
keys passed to `--ignore-certificate-errors-spki-list` (above, "The deployed
site in a browser"); local `npm run dev` over http works either way. Do not
report a live-site UI check as done on the strength of a Node render.

The browser binary is under `/opt/pw-browsers/` and its path moves with the
container image: `chromium-1194/chrome-linux/chrome` to 2026-11-21,
`chromium-1243/real/chrome-linux64/chrome` on 2026-11-22; find it with
`find /opt/pw-browsers/chromium-* -maxdepth 3 -type f -name chrome` (the
`chromium` symlink beside it is not the executable), pass it as
`executablePath` and do **not** run `playwright install`. Playwright is
installed globally: import `/opt/node22/lib/node_modules/playwright/index.mjs`.
`npm run dev` serves the app with fixtures. Run throwaway scripts from the
repo root, then delete them.

Check 390 px and 320 px, not just desktop: a page-wide horizontal scroll,
overflowing headers and a control over the Refresh button were all
phone-only. A sideways scroller does not hold an absolutely positioned
`.sr-only` label unless it is itself positioned (the Ceiling & sky strip
widened to 847 px at 390 until `.sky-scroll` got `position: relative`,
2026-10-24). Text that depends on the clock needs the clock set: the
forecast hour stepper's readout prints a weekday only when the valid hour is
on another local day, and that word pushed its `+1 h` button off a 320 px
page every night after about 11:30 PM Central until 2026-10-31 (issue
#249); Playwright's `clock.install` with `timezoneId: 'America/Chicago'` puts
a fixture build at any hour. The sandbox's font is not the runner's: here
`system-ui` is Inter, on a GitHub runner DejaVu Sans, which is wider (the
#249 row ran to 298 px here and 339 there); DejaVu Sans is installed here,
so force it with `page.addStyleTag({ content: "* { font-family: 'DejaVu
Sans' !important }" })` to measure what the runner will.

## Gates

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, on their
real exit codes. CI runs on pull requests and on dispatch, never on a push
(`.github/workflows/ci.yml`), so commits on a branch with no open PR are
unchecked. `main` deploys to GitHub Pages on push.

Local review first; a hosted review bot (Copilot, Codex) only when the maintainer asks for one by name (her global rule, confirmed for this repository 2026-11-23). Before a pull request: the four gates, then a local review chosen from the global rules' table, with its findings and what was done about each in the PR body. Copilot's review draws on a monthly quota that ran out mid-PR on 2026-09-23.

`.github/workflows/live-site.yml` is not a gate: daily, after every deploy
(started by `check-live` in `deploy.yml`, since a `workflow_run` trigger
missed deploys dispatched with a workflow token) and on dispatch, it loads
the deployed site in a browser on a runner pinned to `ubuntu-24.04` (since
2026-10-30; `ubuntu-latest` became 26.04 and Playwright 1.56.1 would not
install Chromium, issue #237), every page at 1280, 390 and 320 px on live
data (`scripts/liveSite.ts`), and fails when a reader would meet a fault as
`src/domain/liveSite.ts` counts one: a script error, the crash screen, a
page wider than the viewport, a site
file not served, a Data health source in error or still loading, the TAF or
NBM relay fetch failing (NOAA's bucket failing behind the relay is a note),
the radar image not drawn, the parity summary or ceiling page's data not
loaded, and since 2026-11-05 the hour stepper's content past its row
(`hourNavs`, `measureHourNavs`); the width rule names the elements past the
edge since #208's 3 px could not be traced from a width alone. A second leg (`late-evening`) builds the fixture site and
checks every page with the browser's clock at 2026-10-31T04:45Z, 11:45 PM
Central (`LIVE_CLOCK`, `LIVE_SITE_URL`), the half hour in which #249 showed;
the live leg never pins a clock, since live data would not hold the hour.
Another host's failed request and console errors are notes, since the app
retries them; a page failing its first load is loaded once more; a failure
on `main` opens one issue labelled `live-site`. It runs from the sandbox too
(the script's header has the environment), against the live site or a local
build. Its loads are not counted as page views (docs/page-counts.md). How
often each network-facing check has failed, and why, is tallied in
docs/live-checks-tally.md (taken 2026-11-07; take it again after a month of
the retry rules).

`.github/workflows/sky-parity.yml` is not a gate: daily and on dispatch,
under `scripts/*.live.ts` with its own `vitest.live.config.ts` so `npm test`
stays hermetic. It fails when the app's METAR sky parse, its derived flight
category or its TAF group decode (`src/domain/taf.ts`, against
aviationweather.gov's `fcsts` decode, QNH within 1 hPa since 2026-11-03)
disagrees with aviationweather.gov's decoder on today's reports; when a
Pilots tab deep link stops opening what it should (`scripts/pilotLinks.live.ts`;
the Chart Supplement edition scheme is inferred, `src/domain/chartSupplement.ts`,
and held on the first edition that could have shown it wrong, 2026-10-29);
and on the SIM checks under "Citations" (`scripts/simText.live.ts`). On
`main` it opens one issue per failed check, labelled `sky-parity`,
`pilot-links` or `sim-text` (`live-checks` for a run that failed before
they started), titled by the failed test with the failure's own message
(`src/domain/liveIssue.ts`, since 2026-10-31); a run dispatched on a branch
opens none. Fetches are tried twice on a timeout, a connection reset or a
502, 503 or 504 (`scripts/liveFetch.ts`: #147 and #238 were one timeout
each, #256 one 502, 2026-11-18's SIM failure one reset); any other status is
the finding. The same job prints two reports that never fail the run:
`scripts/schulzeCompare.live.ts` (this app's winds-aloft profile beside Mark
Schulze's; needs a Referer and a browser-like User-Agent) and
`scripts/usairnetCompare.live.ts` (the dashboard's decode of the latest KPMV
observation beside usairnet's). `.github/workflows/comparisons.yml` runs
both eight more times a day at different minutes; each run uploads one
`@@parity {json}` line as a `parity-<run id>` artifact (kept 14 days), and
the summary takes only runs on `main`.

`.github/workflows/parity-summary.yml` combines those artifacts daily with
`scripts/paritySummary.ts` into `public/parity/summary.json`
(`src/domain/paritySummary.ts`, pure), also reading the temporary sampler's
`data/parity/logs-to-2026-10-05.jsonl.gz` (usairnet every two minutes, Schulze
every four, 2026-09-30 to 10-05; before that throttled cron lines from
09-24; the sampler, `scripts/sampleLoop.sh` in the history, was a looping job
because GitHub ran an every-fifteen-minutes schedule under ten percent of
the time), commits it to
`main` (rebased first, up to three tries, since a PR merged under it on
2026-11-19) and dispatches the deploy. Since 2026-10-19 it also archives
every record not yet archived as `data/parity/parity-logs-<day>.jsonl.gz`
(`scripts/parityArchive.ts`, dropping records seen twice), so nothing drops
off after fourteen days; the archive keeps the arrival timings
(`arrivalLags`), which only two-minute samples give (docs/source-parity.md,
"What the sampler found"). The page at `#parity` renders counts and
spreads, never a grade, with each table's figures drawn above it since
2026-11-11 (`paritySvg.ts`).

`.github/workflows/forecast-keep.yml` commits what the dashboard's forecasts
said (the gridpoint fields the card reads, `GRIDPOINT_FIELDS`, and
Open-Meteo's 10-day outlook, `openMeteoDailyUrl`) to the `forecast-archive`
branch, one gzipped
file an hour (`scripts/forecastKeep.ts`; never touches `main`). Since
2026-10-16 it is a looping job (`scripts/forecastKeepLoop.sh`, a snapshot at
minute 23 of each hour, five or six a run) that queues its own successor
before it starts; a three-hourly schedule restarts it if a dispatch fails.
To stop it, disable the workflow in the Actions tab. The ceiling-error page
scores the kept rain and thunder chances against KPMV
(`src/domain/chances.ts`, docs/forecast-chances.md);
`scripts/keptForecastsVsKpmv.ts` sets the kept wind, gust, direction,
temperature, visibility and rainfall against them by hand
(`src/domain/keptForecasts.ts`, docs/kept-forecasts-vs-kpmv.md); `scripts/nwsGustArchive.ts` sets six
months of NDFD gust against KPMV (`src/domain/ndfdGust.ts`,
docs/nws-gust-archive.md).

The page at `#wind-errors` draws forecast minus reported surface wind as
histograms: the kept NWS forecasts by lead, the NDFD archive by lead
(`data/parity/ndfd-wgust-*`, `ndfd-wind-*`, from 2026-04-01), Open-Meteo's
archived 10 m wind by run (`data/parity/om-wind-*`) and the surface-wind
sample by source (`src/domain/windErrors.ts`,
`src/components/WindErrorsPage.tsx`). Its
data file, `public/wind-errors/summary.json`, is rebuilt weekly by the
ceiling data refresh (`scripts/windErrorsData.ts`, held to the published
file by `windErrorsShrinkage`); the docs' figures are dated readings
(`docs/img/*-wind-errors-<day>.svg`, drawn with `--figures`, never
overwritten).

`.github/workflows/surface-wind-sample.yml` is standing: every seventeen
minutes (shares no factor with sixty, so the samples walk through every
minute of the hour; five from 2026-10-09 to 10-30) it runs
`scripts/surfaceWindCompare.live.ts` through `scripts/surfaceWindLoop.sh`
and uploads `surfacewind-*` artifacts, one per sample in eighteen slices
since 2026-11-10, each run queueing its successor; `parity-summary.yml`
archives them as `data/parity/surfacewind-<YYYY-MM>.jsonl.gz`
(`scripts/surfaceWindArchive.ts`) and the weekly refresh rebuilds the
`#wind-errors` sample section from them. It changes nothing the dashboard
shows; the first three weeks are in docs/surface-wind-sources.md. The
maintainer, 2026-10-30: one season is a brief window, so do not time-box or
delete it again without asking. The run-split sampler (`.github/workflows/run-split-sample.yml`,
`scripts/runSplitLoop.sh`, both deleted 2026-10-27;
`data/parity/runsplit-2026-10-23-to-2026-10-27.jsonl.gz`,
`scripts/runSplitSummary.ts`, docs/run-split.md) was the same pattern; its
"different runs" rule is shared with the comparison (`rawGap`,
`src/domain/runSplit.ts`), as are the fetches (`scripts/schulzeFetch.ts`).

`.github/workflows/ceiling-data-refresh.yml` (Mondays 07:41Z, often started
hours late, and on dispatch) fetches the NDFD ceilings, KPMV's reports,
Open-Meteo's archived wind and NDFD's wind, gust and direction from the
newest kept record's day to the last whole UTC day, commits them under
`data/parity/` with both rebuilt page files to `main`, and dispatches the
deploy. It fails, committing nothing, when a fetch brings nothing newer or a
rebuilt file holds less than the published one (`src/domain/ceilingRefresh.ts`,
`windErrorsShrinkage`); a run on another branch commits nothing; the wind
side is independent, so its failure leaves the wind file as published,
still commits the ceiling data, and fails the run last
(docs/ceiling-heights.md, "The chart").

usairnet's page is read by `src/domain/usairnet.ts`, tested against station
blocks saved from the live pages (`tests/fixtures/usairnet/`). Formats its
first parser misread, each shown on `#parity` as the parser's disagreement:
a gust between the speed and the direction, present weather in the heading,
"Solid Overcast" (the FAA's word for OVC is plain "Overcast", AC 00-45H
Table 3-3), fractional visibility ("1 1/4 Miles") and a north wind's 360°
against the page's "0° North". Records carry a version (`v`), and the
summary counts each corrected row only from the version that fixed it
(`FIELD_SINCE_VERSION`); a calm wind is compared as no direction on both
sides; an unparsed page keeps its text near the station (`pageText`).
usairnet redesigned the page about 2026-10-09 and nothing parsed it for 17
days, because the usairnet line never fails a run and nothing watched the
`#parity` rows stop growing (docs/source-parity.md, "usairnet's redesign");
the parser reads both layouts (the old is `view=legacy`), records carry
`v: 4` and the raw METAR. When a comparison that "never fails" goes quiet,
the summary's `unreadable` count is where it shows.

Open items live in `docs/open-questions.md`.
