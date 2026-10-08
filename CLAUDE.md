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
  words, "For licensed skydivers are unlimited" (read at uspa.org 2026-09-22).
  This used to be the app's largest open risk — if the BSRs had set a limit, the
  app would have been silent exactly where it should warn. They do not. The
  Surface wind card still carries the profile's guidance and BSR citation as a
  standing note, and the empty advisory list still names the gap, so silence is
  not left to read as an all-clear.
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
  come from the METAR's T group, not IEM's `dwpf`, which is whole °F and
  converts back a tenth off. `mesonet.agron.iastate.edu` is on the sandbox
  allowlist since 2026-09-29, so the IEM path runs from here (the usairnet
  comparison reads both feeds and logs which served).
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
  out".
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
  and why, is in `docs/markschulze-altitude-reference.md` (among them, for a
  while, the two being on different forecast runs for the same hour: 114
  of 1,611 same-hour comparisons to 2026-10-05, mostly between half past
  and ten to the hour, cause still open in `docs/open-questions.md`); run
  `scripts/schulzeCompare.live.ts` before touching the interpolation.

## Citations

Every USPA, CFR and FAA reference in this app began as an AI recollection (the
club's posted tiers are a transcription of an undated photo of the sign, and
say so). The **USPA SIM** sections were read at uspa.org on 2026-09-22, and the **CFR sections, AIM 7-1-7
and FAA-P-8740-2** on 2026-09-23, and the claims corrected against them. A
reading is not an instructor's sign-off, and the difference is not a detail to
smooth over. The in-app page at `#citations` (`src/components/CitationsPage.tsx`,
data in `src/config/citationsChecklist.ts`) records, per claim, what the section
says, when and where it was read, and what a reading could not settle — and
takes the reviewer's answers: a verdict per claim, an answer and note per
question, kept in the browser (`src/api/citationAnswers.ts`) and sent as a
prefilled GitHub issue or copied text (`src/domain/citationAnswers.ts`, pure).
The page says nothing about what the app used to claim; a test rejects that
wording. History lives in the commit log.

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
`skyvector.com` (the sectional link in the header), `tiles.arcgis.com`
(FAA's VFR sectional tile service) and `*.blob.core.windows.net`, where
GitHub's artifact downloads redirect. Since 2026-10-08 it also has
`github.com`, the ADS-B networks (`adsb.lol`, `adsb.fi` with `globe.` and
`opendata.`, `airplanes.live`, `opensky-network.org`, `api.adsb.one`),
map tiles (`tile.openstreetmap.org`, `*.tile.openstreetmap.de`,
`server.arcgisonline.com`, `services.arcgisonline.com`),
`earthdata.nasa.gov` and `heywhatsthat.com` (the receiver panorama in
`docs/adsb-receiver.md`). Reachable is not readable: `globe.adsb.fi`,
`api.adsb.one` and `airplanes.live` answer a script with Cloudflare's 403
(airplanes.live's API asks for an emailed request first). The comparison artifacts can now be
read from here with `curl -sL
https://api.github.com/repos/amelia-m/lspc-weather/actions/artifacts/<id>/zip`
(the session's GitHub proxy supplies the credential); `gh api` still refuses
to follow that redirect. A change to the list applies to a running session as
soon as it is saved.

- the live NWS and Open-Meteo paths, the TAF fallback chain and the NOAA FD
  winds fallback, by running the app's own fetch and domain code under Node;
- component output on live data, via `renderToStaticMarkup` — the same trick the
  advisory tests use. This is how the FD fallback's fake Surface row was found;
- the radar GIF and its georeferencing, by fetching and measuring it;
- the USPA SIM sections behind the citations, and the CFR sections, AIM 7-1-7
  and FAA-P-8740-2 behind the FAA ones;
- the usairnet KPMV page the Ceiling & sky card links to, as a second decode of
  the same METAR (plain HTML, fetchable with a browser User-Agent).

Still not checkable here, so do not imply a green suite covers them:

- **The deployed site in a browser.** Playwright's Chromium does not trust the
  proxy's TLS-intercepting CA, so it cannot load any https:// page, and the
  fixes for that (the NSS store, a Chromium enterprise policy) are blocked by
  the sandbox's own guardrails. <https://amelia-m.github.io/lspc-weather/> has
  therefore never been loaded, and the app has never been seen in a browser
  against *live* data.

  What can still be checked in a browser, and is worth doing rather than
  skipping: serve the production build over local http and let Playwright
  fulfil cross-origin images itself. That is how the radar marker was verified
  —

  ```
  BASE_PATH=/ VITE_USE_FIXTURES=true npm run build
  (cd dist && npx http-server -p 8788 -s &)
  # in the script: page.route('https://radar.weather.gov/**', r => r.fulfill({ body: localGif }))
  ```

  It exercises the real bundle under the real CSP, at 1280/390/320 px. Only the
  live data and the real cross-origin fetch are missing. A Node render is not a
  substitute for either — `renderToStaticMarkup` does not run effects, load
  images or apply CSS.
- CI is no better: it runs the same fixture-backed suite. Nothing in `npm test`
  touches the network.

Two habits worth keeping. `NODE_USE_ENV_PROXY=1` plus
`NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` makes Node's fetch go through the
proxy, which is what let the live paths run at all. And some hosts refuse a bare
request: `markschulze.net` 403s without a `Referer`.

## Conventions

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
- Derive values rather than writing them down twice. The station's distance and
  bearing come from its coordinates via `src/domain/geo.ts`; a hand-written
  `distanceMi: 12` had already drifted from the real 11.54.

## Verifying UI work

Playwright is available, but **it cannot currently reach any https:// site**:
its Chromium does not trust the egress proxy's CA and fails with
`ERR_CERT_AUTHORITY_INVALID`. Local `npm run dev` over http works; the deployed
site does not. Do not report a live-site UI check as done on the strength of a
Node render.

When it does run: the browser binary is `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(the `chromium` symlink next to it is not the executable) — pass it as
`executablePath` and do **not** run `playwright install`. Playwright itself is
installed globally, not in `node_modules`, so import it by path:
`/opt/node22/lib/node_modules/playwright/index.mjs`. `npm run dev` serves the
app with fixtures. Run throwaway scripts from the repo root, then delete them.

Check 390px and 320px, not just desktop. Several defects this repo has had were
phone-only: a page-wide horizontal scroll, headers overflowing, and a control
overlaying the Refresh button.

## Gates

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. CI runs on
pull requests only (`.github/workflows/ci.yml`), so commits pushed to a branch
with no open PR are never checked by CI — a long branch can accumulate a lot of
unverified work. `main` deploys to GitHub Pages on push.

Copilot code review draws on the account's monthly premium-request quota, and
on 2026-09-23 it ran out mid-PR after eight reviews across three PRs in one
day. Request it once per PR when the work is complete, and once more after
the batch of fixes it asks for — not after every small push. Run the four
gates and read your own diff first; a review spent on a typo is a review not
available for the change that needs one.

`.github/workflows/sky-parity.yml` is not a gate: it runs daily and on
dispatch, needs the network, and lives under `scripts/*.live.ts` with its own
`vitest.live.config.ts` so `npm test` stays hermetic. It fails only when the
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
that would show the inference wrong takes effect 2026-10-29. aviationweather.gov is on
the sandbox allowlist since 2026-09-29, so it runs from here too.
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
hour (the daily sky-parity run is always about 13:00Z); the summary takes
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
one every fifteen to 28). The archive is what keeps its figures once the artifacts expire,
above all the arrival timings (`arrivalLags`), which only two-minute samples
can give; the script drops records seen twice, so the overlap counts once.
What it found is in `docs/source-parity.md`, "What the sampler found". To
time something again, the sampler workflow and `scripts/sampleLoop.sh` are
in the history (removed 2026-10-05): it was a job that looped, not a cron
line per sample, because GitHub ran an every-fifteen-minutes schedule under
ten percent of the time and a running job is not throttled.

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

Open items live in `docs/open-questions.md`.
