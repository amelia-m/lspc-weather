# The TAF relay

Offutt AFB (KOFF), about 20 mi from the drop zone, is the nearest TAF. The
USAF issues it, and api.weather.gov, the only TAF feed a browser can read
from another site, does not carry it. aviationweather.gov carries it but
sends no CORS header ("Cross-origin resource sharing is not permitted at
this time", its API page, read 2026-10-20). So the TAF card shows Omaha's
(about 32 mi) and links Offutt's. Why a relay and not a workflow:
docs/open-questions.md, "KOFF's TAF".

`relay/` is a Cloudflare Worker that fetches one URL,
`https://aviationweather.gov/api/data/taf?ids=KOFF&format=json`, and hands
it to the dashboard with the CORS header. It is the app's only server-side
piece.

- **One fixed URL.** It cannot be pointed at anything else: one path,
  `/taf/KOFF`, GET only, and the query string is not passed on.
- **Your site only, in a browser.** It answers a page only from
  `https://amelia-m.github.io` and the local dev and preview servers
  (`ALLOWED_ORIGINS`). Another site's page gets a 403. A request with no
  Origin header (a script, curl) is answered. Outside a browser an Origin
  can be forged, so refusing those would only stop honest checks.
- **Light on aviationweather.gov.** Its guidelines (read 2026-10-20) ask
  for a custom user agent, requests "limited in scope and frequency", and
  at most 100 a minute.
  - The relay sends its own user agent.
  - It keeps a good answer five minutes in its memory, and tells the
    browser to keep it only for what is left of those five minutes, so a
    TAF reaches the card at most five minutes older than
    aviationweather.gov's own. (Until 2026-10-22 it also asked Cloudflare's
    fetch cache to keep the answer, which could add its age to the
    memory's; it no longer does.)
  - It gives up on aviationweather.gov after 8 seconds and answers 502.
    After a 502 the app does not ask again, so a stalled upstream draws one
    request, not two; after any other failure it retries once, as its
    other requests do, so a dropped connection is not read as the relay
    down (`fetchTafFrom`, src/api/nws.ts).
  - Every way aviationweather.gov can fail answers 502, a body that is not
    a list of TAFs included; that is neither kept nor passed on. A list
    whose Offutt entry the app cannot read is marked as aviationweather.gov's
    ("KOFF upstream answer unreadable"), not the relay's.
  - The memory is not a promise. Cloudflare runs many copies of a Worker
    and keeps none for a set time. Its Cache API page (read 2026-10-20)
    gives working cache operations to "Workers deployed to custom domains",
    which leaves out workers.dev, where this one runs, so the relay does
    not use that API.
  - At this club's scale none of that matters: each open dashboard asks
    every 10 minutes, far under the limit with no cache at all.
- **Within the free plan.** Workers Free allows 100,000 requests a day
  (Cloudflare's Workers limits page, read 2026-10-20). The card asks every
  10 minutes per open page, 144 a day, so the plan covers about 690 pages
  open all day. Past the limit, Cloudflare answers with its Error 1027 and
  the card falls back to Omaha's TAF, as on any failed fetch.

## What the app does with it

`src/config/tafRelay.ts` holds the Worker's address, `TAF_RELAY_URL`,
null until the relay is deployed (a trailing slash is dropped). The station
the relay serves is written once, in `relay/src/station.ts`, which both the
Worker and the app read. Once the address is set:

- the card reads Offutt's TAF through the relay (`fetchTafFrom`,
  src/api/nws.ts; `tafFromAwcJson`, src/domain/normalize.ts) and names
  aviationweather.gov as the source;
- the build's Content-Security-Policy allows the relay's origin
  (`connectSources`, read by vite.config.ts);
- the sky-parity script reads Offutt's TAF the same way.

Offutt's TAF carries groups an NWS TAF does not: each period's lowest
altimeter setting (`QNH3012INS`) and the forecast's maximum and minimum
temperatures with their times (`TX26/2121Z TN11/2211Z`). The FAA's
Aviation Weather Handbook (FAA-H-8083-28B, 27.4.2.10.4, read
2026-10-21) describes them as the joint-use airport format. Since
2026-10-21 the card decodes them:
- **QNH:** a column of the table, shown only when the TAF has one, so
  each value sits in its own row, with that row's label and times.
- **Temperatures:** said in words under the table, "Maximum temperature
  79°F at Wed 4:00 PM.", in the page's °F/°C setting, citing the handbook.
  The TX/TN groups are taken out before the periods are read, so no row's
  text carries them.

The daily sky-parity check holds them to aviationweather.gov's decode. QNH
must round to its whole hectopascal, which catches a misread figure but
not every slip of one hundredth: 30.17 and 30.18 inHg both round to
1022 hPa. The temperatures are compared as sorted lists. The check passed
on that day's Offutt TAF, and failed when the decoder was broken on
purpose (QNH 0.03 inHg off, the temperature times an hour late). A
production build in Chromium, with the relay's answer stood in by that
day's aviationweather.gov JSON, showed the column and the line at 1280,
390 and 320 px, and no page scrolled sideways. Offutt's in-period wind
remark (`WND 18006KT AFT 2122`) is still listed under "Not decoded".

When Offutt has no TAF in force, as over its weekend and holiday gaps, the
chain moves on to Omaha's and the card says why (src/api/tafChain.ts).
When the relay fails (a 502, the free plan's daily limit, the Worker
deleted), the card says "Offutt AFB (KOFF)'s TAF could not be fetched",
with the error, and the source log records it. On Data health the TAF
row's status stays green, since a TAF is shown, but its chip is amber and
says why (`describeTafSource` and `passedOverReason`,
src/domain/sourceProvenance.ts, since 2026-10-21):
- "KOMA · KOFF fetch failed" is the request failing: the relay, or
  aviationweather.gov behind it. An answer the app cannot read counts as a
  failure too (`tafFromAwcJson` throws on it) and is not taken for a gap.
- "KOMA · KOFF TAF ended", "KOMA · KOFF TAF CNL" and "KOMA · no KOFF TAF on
  aviationweather.gov" are Offutt's own gaps.
- Before the relay is set, the everyday chip is "KOMA · KOFF not in the NWS
  feed".

The chain records every station it passes over, a station with no TAF
included, so the chip, the card and the source log read the same reasons
rather than each working them out. Until then the chip said only "KOMA" in
every case, so a broken relay would have looked like any other day. Checked in a
production build on live data at 1280, 390 and 320 px: the no-relay chip
wrapped onto three lines at 320 px, and no page scrolled sideways.

Once the relay is set, the daily live-site check (`judgeLoad`,
src/domain/liveSite.ts) counts the relay's own failure as a fault, since
the relay is the site's own. It reads the fact from the TAF row's
`data-flags` (`TAF_RELAY_FAILED`, set from the chain's record), not from the
chip's words, which can change. A page must fail on two loads in a row
before it counts, and a failure on `main` opens a `live-site` issue, so a
relay that stays down is reported within a day. The relay answers 502 when
aviationweather.gov behind it fails or is slow; the chain keeps the status,
and the chip reads "KOFF upstream failed (502)". That is another host's
outage, a note, as is another station's failed fetch. The fault counts
only when the page checked is one the relay answers (`ALLOWED_ORIGINS`,
relay/src/station.ts): a local build on another port is refused by design.
The check reads the relay setting from its checkout, so a run on a branch
whose setting differs from the deployed site's judges by the branch's.

When the card shows another station, it always links Offutt's TAF on
aviationweather.gov, whatever the reason Offutt's was passed over. Data
health links the source the TAF was read from (aviationweather.gov through
the relay). When no station has a TAF in force, Data health's error and the
source log give each station's reason (`NoCurrentTafError`,
src/api/tafChain.ts), and a TAF still on screen goes if its own station was
just found ended or cancelled (`tafOnScreenGone`, src/domain/taf.ts).

The scraper's reading of the chips was
checked on the deployed site on 2026-10-21 ("fallback KOMA · KOFF not in the
NWS feed"), and the whole check passed on every page at every width from
the sandbox.

## Checked before deploying (2026-10-20)

- `npm test` runs the relay's handler with a stand-in fetch and clock
  (tests/tafRelay.test.ts). It covers:
  - the origin check, the one path, and GET only;
  - the user agent and the deadline;
  - the five-minute memory, to the millisecond;
  - aviationweather.gov's 204;
  - a failure answered 502 and not kept.

  Each test was proven by breaking what it names.
- In Cloudflare's runtime, `npx wrangler@4.151.3 dev` in `relay/`, against
  live aviationweather.gov:
  - `/taf/KOFF` from the site's origin answered 200 with the TAF and
    `Access-Control-Allow-Origin`;
  - another origin got 403, `/taf/KOMA` 404, and POST 405.

  The first try failed to start: the runtime treats every named export of
  the entry module as an entry point and refused the exported constants.
  So `src/index.ts` exports only the handler, and the logic is in
  `src/relay.ts`.
  Run again after the review fixes, the first request took more than 8
  seconds through the sandbox's proxy and got the 502. The next,
  straight after, got the TAF. From Cloudflare, aviationweather.gov is
  not behind that proxy.
- A production build with `TAF_RELAY_URL` set to the local Worker, in
  Chromium at 1280, 390 and 320 px on live data:
  - the policy listed the relay's origin, and nothing blocked the request;
  - the card showed KOFF's TAF issued 10:00Z, with "Data: AWC TAF · KOFF";
  - no page scrolled sideways.

  The only console errors were Open-Meteo's first-try failures through the
  sandbox's proxy, which CLAUDE.md already puts down to the proxy.

## Setting it up (the maintainer, once)

Read from Cloudflare's Workers docs on 2026-10-20: "Builds", "Build
configuration", "Build watch paths", "Build branches", "workers.dev" and
"Limits & pricing".

1. **Create a Cloudflare account** at <https://dash.cloudflare.com/sign-up>.
   Workers starts on the Free plan by default. Turn on two-factor
   authentication: this account can change what the dashboard shows.
   Which email to use is about handover (below), not security. The
   address is not public; only the workers.dev name is. Cloudflare also
   offers "Sign in with GitHub" (seen by the maintainer on 2026-10-21).
   That ties nothing new together: Workers Builds deploys whatever reaches
   `main`, so the GitHub account already decides what the relay serves.
   Signing in with it is separate from step 3's connection of the
   repository, which is still needed.
2. **The workers.dev subdomain.** Cloudflare does not ask for one: on
   opening Workers & Pages (Compute, then Workers & Pages, on the current
   dashboard) the account already had one made from the account's name,
   shown as "Subdomain" under Account details on the right, with a pencil
   to change it (seen by the maintainer on 2026-10-26). Change it before
   creating the Worker, since it is part of every Worker's address. Not
   the search box on the account's home page: that looks up domains to
   register, and answered a workers.dev name typed there with "We can't
   register this TLD". It becomes part of the relay's
   address, `https://lspc-taf-relay.<subdomain>.workers.dev`, which anyone
   reading the page source can see, so pick a neutral name. It names the
   account, not this Worker (every Worker in the account shares it, and
   the Worker's own name already says "taf-relay"), so `lspc-weather`
   reads as project then component; `lspc-weather-taf-relay` would say
   the component twice. The namespace is global: if the name is taken,
   another short one for the project. It can be changed later, but that
   breaks the address the app has.
3. **Connect the repository.** Go to Workers & Pages, then Create
   application, then GitHub. (The dashboard's account home, as seen by the
   maintainer on 2026-10-21, has no "Workers & Pages" entry at the top of
   its sidebar: Workers sits under Build, then Compute, and the home page
   has a "Create app" button. The docs' names lag the dashboard's.) Then and authorize Cloudflare's GitHub app. When
   GitHub asks which repositories, choose "Only select repositories" and
   pick `amelia-m/lspc-weather`.
4. **Configure the build:**
   - **Project / Worker name:** `lspc-taf-relay`. It must match `name` in
     `relay/wrangler.toml`, or the build fails.
   - **Root directory:** `relay`
   - **Build command:** leave empty.
   - **Deploy command:** `npx wrangler@4.151.3 deploy` (the version the
     local check ran; with no `package.json` in `relay/`, the default takes
     whatever Wrangler is newest).
   - **Production branch:** `main`.

   Then Save and Deploy. The Worker merges from `main`, so it deploys only
   once this change is merged.
5. **Two settings afterwards**, under the Worker's Settings, then Build:
   - **Build watch paths:** include `relay/*`, so only a change to the
     relay builds it. Otherwise every push to the repository does, and the
     forecast keeper alone pushes hourly (to its own branch, which the
     next setting covers).
   - **Preview builds** (Build branches): off, so pushes to other branches
     (`claude/*`, `forecast-archive`) build nothing.

   The free plan has 3,000 build minutes a month and one build at a time.
6. **Check it:** open
   `https://lspc-taf-relay.<subdomain>.workers.dev/taf/KOFF`. It should
   show JSON beginning `[{"icaoId":"KOFF"`. An empty `[]` means Offutt has
   no TAF in force right now, which happens over weekends and holidays.
7. **Send the address to a Claude session.** It sets `TAF_RELAY_URL` and
   opens the PR; the deploy carries the new policy.

To turn it off, set `TAF_RELAY_URL` back to null (the card returns to
Omaha's), then delete the Worker in the dashboard.

## Handing it over

The relay holds no data and no secrets. Everything it is lives in
`relay/`, so whoever takes it on does not need this Cloudflare account:

1. They set up their own account with the steps above and deploy from the
   repository: this one, or their fork or clone of it.
2. Their Worker has a new address,
   `https://lspc-taf-relay.<their subdomain>.workers.dev`.
   `TAF_RELAY_URL` (src/config/tafRelay.ts) changes to it, which also
   moves the build's security policy.
3. If the dashboard moves too, its new origin goes into `ALLOWED_ORIGINS`
   in `relay/src/relay.ts`. A fork on GitHub Pages is served from
   `https://<their user>.github.io`; under a custom domain, that domain.
   Without it the Worker refuses the dashboard's requests with a 403, and
   the card says Offutt's TAF could not be fetched.
4. Once the new address is live, the old Worker can be deleted.

Between steps 2 and 4 both Workers answer, so the switch costs no gap. If
the account was opened with a personal email, nothing needs to move but
the address. A club-owned address, or a second member added to the
account, only saves rebuilding it, which takes the few minutes above.
