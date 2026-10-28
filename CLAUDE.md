# Working notes for this repo

A skydiving weather dashboard for the Lincoln Sport Parachute Club (Brown's
Airport, NE69). Read `README.md` for what it shows. This file is the standing
context for working on it.

## The rule that governs everything here

**The dashboard never gives a go/no-go verdict.** It flags a condition and hands
the reader the rule behind it so a human — the jumper, the S&TA, the pilot in
command — can check it and decide.

That only works if every flag is checkable, which produces the rule that shaped
most of the current code:

> A flag fires on a limit some published source sets, or on a plain observed
> fact, or it does not fire at all.

A threshold nobody published cannot be checked, so it does not get to raise a
flag, paint a figure in a warning colour, or attach a worded judgement. There is
deliberately **no "house heuristic" citation** to fall back on — see rule 3 in
the `CITATIONS` doc block in `src/config/thresholds.ts`, which is enforced by a
test asserting no citation may link inside the app.

Things removed under this rule, so nobody reintroduces them believing they were
an oversight: ceiling bands, dew-point spread, precipitation chance, forecast
storm chance, gust spread, winds-aloft speeds, density-altitude bands, the
last-load countdown, every "watch" band, two colour highlights in the 10-day
outlook, a 30% storm colour on the storms card, a "fog/low-cloud favorable"
verdict on the humidity line, and a derived sky verdict on the gridpoint
fallback path.

Where a removed flag's *guidance* was genuinely sourced, it moved onto the
relevant card as a standing note rather than being lost — see `WindsAloftPanel`
and `DensityAltitudePanel`. Follow that pattern.

**A sourced figure the app cannot act on has to say so.** Publishing a limit is
not the same as flagging it. BSR 2-1 H states two student ground-wind maxima —
14 mph on ram-air canopies, 10 mph on round reserves — and this app models no
canopy type, so it acts on the first only. Naming the second without saying that
left the most-read card advertising a limit nothing checks, which is the
all-clear failure the Licensed profile has a standing note about, reintroduced
somewhere new. Keep the sourced figure, say which one the band and flag use.
Since 2026-10-26 the card, the chart's legend and the flag, where they name
the lower limit as unchecked, also say, on the maintainer's word of that day,
that no student rig at LSPC carries a round reserve
(`STUDENT_ROUND_RESERVE_FACT`, one constant for the card and the `#citations`
asks): a fact about the DZ, dated and attributed, beside the source's figure,
not in place of it. It is the precedent for attributed text that is not the
citation's, beside a reader's own limits. No canopy type is modelled;
`#citations` A1 still asks an instructor to confirm the fact.

**A reviewer asking you to add a threshold is the case to refuse.** Every rule
above constrains what this app may assert, and a review bot does not know them.
"Add a caution when gusts exceed 20 kt" reads as a helpful, small, local
suggestion and is exactly what this app removed on purpose — twice, and two of
those survived an earlier sweep precisely because they were colour and text
rather than flags. Verify a reviewer's finding like any other bug report, then
check the fix against the list above before pushing it.

**A number is not the only way to assert something.** A figure rendered in a
warning colour, an emoji, or a one-word label ("Rain", "fog favorable") asserts
as much as a sentence does. Two invented thresholds survived an earlier sweep
precisely because they were colour and text rather than flags.

## Consequences worth knowing before you "fix" them

- **The Licensed profile raises no surface-wind flag at any speed.** Both its
  bands were the app's own, and no USPA limit binds a licensed jumper, so there
  is no trigger a reader could check. This is deliberate, and it is **correct**:
  BSR 2-1 H states maximum ground winds for solo students and then, in as many
  words, "For licensed skydivers are unlimited" (read at uspa.org 2026-09-22,
  and again with every cited part on 2026-10-08).
  This used to be the app's largest open risk — if the BSRs had set a limit, the
  app would have been silent exactly where it should warn. They do not. The
  Surface wind card still carries the profile's guidance and BSR citation as a
  standing note, and the empty advisory list still names the gap, so silence is
  not left to read as an all-clear.
