"""
How often each Nebraska station reported a FEW layer, July by July since
1996, and when the AWOS that stopped did: the history in
docs/cloud-cover-stations.md, "When the AWOS stopped reporting FEW".

  python3 scripts/fewHistory.py AWOS.csv          # the July table
  python3 scripts/fewHistory.py AWOS.csv switch   # the 2002-03 switch dates

AWOS.csv is the FAA's NASR AWOS file (nfdc.faa.gov, 28-day subscription,
"AWOS_CSV"), for each station's type. The reports are the Iowa
Environmental Mesonet's ASOS archive, routine and special, its decoded
sky-cover columns for the table and the METAR text for the switch. Run by
hand, with the network; nothing imports it.
"""
import csv
import io
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

IEM = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py'
UA = {'User-Agent': 'lspc-weather FEW history (github.com/amelia-m/lspc-weather)'}
# The seven AWOS that reported FEW before 2003 (the table shows which).
SWITCHED = ['HDE', 'ANW', 'ONL', 'FET', 'OGA', 'LXN', 'AUH']


def get(url: str) -> str:
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
                return r.read().decode()
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError('unreachable')


def july(sid: str, year: int) -> tuple[int, int] | None:
    """Reports in July of `year`, and how many had a FEW layer."""
    url = (f'{IEM}?station={sid}&data=skyc1&data=skyc2&data=skyc3&data=skyc4'
           f'&year1={year}&month1=7&day1=1&year2={year}&month2=8&day2=1'
           '&tz=Etc/UTC&format=onlycomma&latlon=no&report_type=3&report_type=4')
    rows = list(csv.reader(io.StringIO(get(url))))[1:]
    return len(rows), sum(1 for r in rows if 'FEW' in r[2:6])


def table(types: dict[str, str]) -> None:
    years = range(1996, 2026)
    ids = sorted(types, key=lambda s: (types[s] != 'ASOS', s))
    with ThreadPoolExecutor(4) as pool:
        got = dict(zip([(s, y) for s in ids for y in years], pool.map(lambda a: july(*a), [(s, y) for s in ids for y in years])))
    print('| Station | Type | ' + ' | '.join(str(y)[2:] for y in years) + ' |')
    print('|---|---|' + '---|' * len(years))
    for s in ids:
        cells = []
        for y in years:
            n, few = got[(s, y)] or (0, 0)
            # Under 50 reports: the station is not in the archive that July.
            cells.append('·' if n < 50 else str(round(100 * few / n)))
        print(f'| K{s} | {types[s]} | ' + ' | '.join(cells) + ' |')


def switch() -> None:
    """For each station that stopped, its last FEW report and its first
    report marked AO2 (an automated station with a precipitation
    discriminator, AC 00-45H; AO1 has none)."""
    for sid in SWITCHED:
        url = (f'{IEM}?station={sid}&data=metar&year1=2002&month1=7&day1=1&year2=2003&month2=8&day2=1'
               '&tz=Etc/UTC&format=onlycomma&latlon=no&report_type=3&report_type=4')
        last_few = first_ao2 = None
        for _, valid, raw in list(csv.reader(io.StringIO(get(url))))[1:]:
            if re.search(r'\sFEW\d{3}', raw.split(' RMK ')[0]):
                last_few = valid
            if first_ao2 is None and re.search(r'\bAO2\b', raw):
                first_ao2 = valid
        print(f'| K{sid} | {last_few} | {first_ao2} |')


if __name__ == '__main__':
    types = {r['ASOS_AWOS_ID']: r['ASOS_AWOS_TYPE'] for r in csv.DictReader(open(sys.argv[1])) if r['STATE_CODE'] == 'NE'}
    switch() if sys.argv[2:] == ['switch'] else table(types)
