'use strict';
// Standalone validation only. Both coordinators receive the same actual Rapier
// outcomes. No saved winning inputs, selected branch, changed solver or physics.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process'),v8=require('node:v8');
const root=path.resolve(__dirname,'../..'),baselineRevision='cf7521de07fb03612650835114d2b5023600ff8c';
const baselineSource=cp.execFileSync('git',['show',baselineRevision+':src/inverse-planner.js'],{cwd:root,encoding:'utf8'}),candidateSource=fs.readFileSync(path.join(root,'src/inverse-planner.js'),'utf8');
const output=path.resolve(process.env.PLANNER_DIFFERENTIAL_OUTPUT||path.join(__dirname,'local-evidence/planner-differential'));
fs.mkdirSync(output,{recursive:true});
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'?x:v8.serialize(x)).digest('hex');
const limits={maxWaves:180,maxEvaluations:4000,maxPhysicsSteps:20000000,maxWallMsPerFixture:300000,postSuccessWaves:0};
const R=require(path.join(root,'vendor/rapier.cjs'));
for(const name of ['math','physics','game-rules','route-rules','route-sampler','optimizer-core','optimizer','inverse-geometry','inverse-solver','inverse-events'])require(path.join(root,'src/'+name+'.js'));
function planner(source){const ctx={performance:{now:()=>0},structuredClone,LabOptimizer,LabInverseGeometry,LabInverseSolver,LabRouteRules};vm.createContext(ctx);vm.runInContext(source,ctx);return ctx.LabInversePlanner;}
function comparable(search){
 const {R,req,iterator,active,waiting,dormant,...rest}=search;
 const entry=e=>{const {verifiedRow,...original}=e;return original;};
 return structuredClone({...rest,active:active.map(entry),waiting:waiting.map(entry),dormant:dormant.map(entry)});
}
function purityState(search){const {R,req,iterator,...rest}=search;return structuredClone(rest);}
function jobShape(job){const {req,...rest}=job;return structuredClone(rest);}
function freezeData(data){if(data&&typeof data==='object'&&!ArrayBuffer.isView(data)){for(const v of Object.values(data))freezeData(v);Object.freeze(data);}return data;}
const resultShape=result=>structuredClone(result);
const guard=[];for(const [api,names] of [[LabRouteSampler,['proposals','freeProposals','freeProposalAt','inverseInputSeeds','next']],[ShotSearchCore,['proposeCandidate','beginCandidate','createSearch','advanceSearch']],[LabOptimizer,['createSearch','createStagedSearch','planWave','advanceSearch']]])for(const name of names){guard.push([api,name,api[name]]);api[name]=()=>{throw Error('Legacy input sampling forbidden: '+name);};}
function runFixture(fixture){
 const source=new PhysicsLab(R),four=fixture==='default4',started=performance.now(),baseline=planner(baselineSource),candidate=planner(candidateSource);let a,b;
 const trace=fs.openSync(path.join(output,fixture+'.ndjson'),'w');let sequence=0;const emit=data=>fs.writeSync(trace,JSON.stringify({sequence:sequence++,...data})+'\n');
 const record={fixture,status:'running',limits,clock:'Only planner performance.now is fixed at 0; physical timestep, solver and evaluator are unchanged.',evaluations:0,physicsSteps:0,waves:0,overlayChecks:0,earlyRows:0,firstSuccessWave:null};
 try{
  if(four)source.addSphere({x:.64,y:LabDimensions.radius+.00005,z:.30},'적구 2','#ed7770');
  const req={snapshot:source.snapshot({trails:false}),selectedId:1,settings:{angle:0,elevation:8,tipX:0,tipY:0,speed:2},options:{searchAlgorithm:'inverse-constraints',maxCushions:3,maxKisses:1,solveTimeMs:20000,inputStrategy:'hybrid',mode:four?'carom':'three',targetId:four?3:2,secondId:four?4:3,horizon:16,spin:true,objective:'shortest',order:'either',methods:['any'],allowKiss:true,elevationMode:'search',minElevation:0,maxElevation:85,fourBallThreeCushion:false,minSpeed:.5,maxSpeed:4.5,workers:0,gameMode:four?'four':'free',opponentId:four?2:null}};
  const requestBefore=structuredClone(req),sourceBefore=Buffer.from(source.world.takeSnapshot());record.request={settings:req.settings,options:req.options,snapshotSHA256:sha(req.snapshot)};
  a=baseline.createStagedSearch(R,req);b=candidate.createStagedSearch(R,req);
  let firstSuccessWave=null;
  for(let wave=0;wave<limits.maxWaves;wave++){
   assert.ok(performance.now()-started<limits.maxWallMsPerFixture,'Fixture wall safety bound reached');
   assert.deepEqual(comparable(b),comparable(a),'Planner state differs before plan wave '+wave);
   const ja=baseline.planWave(a),jb=candidate.planWave(b);assert.deepEqual(structuredClone(ja.map(jobShape)),structuredClone(jb.map(jobShape)),'Planned jobs/settings/topology differ');
   for(const j of [...ja,...jb])assert.equal(j.req,req,'Exact request reference must be preserved');
   assert.deepEqual(comparable(b),comparable(a),'Planner state differs after plan');
   emit({type:'planned',wave,jobs:ja.map(j=>({id:j.id,solverId:j.solverId,branchId:j.branchId,purpose:j.purpose,settings:j.settings,topologySHA256:sha(j.topology)})),stateSHA256:sha(comparable(a))});
   const outcomes=new Map();
   for(const job of ja){
    assert.ok(record.evaluations<limits.maxEvaluations,'Evaluation safety bound reached');assert.ok(record.physicsSteps<limits.maxPhysicsSteps,'Physics safety bound reached');assert.ok(performance.now()-started<limits.maxWallMsPerFixture,'Fixture wall safety bound reached');
    const evaluation=LabInverseEvents.begin(R,req,job.topology,job.settings,{purpose:job.purpose});let out;
    try{while(!LabInverseEvents.advance(evaluation,240)){assert.ok(performance.now()-started<limits.maxWallMsPerFixture,'Evaluator wall safety bound reached');}out=LabInverseEvents.finish(evaluation);}finally{LabInverseEvents.dispose(evaluation);}
    freezeData(out);outcomes.set(job.id,out);record.evaluations++;record.physicsSteps+=out.steps||0;
    const before=purityState(b),outcomeBefore=structuredClone([...outcomes]),retained={pending:b.pending,active:b.active,states:b.active.map(e=>e.state),iterator:b.iterator};
    const projected=candidate.stagedVerifiedResult(b,outcomes);record.overlayChecks++;
    assert.deepEqual(purityState(b),before,'Overlay mutated planner or solver state');assert.deepEqual(structuredClone([...outcomes]),outcomeBefore,'Overlay mutated evaluator outcomes');
    assert.equal(b.pending,retained.pending);assert.equal(b.active,retained.active);assert.equal(b.iterator,retained.iterator);b.active.forEach((e,i)=>assert.equal(e.state,retained.states[i]));
    assert.deepEqual(comparable(b),comparable(a),'Baseline/candidate states diverged during overlay');
    const early=projected.results.filter(r=>r.publicationStatus==='verified-pending-wave');record.earlyRows+=early.length;
    for(const row of projected.results){const identity=LabRouteRules.successIdentity(row);assert.ok(a.archive.some(r=>LabRouteRules.successIdentity(r)===identity)||[...outcomes].some(([id,o])=>{const j=ja.find(j=>j.id===id);return j.purpose==='verify'&&o.verified&&o.freshReplay&&o.physicalResult?.success&&LabRouteRules.successIdentity(o.physicalResult)===identity;}),'Publication lacks completed independent replay');}
    emit({type:'evaluated-and-overlay',wave,id:job.id,purpose:job.purpose,settings:job.settings,status:out.status,verified:out.verified,success:out.physicalResult?.success??false,steps:out.steps||0,outcomeSHA256:sha(out),overlayIdentities:projected.results.map(LabRouteRules.successIdentity),pendingPublished:early.length,stateUnchanged:true,stateSHA256:sha(before),roots:b.active.map(e=>({branch:e.branch.id,status:e.state.status,phase:e.state.phase,x:e.state.x,iterations:e.state.iterations,evaluations:e.state.evaluations,sequence:e.state.sequence}))});
    // Mutating the consumer-facing traces/settings cannot alter search/outcomes.
    for(const row of projected.results){row.settings.speed=999;if(row.contacts?.length)row.contacts[0].id=999;if(row.trace?.length)row.trace[0].x=999;}
    assert.deepEqual(purityState(b),before,'Publication rows alias retained planner data');assert.deepEqual(structuredClone([...outcomes]),outcomeBefore,'Publication rows alias evaluator outcome data');
   }
   const rows=ja.map(j=>({id:j.id,outcome:outcomes.get(j.id)}));baseline.commitWave(a,rows);candidate.commitWave(b,rows);
   assert.deepEqual(comparable(b),comparable(a),'Exact solver trajectory/counters/archive differ after commit '+wave);
   assert.deepEqual(resultShape(candidate.stagedResult(b)),resultShape(baseline.stagedResult(a)),'Committed result ordering/metadata differ');
   record.waves++;emit({type:'committed',wave,tested:a.evaluations,physicsSteps:a.physicsSteps,stateSHA256:sha(comparable(a)),archiveIdentities:a.archive.map(LabRouteRules.successIdentity),branches:a.branches});
   assert.deepEqual(req,requestBefore,'Request mutated');assert.deepEqual(Buffer.from(source.world.takeSnapshot()),sourceBefore,'Live source world mutated');assert.equal(source.shots,0);
   if(a.archive.length&&firstSuccessWave===null){firstSuccessWave=wave;record.firstSuccessWave=wave;}
   if(firstSuccessWave!==null&&wave-firstSuccessWave>=limits.postSuccessWaves){record.stopReason='first-committed-success';break;}
   if(a.finished){assert.equal(b.finished,true);const ar=baseline.resume(a),br=candidate.resume(b);assert.equal(br,ar);assert.deepEqual(comparable(b),comparable(a),'Resume changed retained state');if(!ar){record.stopReason='finite-domain-finished';break;}}
   if(wave===limits.maxWaves-1)record.stopReason='wave-safety-bound';
  }
  record.results=baseline.stagedResult(a).results;record.rootIterations=baseline.stagedResult(a).rootIterations;record.stateSHA256=sha(comparable(a));record.firstSuccessCost=a.firstSuccessCost;record.status='passed';record.succeeded=record.results.length>0;
  assert.ok(record.succeeded,'Bounded differential did not reach a verified archive row');
  record.proofs={samePlannedJobs:true,exactSolverStatesEveryWaveAndOutcome:true,exactCountersAndCommittedArchive:true,exactCommittedOrdering:true,overlayStateAndOutcomePurity:true,detachedConsumerRows:true,sourceWorldAndRequestUnchanged:true,actualPhysicsOutcomes:true,legacySamplingForbidden:true};
 }catch(error){record.status='failed';record.failure=String(error.stack||error);emit({type:'failure',failure:record.failure});}
 finally{record.wallMs=performance.now()-started;if(a)baseline.disposeSearch(a);if(b)candidate.disposeSearch(b);source.dispose();fs.closeSync(trace);fs.writeFileSync(path.join(output,fixture+'.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({fixture,status:record.status,waves:record.waves,evaluations:record.evaluations,physicsSteps:record.physicsSteps,firstSuccessWave:record.firstSuccessWave,rows:record.results?.length,wallMs:record.wallMs,failure:record.failure}));}
 return record;
}
(async()=>{await R.init();const manifest={baselineRevision,candidateRevision:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),baselinePlannerSHA256:sha(baselineSource),candidatePlannerSHA256:sha(candidateSource),node:process.version,limits,qualificationLimits:['Deterministic fixed-clock serial coordinator differential, not browser latency or worker scheduling proof.','Same actual physical outcomes are fed to both planners; this tests coordinator/overlay equivalence, not independent physics-engine equivalence.','Bounded default3/default4 domains only, through first successful archive; not exhaustive and no general convergence claim.','Source-gameplay explicit finalization is not used in this default-route-query differential; separate receipt tests cover it.','Opaque enumeration iterators and Rapier module objects excluded from structural comparison; exact next jobs test enumeration behavior. Candidate-only verifiedRow carrier excluded from cross-version state comparison but included in overlay purity checks.']};fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');const results=['default3','default4'].map(runFixture);for(const [api,key,value]of guard)api[key]=value;fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({manifest,results:results.map(({results,...record})=>({...record,resultCount:results?.length??0})),status:results.every(r=>r.status==='passed')?'passed':'failed'},null,2)+'\n');if(results.some(r=>r.status!=='passed'))process.exitCode=1;})().catch(error=>{console.error(error);process.exitCode=1;});
