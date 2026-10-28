// Bounded HOST native forward proof + a DISCRETE forced query latch. The forced
// latch is NOT a physically achieved route, a gameplay score or a GPU witness.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import '../src/math.js';
import '../src/physics.js';
import '../src/game-rules.js';
import '../src/route-rules.js';
import '../src/optimizer-core.js';
import '../src/inverse-events.js';
import '../src/source-gameplay-finalization-owner.js';
import {createSourceFinalizationPolicy, GAMEPLAY_FINALIZATION_POLICY} from '../src/source-query-finalization-policy.mjs';
import {selectSourceInverseTerminalObservation} from '../src/resident-candidate/inverse-terminal-observation.mjs';
const R=createRequire(import.meta.url)('../vendor/rapier.cjs');
const core=globalThis.ShotSearchCore, ownerApi=globalThis.LabSourceGameplayFinalizationOwner;
const sourceIdentity='a'.repeat(64); // synthetic envelope for isolated owner test; not admission proof
const settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
function policy(snapshot){return createSourceFinalizationPolicy({policy:GAMEPLAY_FINALIZATION_POLICY,purpose:'verify',sourceIdentity,
 query:{gameMode:'free',mode:'three',selectedId:1,targetId:2,secondId:3},
 gameBinding:{kind:'original-game-binding-v1',sourceIdentity,gameKind:'three',snapshot,worldObjectIds:[1,2,3],shotRules:{threeCushion:true}}});}
