// Bounded genuine native PhysicsLab integration; no complete-shot/reachability,
// native GPU, or physically achieved positive-goal claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import '../src/math.js';
import '../src/physics.js';
import '../src/game-rules.js';
import '../src/route-rules.js';
import '../src/optimizer-core.js';
import '../src/source-query-finalization-policy.js';
import '../src/source-finalization-request.js';
import '../src/source-gameplay-finalization-owner.js';
import '../src/inverse-events.js';
import '../src/inverse-solver.js';
import {selectSourceInverseTerminalObservation} from '../src/resident-candidate/inverse-terminal-observation.mjs';
const R=createRequire(import.meta.url)('../vendor/rapier.cjs'),E=globalThis.LabInverseEvents,F=globalThis.LabSourceFinalizationRequest;
const settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
const topology={id:'bounded-real-world-only',firstId:2,secondId:3,events:[{kind:'object',id:2},{kind:'object',id:3}],provenance:{purpose:'native-prefix-not-scored-route'}};
async function fixture(){
 await R.init();const source=new PhysicsLab(R),game=new ThreeBallGame();
 const raw={snapshot:source.snapshot({trails:false}),selectedId:1,testBudget:true,settings,options:{gameMode:'free',mode:'three',targetId:2,secondId:3,budget:1,horizon:8,spin:true,objective:'shortest',allowKiss:true,elevationMode:'fixed'}};
 const req=await F.bind(raw,{gameKind:'three',snapshot:game.snapshot(),worldObjectIds:source.objects.map(o=>o.id),shotRules:{threeCushion:true}});
 return{source,game,raw,req,token:await F.admit(req)};
}
test('real snapshot binding admits exact candidate; new verification retains original native prefix and interrupts without miss authority',async t=>{
 const started=performance.now(),f=await fixture();let legacy,e;
 try{
  assert.throws(()=>E.begin(R,f.req,topology,settings,{purpose:'verify'}),/same-realm admission/);
  const corrupt=structuredClone(f.req);corrupt.snapshot.world[0]^=1;
  assert.throws(()=>E.begin(R,corrupt,topology,settings,{purpose:'verify',finalizationAdmission:f.token}),/changed after admission/);
  const ownerModule=globalThis.LabSourceGameplayFinalizationOwner,fromSnapshot=PhysicsLab.fromSnapshot;
  try{
   globalThis.LabSourceGameplayFinalizationOwner=undefined;
   PhysicsLab.fromSnapshot=()=>assert.fail('missing optional modules must fail before constructing a world');
   assert.throws(()=>E.begin(R,f.req,topology,settings,{purpose:'verify',finalizationAdmission:f.token}),/continuation modules are required/);
  }finally{globalThis.LabSourceGameplayFinalizationOwner=ownerModule;PhysicsLab.fromSnapshot=fromSnapshot;}
  legacy=E.begin(R,f.raw,topology,settings,{purpose:'verify'});
  e=E.begin(R,f.req,topology,settings,{purpose:'verify',finalizationAdmission:f.token});
  const lab=e.trial.lab,world=lab.world,originalWorldStep=e.originalWorldStep;
  assert.equal(e.finalizationOwner.game.pending.cueId,1);assert.equal(lab.shots,f.req.snapshot.shots+1);
  assert.equal(E.advance(legacy,4),false);assert.equal(E.advance(e,4),false);
  assert.equal(e.trial.lab,lab);assert.equal(lab.world,world);
  assert.deepEqual(lab.world.takeSnapshot(),legacy.trial.lab.world.takeSnapshot());
  assert.equal(lab.time,legacy.trial.lab.time);assert.equal(lab.steps,legacy.trial.lab.steps);
  assert.deepEqual(lab.events,legacy.trial.lab.events);
  assert.deepEqual(E.projectResult(e,null,e.trial.steps),E.projectResult(legacy,null,legacy.trial.steps));
  assert.equal(e.finalizationOwner.game.pending.foul,false);
  const out=E.interrupt(e,'request-timeout','bounded-prefix-stop');
  assert.equal(out.status,'incomplete');assert.equal(out.incomplete,true);assert.equal(out.verified,false);assert.equal(out.goalVerified,false);assert.equal(out.physicalResult,null);
  assert.equal(out.finalization.finishedGameResult,null);assert.equal(out.finalization.physicalRest,false);assert.equal(out.steps,4);
  for(const key of ['residual','residuals','inequalities','residualStage','residualAvailable','eventPrefix','contactCell','clearance'])assert.equal(Object.hasOwn(out,key),false,'no authoritative terminal '+key);
  assert.deepEqual(out.routeQueryObservation,E.projectResult(e,out.routeQueryObservation.physicalResult,4));
  assert.equal(F.matchesEvaluation(f.req,{purpose:'verify',settings,topology},out.finalization),true);
  assert.equal(F.verifiedGameplay(f.req,{purpose:'verify',settings,topology},out),false);
  assert.equal(lab.world.step,originalWorldStep);assert.equal(e.disposed,true);assert.equal(E.finish(e),out);
  assert.throws(()=>selectSourceInverseTerminalObservation(out),/versioned\/profile-bound/);
  // Pure solver-control scaffold only: does not claim this prefix reached a
  // root. Feed the REAL valueless timeout into its genuine verify-phase API.
  const S=globalThis.LabInverseSolver,state=S.create({seed:settings,topology});
  const initial=S.next(state)[0];S.accept(state,[{id:initial.id,residuals:[0],inequalities:[],goalVerified:true}]);
  const probe=S.next(state)[0];assert.equal(probe.purpose,'verify');
  S.accept(state,[{...out,id:probe.id}]);const decision=S.result(state);
  assert.equal(decision.status,'unconverged');assert.equal(decision.reason,'bounded-prefix-stop');assert.equal(decision.verification,null);
  t.diagnostic(JSON.stringify({scope:'real admission and4 original outer steps',elapsedMs:performance.now()-started,finalGameplayVerified:false,fullNativePrefixEqual:true}));
 }finally{if(e)E.dispose(e);if(legacy)E.dispose(legacy);f.source.dispose();}
});
test('actual source constraint rejection is evaluated-negative, not fabricated original game finish; cancel/stale remain separate',async()=>{
 const f=await fixture();
 try{
  let e;
  try{
   const outside={...settings,speed:.4}; // Native strike permits it; unchanged inverse bound is .5.
   e=E.begin(R,f.req,topology,outside,{purpose:'verify',finalizationAdmission:f.token});
   assert.equal(E.advance(e,1),true);const out=E.finish(e);
   assert.equal(out.status,'evaluated-negative');assert.equal(out.reason,'original-route-query-rejected');assert.equal(out.physicalResult,null);
   assert.equal(out.finalization.finishedGameResult,null);assert.equal(out.incomplete,false);assert.equal(out.inequalities.some(v=>v>0),true);
   assert.equal(F.matchesEvaluation(f.req,{purpose:'verify',settings:outside,topology},out.finalization),true);
  }finally{if(e)E.dispose(e);}
  for(const [status,expected] of [['cancelled','cancelled'],['stale-source','stale'],['unsupported','unsupported'],['failed','failed']]){
   e=E.begin(R,f.req,topology,settings,{purpose:'verify',finalizationAdmission:f.token});
   try{const out=E.interrupt(e,status,'bounded-test-stop');assert.equal(out.status,expected);assert.equal(out.verified,false);assert.equal(out.physicalResult,null);assert.equal(out.finalization.finishedGameResult,null);assert.equal(out.steps,0);}
   finally{E.dispose(e);}
  }
 }finally{f.source.dispose();}
});
