# Code review of the domain layer, 2026-11-20

A read of every module under `src/domain/` with the tests under `tests/`
that exercise it, looking for correctness bugs: inverted or off-by-one
conditions, null and undefined handling (the repo's three-state values,
`undefined` no figure and `null` "none"), time-zone and daylight-saving
edges, unit conversions, rounding at boundaries, comments describing
behaviour the code does not have, and tests that would pass with the code
they name deleted. Nothing here adds a threshold, a colour or a word of
judgement (CLAUDE.md, the governing rule); every change is a fix to what
the code already asserts, or to a comment, each with a test proved by
reverting the fix and watching it fail.

The 49 modules read: advisories, ceilingHeights, ceilingRefresh, chances,
chartSupplement, citationAnswers, cloudCoverSources, densityAltitude,
extent, flightCategory, forecastHour, geo, gridpointFreshness, humidity,
iem, keptForecasts, latest, liveIssue, liveSite, liveVsArchive, localClock,
nbm, ndfdGust, nearbyMetars, normalize, openMeteoUsage, pageCount,
paritySummary, paritySvg, radarGeo, runAge, runSplit, simText, skyDays,
slippyTiles, sourceProvenance, spot, stationPairs, sun, surfaceRows,
surfaceWindSources, taf, tafParity, types, units, usairnet, windErrors,
windsAloft, wingLoading.

## Fixed

In order of weight.

### 1. `metarObservedMs` dated a report a month ahead at a month's turn

