# Task contract: a short deck on how LSPC Weather was developed with AI agents

Drafted 2026-11-10 from the brief relayed from the agent-config session,
with the maintainer's answers of the same day. Nothing below is started
until the maintainer approves this contract. (The `task-contract` skill
is not installed in this environment, so this follows its headings as
the brief describes them.)

## Goal

A short talk for the Lincoln AI meetup, a public room: a showcase of
something the maintainer does with AI, as a companion to the
agent-config deck on her agent workflow. This deck tells how one
project, LSPC Weather, was developed with AI agents: what was built,
why, what went wrong, and what changed because of it. Plain language, a
story, not a tutorial.

## Deliverable

- One Quarto reveal.js deck, one self-contained HTML file, from a `.qmd`
  source, in `docs/talks/lincoln-ai-meetup/` in this repository, on the
  working branch; merged to `main` only on the maintainer's word, and
  never deployed with the site (the deploy workflow builds `dist/`, which
  does not include `docs/`; checked before the first draft).
- About 10 slides for a 10-minute talk, then an appendix for
  implementation detail (as many slides as it needs, not spoken).
- A claims table beside the deck (`claims.md`): every date, count, quote
  and claim on a slide, with the file, commit or pull request it comes
  from. A fresh reviewer agent checks the table against the repository
  before the deck is called done, and its report is kept beside it.
- An AI disclosure slide in the main talk: the tools and models, what
  they did, and how the maintainer reviewed the work.
- Speaker notes per slide, short.

## What the deck covers (an outline to confirm, not a plan)

1. What it is: a skydiving weather dashboard for the Lincoln Sport
   Parachute Club (Brown's Airport, NE69), replacing a three-site
   routine, live at a GitHub Pages address. One screenshot.
2. The rule that shaped it: the dashboard never gives a go/no-go
   verdict; a flag fires on a published limit or an observed fact or not
   at all. Why that rule exists and what it removed (dated from the
   September commits that removed invented thresholds).
3. The timeline, dated from the history: first commit 2026-06-26;
   features through the summer; the citations page (2026-09-12) and the
   no-verdict rule (2026-09-19 to 21); the working notes and the open
   questions file (2026-09-22); the daily checks against other decoders
   (2026-09-23); the samplers, archives and comparison pages (October);
   the live-site browser check (2026-10-17); the relay (2026-10-20); the
   questions put to the S&TA (November).
4. How the work was split: what the maintainer decided (quoted from the
   notes as "the maintainer, <date>") and what agents did; the standing
   rules agents work under (CLAUDE.md, the project hook, the four gates,
   prove a test by breaking it, record every finding in the repository).
5. What went wrong and what changed because of it, each from the notes:
   the 2,700 ft overcast the dashboard showed as clear (2026-09-23), the
   usairnet redesign unnoticed for 17 days, the runner image that broke
   the live check for two days, the hour stepper past the edge at
   11:45 PM, the sampler's lost runner; and the rule or check each left.
6. Checking the checkers: the tally of how often each check cried wolf.
7. The citations: every USPA and FAA claim began as an AI recollection
   and was read at its source; the page that asks an instructor to
   confirm what a reading cannot settle.
8. The stack and how it runs: React and TypeScript on GitHub Pages, a
   Cloudflare Worker relay, ten GitHub workflows, public data sources
   (NWS, Open-Meteo, IEM, usairnet, NOAA's archives), named as the live
   site names them; code only as short excerpts.
9. AI disclosure (see above).
10. What a viewer could reuse: the no-verdict rule as a design
    constraint, the "every finding goes in the repo" convention, checks
    that compare against other decoders rather than against fixtures,
    and putting the open questions to the people who can answer them.

Appendix: the numbers (commits, PRs, tests, docs, workflows, lines, with
their commands), the workflow map, the comparison methods, the claims
table itself.

## Sources, and what may be shown

- The repository: git history (625 commits on `main` from 2026-06-26 to
  2026-11-10, 275 pull requests, 13 issues, read 2026-11-10), the docs,
  CLAUDE.md, README.md, the workflows, the tests.
- This session's own transcript (3 to 10 November), for colour on how a
  day's work goes, allowed by the maintainer 2026-11-10; still traced to
  a file where one exists.
- Names allowed by the maintainer, 2026-11-10: the project, the club, the
  airport, the station, the data services and vendors, and Mark Schulze's
  winds-aloft tool, as the live site names them. The maintainer's own
  name as the presenter.
- Not shown: hostnames other than the public site's, usernames, session
  links, run and issue IDs, full local paths, other people's names, the
  club's waiver sign (the photo in docs is a transcription source, not a
  slide), anything about individual jumpers or instructors.
- Every date from `git log` or a dated line in the notes, never from
  memory; every count from a command recorded in the claims table.

## Process

1. Write the claims table first, from the history and the notes.
2. Write the `.qmd` against it; render; check the rendered deck in a
   browser at 1280 px (and that it reads at a projector's 1024 px).
3. A fresh reviewer agent, given the deck, the claims table and the
   repository, checks every claim and every identifier rule; its report
   goes beside the deck; findings are fixed or the claim is cut.
4. The maintainer reads the draft; changes on her word; merge on her
   word. Nothing is pushed anywhere but the working branch, and nothing
   published, without it.

## Open before the first draft

- Quarto is not installed in this environment and pandoc is. Options:
  install Quarto here (GitHub releases, if the network allows); or author
  the `.qmd` and render drafts with pandoc's reveal.js writer as a
  stand-in, with the final render by Quarto on the maintainer's machine.
  To be settled at the first draft; the source is Quarto either way.
- The meetup's date, for the deadline.
- Whether a slide may show a screenshot of the live site with the day's
  weather (public data) or should use the fixture build.
