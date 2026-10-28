(function(G){
'use strict';
// Automatic maximum useful concurrency, with explicit finite resource guards.
// Memory is a conservative estimate, not a measurement or allocation guarantee.
function workerPlan(req={},env=G){
 const n=env.navigator||{},raw=Number(n.hardwareConcurrency),cores=Number.isFinite(raw)&&raw>0?Math.floor(raw):2;
 const memory=Number(n.deviceMemory),memoryCap=Number.isFinite(memory)&&memory>0?Math.max(1,Math.floor(memory*1024/2/128)):64;
 const o=req.options||{},jobs=o.searchAlgorithm==='inverse-constraints'?40:Math.max(1,Math.floor(Number(o.budget)||48))*(o.mode==='three'?Math.max(1,o.methods?.length||1):1);
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
 constructor(onProgress,onResult,onError){this.version=0;this.onProgress=onProgress;this.onResult=onResult;this.onError=onError;this.workers=[];this.watchdogs=new Map();this.busy=new Map();this.worker=null;this.latest=null;}
 request(req){
  this.cancel();const id=this.version;this.latest=req;this.started=performance.now();this.mode='worker';
  this.plan={...workerPlan(req),startupTimeoutMs:45000,progressTimeoutMs:30000};this.retryOverhead={tested:0,physicsSteps:0};this.workerFallbackReason=null;
  const start=finalizationAdmission=>{if(id!==this.version||this.latest!==req)return;try{this.api=req.options.searchAlgorithm==='inverse-constraints'?G.LabInversePlanner:G.LabOptimizer;this.search=this.api.createStagedSearch(G.RAPIER,req,...(Object.hasOwn(req,'finalization')?[{finalizationAdmission}]:[]));this.loadWave();this.startPool(req,id,this.plan.requestedWorkers);}catch(e){this.fail(e,id);}};
  if(Object.hasOwn(req,'finalization')){if((req.finalization?.policy==='source-gameplay-finalization-v1'&&req.options.searchAlgorithm!=='inverse-constraints')||!G.LabSourceFinalizationRequest){this.fail(Error('Explicit source finalization requires the inverse source modules'),id);return;}return G.LabSourceFinalizationRequest.admit(req).then(start,e=>this.fail(e,id));}
  start();
 }
 loadWave(){this.jobs=this.api.planWave(this.search);this.queue=this.jobs.slice();this.outcomes=new Map();}
 startPool(req,id,wanted){
  let count=wanted;
  try{
   const code=['engine','math','physics','forecast','route-rules','route-sampler','optimizer-core','optimizer',...(req.options.searchAlgorithm==='inverse-constraints'?['game-rules','source-query-finalization-policy','source-finalization-request','source-gameplay-finalization-owner','inverse-events']:[]),'optimizer-worker'].map(k=>document.getElementById('source-'+k).textContent).join('\n');
   const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
   try{
    while(count>=1){try{for(let i=0;i<count;i++)this.workers.push(new Worker(url));break;}catch{this.stopWorkers();if(count===1)throw Error('Worker construction unavailable');count=Math.max(1,Math.floor(count/2));}}
    this.worker=this.workers[0];this.actualWorkers=count;this.mode=count>1?'worker-pool':'worker';
    for(const worker of this.workers){
     worker.onmessage=({data})=>{
      const task=this.busy.get(worker);if(id!==this.version||!task||data.requestId!==id||data.candidateId!==task.job.id)return;
      if(data.error){task.steps=Math.max(task.steps,Number(data.failedStep)||0);this.recover(req,id,'worker-error');return;}
      this.clearWatchdog(worker);
      if(data.outcome){this.outcomes.set(task.job.id,data.outcome);this.busy.delete(worker);this.pump(req,id);if(id===this.version&&this.latest)this.report(false);}
      else{task.steps=Math.max(task.steps,Number(data.steps)||0);this.armWatchdog(worker,req,id,false);this.report(false);}
     };
     worker.onerror=e=>{e.preventDefault?.();if(id===this.version&&this.workers.includes(worker))this.recover(req,id,'worker-error');};
    }
    this.pump(req,id);
   }finally{URL.revokeObjectURL(url);}
  }catch{this.recover(req,id,'worker-startup-failure');}
 }
 pump(req,id){
  if(id!==this.version||this.mode==='cooperative')return;
  if(this.outcomes.size===this.jobs.length){try{if(this.completeWave())return;}catch(error){this.fail(error,id);return;}}
  if(id!==this.version||this.mode==='cooperative')return;
  if(!this.jobs.length){setTimeout(()=>this.pump(req,id),0);return;}
  for(const worker of this.workers){if(this.busy.has(worker)||!this.queue.length)continue;const job=this.queue.shift();this.busy.set(worker,{job,steps:0});this.armWatchdog(worker,req,id,true);worker.postMessage({type:'evaluate',requestId:id,candidateId:job.id,job});}
 }
 completeWave(){
  this.api.commitWave(this.search,this.jobs.map(job=>({id:job.id,outcome:this.outcomes.get(job.id)})));
  if(this.search.finished){this.stopWorkers();this.latest=null;this.report(true);return true;}
  this.loadWave();if(this.search.finished){this.stopWorkers();this.latest=null;this.report(true);return true;}this.report(false);return false;
 }
 report(final){
  const result=this.api.stagedResult(this.search),elapsedMs=this.api===G.LabInversePlanner?result.elapsedMs:performance.now()-this.started;
  // Expose already verified in-flight-wave successes without committing adaptive state.
  if(!final&&this.outcomes.size&&this.latest?.options.searchAlgorithm!=='inverse-constraints'){
   const rows=[...result.results];for(const job of this.jobs){const r=this.outcomes.get(job.id)?.result;if(r?.success)rows.push({...r,methodLabel:G.LabRouteRules?.byId.get(r.method)?.label});}
   const identity=G.LabRouteRules?.successIdentity||(r=>JSON.stringify([r.firstId,r.secondId,r.settings,r.contacts]));const seen=new Set();result.results=rows.sort(resultCompare(this.latest?.options.objective)).filter(r=>{const key=identity(r);if(seen.has(key))return false;seen.add(key);return true;}).map((r,i)=>({...r,id:i+1}));result.resultCount=result.results.length;if(result.results.length){result.feasibilityStatus='verified-feasible-shot';result.nearest=null;}result.found+=Array.from(this.outcomes.values()).filter(x=>x.result?.success).length;
  }
  result.evaluatedInWave=final?0:this.outcomes.size;
  const decorated={...result,elapsedMs,workerCount:this.mode==='cooperative'?0:this.actualWorkers,executionMode:this.mode,workerPlan:this.plan,retryOverhead:{...this.retryOverhead,reportedLowerBound:true},workerFallbackReason:this.workerFallbackReason,workAttemptTotal:{reportedLowerBound:true,tested:result.tested+this.retryOverhead.tested,physicsSteps:result.physicsSteps+this.retryOverhead.physicsSteps}};
  if(final)this.onResult(decorated);else this.onProgress({...decorated,partialResult:{...decorated,partial:true}});
 }
 clearWatchdog(worker){const timer=this.watchdogs.get(worker);if(timer!==undefined)clearTimeout(timer);this.watchdogs.delete(worker);}
 armWatchdog(worker,req,id,startup){this.clearWatchdog(worker);this.watchdogs.set(worker,setTimeout(()=>{if(id===this.version&&this.workers.includes(worker))this.recover(req,id,startup?'worker-startup-timeout':'worker-progress-timeout');},startup?this.plan.startupTimeoutMs:this.plan.progressTimeoutMs));}
 stopWorkers(){for(const worker of this.workers){this.clearWatchdog(worker);worker.terminate();}this.workers=[];this.worker=null;}
 recover(req,id,reason){
  if(id!==this.version||this.recovering===id)return;this.recovering=id;this.workerFallbackReason=reason;
  for(const task of this.busy.values()){this.retryOverhead.tested++;this.retryOverhead.physicsSteps+=task.steps;}
  this.stopWorkers();this.busy.clear();this.queue=this.jobs.filter(job=>!this.outcomes.has(job.id));this.mode='cooperative';this.fallback(req,id);
 }
 async fallback(req,id){
  let evaluation,lastReport=0;
  try{
   while(id===this.version){
    for(const job of this.queue){
     if(id!==this.version)return;
     const beginOptions={purpose:job.purpose};
     if(job.kind==='inverse-constraint'&&Object.hasOwn(job.req,'finalization')){if(!G.LabSourceFinalizationRequest)throw Error('Explicit source finalization modules unavailable');if(G.LabSourceFinalizationRequest.needsAdmission(job.req,job.purpose)){beginOptions.finalizationAdmission=await G.LabSourceFinalizationRequest.admit(job.req);if(id!==this.version)return;}}
     evaluation=job.kind==='inverse-constraint'?G.LabInverseEvents.begin(G.RAPIER,job.req,job.topology,job.settings,beginOptions):G.ShotSearchCore.beginCandidate(G.RAPIER,job);
     let done=job.kind==='inverse-constraint'?false:!evaluation.trial;
     while(!done){const until=performance.now()+8;do{done=job.kind==='inverse-constraint'?G.LabInverseEvents.advance(evaluation,16):G.ShotSearchCore.stepTrial(evaluation.search,evaluation.trial,16);}while(!done&&performance.now()<until);if(performance.now()-lastReport>160){this.report(false);lastReport=performance.now();}if(!done)await new Promise(r=>setTimeout(r,0));if(id!==this.version){if(job.kind==='inverse-constraint')G.LabInverseEvents.dispose(evaluation);else evaluation.trial?.lab.dispose();return;}}
     this.outcomes.set(job.id,job.kind==='inverse-constraint'?G.LabInverseEvents.finish(evaluation):G.ShotSearchCore.finishCandidate(evaluation));evaluation=null;this.report(false);
    }
    if(id!==this.version)return;if(this.completeWave())return;if(req.options.searchAlgorithm==='inverse-constraints')await new Promise(r=>setTimeout(r,0));
   }
  }catch(e){try{if(evaluation&&this.latest?.options.searchAlgorithm==='inverse-constraints')G.LabInverseEvents.dispose(evaluation);else evaluation?.trial?.lab.dispose();}catch{}this.fail(e,id);}
 }
 fail(error,id){if(id!==this.version)return;this.stopWorkers();this.latest=null;this.onError(error.message||String(error));}
 resume(){
  if(this.api!==G.LabInversePlanner||!this.search)return false;
  this.cancel();try{if(!this.api.resume(this.search))return false;}catch(error){this.onError(error.message||String(error));return false;}const id=this.version,req=this.search.req;this.latest=req;this.started=performance.now();this.recovering=null;
  if(this.search.pending.length){this.queue=this.jobs.filter(j=>!this.outcomes.has(j.id));}else this.loadWave();
  this.startPool(req,id,this.plan.requestedWorkers);return true;
 }
 cancel(){if(this.search&&this.latest)this.api?.pause?.(this.search);this.version++;this.stopWorkers();this.busy.clear();this.latest=null;this.recovering=null;}
 dispose(){this.cancel();}
}
G.OptimizerService=OptimizerService;G.OptimizerPool={workerLimit,workerPlan,mergeResults};
})(globalThis);
