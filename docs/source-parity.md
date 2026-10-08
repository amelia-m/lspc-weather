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
| Winds aloft | the table the Winds aloft card shows by default, and the same hour built as his tool builds it ("As Schulze"), both by the app's own request and normaliser | Mark Schulze's Winds Aloft (markschulze.net), the same Open-Meteo data. Since 2026-10-08 the default table also takes the 80, 120 and 180 m winds and seven pressure levels between his, so it differs from his by design; the "As Schulze" table uses his levels below 18,000 ft (see the Schulze reference) | `scripts/schulzeCompare.live.ts` |
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
usairnet's for KPMV, 0.19° east, so the DZ's sun runs about 45 seconds
behind KPMV's and a one-minute gap is the geography. The two-to-four-minute
sunset gap logged on every run to 2026-10-02 was not: the app's own sunset
was 2 to 3 minutes late (a simplified sunrise equation that added 78 s to
solar noon), and it moved to NOAA's method on 2026-10-03.

The winds comparison is made at the **same valid hour** on both sides, since
this card snaps to the nearest hour and Schulze's page shows the hour in
progress. It also records, separately, what a reader looking at both pages at
that minute would see, and whether the two **raw profiles** disagreed — the
sign that one side was served a newer forecast run than the other. The
observation comparison is matched by **observation time** first. When the two
sides show different reports, the run says so and which side was behind, and
the summary keeps those runs out of the decode comparison.

### Why the observation times differ

In the 45 logged runs to 2026-09-26 that printed both times, the two sides
showed different reports in 10, and in all 10 this dashboard was the one
behind, by exactly one report (20 minutes); its report was 39 to 47 minutes
old at the time. usairnet was never the one behind.

One report traced on 2026-09-27, polling both every 30 seconds: KPMV's 13:35Z
report reached usairnet at 13:52Z (17 minutes after it was taken), NWS's own
observation list between 13:52Z and 14:02Z, and the `latest` endpoint this
dashboard reads at 14:03Z (28 minutes). So the delay is api.weather.gov
receiving the report ten minutes or so after usairnet does; its `latest`
endpoint trailed its own list by about a minute. For those minutes of every
20-minute cycle the dashboard shows the previous report. aviationweather.gov,
which the daily sky-parity job also reads, sometimes had a report newer than
both; the browser cannot read it (no CORS). The comparison now logs both times
and NWS's newest listed report on every run, so the page counts this rather
than resting on one trace.

Timed again on 2026-09-27 from a GitHub runner, polling every 20 seconds
through three report cycles (20:55Z, 21:15Z, 21:35Z), minutes after the
report was taken:

| Source | Had the report after | Readable from a browser |
|---|---|---|
| NOAA's raw METAR files (tgftp) | 4 to 5 min | no (no CORS) |
| Iowa Environmental Mesonet | 4 to 6 min | yes |
| aviationweather.gov | 5 to 6 min | no (no CORS) |
| usairnet | 17 to 18 min | no (a page) |
| api.weather.gov | 24 to 33 min | yes |

So from 2026-09-29 the dashboard reads IEM first and keeps api.weather.gov as
the backup, fetches both every 2 minutes rather than every 10, and shows the
newer report (`src/domain/iem.ts`, `src/api/iem.ts`). The comparison logs
which feed served (`ourSource`) and each feed's report time, and the page
keeps the runs since the change apart from the NWS-only runs before it, since
the change was made to move exactly those numbers.

## How the logs are gathered

1. `.github/workflows/comparisons.yml` runs both comparison scripts eight
   times a day, about three hours apart and each scheduled at a different
   minute (01:04, 03:11, 06:19, 09:26, 12:34, 15:41, 18:49 and 21:56 UTC),
   so the samples spread over the day and night and every part of the
   hour; GitHub starts scheduled runs late and sometimes skips one, so the
   minute each sample was taken is in its record, not the schedule.
   `.github/workflows/sky-parity.yml` also runs them once a day, at about
   13:00Z. Runs hours apart time no arrivals (below), short of two landing
   within five minutes of each other. From 2026-09-24 to 2026-10-05 a temporary sampler also ran them.
   From 2026-09-30 it was one job started four times a day that looped for
   five hours, the usairnet comparison every two minutes and the Schulze one
   every four, which is what times each report's arrival at each source
   (below). Before that it timed none: from 2026-09-24 to 26 it was cron
   lines, every fifteen minutes plus five-minute bursts, which GitHub ran
   under ten percent of the time (about 16 samples a day each); from 26 to 28
   it was the looping job, the Schulze comparison every five minutes and the
   usairnet one every fifteen. It became a loop because a job already
   running is not throttled. The workflow and its `scripts/sampleLoop.sh` were removed when
   the window closed; both are in the history.
