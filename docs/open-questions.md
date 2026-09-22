# Open questions and follow-ups

Live backlog. Closed items should be deleted rather than marked done — the
repository history is the record.

## Needs a human with a document

These cannot be settled from the code.

1. **The CFR and FAA citations.** `14 CFR 105.17`, `14 CFR 105.19`, `FAA AIM
   7-1-7` and `FAA-P-8740-2` are still AI-derived and unread — ecfr.gov,
   faa.gov and faasafety.gov are not reachable from the development sandbox
   even with the current allowlist. The USPA references were read on
   2026-09-22 (see below); these were not, and the #citations page says so.

2. **The USPA claims still need an instructor, not another reading.** The SIM
   sections were read at uspa.org on 2026-09-22 and the claims corrected
   against them, so the section numbers are no longer guesses. What a reading
   could not settle is on the #citations page under "Still open" — among them
   whether rounding the 14 mph student limit *down* to 12 kt is the right
   direction for a limit a jumper reads off a card, and whether the club's
   posted waiver tiers have been filed as a SIM 2-2 waiver.

3. **The app's own thresholds, for an instructor's judgement rather than a
   lookup.** Part B of the citations page — currently one entry, the 25 kt
   licensed bar scale, which triggers nothing and only sets how long a bar is
   drawn.

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

## Code

- **`fetchDailyFromGridpoint` ignores `USE_FIXTURES`** (`src/api/nws.ts`) and
  calls the live endpoint unconditionally, so the daily gridpoint fallback
  cannot be exercised in fixture mode at all — it just fails to the network.
  Fixing this would make that path testable on screen.
- **`subscribe` in `src/api/sourceLog.ts` has no consumer** outside its own
  test. The `useSyncExternalStore` contract was kept intact deliberately when
  the in-page log viewer was removed; decide whether to keep or drop it.
- **`.panel-head` is styled in four places.** `AdvisoryPanel`, `SettingsPanel`
  and `DataFreshness` render it by hand instead of going through `Panel`.
  `SettingsPanel` uses a `<summary class="panel-head">`, so it is not a drop-in.

## Winds aloft: two known gaps, neither reachable today

Both surfaced in an adversarial review of the 2026-09-22 work. Neither can be
triggered by current data, and neither is fixed.

- **The Surface row can carry a share of a wind from below the ground.**
  Open-Meteo's 1000 hPa level usually sits under the model's own terrain — at
  NE69 around 560 ft MSL against a 1,182 ft field — so it sorts below the 10 m
  sample and the Surface row is interpolated between the two. In the fixtures
  that is a ~4% share of a sub-surface value, and up to ~15% on a high-pressure
  day. It is pre-existing, and it sits awkwardly beside this branch's own rule
  that a level aloft licenses nothing below itself. Dropping sub-surface
  pressure levels in `normalizeOpenMeteo` would settle it; nobody has checked
  whether the model's sub-surface winds are meaningless or merely
  extrapolated.

- **Rows lost at the TOP of the profile are silent.** `interpolateWindsAloft`
  drops altitudes above the highest sample, which is the honest behaviour, but
  nothing says so on screen: if the 500 and 600 hPa levels were both missing
  the table would stop at 9,000 ft while the expand toggle still offered "up to
  13k ft", and the drift estimate would extrapolate the top of the freefall
  with the 700 hPa wind with no note. The FD path has a note for the equivalent
  gap at the bottom (`lowestLevelFtAgl`); the top has no equivalent. Not
  observed live — the 48-hour window checked had no nulls at any level.

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

Approach 3 (centring the interactive-radar link on the DZ) is untouched and
still open: modern `radar.weather.gov` encodes map state in an opaque
`?settings=v1_<base64>` blob, and the app still links to the plain station page.

## Mark Schulze's Winds Aloft: AGL or MSL?

**Settled: AGL.** Evidence and a re-check recipe in
[`markschulze-altitude-reference.md`](markschulze-altitude-reference.md). The
winds-aloft card now says so, since it is the cross-check it sends jumpers to.
