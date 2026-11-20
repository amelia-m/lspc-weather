# Documentation audit, 2026-11-20

Every statement in the documents below that names a file, function,
constant, workflow, test, row label, CSS class, count, date or figure
was checked against the repository as it stood at `7beb354` (grep and
reading; no network). Documents only were edited; where a document was
wrong because the code is, the finding is listed under "Left for the
code's owners". Dated records of what was true on their date were left
as they are; what was corrected is the undated present tense.
`npm test` on its real exit code: 94 files, 1,419 tests, passing before
and after (`tests/surfaceWindRows.test.ts` is the one test that reads a
doc, docs/nws-gust-archive.md, which was not touched).

## Looked at

README.md; CLAUDE.md; data/parity/README.md; every `docs/*.md`
(adsb-receiver, ceiling-heights, ceiling-sky-layout-review,
ceiling-sky-rebuild-review, cloud-cover-sources, cloud-cover-stations,
cloud-forecast-layouts-elsewhere, data-viz-notes, forecast-chances,
kept-forecasts-vs-kpmv, live-checks-tally, lspc-waivered-wind-limits,
markschulze-altitude-reference, nbm-lowest-cloud-base, nws-gridpoint-age,
nws-gust-archive, open-meteo-terms, open-questions, page-counts,
radar-interactive-link, run-split, source-parity,
subsurface-pressure-levels, surface-wind-sources, taf-relay,
usairnet-parity); docs/talks/lincoln-ai-meetup/{README,CONTRACT,claims,review}.md.
Every identifier named in them that is meant to exist was found in
`src/`, `scripts/`, `tests/`, `relay/` or `.github/`, with the
exceptions listed below; every `docs/img/*` file named exists; every
data file named under `data/parity/` exists; the workflow schedules,
retention days, test environment and the CSP's hosts read as the docs
say.

## Corrections (11 documents, 17 edits)

README.md

- Ceiling & sky bullet: "current ceiling + an hourly sky-cover/ceiling
  timeline ... since 2026-10-27 a 'base' row ... Since 2026-11-18 the
  card is one table per local day" (two descriptions, the first stale)
  -> one description of the day tables as `CeilingSkyPanel.tsx` draws
  them (the NBH base and the NBS rows through the relay, blank cells,
  the one "ends" line, `nwsCeilingForecastEnd`), with the dates kept.
- Data health: "an NBM row, since 2026-10-27, names the bulletin cycle"
  -> two rows, "NBM cloud base" (2026-10-27) and "NBM three-day"
  (2026-11-12), the labels in `DataFreshness.tsx`.
- Data-sources table, the relay row: "for the card's three-day block"
  -> "for the card's day tables".
- Abbreviations, NBM: "the 'base' row ... and the card's three-day block
  (since 2026-11-12)" -> the day tables' "NBM base", "NBM %" and
  "NBM ceil" rows (`CeilingSkyDays.tsx`).
- Cross-references, Ceiling & sky: "usairnet ... presents NWS forecast
  data; this dashboard pulls that data directly from the NWS gridpoint
  API instead" -> usairnet's table is the NBM's bulletins
  (docs/usairnet-parity.md), which the card also reads through the
  relay beside the NWS gridpoint, kept apart.

CLAUDE.md

- Winds aloft card's observed line: "(`observedWind`, `observed` prop)"
  -> "(the `observed` prop, drawn as `.wind-observed`;
  `tests/windsObserved.test.ts`)". No `observedWind` exists.

docs/taf-relay.md

- "Within the free plan": "Since 2026-10-27 the card asks the relay
  twice every 10 minutes ... 288 a day ... about 347 pages" -> from
  2026-10-27 twice; since 2026-11-12 three times (`fetchNbs`, same
  refresh, `src/hooks/useWeatherData.ts`), 432 a day, about 231 pages.
- "To turn it off: ... the Ceiling & sky card's base row goes" -> "the
  Ceiling & sky card's NBM rows go, since both bulletins come only
  through the relay".

docs/nbm-lowest-cloud-base.md

- "What it is": "a dash where the bulletin gives none" -> a blank cell
  since 2026-11-18 (a dash until then); "the row is the muted colour the
  card's second forecast (Open-Meteo's cloud cover) already uses" ->
  "nothing on the card colours a figure by its value (one colour per
  source, none per value)".
- Opening line: "a 'base' row under the NWS ceiling" + "(since
  2026-11-18 the 'NBM base' row of its day tables, below)".
- "How it reaches the browser": "The card names the bulletin by its
  cycle" -> Data health names it (the card's note sends the reader
  there; the rebuild review's fix 8 took "19Z cycle" out of the note).

docs/usairnet-parity.md

