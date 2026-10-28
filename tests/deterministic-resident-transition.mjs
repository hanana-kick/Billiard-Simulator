import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {packSourceAxialCandidates,advanceAxialIntegerBody} from '../src/direct-candidate/deterministic-axial.mjs';
import {packResidentScene,packResidentCandidates,runResidentTransitionCPU,createResidentTransitionGPU} from '../src/direct-candidate/deterministic-resident-transition.mjs';
const Q=2**24,R=1/32,material={gravity:10,clothFriction:.2,rollingLength:.00045,spinLength:.00035};
const body=(x,v=0,c=0)=>({id:1,position:[x,.2+R,.125],velocity:[v,0,0],angular:[0,0,-c/R],radius:R,mass:.21,provenance:'prepared-flat-constant-load'});
const candidate=(id,x=.09,extra={})=>({id,bodies:[body(0,1,.2),body(x),body(.6,1,.2)],material,duration:.04,geometryHorizon:.04,geometryProvenance:'prepared-no-static-contact-interval',...extra});
const sceneInput={motionMaterial:material,provenance:'prepared-finite-cloth-and-static-bounds',ballCount:3,radius:R,mass:.21,y:.2+R,z:.125,clothTop:.2,clothFootprint:[-1,1,-.5,.5],restitution:.8,pairFriction:.2,clothFriction:.2,staticBounds:[[[.9,1],[-.1,.5],[-.5,.5]]]};
const scene=()=>packResidentScene(sceneInput);
const cases=[candidate(1),candidate(2,.0916),candidate(3,.09161),candidate(4,.095),candidate(5,.1),candidate(6,.1,{bodies:[body(.1),body(0,1,.2),body(.6,1,.2)]})];
test('resident transition evaluates all anchors at upper tick and merges real liftoff without stale coefficients',()=>{
 const {rows,scene:context}=packResidentCandidates(cases,sceneInput),result=runResidentTransitionCPU(rows,context),state=new Int32Array(result.state.buffer),original=new Int32Array(rows.buffer);
 for(let k=0;k<cases.length;k++){
  const b=k*128;assert.equal(result.state[b+1],7,JSON.stringify(Array.from(result.state.slice(b,b+16))));assert.equal(result.state[b+8],0xffffffff);assert.equal(result.state[b+11],1);assert.ok(result.state[b+9]!==0);assert.ok(result.state[b+10]!==0);
  const upper=result.state[b+4];assert.equal(result.state[b+13],upper);for(let i=0;i<3;i++){
   const anchor=advanceAxialIntegerBody(original,k*48+8+i*10,upper),at=b+16+i*12;
   assert.equal(state[at],anchor[0]);assert.equal(state[at+1],Math.round(sceneInput.y*Q));assert.equal(state[at+2],Math.round(sceneInput.z*Q));assert.equal(state[at+11],Math.round(.21*Q));
   if(!(result.state[b+9]&(1<<i))){assert.equal(state[at+3],anchor[1]);assert.equal(state[at+8],anchor[5]);}
  }
  assert.ok(state[b+20]>0||state[b+32]>0,'vertical velocity is retained, not projected');
 }
});
test('static footprint/profile/other-pair guards reject before contact and raw scene is validated',()=>{
 const {rows}=packSourceAxialCandidates([cases[0]]),base=scene();
 const obstacle=packResidentScene({...sceneInput,staticBounds:[[[.045,.055],[.2,.3],[.1,.15]]]});assert.equal(runResidentTransitionCPU(rows,obstacle).state[2],4);
 const edge=packResidentScene({...sceneInput,clothFootprint:[-.01,1,-.5,.5]});assert.equal(runResidentTransitionCPU(rows,edge).state[2],4);
 const spin=rows.slice();spin[12]=1;assert.equal(runResidentTransitionCPU(spin,base).state[2],3);
 const mismatch=rows.slice();mismatch[17]++;assert.equal(runResidentTransitionCPU(mismatch,base).state[2],3);
 const bad=base.slice();bad[2]=0xffffffff;assert.throws(()=>runResidentTransitionCPU(rows,bad),/scene/);
 const unknown=rows.slice();unknown[2]=1;const pending=runResidentTransitionCPU(unknown,base);assert.equal(pending.state[1],4);assert.equal(pending.state[8],0xffffffff);
 const exhausted=rows.slice();exhausted[3]=1;assert.equal(runResidentTransitionCPU(exhausted,base).state[1],5);
 const close=packSourceAxialCandidates([candidate(8,.09,{bodies:[body(0,1,.2),body(.09),body(.09+2*R+4/Q)]})]).rows;
 const rejected=runResidentTransitionCPU(close,base);assert.equal(rejected.state[2],5);
});
test('composed packer rejects omitted or conflicting physical scene metadata',()=>{
 for(const [field,value] of [['y',R],['z',0],['mass',.22],['radius',R+.001]])assert.throws(()=>packResidentCandidates(cases,{...sceneInput,[field]:value}),/mismatch|support/);
 assert.throws(()=>packResidentCandidates([{...cases[0],material:{...material,rollingLength:.0005}}],sceneInput),/mismatch/);
 assert.throws(()=>packResidentCandidates(cases,{...sceneInput,motionMaterial:undefined}),/material/);
});

test('four native phases stay resident and match every CPU state/intermediate word',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:30000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{
  const varied=Array.from({length:64},(_,i)=>candidate(100+i,.08+(i%21)*.001));const packed=packResidentCandidates([...cases,...varied],sceneInput),context=packed.scene,rows=new Uint32Array(packed.rows.length+4*48);rows.set(packed.rows);
  for(let i=0;i<4;i++){rows.set(packed.rows.subarray(0,48),packed.rows.length+i*48);rows[packed.rows.length+i*48]=900+i;}
  rows[packed.rows.length+12]=1;rows[packed.rows.length+48+17]++;rows[packed.rows.length+96+3]=1;rows[packed.rows.length+144+1]=0xffffffff;
  const cpu=runResidentTransitionCPU(rows,context),engine=await createResidentTransitionGPU(device);
  const padded=new Uint32Array(rows.length+8);padded.set(rows,4);const actual=await engine.run(padded.subarray(4,4+rows.length),context,{diagnostic:true});
  for(const key of ['state','events','contacts','responses'])assert.deepEqual(actual[key],cpu[key],key);
  assert.equal(actual.metrics.intermediateReadbacks,0);assert.equal(actual.metrics.hostPhysicsBetweenPhases,0);
  const obstacle=packResidentScene({...sceneInput,staticBounds:[[[.045,.055],[.2,.3],[.1,.15]]]});const blocked=await engine.run(rows,obstacle);assert.deepEqual(blocked.state,runResidentTransitionCPU(rows,obstacle).state);
  const limited=packResidentScene({...sceneInput,maxIterations:1});assert.deepEqual((await engine.run(rows,limited)).state,runResidentTransitionCPU(rows,limited).state);
  const receipt={profile:'prepared-resident-event-contact-transition-v1',cases:rows.length/48,comparedWords:Object.values(cpu).reduce((sum,a)=>sum+a.length,0),exactWords:true,compileMs:engine.compileMs,shaderBytes:engine.shaderBytes,metrics:actual.metrics,completedTransitions:Array.from({length:rows.length/48},(_,i)=>cpu.state[i*128+1]).filter(s=>s===7).length,fullShot:false};t.diagnostic(JSON.stringify(receipt));
  if(process.env.DETERMINISTIC_RESIDENT_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DETERMINISTIC_RESIDENT_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