2. Each run uploads its `@@parity` lines as an artifact named
   `parity-<run id>`, kept fourteen days; the summary takes only those from
   runs on `main`. Every line logged to the end of the
   sampler, 4,391 of them, is archived in
   `data/parity/logs-to-2026-10-05.jsonl.gz`, so its figures outlive the
   artifacts.
3. `.github/workflows/parity-summary.yml` runs when the daily sky-parity
   run finishes, and on demand, so the page takes in a day's comparison
   runs at once: it downloads every unexpired artifact,
   unpacks the archive beside them, combines the lines with
   `scripts/paritySummary.ts` (which drops a record seen twice, so the overlap
   counts once), writes `public/parity/summary.json`, commits it to `main`
   and dispatches the Pages deploy (a push made with the workflow token
   starts no other workflow, so it has to). The arithmetic is in
   `src/domain/paritySummary.ts`, pure and tested.
4. The page fetches `parity/summary.json` from beside the site and renders it.

## What the sampler found

Read from every log to its end, 2026-10-05T01:58Z (the summary of that
morning).

- **Winds aloft, which forecast run.** On the same hour, this card and
  Schulze's were on different Open-Meteo forecast runs (by the script's
  test: two raw levels within 150 ft more than 5° or 2 kt apart) in 114 of
  1,611 comparisons. 81 of the 114 fell between half past and ten to the
  hour, 20 of the 24 UTC hours had some, and they came in 73 short
  stretches, the longest about half an hour. On the same run they agreed to
  a median 0° and 0 kt (largest 12° and 3 kt); on different runs to a
  median 4° and 1 kt (90th percentile 15° and 3 kt). The cause is not
  settled: after half past the comparison reads Schulze's next hour
  (`hourOffset=1`), and the rate is 2.5% on his hour in progress against
  11.4% on his next hour, so the minute and the request change together;
  see `docs/open-questions.md`, "Which forecast run…". The Winds aloft card
  says only what was seen.
- **When each source had each report**, median minutes after the report's
  own time: NOAA's raw file 5, IEM 7, usairnet 18, NWS's observation list 24,
  NWS's `latest` 26. Since the dashboard read IEM first it had the newer
  report every time the two pages differed, 1,378 of 1,378, by a median 20
  minutes (one report cycle).
- **The decode, same report.** Wind gust, direction, visibility, pressure,
  clouds and ceiling agreed on every report each row counts. Flight rule
  (1,203 of 1,205) and wind speed (1,204 of 1,205) count from the first log,
  and their three disagreements, flight rules at 2026-09-26T21:27Z and
  2026-09-27T07:41Z and a wind speed at 2026-09-27T19:45Z, came before the
  first parser correction (2026-09-30). Temperature and dew point differ by
  at most 1 °F, from rounding, on about half of reports, and the humidity
  derived from them by up to 5 points (on the 1,203 of 1,205 that logged
  the size of a difference). Sunrise and sunset agree to the
  minute on 420 of 441, at most 2 minutes apart.
- **usairnet's page** could not be read on 83 samples in 6 stretches, the
  longest 13:12 to 15:31Z on 2026-09-30. This dashboard's own feeds failed on
  none.

## What the page shows, and what it deliberately does not

It opens with **At a glance**: four sentences computed from the summary, each
a figure from a section below. How far apart the winds tables were on the
same hour and forecast run (median and largest); how many observation fields
agreed on every same-report run, and how far the others ran; how often this
dashboard had the newer report since it read IEM first; and the median
minutes from a report to each source. They move with the summary and carry no
judgement.

Then the winds differences **by the time the two tables represent**: same
hour on the same forecast run, same hour with one side on a newer run, and
one hour apart as the two pages show it after half past. Each is pooled over
every row from 1,000 ft up (the surface row differs for its own reason) and
given as the average, median, 90th-percentile and largest difference in
direction and speed. The one-hour row fills only from samples logged since 2026-09-26, when
the comparison started recording every row of the as-seen tables; before
that it kept only the worst row. A one-off measurement of how the difference
grows with larger gaps is in `docs/markschulze-altitude-reference.md`.

Then, for each row of the winds table, per altitude: the **average, median,
90th-percentile, smallest and largest** absolute difference in direction and
in speed across runs, and the number of runs. Then counts: runs with any row
more than 10° or 3 kt apart; runs where the raw profiles disagreed; runs where
the two pages showed different hours at that minute, and how large that
difference was; and the ground row on each side, with the ratio between them.

