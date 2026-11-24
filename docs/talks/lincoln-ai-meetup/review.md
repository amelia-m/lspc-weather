# Review of the Lincoln AI meetup deck

Checked 2026-11-11 (00:52Z to 01:10Z) by a reviewer agent that had no part
in writing the deck, against the repository at `origin/main` 612c20c (the
working tree differs from it only under `docs/talks/`). Every git command
in `claims.md` was re-run; every file and line named was opened; the
GitHub reads were repeated with `gh api repos/amelia-m/lspc-weather/...`;
`npm test` was run. Then every sentence of `talk.qmd` outside the YAML
header and the speaker notes was read for a fact without a claim behind
it, the whole file (notes included) was scanned for the identifiers
`CONTRACT.md` forbids, and the notes were read for claims the slides and
the table do not carry.

## The claims

| id | verdict | note |
|---|---|---|
| C1 | CONFIRMED | 83d873d "Initial commit" 2026-06-26; `git rev-list --count origin/main` = 626; last commit 2026-11-10 22:49Z. |
| C2 | CONFIRMED | Author dates: 17, 20, 25, 118, 399, 47. (By committer date August is 20 and September 123; the table says `%ad`, so the figures are right as stated.) |
| C3 | WRONG | `pulls?state=all` returns 276 pull requests, every one merged, not 275. PR #289 was opened and merged 2026-11-10 22:49Z, after the read the table dates, but its merge is the 626th commit C1 counts, so the two figures are read at different moments. Issues: 13 non-PR issues, 12 by `github-actions[bot]`, 1 by the maintainer, confirmed. |
| C4 | CONFIRMED | `git shortlog -sn --no-merges`: Claude 520, parity-summary workflow 87, maintainer 12, ceiling-data-refresh workflow 4, openai-code-agent[bot] 2 (e449cf3 and 929f2f1, both 2026-10-01). With the one merge commit the maintainer has 13. |
| C5 | WRONG | Models confirmed: Opus 5.5 296, Fable 5.1 137, Opus 5 38, Opus 4.8 22, Haiku 4.5 2, plain "Claude" 41 (33 + 8 with lower-case trailers); four distinct session links confirmed. But 534 is the count of `Claude-Session:` lines, not commits: 531 commits carry one (61acf75 carries two lines, 8e439c1 three). |
| C6 | CONFIRMED | CLAUDE.md lines 9 to 18, both sentences verbatim. |
| C7 | CONFIRMED | All four hashes, dates and subjects as stated. (The grep also returns 724debd 2026-10-10 and 2809a5e 2026-11-05, which the claim rightly leaves out of "the rule arrived".) |
| C8 | CONFIRMED | CLAUDE.md lines 25 to 31; the shortening keeps every item. |
| C9 | CONFIRMED | `AdvisoryPanel.tsx` line 98: `subtitle="Flags only — not a go/no-go call. You decide."`. `img/dashboard-1280.png` exists (473 kB, written 2026-11-11 00:43Z); its content was not compared with the live site. |
| C10 | CONFIRMED | All fifteen hashes carry the dates given and add the files named (d2c9aa3 CitationsPage.tsx; b52fe7a CLAUDE.md and docs/open-questions.md; c3ef127 sky-parity.yml; bf69196 parity-summary.yml and ParityPage.tsx; 92eabc0 src/api/iem.ts; 331a564 comparisons.yml; 752756a readingLog.ts; e6d5186 surface-wind-sample.yml; b0d196c .claude/settings.json and forecast-keep.yml; 011bf86 the ceiling-error page; b33fafa live-site.yml; b5a5b29 ceiling-data-refresh.yml; c7ead28 relay/; ff944b2 WindErrorsPage.tsx; 2809a5e the B2 entry). |
| C11 | CONFIRMED | CLAUDE.md lines 168 to 181 (line 167 is the tail of the previous bullet). Every figure and quote matches. |
| C12 | CONFIRMED | CLAUDE.md lines 889 to 895, verbatim in substance. |
| C13 | CONFIRMED | CLAUDE.md lines 676 to 680 give 2026-10-28, six runs, #237 and the 24.04 pin since 2026-10-30; the 14:15Z and 16:52Z bounds and "two days in which nobody read the issue" are in docs/open-questions.md lines 1856 to 1864 and docs/live-checks-tally.md line 56, not in the CLAUDE.md lines cited. |
| C14 | CONFIRMED | CLAUDE.md 648 to 652 and 690 to 702 as stated; CLAUDE.md says "after about 11:30 PM Central". The "3 px" is from docs/live-checks-tally.md line 55 and docs/open-questions.md line 1681 (323 px at 320), not the CLAUDE.md lines cited. |
| C15 | CONFIRMED | docs/open-questions.md line 162 on: "About four hours of samples (19:38 to 23:57Z) are missing"; "Done 2026-11-10 ... eighteen slices ... an upload after each ... each run queues its successor". |
| C16 | CONFIRMED | docs/live-checks-tally.md: 12 of 45 scheduled (4 / 3 / 5); 8 of 148 (1 / 6 / 1). |
| C17 | CONFIRMED | README.md lines 15 to 19 and CLAUDE.md lines 288 to 292. |
| C18 | WRONG | `Object.keys(CITATIONS).length` is 19, not 21 (keys uspaStudentWinds to lspcWaiver, thresholds.ts lines 174 to 465); `READING_LOG` cites 19 as well. 13 Part A entries and one Part B entry (B2) confirmed; the daily fingerprint (`scripts/simText.live.ts`) confirmed. |
| C19 | CONFIRMED | docs/open-questions.md lines 15 to 17, under "Needs a human with a document". |
| C20 | CONFIRMED | package.json: react ^18.3.1, typescript ^5.6.3, vite ^8.1.3, vitest ^4.1.9; `npm test`: 90 files, 1,368 tests, all passing; 10 files in .github/workflows; deploy.yml on push to `main`; relay/ present; `DATA_SOURCES` has 16 keys (one of them `computed`, the app's own derived figures, so "16 named data sources" counts it). |
| C21 | CONFIRMED | 134 `.ts`/`.tsx` files under src, 24,652 lines; 16,958 lines under tests; 39 files under scripts; 22 `docs/*.md`, 78,993 words; CLAUDE.md 9,191 words; 68 files, 7.5 MB (7,639,118 bytes), under data/parity. |
| C22 | CONFIRMED | Gates at CLAUDE.md line 660 (the table says 577, which is "Conventions"); the two quotes at lines 579 and 599; `.claude/settings.json` added by b0d196c 2026-10-13 and still reads as described. |
| C23 | UNVERIFIABLE | The table does not record the pattern. A strict "the maintainer, <date>" gives 7; adding "the maintainer's call/word/answer(s)/wording" with a date within 15 characters gives 12; "maintainer" within 25 to 40 characters of a date gives 34 to 36; no pattern tried gives 29. |
| C24 | CONFIRMED | Each decision is in CLAUDE.md, at lines 81 (2026-10-10), 112 (2026-10-30, "make it very clear"), 843 (2026-10-30, seasons), 135 (2026-10-31, A8), 146 (2026-11-03), and docs/open-questions.md line 174 (2026-11-10); the table's line numbers 56 to 60 and 93 to 97 point at other paragraphs. |
| C25 | CONFIRMED | docs/open-meteo-terms.md line 20 quotes the licence; CLAUDE.md "Conventions" bullet. |
| C26 | CONFIRMED | CLAUDE.md, the two bullets named ("agreed within 4° and 1 kt everywhere", "a straight line through his raw pressure levels read at 0 ft", "72 of 72 hours"); docs/markschulze-altitude-reference.md. |
| C27 | CONFIRMED | docs/open-questions.md lines 120 to 144 (#283, over by 14:40Z 2026-11-10; "The same thing happened on 2026-10-09 (#135 ...) and was gone the next day"); docs/live-checks-tally.md "Since the tally". |
| C28 | WRONG | #261 to #289 is 28 pull requests, not 29: #283 is an issue. All 28 are merged, 2026-11-03 to 2026-11-10, and the six items named are among them (#263, #277, #278, #280 and #266, #282, #285). The 32 agent commits dated 3 to 10 November all carry one session's link, but that session's trailer runs from 2026-09-23 (431 commits), so "this session (3 to 10 November)" names a stretch of it, not a session. #258 to #260 were also merged on 2026-11-03. |

## Slide sentences with no claim behind them, or whose claim does not support them

Line numbers are `talk.qmd`'s.

- Line 56, "Public, open source, on GitHub Pages. No account, no server of its own." contradicts line 172, "**One small server**: a Cloudflare Worker relay". No claim on either; the relay is CLAUDE.md's "Offutt's TAF comes through a relay" bullet. Say "no server of its own but the relay" or drop the clause.
- Line 100, "23 Sep | a daily check compares the app's METAR and TAF decoding with aviationweather.gov's": c3ef127 on 2026-09-23 added the METAR sky check; the TAF decode joined it on 2026-09-24 (5f431d8, b4d29ec). C10 supports the date for the METAR check only.
- Line 114, "29 dated decisions": C23 cannot be reproduced (see the table). Either record the command that gives 29 or cut the number.
- Line 116, "520 of 626 commits are authored by an agent, in four long sessions; 87 by the project's own workflows; 12 by Amelia": C4 gives 87 for one workflow and 4 for the other, so the workflows have 91; the maintainer has 13 counting the merge commit; the two OpenAI commits are left out; the figures do not sum to 626. "Four long sessions" is C5's four distinct links, one of which carries 2 commits.
- Line 132, "7 Nov: a runner died with an hour of samples on it. [C15]": C15 says "four hours of samples went with it", and its source says "about four hours of samples (19:38 to 23:57Z) are missing". CLAUDE.md's sampler paragraph (line 790 on) distinguishes "an hour's unuploaded samples" from "the four hours to the next scheduled start", so either figure can be sourced, but the slide and its claim disagree; pick one and say which it is.
- Line 149, "one retry now covers them [C27]": the tally says the retry rules "cover four of those five kinds" and the 403 "is not retried on purpose". C27 is about the uspa.org refusals, not the retry.
- Line 160, "21 citations [C18]": 19.
- Line 161, "A daily check fingerprints every cited part, so a changed sentence at the source fails the build": it fails the daily sky-parity run, which CLAUDE.md says is not a gate; nothing about the build changes. No claim reference on this bullet (C18 is on the bullet above).
- Line 162, "The review is still waiting on the club's safety officer [C19]": C19's source says "the instructor's review"; the S&TA is named for the B2 question (C10, 2809a5e), not for this review. Minor.
- Line 183, "Claude Code, in cloud sessions, with GitHub, a sandbox with a browser, and an allowlisted network": no claim; CLAUDE.md's "What can and cannot be verified from a sandbox" supports it. Add a claim or a reference to C4/C5.
- Line 186, "a code review on every pull request": no claim. CLAUDE.md "Gates" says to request Copilot's review once per PR when the work is complete, and that the quota ran out mid-PR on 2026-09-23; whether every one of 276 pull requests was reviewed was not checked and is not in the repository.
- Lines 246 to 248, the three quoted requests of the maintainer ("is IFR structurally incompatible ...", "Draft the flag levels question for the S&TA", "Make sure this doesn't happen again"): in no file of the repository (grep over CLAUDE.md and docs/ finds them only in the deck). The contract allows the session transcript as a source, "still traced to a file where one exists"; none does. The outcomes on those lines (the 91.155 citation and reading, #262; the B2 entry deriving its wording from the flags' constants, #277; the 30-second cadence finding the loop's arithmetic, open-questions line 174 on) are confirmed.
- Line 249, "29 pull requests in eight days. [C28]": 28.
- Line 58 and line 212, "275 pull requests": 276 as of this review (C3).

## Identifiers in talk.qmd (slides and notes)

- Line 14: `amelia-m.github.io/lspc-weather`, the public site, allowed.
- Lines 100, 140, 149, 227, 242: `aviationweather.gov` and `uspa.org`; line 240: `api.weather.gov`. These are hostnames other than the public site's, which the contract's "Not shown" line forbids, though its "Names allowed" line admits the data services "as the live site names them". The maintainer should rule; writing "the FAA's aviation weather site", "USPA's site" and "the NWS API" would satisfy both lines.
- Lines 28 and 36: `#999`, `#8a8a8a` are CSS colours, not issue IDs.
- Names: "Amelia" (lines 4, 114, 116), "Miramonti" (line 4), "Mark Schulze" (lines 175, 229): allowed. "the club's safety officer" (lines 104, 162), "S&TA" (line 247), "an instructor" (lines 162, 165) are roles, not people.
- No session links, run IDs, issue numbers, local paths or usernames (the only `amelia-m` is inside the public site's hostname). Nothing about an individual jumper or instructor.

## Speaker-note claims not on a slide and not in the table

- Line 77: "The first version had its own thresholds, like any weather app." Supported by a05e15e 2026-06-27 "Add editable thresholds", not in the table. "The rule is the first thing in the working notes every agent reads": CLAUDE.md line 7, true.
- Line 89: "Two of these survived an earlier sweep because they were colour and text rather than flags" and the reviewer-bot example "add a caution when gusts exceed 20 knots": CLAUDE.md lines 46 to 58, true, not in the table.
- Line 109: "The commit count jumped in October because measuring generates a lot of small, checked changes": an interpretation, not a sourced fact.
- Line 121: "The hook was added after two investigations were reported only in chat and lost until asked for": CLAUDE.md "Conventions" (2026-10-13), true, not in the table.
- Line 152: "Seven of twelve decoder failures found something, twice the app's own decoder" and "nothing to loosen, and take the tally again in a month": docs/live-checks-tally.md "Reading it", true; C16 covers only the table's figures.
- Line 165: "'Began as an AI recollection' is in the README in those words": README line 16, true. "on 5 November they became a question on that page": C10's 2809a5e, true.
- Line 178: "more words of notes than lines of source": follows from C21 (88,000 words against 24,652 lines).
- Line 189: "The disclosure is itself one of the project's rules." No rule about AI disclosure is in CLAUDE.md, README.md or docs/ (the only "disclos" in the repository is in docs/open-meteo-terms.md, about Open-Meteo's terms). Unsupported; cut or source it.
- Line 252: "allowed as a source by the maintainer": CONTRACT.md "Sources" says so; not in the table.

## Summary

Of the 28 claims, 23 are confirmed, 4 are wrong and 1 cannot be verified. The wrong ones are small numbers that reach the slides: 19 citations, not 21 (C18, slide line 160); 28 pull requests from #261 to #289, not 29, since #283 is an issue (C28, line 249); 276 pull requests as of today, not 275, because PR #289 landed after the table's read but inside the commit count the same slide quotes (C3, lines 58 and 212); and 531 commits with a session link, not 534, which is the line count (C5, table only). C23's "29 dated decisions" could not be reproduced from any pattern tried (7 to 36 depending on the wording admitted) and should be re-counted with the command recorded or cut. Before the deck is shown, fix those four figures; make line 116's author split add up (the workflows have 91 commits, the maintainer 13 with the merge, and the OpenAI pair are missing); settle "an hour" against "four hours" of lost samples on line 132 against C15; change "fails the build" on line 161 to "fails the daily check"; remove the contradiction between "no server of its own" (line 56) and "one small server" (line 172); date the TAF half of line 100 to 24 September or say "METAR decoding"; soften "one retry now covers them" (line 149) to four of the five kinds; source or cut "a code review on every pull request" (line 186) and the note that disclosure "is itself one of the project's rules" (line 189); either accept that lines 246 to 248 quote the transcript with no file behind them or rephrase them as outcomes; and rule on the three data-service hostnames (aviationweather.gov, uspa.org, api.weather.gov), which the contract's "Not shown" line forbids while its "Names allowed" line admits. No session link, run or issue ID, local path, username or private person's name appears anywhere in the deck.

## Fixes applied after this review (2026-11-11)

Every finding above was checked again by the deck's author and held.
Applied to `talk.qmd` and `claims.md`: 19 citations (C18, counted by
importing `CITATIONS`); 276 pull requests (C3) and 28 in #261 to #289
(C28); 531 commits with a session link (C5); the dated decisions
re-counted with two recorded commands, 6 and 25 (C23); the author split
now adds to 626 (C4); the lost runner's hour of samples and four-hour
wait (C15); "fails the daily check"; the relay named on the first slide
beside "no account"; the TAF comparison dated 24 September (C10); "four
of the five kinds" of retry; "a code review on every pull request" and
the disclosure-as-rule line cut; the session's three bullets marked in
C28 as from the transcript. `CONTRACT.md` now says the data services'
own hostnames may be shown, which is what the "names allowed" line meant.

Added after the review, 2026-11-11, at the maintainer's word: a sources
slide after the title with the live site's own links (claim C29, read
from `src/config/sources.ts`), and a restyle in the dashboard's palette;
no other claim changed.
Also added 2026-11-11 at the maintainer's word: a "Why I built it" slide
after the title, three screenshots of a text thread she supplied (claim
C30; the other party is unnamed, and showing their messages in a public
room is for her to have agreed with them).
Added 2026-11-11 at the maintainer's word, after the page went live: the
two sites as they look (usairnet's page, C32; Mark Schulze's page in words
until a screenshot arrives as a file), where the drop zone's point is
(C33), why several stations are read (C34, with C11), the hourly chart
before and after night shading (C35), and the maintainer's framing of
the comparisons, trusting and skeptical (C36). Each claim's sources are
in the table; none of the earlier claims changed.
Later on 2026-11-11, at the maintainer's word: the mock phone redrawn
partly cloudy, so the instructor's "low" clouds in the thread can sit
beside it, and in larger, higher-contrast type (C31 updated); the three
chat screens made fragments, one click each; the title changed from
"Built with the brakes on" to "Built to be checked". No claim changed.
Then, at her word, "Trust, but verify".

## Fresh review of C30 to C37, 2026-11-12

A second reviewer, given the deck, the table, the repository's history
and the images, checked the eight rows added after the first review.
Commits were read with `git show`; the images were opened; the
maintainer's words and a web search cannot be checked from here and are
marked so. Nothing in `talk.qmd`, the images or `public/talk/` was
changed.

- C30, confirmed, with three notes. The three screenshots are in `img/`
  (added 4045b3b, 2026-11-11), the other party is unnamed in them, and
  the maintainer's own messages read as the caption says: "I might play
  around with whether I can build a dashboard just for funsies" is on
  `chat-2.png` word for word, and the instructor's three sites ("NOAA
  hourly forecast graph, usairnet aviation forecast, and a current METAR
  for Plattsmouth") are on `chat-1.png`, with the links one by one on
  the next two. The notes: the caption's "Is there a better app?" is a
  shortened quote (the message reads "Is there a better app or something
  to look at than general weather apps?"); the year "2026" in the
  caption is on none of the screens, so it rests on the maintainer's
  word (the thread precedes the first commit of 2026-06-26, which is
  all the history shows); and `chat-3.png` shows `metar-taf.com`, a
  hostname the live site does not name, while `chat-2.png` carries the
  NOAA link's coordinates, which are not the drop zone's. The contract's
  "Not shown" line is the maintainer's to rule on for those. Also,
  `docs/open-questions.md`'s "Done" entry for the deck calls the other
  party "a jumper" where the slide and the table say "my instructor".
- C31, confirmed as a prop. `weather-app-mock.png` was added in f456a92
  and redrawn in 59e628a, both 2026-11-11, matching the row; the image
  reads "A MOCK-UP FOR A TALK · NOT ANY REAL APP" at its foot and the
  slide's caption says the same; Saturday and Sunday carry the
  partly-cloudy icon. The HTML the mock was drawn from is not in the
  repository, so "drawn in Chromium from an HTML mock" rests on the
  commit messages. One mismatch between the slide and its own prop: the
  slide says "Highs in the sixties" and the mock's Sunday high is 70°.
  Not a claim about anything real, but the author should change one or
  the other.
- C32, confirmed, with a note on the title. `usairnet-kpmv.png` (added
  a1f19c7, 2026-11-11) is 2000 by 1240 px, the top 620 CSS px at 2x of
  the page the live site links (its heading reads "Plattsmouth Municipal
  Airport, KPMV", with the "Legacy view" toggle CLAUDE.md names). The
  slide shows no image of Mark Schulze's page and its text asserts none;
  a1f19c7's message records the reason the row gives (his page does not
  fill its table under the sandbox's browser). But the slide is titled
  "Two of them, as they look" and shows one of them as it looks; until
  his screenshot arrives the title promises more than the slide shows.
  Also, the screenshot is the page's head (navigation, banner, heading,
  nearby stations), not the hour-by-hour table the slide's text
  describes; the text describes the page, which is fair, but a reader
  may take it as describing the picture.
- C33, confirmed except one figure, corrected in the table. The two
  points, the move on 2026-10-08, the same Open-Meteo cell and NWS
  gridpoint, the link carrying the new point and his list's pin not, are
  all in `docs/open-questions.md` ("Settled: the DZ's coordinates now sit
  on the landing area"), `src/config/site.ts` lines 68 to 78 and
  `docs/markschulze-altitude-reference.md` lines 370 to 382, as cited.
  The row said "the model's ground 1,132 ft at the old point"; the
  sources say 349 m (1,145 ft) at the app's old point and 345 m
  (1,132 ft) at his pin, under a metre west of it, where Open-Meteo's
  terrain steps 4 m. The row now gives all three figures. The slide's
  second paragraph has the same slip, "1,132 ft to 1,165 ft" for the
  app's point, which moved from 1,145 ft; the third paragraph's "33 ft
  lower" for his pin against the new point is right. The author should
  fix the slide. "Nobody lands there" is the slide's gloss on the
  source's description of where jumpers land (north or east of the
  fence); "the comparison logs record which point each hour was taken
  at" holds: `scripts/schulzeCompare.live.ts` writes `dz` as the
  coordinates on every record, and the source says logs before
  2026-10-08 were at the old point.
- C34, confirmed, with two wording notes. KPMV 11 mi ENE (CLAUDE.md
  line 112, `SurfaceWindPanel`'s `.wind-observed` line), IEM 4 to 6
  minutes and NWS 24 to 33 on 2026-09-27 (lines 195 to 205), the relay
  (220 to 235), the FD fallback (421), the six stations
  (`NEARBY_METAR_STATIONS`, lines 118 to 125), the three TAF stations
  (lines 89 to 99) and the fall-back to Omaha's (`docs/taf-relay.md`
  line 57) are where the row says; `src/domain/taf.ts` decodes ended,
  CNL and NIL TAFs and `TafPanel` prints which station's TAF is shown
  and why the nearer one is not. The row's "CLAUDE.md lines 93 to 97
  (the card's first line)" points at the forecast-flag bullet; the
  card's first line is at line 112, in the "Surface wind card is first"
  bullet. And the slide's "on different ground" is not in that first
  line, which gives the distance and bearing only; the elevations
  (1,204 ft against 1,182 ft) are in `site.ts`. "Closest station with a
  METAR" is `site.ts` line 9.
- C35, confirmed. 8816b10 (2026-10-03 18:44Z, "Shade night on the hourly
  wind chart, and link live traffic over the sectional") and 2c6fd91
  (2026-10-04 00:41Z, "Shade night darker than day on the hourly wind
  chart") exist on `main`, are the only two commits `git log -S'sunrise'
  -- src/components/HourlyForecastPanel.tsx` finds, and their messages
  describe the change the slide names. 8816b10's parent is b3cceb8
  (2026-10-03 17:41Z, the sectional zoom buttons), and
  `src/api/fixtures/gridpoint.ts` at that commit runs to 12 hours
  (`interval(0, 12)`, `interval(6, 6)`), so "its own held only 12 hours"
  holds. 2026-11-11 was a Wednesday and 18:00Z is noon Central: both
  images start at 12pm and the after image's midnights read Wed, Thu,
  Fri; both have 72H selected and "next ~48 h". Two notes: 2c6fd91's
  date is UTC, the evening of 3 October in Central time, as the table's
  dates are throughout; and the after image is the fixture build at
  `main`, so the weekday labels (d122a4f, 2026-10-09) and the limit
  line's placing are later than the two commits the speaker note names.
  The slide's "Since" covers that; the note's "Two commits" does not
  quite.
- C36, the words unverifiable, the figures confirmed. The maintainer's
  two sentences are in no file and cannot be checked from here. The
  figures beside them are CLAUDE.md's: within 4° and 1 kt on the same
  hour, the three height levels (80, 120 and 180 m, all below 1,000 ft)
  since 2026-10-08, the seven extra pressure levels, the "As Schulze"
  view kept to his method; `.github/workflows/comparisons.yml` has eight
  cron lines. One nuance for "eight comparisons a day" (also on the C32
  slide): the daily sky-parity job runs the Schulze comparison too, so
  nine runs a day log it; the row's source says "also ... eight times a
  day", which the slides shorten.
- C37, the link confirmed, the sources unverifiable. The slide and
  `public/talk/index.html` both carry `https://skydivelspc.com/`, the
  address the row names. The web search and the maintainer's
  confirmation are in no file beyond the commit messages (f72d3e1 names
  the Omaha Magazine article and the email domain, a32e61a the
  confirmation); from here the host is still refused (a 403 on the
  proxy's CONNECT, 2026-11-12), so the link was not opened in this
  review either. "Weeping Water, Nebraska" is README line 4 and
  `site.ts` line 8.

The public render: `public/talk/index.html` has no `class="ref"` and no
`[C…]` marker, its `<title>` is "Trust, but verify" as `talk.qmd`'s, it
carries the club's link, and `npx vitest run tests/talkPage.test.ts`
passed its three tests on 2026-11-12.

Changed in this review: C33's row in `claims.md`, the ground figures
only. For the author: the slide's "1,132 ft to 1,165 ft" (C33), "Highs
in the sixties" against the mock's 70° (C31), the "Two of them" title
(C32), C34's "lines 93 to 97" and "on different ground", and the three
hostnames and the year on the thread's screenshots (C30) for the
maintainer to rule on.
