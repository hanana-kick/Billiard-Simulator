import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {precomputeSourceCandidateEvent,evaluatePreparedSourceLawCandidate} from '../src/direct-candidate/source-law-candidate-evaluator.mjs';
function observe(lab){return {time:lab.time,steps:lab.steps,balls:lab.objects.map(o=>({position:o.body.translation(),velocity:o.body.linvel(),angular:o.body.angvel(),rotation:o.body.rotation(),distance:o.distance,maxHeight:o.maxHeight,trail:JSON.stringify(o.trail)})),events:JSON.stringify(lab.events)};}
test('candidate evaluator uses actual current state, optimizes admitted spin, otherwise executes identical source physics',{skip:!process.env.DIRECT_CUE_RAPIER_PATH},async t=>{
 const R=createRequire(import.meta.url)(process.env.DIRECT_CUE_RAPIER_PATH);await R.init();const c=vm.createContext({console});for(const file of ['math','physics'])vm.runInContext(readFileSync(new URL('../src/'+file+'.js',import.meta.url),'utf8'),c);
 const make=mode=>{
  const translating=!!mode,near=mode==='near-rail',moving=mode==='moving-pair',draw=mode==='draw';
  const lab=new c.PhysicsLab(R);
  lab.objects.forEach((o,i)=>{o.body.setTranslation({x:near?(i===0?1.3:i===1?0:-.6):(i===0?-.2:i===1?-.06:.5),y:Math.fround(o.radius),z:i===2?.5:0},true);o.body.setLinvel({x:translating&&i===0?1:moving&&i===1?-.5:0,y:0,z:0},true);o.body.setAngvel({x:0,y:!translating&&i===0?1:0,z:translating&&i===0?(draw?1:-.2)/o.radius:moving&&i===1?.1/o.radius:0},true);o.lastPos={...o.body.translation()};});lab.world.propagateModifiedBodyPositionsToColliders();return lab;
 };
 const labs=[];try{
  const spin=make(false);labs.push(spin);const result=evaluatePreparedSourceLawCandidate(spin,{frames:240,enabled:true,preparedBoundary:true,diagnostics:true});
  assert.equal(result.counters.analyticFrames,240);assert.equal(result.counters.actualWorldStepCalls,0);assert.equal(result.sourceReportsRest,true);assert.equal(result.pass,null);
  const spinReference=make(false);labs.push(spinReference);let clock=performance.now();spinReference.step(240);const spinReferenceMs=performance.now()-clock;
  const delta=(a,b)=>({position:Math.max(...a.objects.map((o,i)=>Math.hypot(...['x','y','z'].map(k=>o.body.translation()[k]-b.objects[i].body.translation()[k])))),velocity:Math.max(...a.objects.map((o,i)=>Math.hypot(...['x','y','z'].map(k=>o.body.linvel()[k]-b.objects[i].body.linvel()[k])))),angular:Math.max(...a.objects.map((o,i)=>Math.hypot(...['x','y','z'].map(k=>o.body.angvel()[k]-b.objects[i].body.angvel()[k])))),orientationComponent:Math.max(...a.objects.flatMap((o,i)=>['x','y','z','w'].map(k=>Math.abs(o.body.rotation()[k]-b.objects[i].body.rotation()[k]))))});
  const spinEndDelta=delta(spin,spinReference);
  const resumed=evaluatePreparedSourceLawCandidate(spin,{frames:24,enabled:false});spinReference.step(24);assert.equal(resumed.counters.actualWorldStepCalls,24);const spinResumeDelta=delta(spin,spinReference);assert.ok(Object.values(spinResumeDelta).every(Number.isFinite));assert.ok(spin.objects.every(o=>o.body.linvel().x===0&&o.body.linvel().z===0));
  const cases=[];
  for(const mode of ['forward-slip','draw','near-rail','moving-pair']){const optimized=make(mode),baseline=make(mode);labs.push(optimized,baseline);const evaluated=evaluatePreparedSourceLawCandidate(optimized,{frames:96,enabled:true,preparedBoundary:true,diagnostics:true});clock=performance.now();baseline.step(96);const referenceMs=performance.now()-clock;assert.equal(evaluated.counters.analyticFrames,0);assert.equal(evaluated.counters.actualWorldStepCalls,96);assert.deepEqual(observe(optimized),observe(baseline));cases.push({mode,counters:evaluated.counters,wallMs:evaluated.wallMs,referenceMs,endpointDelta:delta(optimized,baseline)});}
  const candidate=make(true),reference=make(true);labs.push(candidate,reference);
  const before=observe(candidate),prediction=precomputeSourceCandidateEvent(candidate,{duration:.1,preparedBoundary:true});assert.equal(prediction.eligible,true);assert.equal(prediction.event.kind,'pair');assert.deepEqual(observe(candidate),before);
  const translated=evaluatePreparedSourceLawCandidate(candidate,{frames:96,enabled:true,preparedBoundary:true,diagnostics:true});reference.step(96);
  assert.equal(translated.counters.analyticFrames,0);assert.equal(translated.counters.actualWorldStepCalls,96);assert.ok(translated.counters.eventPredictions>=1);assert.deepEqual(observe(candidate),observe(reference));assert.ok(translated.records.some(r=>r.reason==='translating-advancement-unqualified'));
  const disabled=make(false);labs.push(disabled);assert.equal(evaluatePreparedSourceLawCandidate(disabled,{frames:2}).counters.actualWorldStepCalls,2);
  const unverified=make(false);labs.push(unverified);assert.equal(evaluatePreparedSourceLawCandidate(unverified,{frames:2,enabled:true}).counters.actualWorldStepCalls,2);
  const noOp=observe(candidate);assert.equal(evaluatePreparedSourceLawCandidate(candidate,{frames:0,enabled:true,preparedBoundary:true}).counters.actualWorldStepCalls,0);assert.deepEqual(observe(candidate),noOp);
  const receipt={spin:{counters:result.counters,wallMs:result.wallMs,referenceMs:spinReferenceMs,finiteStepEndpointDelta:spinEndDelta,after24OriginalFallbackSteps:spinResumeDelta},translationCases:cases,translatingOriginalStateAgreement:'exact in these fixtures',translatingPhysicalAccuracyClaim:false,cacheEquivalenceClaim:false,rawShot:false,fullShot:false};
  t.diagnostic(JSON.stringify(receipt));if(process.env.SOURCE_LAW_EVALUATOR_RECEIPT)writeFileSync(process.env.SOURCE_LAW_EVALUATOR_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
 }finally{for(const lab of labs){lab.world.free();lab.queue.free();}}
});
