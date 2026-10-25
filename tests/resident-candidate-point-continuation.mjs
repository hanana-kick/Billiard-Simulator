import test from 'node:test';
import assert from 'node:assert/strict';
import Point from '../src/experimental-convex-point.js';
import {generateConvexPointWGSL,packSharedConvexHull,CONVEX_POINT_LAYOUT as P} from '../src/resident-candidate/convex-point.mjs';
import {generateConvexPointContinuationWGSL,originalPointGjkSplit,POINT_CONTINUATION_LAYOUT as L} from '../src/resident-candidate/convex-point-continuation.mjs';
import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createNativeOwner,dispatchWordStages} from './resident-candidate-gpu-support.mjs';
const F=Math.fround,bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0],real=x=>new Float32Array(Uint32Array.of(x).buffer)[0];
function functions(code){const out=new Map(),re=/\bfn\s+(\w+)\s*\(/g;let m;while((m=re.exec(code))){const open=code.indexOf('{',re.lastIndex);let depth=1,end=open+1;for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;else if(code[end]==='}')depth--;}assert.equal(depth,0);out.set(m[1],code.slice(m.index,end));re.lastIndex=end;}return out;}
// TEST ONLY: execute the emitted source function bodies with the original f32
// scalar semantics and integer storage adapters. Not exported to production.
function hostKernel(code,{state,scratch,geometry},entry='rc_project_convex_cont_stage'){
 const fn=functions(code),primitive={
  rc_point_addf:(a,b)=>F(a+b),rc_point_subf:(a,b)=>F(a-b),rc_point_mulf:(a,b)=>F(a*b),rc_point_divf:(a,b)=>F(a/b),rc_point_sqrtf:a=>F(Math.sqrt(a)),
  rc_point_absf:Math.abs,rc_point_minf:Math.min,rc_point_maxf:Math.max,rc_point_finitef:Number.isFinite,
  rc_point_signcopy:(sign,magnitude)=>real((bits(sign)&0x80000000)|(bits(magnitude)&0x7fffffff)),
  rc_point_V:(x,y,z)=>({x:F(x),y:F(y),z:F(z)}),rc_point_Cso:(orig1,orig2,point)=>({orig1,orig2,point}),rc_point_Projection:(point,kind,index,weights)=>({point,kind,index,weights}),
  i32:Math.trunc,u32:x=>Math.trunc(x)>>>0,f32:F,asF32:real,asU32:bits,select:(a,b,c)=>c?b:a
 };
 for(const name of Object.keys(primitive))fn.delete(name);
 // Exact same adapter as generateConvexPointWGSL; JS uses ordinary switch
 // syntax rather than WGSL's shared case labels. No geometry is substituted.
 fn.set('rc_point_iget',`function rc_point_iget(i){switch(i){case 6:case 16:return 1;case 10:return rc_point_position.x;case 11:return rc_point_position.y;case 12:return rc_point_position.z;case 20:return 2;case 22:return asF32(0x7f7fffff);case 23:return f32(rc_point_solid);default:return 0;}}`);
 const type='(?:vec3<f32>|rc_point_(?:V|Cso|Projection)|f32|i32|u32|bool)';
 let source=[...fn.values()].join('\n').replace(/\bfn\s+/g,'function ').replace(new RegExp('\\s*->\\s*'+type,'g'),'').replace(new RegExp(':\\s*'+type,'g'),'')
  .replace(/\bvar\b/g,'let').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/bitcast<f32>/g,'asF32').replace(/bitcast<u32>/g,'asU32').replace(/arrayLength\(&(rc_\w+)\)/g,'$1.length');
 return new Function('rc_state','rc_scratch','rc_geometry',...Object.keys(primitive),`let rc_point_scratch=0,rc_point_output=0,rc_point_hull=0,rc_point_position={x:0,y:0,z:0},rc_point_solid=0,rc_pc_control=0;${source};return ${entry};`)(state,scratch,geometry,...Object.values(primitive));
}
let pending;const fixture=()=>pending??=(async()=>{
 const{seed}=await originalRegisteredFixture(),hulls=seed.cushionSeeds[0].cushions.map(c=>c.hull),cases=[];
 hulls.forEach((hull,hullIndex)=>{const center=[0,1,2].map(j=>F(hull.points.reduce((s,p)=>s+p[j],0)/hull.points.length));for(const delta of[[0,0,0],[.1,.04,-.13],[1,.2,-1]]){const point=center.map((x,j)=>F(x+delta[j]));cases.push({hullIndex,point,expected:Point.queryReference({hull,point})});}});
 const geometry=new Uint32Array(hulls.length*P.hullWords),state=new Uint32Array(cases.length*32).fill(0x12345678),inputs=new Uint32Array(cases.length*4);hulls.forEach((h,i)=>geometry.set(packSharedConvexHull(h),i*P.hullWords));cases.forEach((c,i)=>{inputs[i*4]=c.hullIndex*P.hullWords;inputs.set(new Uint32Array(Float32Array.from(c.point).buffer),i*4+1);});return{cases,hulls,geometry,state,inputs};
})();
function compareResult(raw,base,wanted){const a=new Float32Array(raw.buffer,raw.byteOffset,raw.length);assert.equal(a[base],1);assert.equal(Boolean(a[base+1]),wanted.isInside);assert.deepEqual(raw.slice(base+2,base+5),new Uint32Array(Float32Array.from(wanted.point).buffer));assert.equal(['vertex','edge','face','unknown'][a[base+5]],wanted.feature.kind);assert.equal(a[base+6],wanted.feature.index);}
test('source GJK split copies every original statement exactly once and isolates live locals',()=>{
 const split=originalPointGjkSplit();assert.equal(split.prefix+split.reduceAndTail,split.body);assert.match(split.prefix,/let min_bound/);assert.ok(split.reduceAndTail.startsWith('rc_point_setv(11,dir);rc_point_setv(8,rc_point_reduce_simplex());'));
 assert.equal(L.sourceSteps,256);assert.equal(L.maximumMicroSteps,512);assert.equal(L.scratchWords,P.scratchWords+12);
 for(const q of[1,2,4,8]){const code=generateConvexPointContinuationWGSL('advance',{microStepsPerDispatch:q});assert.ok(code.includes(split.prefix));assert.ok(code.includes(split.reduceAndTail));const wrapper=code.slice(code.indexOf('fn rc_project_convex_cont_stage'));assert.doesNotMatch(wrapper,/\bfor\b|\bwhile\b|\bloop\b/);assert.equal([...wrapper.matchAll(/rc_pc_one\(\)/g)].length,q);}
});
test('generated phase continuation matches every completed original GJK step and all12 final projections',async()=>{
 const f=await fixture();let reduced=0,boundaries=0;
 for(const quantum of[1,2,4,8])for(const c of f.cases){
  const state=new Uint32Array(32),scratch=new Uint32Array(L.scratchWords+16).fill(0x12345678),referenceState=new Uint32Array(32),referenceScratch=new Uint32Array(P.scratchWords),args=[0,0,c.hullIndex*P.hullWords,{x:c.point[0],y:c.point[1],z:c.point[2]},0];
  const owner={state,scratch,geometry:f.geometry},reference={state:referenceState,scratch:referenceScratch,geometry:f.geometry};
  const kernels=Object.fromEntries(['init','advance','epa','finish'].map(stage=>[stage,hostKernel(generateConvexPointContinuationWGSL(stage,{microStepsPerDispatch:quantum}),owner)]));
  const original=Object.fromEntries(['init','gjk','epa','finish'].map(stage=>[stage,hostKernel(generateConvexPointWGSL(stage),reference,'rc_project_convex_stage')]));
  assert.equal(kernels.init(...args),0);assert.equal(original.init(...args),0);assert.equal(kernels.epa(...args),3,'unfinished continuation cannot enter EPA');let sourceCalls=0;
  for(let i=0;i<L.maximumMicroSteps/quantum;i++){
   assert.equal(kernels.advance(...args),0);const phase=scratch[L.controlOffset+1];reduced+=Number(phase===1);
   if(phase!==1){while(sourceCalls<scratch[L.controlOffset+2]){assert.equal(original.gjk(...args),0);sourceCalls++;}assert.deepEqual(scratch.slice(0,P.scratchWords),referenceScratch,'exact original storage at each completed source step');boundaries++;}
  }
  assert.equal(scratch[L.controlOffset+1],2);assert.ok(sourceCalls<=256);while(sourceCalls++<256)original.gjk(...args);
  assert.equal(kernels.epa(...args),original.epa(...args));assert.equal(kernels.finish(...args),original.finish(...args));assert.deepEqual(state.slice(0,16),referenceState.slice(0,16));compareResult(state,0,c.expected);
  for(let i=L.scratchWords;i<scratch.length;i++)assert.equal(scratch[i],0x12345678,'no hidden reuse outside owned continuation');
  scratch[L.controlOffset+3]=255;assert.equal(kernels.advance(...args),3);assert.equal(kernels.finish(...args),3,'truncated source cap never reports a contact/miss');
 }
 assert.ok(reduced>0,'fixture actually crosses split reduction boundary');console.log(JSON.stringify({scope:'source-phase-control-host-only',queries:f.cases.length,quantums:[1,2,4,8],originalStepBoundaries:boundaries,sourceCap:256,fullWorld:false}));
});
test('actual source-lowered point continuation preserves original projection and feature results',{
 skip:process.env.RUN_RESIDENT_POINT_CONTINUATION_GPU!=='1',timeout:900000
},async t=>{
 const quantum=Number(process.env.RESIDENT_POINT_MICROSTEPS??1);assert.ok([1,2,4,8].includes(quantum));const f=await fixture(),prefix=`@group(0) @binding(0) var<storage,read> rc_geometry:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> inputs:array<u32>;`;
 const stages=['init','advance','epa','finish'].map(stage=>({repeat:stage==='advance'?L.maximumMicroSteps/quantum:1,code:linkResidentWGSL([prefix,generateConvexPointContinuationWGSL(stage,{microStepsPerDispatch:quantum}),`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=arrayLength(&inputs)/4u){return;}let p=gid.x*4u;let s=gid.x*32u;${stage==='init'?'rc_state[s+17u]=0u;':''}let result=rc_project_convex_cont_stage(gid.x*${L.scratchWords}u,s,inputs[p],vec3<f32>(bitcast<f32>(inputs[p+1u]),bitcast<f32>(inputs[p+2u]),bitcast<f32>(inputs[p+3u])),0u);rc_state[s+16u]=result;if(result!=0u){rc_state[s+17u]=result;}}`]).code}));
 const owner=await createNativeOwner('source point phase continuation');try{const[,raw]=await dispatchWordStages(owner,{stages,bindingTypes:['read-only-storage','storage','storage','read-only-storage'],buffers:[{input:f.geometry},{input:f.state,readback:true},{words:L.scratchWords*f.cases.length},{input:f.inputs}],workgroups:f.cases.length,label:'source point phase continuation quantum '+quantum});
  for(const[i,c]of f.cases.entries()){assert.equal(raw[i*32+17],0,'all source phases completed');assert.equal(raw[i*32+16],0);compareResult(raw,i*32,c.expected);for(let j=18;j<32;j++)assert.equal(raw[i*32+j],0x12345678);}
  t.diagnostic(JSON.stringify({queries:12,originalHulls:4,sourceCap:256,maximumMicroSteps:512,microStepsPerDispatch:quantum,dispatches:512/quantum+3,intermediateReadbacks:0,defaultChanged:false,fullWorld:false,hardwarePerformance:false}));
 }finally{owner.release();}
});
