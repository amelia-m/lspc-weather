# Which run: a sampler to separate the two causes

> Open-Meteo figures in this document are weather data by
> [Open-Meteo.com](https://open-meteo.com/), under
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), reworked as
> the document describes (set against other sources, counted,
> differenced or interpolated). See [open-meteo-terms.md](open-meteo-terms.md).

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

`.github/workflows/run-split-sample.yml` ran `scripts/runSplit.live.ts`
every four minutes (`scripts/runSplitLoop.sh`) from 2026-10-23T05:34Z to
2026-10-27T06:00Z; both files were deleted when the window ended, and are
in the history. Each sample did three things:

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

## What the sample found, 2026-10-27

1,291 samples, 2026-10-23T05:34Z to 2026-10-27T05:59Z, archived as
`data/parity/runsplit-2026-10-23-to-2026-10-27.jsonl.gz` (one `@@parity`
line per sample, the artifacts' lines deduplicated by their time). The
tables below are `npx tsx scripts/runSplitSummary.ts` on that file.
Open-Meteo answered 1,280 samples with both app requests and his endpoint
1,201 (82 samples could not read his tool, 71 of them on the first day);
a side that was not read is not counted. GitHub started the five-hourly
job late four times, so the run has gaps of five hours on the 23rd from
10:15Z, four and a half on the 26th from 15:54Z, four on the 27th from
01:15Z and an hour and a half on the 26th from 09:37Z, and about 1,300
samples of a possible 1,440.

**His request does not matter; the minute does.** The table that decides,
his table against the app's first request:

| his request | minutes 0–29 | minutes 30–59 |
|---|---|---|
| hour in progress | 9 of 583 (1.5%) | 36 of 618 (5.8%) |
| next hour | 7 of 583 (1.2%) | 34 of 618 (5.5%) |

The two rows are the same within a few readings, in both halves of the
hour, so his next-hour request (`hourOffset=1`) is not the cause: the
comparison's 11.4% on that request was the second half of the hour, which
is the only time it made it. And where his table was on a different run
from the app's, it was at both his hours together in 35 samples and at one
only in 16.

By ten-minute band, with the app's two requests a moment apart set
against each other:

| from minute | hour in progress | next hour | app against itself |
|---|---|---|---|
| 0 | 3 of 181 (1.7%) | 3 of 181 (1.7%) | 6 of 394 (1.5%) |
| 10 | 4 of 213 (1.9%) | 3 of 213 (1.4%) | 1 of 456 (0.2%) |
| 20 | 2 of 189 (1.1%) | 1 of 189 (0.5%) | 2 of 398 (0.5%) |
| 30 | 17 of 210 (8.1%) | 14 of 210 (6.7%) | 25 of 454 (5.5%) |
| 40 | 11 of 189 (5.8%) | 12 of 189 (6.3%) | 15 of 398 (3.8%) |
| 50 | 8 of 219 (3.7%) | 8 of 219 (3.7%) | 13 of 460 (2.8%) |

**The app disagrees with itself in the same minutes.** Two requests of
this app's own, a median 0.6 s apart (`apartS`), were on different runs
in 5.5% of samples from :30 and 3.8% from :40, against 0.2% to 1.5%
before half past. No request of his tool's is involved in that count, so
Open-Meteo's servers themselves answer with different runs moments apart
at those minutes. Of the 86 pairings where his table and the app's first
answer differed, his matched the app's second answer in 36: the app's own
first request was the odd one out, not his table. In 22 of the 51
mismatched samples the app disagreed with itself in the same sample.

**It is when HRRR arrives.** The metadata reads saw 88 HRRR runs become
available, 58 of them with two availability times for the same run, about
ten minutes apart, one per copy of the data. By the minute of the hour
they became available:

| from minute | arrivals |
|---|---|
| 0 | 4 |
| 10 | 4 |
| 20 | 46 |
| 30 | 42 |
| 40 | 32 |
| 50 | 20 |

140 of the 148 arrivals fell between :20 and :59, the initialisation
about 96 minutes earlier (88 to 149). The mismatches sit in the same
minutes, a band later: the first copy of a run arrives from :20, the
second about ten minutes after, and the ten minutes after each copy are
when a request can land on either. Counted directly, by minutes since the
newest HRRR run the reads saw became available (both his hours):

| since the newest run | different runs |
|---|---|
| under 15 min | 35 of 640 (5.5%) |
| 15 to 30 min | 19 of 624 (3.0%) |
| 30 to 60 min | 16 of 886 (1.8%) |
| 60 min or more | 16 of 250 (6.4%) |

and by whether the three reads of HRRR's `meta.json` made during the
sample disagreed with each other, the copying caught in the act:

| reads | his table against the app's first | app against itself |
|---|---|---|
| agreed | 27 of 1,060 (2.5%) | 14 of 1,206 (1.2%) |
| disagreed | 59 of 1,340 (4.4%) | 48 of 1,350 (3.6%) |

Both point the same way, and neither is clean. The "60 min or more" band
is the late runs (the newest run any read saw was an hour or more old in
250 pairings, 126 samples), and 16 of its pairings mismatched; what the
reads saw is only the copies that answered, so a run arriving on a copy
the reads did not reach is in that band, not the first. GFS's arrivals do
not explain them: in the 126 samples only 8 had a GFS 0.25° run under 15
minutes old, and set by GFS run age the mismatches were 2 of 136 under 15
minutes. The reads disagreed in more than half of all samples (1,340 of
2,400 pairings), so "disagreed" is most of the time, not a rare moment.

**The disagreements are short and small.** The mismatched samples came in
38 stretches, the longest 3 samples (about 8 minutes), shorter than the
half-hour stretches the 2026-09-30 sampler saw. On different runs the
largest gap at a paired level was a median 14° and 2.7 kt (90th percentile
49° and 4.1 kt); on the same run a median 0° and 0.5 kt (largest 36° and
3.7 kt, which is what the rule's margins absorb).

**What this settles and what it does not.** The second explanation in
"The question" above is the one: a new HRRR run reaches Open-Meteo's
servers one copy at a time, between about :20 and :59, and for some
minutes after each copy a request can get the new run or the old one,
whichever server answers. His tool's next-hour request has no part in it.
What the sample cannot say is whether his tool adds anything of its own:
in 50 of the 86 pairings his table differed from both of the app's
answers, which is either his request landing on the other copy or his own
cache holding an older answer, and the records cannot tell those apart.
Nor is the 6.4% in the oldest run-age band explained. Both are counts to
keep, not questions worth another sampler: the dashboard is not affected
beyond what the Winds aloft card already says, and nothing in it is a
flag.

## Archived

`data/parity/runsplit-2026-10-23-to-2026-10-27.jsonl.gz`, the records
above; `scripts/runSplitSummary.ts` reads it. Do not name an archive of
this kind `metar-*` or anything `*logs-*`: the weekly ceiling refresh
reads the first, and the daily parity summary reads every
`*logs-*.jsonl.gz`.
