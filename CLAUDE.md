# Working notes for this repo

A skydiving weather dashboard for the Lincoln Sport Parachute Club (Brown's
Airport, NE69). Read `README.md` for what it shows. This file is the standing
context for working on it.

## The rule that governs everything here

**The dashboard never gives a go/no-go verdict.** It flags a condition and hands
the reader the rule behind it so a human — the jumper, the S&TA, the pilot in
command — can check it and decide.

That only works if every flag is checkable, which produces the rule that shaped
most of the current code:

> A flag fires on a limit some published source sets, or on a plain observed
> fact, or it does not fire at all.

A threshold nobody published cannot be checked, so it does not get to raise a
flag, paint a figure in a warning colour, or attach a worded judgement. There is
deliberately **no "house heuristic" citation** to fall back on — see rule 3 in
the `CITATIONS` doc block in `src/config/thresholds.ts`, which is enforced by a
test asserting no citation may link inside the app.

Things removed under this rule, so nobody reintroduces them believing they were
an oversight: ceiling bands, dew-point spread, precipitation chance, forecast
storm chance, gust spread, winds-aloft speeds, density-altitude bands, the
last-load countdown, every "watch" band, two colour highlights in the 10-day
outlook, a 30% storm colour on the storms card, a "fog/low-cloud favorable"
verdict on the humidity line, and a derived sky verdict on the gridpoint
fallback path.

Where a removed flag's *guidance* was genuinely sourced, it moved onto the
relevant card as a standing note rather than being lost — see `WindsAloftPanel`
and `DensityAltitudePanel`. Follow that pattern.

**A number is not the only way to assert something.** A figure rendered in a
warning colour, an emoji, or a one-word label ("Rain", "fog favorable") asserts
as much as a sentence does. Two invented thresholds survived an earlier sweep
precisely because they were colour and text rather than flags.

## Consequences worth knowing before you "fix" them

- **The Licensed profile raises no surface-wind flag at any speed.** Both its
  bands were the app's own, and its guidance says no USPA limit binds a licensed
  jumper, so there is no trigger a reader could check. This is deliberate. The
  Surface wind card carries the profile's guidance and BSR citation as a
  standing note, and the empty advisory list names the gap, so silence is not
  left to read as an all-clear. If the BSRs *do* set a limit for licensed
  jumpers, this is the most consequential error in the app — see A4 in
  `src/components/CitationsPage.tsx`.
- **Wind limits render with a decimal in knots** (`fmtLimitSpeed`). The club
  waiver posts gust ceilings one mph apart at the top (19 and 20 mph); rounded
  to whole knots both printed "17 kt", so the tier a jumper earned changed
  nothing on screen. Readings stay whole — a METAR reports whole knots.
- **`compass()` is 16-point.** An 8-point label put 060° in the "NE" bucket, a
  15° error that matters over a 10,000 ft freefall.

## Citations

Every USPA reference in this app was AI-derived and **none has been verified
against a current SIM**. That is not a disclaimer to be quietly dropped: the
in-app page at `#citations` (`src/components/CitationsPage.tsx`, linked from the
footer) exists so an instructor can work through the open items.

When touching a citation:

- `source` and `url` must name the same section, or neither may name one. A test
  enforces this.
- Where the governing section is unknown, the citation stays on the document
  index **and says so in its note**. A confidently wrong section number is worse
  than an honest general link — it sends a jumper to the wrong rule while
  looking authoritative.
- Never write that a citation has been checked. Reading this repository and
  judging that the cited authority is the right *kind* of authority is not the
  same as opening the document.

## What cannot be verified from a sandbox

Outbound network access goes through a policy-enforcing egress proxy, and the
hosts this app depends on are blocked unless the environment's allowlist
includes them. With them blocked:

- the app runs only against the fixtures in `src/api/fixtures/`;
- the live NWS and Open-Meteo paths, the NOAA FD winds fallback UI, the radar
  image and every citation URL are **unexercised, not passing**;
- CI is no better — it runs the same fixture-backed suite.

Say so plainly rather than implying a green suite covers them. Hosts worth
allowlisting: `api.weather.gov`, `api.open-meteo.com`, `radar.weather.gov`,
`www.uspa.org`, `www.markschulze.net`, `amelia-m.github.io`.

## Conventions

- **Comments explain WHY, with domain context.** Calibrate on
  `src/domain/densityAltitude.ts`. Never write a comment describing behaviour
  the code does not have — several did, and each one misled a later reader.
- `src/domain/` is **pure**: no I/O, no `Date.now()`, no mutable module state.
  Time is passed in. Side-effecting helpers live in `src/api/`.
- New domain module ⇒ new tests under `tests/`. Vitest runs in a `node`
  environment over `tests/**/*.test.ts`; there is no jsdom. Component behaviour
  can still be tested with `react-dom/server`'s `renderToStaticMarkup`, which is
  how the advisory empty-state tests work.
- A removed flag is tested by asserting it is absent **in conditions that would
  previously have tripped it**, not in conditions that never would have.
- Derive values rather than writing them down twice. The station's distance and
  bearing come from its coordinates via `src/domain/geo.ts`; a hand-written
  `distanceMi: 12` had already drifted from the real 11.54.

## Verifying UI work

Playwright is available. Chromium is at `/opt/pw-browsers/chromium` — pass it as
`executablePath` and do **not** run `playwright install`. `npm run dev` serves
the app with fixtures. Run throwaway scripts from the repo root (node cannot
resolve `playwright` from a scratch directory), then delete them.

Check 390px and 320px, not just desktop. Several defects this repo has had were
phone-only: a page-wide horizontal scroll, headers overflowing, and a control
overlaying the Refresh button.

## Gates

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. CI runs on
pull requests only (`.github/workflows/ci.yml`), so commits pushed to a branch
with no open PR are never checked by CI — a long branch can accumulate a lot of
unverified work. `main` deploys to GitHub Pages on push.

Open items live in `docs/open-questions.md`.
