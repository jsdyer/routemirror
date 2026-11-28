import {axes} from './compass-model.mjs';
const el=id=>document.getElementById(id);
const number=new Intl.NumberFormat('en-CA',{maximumFractionDigits:1});
let data, worker, sequence=0;
function plot(bins) {
  const canvas=el('plot'),ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,500,500);
  const cx=250,cy=250,radius=195,max=Math.max(...bins);
  ctx.strokeStyle='#b7cabe';ctx.lineWidth=1;
  for(const r of [.25,.5,.75,1]){ctx.beginPath();ctx.arc(cx,cy,radius*r,0,2*Math.PI);ctx.stroke();}
  for(let i=0;i<16;i++){
    const angle=i*Math.PI/8-Math.PI/2;
    const r=max?radius*bins[i%8]/max:0;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle-Math.PI/21,angle+Math.PI/21);
    ctx.closePath();ctx.fillStyle=i%8===bins.indexOf(max)?'#a24e2b':'#147c73';ctx.fill();
  }
  ctx.fillStyle='#123f47';ctx.textBaseline='middle';ctx.textAlign='center';ctx.font='bold 20px system-ui';
  for(const [name,x,y] of [['N',250,29],['E',473,250],['S',250,471],['W',27,250]])ctx.fillText(name,x,y);
}
function show(){
  const route=el('line').value==='' ? data.all : data.routes[Number(el('line').value)];
  const total=route.bins.reduce((a,b)=>a+b,0);
  const max=Math.max(...route.bins);
  const principal=axes.filter((_,i)=>Math.abs(route.bins[i]-max)<1e-9).join(' and ');
  el('status').textContent='Most aligned '+principal+' ('+number.format(100*max/total)+'% of shape length). '+number.format(total)+' shape km across '+route.count+' distinct shape IDs.';
  const rows=route.bins.map((km,i)=>{
    const tr=document.createElement('tr');
    for(const [j,v] of [axes[i],number.format(100*km/total)+'%',number.format(km)].entries()){
      const td=document.createElement(j?'td':'th');if(!j)td.scope='row';td.textContent=v;tr.append(td);
    }return tr;
  });
  el('values').replaceChildren(...rows);plot(route.bins);
}
async function load(files, example=false){
  const id=++sequence;
  worker?.terminate();worker=null;data=null;
  el('status').textContent='Reading route shapes…';el('line').disabled=true;
  el('line').replaceChildren(new Option('Reading…',''));el('values').replaceChildren();plot(Array(8).fill(0));
  el('name').textContent=example?'Toronto subway example':'Local route shapes';
  const failed=(msg)=>{
    if(id!==sequence)return;
    worker?.terminate();el('line').replaceChildren(new Option('No route selected',''));
    el('status').textContent=msg;
  };
  try{
    if(example){
      const response=await fetch(new URL('./data/ttc-subway-example.zip',import.meta.url));
      if(!response.ok)throw new Error('The Toronto example could not be loaded. Try again or choose local files.');
      files=[new File([await response.blob()],'ttc-subway-example.zip')];
    }
    if(id!==sequence)return;
    worker=new Worker(new URL('./compass-worker.mjs',import.meta.url),{type:'module'});
    worker.onerror=()=>failed('This feed could not be read. Choose a smaller feed or try the Toronto example.');
    worker.onmessage=event=>{
      if(id!==sequence)return;
      worker.terminate();
      if(event.data.error){failed(event.data.error);return;}
      data=event.data.result;
      el('line').replaceChildren(new Option('All supplied shapes',''));
      data.routes.forEach((r,i)=>el('line').add(new Option(r.label,String(i))));
      const initial=example ? data.routes.findIndex(r=>r.id==='2') : -1;
      el('line').value=initial>=0?String(initial):'';el('line').disabled=!data.routes.length;show();
    };
    worker.postMessage(files);
  }catch(error){failed(error.message);}
}
el('line').addEventListener('change',show);
el('files').addEventListener('change',event=>{if(event.target.files.length)load([...event.target.files]);});
el('restore').addEventListener('click',()=>{el('files').value='';load([],true);});
load([],true);
