// Compiler diagnostic only. No production/default query transport is changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import Point from '../src/experimental-convex-point.js';
import {generateConvexPointWGSL,packSharedConvexHull,CONVEX_POINT_LAYOUT as L} from '../src/resident-candidate/convex-point.mjs';
import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createNativeOwner,dispatchWordStages} from './resident-candidate-gpu-support.mjs';
const STRIDE=L.scratchWords+1;
// The original GJK state is already storage-backed. One extra, disjoint word
// supplies the exact same candidate scratch base every iteration. Loading it
// through the SAME storage buffer may prevent cross-iteration SSA promotion in
// a backend compiler. This is a hypothesis, not a demonstrated optimization.
function reloadSource(stage){
 const original=generateConvexPointWGSL(stage);if(stage!=='gjk-loop')return original;
 const marker='if(rc_scratch[scratch]!=0u){break;}rc_point_gjk_step();';assert.equal(original.split(marker).length,2);
 return original.replace(marker,`if(rc_scratch[scratch]!=0u){break;}rc_point_scratch=rc_scratch[scratch+${L.scratchWords}u];rc_point_gjk_step();`)
  .replace('if(steps!=256u){return 3u;}',`if(steps!=256u||rc_scratch[scratch+${L.scratchWords}u]!=scratch){return 3u;}`);
}
let pending;const fixture=()=>pending??=(async()=>{
 const{seed}=await originalRegisteredFixture(),hulls=seed.cushionSeeds[0].cushions.map(c=>c.hull),cases=[];
 hulls.forEach((hull,hullIndex)=>{const center=[0,1,2].map(j=>Math.fround(hull.points.reduce((s,p)=>s+p[j],0)/hull.points.length));for(const delta of[[0,0,0],[.1,.04,-.13],[1,.2,-1]]){const point=center.map((x,j)=>Math.fround(x+delta[j]));cases.push({hullIndex,point,expected:Point.queryReference({hull,point})});}});
 const geometry=new Uint32Array(hulls.length*L.hullWords),state=new Uint32Array(cases.length*32).fill(0x12345678),inputs=new Uint32Array(cases.length*4);hulls.forEach((h,i)=>geometry.set(packSharedConvexHull(h),i*L.hullWords));cases.forEach((c,i)=>{inputs[i*4]=c.hullIndex*L.hullWords;inputs.set(new Uint32Array(Float32Array.from(c.point).buffer),i*4+1);});
 const prefix=`@group(0) @binding(0) var<storage,read> rc_geometry:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> inputs:array<u32>;`;
 const stages=['init','gjk-loop','epa','finish'].map(stage=>{
  const entry=`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=arrayLength(&inputs)/4u){return;}let p=gid.x*4u;let s=gid.x*32u;let scratch=gid.x*${STRIDE}u;
  ${stage==='init'?'rc_state[s+17u]=0u;':''}
  let result=rc_project_convex_stage(scratch,s,inputs[p],vec3<f32>(bitcast<f32>(inputs[p+1u]),bitcast<f32>(inputs[p+2u]),bitcast<f32>(inputs[p+3u])),0u);rc_state[s+16u]=result;if(result!=0u){rc_state[s+17u]=result;}
  ${stage==='init'?`rc_state[s+15u]=256u;rc_scratch[scratch+${L.scratchWords}u]=scratch;`:''}
  ${stage==='finish'?`if(rc_scratch[scratch+${L.scratchWords}u]!=scratch){rc_state[s+17u]=3u;}`:''}
 }`;
  return{stage,repeat:1,code:linkResidentWGSL([prefix,reloadSource(stage),entry]).code};
 });
 return{cases,hulls,geometry,state,inputs,stages};
})();
test('point address reload diagnostic leaves original geometry/arithmetic/cap verbatim',async()=>{
 const f=await fixture();assert.equal(f.cases.length,12);assert.equal(f.hulls.length,4);assert.equal(STRIDE,13633);
 const restored=reloadSource('gjk-loop').replace(`rc_point_scratch=rc_scratch[scratch+${L.scratchWords}u];`,'').replace(`steps!=256u||rc_scratch[scratch+${L.scratchWords}u]!=scratch`,'steps!=256u');
 assert.equal(restored,generateConvexPointWGSL('gjk-loop'),'only address reload and postvalidation added');
 for(const s of['init','epa','finish'])assert.equal(reloadSource(s),generateConvexPointWGSL(s));
 assert.match(f.stages[0].code,/rc_scratch\[scratch\+13632u\]=scratch/);assert.match(f.stages[1].code,/rc_point_scratch=rc_scratch\[scratch\+13632u\]/);
 console.log(JSON.stringify({scope:'compiler-address-reload-host-only',queries:12,sourceIterations:256,dispatches:4,extraScratchWordsPerCandidate:1,shaderBytes:f.stages.map(s=>[s.stage,s.code.length]),nativeCompiled:false,defaultChanged:false}));
});
test('actual point loop with storage-reloaded address preserves original source outputs',{
 skip:process.env.RUN_RESIDENT_POINT_ADDRESS_GPU!=='1',timeout:900000
},async t=>{
 const f=await fixture(),owner=await createNativeOwner('source point loop address reload');try{
  const[,raw]=await dispatchWordStages(owner,{stages:f.stages,bindingTypes:['read-only-storage','storage','storage','read-only-storage'],buffers:[{input:f.geometry},{input:f.state,readback:true},{words:STRIDE*f.cases.length},{input:f.inputs}],workgroups:f.cases.length,label:'point address reload compiler diagnostic'});
  const values=new Float32Array(raw.buffer);for(const[i,c]of f.cases.entries()){const s=i*32;assert.equal(raw[s+17],0,'all phases and persistent address valid '+i);assert.equal(raw[s+16],0);assert.equal(values[s],1);assert.equal(Boolean(values[s+1]),c.expected.isInside);assert.deepEqual(Array.from(values.subarray(s+2,s+5)),c.expected.point);assert.equal(['vertex','edge','face','unknown'][values[s+5]],c.expected.feature.kind);assert.equal(values[s+6],c.expected.feature.index);assert.equal(raw[s+15],0);for(let j=18;j<32;j++)assert.equal(raw[s+j],0x12345678);}
  t.diagnostic(JSON.stringify({queries:12,originalHulls:4,sourceIterations:256,dispatches:4,intermediateReadbacks:0,extraScratchWordsPerCandidate:1,defaultChanged:false,fullWorld:false,hardwarePerformance:false,adapter:owner.adapterInfo}));
 }finally{owner.release();}
});
