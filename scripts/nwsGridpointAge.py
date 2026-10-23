"""How old the NWS gridpoint was when fetched, and what the browser's cache
added, from the surface-wind sampler's log (docs/nws-gridpoint-age.md).

    python3 scripts/nwsGridpointAge.py data/parity/surfacewind-2026-10-09-to-2026-10-21.jsonl.gz

Each sampler run fetched the gridpoint (and the hourly product) straight
from api.weather.gov every five minutes with no client cache, and logged
its `updateTime`, `Expires` and `max-age`. "Newest known" at a run is the
latest `updateTime` either product had served by then: a lower bound on
what NWS's origin held. The replay takes every other run (the app's
ten-minute refresh) and plays three clients through it:

  pinned          a browser left to its default: it keeps the copy it got
                  until that copy's `Expires`, as Chromium did on 2026-10-23;
  no-cache        asks every time and shows whatever answered;
  no-cache+guard  asks every time and keeps the newer of that and what it
                  showed before (src/domain/gridpointFreshness.ts).
"""
import datetime
import email.utils
import gzip
import json
import statistics
import sys


def ts(s: str) -> float:
    return datetime.datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()


def q(xs: list[float], p: float) -> float:
    xs = sorted(xs)
    return xs[int(p * (len(xs) - 1))]


runs = []
for path in sys.argv[1:]:
    with gzip.open(path, 'rt') if path.endswith('.gz') else open(path) as f:
        for line in f:
            line = line[line.find('{'):]
            if not line.strip():
                continue
            n = json.loads(line).get('nws') or {}
            if not n.get('updateTime') or not n.get('expires'):
                continue
            runs.append((
                ts(n['fetchedAt']),
                ts(n['updateTime']),
                ts(n['hourlyUpdateTime']) if n.get('hourlyUpdateTime') else 0.0,
                email.utils.parsedate_to_datetime(n['expires']).timestamp(),
                n.get('maxAgeS'),
            ))
runs.sort()
utc = lambda t: datetime.datetime.fromtimestamp(t, datetime.timezone.utc).strftime('%Y-%m-%d %H:%MZ')
print(f'{len(runs)} runs, {utc(runs[0][0])} to {utc(runs[-1][0])}')

ages = [(f - u) / 60 for f, u, *_ in runs]
print(f'age since updateTime at fetch, min: median {statistics.median(ages):.0f}, p10 {q(ages, .1):.0f}, '
      f'p90 {q(ages, .9):.0f}, max {max(ages):.0f}')
ups = sorted({u for _, u, *_ in runs} | {h for _, _, h, *_ in runs if h})
gaps = [(b - a) / 60 for a, b in zip(ups, ups[1:])]
print(f'{len(ups)} distinct updateTimes; between updates, min: median {statistics.median(gaps):.0f}, '
      f'p10 {q(gaps, .1):.0f}, p90 {q(gaps, .9):.0f}, max {max(gaps):.0f}')

first_grid: dict[float, float] = {}
first_any: dict[float, float] = {}
newest, seen, back = [], 0.0, 0
m = 0.0
for f, u, h, _, _ in runs:
    for x in (u, h):
        if x:
            first_any.setdefault(x, f)
    first_grid.setdefault(u, f)
    if u < seen:
        back += 1
    seen = max(seen, u)
    m = max(m, u, h)
    newest.append(m)
lag = [(first_grid[u] - u) / 60 for u in ups if u in first_grid]
lag2 = [(first_grid[u] - first_any[u]) / 60 for u in ups if u in first_grid]
print(f'first served by the gridpoint after its updateTime, min: median {statistics.median(lag):.0f}, '
      f'p90 {q(lag, .9):.0f}, max {max(lag):.0f} (n {len(lag)})')
print(f'gridpoint first served after either product first served it, min: median {statistics.median(lag2):.0f}, '
      f'p90 {q(lag2, .9):.0f}, max {max(lag2):.0f}')
print(f'updateTimes seen only in the hourly product: {len([u for u in ups if u not in first_grid])}')
print(f'runs answered with an updateTime older than one the gridpoint had already served: {back} of {len(runs)}')
ma = [x for *_, x in runs if x is not None]
print(f'max-age, s: median {statistics.median(ma):.0f}, min {min(ma)}, max {max(ma)}')

print('\nreplayed at a ten-minute refresh:')
for kind in ('pinned', 'no-cache', 'no-cache+guard'):
    held = None
    behind, steps_back, last = [], 0, 0.0
    for i, (f, u, h, e, _) in enumerate(runs):
        if i % 2:
            continue
        if kind == 'pinned':
            if held is None or held[1] <= f:
                held = (u, e)
        elif kind == 'no-cache':
            held = (u, e)
        elif held is None or u >= held[0]:
            held = (u, e)
        if held[0] < last:
            steps_back += 1
        last = held[0]
        behind.append((newest[i] - held[0]) / 60)
    nb = [b for b in behind if b > 0]
    print(f'  {kind:15s} behind newest known at {len(nb)} of {len(behind)} refreshes ({100 * len(nb) / len(behind):.1f}%), '
          f'mean {statistics.mean(behind):.1f} min; when behind, median {statistics.median(nb):.0f}, max {max(nb):.0f}; '
          f'stepped back to an older forecast {steps_back} times')
