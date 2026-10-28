// DISCRETE actual-source semantic witnesses ONLY. Constructed contacts/poses are
// not native captures or reachable trajectories. No physical/GPU world is made.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/math.js';
import '../src/physics.js'; // definitions/dimensions only
import '../src/route-rules.js';
import '../src/optimizer-core.js';
import '../src/game-rules.js';
import '../src/controller.js';
import {ROUTE_QUERY_POLICY as ROUTE,GAMEPLAY_FINALIZATION_POLICY as GAME,createSourceFinalizationPolicy as create,decideSourceFinalization as decide} from '../src/source-query-finalization-policy.mjs';
const core=globalThis.ShotSearchCore,sourceIdentity='1'.repeat(64); // explicit synthetic envelope identity for this discrete test
function witness({kind='three',cueId=1,threeCushion=true,purpose='verify',extraObject=false}={}){
 const game=kind==='three'?new ThreeBallGame():new FourBallGame([1,2],[3,4],{threeCushion:false});
 const initial=game.snapshot(),objectIds=kind==='three'?[1,2,3]:[1,2,3,4];if(extraObject)objectIds.push(9);
 const targets=kind==='three'?initial.objectIds.filter(i=>i!==cueId):initial.redIds;
 const options={gameMode:kind==='three'?'free':'four',mode:kind==='three'?'three':'carom',methodId:kind==='three'?'any':'carom',targetId:targets[0],secondId:targets[1],opponentId:kind==='four'?initial.cueIds.find(i=>i!==cueId):null,allowKiss:true,objective:'shortest',horizon:8,fourBallThreeCushion:kind==='four'?threeCushion:false};
 const query={gameMode:options.gameMode,mode:options.mode,selectedId:cueId,targetId:targets[0],secondId:targets[1]};
 const spec={policy:GAME,purpose,sourceIdentity,query,gameBinding:{kind:'original-game-binding-v1',sourceIdentity,gameKind:kind,snapshot:initial,worldObjectIds:objectIds,shotRules:{threeCushion:kind==='three'?true:threeCushion}}};
 const policy=create(spec),flags={cuePresent:false,sleeping:false},position=i=>({x:(i-2)*.12,y:LabDimensions.radius,z:0});
 const input={time:.05,dt:1/960,cuePresent:()=>flags.cuePresent,allSleeping:()=>flags.sleeping,position,radius:()=>LabDimensions.radius,sphereIds:()=>objectIds,positiveImpulse:()=>false};
 const req={selectedId:cueId,options},trial=core.createPhysicalAccumulator({angle:0,elevation:8,speed:2,tipX:0,tipY:0},null,0,position(cueId));
 assert.equal(game.begin(cueId,{threeCushion:spec.gameBinding.shotRules.threeCushion}),true);
 const contact=(other,time)=>({kind:'contact',time,a:{id:cueId,kind:'ball',label:'cue'},b:other});
 const emit=e=>{core.observePhysicalEvent(req,trial,e);game.contact(e);};
 const goals=[...(kind==='three'||threeCushion?['오른쪽 쿠션','앞쪽 쿠션','왼쪽 쿠션'].map((label,i)=>contact({kind:'cushion',id:null,label},(i+1)/100)):[]),...targets.map((id,i)=>contact({kind:'ball',id,label:String(id)},(i+4)/100))];
 let complete=false,finalResult=null;
 const frame=()=>({sourceIdentity,execution:{status:'running',reason:null},route:{complete,goalSatisfied:core.physicalResult(options,trial,input.time).success,irreversiblyRejected:!!trial.invalid&&!trial.verificationIncomplete},physical:{cuePresent:flags.cuePresent,objects:objectIds.map(id=>({id,sleeping:flags.sleeping}))},game:{snapshot:game.snapshot(),finalResult}});
 const step=()=>{complete=core.observePhysicalStep(req,trial,input);return complete;};
 function finishThroughController(){
  const original=game.finish;game.finish=function(){finalResult=original.call(this);return finalResult;};
  try{LabController.prototype.finishGameShot.call({game,lab:{cue:flags.cuePresent?{}:null,objects:objectIds.map(id=>({id,body:{isSleeping:()=>flags.sleeping}}))},state:{selectedId:cueId},repairRouteTargets(){},invalidate(){},queuePrediction(){},notify(){}});}finally{game.finish=original;}
  return finalResult;
 }
 return{kind,game,initial,objectIds,policy,spec,flags,input,req,trial,emit,goals,contact,frame,step,finishThroughController};
}

