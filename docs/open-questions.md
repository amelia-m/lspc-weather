# Open questions and follow-ups

Live backlog. Closed items should be deleted rather than marked done — the
repository history is the record.

## Needs a human with a document

These cannot be settled from the code, and several cannot be settled from a
sandbox at all.

1. **The seven SIM lookups on the in-app `#citations` page.** Every USPA
   reference is AI-derived and unverified. A4 is the one that matters most: the
   app raises no surface-wind flag for licensed jumpers at any speed, which is
   correct only if the BSRs genuinely set no limit for them. If they do, the app
   is silent exactly where it should warn.

2. **Does Mark Schulze's winds tool label altitudes AGL or MSL?** A jumper
   cross-checking the winds-aloft card against it was told MSL by an AI, and
   that was wrong. The repo makes no claim about it either way, and nothing here
   should until someone has looked. `www.markschulze.net` is blocked from the
   sandbox unless allowlisted.

3. **The app's own thresholds, for an instructor's judgement rather than a
   lookup.** Part B of the citations page — currently one entry, the 25 kt
   licensed bar scale, which triggers nothing and only sets how long a bar is
   drawn.

## Live-site smoke test

The app has never been exercised against real data — every test, every CI run
and every screenshot has used the fixtures in `src/api/fixtures/`. On the
deployed site, check:

- weather data actually loads;
- the winds-aloft **valid time** against another tool's stated valid time (this
  is what started the citation work: `nearestIndex` snaps to the nearest hour in
  either direction, so at 12:31 the card shows the 13:00 forecast);
- **Data health** — whether any source fell back to NOAA FD or the NWS
  gridpoint. The FD fallback UI has never been seen rendered with real data;
- the radar image, which is blocked from the sandbox;
- the Licensed profile: Surface wind card reads sensibly with no flag and no
  band.

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

## Radar card: a pin at the drop zone

Wanted: a marker showing where LSPC sits on the radar image.

The card renders a plain `<img>` of
`radar.weather.gov/ridge/standard/KOAX_loop.gif`. Placing a pin needs that
image's georeferencing — projection, centre and extent in pixels — to convert
the DZ's coordinates into an offset. **Do not guess those constants.** A marker
in the wrong place on a weather display is worse than none: a jumper reads storm
distance against it.

Three approaches were considered, and the decision was to start with the third
while prototyping the other two:

1. **Interactive map with a real marker** (e.g. Leaflet plus an NWS radar
   layer). The pin is correct by construction, from the same coordinates that
   drive the forecasts. Costs a dependency and tile requests, and needs a tile
   host allowlisted.
2. **Pin the existing GIF**, but only once the georeferencing is known. The
   image carries city labels and state and county lines, so it is calibratable
   against known points — either by fetching and measuring it (needs
   `radar.weather.gov` allowlisted) or by someone reading landmark positions off
   the live site.
3. **Centre the existing "interactive radar" link on the DZ.** No pin on the
   card, but one click gives a real map. Note that modern `radar.weather.gov`
   encodes map state in an opaque `?settings=v1_<base64>` blob rather than plain
   lat/lon parameters, so any hand-built URL needs checking against the live
   site before it replaces the working station link.
