# Which run: a sampler to separate the two causes

Started 2026-10-23, at the maintainer's request. It addresses the open
question "Which forecast run the winds-aloft request is served"
(docs/open-questions.md).

## The question

For the same hour, the Winds aloft table and Mark Schulze's sometimes come
from different Open-Meteo forecast runs. The comparison saw it in 114 of
1,611 same-hour readings to 2026-10-05. The rate was 2.5% when it read his
hour in progress and 11.4% when it read his next hour. But it reads his
next hour only after half past, because the card snaps to the nearest hour.
So two things always changed together:

- **his next-hour request** (`hourOffset=1`). Something about it, such as
  his own caching, would cause this whatever the minute;
- **the time of the clock.** A new run reaches Open-Meteo's servers at
  different moments while it is copied (its model-updates page; HRRR
  availability times two minutes apart on reads a second apart,
  2026-10-21). That would cause this at certain minutes, whichever hour is
  asked for.

The run metadata logged with each comparison since 2026-10-21 (`omRuns`,
`scripts/runAge.ts`) tests the second, but the comparisons run about nine
times a day. To 2026-10-22 that was 9 judged comparisons, 2 flagged, too
few to read.

## The sampler

`.github/workflows/run-split-sample.yml` runs `scripts/runSplit.live.ts`
every four minutes (`scripts/runSplitLoop.sh`) until 2026-10-27T06:00Z.
Each sample does three things:

- **Both of his hours, every minute.** It asks his endpoint for offset 0
  and offset 1 at once, at every minute of the hour. Each is set against
  this app's Open-Meteo answer for the same valid hour. One request holds
  both hours (`normalizeOpenMeteoHours`).
- **Two app requests a moment apart.** The second starts as soon as the
  first has answered, about a second later, whatever his endpoint is
  doing (`apartS` records the gap). Both are set against his
  table and against each other. If the app's two requests disagree, the
  servers answered with different runs moments apart, and his tool had no
  part in it.
- **Run metadata.** Three reads each of HRRR's and GFS 0.25°'s
  `meta.json`, as the comparison makes (`runMeta`, `scripts/schulzeFetch.ts`).

"Different runs" is the comparison's rule, unchanged and now shared
(`rawGap`, `src/domain/runSplit.ts`). Raw levels are paired within 150
ft, and the profiles count as different runs when at least two of three
or more pairs are more than 5° or 2 kt apart. It is a heuristic:
Open-Meteo's responses name no run. Records are `@@parity` lines with
`kind: 'runsplit'`, uploaded as `runsplit-*` artifacts kept 30 days. The
`#parity` summary does not read them.

**Load.** Each sample asks his endpoint twice and Open-Meteo's forecast
twice: about 720 of each a day. That is the pace the 2026-09-30 sampler
asked his endpoint at for five days. The three days and a bit give about
1,200 samples. Each gives one judgement for each of his two hours, so each
cell of the table below gets about 600.

## How to read it

```
npx tsx scripts/runSplitSummary.ts runsplit-*.jsonl
```

The table that decides, his request by half of the hour, against the
app's first request:

| | minutes 0–29 | minutes 30–59 |
|---|---|---|
| hour in progress | a | b |
| next hour | c | d |

- **A next-hour cause:** c and d high, a and b low. The minute does not
  matter; his next-hour request does.
- **A clock cause:** b and d high, or both rows high in the same ten-minute
  bands, and the app's two requests disagreeing in those bands too.
  `firstWasOddOneOut` counts the mismatches where his table matched the
  app's second answer. Those are the app's own first request landing on
  the other run.
- **Both, or neither:** the bands and the run-age table (minutes since the
  newest HRRR run became available) say where to look next.

## First samples, 2026-10-23

From the sandbox, before the workflow ran. Four samples at minutes 20 to
23, about 05:20Z. On both offsets, his raw levels and the app's agreed at
all 10 paired heights, within 1° and 0.5 kt. The app's two requests,
0.8 to 1 second apart, agreed with each other. The existing comparison,
run again after its fetches and its rule moved to the shared modules, gave
`rawMismatch: false` as before.

## When the window ends

Download the `runsplit-*` artifacts. Archive the records under
`data/parity/`. Do not name them `metar-*` or anything `*logs-*`: the
weekly ceiling refresh reads the first, and the daily parity summary
reads every `*logs-*.jsonl.gz`. Summarise them here and in docs/open-questions.md, and
delete the workflow and the loop script.
