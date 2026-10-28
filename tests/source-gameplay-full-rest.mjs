// Actual original-CPU gameplay policy gates, not GPU qualification. Inputs are
// known physical holdouts; no future snapshot, injected contact or forced latch.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import '../src/math.js';
import '../src/render-cadence.js';
import '../src/physics.js';
import '../src/game-rules.js';
import '../src/route-rules.js';
import '../src/controller.js';
import '../src/optimizer-core.js';
import '../src/source-query-finalization-policy.js';
import '../src/source-finalization-request.js';
import '../src/source-gameplay-finalization-owner.js';
import '../src/inverse-events.js';

const R=createRequire(import.meta.url)('../vendor/rapier.cjs');
globalThis.RAPIER=R;
const E=globalThis.LabInverseEvents,F=globalThis.LabSourceFinalizationRequest;
const settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
const topology={id:'known-physical-two-reds',firstId:3,secondId:4,events:[{kind:'object',id:3},{kind:'object',id:4}]};
const late=JSON.parse(fs.readFileSync(new URL('./four-ball-goal-late-opponent-input.json',import.meta.url),'utf8'));
const inputs=[
 {name:'positive',placements:[{id:1,x:-.5,z:0},{id:2,x:-.8,z:.4},{id:3,x:.0435,z:.0435},{id:4,x:.2615,z:-.2}],delta:1},
 {name:'late-opponent-foul',placements:late.placements,delta:-1}
];
const rested=lab=>!lab.cue&&lab.objects.every(o=>o.body.isSleeping());

