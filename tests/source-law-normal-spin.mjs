import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {advanceNormalSpin,inspectSupportedSpinState,planSupportedSpinAdvance,capturePreparedSpinWorld,stepPreparedSpinWorld} from '../src/direct-candidate/source-law-normal-spin.mjs';
const material={gravity:9.81,spinLength:.00035};
const radius=.03075;
const body=(id=1,spin=1,x=0)=>({id,position:[x,Math.fround(radius),0],velocity:[0,0,0],angular:[0,spin,0],rotation:[0,0,0,1],radius});
const state=balls=>({profile:'prepared-original-law-boundary',material,support:{kind:'horizontal-cloth-box',top:0,min:[-1.42,-.1,-.71],max:[1.42,0,.71]},balls,jointCount:0,cue:false,externalDynamics:false});
const near=(actual,expected,bound=1e-12)=>assert.ok(Math.abs(actual-expected)<=bound,`${actual} != ${expected}`);
test('original-length law gives exact spin angle and stop, including negative spin and zero drag',()=>{
 const beta=5*material.gravity*material.spinLength/(2*radius**2),stop=1/beta;
 for(const sign of [-1,1]){
  const half=advanceNormalSpin(body(1,sign),material,stop/2);near(half.angular[1],sign*.5);near(half.angle,sign*.375/beta);
  const end=advanceNormalSpin(body(1,sign),material,stop*2);assert.equal(end.angular[1],0);near(end.angle,sign*.5/beta);near(Math.hypot(...end.rotation),1);
 }
 const noDrag=advanceNormalSpin(body(),{...material,spinLength:0},2);assert.equal(noDrag.angular[1],1);near(noDrag.angle,2);assert.equal(noDrag.stopTime,Infinity);
});
test('one global clock resolves multiple/simultaneous stops and an external event horizon',()=>{
 const input=state([body(1,1,-.5),body(2,-1,0),body(3,2,.5)]),original=structuredClone(input);
 const result=planSupportedSpinAdvance(input,.3);assert.equal(result.eligible,true);assert.deepEqual(result.events[0].stopped,[1,2]);assert.deepEqual(result.events[1].stopped,[3]);assert.ok(result.balls.every(b=>b.angular[1]===0));assert.deepEqual(input,original);
 const limited=planSupportedSpinAdvance(input,.3,{externalHorizon:.05});near(limited.advancedDuration,.05);near(limited.remainder,.25);assert.equal(limited.events[0].kind,'horizon');
});
test('guards refuse approximate support, translating/sliding, other contact, cue and unowned dynamics',()=>{
 const original=state([body()]);assert.equal(inspectSupportedSpinState(original).eligible,true);
 for(const edit of [s=>s.balls[0].position[1]-=1e-7,s=>s.balls[0].velocity[0]=1e-10,s=>s.balls[0].angular[0]=1e-10,s=>s.balls[0].otherContact=true,s=>s.cue=true,s=>s.externalDynamics=true,s=>s.jointCount=1,s=>s.profile='unknown']){
  const s=structuredClone(original);edit(s);assert.equal(inspectSupportedSpinState(s).eligible,false);
 }
 assert.equal(inspectSupportedSpinState(state([body(1,1,0),body(2,1,.01)])).eligible,false);
 const overflow=state([body()]);overflow.material={...material,spinLength:1e308};assert.equal(inspectSupportedSpinState(overflow).reason,'nonfinite-spin-rate');
});
function loadOriginal(){
 const require=createRequire(import.meta.url);assert.ok(process.env.DIRECT_CUE_RAPIER_PATH,'Trusted original Rapier path required');const R=require(process.env.DIRECT_CUE_RAPIER_PATH);
 const context=vm.createContext({console});for(const name of ['math','physics'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context);return {R,...context};
}
test('actual original scene: strict prepared guard skips real world.step calls; fallback remains original',{skip:!process.env.DIRECT_CUE_RAPIER_PATH},async t=>{
 const {R,PhysicsLab}=loadOriginal();await R.init();
 const lab=new PhysicsLab(R);try{
  // Explicit PREPARED exact mechanical support, not an automatic live-shot fit.
  for(const [i,o] of lab.objects.entries()){
   o.body.setTranslation({x:-.6+i*.6,y:Math.fround(o.radius),z:0},true);
   o.body.setLinvel({x:0,y:0,z:0},true);o.body.setAngvel({x:0,y:i===0?1:0,z:0},true);
   o.lastPos={...o.body.translation()};
  }
  lab.world.propagateModifiedBodyPositionsToColliders();
  const beforeNoop=JSON.stringify({time:lab.time,steps:lab.steps,lastPos:lab.objects.map(o=>o.lastPos),distance:lab.objects.map(o=>o.distance)});
  assert.equal(stepPreparedSpinWorld(lab,0,{enabled:true,preparedBoundary:true}).path,'no-op');assert.equal(JSON.stringify({time:lab.time,steps:lab.steps,lastPos:lab.objects.map(o=>o.lastPos),distance:lab.objects.map(o=>o.distance)}),beforeNoop);
  assert.throws(()=>stepPreparedSpinWorld(lab,1,{enabled:true,externalHorizon:NaN}),/horizon/);
  const cloth=lab.statics.find(o=>o.kind==='cloth'),groups=cloth.collider.collisionGroups();cloth.collider.setCollisionGroups(0);assert.equal(inspectSupportedSpinState(capturePreparedSpinWorld(lab,{preparedBoundary:true})).eligible,false);cloth.collider.setCollisionGroups(groups);
  lab.objects[0].collider.setEnabled(false);assert.equal(inspectSupportedSpinState(capturePreparedSpinWorld(lab,{preparedBoundary:true})).eligible,false);lab.objects[0].collider.setEnabled(true);
  cloth.collider.setSolverGroups(0);assert.equal(inspectSupportedSpinState(capturePreparedSpinWorld(lab,{preparedBoundary:true})).eligible,false);cloth.collider.setSolverGroups(0xffffffff);
  lab.objects[0].collider.setActiveCollisionTypes(0);assert.equal(inspectSupportedSpinState(capturePreparedSpinWorld(lab,{preparedBoundary:true})).eligible,false);lab.objects[0].collider.setActiveCollisionTypes(15);
  lab.objects[0].body.setEnabled(false);assert.equal(inspectSupportedSpinState(capturePreparedSpinWorld(lab,{preparedBoundary:true})).eligible,false);lab.objects[0].body.setEnabled(true);
  const capture=capturePreparedSpinWorld(lab,{preparedBoundary:true}),guard=inspectSupportedSpinState(capture);assert.equal(guard.eligible,true,guard.reason+' '+JSON.stringify(capture));
  let calls=0;const nativeStep=lab.world.step.bind(lab.world);lab.world.step=(...args)=>{calls++;return nativeStep(...args);};
  const before={time:lab.time,steps:lab.steps,events:JSON.stringify(lab.events),distance:lab.objects.map(o=>o.distance),sleep:lab.objects.map(o=>o.body.isSleeping())};
  const result=stepPreparedSpinWorld(lab,240,{enabled:true,preparedBoundary:true});
  assert.equal(result.path,'analytic');assert.equal(calls,0);assert.equal(result.sourceStepsSkipped,240);near(lab.time-before.time,.25);assert.equal(lab.steps-before.steps,240);
  assert.equal(lab.objects[0].body.angvel().y,0);assert.equal(lab.anyMotion(),false);assert.equal(JSON.stringify(lab.events),before.events);assert.deepEqual(lab.objects.map(o=>o.distance),before.distance);assert.deepEqual(lab.objects.map(o=>o.body.isSleeping()),before.sleep);
  const beta=5*lab.params.gravity*lab.params.spinLength/(2*radius**2),expectedAngle=.5/beta,q=lab.objects[0].body.rotation();
  near(q.y,Math.sin(expectedAngle/2),2**-23);near(q.w,Math.cos(expectedAngle/2),2**-23);
  const fallback=stepPreparedSpinWorld(lab,2,{enabled:true,preparedBoundary:true,externalHorizon:0});assert.equal(fallback.path,'original');assert.equal(calls,2);
  const disabled=stepPreparedSpinWorld(lab,1);assert.equal(disabled.reason,'disabled');assert.equal(calls,3);
  lab.objects[0].body.setLinvel({x:.1,y:0,z:0},true);
  const translating=stepPreparedSpinWorld(lab,1,{enabled:true,preparedBoundary:true});assert.equal(translating.path,'original');assert.equal(calls,4);
  t.diagnostic(JSON.stringify({preparedOnly:true,actualSourceStepsSkipped:240,actualFallbackSteps:4,spinErrorAtStop:0,orientationComponentError:Math.max(Math.abs(q.y-Math.sin(expectedAngle/2)),Math.abs(q.w-Math.cos(expectedAngle/2))),fullShot:false,gpu:false}));
 }finally{lab.world.free();lab.queue.free();}
});
