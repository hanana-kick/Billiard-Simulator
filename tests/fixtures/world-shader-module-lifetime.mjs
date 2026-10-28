import assert from 'node:assert/strict';
import {createPreparedPairContinuationGPU} from '../../src/direct-candidate/deterministic-prepared-world-gpu.mjs';
import {packCushionHull} from '../../src/direct-candidate/deterministic-cushion-geometry.mjs';
const hulls=Array.from({length:4},(_,id)=>packCushionHull({id,vertices:[0,0,0,1,0,0,0,1,0,0,0,1],indices:[0,2,1,0,1,3,0,3,2,1,2,3]}));
const refs=[],preflight=[],compiled=[];let stage='world',check=false,checked=false;
const device={
 createShaderModule({label}){const module={getCompilationInfo:async()=>{
  if(stage==='world')preflight.push(label);
  if(check){check=false;for(let i=0;i<4;i++){await new Promise(r=>setImmediate(r));global.gc();}assert.equal(refs.filter(r=>r.deref()).length,0,'World shader wrappers retained across downstream await');checked=true;}
  return {messages:[]};
 }};if(stage==='world')refs.push(new WeakRef(module));return module;},
 async createComputePipelineAsync({compute}){assert.ok(compute.module);if(stage==='world'){assert.equal(preflight.length,73,'All preflights precede compilation');compiled.push(compiled.length);}return {getBindGroupLayout:()=>({})};},
 createBindGroupLayout(){return {};},createPipelineLayout(){return {};},pushErrorScope(){},async popErrorScope(){return null;}
};
const engine=await createPreparedPairContinuationGPU(device,hulls,{mixedMotionRevision:'mmq2',onCompilePhase(x){if(typeof x.phase==='number')assert.equal(x.phase,compiled.length);else{stage=x.phase;if(stage==='microtail')check=true;}}});
assert.ok(engine);assert.ok(checked);assert.equal(compiled.length,73);
console.log('73 preflight modules compiled in order; 0 retained across microtail await (fake device only)');