for(const input of inputs)test('original CPU finalization: '+input.name,async t=>{
 await R.init();const c=new LabController();let e;
 try{
  c.lab=new PhysicsLab(R);c.state.gameMode='four';c.setupGame();
  for(const p of input.placements)assert.equal(c.move(p.id,{x:p.x,y:c.lab.get(p.id).radius+.00005,z:p.z}),true);
  let settle=0;while(settle<2000&&!c.lab.objects.every(o=>o.body.isSleeping())){c.lab.step();settle++;}
  assert.ok(c.lab.objects.every(o=>o.body.isSleeping()),'genuine ready source');
  c.state.settings={...settings};
  const raw={snapshot:c.lab.snapshot({trails:false}),selectedId:1,testBudget:true,settings,
   options:{gameMode:'four',mode:'carom',opponentId:2,targetId:3,secondId:4,fourBallThreeCushion:false,methodId:'carom',budget:1,horizon:8,spin:false,objective:'shortest',elevationMode:'fixed',allowKiss:true}};
  const req=await F.bind(raw,{gameKind:'four',snapshot:c.game.snapshot(),worldObjectIds:c.lab.objects.map(o=>o.id),shotRules:{threeCushion:false}});
  const token=await F.admit(req),sourceBytes=c.lab.world.takeSnapshot(),sourceHistory=structuredClone(c.lab.events);
  e=E.begin(R,req,topology,settings,{purpose:'verify',finalizationAdmission:token});
  assert.deepEqual(c.lab.world.takeSnapshot(),sourceBytes,'evaluation did not mutate independent input');
  assert.deepEqual(c.lab.events,sourceHistory);
  const owner=e.finalizationOwner,ownedLab=e.trial.lab;
  const originalOnEvent=c.lab.onEvent,events=[],ownerEvents=[];
  c.lab.onEvent=function(event){originalOnEvent.call(this,event);events.push({event:structuredClone(event),pending:structuredClone(c.game.pending)});};
  const ownerOnEvent=ownedLab.onEvent;
  ownedLab.onEvent=function(event){ownerOnEvent.call(this,event);ownerEvents.push({event:structuredClone(event),pending:structuredClone(owner.game.pending)});};
  assert.equal(c.fire(),true);
  // Both original strikes emitted their stroke before their Game.begin call.
  assert.deepEqual(ownedLab.events,c.lab.events,'authentic created emission history');
  events.length=0;
  assert.deepEqual(ownedLab.world.takeSnapshot(),c.lab.world.takeSnapshot(),'independent created native state');
  let nativeSteps=0;const nativeStep=c.lab.world.step;
  c.lab.world.step=function(...args){nativeSteps++;return nativeStep.apply(this,args);};
  let outer=0,queryOuter=null,queryRest=null,out=null,matchedBoundaries=0,finishResult=null;
  const originalFinish=c.game.finish;c.game.finish=function(...args){finishResult=originalFinish.apply(this,args);return finishResult;};
  while(outer<Math.round(raw.options.horizon/c.lab.dt)&&!rested(c.lab)){
   c.lab.step();outer++;
   if(!e.done){
    E.advance(e,1);
    assert.equal(ownedLab,e.trial.lab,'same retained world');
    assert.equal(ownedLab.time,c.lab.time,'exact original clock');
    assert.equal(ownedLab.steps,c.lab.steps,'exact original outer count');
    assert.equal(e.observedSubsteps,nativeSteps,'exact independent native h count');
    assert.deepEqual(ownerEvents,events,'every original emission and immediate game effect');
    if(e.done||outer%128===0){
     assert.deepEqual(ownedLab.world.takeSnapshot(),c.lab.world.takeSnapshot(),'full native bytes at source boundary '+outer);
     assert.deepEqual(ownedLab.events,c.lab.events,'full original history at source boundary '+outer);matchedBoundaries++;
    }
    if(e.done){queryOuter=outer;queryRest=rested(ownedLab);out=E.finish(e);}
   }
   c.finishGameShot();
   if(!rested(c.lab))assert.equal(finishResult,null,'Controller never publishes unfinished score');
  }
  assert.ok(rested(c.lab),'independent original Controller reaches full rest within unchanged horizon');
  assert.equal(nativeSteps,input.delta===1?5480:5415,'unchanged actual holdout chronology');
  assert.ok(out,'explicit policy produced a terminal query');
  assert.deepEqual(finishResult,{cueId:1,delta:input.delta,nextCue:input.delta===1?1:2});
  assert.equal(F.matchesGameplayOutcome(req,{purpose:'verify',settings,topology},out),true);
  const goal=events.findIndex(x=>x.pending?.reds.length===2&&!x.pending.foul);
  assert.ok(goal>=0,'genuine two-red goal was physically observed');
  if(input.delta===1){
   assert.equal(queryOuter,outer);assert.equal(queryRest,true);
   assert.equal(out.status,'verified-final-gameplay');assert.equal(out.verified,true);assert.equal(out.goalVerified,true);
   assert.equal(out.finalization.physicalRest,true);assert.deepEqual(out.finalization.finishedGameResult,finishResult);
   assert.equal(F.verifiedGameplay(req,{purpose:'verify',settings,topology},out),true);
   assert.deepEqual(owner.game.snapshot(),c.game.snapshot());
   assert.equal(outer,5039);assert.equal(out.observedSubsteps,5480);
  }else{
   const foul=events.findIndex(x=>x.pending?.foul);
   assert.ok(foul>goal,'opponent foul occurred after the genuine goal');
   assert.ok(events[foul].event.time>events[goal].event.time,'strictly later physical event');
   assert.ok(queryOuter<outer);assert.equal(queryRest,false);
   assert.equal(out.status,'evaluated-negative');assert.equal(out.reason,'irreversible-source-game-foul');
   assert.equal(out.verified,false);assert.equal(out.goalVerified,false);assert.equal(out.physicalResult,null);
   assert.equal(out.finalization.finishedGameResult,null,'query did not fabricate the eventual original score');
   assert.equal(out.finalization.physicalRest,false);assert.equal(owner.game.pending.foul,true);
  }
  t.diagnostic(JSON.stringify({scope:'original CPU final-gameplay policy only',input:input.name,settle,queryOuter,fullRestOuter:outer,fullRestNativeSteps:nativeSteps,matchedNativeBoundaries:matchedBoundaries,emissions:events.length,gameResult:finishResult}));
 }finally{if(e)E.dispose(e);clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab?.dispose();}
});
