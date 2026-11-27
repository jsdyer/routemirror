"""Refresh a compact statistical extract from the latest published TSPR CSV."""
import csv
from datetime import datetime, timezone
from html.parser import HTMLParser
import io
import json
import math
from pathlib import Path
import re
from urllib.parse import urljoin
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
INDEX = "https://www.translink.ca/plans-and-projects/strategies-plans-and-guidelines/managing-the-transit-network"

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.matches = []
        self.annual = {}
    def handle_starttag(self, tag, attrs):
        href = dict(attrs).get("href","")
        if tag == "a" and (match := re.search(PATTERN,href,re.I)):
            self.matches.append((int(match[1]),urljoin(INDEX,href)))
        if tag == "a" and (match := re.search(r"tspr(\d{4})_bus_yearline\.csv(?:[?#]|$)", href, re.I)):
            self.annual[int(match[1])] = urljoin(INDEX, href)

def number(value):
    if value.strip().upper() in ("","NULL","N/A"): return None
    n = float(value)
    if not math.isfinite(n) or n < 0: raise ValueError("Unexpected negative or nonfinite value")
    return round(n,4)

def main():
    links = Links()
    links.feed(urlopen(INDEX,timeout=50).read().decode())
    edition, source = max(links.matches)
    raw = urlopen(source,timeout=80).read().decode("utf-8-sig")
    entries, years, n = extract(csv.DictReader(io.StringIO(raw)))
    if edition not in years or len(years)<2 or n<100:
        raise ValueError("Incomplete TSPR edition")
    annual_source = links.annual[edition]
    annual_raw = urlopen(annual_source,timeout=80).read().decode("utf-8-sig")
    annual = extract_annual(csv.DictReader(io.StringIO(annual_raw)))
    if set(annual) != {str(y) for y in years}:
        raise ValueError("Annual and directional series cover different years")
    now = datetime.now(timezone.utc).date().isoformat()
    obj = {"edition":edition,"years":sorted(years),"source":source,"retrieved":now,"entries":entries,"annual_source":annual_source,"annual":annual}
    status = {"retrieved":now,"records":n,"edition":str(edition),"start":str(min(years)),"end":str(max(years))}
    folder = ROOT/"web/data"
    folder.mkdir(exist_ok=True,parents=True)
    for name, content in ((OUT,obj),(OUT+"-status",status)):
        tmp = folder/(name+".tmp")
        tmp.write_text(json.dumps(content,separators=(",",":"),ensure_ascii=False)+"\n")
        tmp.replace(folder/(name+".json"))

PATTERN = r"tspr(\d{4})_bus_peakload_[^/?]+\.csv"
OUT = "loads"

def extract(rows):
    groups, years, n = {}, set(), 0
    seen = set()
    for r in rows:
        if r["HourRange"] not in ("6","15"): continue
        year = int(r["SeasonYear"])
        key = "|".join([str(year),r["Season"],r["DayType"]])
        direction = r["direction_updated"].strip()
        route = r["Lineno_renamed"].strip()
        if direction not in ("WEST","EAST","NORTH","SOUTH") or not route: continue
        record = groups.setdefault(key,{}).setdefault(route,{}).setdefault(direction,[None,None])
        slot = int(r["HourRange"]=="15")
        value = number(r["Average_Peak_Load_Factor"])
        identity = (key, route, direction, slot)
        if identity in seen: raise ValueError("Duplicate peak-load slot")
        seen.add(identity)
        record[slot] = value
        years.add(year)
        n += 1
    if not any("555" in routes for routes in groups.values()):
        raise ValueError("Route 555 absent")
    return groups, years, n

def extract_annual(rows):
    years = {}
    for row in rows:
        year = str(int(row["CalendarYear"]))
        route = row["Lineno_renamed"].strip()
        values = [number(row[k]) for k in ("AnnualBoardings", "Average_Peak_Load_Factor")]
        if not route or route in years.setdefault(year, {}):
            raise ValueError("Blank or duplicate annual route ID")
        if any(v is not None for v in values):
            years[year][route] = values
    return years


if __name__ == "__main__":
    main()
