# Open-Meteo's terms, and what this app does about them

Asked 2026-10-23 by the maintainer: is there anything in Open-Meteo's
guidelines this app does not yet meet, and is it credited properly?

Read 2026-10-23 with curl, as served that day: the terms of use
(<https://open-meteo.com/en/terms>) and the licence page
(<https://open-meteo.com/en/licence>). Open-Meteo says it may change its
terms "at any time", effective on posting, and tracks the changes on
GitHub. Nothing here watches for that, unlike the daily SIM check, so
read them again before relying on this page.

## What they ask, and where this app stands

| What the pages say | Where this app stands |
|---|---|
| The free API is for non-commercial use only. Their examples of non-commercial: "Private or non-profit websites or apps that do not have subscriptions or advertising", personal home automation, public research, educational content; "Voluntary donations, including contributions through a tip jar, are permitted." Commercial: "Websites or apps that have subscriptions or display advertisements", commercial products or promotion, undisclosed research at commercial entities. | Met, as far as the code shows: a public club dashboard on GitHub Pages, with no subscriptions, advertising, sign-in or paid feature. Whether LSPC is itself a non-profit was not checked; the examples turn on subscriptions and advertising. Adding either would need one of Open-Meteo's paid plans. |
| Under 10,000 calls a day, 5,000 an hour and 600 a minute; the free column of the plan table adds 300,000 a month. "Rate limits are applied by IP addresses and application." | Met. Each reader's browser calls Open-Meteo from its own address: the winds-aloft request and the 10-day outlook, each refreshed on the dashboard's timers. The repository's workflows run on GitHub's runners. Counted from the scripts on 2026-10-23, at most about 1,900 calls a day while both temporary samplers run (the surface-wind sampler about four a run every five minutes, the run-split sampler two a run every four minutes), about 57,000 a month, falling to a few dozen a day when they end (the hourly forecast keeper's outlook, eight comparison runs, the daily sky-parity run, the weekly refresh). The sandbox's shared address was refused for a day twice by requests not this repo's (CLAUDE.md). |
| Data under CC BY 4.0: "give appropriate credit, provide a link to the licence, and indicate if changes were made", in any reasonable manner but "not in any way that suggests the licensor endorses you or your use". | Met on the site: the footer credits Open-Meteo, links the licence and says what the dashboard changes (`OpenMeteoCredit`), and so do `#parity` and `#wind-errors`. Nothing suggests endorsement. |
| "You must include a link next to any location Open-Meteo data are displayed", for example `<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>`. | Met on the site: each card that shows Open-Meteo data (Winds aloft, Drift, the 10-day outlook, Ceiling & sky when its Open-Meteo figure is there) links Open-Meteo and the licence in its own "Data:" line (`SourceLinks`). Data health's rows link Open-Meteo by name with no licence link; they show whether and when a fetch answered, not its data. The ceiling-error page shows none (its data file holds the NWS rows and KPMV's reports only). **In the repository it was not met until 2026-10-23**: the comparison docs quoting Open-Meteo figures, the two `#wind-errors` figures drawn from its wind, and the archives under `data/parity/` carried no credit. Each now does: a credit under the title of the eight docs with Open-Meteo figures, a credit line on the figures (redrawn with only that line added; their counts did not change), `data/parity/README.md`, and the README's data-sources row, which also now names everything Open-Meteo feeds. |
| Researchers are encouraged to cite Open-Meteo (Zippenfenig, P. (2023). Open-Meteo.com Weather API. Zenodo. doi:10.5281/ZENODO.7970649). | Encouraged, not required. The comparison docs are notes, not publications; the citation is in `data/parity/README.md` for anyone who uses the archives. |
| No warranty: Open-Meteo "assumes no responsibility for any inaccuracies or omissions in the data, their availability, or any losses". | In keeping with the app's own rule: it gives no go/no-go verdict, and every card names its source. |

The licence page also lists the national weather services Open-Meteo's
data come from, each under its own licence. At the drop zone the default
model is NOAA's HRRR (docs/surface-wind-sources.md), and NOAA's data are
in the public domain. What the app has to meet is Open-Meteo's CC BY 4.0.

## Still open

- **The list of users** in Open-Meteo's README ("Do you use Open-Meteo?
  Please open a pull request and add your repository or app to the
  list!"): a request, not a term. Not sent: a pull request to another
  project under the maintainer's name is theirs to send
  (docs/open-questions.md).
- **Whether LSPC is a non-profit** does not change the reading above, but
  the maintainer may want it on record.
