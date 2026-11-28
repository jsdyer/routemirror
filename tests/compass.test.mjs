import {test} from 'node:test';
import assert from 'node:assert/strict';
import {segment,analyze,csvRows} from '../web/compass-model.mjs';
const header='shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n';
test('north, east, reverse and dateline axes use length weighting',()=>{
  const east=segment([1,0,179],[2,0,-179]),west=segment([2,0,-179],[1,0,179]);
  assert.equal(east.bin,4);assert.equal(west.bin,4);assert.ok(Math.abs(east.distance-222.39)<.05);
  assert.equal(segment([0,43,-79],[1,45,-79]).bin,0);
});
test('sorts point sequence, deduplicates repeated trips, keeps independent shapes',()=>{
  const data=analyze({'shapes.txt':header+'a,0,2,2\na,0,0,1\nb,1,0,5\nb,0,0,2',
    'routes.txt':'route_id,route_long_name\n42,"North, south"\n','trips.txt':'route_id,shape_id\n42,b\n42,b\n51,a'});
  assert.equal(data.all.count,2);
  assert.equal(data.routes.find(r=>r.id==='42').count,1);
  assert.equal(data.routes.find(r=>r.id==='42').label,'North, south');
  assert.ok(Math.abs(data.all.bins[4]/data.all.bins[0]-2)<1e-8);
});
test('CSV supports UTF-8 BOM, quotes, quoted newline and CRLF',()=>{
  assert.deepEqual([...csvRows('\uFEFFa,b\r\n1,"Jo""e\n2"\r\n')],[['a','b'],['1','Jo"e\n2']]);
});
test('invalid coordinates, zero lengths and duplicate sequences give actionable errors',()=>{
  assert.throws(()=>analyze({'shapes.txt':header+'1,0,,1'}),/coordinate/);
  assert.throws(()=>analyze({'shapes.txt':header+'1,0,2,1\n1,0,2,2'}),/distinct coordinates/);
  assert.throws(()=>analyze({'shapes.txt':header+'1,0,2,1\n1,1,2,1'}),/Duplicate/);
});