test('explicit named policy and real source game binding are required; pure target/direct routes do not become gameplay',()=>{
 const w=witness();for(const mutate of [x=>delete x.policy,x=>x.policy='automatic',x=>x.gameBinding=null,x=>x.gameBinding.sourceIdentity='2'.repeat(64),x=>x.gameBinding.snapshot.pending={},x=>x.gameBinding.shotRules.threeCushion=false,x=>x.query.targetId=99]){const x=structuredClone(w.spec);mutate(x);assert.throws(()=>create(x));}
 for(const mode of ['target','direct','carom','three']){
  const p=create({policy:ROUTE,purpose:'verify',sourceIdentity,query:{gameMode:null,mode,selectedId:1,targetId:2,secondId:mode==='target'?null:3},gameBinding:null});
  const ignored={sourceIdentity,get game(){assert.fail('route-only cannot inspect gameplay');},get physical(){assert.fail('route-only cannot impose rest');}};
  assert.deepEqual(decide(p,ignored),{action:'delegate-source-query',scope:'legacy-source-query',changesSourceResult:false,gameplayVerified:false});
 }
 const direct=structuredClone(w.spec);direct.query.mode='direct';assert.throws(()=>create(direct),/target\/direct remain route queries/);
});

test('all intermediate purposes retain exact legacy queries even in explicitly gameplay-qualified search',()=>{
 for(const purpose of ['evaluate','residual','jacobian','trial','clearance']){
  const w=witness({purpose});assert.equal(w.policy.effective,'legacy-source-query');
  assert.equal(decide(w.policy,{sourceIdentity,get game(){assert.fail('intermediate query has no extra game reducer');}}).action,'delegate-source-query');
 }
 const w=witness();w.spec.gameBinding.snapshot.scores[1]=999;assert.equal(w.policy.gameBinding.snapshot.scores[1],0,'policy owns initial source copy');assert.equal(Object.isFrozen(w.policy.gameBinding.snapshot),true);
});

test('unchanged three-ball early source success waits; later original floor event becomes query failure, never invented final score',()=>{
 for(const cueId of [1,2]){
  const w=witness({cueId});w.goals.forEach(w.emit);assert.equal(w.step(),true);assert.equal(w.trial.goalLatched,true);assert.equal(core.physicalResult(w.req.options,w.trial,.05).success,true);
  assert.equal(decide(w.policy,w.frame()).status,'continue');assert.equal(w.finishThroughController(),null,'actual Controller does not finish awake world');
  w.trial.lab={cue:null,step(){assert.fail('legacy query already stopped');}};assert.equal(core.stepTrial({req:w.req},w.trial),true,'legacy early output remains unchanged');
  w.emit(w.contact({kind:'floor',id:null,label:'floor'},.1));assert.equal(w.game.pending.foul,true);assert.equal(w.trial.invalid,false);
  const early=decide(w.policy,w.frame());assert.equal(early.status,'evaluated-negative');assert.equal(early.reason,'irreversible-source-game-foul');assert.equal(early.finishedGameResult,null);assert.equal(early.gameplayVerified,false);assert.equal(w.game.scores[cueId],0);
  w.flags.sleeping=true;const final=w.finishThroughController();assert.deepEqual(final,{cueId,delta:0,nextCue:cueId===1?2:1});
  const terminal=decide(w.policy,w.frame());assert.equal(terminal.status,'evaluated-negative');assert.deepEqual(terminal.finishedGameResult,final);assert.equal(core.physicalResult(w.req.options,w.trial,.1).success,true,'characterized old query not overwritten');
 }
});

test('positive final gameplay requires original finish at no-cue/all-object rest plus route success, not prefix alone',()=>{
 const w=witness({extraObject:true});w.goals.forEach(w.emit);w.step();assert.equal(decide(w.policy,w.frame()).gameplayVerified,false);
 w.flags.sleeping=true;w.flags.cuePresent=true;assert.equal(decide(w.policy,w.frame()).status,'continue');assert.equal(w.finishThroughController(),null);
 w.flags.cuePresent=false;const pending=w.frame();pending.physical.objects.at(-1).sleeping=false;assert.equal(decide(w.policy,pending).status,'continue','non-game added object must also sleep');
 assert.equal(decide(w.policy,w.frame()).status,'awaiting-original-game-finish');const before=structuredClone(w.frame());decide(w.policy,before);assert.deepEqual(before,w.frame(),'pure policy never calls game.finish');
 const final=w.finishThroughController();assert.deepEqual(final,{cueId:1,delta:1,nextCue:1});const result=decide(w.policy,w.frame());assert.equal(result.status,'verified-final-gameplay');assert.equal(result.gameplayVerified,true);assert.equal(result.physicalRest,true);
 const rejected=w.frame();rejected.route.goalSatisfied=false;assert.equal(decide(w.policy,rejected).status,'evaluated-negative','game point alone cannot override route/constraints');
 const early=w.frame();early.physical.objects[0].sleeping=false;assert.throws(()=>decide(w.policy,early),/before controller rest/);
});

