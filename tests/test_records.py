import json
from html.parser import HTMLParser
from pathlib import Path
import sys
import unittest
from urllib.parse import urljoin, urlsplit
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build import build
from refresh import extract, extract_annual


class Anchors(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.canonical = [], None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a":
            self.links.append(a["href"])
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a["href"]


class Records(unittest.TestCase):
    def test_sitemap_canonicals_and_every_internal_record_link(self):
        build()
        dest=ROOT/"dist"
        urls={node.text for node in ElementTree.parse(dest/"sitemap.xml").findall(".//{*}loc")}
        paths={p for p in (dest/"records").rglob("index.html")}
        self.assertEqual(len(paths), len(urls))
        for p in paths:
            parser=Anchors()
            parser.feed(p.read_text())
            expected="https://coolcode.ca/routemirror/"+p.relative_to(dest).as_posix().removesuffix("index.html")
            self.assertEqual(parser.canonical,expected)
            self.assertIn(expected,urls)
            for href in parser.links:
                url=urlsplit(urljoin(expected,href))
                if url.netloc == "coolcode.ca" and url.path.startswith("/routemirror/records/"):
                    self.assertIn("https://coolcode.ca"+url.path,urls)
        route=(dest/"records/routes/555/index.html").read_text()
        snapshot=json.loads((dest/"data/loads.json").read_text())
        self.assertIn(str(snapshot["edition"]),route)
        self.assertIn(snapshot["source"].split("?")[0],route)
        self.assertIn(snapshot["annual_source"].split("?")[0],route)
        self.assertIn("Annual boardings",route)
        self.assertIn("route=555",route)
        self.assertIn("Source and dates",route)

    def test_annual_measurements_and_null_duplicate_slot(self):
        row={"CalendarYear":"2025","Lineno_renamed":"005/006","AnnualBoardings":"0","Average_Peak_Load_Factor":"NULL"}
        self.assertEqual(extract_annual([row]),{"2025":{"005/006":[0.0,None]}})
        with self.assertRaisesRegex(ValueError,"duplicate"):
            extract_annual([row,row])
        peak={"SeasonYear":"2025","Lineno_renamed":"555","DayType":"MF","Season":"Fall","HourRange":"6","direction_updated":"WEST","Average_Peak_Load_Factor":"NULL"}
        with self.assertRaisesRegex(ValueError,"Duplicate"):
            extract([peak,peak])