**The ground row** gets its own section: why the two Surface rows are
different heights (this dashboard's the model's 10 m wind, Schulze's a line
through the pressure levels read at 0 ft, matched in 72 of 72 hours at four
sites on 2026-10-03; `docs/markschulze-altitude-reference.md`), and a table
of both rows by the drop zone's local time of the forecast hour, in
three-hour blocks, with the median of each run's own difference
(`groundByLocalHour`). A run is placed by the hour it compared, not the
minute it sampled. It is the count behind the Winds aloft card's note that
Schulze's row reads higher most of all at night: on the logs to 2026-10-03 the
median gap was 3 kt from 9 PM to midnight and under 1 kt from 9 AM to 6 PM.
A second table gives the same by local day (`groundByLocalDay`): over every
run summarised, Schulze's median went from about 6 kt in late September to 8
kt by 2026-10-02 while this dashboard's stayed near 6, and one median cannot
show which days the gap opened on.

For the observation, two tables that are never pooled: runs where both sides
showed the same observation (a decode comparison), and runs where they
showed different ones, usually a report apart (mostly the weather changing
between two reports). Per field, each gives how many runs agreed, and the
average, smallest and largest gap in that field's own unit where both sides
gave a number. The fields sit under headings in the order a report is read
(surface wind, sky and visibility, temperature and moisture, pressure, sun),
and a field the page does not know goes under "Other". Under the
same-report table, **known reasons a field differs**: the 1 °F rounding of
temperature and dew point, humidity worked out from each side's own figures,
and the sun times being KPMV's on usairnet and the drop zone's here. A
reason is shown only for a field that did differ, and where the largest gap
is bigger than the reason accounts for (more than 1 °F, or more than a
minute for the sun) the line says so, so it cannot pass for an explanation
of a gap it does not cover. Above them: which side had the newer report when the times
differed, how far apart the two reports were, and, when this dashboard was
the one behind, whether NWS's own observation list already held the newer
report (so the `latest` endpoint the dashboard reads had not caught up) or
not (so the report had not reached NWS yet). Runs since the dashboard read
IEM first are counted apart from the NWS-only runs before.

Also for the observation: **how soon each source had each report**, in
minutes from the report's own time to the first sample that found it at
NOAA's raw file, IEM, usairnet, NWS's observation list and NWS's `latest`.
A report is timed at a source only where the sample before had not found it
and was at most five minutes earlier, so the figure is at most one sampling
interval (two minutes) late and never early; the hour between sampler
batches and the hours between comparison runs time nothing, so these
figures come from the sampler's archived logs and since then grow only when
two runs happen to land within five minutes (a late start beside the next
one, or a run dispatched by hand)
(`arrivalLags`, `MAX_ARRIVAL_BRACKET_MIN`).

And **runs that could not read one side**: usairnet's page (unreachable or
unparsed) apart from this dashboard's own feeds, with the number of unbroken
stretches of usairnet failures and the longest (`outagesOf`). Failures join
a stretch only when consecutive samples are at most five minutes apart, so
the hour between sampler batches never merges two. To the end of the
sampler that was 83 failures in 6 stretches, the longest 72 samples on
2026-09-30, from 13:12 to 15:31Z.

Some rows count only records from the version of the comparison that
corrected them (`FIELD_SINCE_VERSION`); older records are kept and those
rows skip them. Temperature and clouds count from 2026-09-30 (`v: 2`):
before then the comparison misread usairnet's page for present weather in
its heading and for every overcast layer ("Solid Overcast"). Wind
direction, visibility, sunrise and sunset count from 2026-10-03 (`v: 3`):
before then it misread gusting winds (no direction), compared a calm
wind's 0° from NWS against usairnet's none, read fractional visibility
("1 1/4 Miles") as none, and compared a north wind's 360° as text against
the page's "0° North"; and the app's own sunrise and sunset were up to 3
minutes late. After those fixes, on 2026-10-02's data, no row compared on
the same report showed a decode difference between this app and usairnet
beyond the 1 °F rounding of temperature and dew point.

Then a **timeline of what changed and what it did to the figures**
(`src/components/ParityTimeline.tsx`): each dated change labelled as a change
to the dashboard (it moved how far the dashboard is from the other source),
a change to the comparison (it moved how well that is measured), or an
event such as an outage, with the before and after figures logged at the
time or dated where they come from a later summary. The label is the point:
clouds going from 72 of 120 to 576 of 576 agreeing was the comparison
learning usairnet's wording, not the dashboard decoding the sky better, and
a reader of the figures alone could not tell the two apart.

