import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../src/math.js';
import '../src/physics.js'; // Defines source dimensions/classes only; no world is constructed.
import '../src/route-rules.js';
import '../src/optimizer-core.js';
import '../src/game-rules.js';
import '../src/controller.js';
import {beginThreeBallGame,consumeThreeBallGameEvent,finishThreeBallGame,finishThreeBallGameAtRest} from '../src/resident-candidate/three-ball-game.mjs';

// DISCRETE SEMANTIC WITNESSES ONLY. Contact sequences and read-only observations
// below are constructed, not native captures or physically reachable trajectories.
// No PhysicsLab/Rapier world, solver step, search candidate, or GPU is instantiated.
const core=globalThis.ShotSearchCore,ids=[1,2,3];
function witness(cueId=1,methodId,cuePresent=false){
 const targets=ids.filter(id=>id!==cueId),settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
 const req={selectedId:cueId,options:{gameMode:'free',mode:'three',methodId,targetId:targets[0],secondId:targets[1],opponentId:null,allowKiss:true,objective:'shortest',horizon:8}};
 const flags={cuePresent,sleeping:false},position=id=>({x:(id-2)*.2,y:LabDimensions.radius,z:0});
 const input={time:.05,dt:1/960,cuePresent:()=>flags.cuePresent,allSleeping:()=>flags.sleeping,position,radius:()=>LabDimensions.radius,sphereIds:()=>ids.values(),positiveImpulse:()=>false};
 const trial=core.createPhysicalAccumulator(settings,null,0,position(cueId)),game=new ThreeBallGame();game.begin(cueId);
 let reduced=beginThreeBallGame(new ThreeBallGame().snapshot(),cueId).game;
 const emit=e=>{core.observePhysicalEvent(req,trial,e);game.contact(e);reduced=consumeThreeBallGameEvent(reduced,e);assert.deepEqual(reduced,game.snapshot());};
 const contact=(other,time)=>({kind:'contact',time,a:{id:cueId,kind:'ball'},b:other});
 const goal=[...['오른쪽 쿠션','앞쪽 쿠션','왼쪽 쿠션'].map((label,i)=>contact({id:null,kind:'cushion',label},(i+1)/100)),...targets.map((id,i)=>contact({id,kind:'ball',label:String(id)},(i+4)/100))];
 const rest=()=>({cuePresent:flags.cuePresent,balls:ids.map(id=>({id,sleeping:flags.sleeping}))});
 return{req,flags,input,trial,game,emit,goal,rest,contact,get reduced(){return reduced;}};
}

test('actual source search success while awake is not irrevocable ThreeBallGame success after a later floor event',()=>{
 for(const cueId of [1,2])for(const methodId of [undefined,'any']){
  const w=witness(cueId,methodId);w.goal.forEach(w.emit);
  assert.equal(core.observePhysicalStep(w.req,w.trial,w.input),true,'query stops without physical rest');
  assert.equal(w.trial.goalLatched,true);assert.equal(w.flags.sleeping,false);
  const steps=w.trial.steps;
  w.trial.lab={cue:null,step(){assert.fail('early query success must not execute another synthetic step');}};
  assert.equal(core.stepTrial({req:w.req},w.trial),true);assert.equal(w.trial.steps,steps);
  const result=core.physicalResult(w.req.options,w.trial,w.input.time);
  assert.equal(result.success,true);assert.equal(result.failureReason,null);assert.equal(result.cushions,3);
  assert.deepEqual(finishThreeBallGame(w.reduced).result,{cueId,delta:1,nextCue:cueId},'pure finish at this prefix would score');
  assert.equal(finishThreeBallGameAtRest(w.reduced,w.rest()).status,'pending');
  const publications=[],controller={game:w.game,lab:{cue:null,objects:ids.map(id=>({id,body:{isSleeping:()=>w.flags.sleeping}}))},state:{selectedId:cueId},repairRouteTargets:()=>publications.push('targets'),invalidate:()=>publications.push('invalidate'),queuePrediction:force=>publications.push(['prediction',force]),notify:()=>publications.push('notify')};
  LabController.prototype.finishGameShot.call(controller);
  assert.deepEqual(publications,[]);assert.notEqual(w.game.pending,null,'actual controller leaves gameplay pending');

  // Hypothetical later accepted PhysicsLab floor contact, NOT a physical replay.
  w.emit(w.contact({id:null,kind:'floor',label:'바닥'},.1));
  assert.equal(w.game.pending.foul,true);assert.equal(w.trial.invalid,false,'latched free-mode query ignores this contact');
  assert.equal(core.physicalResult(w.req.options,w.trial,.1).success,true);
  w.flags.sleeping=true;
  const final=finishThreeBallGameAtRest(w.reduced,w.rest());
  assert.deepEqual(final.result,{cueId,delta:0,nextCue:cueId===1?2:1});
  LabController.prototype.finishGameShot.call(controller);
  assert.deepEqual(w.game.snapshot(),final.game);assert.equal(controller.state.selectedId,final.result.nextCue);
  assert.equal(publications.length,4);assert.equal(w.game.scores[cueId],0,'no four-ball minus-one or opponent prohibition');
 }
});

test('free-mode post-goal cue tail ignores later positional bounds, but still rejects cue obstruction',()=>{
 const w=witness(1,'any',true);w.goal.forEach(w.emit);
 assert.equal(core.observePhysicalStep(w.req,w.trial,w.input),false);assert.equal(w.trial.goalLatched,true);
 // A deliberately constructed out-of-bounds observation: NOT evidence of flight.
 let reads=0;w.input.position=()=>{reads++;return{x:3,y:-1,z:0};};
 w.emit(w.contact({id:null,kind:'floor'},.1));
 assert.equal(core.observePhysicalStep(w.req,w.trial,w.input),false);
 assert.equal(reads,0,'latched non-four-ball branch returns before position/bounds guard');
 assert.equal(w.trial.invalid,false);assert.equal(w.game.pending.foul,true);
 w.flags.cuePresent=false;assert.equal(core.observePhysicalStep(w.req,w.trial,w.input),true);
 assert.equal(core.physicalResult(w.req.options,w.trial,.1).success,true);

 const obstructed=witness(2,'any',true);obstructed.goal.forEach(obstructed.emit);
 assert.equal(core.observePhysicalStep(obstructed.req,obstructed.trial,obstructed.input),false);
 obstructed.emit({kind:'cue-obstruction',time:.1});
 assert.equal(core.observePhysicalStep(obstructed.req,obstructed.trial,obstructed.input),true);
 assert.equal(core.physicalResult(obstructed.req.options,obstructed.trial,.1).failureReason,'cue-obstruction');
});

test('free-mode bounds guard still rejects out-of-table observations before goal latch',()=>{
 const w=witness();w.input.position=()=>({x:3,y:.03,z:0});
 assert.equal(core.observePhysicalStep(w.req,w.trial,w.input),true);
 assert.equal(w.trial.invalid,true);assert.notEqual(w.trial.goalLatched,true);
 assert.equal(core.physicalResult(w.req.options,w.trial,.05).success,false);
 assert.equal(w.game.pending.foul,false,'game class has no positional input; floor event is a separate source predicate');
});
