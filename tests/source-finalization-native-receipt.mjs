// Bounded original CPU producer -> transport admission only; no scored-route,
// full-shot, GPU, real browser or performance claim.
import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import '../src/math.js';import '../src/physics.js';import '../src/game-rules.js';import '../src/route-rules.js';import '../src/optimizer-core.js';import '../src/source-query-finalization-policy.js';import '../src/source-finalization-request.js';import '../src/source-gameplay-finalization-owner.js';import '../src/inverse-events.js';
const R=createRequire(import.meta.url)('../vendor/rapier.cjs'),A=globalThis.LabSourceFinalizationRequest,E=globalThis.LabInverseEvents;
test('strict transport validator accepts actual valueless timeout and original constraint-negative receipts',async()=>{
 await R.init();const source=new PhysicsLab(R),game=new ThreeBallGame(),settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0},topology={id:'native-receipt-prefix',firstId:2,secondId:3,events:[{kind:'object',id:2},{kind:'object',id:3}]};
 try{
  const raw={snapshot:source.snapshot({trails:false}),selectedId:1,testBudget:true,settings,options:{gameMode:'free',mode:'three',targetId:2,secondId:3,budget:1,horizon:8,spin:true,objective:'shortest',allowKiss:true,elevationMode:'fixed'}},req=await A.bind(raw,{gameKind:'three',snapshot:game.snapshot(),worldObjectIds:source.objects.map(o=>o.id),shotRules:{threeCushion:true}}),token=await A.admit(req);
  for(const negative of [false,true]){
   const controls=negative?{...settings,speed:.4}:settings,job={purpose:'verify',settings:controls,topology},e=E.begin(R,req,topology,controls,{purpose:'verify',finalizationAdmission:token});
   try{
    let out;if(negative){assert.equal(E.advance(e,1),true);out=E.finish(e);assert.equal(out.status,'evaluated-negative');}else{assert.equal(E.advance(e,4),false);out=E.interrupt(e,'request-timeout','bounded-native-prefix');assert.equal(out.status,'incomplete');}
    assert.equal(A.matchesGameplayOutcome(req,job,out),true);assert.equal(A.verifiedGameplay(req,job,out),false);assert.equal(out.physicalResult,null);assert.equal(out.finalization.finishedGameResult,null);
    const changed=structuredClone(out);changed.reason='different-transport-reason';assert.equal(A.matchesGameplayOutcome(req,job,changed),false);
   }finally{E.dispose(e);}
  }
 }finally{source.dispose();}
});
