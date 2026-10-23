(function(G){
'use strict';
// Automatic maximum useful concurrency, with explicit finite resource guards.
// Memory is a conservative estimate, not a measurement or allocation guarantee.
function workerPlan(req={},env=G){
 const n=env.navigator||{},raw=Number(n.hardwareConcurrency),cores=Number.isFinite(raw)&&raw>0?Math.floor(raw):2;
 const memory=Number(n.deviceMemory),memoryCap=Number.isFinite(memory)&&memory>0?Math.max(1,Math.floor(memory*1024/2/128)):64;
 const o=req.options||{},jobs=Math.max(1,Math.floor(Number(o.budget)||48))*(o.mode==='three'?Math.max(1,o.methods?.length||1):1);
 const count=Math.max(1,Math.min(cores,memoryCap,64,jobs));
 return{hardwareConcurrency:cores,requestedWorkers:count,resourceMaximum:64,memoryWorkerEstimateMiB:128,memoryBudgetFraction:.5,memoryCap,workItems:jobs};
}
function workerLimit(_requested=0,env=G){return workerPlan({},env).requestedWorkers;}
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
 return{tested:sum('tested'),total:req.options.budget*(req.options.mode==='three'&&Array.isArray(req.options.methods)?req.options.methods.length:1),found:sum('found'),evaluated:sum('evaluated'),rejected:sum('rejected'),fraction:sum('fraction'),elapsedMs,workerCount,executionMode:mode,methods:[...byMethod.values()],results:selected,resultCount:selected.length,resultLimit:null,nearest:parts.map(p=>p?.nearest).filter(Boolean).sort((a,b)=>a.score-b.score)[0]||null,options:{...req.options},hz:Math.round(1/req.snapshot.dt),globalOptimal:false,exhaustive:false,inputStrategy:req.options.inputStrategy||'hybrid',searchModel:req.options.inputStrategy==='analytic'?'closed-form-inputs-with-physical-fallback':'hybrid-physical-search',analyticDiagnostics:parts.flatMap(p=>p?.analyticDiagnostics||[]),analyticStats:parts.reduce((a,p)=>{for(const k of ['proposed','feasible','evaluated'])a[k]+=(p?.analyticStats?.[k]||0);a.rejectedReasons=[...new Set([...a.rejectedReasons,...(p?.analyticStats?.rejectedReasons||[])])];return a;},{proposed:0,feasible:0,evaluated:0,rejectedReasons:[]}),firstSuccessCost:parts.map((p,index)=>p?.firstSuccessCost?{...p.firstSuccessCost,workerIndex:index,scope:workerCount>1||parts.length>1?'worker-local':'request'}:null).filter(Boolean).sort((a,b)=>a.elapsedMs-b.elapsedMs)[0]||null,physicsSteps:sum('physicsSteps'),solverStats:parts.reduce((a,p)=>{for(const k of ['probes','steps','accepted','rejected'])a[k]+=(p?.solverStats?.[k]||0);return a;},{probes:0,steps:0,accepted:0,rejected:0}),terminationReason:doneReason(parts),seedMaxOrder:Math.max(0,...parts.map(p=>p?.seedMaxOrder||0)),seedCushionRange:(req.options.mode==='carom'||req.options.mode==='three'&&req.options.methods?.includes('any'))?[req.options.mode==='three'?3:0,Math.max(req.options.mode==='three'?3:0,...parts.map(p=>p?.seedMaxOrder||0))]:undefined,feasibilityStatus:selected.length?'verified-feasible-shot':'not-found-within-budget'};
}
class OptimizerService{
 constructor(onProgress,onResult,onError){this.version=0;this.onProgress=onProgress;this.onResult=onResult;this.onError=onError;this.workers=[];this.worker=null;this.latest=null;this.mode='worker';this.watchdogs=new Map();}
 request(req){
  this.cancel();const id=this.version;this.latest=req;this.started=performance.now();
  this.plan={...workerPlan(req),startupTimeoutMs:45000,progressTimeoutMs:30000};this.workerFallbackReason=null;this.parts=[];this.retainedParts=[];this.retryOverhead={tested:0,physicsSteps:0};this.startPool(req,id,this.plan.requestedWorkers);
 }
 startPool(req,id,wanted){
  let count=wanted;this.mode=count>1?'worker-pool':'worker';
  try{
   const code=['engine','math','physics','forecast','route-rules','route-sampler','optimizer-core','optimizer','optimizer-worker'].map(k=>document.getElementById('source-'+k).textContent).join('\n');
   const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
   try{
    // Construct the entire pool before dispatch. A construction failure wastes no shots.
    while(count>=1){try{for(let i=0;i<count;i++)this.workers.push(new Worker(url));break;}catch{this.stopWorkers();if(count===1)throw Error('Worker construction unavailable');count=Math.max(1,Math.floor(count/2));}}
    this.worker=this.workers[0];this.mode=count>1?'worker-pool':'worker';this.parts=Array(count).fill(null);const done=new Set();
    for(let index=0;index<count;index++){
     const worker=this.workers[index],current=()=>id===this.version&&this.workers.includes(worker);
     worker.onmessage=({data})=>{
      if(!current()||data.requestId!==id)return;
      if(data.error){this.recover(req,id,'worker-error');return;}
      this.clearWatchdog(worker);if(!data.result)this.armWatchdog(worker,req,id,false);
      this.parts[index]=data.result||data.progress;
      const merged=this.decorate(mergeResults(this.parts.map(p=>p?.partialResult?{...p.partialResult,...p}:p),req,performance.now()-this.started,count,this.mode));
      if(data.result)done.add(index);
      if(done.size===count){this.stopWorkers();this.latest=null;this.onResult(merged);}
      else this.onProgress({...merged,partialResult:{...merged,partial:true}});
     };
     worker.onerror=e=>{e.preventDefault?.();if(current())this.recover(req,id,'worker-error');};
    }
    for(let index=0;index<count;index++){const worker=this.workers[index];this.armWatchdog(worker,req,id,true);worker.postMessage({...req,partition:{index,count},type:'search',requestId:id});}
   }finally{URL.revokeObjectURL(url);}
  }catch{this.recover(req,id,'worker-startup-failure');}
 }
 clearWatchdog(worker){const timer=this.watchdogs.get(worker);if(timer!==undefined)clearTimeout(timer);this.watchdogs.delete(worker);}
 armWatchdog(worker,req,id,startup){this.clearWatchdog(worker);this.watchdogs.set(worker,setTimeout(()=>{if(id===this.version&&this.workers.includes(worker))this.recover(req,id,startup?'worker-startup-timeout':'worker-progress-timeout');},startup?this.plan.startupTimeoutMs:this.plan.progressTimeoutMs));}
 decorate(result){return{...result,workerPlan:this.plan,retryOverhead:this.retryOverhead,workerFallbackReason:this.workerFallbackReason};}
 recoveryResult(req,part){
  const merged=mergeResults([...this.retainedParts,part],req,performance.now()-this.started,0,'cooperative');
  // Preserve earlier successes, but do not add failed-run progress to the new run.
  for(const key of ['tested','total','evaluated','rejected','fraction','terminationReason','methods','physicsSteps','solverStats'])if(part[key]!==undefined)merged[key]=part[key];
  return this.decorate({...merged,workAttemptTotal:{tested:(part.tested||0)+this.retryOverhead.tested,physicsSteps:(part.physicsSteps||0)+this.retryOverhead.physicsSteps}});
 }


 stopWorkers(){for(const worker of this.workers){this.clearWatchdog(worker);worker.terminate();}this.workers=[];this.worker=null;}
 recover(req,id,reason='worker-failure'){if(id!==this.version||this.recovering===id)return;this.recovering=id;this.workerFallbackReason=reason;this.retainedParts=(this.parts||[]).filter(Boolean).map(p=>p.partialResult?{...p.partialResult,...p}:p);this.retryOverhead={tested:this.retainedParts.reduce((n,p)=>n+(p.tested||0),0),physicsSteps:this.retainedParts.reduce((n,p)=>n+(p.physicsSteps||0),0)};this.stopWorkers();this.fallback(req,id);}
 async fallback(req,id){
  this.mode='cooperative';let search;
  try{
   search=G.LabOptimizer.createSearch(G.RAPIER,req);let last=0,done=false;
   while(!done){if(id!==this.version){G.LabOptimizer.disposeSearch(search);return;}
    const until=performance.now()+8;
    do{done=G.LabOptimizer.advanceSearch(search,16);}while(!done&&performance.now()<until);
    if(id!==this.version){G.LabOptimizer.disposeSearch(search);return;}
    if(performance.now()-last>180||done){const preview=this.recoveryResult(req,{...G.LabOptimizer.previewSearch(search),...G.LabOptimizer.progress(search)});this.onProgress({...preview,partialResult:{...preview,partial:true}});last=performance.now();}
    if(!done)await new Promise(r=>setTimeout(r,0));
   }
   if(id===this.version){this.latest=null;const final=this.recoveryResult(req,G.LabOptimizer.finishSearch(search));this.onResult({...final,restartedAfterWorkerFailure:true});}search=null;
  }catch(e){if(search){try{G.LabOptimizer.disposeSearch(search);}catch{ /* Preserve the originating error. */ }}if(id===this.version){this.latest=null;this.onError(e.message||String(e));}}
 }
 cancel(){this.version++;this.stopWorkers();this.latest=null;this.recovering=null;}
 dispose(){this.cancel();}
}
G.OptimizerService=OptimizerService;G.OptimizerPool={workerLimit,workerPlan,mergeResults};
})(globalThis);