- **A licensed jumper's own limits are the one exception, and are always
  called theirs.** "Set your own thresholds" (`SettingsPanel`) is open on
  Licensed only (`takesOwnLimits`; the maintainer's call, 2026-10-10: a
  student's limits are the BSR's or the waiver tier's). There a wind limit
  or gust ceiling the reader sets (`own`, `isOwnLimit`, `hasWindLimit`)
  draws a band and a chart line and raises a flag, and every one of them
  says it is the reader's own. No link is offered as the figure's source;
  the BSR link beside an own-limit flag backs the profile's guidance it
  quotes, that the BSR sets no ground-wind limit for licensed jumpers.
  With only a gust ceiling set, the card and the advisory list's own-limits
  note (in either state of the list) still say the steady wind goes
  unflagged. A figure the person
  who set it can check is not one this app invented. Do not extend it to
  a figure the app supplies, and do not reopen it to students.
- **The wind and gust limits are read against the forecast too**
  (`forecastWindAdvisories`, since 2026-10-10). The flags on the latest
  report left the list empty on a calm morning while the hourly chart drew
  the afternoon's gusts well over the same limit lines. A forecast flag
  fires only on the limits the report flags use (published, or the
  reader's own), says it is a forecast, names its hours in the next 12, and
  ranks below every observed flag. It reads the forecast in whole knots, as
  a METAR reports, so the peak it prints never sits under the limit it
  names. It is not a licence for forecast
  thresholds of the app's own: a forecast storm or rain chance still flags
  nothing. Since 2026-10-28 the Surface wind card carries a standing note
  on that forecast gust (`FORECAST_GUST_NOTE`, the maintainer's call that
  day): six months of it against KPMV's reports, the side and the typical
  size of the difference, dated to its reading in docs/nws-gust-archive.md
  and held to that doc by a test. Figures beside the flag, not a
  correction to it; keep it that way.
- **The Surface wind card is first on the Jumpers tab: one bar with every
  mark labelled, then one line per limit** (the maintainer, 2026-10-10).
  One bar with a legend left the marks unnamed: a reader could not tell
  the yellow tick was the gust or what the red and purple marks were. A bar
  and a status per limit, with a key, then said each thing twice. Now each
  mark carries its figure on the bar (limits above, wind and gust below,
  pushed apart when close, `spreadLabels`), and each limit's line names
  it, what it is held to (the caution takes the higher of wind and gust,
  as its flag does; the gust ceiling takes the gust), and how far over or
  under the reading is. The distance is worked from the figures as
  printed, so they add up in mph. The fill is one colour: a green end read
  as "fine". Do not bring back a legend in place of the labels, or a bar
  per limit.
- **Wind limits render with a decimal in knots** (`fmtLimitSpeed`). The club
  waiver posts gust ceilings one mph apart at the top (19 and 20 mph); rounded
  to whole knots both printed "17 kt", so the tier a jumper earned changed
  nothing on screen. Readings stay whole — a METAR reports whole knots.
- **`compass()` is 16-point.** An 8-point label put 060° in the "NE" bucket, a
  15° error that matters over a 10,000 ft freefall.
- **The sky is read from the METAR text, not from the API's `cloudLayers`.** On
  2026-09-23 api.weather.gov served seven consecutive KPMV observations with
  `cloudLayers: []` and an empty `textDescription` while `rawMessage` read
  `OVC027`–`OVC035`. Re-read twenty minutes later the same seven were still
  empty while the next report was decoded, so it is a gap, not a lag; usairnet's
  own decode of the same METAR read "Solid Overcast at 2700 ft", MVFR. The
  dashboard showed "Clear", "No ceiling" and VFR under a 2,700 ft overcast, with
  no flag — found from a screenshot of the deployed site, which no sandbox
  check had covered. `normalizeNwsObservation` now
  parses the sky groups from the METAR text and uses the decoded layers only
  when the text has none, the order it already used for the altimeter. Do not
  "simplify" it back. Four more of those forty observations had no
  `rawMessage` at all: an empty `skyLayers` means *not reported*, the cards say
  so, and `observedFlightCategory` never shows VFR from a report with no
  ceiling in it — visibility alone can establish MVFR/IFR/LIFR, not VFR.
  The API also serves records with no `rawMessage` at all but a full decode —
  37 of the last 40 at KLNK and KAUS, 4 of 40 at KPMV — and its decode gives
  `CLR` a base of 3,810 m (the 12,500 ft ceilometer limit) where the text has
  none; aviationweather.gov represents a clear sky as no `clouds` entries at
  all. Every comparison in the code allows for those three shapes; do not
  tighten them without re-sampling the APIs. Two things now watch for a
  repeat: the METAR row on Data health grades the two decodes against each
  other (`skyDecode`, amber when the decode is missing or disagrees), and
  `.github/workflows/sky-parity.yml` compares the app's parse against
  aviationweather.gov's decoder on today's report every morning.
  `normalizeIemCurrent` reads IEM's record in the same order (text first,
  its skyc/skyl decode only when the text has no sky group).
- **The observation is read from IEM first, NWS second, and the newer
  report wins** (`src/domain/iem.ts`, `src/api/iem.ts`), polled every 2
  minutes on its own loop. Timed on 2026-09-27, IEM had each KPMV report 4 to
  6 minutes after it was taken and api.weather.gov 24 to 33; reading NWS alone
  left the dashboard one report behind usairnet for most of every cycle.
  aviationweather.gov and NOAA's raw files are as quick but send no CORS
  header, so a browser cannot read them. NWS is kept because IEM is a
  university service with no uptime promise; a tie goes to IEM. Temperatures
  come from the METAR text on both feeds (`tempsFromRaw`: the T group, else
  the body group), the pair from the feed's decode only when the text has
  none: IEM's `dwpf` is whole °F and converts back a tenth off, and NWS's
  decode can be null while the text has the figure (one of 500 nearby
  records read 2026-10-09). `mesonet.agron.iastate.edu` is on the sandbox
  allowlist since 2026-09-29, so the IEM path runs from here (the usairnet
  comparison reads both feeds and logs which served).
- **The NWS gridpoint is fetched with `cache: 'no-cache'`, and the newer
  copy is kept** (`fetchFreshGrid`, `newerGridpoint`, since 2026-10-23).
  NWS sends it with a `max-age` up to an hour, and Chromium answered the
  app's ten-minute refresh from its disk cache, pinned to one edge copy
  while other edges served a newer forecast. Replayed on 13 days of
  samples, that put the dashboard behind the newest known forecast at
  10.9% of refreshes (mean 7.2 min); revalidating with the guard, 6.0%
  (3.9 min). Without the guard, edges holding older copies would step it
  back about once a day. A cache-busting query parameter is not a way past the
  edges: the API answers it with a 400. See docs/nws-gridpoint-age.md.
- **Offutt's TAF comes through a relay of the maintainer's** (`relay/`, a
  Cloudflare Worker at `lspc-taf-relay.amelia-m.workers.dev`, deployed
  2026-10-27; `TAF_RELAY_URL` in `src/config/tafRelay.ts`;
  docs/taf-relay.md, "Checked after deploying"). The
  USAF issues it, api.weather.gov does not carry it, and
  aviationweather.gov sends no CORS header. A workflow copying it was
  ruled out on GitHub's Actions terms, which name "part of a serverless
  application" (read 2026-10-20). The Worker fetches fixed things only
  (the TAF's URL; since 2026-10-27 also KPMV's block of the NBM's hourly
  bulletin from NOAA's bucket, `/nbm/KPMV`, for the Ceiling & sky card's
  "base" row, docs/nbm-lowest-cloud-base.md) and answers only the site's
  origins. Its entry module exports only the
  handler: Cloudflare's runtime refuses any other named export.
- **Sunrise and sunset are NOAA's method, held to NOAA's own script.**
  `src/domain/sun.ts` ports the functions of NOAA's Solar Calculator
  (gml.noaa.gov/grad/solcalc/main.js), and its tests compare against that
  script's output to 5 ms; rounded to the minute it matched the US Naval
  Observatory's API in 56 of 56 events across 2026 (read 2026-10-03). It replaced a simplified "sunrise equation" that
  put the DZ's sunset 2 to 3 minutes late, so the 14 CFR 105.19 night flag
  fired late; usairnet's almanac, Open-Meteo and the astral library all
  showed it. Do not swap in a shorter formula without re-running that
  comparison.
- **Schulze's "Surface" row is not a surface wind.** It is a straight line
  through his raw pressure levels read at 0 ft: here between his 1000 hPa
  level (underground at this DZ) and 975 hPa, and at a site with no level
  below ground, the two lowest extended down. Matched in 72 of 72 hours at
  four sites on 2026-10-03. So it reads like the wind a couple of hundred
  feet up and runs above the 10 m wind this app shows, most at night. See
  `docs/markschulze-altitude-reference.md`, "How the surface row was worked
  out". Set against KPMV's measured wind over 156 logged hours to
  2026-10-08, the 10 m row was nearer in 104, his in 23, tied in 29; both
  ran high, his by more, most at night (same doc, "Which Surface row is
  nearer the measured wind"). At the landing area over 79 hours to
  2026-10-17 the result held: 51, 11 and 17 (`scripts/surfaceRows.ts`,
  same doc, "Again, at the landing area"). That is a point about heights,
  not a fault in his tool.
- **The winds-aloft table can differ from Mark Schulze's, and each cause is
  known.** Both read Open-Meteo; from 2026-09-23 the app sampled the same
  pressure levels the tool does below 18,000 ft (`OPEN_METEO_PRESSURE_LEVELS`,
  thirteen of his twenty), and the same hour agreed within 4° and 1 kt
  everywhere. Since 2026-10-08 the app
  also samples Open-Meteo's 80, 120 and 180 m winds below the lowest pressure
  level (`OPEN_METEO_HEIGHT_LEVELS_M`), the canopy layer, which the tool does
  not. They normally decide the 500 ft row, which his table does not have;
  the compared Surface row moves a fraction of a knot, and on high-pressure
  hours, when 950 hPa is above 1,000 ft, the compared 1,000 ft row can differ
  for this reason (`docs/markschulze-altitude-reference.md`). Also since
  2026-10-08 the default table takes seven pressure levels his does not
  (`OPEN_METEO_EXTRA_PRESSURE_LEVELS`), and the card has an "As Schulze" view
  that rebuilds the hour his way (`interpolateAsSchulze`: his levels below 18,000 ft,
  his ground as the datum, his Surface rule, which is inferred from his
  output). The comparison logs both tables against his (`asSchulze` beside
  `aligned`), so `#parity` shows that the app reproduces his table and,
  separately, how far the default table moves from it. Keep the "As Schulze"
  view his method exactly; improvements go in the default. What can still differ,
  and why, is in `docs/markschulze-altitude-reference.md` (among them the two
  being on different forecast runs for the same hour: 114 of 1,611
  same-hour comparisons to 2026-10-05, mostly between half past and ten to
  the hour; settled 2026-10-27 by the run-split sampler, docs/run-split.md,
  "What the sample found": it is the minute a new HRRR run reaches
  Open-Meteo's servers, not his next-hour request); run
  `scripts/schulzeCompare.live.ts` before touching the interpolation.

## Citations

Every USPA, CFR and FAA reference in this app began as an AI recollection (the
club's posted tiers are a transcription of an undated photo of the sign, and
say so). The **USPA SIM** sections were read at uspa.org on 2026-09-22 (and every cited part again on
2026-10-08), and the **CFR sections, AIM 7-1-7 and FAA-P-8740-2** on 2026-09-23, and the claims
corrected against them. A
reading is not an instructor's sign-off, and the difference is not a detail to
smooth over. The in-app page at `#citations` (`src/components/CitationsPage.tsx`,
data in `src/config/citationsChecklist.ts`) records, per claim, what the section
says, when and where it was read, and what a reading could not settle — and
takes the reviewer's answers: a verdict per claim, an answer and note per
question, kept in the browser (`src/api/citationAnswers.ts`) and sent as a
prefilled GitHub issue or copied text (`src/domain/citationAnswers.ts`, pure).
The page says nothing about what the app used to claim; a test rejects that
wording. History lives in the commit log.

When each cited or quoted section was last read, in which edition and how,
is one file: `src/config/readingLog.ts`, shown as a list at the end of
`#citations`. Every citation has exactly one entry there, and its note's
date must be the entry's (a test holds both); the SIM notes and the
checklist's SIM readings take their date from it. uspa.org names its online
SIM only as the "2026 SIM" and revises it within an edition, so the
edition name does not say which text was read. (Its change-document list,
seen in the maintainer's browser on 2026-10-10, held only 2021-2022 and
2023-2024 revisions; see `src/config/readingLog.ts`.) So each cited or
quoted SIM part is also pinned by a SHA-256 of
its text (`simPartText`, `src/domain/simText.ts`, from the part's anchor to
the next part's, named because some parts hold anchors of their own).
`scripts/simText.live.ts` takes it again daily and fails when a part's
words change or its anchors are gone, when a quote in a SIM-reading
entry's "source says" lines is in none of the parts tied to that entry
(lines quoting the CFR or the club document are skipped, and so are the
questions), when uspa.org cannot be fetched, or when the SIM page's
heading names an edition other than `SIM_EDITION_YEAR` (`simEditionYear`):
a new edition means reading every part again, whether or not its words
changed. Every cited SIM part, and every SIM quote on
`#citations`, was read again on 2026-10-08. After reading a part again,
take its fingerprint with `PRINT_SIM_FINGERPRINTS=1` and move
`SIM_LAST_READ` only if every part was read that day.

Words in the cards' prose that the SIM glossary defines link to it
(`SimTerm`, data in `src/config/simGlossary.ts`, read in the online SIM at
uspa.org on 2026-10-09): each term at most once per card, never in a label,
caption, input prompt, readout, the unit of a sourced figure, or an existing
link. The glossary has anchors per letter heading only (`…/sim/glossary#S`;
K, Q, V, X and Y have no heading of their own), so a link lands on the
letter; do not invent a per-term fragment. They are links to a definition,
not citations: they are in neither `CITATIONS` nor the reading log, they are
styled apart from citation links, and a term stays plain in a flag or note
that already cites the document it names (`linkableTerms`: no "BSR" link
beside a SIM 2-1 or 2-2 link), since a reader clicking it to check the
figure wants the citation. Linking a word asserts its definition applies:
"waiver" stays unlinked because `#citations` (A5) still asks whether the
club's posted tiers were filed as a SIM 2-2 waiver and whether the sign is
current; "night jump" because the glossary's one-hour
figure is not the night flag's trigger; "density altitude" because the
card's note already quotes the FAA's definition beside its citation, and
goes on to a "With humidity" row the glossary's method (pressure altitude
and temperature) leaves out. `scripts/simText.live.ts` also
checks daily that each linked term is still an entry heading under its
letter (`glossaryHeadings`, `src/domain/simText.ts`).

When touching a citation:

- `source` and `url` must name the same section, or neither may name one. A test
  enforces this.
- Where the governing section is unknown, the citation stays on the document
  index **and says so in its note**. A confidently wrong section number is worse
  than an honest general link — it sends a jumper to the wrong rule while
  looking authoritative.
- Never write that a citation has been checked unless you opened the document.
  Judging from this repository that the cited authority is the right *kind* of
  authority is not the same as reading it. Where you did read it, say what you
  read and when — "read in the online SIM at uspa.org on <date>" — rather than
  "verified": the website's SIM on one day is not a printed edition, USPA
  revises it, and a bare tick invites a reader to assume more than was done.
- SIM links carry the page's own part anchor (`…/sim/2-1#1H` for 2-1 H). The
  served HTML marks each part with `<a class="anchoroffset" name="1H">` and its
  copy-link icon offers the same fragment, so the anchors are readable with
  curl and were read that way on 2026-09-23. The scheme is the section's digit
  within its chapter plus the part letter, and a test checks the anchor names
  the part the ref cites. Add an anchor only after reading it on the page.
- `www.ecfr.gov` answers a script with a 302 to a bot-check host, so its section
  pages cannot be read with curl or WebFetch even when the host is allowlisted.
  The eCFR API serves the same text and needs only `--compressed`:
  `https://www.ecfr.gov/api/versioner/v1/full/<date>/title-14.xml?part=105&section=105.17`.
  Leave citation URLs on the human-facing pages; say in the note that the API
  was read and which "current as of" date it served.

## What can and cannot be verified from a sandbox

Outbound network access goes through a policy-enforcing egress proxy. With
`api.weather.gov`, `api.open-meteo.com`, `radar.weather.gov`, `www.uspa.org`,
`www.markschulze.net` and `amelia-m.github.io` allowlisted (2026-09-22), then
`www.ecfr.gov`, `www.faa.gov`, `www.faasafety.gov` and `www.usairnet.com`
(2026-09-23), these became checkable and were checked — see
`docs/open-questions.md`. The environment's list as of 2026-09-29 is
`*.weather.gov`, `aviationweather.gov`, `gml.noaa.gov`, Open-Meteo, USPA,
eCFR, FAA, FAASafety, usairnet, markschulze.net, `amelia-m.github.io`,
`mesonet.agron.iastate.edu` (IEM) and `tgftp.nws.noaa.gov` (NOAA's raw
METAR and TAF files), each with its subdomains, and since 2026-10-03
`aa.usno.navy.mil` (the US Naval Observatory's sun and moon API),
`skyvector.com` (the Sectional chart card's link), `tiles.arcgis.com`
(FAA's VFR sectional tile service) and `*.blob.core.windows.net`, where
GitHub's artifact downloads redirect. Since 2026-10-08 it also has
`github.com`, the ADS-B networks (`adsb.lol`, `adsb.fi` with `globe.` and
`opendata.`, `airplanes.live`, `opensky-network.org`, `api.adsb.one`),
map tiles (`tile.openstreetmap.org`, `*.tile.openstreetmap.de`,
`server.arcgisonline.com`, `services.arcgisonline.com`),
`earthdata.nasa.gov` and `heywhatsthat.com` (the receiver panorama in
`docs/adsb-receiver.md`), and since 2026-10-20 `docs.github.com` and
`developers.cloudflare.com` (GitHub's Actions limits and terms, and the
Workers free tier, for the KOFF TAF relay; its history is under "KOFF's
TAF" in `docs/open-questions.md`, marked done 2026-10-27),
and since 2026-10-26 `vlab.noaa.gov` and `blend.mdl.nws.noaa.gov` (MDL's
NBM text card and bulletin viewer), `nomads.ncep.noaa.gov` (NOAA's copy
of the NBM bulletins; the S3 bucket `noaa-nbm-grib2-pds` answered
before) and `www.flyaerodyne.com` (the Smart reserve's page, for the
round-reserve question), and since 2026-10-27
`lspc-taf-relay.amelia-m.workers.dev` (the TAF relay, so it can be
checked from here), and since 2026-10-28 `basemapstyles-api.arcgis.com`,
`opengeo.ncep.noaa.gov` and `geocode.arcgis.com` (radar.weather.gov's
viewer, for docs/radar-interactive-link.md; its basemap art at
`cdn.arcgis.com` is not, and the map draws without it). Reachable is not readable: `globe.adsb.fi`,
`api.adsb.one` and `airplanes.live` answer a script with Cloudflare's 403
(airplanes.live's API asks for an emailed request first). The comparison artifacts can now be
read from here with `curl -sL
https://api.github.com/repos/amelia-m/lspc-weather/actions/artifacts/<id>/zip`
(the session's GitHub proxy supplies the credential); `gh api` still refuses
to follow that redirect. A change to the list applies to a running session as
soon as it is saved.

Checkable from here, and checked:

- the live NWS and Open-Meteo paths, the TAF fallback chain and the NOAA FD
  winds fallback, by running the app's own fetch and domain code under Node;
- component output on live data, via `renderToStaticMarkup` — the same trick the
  advisory tests use. This is how the FD fallback's fake Surface row was found;
- the radar GIF and its georeferencing, by fetching and measuring it;
- the USPA SIM sections behind the citations, and the CFR sections, AIM 7-1-7
  and FAA-P-8740-2 behind the FAA ones;
- the usairnet KPMV page the Ceiling & sky card links to, as a second decode of
  the same METAR (plain HTML, fetchable with a browser User-Agent).

Not covered by `npm test`, so do not imply a green suite covers them:

- **The deployed site in a browser, against live data: checkable since
  2026-10-17.** Playwright's Chromium does not trust the proxy's
  TLS-intercepting CA on its own (`~/.pki/nssdb` is empty and `certutil`
  is not installed, so the NSS store cannot be filled from here), but
  Chromium accepts a list of public-key hashes to trust,
  `--ignore-certificate-errors-spki-list`. Given the hashes of the
  proxy's own CA certificates from `/root/.ccr/ca-bundle.crt` (subjects
  with `O = Anthropic`) and the session proxy, it loads
  <https://amelia-m.github.io/lspc-weather/> and the live APIs, and still
  rejects any other certificate (without the flag the same page fails with
  ERR_CERT_AUTHORITY_INVALID). It trusts exactly what the empty NSS store
  was meant to:

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

  First load, 2026-10-17 about 01:30Z, at 1280, 390 and 320 px: the page
  rendered with live data and no sideways scroll at any width. Two things
  showed in the console. Open-Meteo's two requests failed on the first
  try after about 11 seconds as "blocked by CORS policy" and succeeded on
  the app's retry (200, `access-control-allow-origin: *`); Open-Meteo
  sends that header, so the failed answer was most likely the proxy's
  own on a slow request, not Open-Meteo's, and a reader's browser would
  not meet it; the live-site check's first run from a GitHub runner, the
  same day, met no such failure on any page. And `/favicon.ico` at the domain root was a 404: the page
  named no icon, so the browser asked there. Since 2026-10-17 both pages
  name `public/favicon.svg` (the app as `/favicon.svg`, which Vite
  rewrites under the base; the ceiling-error page as `../favicon.svg`),
  checked by hand in a base-path build served locally, where Chromium
  fetched it with a 200 from both and logged no 404. `tests/favicon.test.ts`
  pins only the links and the file; it loads no browser.
  docs/open-questions.md,
  "Viewing the deployed site from the sandbox", has the rest.

  For a change not yet deployed, still worth doing rather than skipping:
  serve the production build over local http and let Playwright
  fulfil cross-origin images itself. That is how the radar marker was verified
  —

  ```
  BASE_PATH=/ VITE_USE_FIXTURES=true npm run build
  (cd dist && npx http-server -p 8788 -s &)
  # in the script: page.route('https://radar.weather.gov/**', r => r.fulfill({ body: localGif }))
  ```

  It exercises the real bundle under the real CSP, at 1280/390/320 px. Only the
  live data and the real cross-origin fetch are missing. To have those too
  with a local server (the relay under `wrangler dev`, say), give Chromium
  the proxy and the SPKI list as above **and** `bypass: '<-loopback>,localhost'`:
  with a proxy set it otherwise sends the localhost page through the proxy,
  which answers plain HTTP with 405 and the page loads nothing (2026-10-27). A Node render is not a
  substitute for either — `renderToStaticMarkup` does not run effects, load
  images or apply CSS.
- CI is no better: it runs the same fixture-backed suite. Nothing in `npm test`
  touches the network.

**The sandbox cannot delete a remote branch**, and the failure looks like
success: `git push origin --delete <branch>` prints "Everything up-to-date"
and exits 0 while the ref stays, and `gh api -X DELETE /repos/.../git/refs/
heads/<branch>` answers 403 "Write access to this GitHub API path is not
permitted through this proxy". The GitHub MCP server has `create_branch` and
`list_branches` but no delete, so there is no third route. All three checked
2026-10-17 and again 2026-10-18: the 403 is a policy denial, not a transient
failure, and retrying does not change it. Deleting a local branch works. So a
merged branch can only be tidied up by the maintainer, on GitHub or from their
own checkout — put the list in `docs/open-questions.md` and leave it to them.

**And a merged-looking branch is not an unused one.** These `claude/*`
branches are not one per PR: a session keeps one and reuses it, opening a PR,
merging it, then pushing the next piece of work to the same branch. Between
merges a live branch sits at exactly the state a dead one does — no commits
outside `main`, no file absent from it. On 2026-10-17 that reading put
`claude/fervent-feynman-zm42xw` on a deletable list hours after it had merged
eight PRs (#167-#174). `git diff origin/<branch> origin/main --diff-filter=D
--name-only` answers "is anything here unique", not "is anyone using it"; only
the branch's PR list (`gh api
"/repos/<owner>/<repo>/pulls?state=all&head=<owner>:<branch>"`) and its last
push date answer the second. Check both before proposing a deletion.

Two habits worth keeping. `NODE_USE_ENV_PROXY=1` plus
`NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` makes Node's fetch go through the
proxy, which is what let the live paths run at all. And some hosts refuse a bare
request: `markschulze.net` 403s without a `Referer`.

NOAA's NDFD archive (`noaa-ndfd-pds.s3.amazonaws.com/wmo/<element>/`) is
the NWS gridpoint's past, and it is large but quick from here. A header's
third letter is the region: `U` is CONUS (`YWUZ98`, gust, 3-day), `A` Puerto
Rico (`YWAZ88`), so list by the full header, not the folder. The CONUS
3-day files come every half hour and run 30 to 57 MB (sky about 32 MB, gust
about 50); the comparisons take the last in each of 00, 06, 12 and 18Z,
120 files a month. Read 2026-10-23, `scripts/cloudCoverFetch.py` with
`WORKERS=6` fetched and decoded a month of gust (about 6 GB) in about a
minute and a half from the sandbox, so six months need no runner. Which
NDFD elements match the API value for value is in docs/open-questions.md,
"Forecasts kept for later" (2026-10-13): search the docs before calling
anything there unchecked.

Open-Meteo's daily request limit is per address, and the sandbox's address is
shared, so the sandbox can be refused for a day by requests that are not this
repo's: "Daily API request limit exceeded. Please try again tomorrow." It
happened twice in this repo's sessions, on 2026-09-23 (the forecast API,
partway through a Schulze comparison) and on 2026-10-10 (the
historical-forecast archive, after an hour of plain 429s, which stopped the
station cloud-cover fetch). The GitHub runners have not met it. In the
comparison artifacts and the archived sampler log read on 2026-10-10 (about
1,700 Schulze comparisons from 2026-09-24, and 300 surface-wind samples from
2026-10-09), no Open-Meteo request got a 429. Its 40 failures were 32
timeouts, 6 dropped connections and 2 HTTP 503s. A heavy Open-Meteo fetch is
safer run as a workflow than from here. A script that fetches from here should
give up on the daily-limit 429 rather than retry it
(`scripts/cloudCoverFetch.py` does), and fetch in parts so that what came back
is kept. `.github/workflows/cloud-cover-fetch.yml`, started by hand, runs
`scripts/cloudCoverFetch.py` on a runner and keeps its output as an
artifact; it was added when the sandbox was refused again at 01:10Z on
2026-10-11, an hour after the limit reset. The dashboard is not affected:
each reader's browser calls Open-Meteo from its own address.

## Conventions

- **Every finding goes in the repo in the same piece of work.** A fetch, a
  test result, a comparison, a dead end worth not repeating: write it in
  the relevant `docs/*.md`, `docs/open-questions.md` (anything waiting on
  the maintainer) or here, with any data under `data/parity/` beside the
  script that made it. A reply in the chat is not a record; on 2026-10-13
  two investigations (KOFF's TAF sources, the empty browser trust store)
  were reported only there until the maintainer asked. A project hook
  (`.claude/settings.json`, UserPromptSubmit) repeats this reminder on
  every prompt.
- **Comments explain WHY, with domain context.** Calibrate on
  `src/domain/densityAltitude.ts`. Never write a comment describing behaviour
  the code does not have — several did, and each one misled a later reader.
- `src/domain/` is **pure**: no I/O, no `Date.now()`, no mutable module state.
  Time is passed in. Side-effecting helpers live in `src/api/`.
- New domain module ⇒ new tests under `tests/`. Vitest runs in a `node`
  environment over `tests/**/*.test.ts`; there is no jsdom. Component behaviour
  can still be tested with `react-dom/server`'s `renderToStaticMarkup`, which is
  how the advisory empty-state tests work.
- A removed flag is tested by asserting it is absent **in conditions that would
  previously have tripped it**, not in conditions that never would have.
- **Prove a new test by breaking the thing it names.** Revert the behaviour,
  watch the test fail, restore. Two tests written in one sitting here passed
  identically with the code they claimed to pin deleted: one put its fixture on
  the wrong side of a boundary so the value came from the interpolation loop
  instead of the branch in its title, and one asserted that a set built from
  `CITATIONS` contained a `CITATIONS` url. Eyeballing does not catch either.
- **Changing a function's contract stales comments that describe it elsewhere.**
  `interpolateWindsAloft` stopped extrapolating, and that silently falsified a
  comment in `spot.ts` justifying its own extrapolation "matching `sampleAt`",
  a rationale in `useWeatherData.ts`, and the card text in `WindsAloftPanel`.
  After changing what a function guarantees, grep for its name and read every
  hit.
- **Before writing that something was not checked, search the docs for
  it.** On 2026-10-23 an open question said the NDFD gust's match to the
  API was "not yet checked"; it had been, 42 of 42 hours, ten days before,
  three hundred lines further down the same file.
- **Open-Meteo's data carry its credit wherever they are shown**, the
  repository included: a new doc quoting its figures gets the credit
  under its title, a figure drawn from it gets a credit line
  (`histogramGridSvg`'s `credit`), and an archive of it is listed in
  `data/parity/README.md`. Its licence asks for a link "next to any
  location Open-Meteo data are displayed" (docs/open-meteo-terms.md).
- Derive values rather than writing them down twice. The station's distance and
  bearing come from its coordinates via `src/domain/geo.ts`; a hand-written
  `distanceMi: 12` had already drifted from the real 11.54.

## Verifying UI work

Playwright is available. It reaches https:// sites only with the proxy's
CA keys passed to `--ignore-certificate-errors-spki-list` (above, "The
deployed site in a browser"); without them it fails with
`ERR_CERT_AUTHORITY_INVALID`. Local `npm run dev` over http works either
way. Do not report a live-site UI check as done on the strength of a Node
render.

When it does run: the browser binary is `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(the `chromium` symlink next to it is not the executable) — pass it as
`executablePath` and do **not** run `playwright install`. Playwright itself is
installed globally, not in `node_modules`, so import it by path:
`/opt/node22/lib/node_modules/playwright/index.mjs`. `npm run dev` serves the
app with fixtures. Run throwaway scripts from the repo root, then delete them.

Check 390px and 320px, not just desktop. Several defects this repo has had were
phone-only: a page-wide horizontal scroll, headers overflowing, and a control
overlaying the Refresh button. A sideways scroller is not
enough to hold its contents: an absolutely positioned `.sr-only` label inside
one that is not itself positioned is placed against the page and widens it
(the Ceiling & sky card's 36-hour strip, to 847 px at 390, until
`.sky-scroll` got `position: relative`, 2026-10-24).

## Gates

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. CI runs on
pull requests and on dispatch, never on a push (`.github/workflows/ci.yml`),
so commits pushed to a branch with no open PR are never checked by CI
unless someone dispatches it — a long branch can accumulate a lot of
unverified work. `main` deploys to GitHub Pages on push.

Copilot code review draws on the account's monthly premium-request quota, and
on 2026-09-23 it ran out mid-PR after eight reviews across three PRs in one
day. Request it once per PR when the work is complete, and once more after
the batch of fixes it asks for — not after every small push. Run the four
gates and read your own diff first; a review spent on a typo is a review not
available for the change that needs one.

`.github/workflows/live-site.yml` is not a gate either: daily, after every
deploy and on dispatch, it loads the deployed site in a browser, every page
at 1280, 390 and 320 px on live data (`scripts/liveSite.ts`), and fails
when a reader would meet a fault, as `src/domain/liveSite.ts` counts one:
a script error, the crash screen, a page wider than the viewport (naming
the innermost elements past the edge, since issue #208's 3 px at 320 could
not be traced from a width alone), a site file not served, a Data health source in error or still loading, the TAF
relay's fetch failing once the relay is set (read from the TAF row's chip,
since 2026-10-21; the NBM row the same way since 2026-10-27, NOAA's bucket
failing behind the relay a note, anything else on the row a fault), the
radar image not drawn, the parity summary or the
ceiling page's data not loaded.
Another host's failed request and console errors are printed as notes,
since the app retries them. A page failing its first load is loaded once
more before it counts, and a failure on `main` opens one issue labelled
`live-site`. The deploy workflow starts it when it finishes
(`check-live` in `deploy.yml`): a `workflow_run` trigger missed every deploy
another workflow dispatched with its token, the daily `#parity` and
weekly ceiling deploys (seen 2026-10-18 and 10-19), and fired only after
deploys from a push. It runs from the sandbox too (the script's header has the
environment), against the live site or a local build: on 2026-10-17 it
failed the live `#citations` at 320 px, before the fix deployed, and passed
every page of a local build with the fix.

`.github/workflows/sky-parity.yml` is not a gate: it runs daily and on
dispatch, needs the network, and lives under `scripts/*.live.ts` with its own
`vitest.live.config.ts` so `npm test` stays hermetic. It fails when the
app's METAR sky parse, its derived flight category, or its TAF group decode
(`src/domain/taf.ts`, run on aviationweather.gov's own TAF text and compared
period by period with the `fcsts` decode served beside it) disagrees with
aviationweather.gov's decoder on today's reports, and opens one issue labelled
`sky-parity` when it does on `main` (a run dispatched on a branch opens none);
it also prints whether the TAF the card shows is the issuance
aviationweather.gov currently has (informational). It also fails, through
`scripts/pilotLinks.live.ts`, when a Pilots tab deep link stops opening
what it should: the Chart Supplement link carries an edition number whose
scheme is inferred (`src/domain/chartSupplement.ts`), and the first edition
that would show the inference wrong takes effect 2026-10-29. And it fails,
through `scripts/simText.live.ts`, on the SIM checks described under
"Citations" above.
aviationweather.gov is on the sandbox allowlist since 2026-09-29, so it runs
from here too.
`scripts/schulzeCompare.live.ts` runs in the same job and prints this app's
winds-aloft profile beside Mark Schulze's at the same valid hour; it is a
report and never fails the run. It does run from here (markschulze.net is
allowlisted; it needs a Referer and a browser-like User-Agent).
`scripts/usairnetCompare.live.ts` does the same for the latest KPMV
observation: the dashboard's decode beside usairnet's, every field the page
shows, matched by observation time; also a report that never fails, since
usairnet is a page scrape. `.github/workflows/comparisons.yml` also runs
both eight times a day, about three hours apart and each scheduled at a
different minute, so the samples spread over the day and every part of the
hour (the daily sky-parity run is scheduled for about 13:00Z; GitHub started it at 16:18Z and 16:52Z on 2026-10-24 and 25); the summary takes
only artifacts from runs on `main`. Both print one `@@parity {json}` line per run,
which every comparison run uploads as a `parity-<run id>` artifact (kept 14
days). `.github/workflows/parity-summary.yml` combines them daily with
`scripts/paritySummary.ts` into `public/parity/summary.json` — the arithmetic
is `src/domain/paritySummary.ts`, pure and tested — commits that file to
`main` and dispatches the Pages deploy (a push made with the workflow token
starts no other workflow). The in-app page at `#parity`, "How different from
other sources", renders it: counts and spreads, never a grade. The
summary runs when the daily sky-parity run finishes and also reads
`data/parity/logs-to-2026-10-05.jsonl.gz`, every line of a temporary sampler
that ran the usairnet comparison every two minutes and the Schulze one every
four from 2026-09-30 to 2026-10-05 (before that, throttled cron lines from
2026-09-24 to 26, then the Schulze one every five minutes and the usairnet
one every fifteen to 28). Since 2026-10-19 the summary workflow also
archives every record not yet archived, daily, as
`data/parity/parity-logs-<day>.jsonl.gz` (`scripts/parityArchive.ts`), so
no comparison drops off after its fourteen days. The archive is what keeps its figures once the artifacts expire,
above all the arrival timings (`arrivalLags`), which only two-minute samples
can give; the script drops records seen twice, so the overlap counts once.
What it found is in `docs/source-parity.md`, "What the sampler found". To
time something again, the sampler workflow and `scripts/sampleLoop.sh` are
in the history (removed 2026-10-05): it was a job that looped, not a cron
line per sample, because GitHub ran an every-fifteen-minutes schedule under
ten percent of the time and a running job is not throttled.
`.github/workflows/forecast-keep.yml` commits what the dashboard's
forecasts said (the NWS gridpoint fields the card reads,
`GRIDPOINT_FIELDS`, and Open-Meteo's 10-day outlook, `openMeteoDailyUrl`)
to the `forecast-archive` branch, one gzipped file an hour
(`scripts/forecastKeep.ts`). Both serve only the future, and no archive
holds the hourly rain and thunder chances or the outlook as the card asks
for them; the ceiling-error page scores the kept chances against KPMV's
reports (`src/domain/chances.ts`, docs/forecast-chances.md), and
`scripts/keptForecastsVsKpmv.ts` sets the kept wind, gust, direction,
temperature, visibility and rainfall against them by hand
(`src/domain/keptForecasts.ts`, docs/kept-forecasts-vs-kpmv.md). NOAA's NDFD archive holds the
gust back to April, and `scripts/nwsGustArchive.ts` sets six months of it
against KPMV the same way (`src/domain/ndfdGust.ts`,
docs/nws-gust-archive.md, by hand). The keeper never touches `main`, so it starts no deploy. Since
2026-10-16 it is a job that loops (`scripts/forecastKeepLoop.sh`, a
snapshot at minute 23 of each hour, pushed as taken; five or six a run)
and queues its own successor before it starts, so the chain does not
wait on GitHub's schedule; a three-hourly schedule restarts it if a
dispatch fails. As a cron line per snapshot it ran every 3 to 6 hours.
To stop it, disable the workflow in the Actions tab: a run dispatched
only by the last one would otherwise follow it for good.
The in-app page at `#wind-errors`, "How far the wind forecasts were from
KPMV", draws forecast minus reported surface wind as histograms: the kept
NWS forecasts by lead, the same NWS forecast from NOAA's NDFD archive by
lead (from 2026-04-01, `data/parity/ndfd-wgust-*` and `ndfd-wind-*`),
Open-Meteo's archived 10 m wind by run (from 2026-04-01,
`data/parity/om-wind-*`), and the surface-wind sample's
Open-Meteo forms and NWS hour by source (`src/domain/windErrors.ts`,
`src/components/WindErrorsPage.tsx`). Its data file,
`public/wind-errors/summary.json`, is rebuilt weekly by the ceiling data
refresh below (`scripts/windErrorsData.ts`, held to the published file by
`windErrorsShrinkage`), and by hand with the same script. The docs'
figures are dated readings (`docs/img/*-wind-errors-<day>.svg`), drawn by
hand with `--figures` and never overwritten, because each doc's text
quotes the counts of its own reading.
`.github/workflows/surface-wind-sample.yml` is that pattern again, temporary:
it runs `scripts/surfaceWindCompare.live.ts` every five minutes
(`scripts/surfaceWindLoop.sh`) until 2026-10-30T02:00Z, uploads
`surfacewind-*` artifacts kept 30 days that the parity summary never reads.
It changes nothing the dashboard shows, but its archived records feed the
`#wind-errors` page. When the window ends, archive the records under
`data/parity/`, summarise them with `scripts/surfaceWindSummary.ts` into
`docs/surface-wind-sources.md`, rebuild the page's data file and figures
with `scripts/windErrorsData.ts` on the whole window, and delete the
workflow (the maintainer, 2026-10-27: fine to delete as long as the page's
data keeps growing, which the weekly refresh's Open-Meteo and NDFD archive
fetches do; the sampler was a time-boxed sample, not a feed).
The run-split sampler (`.github/workflows/run-split-sample.yml`,
`scripts/runSplitLoop.sh`, both deleted 2026-10-27) was the same pattern:
every four minutes from 2026-10-23 to 2026-10-27T06:00Z it asked Mark
Schulze's tool for both its hour in progress and its next hour and set
each against the app's Open-Meteo answer for the same hour, plus two app
requests a moment apart against each other. Its 1,291 records are
`data/parity/runsplit-2026-10-23-to-2026-10-27.jsonl.gz`, summarised by
`scripts/runSplitSummary.ts` in docs/run-split.md: the different-runs
readings follow the clock, not his next-hour request. A new HRRR run
reaches Open-Meteo's servers one copy at a time between about :20 and
:59, and for some minutes after each copy a request gets either run; the
app's own two requests a moment apart disagreed in the same minutes. The
comparison's "different runs" rule is shared with it (`rawGap`,
`src/domain/runSplit.ts`), and so are the tool and metadata fetches
(`scripts/schulzeFetch.ts`).
`.github/workflows/ceiling-data-refresh.yml` (Mondays 07:41Z, and on
dispatch; GitHub started the 2026-10-19 run at 14:57Z, so check for it
in the afternoon) fetches the NDFD ceilings and KPMV's reports from the newest
kept record's day to the last whole UTC day, commits them under
`data/parity/` with the ceiling-error page's rebuilt data file to `main`,
and since 2026-10-23 Open-Meteo's archived wind and NDFD's wind, gust
and direction for the same days and the `#wind-errors` page's rebuilt
file with them, and dispatches the deploy. It fails, committing nothing, when a fetch
brings nothing newer or either rebuilt file holds less than the published
one (`src/domain/ceilingRefresh.ts`, `windErrorsShrinkage`); a run on
another branch commits nothing. The wind side is independent: when
either wind fetch or the wind rebuild fails, the page's wind file is left
as published, the ceiling data (and any wind archive fetched) still
commits, and a last step fails the run. Its rules and why are in docs/ceiling-heights.md, "The chart".

usairnet's page is read by `src/domain/usairnet.ts`, tested against station
blocks saved from the live pages (`tests/fixtures/usairnet/`). Its first
parser, in the script, misread three formats and each showed on `#parity`
as a disagreement that was the parser's: a gust between the speed and the
direction, present weather in the heading, and "Solid Overcast" (the FAA's
word for OVC is plain "Overcast", AC 00-45H Table 3-3). Two more followed
from the dense samples: fractional visibility ("1 1/4 Miles") and a north
wind's 360° against the page's "0° North". Records carry a version (`v`),
and the summary counts each corrected row only from the version that fixed
it (`FIELD_SINCE_VERSION`). A calm wind is compared as no direction on both
sides: NWS's decode gives calm 0°, which no card shows. When the page will
not parse, the record keeps the page's text near the station (`pageText`).
usairnet redesigned the page about 2026-10-09 and nothing parsed it until
2026-10-26, 17 days, because the usairnet line never fails a run and
nothing watched the `#parity` rows stop growing (docs/source-parity.md,
"usairnet's redesign"). The parser now reads both layouts (the old is
still served as `view=legacy`), and records carry `v: 4` and the page's
raw METAR. When a comparison that "never fails" goes quiet, the summary's
`unreadable` count is where it shows; read it when checking a run.

Open items live in `docs/open-questions.md`.
