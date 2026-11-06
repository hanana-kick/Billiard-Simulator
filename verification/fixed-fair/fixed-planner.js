/* Inverse problem coordinator. Discrete contact topology is the domain;
 * cue inputs are root-solved, never scanned or sent to the legacy sampler. */
(function(G){
'use strict';
const activeElapsed=s=>Math.max(0,(s.pausedAt??performance.now())-s.started-(s.idleMs||0));
const terminal=s=>['verified','unconverged','unsupported','infeasible','cancelled','time-limit'].includes(s);
function validate(req){
 if(Object.hasOwn(req,'finalization')){if(!G.LabSourceFinalizationRequest)throw Error('Explicit source finalization modules unavailable');G.LabSourceFinalizationRequest.validate(req);}
 const o=req.options||{},domain={maxCushions:Number(o.maxCushions??3),horizonSeconds:Number(o.horizon??16),maxKisses:o.allowKiss===false?0:Number(o.maxKisses??1)};
 if(!Number.isInteger(domain.maxCushions)||domain.maxCushions<0||domain.maxCushions>12)throw Error('경로 영역의 최대 쿠션 수는 0–12 정수여야 합니다.');
 if(!Number.isInteger(domain.maxKisses)||domain.maxKisses<0||domain.maxKisses>4)throw Error('추가 키스 접촉 수는 0–4 정수여야 합니다.');
 if(!(domain.horizonSeconds>0&&domain.horizonSeconds<=30))throw Error('물리 검증 구간은 0초 초과, 30초 이하여야 합니다.');
 if(o.mode==='three'&&domain.maxCushions<3||o.fourBallThreeCushion&&domain.maxCushions<3)throw Error('3쿠션 조건에는 최대 쿠션 수가 3 이상이어야 합니다.');
 // Reuse authoritative input/goal validation only. This constructs no old search.
 G.LabOptimizer.validate({...req,testBudget:true,options:{...o,budget:1,inputStrategy:'hybrid'}});
 return domain;
}
function createStagedSearch(R,req,options={}){
 const domain=validate(req),started=performance.now(),finalization=Object.hasOwn(req,'finalization')?{admission:options.finalizationAdmission,policy:G.LabSourceFinalizationRequest.policyFor(options.finalizationAdmission,req,null,'verify')}:null;
 return{R,req,domain,...(finalization?{finalization}:{}),iterator:G.LabInverseGeometry.enumerate(req,domain),active:[],waiting:[],freshOnResume:true,dormant:[],archive:[],identities:new Set(),branches:[],pending:[],wave:0,nextId:0,finished:false,paused:false,exhausted:false,started,idleMs:0,pausedAt:null,deadline:started+Number(req.options.solveTimeMs??20000),evaluations:0,physicsSteps:0,iterations:0,firstSuccessCost:null,statusCounts:{verified:0,unconverged:0,unsupported:0,infeasible:0},initializationMs:performance.now()-started,planningMs:0,maxPlanningMs:0};
}
function checkFinalization(s){if(s.finalization)G.LabSourceFinalizationRequest.policyFor(s.finalization.admission,s.req,null,'verify');}
function gameplay(s){return s.finalization?.policy.policy==='source-gameplay-finalization-v1';}
// Publication and commit share the same replay admission. This reads only the
// current pending wave; it neither accepts a solver probe nor advances a world.
const issuedVerificationJobs=new WeakMap();
const normalizedAngle=a=>((a+180)%360+360)%360-180;
function exactData(a,b){
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&exactData(a[k],b[k]));
}
function admittedVerifiedRow(s,job,outcome){
 const issued=job&&issuedVerificationJobs.get(job);
 if(!issued||issued.req!==s.req||!exactData(issued.binding,{id:job.id,wave:job.wave,branchId:job.branchId,solverId:job.solverId,settings:job.settings,topology:job.topology}))return null;
 if(!job||!s.pending.includes(job)||job.req!==s.req||job.kind!=='inverse-constraint'||job.purpose!=='verify'||job.wave!==s.wave-1)return null;
 const entry=s.active.find(e=>e.branch.id===job.branchId);
 if(!entry||job.topology!==entry.branch||job.branchId!==job.topology.id||entry.state.status!=='running'||entry.state.phase!=='verify')return null;
 const probe=entry.state.pending?.find(p=>p.id===job.solverId);
 if(!probe||probe.purpose!=='verify'||Object.hasOwn(entry.state.received||{},probe.id))return null;
 // Solver.next returns a JSON copy; its angle is normalized when jobs are made.
 const settings=JSON.parse(JSON.stringify(probe.settings));settings.angle=normalizedAngle(settings.angle);
 if(!exactData(settings,JSON.parse(JSON.stringify(job.settings))))return null;
 const shot=outcome?.physicalResult;
 if(!outcome||outcome.purpose!=='verify'||outcome.id!==job.branchId||outcome.verified!==true||outcome.goalVerified!==true||outcome.freshReplay!==true||outcome.topologyMatched!==true||outcome.prefixOnly===true||outcome.completePhysicalReplay===false||outcome.incomplete===true||outcome.unsupported===true||outcome.mismatch||shot?.success!==true)return null;
 if(!exactData(outcome.settings,job.settings)||!exactData(shot.settings,job.settings)||!Array.isArray(outcome.inequalities)||!outcome.inequalities.every(v=>Number.isFinite(v)&&v<=0)||outcome.eventPrefix!==job.topology.events?.length)return null;
 if(shot.firstId!==(job.topology.firstId??s.req.options.targetId)||shot.secondId!==(job.topology.secondId??s.req.options.secondId))return null;
 if(gameplay(s)&&(!G.LabSourceFinalizationRequest.matchesGameplayOutcome(s.req,job,outcome)||!G.LabSourceFinalizationRequest.verifiedGameplay(s.req,job,outcome)))return null;
 return G.structuredClone({...shot,...(gameplay(s)?{finalization:outcome.finalization}:{}),method:entry.branch.method,methodLabel:G.LabRouteRules.byId.get(entry.branch.method)?.label,searchModel:{stage:'inverse-constraint-solution',topologyId:entry.branch.id},inverseBranch:entry.branch.id});
}
const compareRows=s=>s.req.options.objective==='gentle'?(a,b)=>a.settings.speed-b.settings.speed||a.distance-b.distance:(a,b)=>a.distance-b.distance||a.settings.speed-b.settings.speed;
function finishBranch(s,entry){
 const r=G.LabInverseSolver.result(entry.state);if(!terminal(r.status))return false;
 if(r.status==='unconverged'||r.status==='time-limit')s.dormant.push(entry);
 s.iterations+=Math.max(0,(r.iterations||0)-(entry.accountedIterations||0));entry.accountedIterations=r.iterations||0;
 const record={id:entry.branch.id,status:r.status,reason:r.reason||null,iterations:r.iterations||0,residualNorm:r.residualNorm??null},index=s.branches.findIndex(b=>b.id===entry.branch.id);if(index<0)s.branches.push(record);else s.branches[index]=record;
 const row=entry.verifiedRow;
 if(r.status==='verified'&&row){
  const key=G.LabRouteRules.successIdentity(row);if(!s.identities.has(key)){s.identities.add(key);s.archive.push(row);}
  if(!s.firstSuccessCost)s.firstSuccessCost={elapsedMs:activeElapsed(s),physicsSteps:s.physicsSteps,rootIterations:s.iterations+[...s.active,...s.waiting].reduce((n,e)=>n+Math.max(0,(G.LabInverseSolver.result(e.state).iterations||0)-(e.accountedIterations||0)),0),scope:'inverse-constraints'};
 }
 return true;
}
function planWave(s){
 checkFinalization(s);
 if(s.pending.length)throw Error('Accept the current constraint evaluations before planning another wave.');
 const start=performance.now();if(s.finished)return[];
 s.active=s.active.filter(e=>!finishBranch(s,e));
 if(performance.now()>=s.deadline){s.finished=true;s.paused=true;s.pausedAt=performance.now();return[];}
 // Bounded service quantum; move only at completed dependency boundaries.
 const retain=[];
 for(const e of s.active){
  if((e.serviceSteps||0)>=65536&&e.state.phase!=='verify'){
   e.serviceSteps=0;s.waiting.push(e);s.quantumScheduling=true;
  }else retain.push(e);
 }
 s.active=retain;
 // Four independent branch problems are a scheduling frontier, not a search cap.
 // All remaining topology branches stay in the resumable iterator.
 let yielded=0;
 while(s.active.length<4&&(!s.exhausted||s.waiting.length)){
  // Alternate fresh admission and FIFO continuation; neither can starve.
  if(s.waiting.length&&(s.exhausted||s.quantumScheduling&&s.scheduleResumeNext)){
   s.active.push(s.waiting.shift());s.scheduleResumeNext=false;continue;
  }
  const next=s.iterator.next();if(next.done){s.exhausted=true;break;}const branch=next.value;
  // A classification checkpoint is not a topology result. Return control even
  // when no inverse initializer was found in this bounded geometry chunk.
  if(branch?.checkpoint===true)break;
  if(!branch?.settings||branch.status==='unsupported'||branch.status==='unresolved'){
   s.statusCounts.unsupported++;s.branches.push({id:branch?.id,status:'unsupported',reason:branch?.reason||'No supported inverse initializer for this contact branch.'});
  }else{
   const o=s.req.options,seed=branch.settings;
   const state=G.LabInverseSolver.create({seed,topology:branch,bounds:{angle:[seed.angle-180,seed.angle+180],elevation:o.elevationMode==='fixed'?[s.req.settings.elevation,s.req.settings.elevation]:[o.minElevation??0,o.maxElevation??85],speed:[o.minSpeed??.5,o.maxSpeed??4.5],tipX:o.spin?[-.55,.55]:[0,0],tipY:o.spin?[-.45,.45]:[0,0]},tipRadius:.6},{maxIterations:40,residualTolerance:1e-4});
   s.active.push({branch,state,serviceSteps:0});s.scheduleResumeNext=true;
  }
  // Yield the main thread while classifying a large unresolved geometry domain.
  if(++yielded>=32&&performance.now()-start>6)break;
 }
 // Once enumeration is exhausted, drain preserved running roots before the domain can finish.
 if(s.exhausted)while(s.active.length<4&&s.waiting.length)s.active.push(s.waiting.shift());
 const jobs=[];for(const entry of s.active){
  const next=G.LabInverseSolver.next(entry.state)||[];
  for(const probe of next)jobs.push({kind:'inverse-constraint',id:s.nextId++,solverId:probe.id,branchId:entry.branch.id,purpose:probe.purpose,settings:{...probe.settings,angle:normalizedAngle(probe.settings.angle)},topology:entry.branch,req:s.req,wave:s.wave});
 }
 for(const job of jobs)if(job.purpose==='verify')issuedVerificationJobs.set(job,{req:s.req,binding:G.structuredClone({id:job.id,wave:job.wave,branchId:job.branchId,solverId:job.solverId,settings:job.settings,topology:job.topology})});
 s.pending=jobs;s.wave++;if(!jobs.length&&s.exhausted&&!s.active.length&&!s.waiting.length){s.finished=true;pause(s);}
 const elapsed=performance.now()-start;s.planningMs+=elapsed;s.maxPlanningMs=Math.max(s.maxPlanningMs,elapsed);return jobs;
}
function commitWave(s,outcomes){
 checkFinalization(s);
 const byId=new Map(outcomes.map(x=>[x.id,x.outcome]));if(outcomes.length!==byId.size||byId.size!==s.pending.length||s.pending.some(j=>!byId.has(j.id)))throw Error('Incomplete inverse evaluation wave');
 // Validate the complete explicit verify wave before changing counters, roots,
 // or archive state. Missing/swapped transport proof is not a physical miss.
 if(gameplay(s))for(const job of s.pending.filter(j=>j.purpose==='verify')){
  const valid=G.LabSourceFinalizationRequest.matchesGameplayOutcome(s.req,job,byId.get(job.id));
  if(!valid){const error=new Error('Source finalization receipt mismatch for candidate '+job.id);error.code='SOURCE_FINALIZATION_RECEIPT_MISMATCH';throw error;}
 }
 const admitted=new Map(s.pending.map(job=>[job.id,admittedVerifiedRow(s,job,byId.get(job.id))]));
 for(const entry of s.active){const rows=[];for(const job of s.pending.filter(j=>j.branchId===entry.branch.id)){
   let outcome=byId.get(job.id);if(job.purpose==='verify'){const row=admitted.get(job.id);if(row)entry.verifiedRow=row;else delete entry.verifiedRow;}s.evaluations++;s.physicsSteps+=outcome.steps||0;entry.serviceSteps=(entry.serviceSteps||0)+(outcome.steps||0);
   if(gameplay(s)&&job.purpose==='verify'){
    if(G.LabSourceFinalizationRequest.verifiedGameplay(s.req,job,outcome)){entry.verifiedOutcome=G.structuredClone(outcome);entry.verifiedJob=G.structuredClone({purpose:job.purpose,settings:job.settings,topology:job.topology});entry.verifiedShot=outcome.physicalResult;}
    else{delete entry.verifiedOutcome;delete entry.verifiedJob;delete entry.verifiedShot;/* Matching non-positive source result stays valueless and keeps its exact reason. */}
   }else if(job.purpose==='verify'&&outcome.verified&&outcome.physicalResult?.success)entry.verifiedShot=outcome.physicalResult;
   rows.push({...outcome,id:job.solverId});
  }if(rows.length)G.LabInverseSolver.accept(entry.state,rows);
 }
 s.pending=[];s.active=s.active.filter(e=>!finishBranch(s,e));
 if(s.exhausted&&!s.active.length&&!s.waiting.length){s.finished=true;pause(s);}
}
function stagedResult(s){
 const elapsedMs=activeElapsed(s),results=s.archive.slice().sort(compareRows(s)).map((r,i)=>({...r,id:i+1}));
 const terminationReason=s.paused?'time-limit':s.finished?'topology-domain-finished':'running';
 return{results,resultCount:results.length,resultLimit:null,found:results.length,tested:s.evaluations,evaluated:s.evaluations,total:null,physicsSteps:s.physicsSteps,elapsedMs,options:{...s.req.options},inputStrategy:'inverse-constraints',searchModel:'topology-constrained-inverse-root-solve',terminationReason,continuable:s.paused||!s.finished||s.dormant.length>0,partial:!s.finished||s.paused,domain:s.domain,domainExhausted:s.exhausted,statusCounts:s.branches.reduce((a,b)=>(a[b.status]=(a[b.status]||0)+1,a),{verified:0,unconverged:0,unsupported:0,infeasible:0}),branches:s.branches.slice(),rootIterations:s.iterations+[...s.active,...s.waiting].reduce((n,e)=>n+Math.max(0,(G.LabInverseSolver.result(e.state).iterations||0)-(e.accountedIterations||0)),0),topologiesResolved:s.branches.length,activeTopologies:s.active.length,suspendedTopologies:s.waiting.length,resumableBranches:s.dormant.length,firstSuccessCost:s.firstSuccessCost,globalOptimal:false,exhaustive:false,feasibilityStatus:results.length?'verified-feasible-shot':s.paused?'unconverged-time-limit':'unconverged-or-unsupported',candidatePlan:{version:'inverse-constraints-1',workerIndependent:true,planningMs:s.planningMs,maxPlanningMs:s.maxPlanningMs},hz:Math.round(1/s.req.snapshot.dt)};
}
function stagedVerifiedResult(s,outcomes){
 checkFinalization(s);
 const result=stagedResult(s),rows=s.archive.slice(),seen=new Set(rows.map(r=>G.LabRouteRules.successIdentity(r)));
 for(const job of s.pending){
  if(!outcomes.has(job.id))continue;
  const row=admittedVerifiedRow(s,job,outcomes.get(job.id));if(!row)continue;
  const key=G.LabRouteRules.successIdentity(row);if(!seen.has(key)){seen.add(key);rows.push({...row,publicationStatus:'verified-pending-wave'});}
 }
 result.results=G.structuredClone(rows.sort(compareRows(s))).map((r,i)=>({...r,id:i+1}));
 result.resultCount=result.found=result.results.length;
 if(result.results.length)result.feasibilityStatus='verified-feasible-shot';
 return result;
}
function resume(s){
 checkFinalization(s);
 if(s.exhausted&&!s.active.length&&!s.waiting.length&&!s.dormant.length)return false;
 // A wall-clock pause is transport/lifecycle state, never a scheduling event.
 // Keep active roots, FIFO order, quantum counters and admission turn intact,
 // including pauses before the first service quantum. Only planWave's completed
 // physics-step quantum scheduler may rotate running roots.
 // Reopen numerically unfinished branches without resetting their solved state.
 // More iterations are not new cue-input samples or discarded random restarts.
 if(s.exhausted&&!s.active.length&&!s.waiting.length){const reopen=s.dormant.splice(0,4);for(const e of reopen){e.state=G.LabInverseSolver.resume(e.state,{maxIterations:(e.state.options?.maxIterations||40)+40});s.active.push(e);}}
 if(s.pausedAt!==null){s.idleMs+=performance.now()-s.pausedAt;s.pausedAt=null;}
 s.finished=false;s.paused=false;s.deadline=performance.now()+Number(s.req.options.solveTimeMs??20000);return true;
}
function pause(s){if(s.pausedAt===null)s.pausedAt=performance.now();}
function disposeSearch(s){s.active=[];s.waiting=[];s.dormant=[];s.pending=[];s.finished=true;}
G.LabInversePlanner={validate,createStagedSearch,planWave,commitWave,stagedResult,stagedVerifiedResult,resume,pause,disposeSearch};
})(globalThis);