test('four-ball per-shot rule and late opponent foul remain original, with no three-ball scoring substitution',()=>{
 for(const threeCushion of [false,true]){
  const w=witness({kind:'four',threeCushion});w.goals.forEach(w.emit);assert.equal(w.step(),false,'original four-ball already waits');assert.equal(decide(w.policy,w.frame()).status,'continue');
  const wrong=w.frame();wrong.game.snapshot.pending.threeCushion=!threeCushion;assert.throws(()=>decide(w.policy,wrong),/per-shot rule/);
  w.emit(w.contact({id:2,kind:'ball'},.1));assert.equal(w.step(),true);const early=decide(w.policy,w.frame());assert.equal(early.reason,'irreversible-source-game-foul');assert.equal(early.finishedGameResult,null);
  w.flags.sleeping=true;const final=w.finishThroughController();assert.deepEqual(final,{cueId:1,delta:-1,nextCue:2});assert.deepEqual(decide(w.policy,w.frame()).finishedGameResult,final);
 }
});

test('four-ball positive rest and three-ball late-cushion rejection use unchanged original rule results',()=>{
 for(const threeCushion of [false,true]){
  const w=witness({kind:'four',threeCushion});w.goals.forEach(w.emit);w.step();w.flags.sleeping=true;assert.equal(w.step(),true);
  assert.deepEqual(w.finishThroughController(),{cueId:1,delta:1,nextCue:1});assert.equal(decide(w.policy,w.frame()).status,'verified-final-gameplay');
 }
 const w=witness();w.goals.slice(-2).forEach(w.emit);w.step();w.goals.slice(0,3).forEach(w.emit);
 assert.equal(w.game.pending.goalCushions,0,'late cushions never retroactively change source goal count');w.flags.sleeping=true;w.step();
 assert.deepEqual(w.finishThroughController(),{cueId:1,delta:0,nextCue:2});assert.equal(decide(w.policy,w.frame()).gameplayVerified,false);
});

test('request timeout, cancellation, stale source, unsupported and failures are not evaluated misses; horizon is incomplete',()=>{
 const w=witness();w.goals.forEach(w.emit);w.step();
 for(const [status,result] of [['request-timeout','incomplete'],['cancelled','cancelled'],['stale-source','stale'],['unsupported','unsupported'],['failed','failed']]){const f=w.frame();f.execution={status,reason:'original diagnostic'};const r=decide(w.policy,f);assert.equal(r.status,result);assert.equal(r.routeSatisfied,null);assert.equal(r.gameplayVerified,false);assert.equal(r.finishedGameResult,null);}
 const horizon=w.frame();horizon.execution.status='physical-horizon';assert.equal(decide(w.policy,horizon).status,'incomplete');
 horizon.route.goalSatisfied=false;assert.equal(decide(w.policy,horizon).status,'incomplete','horizon-caused legacy query completion is not irreversible failure');
 const blocked=w.frame();blocked.route={complete:true,goalSatisfied:false,irreversiblyRejected:true};assert.equal(decide(w.policy,blocked).reason,'original-route-query-rejected');
});

test('strict source/rest/game identities and finished score/turn checks reject fabricated completion',()=>{
 const w=witness();w.goals.forEach(w.emit);w.step();
 for(const mutate of [f=>f.sourceIdentity='2'.repeat(64),f=>f.physical.objects.pop(),f=>f.physical.objects.reverse(),f=>f.physical.objects[0].sleeping=1,f=>f.game.snapshot.pending.cueId=2,f=>f.game.snapshot.scores[1]=1,f=>f.route.irreversiblyRejected=true]){const f=w.frame();mutate(f);assert.throws(()=>decide(w.policy,f));}
 w.flags.sleeping=true;w.finishThroughController();
 for(const mutate of [f=>f.game.finalResult.delta=2,f=>f.game.finalResult.nextCue=2,f=>f.game.snapshot.scores[1]=999,f=>f.game.snapshot.pending={},f=>f.route.complete=false]){const f=w.frame();mutate(f);assert.throws(()=>decide(w.policy,f));}
});
