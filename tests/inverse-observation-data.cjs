'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../src/inverse-events.js');const O=LabInverseEvents.observation;
const object=id=>({kind:'object',id}),rail=rail=>({kind:'cushion',rail});
function frame({x=-.06,impact=false,time=.01,railImpact=false,sequence=Math.round(time/.01)}={}){return {phase:O.phase,sequence,time,stepDt:.01,cue:{radius:.03,position:{x,y:.03,z:0}},objects:[{id:2,radius:.03,position:{x:0,y:.03,z:0},impact}],rails:[{rail:'x+',projection:{point:{x:1,y:.03,z:0},isInside:false},impact:railImpact}]};}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
test('plain observation reducer needs no native/GPU world and never mutates or retains caller vectors',()=>{
 const e=O.create({events:[object(2)]},5),f=frame({x:-.1,time:5.01,sequence:1});const before=structuredClone(f);O.step(e,freeze(f));assert.deepEqual(f,before);assert.equal(e.observedSubsteps,1);assert.ok(e.stageResiduals[0][0]<0);assert.notEqual(e.previousMeasurement.cue,f.cue.position);
 const hit=frame({impact:true,time:5.02,sequence:2});O.step(e,freeze(hit));assert.equal(e.eventPrefix,1);assert.equal(e.firstImpact.time,5.02-5);assert.equal(e.firstImpact.stepDt,.01);assert.equal(e.firstImpact.stepIndex,2);
});
test('plain receipts preserve quick recontact, persistent episode, and ambiguous same-substep semantics',()=>{
 const e=O.create({events:[object(2),object(2)]});
 O.step(e,frame({impact:true}));O.step(e,frame({impact:true,time:.02}));assert.equal(e.events.length,1);assert.equal(e.stageResiduals[1],null);
 O.step(e,frame({x:-.1,time:.03}));O.step(e,frame({impact:true,time:.04}));assert.equal(e.events.length,2);assert.equal(e.eventPrefix,2);
 const a=O.create({events:[object(2),rail('x+')]});O.step(a,frame({impact:true,railImpact:true}));assert.equal(a.mismatch.reason,'ambiguous-simultaneous-events');assert.equal(a.eventPrefix,0);
});
test('wrong phase and malformed receipts fail before mutating reducer state',()=>{
 for(const mutate of [f=>f.phase='after-application',f=>f.stepDt=Infinity,f=>f.cue.radius=Infinity,f=>f.objects[0].radius=Infinity,f=>f.sequence=2,f=>f.objects[0].impact=1,f=>f.rails[0].projection=null,f=>f.objects.push({...f.objects[0]})]){
  const e=O.create({events:[object(2)]}),before=structuredClone(e),f=frame({railImpact:true});mutate(f);assert.throws(()=>O.step(e,f));assert.deepEqual(e,before);
 }
});
test('initial observation samples geometry without creating a solver episode',()=>{
 const e=O.create({events:[object(2)]}),f=frame({impact:true});f.phase='initial-before-world-step';f.stepDt=0;f.sequence=0;f.time=0;O.initial(e,freeze(f));assert.equal(e.events.length,0);assert.equal(e.observedSubsteps,0);assert.equal(e.eventPrefix,0);const before=structuredClone(e);assert.throws(()=>O.initial(e,f),/boundary/);assert.deepEqual(e,before);
});

test('duplicate, skipped, reversed sequence and nonincreasing time are rejected atomically',()=>{
 const e=O.create({events:[object(2)]});O.step(e,frame());
 for(const f of [frame(),frame({time:.02,sequence:3}),frame({time:.02,sequence:0}),frame({time:.01,sequence:2})]){
  const before=structuredClone(e);assert.throws(()=>O.step(e,f),/Stale|out-of-order/);assert.deepEqual(e,before);
 }
 assert.throws(()=>O.create({events:[object(2)]},Infinity),/Finite/);
});
