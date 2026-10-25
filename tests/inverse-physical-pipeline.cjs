'use strict';
// Actual Rapier regression, not a saved-shot replay or a fabricated residual.
// Only the discrete contact branch is selected. Every cue input is generated
// from its geometric root and corrected by the production incremental solver.
const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const R=require('../vendor/rapier.cjs');
for(const name of ['math','physics','game-rules','route-rules','route-sampler','optimizer-core','optimizer','inverse-geometry','inverse-solver','inverse-events','inverse-planner'])require('../src/'+name+'.js');
before(()=>R.init());
function publicRequest(lab){
 lab.addSphere({x:.64,y:LabDimensions.radius+.00005,z:.30},'적구 2');
 return {snapshot:lab.snapshot({trails:false}),selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},options:{mode:'carom',gameMode:'four',opponentId:2,targetId:3,secondId:4,fourBallThreeCushion:false,methods:['any'],order:'either',allowKiss:true,horizon:16,spin:true,objective:'shortest',elevationMode:'search',minElevation:0,maxElevation:85,minSpeed:.5,maxSpeed:4.5,maxCushions:3}};
}
function forbidLegacy(){
 const saved=[];
 for(const [api,names] of [[LabRouteSampler,['proposals','freeProposals','freeProposalAt','inverseInputSeeds','next']],[ShotSearchCore,['proposeCandidate','beginCandidate','createSearch','advanceSearch']],[LabOptimizer,['createSearch','createStagedSearch','planWave','advanceSearch']]])for(const name of names){saved.push([api,name,api[name]]);api[name]=()=>{throw Error('Legacy candidate sampling is forbidden: '+name);};}
 return ()=>{for(const [api,name,fn] of saved)api[name]=fn;};
}
function branchProblem(branch){
 const seed=branch.settings;
 return {seed:{...seed},topology:branch,bounds:{angle:[seed.angle-180,seed.angle+180],elevation:[0,85],speed:[.5,4.5],tipX:[-.55,.55],tipY:[-.45,.45]},tipRadius:.6};
}
test('geometric four-ball branch solves real physics, certifies separately, then scores +1 uninstrumented',()=>{
 const source=new PhysicsLab(R),restore=forbidLegacy();
 try{
  const req=publicRequest(source),requestBefore=JSON.stringify(req),sourceBefore=Buffer.from(source.world.takeSnapshot());
  const iterator=LabInverseGeometry.enumerate(req,{maxCushions:3,horizonSeconds:16,maxKisses:1});
  let branch;
  for(const candidate of iterator){
   if(candidate.checkpoint)continue;
   if(candidate.firstId===3&&candidate.secondId===4&&candidate.root&&candidate.id.endsWith(':root:1')&&JSON.stringify(candidate.events)===JSON.stringify([{kind:'object',id:3},{kind:'cushion',rail:'x+'},{kind:'object',id:4}])){branch=candidate;break;}
  }
  assert.ok(branch,'Production geometry enumeration must derive the selected contact branch');
  assert.equal(branch.method,'carom','Stale three-cushion method checkbox must not replace the four-ball goal');
  assert.equal(branch.fullPhysicsStatus,'unresolved');
  assert.equal(branch.settings.elevation,0,'No winning shot may be supplied as the initial seed');
  const seed={...branch.settings},state=LabInverseSolver.create(branchProblem(branch),{maxIterations:40,residualTolerance:1e-4});
  const trace=[];let verificationCount=0,physicsSteps=0;
  while(state.status==='running'){
   const batch=LabInverseSolver.next(state);if(!batch.length){assert.notEqual(state.status,'running','A running solve must supply its next constraint wave');break;}
   const outcomes=batch.map(probe=>{
    const evaluator=LabInverseEvents.begin(R,req,branch,probe.settings,{purpose:probe.purpose});
    try{
     while(!LabInverseEvents.advance(evaluator,240));
     const outcome=LabInverseEvents.finish(evaluator);
     physicsSteps+=outcome.steps;
     trace.push({purpose:probe.purpose,settings:{...probe.settings},stage:outcome.residualStage,eventPrefix:outcome.eventPrefix,status:outcome.status,goalVerified:outcome.goalVerified,verified:outcome.verified,steps:outcome.steps});
     if(probe.purpose==='verify'){
      verificationCount++;assert.equal(state.status,'running');assert.equal(outcome.freshReplay,true);assert.equal(outcome.verified,true);assert.equal(outcome.physicalResult.success,true);
      const preceding=trace.slice(0,-1).find(row=>row.goalVerified&&JSON.stringify(row.settings)===JSON.stringify(probe.settings));assert.ok(preceding,'Verification must follow a separately successful physical evaluation');assert.deepEqual(probe.settings,preceding.settings);
     }else assert.equal(outcome.verified,false,'Residual and derivative evaluations cannot certify a shot');
     return {...outcome,id:probe.id};
    }finally{LabInverseEvents.dispose(evaluator);}
   });
   LabInverseSolver.accept(state,outcomes);
  }
  const solved=LabInverseSolver.result(state);
  if(process.env.INVERSE_PHYSICAL_EVIDENCE)fs.writeFileSync(process.env.INVERSE_PHYSICAL_EVIDENCE,JSON.stringify({branchId:branch.id,seed,status:solved.status,reason:solved.reason,settings:solved.settings,rootIterations:solved.iterations,evaluations:solved.evaluations,residualNorm:solved.residualNorm,verificationCount,physicsSteps,independentUninstrumentedReplay:false,legacySamplingDisabled:true,globalOptimal:false,exhaustive:false,trace},null,2)+'\n');
  assert.equal(solved.status,'verified',JSON.stringify({status:solved.status,reason:solved.reason,iterations:solved.iterations,evaluations:solved.evaluations,residualNorm:solved.residualNorm,settings:solved.settings,last:trace.at(-1)}));assert.equal(verificationCount,1);
  assert.ok(solved.iterations>0&&solved.iterations<=40,'Bound root convergence, never candidate count');
  assert.notDeepEqual(solved.settings,seed);assert.ok(trace.some(row=>row.purpose==='jacobian'));assert.ok(trace.some(row=>row.purpose==='trial'));
  assert.deepEqual(trace[0].settings,seed);assert.deepEqual(trace.at(-1).settings,solved.settings);
  assert.equal(JSON.stringify(req),requestBefore);assert.deepEqual(Buffer.from(source.world.takeSnapshot()),sourceBefore);assert.equal(source.shots,0);
  // A fresh normal PhysicsLab, with its native world.step unchanged, observes
  // ordinary public contacts only. It has no inverse-event instrumentation.
  const replay=PhysicsLab.fromSnapshot(R,req.snapshot),game=new FourBallGame([1,2],[3,4]);
  let evidence;
  try{
   const originalWorldStep=replay.world.step,settings={...solved.settings};let cueObstruction=false;
   replay.onEvent=event=>{game.contact(event);if(event.kind==='cue-obstruction')cueObstruction=true;};
   assert.equal(game.begin(1),true);assert.equal(replay.strike(1,settings).ok,true);assert.deepEqual(settings,solved.settings);
   while((replay.cue||replay.objects.some(o=>!o.body.isSleeping()))&&replay.time<16)replay.step();
   assert.equal(replay.world.step,originalWorldStep);assert.equal(replay.cue,null);assert.ok(replay.objects.every(o=>o.body.isSleeping()),'All balls must reach full rest');
   const score=game.finish();assert.deepEqual(score,{cueId:1,delta:1,nextCue:1});assert.equal(cueObstruction,false);
   evidence={branchId:branch.id,seed,settings:solved.settings,rootIterations:solved.iterations,evaluations:state.evaluations,physicsSteps,verificationCount,score,replaySeconds:replay.time,replaySteps:replay.steps,cueObstruction,independentUninstrumentedReplay:true,legacySamplingDisabled:true,globalOptimal:false,exhaustive:false,trace};
  }finally{replay.dispose();}
  if(process.env.INVERSE_PHYSICAL_EVIDENCE)fs.writeFileSync(process.env.INVERSE_PHYSICAL_EVIDENCE,JSON.stringify(evidence,null,2)+'\n');
 }finally{restore();source.dispose();}
});
test('real public branch cancellation does not run physics or claim physical failure',()=>{
 const lab=new PhysicsLab(R);try{
  const req=publicRequest(lab);let branch;for(const candidate of LabInverseGeometry.enumerate(req,{maxCushions:3,horizonSeconds:16,maxKisses:1})){if(!candidate.checkpoint){branch=candidate;break;}}assert.ok(branch);
  const state=LabInverseSolver.create(branchProblem(branch));LabInverseSolver.next(state);LabInverseSolver.cancel(state);
  assert.equal(LabInverseSolver.result(state).status,'cancelled');assert.equal(state.evaluations,0);
  const resumed=LabInverseSolver.resume(state);assert.equal(resumed.status,'running');assert.deepEqual(resumed.template,branch.settings);
 }finally{lab.dispose();}
});

