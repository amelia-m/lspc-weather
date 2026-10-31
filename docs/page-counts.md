# Page counts

Since 2026-10-31 the dashboard counts page views with GoatCounter, on the
maintainer's `amelia-m` account, the same one her personal site at
amelia-m.github.io counts to. Its dashboard is
<https://amelia-m.goatcounter.com> (her login). The dashboard's views show
there under paths starting `/lspc-weather/`: the Jumpers tab as
`/lspc-weather/`, the other pages as `/lspc-weather/#pilots`,
`/lspc-weather/#citations`, `/lspc-weather/#parity` and
`/lspc-weather/#wind-errors`. GoatCounter sets no cookies and keeps no
personal data.

## How it is sent

Not with GoatCounter's script. Its count.js would need an inline
`window.goatcounter = {...}` block to count the `#` pages (its own example,
www.goatcounter.com/help/spa), and the app's Content-Security-Policy refuses
inline scripts; it would also be the one third-party script the app runs.
GoatCounter documents its `/count` endpoint for integrations of one's own,
with stable query parameters (www.goatcounter.com/help/pixel, read
2026-10-31), so the app requests that URL as an image on every page shown:

- `src/domain/pageCount.ts` decides whether to count and builds the URL
  (pure, `tests/pageCount.test.ts`);
- `src/api/pageCount.ts` reads the browser's state and sends it;
- `src/App.tsx` calls it whenever the `#` page changes;
- `src/config/pageCount.ts` holds the endpoint (null turns counting off),
  and `vite.config.ts` allows that one URL in `img-src`. Neither
  `script-src` nor `connect-src` names GoatCounter, and a test holds both.

The parameters are GoatCounter's: `p` (path), `t` (title), `r` (referrer,
first view of a visit only, since later `#` pages are reached from inside
the app), `s` (screen width), `q` (the query string, where campaign tags
such as `?utm_source=` arrive) and `rnd` (a cache buster).

## When it does not count

The same filters as count.js, read from its source on 2026-10-31
(github.com/arp242/goatcounter, `public/count.js`), plus one:

- a prerendered page, a page in a frame, a local or private address (so
  `npm run dev` and a local preview are never counted) and a file opened
  from disk;
- a browser opted out with GoatCounter's own switch. count.js sets
  `skipgc` to `t` in local storage when a page running it is opened with
  `#toggle-goatcounter`. Storage is per origin, and the dashboard shares
  amelia-m.github.io's, so a browser opted out on the personal site
  (`https://amelia-m.github.io/#toggle-goatcounter`) is opted out here
  too. The dashboard does not run count.js, so opening the dashboard's own
  URL with that hash does nothing; use the personal site's;
- a browser under automation (`navigator.webdriver`). count.js sends such
  a view flagged as a bot; this app sends nothing, so the live-site
  workflow's daily loads of every page at three widths are not counted.

A background tab is counted when it is first shown, as count.js does.

## Checked

2026-10-31, the production build with fixtures served locally under a
non-local hostname in Playwright's Chromium, GoatCounter's endpoint
intercepted: a reader's browser sent one request per page (Jumpers,
`#citations`, `#pilots`), each carrying the query's `utm_source`, and the
policy logged no violation; with `skipgc` set it sent none, and with
`navigator.webdriver` left true it sent none. Not yet seen counted in the
GoatCounter dashboard itself, which needs the deployed site.

## Not counted

`public/ceiling-errors/` is a standalone page with its own policy and no
build step; it is not counted.
