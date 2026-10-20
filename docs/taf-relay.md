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
- **Light on aviationweather.gov.** It sends its own user agent and keeps
  the answer five minutes in Cloudflare's cache, so each Cloudflare
  location asks upstream at most once in five minutes, however many
  dashboards are open. aviationweather.gov's guidelines (read 2026-10-20)
  ask for a custom user agent, "limited in scope and frequency", and at
  most 100 requests a minute.
- **Within the free plan.** Workers Free allows 100,000 requests a day
  (Cloudflare's Workers limits page, read 2026-10-20). The card asks every
  10 minutes per open page, 144 a day, so the plan covers about 690 pages
  open all day. Past the limit, Cloudflare answers with its Error 1027 and
  the card falls back to Omaha's TAF, as on any failed fetch.

## What the app does with it

`src/config/tafRelay.ts` holds the Worker's address, `TAF_RELAY_URL`,
null until the relay is deployed. Once it is set:

- the card reads Offutt's TAF through the relay (`fetchTafFrom`,
  src/api/nws.ts; `tafFromAwcJson`, src/domain/normalize.ts) and names
  aviationweather.gov as the source;
- the build's Content-Security-Policy allows the relay's origin
  (`connectSources`, read by vite.config.ts);
- the sky-parity script reads Offutt's TAF the same way.

When Offutt has no TAF in force, as over its weekend and holiday gaps, the
chain moves on to Omaha's and the card says why (src/api/tafChain.ts).

## Checked before deploying (2026-10-20)

- `npm test`: the relay's handler with a stand-in fetch and cache
  (tests/tafRelay.test.ts): the origin check, one path, GET only, the
  cache, aviationweather.gov's 204, a failure answered 502 and not
  cached. Each test was proven by breaking what it names.
- In Cloudflare's runtime, `npx wrangler@4.151.3 dev` in `relay/`, against
  live aviationweather.gov:
  - `/taf/KOFF` from the site's origin answered 200 with the TAF and
    `Access-Control-Allow-Origin`;
  - another origin got 403, `/taf/KOMA` 404, and POST 405.

  The first try failed to start: the runtime treats every named export of
  the entry module as an entry point and refused the exported constants.
  So `src/index.ts` exports only the handler, and the logic is in
  `src/relay.ts`.
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
2. **The workers.dev subdomain.** The first time you open Workers & Pages,
   Cloudflare asks for an account subdomain. It becomes part of the relay's
   address, `https://lspc-taf-relay.<subdomain>.workers.dev`, which anyone
   reading the page source can see, so pick a neutral name.
3. **Connect the repository.** Go to Workers & Pages, then Create
   application, then GitHub, and authorize Cloudflare's GitHub app. When
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