test('three-cushion geometric root solves then reproduces ordered contacts in an uninstrumented world',()=>{
 const source=new PhysicsLab(R),restore=forbidLegacy();
 try{
  const req={snapshot:source.snapshot({trails:false}),selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},options:{mode:'three',targetId:3,secondId:2,methods:['any'],order:'either',allowKiss:true,horizon:16,spin:true,objective:'shortest',elevationMode:'search',minElevation:0,maxElevation:85,minSpeed:.5,maxSpeed:4.5,maxCushions:3}};
  const expected=[{kind:'object',id:3},{kind:'cushion',rail:'z-'},{kind:'cushion',rail:'x+'},{kind:'cushion',rail:'z+'},{kind:'object',id:2}];
  const requestBefore=JSON.stringify(req),sourceBefore=Buffer.from(source.world.takeSnapshot());
  // Select a discrete known-feasible topology and its algebraic root identity,
  // not a golden cue-input vector. This isolates numerical root convergence
  // from frontier scheduling: enumerate must derive every initial cue input.
  let branch;
  for(const candidate of LabInverseGeometry.enumerate(req,{maxCushions:3,horizonSeconds:16,maxKisses:1})){
   if(candidate.checkpoint)continue;
   if(candidate.root&&candidate.id.endsWith(':root:1')&&JSON.stringify(candidate.events)===JSON.stringify(expected)){branch=candidate;break;}
  }
  assert.ok(branch,'Geometry must produce the three-cushion branch');assert.equal(branch.fullPhysicsStatus,'unresolved');assert.equal(branch.method,'any');
  const seed={...branch.settings};assert.equal(seed.elevation,0);assert.equal(seed.tipX,0);assert.equal(seed.tipY,0);
  const state=LabInverseSolver.create(branchProblem(branch),{maxIterations:40,residualTolerance:1e-4}),trace=[];let physicsSteps=0,verificationCount=0;
  while(state.status==='running'){
   const jobs=LabInverseSolver.next(state);if(!jobs.length){assert.notEqual(state.status,'running');break;}
   const outcomes=jobs.map(probe=>{
    const evaluator=LabInverseEvents.begin(R,req,branch,probe.settings,{purpose:probe.purpose});
    try{
     while(!LabInverseEvents.advance(evaluator,240));const outcome=LabInverseEvents.finish(evaluator);physicsSteps+=outcome.steps;
     if(probe.purpose==='verify'){
      verificationCount++;assert.ok(trace.some(row=>row.goalVerified&&JSON.stringify(row.settings)===JSON.stringify(probe.settings)),'Certification requires a prior successful evaluation of identical settings');
      assert.equal(outcome.freshReplay,true);assert.equal(outcome.verified,true);assert.equal(outcome.physicalResult.success,true);assert.equal(outcome.eventPrefix,5);
      assert.deepEqual(outcome.events.map(({kind,id,rail})=>kind==='object'?{kind,id}:{kind,rail}),expected);
     }else assert.equal(outcome.verified,false);
     trace.push({purpose:probe.purpose,settings:{...probe.settings},stage:outcome.residualStage,eventPrefix:outcome.eventPrefix,status:outcome.status,goalVerified:outcome.goalVerified,verified:outcome.verified,steps:outcome.steps});
     return {...outcome,id:probe.id};
    }finally{LabInverseEvents.dispose(evaluator);}
   });LabInverseSolver.accept(state,outcomes);
  }
  const solved=LabInverseSolver.result(state);assert.equal(solved.status,'verified',JSON.stringify({reason:solved.reason,residualNorm:solved.residualNorm,iterations:solved.iterations}));assert.equal(verificationCount,1);assert.ok(solved.iterations>0&&solved.iterations<=40);assert.notDeepEqual(solved.settings,seed);
  const replay=PhysicsLab.fromSnapshot(R,req.snapshot),game=new ThreeBallGame([1,2],[1,2,3]);let evidence;
  try{
   const originalWorldStep=replay.world.step,settings={...solved.settings},contacts=[];let cueObstruction=false,offTable=false;
   replay.onEvent=event=>{
    game.contact(event);
    if(event.kind==='cue-obstruction')cueObstruction=true;
    if(event.kind!=='contact'||!event.a||!event.b)return;
    const other=event.a.id===1?event.b:event.b.id===1?event.a:null;if(!other)return;
    if(other.kind==='floor')offTable=true;
    if(other.kind==='cushion')contacts.push({kind:'cushion',rail:LabRouteRules.railId(other),time:event.time});
    else if(other.id!=null)contacts.push({kind:'object',id:other.id,time:event.time});
   };
   assert.equal(game.begin(1),true);assert.equal(replay.strike(1,settings).ok,true);assert.deepEqual(settings,solved.settings);
   while((replay.cue||replay.objects.some(o=>!o.body.isSleeping()))&&replay.time<16)replay.step();
   assert.equal(replay.world.step,originalWorldStep);assert.equal(replay.cue,null);assert.ok(replay.objects.every(o=>o.body.isSleeping()));assert.equal(cueObstruction,false);assert.equal(offTable,false);
   const secondIndex=contacts.findIndex(c=>c.kind==='object'&&c.id===2);assert.ok(secondIndex>=0);
   const throughGoal=contacts.slice(0,secondIndex+1),order=throughGoal.map(({kind,id,rail})=>kind==='object'?{kind,id}:{kind,rail});
   assert.deepEqual(order,expected,'Public ordinary contact events must reproduce the entire intended chronology');
   assert.deepEqual([...new Set(throughGoal.filter(c=>c.kind==='object').map(c=>c.id))],[3,2]);assert.equal(throughGoal.filter(c=>c.kind==='cushion').length,3);
   const score=LabRouteRules.evaluate(throughGoal,{method:'any',firstId:3,secondId:2,minCushions:3});assert.equal(score.success,true);
   assert.deepEqual(game.finish(),{cueId:1,delta:1,nextCue:1});assert.equal(game.scores[1],1,'Actual three-cushion replay retains the scoring turn');
   evidence={branchId:branch.id,seed,settings:solved.settings,rootIterations:solved.iterations,evaluations:solved.evaluations,physicsSteps,verificationCount,contacts:throughGoal,threeCushionSuccess:score.success,replaySeconds:replay.time,replaySteps:replay.steps,cueObstruction,offTable,independentUninstrumentedReplay:true,legacySamplingDisabled:true,globalOptimal:false,exhaustive:false,trace};
  }finally{replay.dispose();}
  assert.equal(JSON.stringify(req),requestBefore);assert.deepEqual(Buffer.from(source.world.takeSnapshot()),sourceBefore);assert.equal(source.shots,0);
  if(process.env.INVERSE_PHYSICAL_EVIDENCE){const path=process.env.INVERSE_PHYSICAL_EVIDENCE,previous=fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):{};fs.writeFileSync(path,JSON.stringify({...previous,threeBall:evidence},null,2)+'\n');}
 }finally{restore();source.dispose();}
});
