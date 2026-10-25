'use strict';
// CPU-only original-engine capture boundaries. No candidate continuation/GPU.
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs');
require('../src/math.js');require('../src/render-cadence.js');require('../src/physics.js');
require('../src/game-rules.js');require('../src/controller.js');
let capture;before(async()=>{await R.init();({captureLiveRegisteredFourBall:capture}=await import('../src/browser-initial-import/live-capture.mjs'));});
const settings={angle:0,elevation:8,tipX:0,tipY:0,speed:2};
const input=(overrides={},three=false)=>({settings:{...settings,...overrides},rules:{fourBallThreeCushion:three}});
const copy=structuredClone;
function create(){const c=new LabController();c.lab=new PhysicsLab(R);c.state.gameMode='four';c.setupGame();return c;}
function dispose(c){clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
function state(c){return copy({physics:c.lab.snapshot(),state:c.state,game:c.game.snapshot(),gameUndo:c.gameUndo,undo:c.undoStack,redo:c.redoStack,cooldownUntil:c.cooldownUntil,requestKey:c.requestKey});}
function zeroSteps(fn){const original=R.World.prototype.step;let count=0;R.World.prototype.step=function(...args){count++;return original.apply(this,args);};try{fn();assert.equal(count,0,'No native step in any capture world');}finally{R.World.prototype.step=original;}}
test('distinct candidates own exact settings/rules from same source; independent original fire equality',()=>{
 const source=create(),baseline=state(source),refs=[source.lab,source.lab.world,source.state,source.undoStack,source.redoStack];const results=[];
 try{zeroSteps(()=>{
  for(const proposed of [input(),input({angle:17.125,elevation:35,speed:1.35,tipX:.17,tipY:-.23},true)]){
   const requested=copy(proposed),result=capture({controller:source,candidate:proposed});results.push(result);
   assert.deepEqual(state(source),baseline);assert.deepEqual([source.lab,source.lab.world,source.state,source.undoStack,source.redoStack],refs);
   assert.deepEqual(result.preStrikeSnapshot,baseline.physics.world);
   assert.deepEqual(result.capture.application.controller.settings,requested.settings);
   assert.equal(result.capture.application.game.pending.threeCushion,requested.rules.fourBallThreeCushion);
   const independent=source.lab.fork();
   try{
    const measured=independent.cueClearance(independent.get(source.state.selectedId),requested.settings);
    assert.deepEqual(result.candidateAdmission,{kind:'original-prestrike-cue-clearance',selectedId:source.state.selectedId,
     settings:requested.settings,rules:requested.rules,time:baseline.physics.time,sourceApplicationSteps:baseline.physics.steps,
     sourceRevision:baseline.physics.revision,sourceShots:baseline.physics.shots,selectedBody:result.capture.preStrikeApplication.registry.objects.find(o=>o.id===source.state.selectedId).body,
     clearance:{clear:measured.clear,distance:measured.distance},strikeAccepted:true,historyContactCount:baseline.physics.events.filter(e=>e.kind==='contact').length});
   }finally{independent.dispose();}
   assert.deepEqual(result.candidateProvenance.requested,requested);
   assert.deepEqual(result.candidateProvenance.sourceApplication.controller.settings,baseline.state.settings);
   assert.equal(result.candidateProvenance.sourceApplication.game.pending,null);
   assert.equal(result.candidateProvenance.captureNativeSteps,0);
   proposed.settings.speed=9;proposed.rules.fourBallThreeCushion=!requested.rules.fourBallThreeCushion;
   assert.deepEqual(result.candidateProvenance.requested,requested);
   // Independent original path, no helper capture or decoded reconstruction.
   const original=new LabController();original.lab=source.lab.fork();original.state=copy(source.state);
   original.state.settings=copy(requested.settings);original.state.routeOptions.fourBallThreeCushion=requested.rules.fourBallThreeCushion;
   original.game=new FourBallGame();original.game.restore(source.game.snapshot());
   try{assert.equal(original.fire(),true);assert.deepEqual(result.snapshot,original.lab.world.takeSnapshot());assert.deepEqual(result.capture.application.game,original.game.snapshot());}finally{dispose(original);}
  }
  assert.notDeepEqual(results[0].snapshot,results[1].snapshot);
  results[0].candidateProvenance.sourceApplication.controller.settings.angle=99;
  results[0].controller.state.settings.speed=8;
  assert.deepEqual(state(source),baseline);assert.equal(results[1].candidateProvenance.sourceApplication.controller.settings.angle,0);
 });}finally{results.forEach(r=>r.dispose());dispose(source);}
});
test('invalid candidate data rejected before fork, without evaluating accessors',()=>{
 const source=create(),baseline=state(source);let forks=0,getters=0;const fork=source.lab.fork;source.lab.fork=function(){forks++;return fork.call(this);};
 const getter=input();Object.defineProperty(getter.settings,'angle',{get(){getters++;return 0;},enumerable:true});
 const symbol=input();symbol.settings[Symbol('hidden')]=0;
 const inherited=input();inherited.settings=Object.create(settings);
 const cases=[undefined,null,{},input({speed:NaN}),input({speed:0}),input({speed:11}),input({elevation:86}),input({tipX:1}),input({extra:1}),getter,symbol,inherited,{...input(),extra:1},{settings,rules:{fourBallThreeCushion:1}},{settings,rules:{fourBallThreeCushion:false,allowKiss:true}}];
 try{zeroSteps(()=>{for(const candidate of cases)assert.throws(()=>capture({controller:source,candidate}));});assert.equal(forks,0);assert.equal(getters,0);assert.deepEqual(state(source),baseline);}finally{dispose(source);}
});
test('input mutation during fork cannot change owned proposal',()=>{
 const source=create(),candidate=input(),fork=source.lab.fork;let result;
 source.lab.fork=function(){candidate.settings.speed=9;candidate.rules.fourBallThreeCushion=true;return fork.call(this);};
 try{zeroSteps(()=>{result=capture({controller:source,candidate});});assert.deepEqual(result.candidateProvenance.requested,input());assert.deepEqual(result.capture.application.controller.settings,settings);assert.equal(result.capture.application.game.pending.threeCushion,false);}finally{result?.dispose();dispose(source);}
});
test('cancellation, mid-fire mutation and attempted stepping dispose only private fork',()=>{
 const source=create(),baseline=state(source),fork=source.lab.fork;let frees=0,forks=0;
 source.lab.fork=function(){forks++;const lab=fork.call(this),dispose=lab.dispose;lab.dispose=function(){frees++;return dispose.call(this);};return lab;};
 const canceled=new AbortController();canceled.abort(new Error('cancel-before'));
 try{zeroSteps(()=>{
  assert.throws(()=>capture({controller:source,candidate:input(),signal:canceled.signal}),/cancel-before/);assert.equal(forks,0);
  const signal=new AbortController();
  class CancelFire extends LabController{fire(){const ok=super.fire();signal.abort(new Error('cancel-after-fire'));return ok;}}
  assert.throws(()=>capture({controller:source,candidate:input(),LabController:CancelFire,signal:signal.signal}),/cancel-after-fire/);
  class MutateSettings extends LabController{fire(){const ok=super.fire();this.state.settings.speed=3;return ok;}}
  assert.throws(()=>capture({controller:source,candidate:input(),LabController:MutateSettings}),/settings changed/);
  class MutateRules extends LabController{fire(){const ok=super.fire();this.game.pending.threeCushion=true;return ok;}}
  assert.throws(()=>capture({controller:source,candidate:input(),LabController:MutateRules}),/rules changed/);
  class StepFire extends LabController{fire(){this.lab.world.step();return super.fire();}}
  assert.throws(()=>capture({controller:source,candidate:input(),LabController:StepFire}),/no native step/);
 });assert.equal(forks,4);assert.equal(frees,4);assert.deepEqual(state(source),baseline);
 const retry=capture({controller:source,candidate:input()});retry.dispose();retry.dispose();assert.equal(frees,5);
 }finally{dispose(source);}
});
test('source motion/pending and original clearance refusal cannot become candidates',()=>{
 const source=create();let result;
 try{
  source.game.begin(1);assert.throws(()=>capture({controller:source,candidate:input()}),/unfinished/);source.game.pending=null;
  source.lab.objects[0].body.setLinvel({x:1,y:0,z:0},true);assert.throws(()=>capture({controller:source,candidate:input()}),/moving/);
 }finally{result?.dispose();dispose(source);}
 const blocked=create();
 try{const candidate=[0,45,90,135,180,-45,-90,-135].map(angle=>input({angle,elevation:0})).find(c=>!blocked.lab.cueClearance(blocked.lab.get(1),c.settings).clear);assert.ok(candidate);assert.equal(blocked.lab.cueClearance(blocked.lab.get(1),candidate.settings).clear,false);const baseline=state(blocked);zeroSteps(()=>assert.throws(()=>capture({controller:blocked,candidate}),/original candidate clearance refused/));assert.deepEqual(state(blocked),baseline);}finally{dispose(blocked);}
});

test('admission query refuses missing/nonfinite/mutated/stale state without source mutation',()=>{
 const source=create(),baseline=state(source),fork=source.lab.fork;
 const cases=[
  lab=>{lab.cueClearance=()=>undefined;},
  lab=>{lab.cueClearance=()=>({clear:true,distance:NaN});},
  lab=>{lab.cueClearance=()=>({clear:true,distance:Infinity});},
  lab=>{const query=lab.cueClearance;lab.cueClearance=function(o,s){s.speed=4;return query.call(this,o,s);};},
  lab=>{const query=lab.cueClearance;lab.cueClearance=function(o,s){this.revision++;return query.call(this,o,s);};},
  lab=>{const query=lab.cueClearance;lab.cueClearance=function(o,s){o.body.setLinvel({x:1,y:0,z:0},true);return query.call(this,o,s);};},
  lab=>{lab.cueClearance=function(){this.step();};},
  (lab,c)=>{const query=lab.cueClearance;lab.cueClearance=function(o,s){c.state.selectedId=2;return query.call(this,o,s);};},
  (lab,c)=>{const query=lab.cueClearance;lab.cueClearance=function(o,s){c.state.routeOptions.fourBallThreeCushion=true;return query.call(this,o,s);};}
 ];
 let disposed=0,privateController;class Tracked extends LabController{constructor(){super();privateController=this;}}
 try{zeroSteps(()=>{for(const change of cases){source.lab.fork=function(){const lab=fork.call(this),free=lab.dispose;lab.dispose=function(){disposed++;return free.call(this);};change(lab,privateController);return lab;};assert.throws(()=>capture({controller:source,candidate:input(),LabController:Tracked}),/admission|clearance/);assert.deepEqual(state(source),baseline);}});assert.equal(disposed,cases.length);
 source.lab.fork=fork;
 const result=capture({controller:source,candidate:input()});
 try{result.candidateAdmission.settings.speed=8;result.candidateAdmission.clearance.distance=-1;result.candidateAdmission.rules.fourBallThreeCushion=true;
 assert.deepEqual(result.capture.application.controller.settings,settings);assert.deepEqual(result.candidateProvenance.requested,input());assert.deepEqual(state(source),baseline);
 }finally{result.dispose();}
 }finally{dispose(source);}
});
test('original fire refusal still rejects a geometrically clear candidate',()=>{
 const source=create(),baseline=state(source);class Refuse extends LabController{fire(){return false;}}
 try{zeroSteps(()=>assert.throws(()=>capture({controller:source,candidate:input(),LabController:Refuse}),/fire did not succeed/));assert.deepEqual(state(source),baseline);}finally{dispose(source);}
});
