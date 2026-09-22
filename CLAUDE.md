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
  bands were the app's own, and no USPA limit binds a licensed jumper, so there
  is no trigger a reader could check. This is deliberate, and it is **correct**:
  BSR 2-1 H states maximum ground winds for solo students and then, in as many
  words, "For licensed skydivers are unlimited" (read at uspa.org 2026-09-22).
  This used to be the app's largest open risk — if the BSRs had set a limit, the
  app would have been silent exactly where it should warn. They do not. The
  Surface wind card still carries the profile's guidance and BSR citation as a
  standing note, and the empty advisory list still names the gap, so silence is
  not left to read as an all-clear.
- **Wind limits render with a decimal in knots** (`fmtLimitSpeed`). The club
  waiver posts gust ceilings one mph apart at the top (19 and 20 mph); rounded
  to whole knots both printed "17 kt", so the tier a jumper earned changed
  nothing on screen. Readings stay whole — a METAR reports whole knots.
- **`compass()` is 16-point.** An 8-point label put 060° in the "NE" bucket, a
  15° error that matters over a 10,000 ft freefall.

## Citations

Every reference in this app began as an AI recollection. The **USPA SIM**
sections were read at uspa.org on 2026-09-22 and the claims corrected against
them; the **CFR and FAA** ones are still unread, because those hosts are
blocked. Neither state is an instructor's sign-off, and the distinction between
them is not a detail to smooth over. The in-app page at `#citations`
(`src/components/CitationsPage.tsx`, linked from the footer) records, per claim,
what the section says and what a reading could not settle.

When touching a citation:

- `source` and `url` must name the same section, or neither may name one. A test
  enforces this.
- Where the governing section is unknown, the citation stays on the document
  index **and says so in its note**. A confidently wrong section number is worse
  than an honest general link — it sends a jumper to the wrong rule while
  looking authoritative.
- Never write that a citation has been checked unless you opened the document.
  Judging from this repository that the cited authority is the right *kind* of
  authority is not the same as reading it. Where you did read it, say what you
  read and when — "read in the online SIM at uspa.org on <date>" — rather than
  "verified": the website's SIM on one day is not a printed edition, USPA
  revises it, and a bare tick invites a reader to assume more than was done.

## What can and cannot be verified from a sandbox

Outbound network access goes through a policy-enforcing egress proxy. With
`api.weather.gov`, `api.open-meteo.com`, `radar.weather.gov`, `www.uspa.org`,
`www.markschulze.net` and `amelia-m.github.io` allowlisted (2026-09-22), these
became checkable and were checked — see `docs/open-questions.md`:

- the live NWS and Open-Meteo paths, the TAF fallback chain and the NOAA FD
  winds fallback, by running the app's own fetch and domain code under Node;
- component output on live data, via `renderToStaticMarkup` — the same trick the
  advisory tests use. This is how the FD fallback's fake Surface row was found;
- the radar GIF and its georeferencing, by fetching and measuring it;
- the USPA SIM sections behind the citations.

Still not checkable here, so do not imply a green suite covers them:

- **The app in a browser.** Playwright's Chromium does not trust the proxy's
  TLS-intercepting CA, and the fixes for that (installing the CA into the NSS
  store, or a Chromium enterprise policy) are blocked by the sandbox's own
  guardrails. So nothing on the deployed site has been *seen*: layout, the
  390px/320px widths, the radar `<img>` loading cross-origin under the page's
  CSP, and the DZ marker's placement on screen are all unverified. A run script
  under Node is not a substitute — `renderToStaticMarkup` does not run effects,
  load images or apply CSS.
- **ecfr.gov, faa.gov, faasafety.gov** — still blocked, so the CFR and FAA
  citations remain AI-derived and unread.
- CI is no better: it runs the same fixture-backed suite. Nothing in `npm test`
  touches the network.

Two habits worth keeping. `NODE_USE_ENV_PROXY=1` plus
`NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` makes Node's fetch go through the
proxy, which is what let the live paths run at all. And some hosts refuse a bare
request: `markschulze.net` 403s without a `Referer`.

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

Playwright is available, but **it cannot currently reach any https:// site**:
its Chromium does not trust the egress proxy's CA and fails with
`ERR_CERT_AUTHORITY_INVALID`. Local `npm run dev` over http works; the deployed
site does not. Do not report a live-site UI check as done on the strength of a
Node render.

When it does run: the browser binary is `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(the `chromium` symlink next to it is not the executable) — pass it as
`executablePath` and do **not** run `playwright install`. Playwright itself is
installed globally, not in `node_modules`, so import it by path:
`/opt/node22/lib/node_modules/playwright/index.mjs`. `npm run dev` serves the
app with fixtures. Run throwaway scripts from the repo root, then delete them.

Check 390px and 320px, not just desktop. Several defects this repo has had were
phone-only: a page-wide horizontal scroll, headers overflowing, and a control
overlaying the Refresh button.

## Gates

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. CI runs on
pull requests only (`.github/workflows/ci.yml`), so commits pushed to a branch
with no open PR are never checked by CI — a long branch can accumulate a lot of
unverified work. `main` deploys to GitHub Pages on push.

Open items live in `docs/open-questions.md`.
