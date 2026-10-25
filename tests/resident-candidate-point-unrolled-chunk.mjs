// Source-transport/compiler diagnostic only. The staged runtime is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import Point from '../src/experimental-convex-point.js';
import {generateConvexPointWGSL,packSharedConvexHull,CONVEX_POINT_LAYOUT as L} from '../src/resident-candidate/convex-point.mjs';
import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createNativeOwner,dispatchWordStages} from './resident-candidate-gpu-support.mjs';
const CHUNKS=[2,4,8];
function chunkSource(chunk){
 assert.ok(CHUNKS.includes(chunk));const original=generateConvexPointWGSL('gjk'),marker='rc_point_gjk_step();return 0u;';assert.equal(original.split(marker).length,2);
 // No outer shader loop or back-edge. Every call below is the complete,
 // unchanged original source step. The retained count is transport only.
 return original.replace(marker,`if(rc_state[output+15u]!=256u||rc_state[output+14u]>256u||rc_state[output+14u]%${chunk}u!=0u){return 3u;}if(rc_state[output+14u]==256u){return 0u;}
 ${Array.from({length:chunk},()=>`rc_point_gjk_step();rc_state[output+14u]++;`).join('\n ')}return 0u;`);
}
let pending;const fixture=()=>pending??=(async()=>{
 const{seed}=await originalRegisteredFixture(),hulls=seed.cushionSeeds[0].cushions.map(c=>c.hull),cases=[];
 hulls.forEach((hull,hullIndex)=>{const center=[0,1,2].map(j=>Math.fround(hull.points.reduce((s,p)=>s+p[j],0)/hull.points.length));for(const delta of[[0,0,0],[.1,.04,-.13],[1,.2,-1]]){const point=center.map((x,j)=>Math.fround(x+delta[j]));cases.push({hullIndex,point,expected:Point.queryReference({hull,point})});}});
 const geometry=new Uint32Array(hulls.length*L.hullWords),state=new Uint32Array(cases.length*32).fill(0x12345678),inputs=new Uint32Array(cases.length*4);hulls.forEach((h,i)=>geometry.set(packSharedConvexHull(h),i*L.hullWords));cases.forEach((c,i)=>{inputs[i*4]=c.hullIndex*L.hullWords;inputs.set(new Uint32Array(Float32Array.from(c.point).buffer),i*4+1);});
 return{cases,hulls,geometry,state,inputs};
})();
function stages(chunk){
 const prefix=`@group(0) @binding(0) var<storage,read> rc_geometry:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> inputs:array<u32>;`;
 return['init','gjk','epa','finish'].map(stage=>{
  const source=stage==='gjk'?chunkSource(chunk):generateConvexPointWGSL(stage),entry=`
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=arrayLength(&inputs)/4u){return;}let p=gid.x*4u;let s=gid.x*32u;
 ${stage==='init'?'rc_state[s+17u]=0u;':''}
 ${stage==='epa'?'if(rc_state[s+17u]!=0u||rc_state[s+14u]!=256u||rc_state[s+15u]!=256u){rc_state[s+17u]=3u;return;}rc_state[s+14u]=0u;rc_state[s+15u]=0u;':''}
 ${stage==='finish'?'if(rc_state[s+17u]!=0u){return;}':''}
 let result=rc_project_convex_stage(gid.x*${L.scratchWords}u,s,inputs[p],vec3<f32>(bitcast<f32>(inputs[p+1u]),bitcast<f32>(inputs[p+2u]),bitcast<f32>(inputs[p+3u])),0u);rc_state[s+16u]=result;if(result!=0u){rc_state[s+17u]=result;}
 ${stage==='init'?'rc_state[s+14u]=0u;rc_state[s+15u]=256u;':''}
}`;
  const linked=linkResidentWGSL([prefix,source,entry]);return{stage,repeat:stage==='gjk'?256/chunk:1,code:linked.code};
 });
}
test('small unrolled point chunks retain all256 source steps with no outer shader back-edge',async()=>{
 const f=await fixture();assert.equal(f.cases.length,12);assert.equal(f.hulls.length,4);
 for(const chunk of CHUNKS){
  const code=chunkSource(chunk),at=code.indexOf('fn rc_project_convex_stage'),wrapper=code.slice(at);assert.doesNotMatch(wrapper,/\bfor\b|\bwhile\b|\bloop\b/);
  assert.equal([...wrapper.matchAll(/rc_point_gjk_step\(\)/g)].length,chunk);assert.equal(code.slice(0,at),generateConvexPointWGSL('gjk').slice(0,at),'all original geometry/arithmetic functions untouched');
  const js=wrapper.replace(/fn (\w+)\(([^)]*)\)->u32/g,(_,name,args)=>`function ${name}(${args.replace(/:(?:u32|vec3<f32>)/g,'')})`).replace(/\b(\d+)u\b/g,'$1'),state=new Uint32Array(32);state[15]=256;let calls=0;
  const run=new Function('rc_state','rc_point_gjk_step',`let rc_point_scratch,rc_point_output,rc_point_hull,rc_point_position,rc_point_solid;${js};return rc_project_convex_stage;`)(state,()=>calls++);
  for(let n=0;n<256/chunk;n++)assert.equal(run(0,0,0,{x:0,y:0,z:0},0),0);assert.equal(calls,256);assert.equal(state[14],256);assert.equal(run(0,0,0,{},0),0);assert.equal(calls,256);
  for(const [count,cap]of[[1,256],[257,256],[0,255],[0,0]]){state[14]=count;state[15]=cap;assert.equal(run(0,0,0,{},0),3);assert.equal(calls,256);}
  const plan=stages(chunk);assert.equal(plan.reduce((n,s)=>n+s.repeat,0),256/chunk+3);assert.match(plan[2].code,/rc_state\[s\+14u\]!=256u/,'unfinished source iteration count cannot enter EPA');
 }
 console.log(JSON.stringify({scope:'unrolled-source-chunk-host-only',queries:12,chunks:CHUNKS,sourceSteps:256,dispatches:CHUNKS.map(c=>256/c+3),defaultChanged:false}));
});
test('actual bounded unrolled chunk preserves all original native-topology query outputs',{
 skip:process.env.RUN_RESIDENT_POINT_CHUNK_GPU!=='1',timeout:900000
},async t=>{
 const chunk=Number(process.env.RESIDENT_POINT_CHUNK??2);assert.ok(CHUNKS.includes(chunk));const f=await fixture(),plan=stages(chunk),owner=await createNativeOwner('unrolled original point chunk '+chunk);
 try{
  const[,raw]=await dispatchWordStages(owner,{stages:plan,bindingTypes:['read-only-storage','storage','storage','read-only-storage'],buffers:[{input:f.geometry},{input:f.state,readback:true},{words:L.scratchWords*f.cases.length},{input:f.inputs}],workgroups:f.cases.length,label:'unrolled source point chunk '+chunk});
  const values=new Float32Array(raw.buffer);for(const[i,c]of f.cases.entries()){const s=i*32;assert.equal(raw[s+17],0,'full original256-step transport and all phases '+i);assert.equal(raw[s+16],0);assert.equal(values[s],1);assert.equal(Boolean(values[s+1]),c.expected.isInside);assert.deepEqual(Array.from(values.subarray(s+2,s+5)),c.expected.point);assert.equal(['vertex','edge','face','unknown'][values[s+5]],c.expected.feature.kind);assert.equal(values[s+6],c.expected.feature.index);assert.equal(raw[s+14],0);assert.equal(raw[s+15],0);for(let j=18;j<32;j++)assert.equal(raw[s+j],0x12345678);}
  t.diagnostic(JSON.stringify({queries:12,originalHulls:4,sourceSteps:256,chunk,dispatches:256/chunk+3,intermediateReadbacks:0,defaultChanged:false,fullWorld:false,hardwarePerformance:false,adapter:owner.adapterInfo}));
 }finally{owner.release();}
});
