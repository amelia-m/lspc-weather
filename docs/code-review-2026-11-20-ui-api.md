# Review of the React and I/O layers (2026-11-20)

A read of `src/components/`, `src/hooks/`, `src/api/`, `src/config/`,
`src/styles/app.css`, `src/App.tsx` and `src/main.tsx`, with the tests
that render them, against the rules in CLAUDE.md's first section: no
verdict, no threshold, colour, icon or one-word label of the app's own;
silence named rather than left; every citation's `source` and `url` on
one section; comments that describe what the code does; fetch and retry
logic that cannot leave a card green over a failed source. Nothing under
`src/domain/`, `scripts/`, `relay/` or `.github/` was changed; one
finding that lives there is written down below instead.

## What was looked at

- Every file in the scope, read with the data it takes and the config it
  cites: the hooks (`useWeatherData`, `usePolling`, `useNow`,
  `useSiteJson`, `useWindsHour`), the api modules (`http`, `nws`, `iem`,
  `openMeteo`, `openMeteoUsage`, `nbm`, `tafChain`, `nearbyMetars`,
  `pageCount`, `sourceLog`, `safeStorage`, `citationAnswers`), every
  component and the common ones, every config file, and the stylesheet.
- The live NWS gridpoint for the drop zone, read at 01:41Z on
  2026-11-20 (`api.weather.gov/gridpoints/OAX/77,42`): its series began
  at 2026-11-19T19:00Z, six hours before its 01:11Z update time, which
  is what the first finding turns on. No request was made to
  api.open-meteo.com; the shape of its daily answer was read instead
  from a kept forecast on the `forecast-archive` branch
  (`data/2026/11/10/2223Z.json.gz`: `daily.time` 1794290400, which is
  2026-11-10T06:00Z, local midnight in Central Standard Time, with
  `utc_offset_seconds` −21600).
- The stylesheet's 315 class selectors against every class name the
  components and the static pages write, as whole tokens; the classes
  built at render time (`advisory-${level}`, `fc-${category}`,
  `hc-key-${key}`, `band-${mark}-text`, `wind-check-status over`) were
  checked by hand.
- The gates in the worktree with every change below: `npm test` (95
  files, 1,420 tests), `npm run lint`, `npm run typecheck` and `npm run
  build`, each on its own exit code, all passing.
- The fixture build (`BASE_PATH=/ VITE_USE_FIXTURES=true npm run build`,
  served by `http-server` on 8793) in Playwright's Chromium 1194, device
  scale 2, `timezoneId: America/Chicago`, the font forced to DejaVu Sans
  (the runner's), at 1280, 390 and 320 px, both tabs, at about 01:53Z
  (7:53 PM Central, Thursday): no page wider than its viewport at any
  width, no page error and no console error. The elements past the right
  edge were the sectional mosaic's tiles inside their cropping frame at
  1280 and the hourly detail table inside its own sideways scroller at
  390 and 320, both by design and neither widening the page. The
  Surface wind card's gust readout kept its amber (`rgb(255, 180, 84)`)
  after the stylesheet change; the 10-day outlook's rows read "Today,
  Fri 11/20, Sat 11/21" at that hour (before the fixture change below
  they read "Fri 11/20, Sat 11/21, Sun 11/22" with the "Today" row
  missing once the label went by date, which is how the fixture's
  anchoring came out); Data health's first row read "METAR (KPMV)";
  the Ceiling & sky card's Data line listed both NBM bulletins.

## Fixed

Each fix has a test in `tests/reviewUiApi.test.ts` where one could be
written, and each test was proved by reverting the fix with a scripted
edit, watching it fail, and restoring the fix.

1. **The 10-day outlook called a day "Today" by its position, and on the
   gridpoint fallback that was yesterday for part of every night.**
   `src/components/DailyForecastPanel.tsx` labelled row 0 "Today". On
   the Open-Meteo path row 0 is today's: the API's days start at local
   midnight today (the kept forecast above). On the fallback
   (`fetchDailyFromGridpoint`, when Open-Meteo is unreachable),
   `aggregateDailyFromHourly` makes a row of every local day the grid
   carries, and the grid starts some hours back (six, at 01:41Z on
   2026-11-20), so from local midnight until the grid's start crosses
   it, the first row was yesterday's, labelled "Today", and the real
   today sat under it as "Fri, 11/20". Now a row is "Today" when its
   date is today's at the drop zone (`localDateKey`, the one the hourly
   chart groups days by, in place of the card's own duplicate of it),
   and days before today are left out: a day that has ended is not an
   outlook. The test aggregates 48 hours from 1 PM Thursday with the
   clock at 2 AM Friday and asserts one "Today", no 11/19 row and
   Saturday after it.

