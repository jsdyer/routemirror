// Build every index, detail page and cross-link from the same native measurements.
import {readFileSync, writeFileSync, mkdirSync} from "node:fs";
import {join, relative, dirname} from "node:path";
import {pathToFileURL} from "node:url";

const stage = process.argv[2];
const data = JSON.parse(readFileSync(join(stage,"data/loads.json"),"utf8"));
const {allRoutes, routePath, conditionPath, conditions, routeHistory, persistentReversals, reversals,
  appParams, selectionFor, dayNames, directionName, usableRecord} = await import(pathToFileURL(join(stage,"model.mjs")));
const root = "https://coolcode.ca/routemirror/";
const official = "https://www.translink.ca/plans-and-projects/strategies-plans-and-guidelines/managing-the-transit-network";
const routes = allRoutes(data), periods = conditions(data), years = data.years.slice().sort((a,b)=>a-b);
const latest = years.at(-1), pages = new Set(), byPeriod = new Map();
if (!routes.length || !periods.length || !data.annual_source) throw Error("Route profiles require both published data series");
if (new Set(routes.map(routePath)).size !== routes.length) throw Error("Route identifiers collide in public URLs");
const esc = v => String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const link = (href,text) => '<a href="'+esc(href)+'">'+esc(text)+'</a>';
const percent = v => Number.isFinite(v) ? v.toFixed(1)+"%" : "—";
const points = v => v>0 && v<0.05 ? "under 0.1" : v.toFixed(1);
const count = v => Number.isFinite(v) ? Math.round(v).toLocaleString("en-CA") : "—";
const shortDirection = direction => direction[0] + direction.slice(1).toLowerCase();
const name = (s,d) => s+" "+(dayNames[d] ?? d);
const lookup = (y,s,d) => data.entries[[y,s,d].join("|")] || {};
const table = (caption,headers,rows) => '<div class="scroll"><table><caption>'+esc(caption)+'</caption><thead><tr>'+
  headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+
  rows.map(r=>'<tr><th scope="row">'+r[0]+'</th>'+r.slice(1).map(v=>'<td>'+v+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
const wrap = body => '<ul class="records-list">'+body.map(s=>'<li>'+s+'</li>').join("")+'</ul>';
const intro = text => '<p class="finding">'+esc(text)+'</p>';
const selection = (r,y,s,d) => root+"?"+appParams(r,y,s,d);
const profile = r => root+routePath(r);
const via = (r,y,s,d) => link(selection(r,y,s,d),"Open Route "+r+" with these conditions");
const note = '<p class="note">The load factor is the average load at the busiest point of each trip, expressed as a percentage of vehicle capacity. Figures can exceed 100%. The morning and afternoon columns use TransLink’s time bands beginning at 06:00 and 15:00. A gap is the difference between directions in percentage points. A dash means the measurement is missing.</p>';
const sources = '<footer><h2>Source and dates</h2><p>TransLink’s '+esc(data.edition)+' Transit Service Performance Review covers '+years.join(", ")+'. Downloaded '+esc(data.retrieved)+'. Route Mirror checks monthly for a new edition. '+
  link(data.source,"Directional peak-load CSV")+' · '+link(data.annual_source,"Annual route totals CSV")+' · '+link(official,"TransLink performance review and definitions")+'</p></footer>';
function emit(path,title,summary,body,type="Article") {
  if (pages.has(path)) throw Error("Duplicate record "+path);
  pages.add(path);
  const dest=join(stage,path,"index.html"), css=relative(dirname(dest),join(stage,"style.css")).replaceAll("\\","/"), canonical=root+path;
  const json=JSON.stringify({"@context":"https://schema.org","@type":type,name:title,url:canonical,description:summary,
    isPartOf:{"@type":"WebApplication",name:"Route Mirror",url:root},citation:[data.source,data.annual_source]}).replaceAll("<","\\u003c");
  mkdirSync(dirname(dest),{recursive:true});
  const internal = html => html.replaceAll(/href="https:\/\/coolcode\.ca\/routemirror\/([^"]*)"/g, (_, value) => {
    const split = value.indexOf("?");
    const pathPart = split < 0 ? value : value.slice(0,split);
    const query = split < 0 ? "" : value.slice(split);
    const local = relative(dirname(dest),join(stage,pathPart)).replaceAll("\\","/") || ".";
    return 'href="'+local+'/'+query+'"';
  });
  writeFileSync(dest,'<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+esc(title)+' · Route Mirror</title><meta name="description" content="'+esc(summary)+'"><link rel="canonical" href="'+canonical+'">'+
    '<meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(summary)+'"><meta property="og:url" content="'+canonical+'">'+
    '<meta property="og:type" content="article"><script type="application/ld+json">'+json+'</script><link rel="stylesheet" href="'+css+'"></head><body class="recordpage" data-tool="routemirror"><header><nav>'+
    internal(link(root,"Route Mirror")+link(root+"records/","All records")+'</nav></header><main><h1>'+esc(title)+'</h1><p class="lead">'+esc(summary)+'</p>'+body+sources)+'</main></body></html>');
}
function period(s,d) {
  const key=s+"|"+d;
  if(!byPeriod.has(key)){
    const groups=years.map(year=>({year,routes:lookup(year,s,d)}));
    byPeriod.set(key,{groups,repeat:persistentReversals(groups), histories:new Map(routes.map(r=>[r,routeHistory(groups,r)]))});
  }
  return byPeriod.get(key);
}
function pattern(y) {
  if(!y?.complete) return "Incomplete";
  if(!y.am.leader || !y.pm.leader) return "Tied peak";
  return y.reversed ? "Reversal" : "Same leader";
}
function compareText(route, y, s,d,series) {
  if(!series?.complete) {
    const annual=data.annual[y]?.[route]?.[0];
    return (Number.isFinite(annual) ? "TransLink reports "+count(annual)+" boardings for the full year. " : "")+
      "The available measurements do not establish both peak leaders.";
  }
  const lead=(p,time)=>p.leader ? directionName(p.leader)+" led by "+points(p.gap)+" points "+time : "The two directions tied "+time;
  return lead(series.am,"in the morning")+". "+lead(series.pm,"in the afternoon")+".";
}
function periodAxis(r,y,s,d,completeOnly=true) {
  const axes=period(s,d).histories.get(r) || [];
  const rows=axes.map(h=>({axis:h.axis,...h.years.find(row=>row.year===y)}));
  return rows.find(v=>v.complete) || (!completeOnly && rows.find(v=>v.am || v.pm)) || null;
}
function annualTable(r) {
  const rows=years.slice().reverse().filter(y=>data.annual[y]?.[r]).map(y=>{
    const [boardings,factor]=data.annual[y][r]; return [esc(y),count(boardings),percent(factor)];
  });
  return rows.length ? '<h2>Whole-year use</h2>'+table('Annual totals across all service periods',['Year','Annual boardings','Annual average peak load factor'],rows)+
    '<p class="note">Boardings count entries onto buses. A passenger who boards twice contributes twice. Annual load factors cover all service periods.</p>' : "";
}
function crosslinks(r,y,s,d) {
  const chosen=periodAxis(r,y,s,d), possible=[];
  if(chosen){
    for(const other of routes){
      if(other===r) continue;
      const row=periodAxis(other,y,s,d);
      if(row && row.axis.join()===chosen.axis.join() && row.am.leader===chosen.am.leader && row.pm.leader===chosen.pm.leader){
        const distance=Math.abs(chosen.am.gap-row.am.gap)+Math.abs(chosen.pm.gap-row.pm.gap);
        possible.push({r:other,distance,label:"AM gap "+points(row.am.gap)+" points, PM gap "+points(row.pm.gap)+" points"});
      }
    }
  }
  let explanation='These routes share the same morning and afternoon leaders on the same directional axis in '+name(s,d)+' '+y+'. The closest combined morning and afternoon gap differences appear first.';
  if(!possible.length){
    const current=data.annual[y]?.[r]?.[0];
    if(!Number.isFinite(current)) return "";
    for(const other of routes){
      const n=data.annual[y]?.[other]?.[0];
      if(other!==r && Number.isFinite(n)) possible.push({r:other,distance:Math.abs(current-n),label:count(n)+" annual boardings"});
    }
    explanation="These routes have the closest annual boarding totals in "+y+".";
  }
  possible.sort((a,b)=>a.distance-b.distance || a.r.localeCompare(b.r,"en-CA",{numeric:true}));
  return '<h2>Routes to compare</h2><p>'+esc(explanation)+'</p>'+wrap(possible.slice(0,3).map(row=>link(profile(row.r),"Route "+row.r)+" — "+esc(row.label)));
}
const defaultSelection=selectionFor(data,routes.includes("555")?"555":routes[0]);
const baseS=defaultSelection.season, baseD=defaultSelection.day;
const tourRoutes=[defaultSelection.route, routes.includes("99")?"99":routes.find(r=>r!==defaultSelection.route && periodAxis(r,latest,baseS,baseD)),
  routes.find(r=>r.includes("/") && !periodAxis(r,latest,baseS,baseD) && Number.isFinite(data.annual[latest]?.[r]?.[0]))].filter((r,i,all)=>r && all.indexOf(r)===i);
