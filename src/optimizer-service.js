(function(G){
'use strict';
// Cap concurrency rather than consuming every core. More workers reduce latency,
// not total CPU work; each worker owns its own WASM/physical worlds.
function workerLimit(requested=0,env=G){
 const n=env.navigator||{},cores=Math.max(1,Number(n.hardwareConcurrency)||2);
 const mobile=!!env.matchMedia?.('(pointer: coarse)').matches;
 const memoryCap=n.deviceMemory&&n.deviceMemory<=4?2:4;
 const cap=Math.max(1,Math.min(4,mobile?2:4,memoryCap,cores-1||1));
 return Math.min(cap,Number.isInteger(requested)&&requested>0?requested:cap);
}
function resultCompare(objective){return(a,b)=>{
 const primary=objective==='gentle'?a.settings.speed-b.settings.speed:a.distance-b.distance;
 return primary||a.distance-b.distance||a.settings.speed-b.settings.speed||String(a.method||'').localeCompare(String(b.method||''))||a.firstId-b.firstId||a.settings.angle-b.settings.angle||a.settings.elevation-b.settings.elevation||a.settings.tipX-b.settings.tipX||a.settings.tipY-b.settings.tipY;
};}
function mergeResults(parts,req,elapsedMs,workerCount,mode){
 const compare=resultCompare(req.options.objective),all=parts.flatMap(p=>p?.results||[]).sort(compare),unique=[];
 for(const r of all){if(!unique.some(p=>p.method===r.method&&p.firstId===r.firstId&&p.secondId===r.secondId&&Math.abs(p.settings.angle-r.settings.angle)<.1&&Math.abs(p.settings.speed-r.settings.speed)<.12&&Math.abs(p.settings.elevation-r.settings.elevation)<.1&&Math.abs(p.settings.tipX-r.settings.tipX)<.05&&Math.abs(p.settings.tipY-r.settings.tipY)<.05))unique.push({...r});}
 const methods=req.options.mode==='direct'?['direct']:req.options.methods;
 const selected=Array.isArray(methods)?methods.flatMap(id=>unique.filter(r=>r.method===id).slice(0,2)).sort(compare):unique.slice(0,3);
 selected.forEach((r,i)=>r.id=i+1);
 const sum=k=>parts.reduce((n,p)=>n+(Number(p?.[k])||0),0),byMethod=new Map();
 for(const p of parts)for(const m of p?.methods||[]){const old=byMethod.get(m.id)||{id:m.id,label:m.label,tested:0,total:0,found:0,evaluated:0,rejected:0,fraction:0};for(const k of ['tested','total','found','evaluated','rejected','fraction'])old[k]+=Number(m[k])||0;byMethod.set(m.id,old);}
 return{tested:sum('tested'),total:req.options.budget*(req.options.mode==='three'&&Array.isArray(req.options.methods)?req.options.methods.length:1),found:sum('found'),evaluated:sum('evaluated'),rejected:sum('rejected'),fraction:sum('fraction'),elapsedMs,workerCount,executionMode:mode,methods:[...byMethod.values()],results:selected,nearest:parts.map(p=>p?.nearest).filter(Boolean).sort((a,b)=>a.score-b.score)[0]||null,options:{...req.options},hz:Math.round(1/req.snapshot.dt),globalOptimal:false};
}
class OptimizerService{
 constructor(onProgress,onResult,onError){this.version=0;this.onProgress=onProgress;this.onResult=onResult;this.onError=onError;this.workers=[];this.worker=null;this.latest=null;this.mode='worker';}
 request(req){
  this.cancel();const id=this.version;this.latest=req;this.started=performance.now();
  const count=workerLimit(req.options.workers),parts=Array(count).fill(null),done=new Set();this.mode=count>1?'worker-pool':'worker';
  try{
   const code=['engine','math','physics','forecast','route-rules','route-sampler','optimizer-core','optimizer','optimizer-worker'].map(k=>document.getElementById('source-'+k).textContent).join('\n');
   const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
   try{for(let index=0;index<count;index++){
    const worker=new Worker(url);this.workers.push(worker);this.worker=this.workers[0];
    const current=()=>id===this.version&&this.workers.includes(worker);
    worker.onmessage=({data})=>{
     if(!current()||data.requestId!==id)return;
     if(data.error){this.recover(req,id);return;}
     parts[index]=data.result||data.progress;
     const merged=mergeResults(parts.map(p=>p?.partialResult?{...p.partialResult,...p}:p),req,performance.now()-this.started,count,this.mode);
     if(data.result)done.add(index);
     if(done.size===count){this.stopWorkers();this.latest=null;this.onResult(merged);}
     else this.onProgress({...merged,partialResult:{...merged,partial:true}});
    };
    worker.onerror=e=>{e.preventDefault?.();if(current())this.recover(req,id);};
    worker.postMessage({...req,partition:{index,count},type:'search',requestId:id});
   }}finally{URL.revokeObjectURL(url);}
  }catch{this.recover(req,id);}
 }
 stopWorkers(){for(const worker of this.workers)worker.terminate();this.workers=[];this.worker=null;}
 recover(req,id){if(id!==this.version||this.recovering===id)return;this.recovering=id;this.stopWorkers();this.fallback(req,id);}
 async fallback(req,id){
  this.mode='cooperative';let search;
  try{
   search=G.LabOptimizer.createSearch(G.RAPIER,req);let last=0,done=false;
   while(!done){if(id!==this.version){G.LabOptimizer.disposeSearch(search);return;}
    const until=performance.now()+8;
    do{done=G.LabOptimizer.advanceSearch(search,16);}while(!done&&performance.now()<until);
    if(id!==this.version){G.LabOptimizer.disposeSearch(search);return;}
    if(performance.now()-last>180||done){this.onProgress({...G.LabOptimizer.progress(search),workerCount:0,executionMode:'cooperative',partialResult:G.LabOptimizer.previewSearch(search)});last=performance.now();}
    if(!done)await new Promise(r=>setTimeout(r,0));
   }
   if(id===this.version){this.latest=null;this.onResult({...G.LabOptimizer.finishSearch(search),workerCount:0,executionMode:'cooperative',elapsedMs:performance.now()-this.started});}search=null;
  }catch(e){if(search){try{G.LabOptimizer.disposeSearch(search);}catch{ /* Preserve the originating error. */ }}if(id===this.version){this.latest=null;this.onError(e.message||String(e));}}
 }
 cancel(){this.version++;this.stopWorkers();this.latest=null;this.recovering=null;}
 dispose(){this.cancel();}
}
G.OptimizerService=OptimizerService;G.OptimizerPool={workerLimit,mergeResults};
})(globalThis);
