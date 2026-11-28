// GTFS bearing is folded onto an undirected axis. Distances are great-circle kilometres.
export const axes = ['N–S','NNE–SSW','NE–SW','ENE–WSW','E–W','ESE–WNW','SE–NW','SSE–NNW'];
const radians = Math.PI/180;
export function segment(a,b) {
  const p=a[1]*radians, q=b[1]*radians;
  const dl=((b[2]-a[2]+540)%360-180)*radians;
  const h=Math.sin((q-p)/2)**2 + Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2;
  const distance=12742.0176*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
  // Local east/north components at the midpoint give the same axis in reverse.
  const east=Math.cos((p+q)/2)*dl, north=q-p;
  const angle=(Math.atan2(east,north)/radians+180)%180;
  return {bin:Math.round(angle/22.5)%8,distance};
}

export function* csvRows(source) {
  const text=source.replace(/^\uFEFF/,'');
  let cell='',row=[],quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted && text[i+1]==='"'){cell+='"';i++;}
      else if(quoted || !cell){quoted=!quoted;}
      else cell+=c;
    } else if(!quoted && c===','){row.push(cell);cell='';}
    else if(!quoted && (c==='\n'||c==='\r')){
      if(c==='\r' && text[i+1]==='\n')i++;
      row.push(cell);if(row.length>1||cell.trim())yield row;
      row=[];cell='';
    } else cell+=c;
  }
  if(quoted)throw new Error('A CSV field has an unclosed quotation mark.');
  if(row.length || cell){row.push(cell);yield row;}
}

function readColumns(text, required, consume) {
  const reader=csvRows(text), headers=reader.next().value?.map(name=>name.trim());
  if(!headers || required.some(name=>!headers.includes(name))) {
    throw new Error('Expected GTFS columns '+required.join(', ')+'.');
  }
  const column=Object.fromEntries(headers.map((v,i)=>[v,i]));
  for(const row of reader) consume(row,column);
}

function shapeTotals(text) {
  const groups=new Map();
  let count=0;
  readColumns(text,['shape_id','shape_pt_sequence','shape_pt_lat','shape_pt_lon'],(row,col)=>{
    const id=row[col.shape_id]?.trim(), raw=[row[col.shape_pt_sequence],row[col.shape_pt_lat],row[col.shape_pt_lon]];
    const [n,lat,lon]=raw.map(Number);
    if(!id || raw.some(x=>x==null||x.trim()==='') || !Number.isSafeInteger(n)||n<0 ||
       !Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180){
      throw new Error('Invalid shape ID, sequence or coordinate at shape point '+(count+1)+'.');
    }
    if(++count>1200000)throw new Error('This file exceeds the 1.2 million shape-point limit. Use a smaller feed or a route subset.');
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push([n,lat,lon]);
  });
  const shapes=new Map();
  for(const [id,points] of groups){
    points.sort((a,b)=>a[0]-b[0]);
    const bins=Array(8).fill(0);
    for(let i=1;i<points.length;i++){
      if(points[i][0]===points[i-1][0])throw new Error('Duplicate point sequence for shape '+id+'.');
      const {bin,distance}=segment(points[i-1],points[i]);bins[bin]+=distance;
    }
    if(bins.some(x=>x>0))shapes.set(id,bins);
  }
  if(!shapes.size)throw new Error('No shape contains two distinct coordinates.');
  return shapes;
}

function summarize(shapes,ids) {
  const bins=Array(8).fill(0);let count=0;
  for(const id of ids){
    const values=shapes.get(id);
    if(!values)continue;
    count++;for(let i=0;i<8;i++)bins[i]+=values[i];
  }
  return {bins,count};
}

export function analyze(files) {
  const shapes=shapeTotals(files['shapes.txt']);
  const all=summarize(shapes,shapes.keys()),routes=[];
  if(files['trips.txt']){
    const byRoute=new Map(),labels=new Map();
    if(files['routes.txt'])readColumns(files['routes.txt'],['route_id'],(row,col)=>{
      const id=row[col.route_id],short=row[col.route_short_name]||'',long=row[col.route_long_name]||'';
      labels.set(id,long || short || id);
    });
    readColumns(files['trips.txt'],['route_id','shape_id'],(row,col)=>{
      const id=row[col.route_id],shape=row[col.shape_id];
      if(!id||!shapes.has(shape))return;
      if(!byRoute.has(id))byRoute.set(id,new Set());
      byRoute.get(id).add(shape);
    });
    for(const [id,ids] of byRoute){
      routes.push({id,label:labels.get(id)||id,...summarize(shapes,ids)});
    }
    routes.sort((a,b)=>a.label.localeCompare(b.label,'en-CA',{numeric:true}));
  }
  return {all,routes};
}
