import './vendor/fflate-0.8.2.js';
import {analyze} from './compass-model.mjs';
const required=new Set(['shapes.txt','routes.txt','trips.txt']);
const lengthLimit=96*1024*1024;
const nameOf=path=>path.split(/[\\/]/).pop().toLowerCase();
self.onmessage=async ({data:files})=>{
  try{
    let size=0;
    const text={};
    const select=(name,bytes)=>{
      if(Object.hasOwn(text,name))throw new Error('More than one '+name+' was provided. Select a single feed.');
      size+=bytes;if(size>lengthLimit)throw new Error('The selected GTFS tables exceed 96 MiB. Choose a smaller route extract.');
      text[name]=null;
    };
    const decoder=new TextDecoder('utf-8',{fatal:true});
    for(const file of files){
      const name=nameOf(file.name);
      if(name.endsWith('.zip')){
        if(file.size>192*1024*1024)throw new Error('For archives above 192 MiB, unzip locally and select shapes.txt, trips.txt and routes.txt.');
        const entries=self.fflate.unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{
          const base=nameOf(entry.name);
          if(!required.has(base)||entry.name.startsWith('__MACOSX/'))return false;
          select(base,entry.originalSize);
          return true;
        }});
        for(const [path,bytes] of Object.entries(entries))text[nameOf(path)]=decoder.decode(bytes);
      } else if(required.has(name)){
        select(name,file.size);
        text[name]=decoder.decode(await file.arrayBuffer());
      }
    }
    if(!text['shapes.txt'])throw new Error('Choose a GTFS ZIP containing shapes.txt, or select shapes.txt directly. Some agencies omit shapes.');
    self.postMessage({result:analyze(text)});
  } catch(error){
    self.postMessage({error:error.message || 'The selected feed could not be read.'});
  }
};