Last, **Context: checks made by hand**: the measurements made once while
reading the logs, each dated and linked to its write-up, and copied from it
rather than recomputed, so a repeated check changes the write-up first. How
the winds gap grows with the hours between the two tables (2026-09-26,
`docs/markschulze-altitude-reference.md`); which hour each table shows (this
dashboard the nearest, so at most 30 min from now and 15 on average;
Schulze's the hour in progress, up to 59 min behind and 30 on average); the
per-site evidence for Schulze's Surface row (2026-10-03); the sunset this
dashboard gave before it moved to NOAA's method, against NOAA, astral,
Open-Meteo and usairnet, and the 56-of-56 USNO check after; and the
comparison's own misreadings that `FIELD_SINCE_VERSION` now leaves out, with
the counts logged when each was found. One of those counts is recorded
only here: clouds agreed on 72 of 120 same-report runs to 2026-09-29, while
the comparison wrote OVC as "Overcast" against usairnet's "Solid Overcast",
and on 576 of 576 to 2026-10-02 after.

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
- `schulze.overCauses` (from 2026-10-08): the same-hour runs with a row over
  10° (`dir`) or 3 kt (`spd`), split by cause, the four adding up to
  `runsWithRowOver10Deg` / `runsWithRowOver3Kt`: `surfaceOnly` (only the
  Surface row, which is a different height on each side), `newerRun` (a row
  from 1,000 ft up, with one side on a newer forecast run), `sameRunAloft`
  (a row from 1,000 ft up on the same run: no known cause) and
  `unjudgedAloft`. Over the logs to 2026-10-08: 502 runs over 10° were 431,
  70, 1 and 0; 389 over 3 kt were 345, 44, 0 and 0.
- `schulze.byTimeGap[]`: one entry per time group (`same-hour-same-run`,
  `same-hour-different-run`, `one-hour-apart`), with the runs that
  contributed rows and the pooled `dir` and `spd` spreads from 1,000 ft up.
  A same-hour run whose raw profiles could not be judged is in neither
  same-hour group. Absent in summaries written before 2026-09-26.
- Schulze records carry `dz`, the point both sides were read at, from
  2026-10-08, when `SITE.dz` moved from the field south-west of the runway
  (40.8675, −96.11; records without `dz`) to the landing area by the pea
  gravel. The summary pools both; Open-Meteo's ground is 1,145 ft at the
  first and 1,165 ft at the second, which moves the Surface row's source
  and the datum gap between the two tables.
- `schulze.ground` and the two breakdowns below compare the ground rows in
  whole knots, as both pages show them (`groundKt`): the card's Surface row
  where the record carries it (`ourShownKt`, from 2026-10-08), the logged
  10 m wind rounded where it does not. Summaries written before 2026-10-08
  compared a tenth on this side with whole knots on his.
- `schulze.ground.medianRatio`: Schulze's ground speed over ours in knots.
  It runs near 1.2, not the 1.85 a km/h value read as knots would give; the
  difference is the two rows' heights (`docs/markschulze-altitude-reference.md`).
- `schulze.groundByLocalHour[]`: eight three-hour blocks of the drop zone's
  local day (`fromHour` 0 to 21), each with the runs whose forecast hour fell
  in it, the median of each side's ground row, and the median of Schulze's
  minus ours per run. Absent before 2026-10-03.
- `schulze.groundByLocalDay[]`: the same by the drop zone's local `date`
  ("2026-10-02") of the forecast hour, oldest first. Absent before
  2026-10-03.
- `usairnet.fieldsSameReport` and `usairnet.fieldsDifferentReport`: the two
  field tables. `spread` is null for text fields, and for runs logged before
  gaps were recorded (2026-09-24). Summaries written before 2026-09-27 carry
  one pooled `usairnet.fields` instead.
- `usairnet.timing`: runs with different observation times, how many logged
  both times (from 2026-09-27), which side was newer, the gap in minutes
  (signed, dashboard minus usairnet), and the two dashboard-behind cases.
- `usairnet.outages`: `theirs` (usairnet's page could not be read or did
  not parse) and `ours` (neither of the dashboard's feeds could be read),
  the number of unbroken `stretches` of usairnet failures, and the
  `longest` one's first and last sample times and its sample count. Absent
  before 2026-10-03.

## Running a comparison by hand

```
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
  npx vitest run --config vitest.live.config.ts \
  scripts/schulzeCompare.live.ts scripts/usairnetCompare.live.ts
```

From the sandbox that needs the proxy environment above; from anywhere else,
plain `npx vitest run --config vitest.live.config.ts <script>`. To rebuild the
summary locally from a log: `npx tsx scripts/paritySummary.ts <files.jsonl>`.
