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
function doneReason(parts){return parts.every(p=>p?.terminationReason==='candidate-budget-exhausted')?'candidate-budget-exhausted':'partial';}
function mergeResults(parts,req,elapsedMs,workerCount,mode){
 const compare=resultCompare(req.options.objective),all=parts.flatMap(p=>p?.results||[]).sort(compare),unique=[];
 const identity=G.LabRouteRules?.successIdentity||(r=>JSON.stringify([r.method,r.firstId,r.secondId,r.settings,(r.contacts||[]).map(e=>[e.kind,e.id,e.label])]));
 const seen=new Set();for(const r of all){const key=identity(r);if(!seen.has(key)){seen.add(key);unique.push({...r});}}

 const methods=req.options.mode==='direct'?['direct']:req.options.mode==='carom'?['any']:req.options.methods;
 const selected=unique;
 selected.forEach((r,i)=>r.id=i+1);
 const sum=k=>parts.reduce((n,p)=>n+(Number(p?.[k])||0),0),byMethod=new Map();
 for(const p of parts)for(const m of p?.methods||[]){const old=byMethod.get(m.id)||{id:m.id,label:m.label,tested:0,total:0,found:0,evaluated:0,rejected:0,fraction:0};for(const k of ['tested','total','found','evaluated','rejected','fraction'])old[k]+=Number(m[k])||0;byMethod.set(m.id,old);}
 return{tested:sum('tested'),total:req.options.budget*(req.options.mode==='three'&&Array.isArray(req.options.methods)?req.options.methods.length:1),found:sum('found'),evaluated:sum('evaluated'),rejected:sum('rejected'),fraction:sum('fraction'),elapsedMs,workerCount,executionMode:mode,methods:[...byMethod.values()],results:selected,nearest:parts.map(p=>p?.nearest).filter(Boolean).sort((a,b)=>a.score-b.score)[0]||null,options:{...req.options},hz:Math.round(1/req.snapshot.dt),globalOptimal:false,exhaustive:false,searchModel:parts.some(p=>p?.searchModel==='inverse-root-and-damped-physical-solver')?'inverse-root-and-damped-physical-solver':'inverse-seeds-forward-validation',physicsSteps:sum('physicsSteps'),solverStats:parts.reduce((a,p)=>{for(const k of ['probes','steps','accepted','rejected'])a[k]+=(p?.solverStats?.[k]||0);return a;},{probes:0,steps:0,accepted:0,rejected:0}),terminationReason:doneReason(parts),seedMaxOrder:Math.max(0,...parts.map(p=>p?.seedMaxOrder||0)),seedCushionRange:(req.options.mode==='carom'||req.options.mode==='three'&&req.options.methods?.includes('any'))?[req.options.mode==='three'?3:0,Math.max(req.options.mode==='three'?3:0,...parts.map(p=>p?.seedMaxOrder||0))]:undefined,feasibilityStatus:selected.length?'verified-feasible-shot':'not-found-within-budget'};
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