- "Which layout stays is still hers (docs/open-questions.md)." -> the
  layouts were read on 2026-11-18 and the card became one table per
  local day that day; the four layouts went.

docs/ceiling-heights.md

- "The hourly table's flight category": "The Ceiling & sky card's hourly
  strip prints a dash past the ceiling forecast" -> printed, until
  2026-11-18; the day tables leave the cell blank and name the end in
  one line (`nwsCeilingForecastEnd`).
- "The Ceiling & sky card's horizon": the toggle, `skyHorizonOptions`,
  the strip's "ends from" wording, the units column and the subtitle
  count were in the present tense around a parenthetical saying the
  strip was gone -> past tense, dated to 2026-11-18, with
  `ceilingCoverage` noted as still exported and tested but read by no
  component (finding 1 below). `skyHorizonOptions` no longer exists.

docs/open-meteo-terms.md

- Rate-limit row: "refused for a day twice by requests not this
  repo's" -> twice by 2026-10-31 and five times by 2026-11-19
  (CLAUDE.md; docs/open-questions.md).

docs/page-counts.md

- "Not counted": added the talk page (`public/talk/index.html`, since
  2026-11-11), which carries no count request (grep: no GoatCounter
  reference in it).

docs/ceiling-sky-layout-review.md, docs/data-viz-notes.md,
docs/cloud-forecast-layouts-elsewhere.md

- Each is a reading made on the morning of 2026-11-18 of the strip and
  the four layouts, in the present tense; a dated note under each title
  now says the card was rebuilt later that day (day tables; the strip,
  its toggle, `VITE_THREE_DAY`, `ThreeDayLayout`, `NbsDays.tsx` and
  `crossesDay` gone; figures 0.72 rem), and that the sizes, classes and
  layouts measured below are the card's as it stood that morning. The
  readings themselves were not rewritten. In the layout review, "the
  four three-day layouts the card can be built with" -> "could be".

## Checked and left as they are

- docs/open-questions.md: no name or path in it is wrong. The "Reach
  the NBM's three-day bulletin" section says "Open, hers: which layout
  stays" and then, further down the same section, that the day table
  was built on 2026-11-18 and the layouts went; left, since the section
  is the record of that decision. Its "KOFF's TAF" bullet quotes the
  relay's load as of 2026-10-27 (two paths, 288 a day, 347 pages); the
  current figure is in docs/taf-relay.md above.
- docs/ceiling-sky-rebuild-review.md, docs/run-split.md,
  docs/nws-gust-archive.md, docs/kept-forecasts-vs-kpmv.md,
  docs/surface-wind-sources.md, docs/source-parity.md,
  docs/live-checks-tally.md, docs/forecast-chances.md,
  docs/cloud-cover-sources.md, docs/cloud-cover-stations.md,
  docs/markschulze-altitude-reference.md, docs/subsurface-pressure-levels.md,
  docs/radar-interactive-link.md, docs/nws-gridpoint-age.md,
  docs/adsb-receiver.md, docs/lspc-waivered-wind-limits.md,
  data/parity/README.md and the four talk documents: every name, path,
  flag, label and file checked exists as named; their figures are
  dated readings.
- CLAUDE.md's "`.sky-scroll` got `position: relative`, 2026-10-24" is
  dated and the class still exists (the 10-day outlook's, the TAF's and
  the parity page's scrollers); the Ceiling & sky strip it names is
  gone, as the Ceiling & sky bullet says.
- data/parity/README.md's `surfacewind-<YYYY-MM>` archives exist
  (`surfacewind-2026-10.jsonl.gz`, `surfacewind-2026-11.jsonl.gz`); an
  early `ls | head` here missed them, and nothing was wrong.
- The talk's review.md says the mock's HTML "is not in the repository";
  claims.md (C31) says it is kept beside the image since 2026-11-12, and
  it is. Both are dated 2026-11-12; the review's line was true when
  written and was left.

## Left for the code's owners

1. `src/components/forecastReach.ts:23`, `ceilingCoverage`: exported and
   tested (`tests/skyHorizon.test.ts`) but imported by no component
   since the 2026-11-18 rebuild took the strip's "no ceiling for any of
   these hours" sentence with it. docs/ceiling-heights.md described it
   as the card's; it now says it is unused. The function and its test
   are dead code, the code's owners' to remove or keep.
2. docs/open-questions.md, "KOFF's TAF" (the 2026-10-20 reading's
   Cloudflare bullet): the relay-load figures are the two-path ones.
   Not a code fault; recorded here rather than edited, since the
   section is a dated record and the current figure is in
   docs/taf-relay.md.

No other statement was found where a document is wrong because the
code is.
