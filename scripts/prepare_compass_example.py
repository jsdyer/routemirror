"""Extract TTC subway route-shape records from an official City of Toronto GTFS download."""
import argparse
import csv
from hashlib import sha256
from io import StringIO, TextIOWrapper
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED


def create(source, destination, retrieved):
    with ZipFile(source) as feed:
        def rows(name):
            with feed.open(name+'.txt') as raw, TextIOWrapper(raw,encoding='utf-8-sig',newline='') as text:
                yield from csv.DictReader(text)

        routes=[r for r in rows('routes') if r['route_type']=='1']
        ids={r['route_id'] for r in routes}
        trips={}
        for trip in rows('trips'):
            key=(trip['route_id'],trip['shape_id'])
            if key[0] in ids and key[1]:
                trips.setdefault(key,trip)
        keys={s for _,s in trips}
        calendar=list(rows('calendar'))
        if not routes or not keys:
            raise ValueError('The source has no subway shapes')
        with ZipFile(destination/'ttc-subway-example.zip','w',ZIP_DEFLATED) as output:
            def save(name,cols,records):
                stream=StringIO()
                writer=csv.DictWriter(stream,fieldnames=cols,extrasaction='ignore',lineterminator='\n')
                writer.writeheader()
                writer.writerows(records)
                output.writestr(name+'.txt',stream.getvalue().encode('utf-8'))
            save('routes',['route_id','route_short_name','route_long_name','route_type'],routes)
            save('trips',['route_id','trip_id','shape_id'],trips.values())
            save('shapes',['shape_id','shape_pt_sequence','shape_pt_lat','shape_pt_lon'],(r for r in rows('shapes') if r['shape_id'] in keys))
    def digest(path):
        return sha256(path.read_bytes()).hexdigest()
    info={'source':'https://open.toronto.ca/dataset/ttc-routes-and-schedules/', 'licence':'https://open.toronto.ca/open-data-license/',
          'retrieved':retrieved,'feed_sha256':digest(source),'example_sha256':digest(destination/'ttc-subway-example.zip'),
          'route_count':len(routes),'shape_count':len(keys),'service_start':min(r['start_date'] for r in calendar),'service_end':max(r['end_date'] for r in calendar)}
    (destination/'ttc-compass.json').write_text(json.dumps(info,indent=2)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path)
    parser.add_argument('--retrieved',required=True)
    args=parser.parse_args()
    create(args.source,Path(__file__).resolve().parents[1]/'web/data',args.retrieved)
