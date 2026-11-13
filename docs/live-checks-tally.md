# How often each live check cried wolf

A tally of every failure the two network-facing checks have raised on
`main`, against what each turned out to be, read from the issues they
opened, the maintainer's closing comments, the sections of
docs/open-questions.md that wrote each one up, and GitHub's run lists.
Taken 2026-11-07. The question it answers: when a check fails, how often
is there something to fix, and are the retry rules set right.

Neither check is a gate (CLAUDE.md, "Gates"): the daily sky-parity run
(`.github/workflows/sky-parity.yml`: the METAR sky parse, the TAF decode,
the Pilots tab links and the SIM text, each against a live source) and
the live-site check (`.github/workflows/live-site.yml`: every page of the
deployed site in a browser at three widths, and since 2026-11-05 the
fixture build at 11:45 PM Central). Each opens an issue when it fails on
`main`.

## Sky decode parity, 2026-09-23 to 2026-11-06

50 runs on `main`: 45 scheduled, 5 dispatched by hand after a fix. 12
failed, all scheduled (27% of the scheduled runs), opening nine issues;
the twelfth, 2026-11-03, opened none because its label was too long
(fixed that day, docs/open-questions.md, "Done: the sky-parity run of
2026-11-03"). What each was:

| failed runs | what it was | issues |
|---|---|---|
| 4: 09-26, 09-30, 10-01, 10-02 | **The app's TAF decoder**, both real: a `BECMG` group's `NSW` dropped where aviationweather.gov keeps it (now kept, `src/domain/taf.ts`), then a USAF remark (`WND 08009KT AFT 0104`) read as the period's wind and a visibility of 0.06 SM (left undecoded since #91). No reader saw either: KOFF's TAF reached the dashboard only with the relay, 2026-10-27. | #73, #81 |
| 3: 09-24, 10-24, 11-03 | **The check's own comparison**, both decoders right: an empty string in aviationweather's `fcsts` read as a visibility the app lacked (#70); their decoder dating a `TN` group a day early, which the check now reports rather than fails on (`temperatureAsWritten`); a QNH of 29.72 inHg that they round to 1007 hPa and the app to 1006 (a 1 hPa tolerance since). | #69, #209, none |
| 5: 10-09, 10-11, 10-25, 10-29, 11-01 | **Another host's bad minute**, nothing to fix: Cloudflare in front of uspa.org refusing every request with a 403 for a day; a connect timeout, a timeout and a timeout to aviationweather.gov; a 502 on the GFA link. The next run passed each time. | #135, #147, (#209's comment), #238, #256 |

So of twelve failures, four found a decode gap in the app, three found
the check asking for more than the two decoders agree on, and five were
cries of wolf, every one a single bad answer from another host. The
retry rules that followed cover four of those five kinds: a timeout is
tried once more since 2026-10-31 (#238's fix) and a 502, 503 or 504
since 2026-11-01 (#256's fix; `scripts/liveFetch.ts`,
`RETRIED_STATUSES`). The fifth, a 403, is not retried on purpose: a 403
is also what a removed page answers, and the SIM check's day of 403s was
every request, not one; its requests have gone out three seconds apart
since 2026-10-10 (`scripts/simText.live.ts`). Since the retries went in,
five scheduled runs (2026-11-02 to 11-06) have had one failure, the QNH
rounding, which was the check's. Whether the one retry is enough shows in
the next month's tally; two bad answers in a row from one host has not
been seen.

## Live site check, 2026-10-17 to 2026-11-07

148 runs on `main` (one cancelled by a newer deploy): 20 scheduled, 120
dispatched after deploys, 7 from the first days' `workflow_run` trigger.
8 failed (5% of runs), opening three issues:

| failed runs | what it was | issue |
|---|---|---|
| 1: 10-31 | **A fault a reader met**: the hour stepper's `+1 h` button 3 px past a 320 px page in the last half hour before midnight Central, when the readout carries a weekday. Fixed the same night; since 2026-11-05 the check's second leg pins that clock on the fixture build, and the stepper is measured against its row. | #249 |
| 6: 10-28 to 10-30 | **The check's own setup**: GitHub moved `ubuntu-latest` to the 26.04 image and Playwright 1.56.1 would not install Chromium on it, so six runs in a row failed before the check started, over two days in which nobody read the issue. Pinned to `ubuntu-24.04` since. | #237 |
| 1: 10-24 | **Unexplained, once**: Jumpers and Pilots 323 px wide at 320 on both loads, on app code that passed 19 minutes before and in every run since; the check recorded the width and nothing else, so the element is unknown. Since 2026-10-26 it names the innermost elements past the edge. | #208 |

So of eight failures, one was the site's, six were the runner's, one
is unknown. No run on `main` has failed on the rules the check carries for live
data (a source in error or still loading, the radar image not drawn,
the relay failing); whether the second load before counting a fault
has ever turned a first load's fault into a pass is not in the run
list, only in each run's log, and was not read for this tally. The one
data-dependent failure (#208) failed both loads. What would have cost most was #237:
not the six failures, which were one cause, but that its issue sat
unread for two days while the check was not running at all. A failing
check that nobody reads is the same as no check.

## What the checks did not raise

The tally is of alarms, so it says nothing about what passed in silence.
Two things readers met that neither check raised, both by the checks'
own rules: usairnet's redesign about 2026-10-09 left the usairnet
comparison parsing nothing for 17 days, because that comparison is a
report that never fails a run (docs/source-parity.md, "usairnet's
redesign"); and the NBM bulletin's header losing its version token on
2026-11-03 left the Ceiling & sky card's base row empty for about twelve
hours while the relay answered 502, which the live-site check notes
rather than counts, as NOAA's bucket failing behind the relay
(docs/nbm-lowest-cloud-base.md, "The header lost its version"). Both
were found by a person reading a page. A quiet comparison now shows in
the parity summary's `unreadable` count, which is the thing to read when
checking a run.

## Reading it

Over seven weeks the sky-parity check has been right to fail about
seven times in twelve, and the thing it found was twice the app's own
decoder, never shown to a reader, and three times its own strictness,
each of which taught something about aviationweather.gov's decoder that
is now in the code. Its cries of wolf were all one bad answer from
another host, and one retry now covers the kinds seen. The live-site
check has been right to fail once in eight, and wrong six times for one
reason that was not the site's. Nothing in either check's rules needs
loosening on this record; the retry rules are set to the failures seen,
and the thing to improve is not the checks but who reads them. Take the
tally again after a month of the retry rules.

## Since the tally

- 2026-11-11, live-site: the run after the parity summary's deploy
  (20:07Z, run 43093550048, issue #297) failed Jumpers at 1280 and 320 px
  on both loads with "Winds aloft: error: HTTP 503 for api.open-meteo.com";
  every other page passed, and the late-evening leg passed. Another host's
  outage, not the site's: Open-Meteo answered 200 again from the sandbox
  at 21:50Z. The seventh live-site failure that was not the site's; #297
  is the maintainer's to close (the sandbox cannot). The same hour,
  GitHub's runner queue was slow for this account: the keeper's job
  started 2 h 6 min after its run was created (17:17Z to 19:23Z), the
  sampler's 5 h 6 min (13:57Z to 19:03Z), and PR #298's CI run sat
  queued with no job for over 76 minutes (from 20:33Z) while the run for
  the next push to the same PR (21:50Z) started at once and passed in a
  minute, and the deploy and parity runs of 19:47Z to 20:17Z had started
  within a minute: a stuck run, then, not a slow queue, since a later run
  passed it. Not a failure of either check, but worth knowing when a run
  "has not run": push again, or dispatch one, rather than wait.
- 2026-11-09, sky-parity: the SIM text check failed all 31 tests on a
  Cloudflare challenge from uspa.org (`cf-mitigated: challenge`), the
  same refusal as 2026-10-09; every other check passed (#283,
  docs/open-questions.md). Another host's refusal, by the check's own
  rule a failure, since a cited part cannot be checked while it stands.
  Over by 14:40Z on 2026-11-10, when a dispatched run passed all 32 SIM
  tests: a one-day refusal again, the second a month apart.
- 2026-11-07, the surface-wind sampler (not one of the two checks, and
  it opens no issue): GitHub's runner lost communication in the job's
  fourth hour; the schedule restarted it seven hours on.