const identity=Object.freeze({kind:'source-finalization-evaluation-binding-v1',sourceIdentity,purpose:'verify',settings:Object.freeze({...settings}),topology:Object.freeze({id:'discrete-query-control-only',events:[]})});
function equality(a,b){
 assert.deepEqual(a.world.takeSnapshot(),b.world.takeSnapshot(),'complete native rigid-body/solver snapshot bytes');
 assert.equal(a.time,b.time);assert.equal(a.steps,b.steps);assert.deepEqual(a.events,b.events);
 assert.deepEqual(a.lastStroke,b.lastStroke);assert.deepEqual(a.objects.map(o=>({id:o.id,distance:o.distance,trail:o.trail,lastPos:o.lastPos,maxHeight:o.maxHeight})),b.objects.map(o=>({id:o.id,distance:o.distance,trail:o.trail,lastPos:o.lastPos,maxHeight:o.maxHeight})));
}
test('same genuine native world continues past legacy query return; full bytes/clock/real events equal original stepping',async t=>{
 await R.init();const started=performance.now(),source=new PhysicsLab(R);let trial,mirror,owner;
 try{
  const snapshot=source.snapshot({trails:false}),initialGame=new ThreeBallGame().snapshot();
  const req={snapshot,selectedId:1,testBudget:true,settings,options:{gameMode:'free',mode:'three',targetId:2,secondId:3,budget:1,horizon:8,spin:true,objective:'shortest',allowKiss:true,elevationMode:'fixed'}};
  const search={R,req,rejected:0};trial=core.beginTrial(search,settings);assert.ok(trial);
  const nativeEvents=[],coreEvents=[],originalHandler=trial.lab.onEvent;
  trial.lab.onEvent=e=>{coreEvents.push(structuredClone(e));originalHandler(e);};
  owner=ownerApi.create(policy(initialGame),search,trial,identity);
  mirror=PhysicsLab.fromSnapshot(R,snapshot);const game=new ThreeBallGame();game.restore(initialGame);
  mirror.onEvent=e=>{nativeEvents.push(structuredClone(e));game.contact(e);};
  assert.equal(mirror.strike(1,settings,{saveSnapshot:false}).ok,true);game.begin(1);
  nativeEvents.length=0; // native strike precedes game.begin and owner attachment
  const lab=trial.lab,world=lab.world;
  // Fixed declared prefix; no source future-state loading or injected events.
  for(let i=0;i<220;i++){core.stepTrialOuter(search,trial);mirror.step();}
  assert.equal(lab.cue,null);assert.equal(lab.objects.every(o=>o.body.isSleeping()),false);
  assert.equal(owner.game.pending.foul,false);equality(lab,mirror);
  assert.deepEqual(coreEvents,nativeEvents);assert.deepEqual(owner.game.snapshot(),game.snapshot());
  // Explicit DISCRETE query-control witness, not a physically reached goal.
  trial.success=true;trial.goalLatched=true;trial.invalid=false;
  const before=lab.time,steps=trial.steps;
  assert.equal(core.stepTrial(search,trial,1),true);assert.equal(lab.time,before);assert.equal(trial.steps,steps);
  assert.equal(ownerApi.advance(owner,()=>({complete:true,goalSatisfied:true,irreversiblyRejected:false})),false);
  mirror.step();
  assert.equal(trial.lab,lab);assert.equal(lab.world,world);assert.equal(trial.steps,221);assert.ok(lab.time>before);
  equality(lab,mirror);assert.deepEqual(coreEvents,nativeEvents);assert.deepEqual(owner.game.snapshot(),game.snapshot());
  assert.equal(owner.decision.gameplayVerified,false);assert.equal(owner.game.pending.reds.length<2,true);
  const receipt=ownerApi.interrupt(owner,'request-timeout','bounded-native-test-stop');
  assert.equal(receipt.status,'incomplete');assert.equal(receipt.finishedGameResult,null);assert.equal(receipt.gameplayVerified,false);
  assert.deepEqual(receipt.evaluationBinding,identity);assert.equal(owner.game.pending!==null,true);
  t.diagnostic(JSON.stringify({scope:'221 original native outer steps; forced query latch only',outerSteps:221,nativeSeconds:lab.time-snapshot.time,elapsedMs:performance.now()-started,completeNativeBytesEqual:true,realEmissions:coreEvents.length,gpu:false,fullShot:false}));
 }finally{ownerApi.restore(owner);trial?.lab.dispose();mirror?.dispose();source.dispose();}
});
test('owner refuses a toy forward world and observation v1 refuses new final-gameplay authority',()=>{
 assert.throws(()=>ownerApi.create(policy(new ThreeBallGame().snapshot()),{}, {lab:{step(){}}},identity),/original PhysicsLab/);
 assert.throws(()=>selectSourceInverseTerminalObservation({finalization:{policy:GAMEPLAY_FINALIZATION_POLICY}}),/versioned\/profile-bound/);
 assert.throws(()=>selectSourceInverseTerminalObservation({routeQueryPhysicalResult:{success:true}}),/versioned\/profile-bound/);
});
test('intermediate purposes and explicit route-only requests retain synchronous original native observations without admission',async()=>{
 await R.init();const source=new PhysicsLab(R),E=globalThis.LabInverseEvents;
 const req={snapshot:source.snapshot({trails:false}),selectedId:1,testBudget:true,settings,options:{gameMode:'free',mode:'three',targetId:2,secondId:3,budget:1,horizon:8,spin:true,objective:'shortest',allowKiss:true,elevationMode:'fixed'}};
 const topology={id:'unreached-three-ball-route',firstId:2,secondId:3,events:[{kind:'object',id:2},{kind:'object',id:3}]};
 try{
  for(const purpose of ['evaluate','residual','jacobian','trial','clearance','verify']){
   const selected=purpose==='verify'?'source-route-query-v1':GAMEPLAY_FINALIZATION_POLICY;
   // No game binding/token is consulted for an intermediate source query. The
   // actual request admission boundary is tested separately, not faked here.
   const explicit={...req,finalization:{kind:'source-finalization-request-v1',policy:selected}};
   let a,b;
   try{
    a=E.begin(R,req,topology,settings,{purpose});b=E.begin(R,explicit,topology,settings,{purpose});
    assert.equal(a instanceof Promise,false);assert.equal(b instanceof Promise,false);assert.equal(b.finalizationOwner,undefined);
    if(purpose==='clearance')assert.deepEqual(E.finish(a),E.finish(b));
    else{
     assert.equal(E.advance(a,4),false);assert.equal(E.advance(b,4),false);equality(a.trial.lab,b.trial.lab);
     assert.deepEqual(E.projectResult(a,null,a.trial.steps),E.projectResult(b,null,b.trial.steps));
    }
   }finally{if(a)E.dispose(a);if(b)E.dispose(b);}
  }
  assert.throws(()=>E.begin(R,{...req,finalization:{kind:'source-finalization-request-v1',policy:'invented'}},topology,settings,{purpose:'verify'}),/Unknown explicit/);
  assert.throws(()=>E.begin(R,{...req,finalization:{kind:'source-finalization-request-v1',policy:GAMEPLAY_FINALIZATION_POLICY}},topology,settings,{purpose:'verify'}),/admission/);
 }finally{source.dispose();}
});