2. **The Open-Meteo daily fixture anchored its days at 12:00 UTC of the
   UTC day, which in the drop zone's evening is tomorrow morning.**
   `src/api/fixtures/openMeteoDaily.ts`. Masked while the label went by
   position; with the fix above, the fixture build showed no "Today" row
   between 6 PM Central and midnight (seen in the browser at 7:50 PM).
   The fixture now starts each day at the drop zone's local midnight, as
   the API does with `timezone` set (`localDayStartSec` in
   `src/api/fixtures/_time.ts`, corrected for the zone's offset so a day
   either side of a clock change lands on its midnight). The test pins
   the helper at 7:50 PM Central on 2026-11-19 (today's midnight 06:00Z,
   not the UTC day's) and across the 2026-03-08 change (06:00Z then
   05:00Z); reverting the offset correction fails it.

3. **Two sources in one "Data:" line shared a React key.**
   `src/components/common/SourceLinks.tsx` keyed each link by its URL,
   and `DATA_SOURCES.nbm` and `DATA_SOURCES.nbs` are one page on purpose
   (MDL's text-bulletin page, `src/config/sources.ts`); the Ceiling &
   sky card lists both once the three-hourly bulletin is in. Two
   children with one key are not kept apart across an update (React
   warns in development and may drop or duplicate one when the list
   changes, which it does as sources load). `renderToStaticMarkup` does
   not warn, so no test had seen it. Keyed by label and URL now; the
   test reads the keys off the element the component returns.

4. **The TAF card printed a fetch error with its whole URL.**
   `src/components/TafPanel.tsx` printed `status.error` as is; Data
   health prints the same error through `shortError`, which cuts each
   URL to its host (the fetch errors quote the request URL, and
   Open-Meteo's runs to a thousand characters; the relay's is short, but
   the rule is one). Now the same. Tested.

5. **Dead code with a comment describing a card that no longer exists.**
   `ceilingCoverage` in `src/components/forecastReach.ts` named the
   hours of the Ceiling & sky card's strip the NWS ceiling forecast did
   not cover; the strip went on 2026-11-18 and nothing called it but
   its own test. Removed with its test block (`tests/skyHorizon.test.ts`);
   the day tables name where that forecast ends through
   `nwsCeilingForecastEnd` in `src/domain/skyDays.ts`, tested there.

6. **Dead stylesheet rules, and one rule overriding another.**
   `src/styles/app.css`: `.sky-axis-col`, `.sky-axis`, `.sky-pct` and
   `.sky-day` (the removed strip's), and `.cite-asks`, `.cite-asks-head`,
   `.cite-asks li + li` and `.cite-verdict` (an earlier citations page;
   the page now writes `cite-found`, `cite-answer`, `cite-choices` and
   `cite-question`) are written by nothing in `src/`, `index.html` or
   `public/`. Removed. `.wind-gust` was in two rules, the first giving
   it the muted colour and the second the amber, so the first's colour
   never applied; the two are one rule now, with the same result on
   screen (the gust readout measured `rgb(255, 180, 84)` before and
   after). No test: a stylesheet deletion has nothing to assert.

7. **Comments that described code that is not there.** Each corrected
   in place, no behaviour changed:
   - `src/App.tsx` kept its own `safeLocalGet`/`safeLocalSet` "mirroring
     the helpers in api/nws.ts"; nws.ts imports them from
     `src/api/safeStorage.ts` since 2026-10-31. App imports those now,
     and the copy is gone.
   - `src/api/citationAnswers.ts` said the same of nws.ts.
   - `src/api/sourceLog.ts` said its console gate was "the same gate
     http.ts uses for its debug output"; http.ts has none.
   - `src/components/common/HourlyChart.tsx` said the limit lines are
     "nothing for Licensed, which has none"; a Licensed reader's own
     limits draw them, marked as theirs.
   - `src/config/thresholds.ts` (`far10517`) said the visibility row
     "waits on" A8's answer; the maintainer answered it on 2026-10-31
     (`VISIBILITY_ROW = 'both'`), and A8 now asks for confirmation.
   - `src/config/sources.ts` (`skyvector`) said the sandbox's browser
     cannot load https pages; it can since 2026-10-17 (CLAUDE.md). The
     comment now dates the statement and says nothing records a look
     since.

8. **Data health wrote the station by hand.** `src/components/
   DataFreshness.tsx` labelled the METAR row "METAR (KPMV)"; now
   `SITE.metarStation.id`, as every other card names it. No test could
   be proved by reverting it (the literal and the config agree today).

## Left for the maintainer

Each verified; none is a threshold, colour or label question the rules
settle, or each is a change a reader of the whole app should make.

- **An older refresh's late METAR failure can mark a newer success
  stale.** `src/hooks/useWeatherData.ts`: the sequence guard
  (`latest`, `src/domain/latest.ts`) records a refresh as the one
  settling a source on winds, TAF, NBM and daily success and on every
  failure, but the observation's success path (`refreshObservation`)
  records nothing, since the same function serves the two-minute
  observation poll, which has no sequence. So if refresh 1's observation
  request times out after refresh 2's has answered, `markStale('metar')`
  finds no newer record and marks the fresh report stale (its data stays,
  by `supersedes`); the next observation poll, within two minutes,
  clears it. The hourly forecast's success is unguarded on purpose
  (`fetchFreshGrid` dedupes). A fix means giving `refreshObservation` the
  refresh's sequence, or giving the poll one; small, but it touches the
  loop the maintainer timed in docs/source-parity.md, so it is a call.
- **`withStaleness` is memoised without the clock.** The same hook
  computes stale-by-age (30 minutes, `STALE_AFTER_MS`) in a `useMemo`
  on `status` alone, reading `Date.now()` inside, so a source's age can
  only flip it stale when some status changes. In practice every fetch
  settles (`fetchJson` times out) and the ten-minute poll flips
  `pending`, so the age rule is reachable only for a tab that was hidden
  and then shown, where the refresh fires at once; latent, not met. If
  the age rule is wanted, add `now` (already in scope) to the memo's
  inputs; if not, say so beside it.
- **The advisory list's empty state when no observation has loaded.**
  With `snapshot.current` null the list says "No conditions flagged from
  the available data" and nothing else; the card below says "No METAR
  available" and Data health shows the row in error. The words "from the
  available data" carry it, but a reader who stops at the first card has
  not been told the observation is missing. The rule in CLAUDE.md is that
  silence is named; whether this one is named enough is a wording call.
- **The gust's colour is the Watch badge's.** `--watch` (amber) paints
  the Watch badge and border, the stale chip, the settings "set" dot, an
  edited field's border, and also the gust everywhere it is drawn: the
  Surface wind card's readout, tick and label, the hourly chart's gust
  line and key. On the card the gust's colour is an identity, the same
  at any speed, and the maintainer's own reading of the bar (CLAUDE.md,
  "the yellow tick") took it as the gust's. It is still the colour of a
  flag level on the same page. A variable of its own (`--gust`, as the
  gust ceiling has `--gust-ceiling`) would keep them apart if that is
  wanted; not done here, since it is a colour choice.
- **`SourceLink`'s ⓘ carries `aria-label` on a plain span.** Screen
  readers do not read an `aria-label` on an element with no role; the
  note reaches them only through the parent span's `title`, which most
  do not read either. The visible ⓘ says there is a note, but not what
  it says, to a reader who cannot hover. A `<abbr title>` or a
  visually hidden copy of the note would. Not changed: it decides how
  every citation note on the page reads aloud.
- **`.sky-*` rules the Precip card still uses.** `.sky-scroll`,
  `.sky-timeline`, `.sky-col`, `.sky-bar-track`, `.sky-bar`, `.sky-ceil`
  and `.sky-time` were the 36-hour strip's and now serve only
  `PrecipPanel`; the names say sky, the card says precipitation. A
  rename is cosmetic and touches a test (`precipPanel.test.ts` pins the
  timeline's class), so it is left.
- **The checklist's levels question.** `src/domain/advisories.ts`
  (`FLIGHT_CATEGORY_LEVEL`, `OVERCAST_LEVEL`) is outside this scope and
  CLAUDE.md says to change neither before B2 is answered; nothing here
  touches them.

## Not findings, checked and left

- Every citation's `source` and `url` name the same section
  (`tests/thresholds.test.ts` enforces it, and each was read).
- No component paints a figure in a warning colour on a figure of the
  app's own: the only conditional colours are `.wind-check-status.over`
  (a reading at or above a published or own limit), the flag badges and
  borders by level, the flight-category pill (the FAA's own categories,
  with the AIM cited), and the Data health dots by fetch state. The
  outlook's Sky column shows Open-Meteo's own weather code as an icon
  and word, which the card's comment accounts for.
- Every card with a source that can be missing says so in its own words
  ("No METAR available", "No wind data", "No winds-aloft data", "Needs
  altimeter + temperature from the METAR", "No current TAF available
  from …", the outlook's "Data: none loaded"), and the Winds aloft card
  offers Schulze's tool when nothing has loaded.
- `usePolling` and `useNow` pause on a hidden tab and fire once on
  return; `useSiteJson` cancels on unmount; the quick retry arms once
  per failure streak; `fetchFreshGrid` shares one in-flight request per
  URL; `fetchJson` reports each attempt once to the Open-Meteo counter
  even when a 200's body will not parse.
- The dependency arrays: `useWeatherData`'s `usage` memo on `status` and
  `lastUpdated` is the one deliberate exception, commented and
  lint-suppressed; the rest are complete.
