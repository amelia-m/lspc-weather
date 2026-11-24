# Code review, 2026-11-20: the operational code

A reading of the workflows, the scripts they run, the relay and the tests
that exercise the scripts, against CLAUDE.md's description of each
("Gates"). Nothing under `src/` was changed; a finding that lives there is
written down instead. One bug was fixed; the rest is listed in order of
weight for the maintainer.

## What was looked at

- `.github/workflows/*.yml`: ci, deploy, live-site, sky-parity,
  comparisons, parity-summary, forecast-keep, surface-wind-sample,
  ceiling-data-refresh, cloud-cover-fetch. Each read against the script it
  runs and the CLAUDE.md paragraph on it, with GitHub's `shell: bash`
  defaults in mind (`bash -eo pipefail`, so an unguarded failing command
  or pipeline ends the step).
- `scripts/`: the two loops (`surfaceWindLoop.sh`, `forecastKeepLoop.sh`),
  `renderTalk.sh`, `liveFetch.ts`, `liveIssue.ts`, `liveSite.ts` (the
  load loop), the archive scripts (`parityArchive.ts`,
  `surfaceWindArchive.ts`) and `paritySummary.ts`, `forecastKeep.ts`,
  the live checks (`skyParity`, `simText`, `pilotLinks`), the comparison
  and sampler scripts' fetch paths (`schulzeFetch.ts`,
  `usairnetCompare.live.ts`, `surfaceWindCompare.live.ts`,
  `runSplit.live.ts`), `cloudCoverFetch.py`'s `get`, and
  `vitest.live.config.ts`.
- `relay/src/*` and `wrangler.toml`.
- `tests/liveFetch.test.ts`, `tests/liveIssue.test.ts`,
  `tests/nbmRelay.test.ts`, `tests/tafRelay.test.ts`,
  `tests/parityArchive.test.ts`.
- Two of the parity summary's recent runs on GitHub (read only: run
  44396489802 of 2026-11-18 and 44614920278 of 2026-11-19), and the
  repository's artifact count, for the figures under finding 2.

The main checkout held uncommitted work on `scripts/liveFetch.ts`,
`src/domain/liveIssue.ts`, their tests, `parity-summary.yml` and two docs
(the connection-reset retry and the rebase-before-push, both dated
2026-11-19) when this review started. This worktree is on `main` at
7beb354, without them; none of those files was changed here, so the two
land without conflict. Two notes on that pending work are under finding 5.

## Fixed

### 1. The sky-parity issue step commented on the wrong issue when the label was refused

`.github/workflows/sky-parity.yml`, the "Open or update an issue per
failed check" step. Since 2026-11-03 a label GitHub refuses (that day a
422 on a long description) no longer kills the step: `labelArgs` is
emptied and the issue is opened without it. But the search for an open
issue of that check used the same array:

```
existing=$(gh issue list "${labelArgs[@]}" --state open --json number --jq '.[0].number // empty')
```

With `labelArgs` empty that is `gh issue list --state open`, every open
issue in the repository, and `.[0]` is the newest of them, whatever it is:
a live-site issue, another check's, one of the maintainer's. The step then
ran `gh issue comment` on it, and the check's failure went in as a comment
on an unrelated issue, with the run reporting success.

Shown by running the step's own shell (extracted from the YAML with
PyYAML, so it was the step's text and not a copy) in a scratch directory
with a stub `gh` on PATH whose `label create` exits 1 and whose
`issue list` answers as the real one does through its `--jq`: nothing for
a `--label` search (no open issue of that check), `42` for a search with
no label (the newest open issue of any kind). `scripts/liveIssue.ts` ran
for real on a one-failure report. Before the fix the calls were
`label create`, `issue list --state open`, `issue comment 42`. After it:
`label create`, `issue create --title "Sky decode parity: …"`. With the
label step passing, the search runs as before (`issue list --label
sky-parity --state open`, then `issue create … --label sky-parity`).

The fix: `existing` is searched for only while `labelArgs` holds the
label; without it a new issue is opened. The live-site step
(`live-site.yml`) has no such branch because it does not guard its label
step at all; see finding 6.

## Left for the maintainer, heaviest first

### 2. The parity summary downloads every surface-wind artifact every day, and the pile is growing

`.github/workflows/parity-summary.yml`, "Archive the surface-wind
sampler's records no archive holds yet" (lines 100-123): it lists every
unexpired `surfacewind-*` artifact from `main` and fetches each one with
its own `gh api …/zip` call, then archives the records no archive holds.
Since 2026-11-10 the sampler uploads one artifact per sample (eighteen a
run, about 85 a day), kept 30 days. Read from the runs:

