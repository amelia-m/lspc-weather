# The comparison logs and the "How different from other sources" page

Two pages sit beside the dashboard, both reached from its footer:

- **Citations to verify** (`#citations`) — every USPA, CFR and FAA claim the
  dashboard makes, what the cited section says and when it was read, and the
  questions a rated instructor or S&TA is asked to settle. Answers are entered
  on the page and leave as a prefilled GitHub issue or copied text. See the
  README's "Citations" section and `src/config/citationsChecklist.ts`.
- **How different from other sources** (`#parity`) — what the scheduled
  comparison logs add up to. This document is about that page and the
  pipeline behind it.

## What is compared

| comparison | this dashboard's side | the other side | script |
|---|---|---|---|
| Winds aloft | the table the Winds aloft card shows, built by the app's own request and normaliser | Mark Schulze's Winds Aloft (markschulze.net), the same Open-Meteo data at the same thirteen pressure levels | `scripts/schulzeCompare.live.ts` |
| Latest observation | the app's decode of the latest KPMV report (api.weather.gov → `normalizeNwsObservation`) | usairnet's decode of the same report, scraped from its KPMV page | `scripts/usairnetCompare.live.ts` |
| Sunrise and sunset | the app's computed times at the DZ (`sunTimes`), which the night-jump flag hangs on | usairnet's sun almanac for KPMV, on the same page | `scripts/usairnetCompare.live.ts` |
| METAR sky groups | the app's parse of the METAR text | aviationweather.gov's decoder | `scripts/skyParity.live.ts` (a gate: fails on disagreement) |
| Flight category | the app's derived VFR/MVFR/IFR/LIFR | aviationweather.gov's `fltCat` for the same report | `scripts/skyParity.live.ts` (a gate, when both give a category) |
| TAF shown | the TAF text the card shows, from the NWS text-products feed, first station in the chain with a product | the current TAF aviationweather.gov has for that station | `scripts/skyParity.live.ts` (informational: says whether the card's issuance is the current one) |
| TAF decode | `decodeTaf` run on aviationweather.gov's own TAF text for every station in the chain: change type, period times, wind, visibility, weather, cloud layers per period | the `fcsts` decode aviationweather.gov returns beside that text | `scripts/skyParity.live.ts` (gate: any difference fails the run) |

The Schulze and usairnet scripts print a human-readable table and one
machine-readable line, `@@parity {json}`, per run. Neither ever fails a run:
they are reports, and the other side is a third-party page that can change or
lag. The sky-parity script is different: its sky-group and flight-category
comparisons are gates that fail the daily run and open an issue, because the
other side there is aviationweather.gov's decoder and a disagreement means the
app's own parse or derivation is wrong. Its TAF freshness line is informational; its TAF decode comparison is a gate.

The sun almanac rows compare the app's sunrise and sunset at the DZ with
usairnet's for KPMV, 0.19° east, so a gap of a minute is the geography; on
2026-09-24 the app read one minute later at sunrise and two at sunset.

The winds comparison is made at the **same valid hour** on both sides, since
this card snaps to the nearest hour and Schulze's page shows the hour in
progress. It also records, separately, what a reader looking at both pages at
that minute would see, and whether the two **raw profiles** disagreed — the
sign that one side was served a newer forecast run than the other. The
observation comparison is matched by **observation time** first; when usairnet
is a report behind, the run says so rather than comparing two reports.

## How the logs are gathered

1. `.github/workflows/schulze-compare.yml` is one job, started four times a
   day, that loops for five hours: the Schulze comparison every five minutes,
   the usairnet one every fifteen (`scripts/sampleLoop.sh`). It runs until
   2026-09-28T02:00Z, then skips itself and should be deleted. It replaced a
   cron line per sample, which GitHub ran under ten percent of the time.
   `.github/workflows/sky-parity.yml` runs both scripts once a day for good.
2. Each run uploads its `@@parity` lines as artifacts named
   `parity-<run id>` (the daily run) or `parity-<run id>-<hour>` (one per
   hour of the sampler), kept fourteen days.
3. `.github/workflows/parity-summary.yml` runs every three hours and on
   demand: it downloads every unexpired artifact, combines the lines with
   `scripts/paritySummary.ts`, writes `public/parity/summary.json`, commits it
   to `main` and dispatches the Pages deploy (a push made with the workflow
   token starts no other workflow, so it has to). The arithmetic is in
   `src/domain/paritySummary.ts`, pure and tested.
4. The page fetches `parity/summary.json` from beside the site and renders it.

## What the page shows, and what it deliberately does not

First, the winds differences **by the time the two tables represent**: same
hour on the same forecast run, same hour with one side on a newer run, and
one hour apart as the two pages show it after half past. Each is pooled over
every row from 1,000 ft up (the surface row differs for its own reason) and
given as the average, 90th-percentile and largest difference in direction and
speed. The one-hour row fills only from samples logged since 2026-09-26, when
the comparison started recording every row of the as-seen tables; before
that it kept only the worst row. A one-off measurement of how the difference
grows with larger gaps is in `docs/markschulze-altitude-reference.md`.

Then, for each row of the winds table, per altitude: the **average, median,
90th-percentile, smallest and largest** absolute difference in direction and
in speed across runs, and the number of runs. Then counts: runs with any row
more than 10° or 3 kt apart; runs where the raw profiles disagreed; runs where
the two pages showed different hours at that minute, and how large that
difference was; and the ground row on each side, with the ratio between them.
For the observation: per field, how many runs agreed, and the average,
smallest and largest gap in that field's own unit where both sides gave a
number.

Medians and percentiles sit beside the averages because one stale-forecast
run puts a 40° outlier into a row that is otherwise within 2°; an average
alone would report 6° for a row that has never been 6° off.

The page states counts and spreads. It does not call a source right or wrong,
and it attaches no colour or word to any figure: a test rejects verdict words
and warning classes. Where the cause of a difference is known, it is written in
`docs/markschulze-altitude-reference.md`; where it is not, it is an open
question in `docs/open-questions.md`.

## Reading a summary

- `from`/`to`: the span of runs summarised; `generatedAt`: when.
- `schulze.byAltitude[].dir` and `.spd`: the spreads above; `mean` is signed
  (dashboard minus Schulze), so its sign says which side ran higher.
- `schulze.rawMismatch`: how many runs could be judged, and how many disagreed.
- `schulze.byTimeGap[]`: one entry per time group (`same-hour-same-run`,
  `same-hour-different-run`, `one-hour-apart`), with the runs that
  contributed rows and the pooled `dir` and `spd` spreads from 1,000 ft up.
  A same-hour run whose raw profiles could not be judged is in neither
  same-hour group. Absent in summaries written before 2026-09-26.
- `schulze.ground.medianRatio`: Schulze's ground speed over ours in knots.
  A ratio near 1.85 across many runs would support the reading that his
  figure is a km/h value taken as knots; that reading is unconfirmed.
- `usairnet.fields[].spread`: null for text fields, and for runs logged before
  gaps were recorded (2026-09-24).

## Running a comparison by hand

```
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
  npx vitest run --config vitest.live.config.ts \
  scripts/schulzeCompare.live.ts scripts/usairnetCompare.live.ts
```

From the sandbox that needs the proxy environment above; from anywhere else,
plain `npx vitest run --config vitest.live.config.ts <script>`. To rebuild the
summary locally from a log: `npx tsx scripts/paritySummary.ts <files.jsonl>`.