`src/domain/usairnet.ts`, `metarObservedMs` (was line 223). The usairnet
comparison dates the METAR the page prints by its time group ("302355Z")
against the dashboard's report time, and did it through `resolveTafTime`,
whose rule is a TAF's: a day more than fifteen below the reference's is
the next month, anything else the reference's own month. usairnet lags the
dashboard by minutes, so in the first minutes of a month its page still
prints the last report of the month before, and day 30 read against a
reference on the 1st landed on the 30th of the new month: a month ahead.
`scripts/usairnetCompare.live.ts` (line 193) then logs "DIFFERENT
observation times" with the dashboard some 44,000 minutes behind, a
`sameReport: false` record and an `obsGapMin` of about −44,000, which
`timingOf` in `paritySummary.ts` would fold into the timed-gap spread on
`#parity`. Narrow (the comparison runs eight times a day and the window
is the page's lag, a few minutes at 00Z on the 1st), but a wrong record
each time it lands.

Fixed by dating the group as the FD bulletin's day codes are dated:
`ddhhmmToEpoch` in `normalize.ts`, now exported, takes the candidate
among the previous, same and next month nearest the reference. Test in
`tests/usairnet.test.ts`, "dates a report from the last day of the month
before…", both directions of the turn; with the old call restored it
fails with the month-ahead instant.

### 2. The sky-parity issue body named a file that does not exist

`src/domain/liveIssue.ts` line 61: the `what` text of the sky-parity
check sent the reader to `src/domain/metar.ts`, which has never been in
the repository (the METAR sky parse is `parseSkyGroups` in
`src/domain/normalize.ts`). Every issue the daily check opened under
`sky-parity` carried the wrong path. Fixed to `normalize.ts`. Test in
`tests/liveIssue.test.ts`, "the files an issue body names … exist":
every `src/…` and `scripts/…` path in every check's body is looked up on
disk; it fails on `src/domain/metar.ts` with the old text.

### 3. An NBM `SKY` field left blank read as 0% cover

`src/domain/nbm.ts`, `percent` (was line 56). `Number('   ')` is 0, so a
blank three-character field in the `SKY` row became a sky cover of 0%, a
clear sky the bulletin did not forecast; `hundredsFt` beside it, and the
`FHR` reading below it (which carries a comment naming this very
pitfall), both treat a blank as no figure. Not seen in a bulletin yet
(MDL writes −99 for missing), so this is a hardening against a padded or
cut row rather than a seen defect; the Ceiling & sky card's NBS sky-cover
row is where it would have shown. Fixed to read a blank as null, with a
comment. Test in `tests/nbm.test.ts`, "reads a blank sky field as no
figure, not as 0% cover"; with the guard removed it fails with `+0`.

### 4. `resolveTafTime`'s comments described a rule the code does not have

`src/domain/taf.ts`: the module header and the function's own comment
said "a day below the issuance day is read as next month", while the code
moves to the next month only when the day is more than fifteen below
(`day < ref.getUTCDate() - 15`). The code is right (a TAF reaches 30
hours, so a group a day or so before the issuance day is that month's,
and a plain "below" rule would put it a month ahead); the comments were
wrong, and CLAUDE.md names a comment describing behaviour the code lacks
as a recurring hazard. Both comments now say what the code does and why.
Test in `tests/taf.test.ts`, "keeps a day a little below the issuance day
in the issuance month"; with the rule changed to a plain "below" it fails
a month ahead. Note the existing test "reads a day below the issuance day
as next month" (day 1 against the 31st) still passes: its day is thirty
below.

## Left for the maintainer

Found and verified against the code; none is a one-line correctness fix
with an unambiguous right answer, or each is a judgement.

- **`spot.ts`, `integrate`** (line 115): a layer the descent only
  partly crosses (deployment at 3,500 ft in the 3,000–4,000 ft layer)
  takes the mean of the two bounding levels' winds over the part crossed,
  not the mean over that part. With levels every 1,000 ft the error is a
  fraction of one layer's drift, inside what the card already calls an
  estimate; a fix would interpolate the wind at the clipped edge. Noted,
  not changed: it moves a figure a reader may have compared with Mark
  Schulze's tool, which the docs do not say how it integrates.
- **`units.ts`, `fmtLimitSpeed`**: CLAUDE.md says "Wind limits render
  with a decimal in knots", but `round(kt, 1)` returns a number, so a
  limit that is whole in knots prints without one. The Student caution is
  stored as 12 kt whole (`STUDENT_WIND_KT`), so the card and flag print
  "12 kt" beside a waiver tier's "16.5 kt"; `tests/advisories.test.ts`
  line 694 pins "use 12 kt". The purpose (two posted limits one mph apart
  staying apart) is served either way; whether the Student figure should
  read "12.0 kt" for consistency is a wording call.
- **`normalize.ts`, `normalizeMetar`** (the aviationweather.gov path, read
  only by the sky-parity script, never by the browser): a calm report
  keeps the decode's 0° as `directionDeg`, where the two browser feeds
  (`normalizeNwsObservation`, `normalizeIemCurrent`) give calm no
  direction, as `SurfaceWind` documents. Harmless today (the parity
  script compares through `comparableDirection`), but a third shape of
  the same field.
- **`advisories.ts`, `comingHours`** (line 384): "the coming
  FORECAST_FLAG_HOURS, the one in progress included" selects points with
  `h.time < now + 12 h`, so at 10:30 the 22:00 point (22:00–23:00) is in,
  ending 12.5 hours out: thirteen points for a flag whose guidance says
  "in these hours of the next 12". `tests/forecastAdvisories.test.ts`
  "reads only the coming 12 hours, the hour in progress included" pins
  this reading. Whether the last half hour belongs is a wording call.
- **Rounded directions can print 360**: `interpolateWindsAloft`,
  `interpolateAsSchulze` and `dominantWindDirectionDeg` normalise to
  [0, 360) and then `Math.round`, so 359.6° prints as 360°. A METAR
  writes north as 360 and `compass(360)` is "N", so this reads correctly;
  only noted so nobody "fixes" `compass` for it.
- **`advisories.ts`, the Daylight flag** reads `snapshot.sun`, which the
  hook computes at refresh time; between solar midnight (about 1:25 AM
  CDT) and the next refresh the held `sun` is the day before's, whose
  sunrise and sunset are both past, so the flag still reads "After
  sunset", which is correct. No change; recorded so the dependence on
  refresh timing is known.

## Checked and found sound

So the next reviewer need not repeat them: `flightCategory`'s bands
against AIM 7-1-7 (VFR above 3,000 ft and above 5 SM, LIFR below 500 and
below 1); `observedFlightCategory` never VFR without a ceiling;
`forecastFlightCategory` with one half forecast; `densityAltitude`'s
Rankine and station-pressure arithmetic; `sun.ts`'s local-solar-day
choice for a west longitude and `nightIntervals`' day either side;
`localClock.resolveLocalClock`'s two-pass offset across a DST change;
`skyDays`' slot and `slotsLeft` arithmetic on the fall-back and
spring-forward days; `chartSupplement.airacId` at a year's turn;
`nbm.ts`'s day roll from a 23Z cycle; `normalize.ts`'s T-group and body
temperature regexes against RVR, fractions and remarks; `parseFdWinds`'
over-100-kt and implied-negative encodings; `durationToHours`;
`gridpointFreshness`; `windsAloft.sampleAt`'s edge tests;
`interpAngle`; `taf.ts`'s BECMG and PROB TEMPO handling and
`periodFlightCategory`; `keptForecasts.asReported`; `windErrors.histogram`'s
away-from-zero halves; `cloudCoverSources.reportNear`'s earlier-report
tie; `paritySummary.arrivalLags`' bracket; `openMeteoUsage`'s weight
formula against the server's; `pageCount`; `citationAnswers.sanitizeAnswers`.
