// Focused plumbing only: no PhysicsLab instantiation, trajectory, GPU, or UI.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
import '../src/math.js';import '../src/physics.js';import '../src/game-rules.js';
import '../src/inverse-solver.js';import '../src/source-query-finalization-policy.js';import '../src/source-finalization-request.js';import '../src/controller.js';
const A=globalThis.LabSourceFinalizationRequest,GAME=A.GAMEPLAY_FINALIZATION_POLICY,read=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8'),tick=()=>new Promise(r=>setImmediate(r));
function raw(){return{snapshot:{world:Uint8Array.of(11,22,33),objects:[1,2,3].map(id=>({id,shape:'sphere'})),dt:1/960},selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:-0,tipY:0},options:{searchAlgorithm:'inverse-constraints',gameMode:'free',mode:'three',targetId:2,secondId:3,maxCushions:3,maxKisses:1,horizon:8,spin:true,objective:'shortest',fourBallThreeCushion:false}};}
const bind=r=>A.bind(r,{gameKind:'three',snapshot:new ThreeBallGame().snapshot(),worldObjectIds:[1,2,3],shotRules:{threeCushion:true}});
function planner(){
 const seen=[],branch={id:'b1',method:'any',firstId:2,secondId:3,status:'supported',settings:{angle:0,elevation:8,speed:2,tipX:-0,tipY:0},events:[{kind:'object',id:2},{kind:'object',id:3}],extra:{value:-0}};
 const ctx={performance:{now:()=>0},structuredClone,Map,Set,LabSourceFinalizationRequest:A,LabOptimizer:{validate:()=>true},LabRouteRules:{byId:new Map(),successIdentity:JSON.stringify},LabInverseGeometry:{enumerate:()=>[branch][Symbol.iterator]()},LabInverseSolver:{create:()=>({status:'running',iterations:0}),next:()=>[{id:'verify1',purpose:'verify',settings:{...branch.settings}}],accept:(s,rows)=>{seen.push(...rows);s.status='verified';},result:s=>({status:s.status,iterations:0}),resume:s=>s}};
 vm.createContext(ctx);vm.runInContext(read('src/inverse-planner.js'),ctx);return{api:ctx.LabInversePlanner,seen,branch,ctx};
}
function positive(req,token,job){const out={purpose:'verify',settings:structuredClone(job.settings),verified:true,goalVerified:true,steps:1,physicalResult:{success:true,distance:1,firstId:2,secondId:3,settings:structuredClone(job.settings),contacts:[]},finalization:{kind:'source-gameplay-finalization-result-v1',policy:GAME,sourceIdentity:req.finalization.sourceIdentity,purpose:'verify',status:'verified-final-gameplay',gameplayVerified:true,physicalRest:true,finishedGameResult:{cueId:1,delta:1,nextCue:1},reason:null,evaluationBinding:A.evaluationBindingFor(token,req,job.topology,job.settings,'verify')}};out.routeQueryPhysicalResult=structuredClone(out.physicalResult);out.status=out.finalization.status;out.reason=null;out.incomplete=false;out.unsupported=false;out.verification={finalization:out.finalization};return out;}
test('planner requires admitted explicit request and keeps exact request through jobs/resume',async()=>{
 const req=await bind(raw()),token=await A.admit(req),h=planner();assert.throws(()=>h.api.createStagedSearch({},req),/same-realm/);
 const s=h.api.createStagedSearch({},req,{finalizationAdmission:token}),jobs=h.api.planWave(s);assert.equal(jobs[0].req,req);assert.equal(jobs[0].purpose,'verify');assert.equal(Object.hasOwn(jobs[0],'finalizationAdmission'),false,'tokens never serialize');
 req.snapshot.world[0]++;for(const fn of [()=>h.api.commitWave(s,[]),()=>h.api.resume(s)])assert.throws(fn,/changed after admission/);
});
test('planner archives only matching final gameplay proof, never prefix/stale/cross-probe receipt',async()=>{
 for(const mutate of [null,x=>delete x.finalization,x=>x.incomplete=true,x=>x.finalization.status='unsupported',x=>x.finalization.evaluationBinding.settings.speed=3,x=>x.finalization.evaluationBinding.topology.extra.value=0,x=>x.finalization.sourceIdentity='f'.repeat(64),x=>x.physicalResult.settings.speed=3,x=>x.physicalResult.firstId=99,x=>x.routeQueryPhysicalResult.distance=99,x=>delete x.routeQueryPhysicalResult]){
  const req=await bind(raw()),token=await A.admit(req),h=planner(),s=h.api.createStagedSearch({},req,{finalizationAdmission:token}),jobs=h.api.planWave(s);let out=structuredClone(positive(req,token,jobs[0]));if(mutate)mutate(out);s.active[0].verifiedShot={success:true};
  if(mutate){assert.throws(()=>h.api.commitWave(s,[{id:jobs[0].id,outcome:out}]),e=>e.code==='SOURCE_FINALIZATION_RECEIPT_MISMATCH');assert.equal(s.evaluations,0);assert.equal(s.physicsSteps,0);assert.equal(h.seen.length,0);assert.equal(s.pending.length,1);assert.equal(s.archive.length,0);}
  else{h.api.commitWave(s,[{id:jobs[0].id,outcome:out}]);const r=h.api.stagedResult(s);assert.equal(r.results.length,1);assert.equal(h.seen[0].verified,true);assert.equal(r.results[0].finalization.sourceIdentity,req.finalization.sourceIdentity);}
 }
});
test('verify receipt validation is whole-wave atomic, not a partially archived prefix',async()=>{
 const req=await bind(raw()),token=await A.admit(req),h=planner();h.ctx.LabInverseGeometry.enumerate=()=>[h.branch,{...h.branch,id:'b2'}][Symbol.iterator]();const s=h.api.createStagedSearch({},req,{finalizationAdmission:token}),jobs=h.api.planWave(s),outcomes=jobs.map(j=>({id:j.id,outcome:positive(req,token,j)}));delete outcomes[1].outcome.finalization;
 assert.throws(()=>h.api.commitWave(s,outcomes),e=>e.code==='SOURCE_FINALIZATION_RECEIPT_MISMATCH');assert.equal(s.evaluations,0);assert.equal(s.physicsSteps,0);assert.equal(s.archive.length,0);assert.equal(h.seen.length,0);assert.equal(s.pending.length,2);assert.equal(s.active.every(e=>!e.verifiedOutcome),true);
});
test('real solver verify phase receives valueless interruptions as unresolved, never archive success',async()=>{
 for(const status of ['incomplete','cancelled','stale','failed','unsupported']){
  const req=await bind(raw()),token=await A.admit(req),h=planner();h.ctx.LabInverseSolver=globalThis.LabInverseSolver;const s=h.api.createStagedSearch({},req,{finalizationAdmission:token}),probe=h.api.planWave(s);
  assert.equal(probe[0].purpose,'residual');h.api.commitWave(s,probe.map(j=>({id:j.id,outcome:{residuals:[0],goalVerified:true,verified:false,steps:0}})));
  const verify=h.api.planWave(s);assert.equal(verify[0].purpose,'verify');const out=positive(req,token,verify[0]);out.finalization.status=status;out.finalization.gameplayVerified=false;out.finalization.physicalRest=false;out.finalization.finishedGameResult=null;out.finalization.reason='bounded-'+status;
  const valueless={id:'b1',settings:out.settings,purpose:'verify',steps:4,status,reason:'bounded-'+status,verified:false,goalVerified:false,physicalResult:null,finalization:out.finalization,verification:{finalization:out.finalization},incomplete:status==='incomplete',unsupported:status==='unsupported',routeQueryObservation:{residuals:[0],goalVerified:true,physicalResult:{success:true}}};
  h.api.commitWave(s,[{id:verify[0].id,outcome:valueless}]);const r=h.api.stagedResult(s);assert.equal(r.results.length,0);assert.equal(r.branches[0].status,status==='unsupported'?'unsupported':'unconverged');assert.equal(r.branches[0].reason,'bounded-'+status);
 }
});
test('nonpositive receipt cannot hide contradictory labels, settings, flags or top-level prefix scalars',async()=>{
 const req=await bind(raw()),token=await A.admit(req);
 for(const mutate of [x=>x.status='evaluated-negative',x=>x.reason='other',x=>x.purpose='trial',x=>x.settings.tipX=0,x=>x.incomplete=false,x=>x.unsupported=true,x=>x.residuals=[0],x=>x.eventPrefix=2,x=>x.contactCell='prefix',x=>x.clearance=0,x=>x.finalization.finishedGameResult={cueId:1,delta:1,nextCue:1}]){
  const h=planner(),s=h.api.createStagedSearch({},req,{finalizationAdmission:token}),job=h.api.planWave(s)[0],f=structuredClone(positive(req,token,job).finalization);Object.assign(f,{status:'incomplete',reason:'bounded-prefix',gameplayVerified:false,physicalRest:false,finishedGameResult:null});
  const out={id:'b1',settings:structuredClone(job.settings),purpose:'verify',steps:4,status:'incomplete',reason:'bounded-prefix',finalization:f,verification:{finalization:f},verified:false,goalVerified:false,physicalResult:null,incomplete:true,unsupported:false,routeQueryObservation:{residuals:[0]}};
  assert.equal(A.matchesGameplayOutcome(req,job,out),true);mutate(out);assert.throws(()=>h.api.commitWave(s,[{id:job.id,outcome:out}]),e=>e.code==='SOURCE_FINALIZATION_RECEIPT_MISMATCH');assert.equal(s.evaluations,0);assert.equal(h.seen.length,0);
 }
});
test('archive preserves exact admitted binding outside unchanged lossy solver JSON copies',async()=>{
 const req=await bind(raw()),token=await A.admit(req),h=planner();h.ctx.LabInverseSolver=globalThis.LabInverseSolver;const s=h.api.createStagedSearch({},req,{finalizationAdmission:token}),probe=h.api.planWave(s);h.api.commitWave(s,probe.map(j=>({id:j.id,outcome:{residuals:[0],goalVerified:true,verified:false,steps:0}})));
 const verify=h.api.planWave(s),entry=s.active[0],out=positive(req,token,verify[0]);out.verification={finalization:out.finalization};h.api.commitWave(s,[{id:verify[0].id,outcome:out}]);
 assert.equal(Object.is(entry.state.verification.finalization.evaluationBinding.topology.extra.value,0),true,'legacy solver JSON behavior remains unchanged');assert.equal(Object.is(h.api.stagedResult(s).results[0].finalization.evaluationBinding.topology.extra.value,-0),true,'archive uses detached exact admitted receipt, not solver copy');
});
function controller(){
 const r=raw(),game=new ThreeBallGame(),sent=[],c=Object.create(LabController.prototype);c.state={settings:{...r.settings},routeOptions:{...r.options},selectedId:1,gameMode:'free',routeStatus:'idle',paused:true};c.game=game;c.lab={steps:0,revision:0,time:0,params:{},cue:null,objects:r.snapshot.objects.map(o=>({...o,body:{translation:()=>({x:0,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1})}})),anyMotion:()=>false,snapshot:()=>structuredClone(r.snapshot)};c.optimizer={request:req=>sent.push(req),cancel(){},resume(){c.resumes=(c.resumes||0)+1;return true;}};c.notify=()=>{};c.invalidate=()=>{};c.queuePrediction=()=>{};c.announce=message=>{c.notice=message;};c.changeSettings=()=>{c.applied=true;};return{c,r,game,sent};
}
test('Controller omission stays synchronous with no finalization envelope; explicit capture uses real ready game',async()=>{
 const old=globalThis.LabInversePlanner;globalThis.LabInversePlanner={validate:()=>true};try{
  const h=controller();assert.equal(h.c.startSearch(),undefined);assert.equal(h.sent.length,1);assert.equal(Object.hasOwn(h.sent[0],'finalization'),false);
  const x=controller(),pending=x.c.startSearch({finalizationPolicy:GAME});assert.equal(x.sent.length,0);await pending;assert.equal(x.sent.length,1);assert.deepEqual(x.sent[0].finalization.gameBinding.snapshot,x.game.snapshot());await A.admit(x.sent[0]);
  x.c.state.routeStatus='done';x.c.state.routeResult={results:[{id:1,settings:x.r.settings}]};x.game.scores[1]++;x.c.resumeSearch();x.c.applyRoute(1);assert.equal(x.c.resumes,undefined);assert.equal(x.c.applied,undefined);
 }finally{globalThis.LabInversePlanner=old;}
});
test('Controller async capture rejects changed source, cancellation and overwritten request generation',async()=>{
 const old=globalThis.LabInversePlanner;globalThis.LabInversePlanner={validate:()=>true};try{
  for(const change of [h=>h.c.lab.revision++,h=>h.game.scores[1]++,h=>h.c.cancelSearch('cancel'),h=>h.c.stopSearch()]){const h=controller(),p=h.c.startSearch({finalizationPolicy:GAME});change(h);await p;assert.equal(h.sent.length,0);assert.notEqual(h.c.state.routeStatus,'searching');}
  const h=controller(),p=h.c.startSearch({finalizationPolicy:GAME});h.c.startSearch();await p;assert.equal(h.sent.length,1);assert.equal(Object.hasOwn(h.sent[0],'finalization'),false);
 }finally{globalThis.LabInversePlanner=old;}
});
function workerHarness(helper){const begin=[],sent=[],ctx={RAPIER:{init:async()=>{}},performance,Promise,setTimeout,clearTimeout,LabSourceFinalizationRequest:helper,LabInverseEvents:{begin:(_R,req,topology,settings,options)=>{begin.push({req,topology,settings,options});return{};},advance:()=>true,finish:()=>({verified:false}),dispose(){}},self:{postMessage:m=>sent.push(m)}};vm.createContext(ctx);vm.runInContext(read('src/optimizer-worker.js'),ctx);return{ctx,begin,sent};}
test('worker awaits same-realm admission only for gameplay verify, and cancels before begin if superseded',async()=>{
 let calls=0,release;const token={},helper={needsAdmission:(_r,p)=>p==='verify',admit:async()=>{calls++;return token;}},h=workerHarness(helper),req={finalization:{policy:GAME}};
 for(const purpose of ['residual','jacobian','trial','clearance','verify'])await h.ctx.self.onmessage({data:{type:'evaluate',requestId:1,candidateId:purpose,job:{kind:'inverse-constraint',req,settings:{},topology:{},purpose}}});
 assert.equal(calls,1);for(const row of h.begin)assert.equal(Object.hasOwn(row.options,'finalizationAdmission'),row.options.purpose==='verify');assert.equal(h.begin.at(-1).options.finalizationAdmission,token);
 const x=workerHarness({needsAdmission:()=>true,admit:()=>new Promise(r=>release=r)}),pending=x.ctx.self.onmessage({data:{type:'evaluate',job:{kind:'inverse-constraint',req,purpose:'verify'}}});await tick();await x.ctx.self.onmessage({data:{type:'cancel'}});release(token);await pending;assert.equal(x.begin.length,0);
});
function serviceHarness(helper){
 const begun=[],created=[],results=[],errors=[],jobs=['residual','trial','verify'].map((purpose,id)=>({kind:'inverse-constraint',id,purpose,settings:{},topology:{}}));
 const api={createStagedSearch:(_R,req,options)=>{created.push(options);return{req,pending:[],finished:false};},planWave:s=>jobs.map(j=>({...j,req:s.req})),commitWave:s=>{s.finished=true;},stagedResult:()=>({results:[],tested:3,physicsSteps:0,elapsedMs:0}),pause(){},resume:()=>true};
 const ctx={performance,structuredClone,setTimeout,clearTimeout,Blob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},navigator:{hardwareConcurrency:1},document:{getElementById:()=>({textContent:''})},Worker:class{constructor(){throw Error('cooperative test');}},RAPIER:{},LabSourceFinalizationRequest:helper,LabInversePlanner:api,LabInverseEvents:{begin:(_R,req,topology,settings,options)=>{begun.push(options);return{};},advance:()=>true,finish:()=>({verified:false}),dispose(){}}};vm.createContext(ctx);vm.runInContext(read('src/optimizer-service.js'),ctx);const service=new ctx.OptimizerService(()=>{},r=>results.push(r),e=>errors.push(e));return{service,created,begun,results,errors,api};
}
test('cooperative service performs request admission then verify-only job admission with the same begin contract',async()=>{
 let admits=0;const token={},h=serviceHarness({admit:async()=>{admits++;return token;},needsAdmission:(_r,p)=>p==='verify'});await h.service.request({options:{searchAlgorithm:'inverse-constraints'},finalization:{policy:GAME}});await tick();assert.equal(admits,2);assert.equal(h.created[0].finalizationAdmission,token);assert.deepEqual(h.begun.map(x=>[x.purpose,Object.hasOwn(x,'finalizationAdmission')]),[['residual',false],['trial',false],['verify',true]]);assert.equal(h.results.length,1);assert.deepEqual(h.errors,[]);
});
test('service cancellation during asynchronous request admission never creates an obsolete search',async()=>{let release;const h=serviceHarness({admit:()=>new Promise(r=>release=r)}),pending=h.service.request({options:{searchAlgorithm:'inverse-constraints'},finalization:{policy:GAME}});h.service.cancel();release({});await pending;assert.equal(h.created.length,0);assert.equal(h.begun.length,0);});
test('worker-wave receipt failure propagates as source error, not retry or ordinary result',()=>{
 const h=serviceHarness({}),s=h.service;s.latest={options:{searchAlgorithm:'inverse-constraints'}};s.mode='worker';s.jobs=[{id:0}];s.outcomes=new Map([[0,{}]]);s.search={};s.api=h.api;s.api.commitWave=()=>{const e=new Error('Source finalization receipt mismatch for candidate 0');e.code='SOURCE_FINALIZATION_RECEIPT_MISMATCH';throw e;};s.recover=()=>assert.fail('receipt failure is not a recoverable startup error');
 s.pump(s.latest,s.version);assert.equal(h.errors.length,1);assert.match(h.errors[0],/receipt mismatch/);assert.equal(h.results.length,0);assert.equal(s.latest,null);
});
test('classic page and worker modules include the same original games/policy/admission/owner before inverse events',()=>{
 const build=read('build.cjs'),service=read('src/optimizer-service.js'),names=['game-rules','source-query-finalization-policy','source-finalization-request','source-gameplay-finalization-owner','inverse-events'];for(const source of [build,service]){let last=-1;for(const name of names){const at=source.indexOf("'"+name+"'");assert.ok(at>last,name+' ordered');last=at;}}
 const ctx={RAPIER:{init:async()=>{}},self:{},performance,setTimeout,clearTimeout,TextEncoder,crypto:globalThis.crypto,structuredClone};vm.createContext(ctx);for(const name of ['math','physics','forecast','route-rules','route-sampler','optimizer-core','optimizer',...names,'optimizer-worker'])vm.runInContext(read('src/'+name+'.js'),ctx,{filename:name+'.js'});assert.equal(typeof ctx.LabSourceFinalizationRequest.admit,'function');assert.equal(typeof ctx.LabSourceGameplayFinalizationOwner.create,'function');assert.equal(typeof ctx.LabInverseEvents.interrupt,'function');assert.equal(typeof ctx.self.onmessage,'function');
});