for(const r of routes) {
  const {year:y,season:s,day:d}=selectionFor(data,r);
  const series=period(s,d), current=periodAxis(r,y,s,d), histories=series.histories.get(r);
  const summary=compareText(r,y,s,d,current).replace("; ",". ");
  let body='<p class="jump">'+via(r,y,s,d)+'</p><h2>'+esc(name(s,d))+' across years</h2>';
  if(histories.length){
    for(const {axis,years:results} of histories){
      const full=results.filter(v=>v.complete).length, reversed=results.filter(v=>v.reversed).length;
      body+='<p>Route '+esc(r)+' reversed in '+reversed+' of '+full+' comparable years on the '+esc(axis.join(" / ").toLowerCase())+' axis.'+(full < results.length ? ' Missing: '+(results.length-full)+' of '+results.length+' years.' : '')+'</p>'+
        table("Morning and afternoon load factors",["Year / pattern","Morning","Afternoon"],results.slice().reverse().map(v=>{
          const rec=lookup(v.year,s,d)[r]||{};
          const both = index => axis.map(dir=>shortDirection(dir)+" "+percent(rec[dir]?.[index])).join("<br>");
          return [link(selection(r,v.year,s,d),v.year)+"<small>"+pattern(v)+"</small>",both(0),both(1)];
        }));
    }
  } else body+='<p>The directional extract contains no observations for this route and condition. Its published annual measurements appear below.</p>';
  body+=note+annualTable(r);
  const contexts=periods.filter(([ss,dd])=>usableRecord(lookup(y,ss,dd)[r]));
  if(contexts.length) body+='<h2>Compare service conditions in '+y+'</h2>'+table("Same route and year",["Service period","Morning lead","Afternoon lead","Pattern"],contexts.map(([ss,dd])=>{
    const comparison=periodAxis(r,y,ss,dd,false);
    const lead=p=>!p?"—":p.leader?directionName(p.leader)+" +"+points(p.gap):"Tied";
    return [link(selection(r,y,ss,dd),name(ss,dd)),lead(comparison?.am),lead(comparison?.pm),pattern(comparison)];
  }))+'<p>Lead sizes are percentage points. '+link(root+conditionPath(s,d),"Compare all routes on "+name(s,d))+'</p>';
  body+=crosslinks(r,y,s,d);
  if(r==="555") body+='<h2>Connecting at Carvolth</h2><p>'+
    link("https://coolcode.ca/field-notes/carvolth-555-to-501-connection/","How much time do you need to change from the 555 to the 501?")+
    ' Follow one weekday arrival from Bay 1 to Bay 3, or '+link("https://coolcode.ca/transferwindow/?connection=carvolth-555-to-501","test the connection with your own walking allowance")+'.</p>';
  const index=tourRoutes.indexOf(r);
  if(index>=0) body+='<aside class="finding">Tour stop '+(index+1)+' of '+tourRoutes.length+' · '+(index<tourRoutes.length-1?link(profile(tourRoutes[index+1]),"Continue to Route "+tourRoutes[index+1]):link(root+"records/tour/","Return to the tour"))+'</aside>';
  emit(routePath(r),"Route "+r+" bus loads and boardings",name(s,d)+", "+y+". "+summary,body);
}
for(const [s,d] of periods) {
  const {groups,repeat,histories}=period(s,d);const counts=groups.map(g=>{
    const all=[...histories.values()].flatMap(h=>h.map(a=>a.years.find(y=>y.year===g.year))).filter(v=>v?.complete);
    return {year:g.year,complete:all.length,reverse:all.filter(y=>y.reversed).length,tied:all.filter(y=>!y.am.leader||!y.pm.leader).length};
  });
  const curr=counts.at(-1), order=reversals(groups.at(-1).routes);
  const summary="In "+curr.year+", "+curr.reverse+" of "+curr.complete+" comparable route-direction pairs switched their busier direction between the two peaks. "+repeat.length+" repeated the same reversal in all "+years.length+" years.";
  let b=table("Coverage and reversals by year",["Year","Comparable pairs","Reversals","Tied at a peak"],counts.slice().reverse().map(x=>[x.year,x.complete,x.reverse,x.tied]))+
    '<p>Each pair compares east with west, or north with south. It qualifies when there are measurements for both directions at both peaks. Ties are comparable. A reversal requires a different leader at each peak.</p>';
  if(repeat.length) b+='<h2>Reversals that persisted</h2><p>The same direction led each morning and its opposite led each afternoon in every edition year. The smallest directional lead across all years and both peaks determines the order.</p>'+
    table("All repeating pairs",["Route","Morning leader","Afternoon leader","Smallest lead (points)"],repeat.map(v=>[link(profile(v.route),"Route "+v.route),directionName(v.am),directionName(v.pm),points(v.score)]));
  if(order.length) b+='<h2>Largest two-way gaps in '+latest+'</h2>'+table("Up to ten reversals, ordered by the smaller peak gap",["Route","Morning lead (points)","Afternoon lead (points)"],order.slice(0,10).map(v=>[link(selection(v.route,latest,s,d),"Route "+v.route+" in this period"),directionName(v.am)+" +"+points(v.amGap),directionName(v.pm)+" +"+points(v.pmGap)]));
  emit(conditionPath(s,d),name(s,d)+" bus peak comparisons",summary,b+note);
}
const tourStops=tourRoutes.map((r,i)=>{
  const {year:y,season:s,day:d}=selectionFor(data,r),v=periodAxis(r,y,s,d);
  const annual=data.annual[y]?.[r]?.[0];
  const text=v?compareText(r,y,s,d,v).replace("; ",". "):"TransLink reports "+count(annual)+" boardings across the year. Its directional cells cannot establish which peak direction led.";
  return '<section><h2>'+link(profile(r),"Stop "+(i+1)+" · Route "+r)+'</h2><p>'+esc(name(s,d)+" "+y+". "+text)+'</p></section>';
});
emit("records/tour/","A tour of Metro Vancouver bus loads","Read the directional gaps on two routes, then see what an annual total can tell you when the peak measurements are missing.",tourStops.join("")+note,"CollectionPage");
const first=defaultSelection, firstY=first.year, firstPattern=periodAxis(first.route,firstY,baseS,baseD);
const example=compareText(first.route,firstY,baseS,baseD,firstPattern).replace("; ",". ");
const introText="Start with Route "+first.route+" on "+name(baseS,baseD).toLowerCase()+" in "+firstY+". "+example;
let directory=intro(introText)+ '<p class="jump">'+link(profile(first.route),"Read Route "+first.route)+" · "+link(root+"records/tour/","Take the guided tour")+'</p><h2>Compare service periods</h2>'+wrap(periods.map(([s,d])=>link(root+conditionPath(s,d),name(s,d))))+'<h2>Find a route</h2><p>Choose the published route number. A slash marks a combined series in the source.</p>';
const buckets=new Map();
for(const route of routes){
  const digit=route.match(/^\d+/);const band=digit?Math.floor(Number(digit[0])/100)*100:null;
  const group=band===null?"Lettered routes":band===0?"Routes below 100":"Routes "+band+"–"+(band+99);
  if(!buckets.has(group)) buckets.set(group,[]);
  buckets.get(group).push(route);
}
for(const [g,rs] of buckets) directory+='<section><h3>'+esc(g)+'</h3><div class="routegrid">'+rs.map(r=>link(profile(r),"Route "+r)).join("")+'</div></section>';
emit("records/","Metro Vancouver bus route records","Compare annual boardings and directional peak loads for "+routes.length+" published route series in TransLink’s "+data.edition+" edition.",directory,"CollectionPage");
const main=join(stage,"index.html");
writeFileSync(main,readFileSync(main,"utf8").replace("<!-- route-welcome -->",'<p class="welcome" id="welcome">'+esc("Showing Route "+first.route+" · "+name(baseS,baseD)+" "+firstY+". Change the route or season below.")+'</p><noscript>'+intro(introText)+'</noscript>'));
writeFileSync(join(stage,"sitemap.xml"),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+[...pages].sort().map(p=>'  <url><loc>'+esc(root+p)+'</loc></url>').join("\n")+'\n</urlset>\n');
console.log(routes.length+" route profiles, "+periods.length+" service-period comparisons, tour and directory; "+pages.size+" sitemap URLs");