- 2026-11-18: 1,100 surface-wind artifacts downloaded in 13 min 50 s
  (the step from 21:00:17Z to 21:14:07Z), 173 records added; two
  downloads failed on a `gh: HTTP 503` and were not retried ("could not
  fetch"), which the dedup heals the next day.
- 2026-11-19: 1,165 downloaded, 166 added, then the push was rejected
  (the case the pending rebase fix covers).
- 2026-11-20 at 01:35Z the repository held 1,396 artifacts in all.

The pile stops growing when the first per-sample artifacts expire, about
2026-12-10, at roughly 2,500 surface-wind artifacts: about 30 minutes of
downloads a day, of which all but the newest day's are already archived.
Three things follow:

- GitHub documents the `GITHUB_TOKEN` rate limit as 1,000 requests per
  hour per repository (docs.github.com, "Rate limits for the REST API",
  read 2026-11-20). The 2026-11-19 run made about 1,300 (1,165 zips plus
  127 parity zips plus the listing's pages) inside sixteen minutes and
  met no 403, so either the zip redirect is not counted or the limit is
  looser than documented; at 2,500 a day it may bite, and it would show
  as a run of "could not fetch" lines, not as a failed step
  (`continue-on-error: true`).
- The artifact listing is not in creation order (the first page on
  2026-11-20 ran 01:32Z, 00:56Z, 01:15Z), so if downloads start failing
  part-way, which ones are lost to that day is arbitrary. The dedup
  recovers them on a later day as long as the artifact lives, so a
  record is lost only if every daily run for thirty days misses it.
- The step has no `timeout-minutes`; the job's default is 360.

The small change, if wanted: have the listing's `--jq` keep only
artifacts created in the last N days (`select(.created_at > $since)` with
`since` from `date -u -d '-7 days'`); with the daily run and the dedup, a
record is then lost only after seven missed days, and a by-hand run with
a wider window recovers anything inside the thirty. The maintainer's
rule of 2026-10-30 is that the sample is not to be time-boxed or
deleted without asking, and this window changes what the daily archive
guarantees, so it is a call, not a fix. Not changed here.

### 3. The parity summary swallows a failed artifact listing and publishes a thinner summary

`parity-summary.yml` lines 68-70: `gh api --paginate … > artifacts.txt
|| true`. If the listing fails (or a later page of it does; `--paginate`
writes what it got), the step prints "downloaded 0 artifacts" and goes
on: the archive step says "no artifacts to archive" and exits 0, the
summary is built from `data/parity/` alone, which runs to the day
before, and the thinner summary is committed and deployed with a green
run. The next good day puts it back. The surface-wind listing (line
107-109) has the same `|| true`, under `continue-on-error`. Not changed:
the parent session has this file open for the rebase; the one-line change
is to drop `|| true` on the first listing, so a listing that fails fails
the run, since every later step is self-healing but the commit is not.

### 4. The artifact names of sky-parity and comparisons carry no run attempt

`sky-parity.yml` line 287 and `comparisons.yml` line 418 name the
artifact `parity-${{ github.run_id }}`; `surface-wind-sample.yml` names
its own `surfacewind-<run id>-<attempt>-<slice>`. With upload-artifact
v4 an artifact name must be unique within a workflow run, and a re-run
of a job whose first attempt uploaded one would, as I recall its README,
fail the upload with a 409. In sky-parity that is the step after the
checks, so re-running a run that failed on a transient fetch would turn
a now-passing check into a red run (with no issue: `liveIssue.ts` finds
no failed test). No run of either workflow in its last 100 has an attempt
above 1, so this has never happened here, and the README could not be
read from the sandbox (the raw redirect answers 403 through the proxy and
the API read of that repository is not enabled for this session), so it
is not verified. If wanted: add `-${{ github.run_attempt }}` to the name
and the file in both workflows; the summary's filter is
`startswith("parity-")`, the summary and the archive key records by kind
and run time, and the sampler's `parity-<run id>-<hour>` names fed the
same filter before, so nothing downstream would change.

### 5. Two notes on the pending 2026-11-19 work in the main checkout

- The rebase-before-push added to `parity-summary.yml` runs on
  `actions/checkout@v4` at its default depth of 1, so `git rebase
  origin/main` runs in a shallow clone whose only commit before the
  summary's is the old tip. `ceiling-data-refresh.yml` (lines 69-71) sets
  `fetch-depth: 0` "so the commit can be rebased onto a main that moved".
  I believe the shallow rebase works (the fetch brings main's new commits
  down to the old tip, which is the merge base), but I could not try it
  here: the harness refused a scratch-repository git experiment outside
  the worktree. Worth either the `fetch-depth: 0` the refresh uses or a
  dispatch of the summary after a merge to main, to see the loop's first
  pass.
- The reset retry (`isConnectionReset`) reads `cause.code` and falls
  back to `/ECONNRESET/` on the message; the live checks' own wrapping
  (`simText.live.ts` wraps a thrown fetch in `failed(label, 'request
  failed', err)`) happens after `fetchWithRetry` returns, so the retry
  sees Node's own error. Fine as written.

### 6. The live-site issue step dies before the issue if its label call fails

`live-site.yml` line 211: `gh label create live-site … --force` with no
guard, under `bash -eo pipefail`. The description is 54 characters, so
the 2026-11-03 422 cannot recur, but any failure of that call (an API
5xx) ends the step with no issue opened, which is what the sky-parity
step was changed to avoid. The same `labelArgs` pattern would do, with
the branch from finding 1. Not changed: unobserved, and a second copy of
the pattern is better written once the maintainer has seen the first.

### 7. The forecast keeper retries every failure, a daily-limit 429 included

`scripts/forecastKeep.ts` lines 30-43: `json()` throws on any non-OK
status and retries three times with 5 s and 10 s waits, so a 404, a 400
and Open-Meteo's daily-limit 429 are all asked twice more.
`cloudCoverFetch.py` (lines 126-141) gives up on a 4xx other than an
ordinary 429 and on the "Daily API request limit" body, which is the
convention; `surfaceWindCompare.live.ts` retries only a failed
connection, never a status. The keeper runs on GitHub's runners, which
have never met the limit, so the cost is two wasted requests on a day the
address was already refused. Small and local, but the script exports
nothing and has no test, so left as a note.

### 8. The ceiling refresh pushes once after its rebase

`ceiling-data-refresh.yml` lines 248-250: fetch, rebase, one push. The
window between the rebase and the push is seconds, weekly, so a rejection
is unlikely; the summary's loop (three tries, ten seconds apart) could be
copied if it ever is.

### 9. The sampler slice's grace window

`scripts/surfaceWindLoop.sh` lines 66-69: a slice takes the tick it
started up to 120 s after. The upload step between slices takes a second
or two; an upload that took longer than two minutes would skip that
slice's one sample (its next tick lies past the slice's end). Unobserved;
noted so a missing sample after a slow upload is not a mystery.

## Checked and found as described

- The queue-the-successor chains (`forecast-keep.yml`,
  `surface-wind-sample.yml`): one dispatch before the work, `continue-on-
  error`, main only; the concurrency group holds one running and one
  waiting run and a newer start replaces the waiting one, so a schedule
  firing while a successor waits cancels the successor and takes its
  place, which doubles nothing and stops nothing. The slices are each
  `if: always()` with `continue-on-error`, so one that dies does not end
  the rest.
- `scripts/forecastKeepLoop.sh`: every git step of `keep_one` is checked
  by hand, a rejected push is retried once after `pull --rebase`, the
  loop exits 1 when any hour was not kept, and the branch is handled in a
  worktree with `-C` throughout.
- `scripts/liveFetch.ts` and its test agree with each other and with the
  CLAUDE.md rule (timeout, 502/503/504; the reset is the pending change);
  every live check (`skyParity`, `simText`, `pilotLinks`) fetches through
  it. `simText` spaces its requests three seconds apart on one chain.
- `src/domain/liveIssue.ts` opens one issue per failed file, one under
  `live-checks` for a report with no failed test but `success: false`,
  and one for no report; the label step's description limit is held by a
  test. The workflow's fallback when the script itself fails writes the
  same `live-checks` issue.
- The comparison workflows never fail on the scripts (comparisons.yml
  `|| true` on the vitest pipeline; sky-parity's two opt-in samplers are
  `describe.skipIf` behind `SURFACE_WIND_SAMPLE` and `RUN_SPLIT_SAMPLE`,
  so the daily run makes no Open-Meteo request through them).
- The archive scripts: records keyed by kind and run time
  (`parityRecordKey`) or by run time (surface wind), the out file read as
  an archive and merged in order, `--archives` globbed by the workflow
  over `*logs-*.jsonl.gz` and `surfacewind-*.jsonl.gz`, which match
  every archive under `data/parity/` (listed 2026-11-20).
- No script in scope retries Open-Meteo's daily-limit 429 except the
  keeper (finding 7); `cloudCoverFetch.py` gives up on it by the body
  text; `schulzeCompare`, `runSplit` and `surfaceWindCompare` ask once
  per status.
- The relay: `refuseOrigin` runs before any path, an `Origin` outside
  `ALLOWED_ORIGINS` (a browser's literal `null` included) gets 403 with
  no CORS header, and a request with no `Origin` gets no
  `access-control-allow-origin`, so no other page can read it. The TAF
  and NBM memos are served for 300 s and 600 s from the Worker's memory
  with the browser told what is left; the NBM path picks the cycle
  before the hour under way and looks back five, so a memo is at most ten
  minutes behind the file choice, as the comment says. A 206 window with
  an incomplete block, a 200 answer to the range, and a 416 all fall to
  the whole file; a HEAD that throws moves to the older file and only
  every HEAD throwing is "unreachable". `index.ts` exports the handler
  alone. `relay/` has no package or tests of its own; its tests are
  `tests/tafRelay.test.ts` and `tests/nbmRelay.test.ts` under `npm test`.
- `scripts/renderTalk.sh`: `set -euo pipefail`, a temp dir removed on
  exit, writes only its two outputs.

## Gates

`npm test` (94 files, 1,419 tests), `npm run lint`, `npm run typecheck`
and `npm run build` each exited 0 on 2026-11-20 with the fix in place;
`relay/` has no separate suite.
