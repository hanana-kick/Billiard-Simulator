import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import Point from '../src/experimental-convex-point.js';
import {generateConvexPointWGSL,packSharedConvexHull,CONVEX_POINT_LAYOUT as L} from '../src/resident-candidate/convex-point.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createNativeOwner,dispatchWordStages} from './resident-candidate-gpu-support.mjs';

test('resident convex binding retains original source GJK/EPA and source capacities',async()=>{
 const {seed}=await originalRegisteredFixture(),h=seed.cushionSeeds[0].cushions[0].hull;
 assert.deepEqual(packSharedConvexHull(h),new Uint32Array(Point.packQuery({hull:h,point:[0,0,0]}).hulls.buffer));
 const code=['init','gjk','epa','finish'].map(generateConvexPointWGSL).join('\n');assert.ok(code.includes('rc_point_point_epa'));assert.ok(code.includes('rc_point_gjk_step'));assert.equal(L.scratchWords,13632);assert.equal(L.gjkIterations,256);assert.doesNotMatch(code,/@compute|@group/);
});
test('optional point chunks own a full256 cursor without changing source step equations',()=>{
 for(const queryChunk of[2,4,8]){
  const options={queryTransport:'chunked',queryChunk},init=generateConvexPointWGSL('init',options),gjk=generateConvexPointWGSL('gjk',options),body=gjk.slice(gjk.lastIndexOf('fn rc_project_convex_stage'));
  assert.match(init,/rc_state\[output\+15u\]=256u/);assert.doesNotMatch(body,/\bfor\b|\bwhile\b|\bloop\b/);
  assert.equal([...body.matchAll(/rc_point_gjk_step\(\)/g)].length,queryChunk);assert.match(body,new RegExp('output\\+14u\\]%' +queryChunk+'u'));
  assert.match(generateConvexPointWGSL('epa',options),/output\+14u\]!=256u\|\|rc_state\[output\+15u\]!=256u/);
  const original=generateConvexPointWGSL('gjk').split('fn rc_project_convex_stage')[0];assert.equal(gjk.split('fn rc_project_convex_stage')[0],original,'source numeric helpers verbatim');
 }
 assert.throws(()=>generateConvexPointWGSL('gjk',{queryTransport:'chunked',queryChunk:3}),/transport/);
});
test('actual native resident projection uses shared immutable hulls and candidate-local reusable scratch',async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('assigned serial native GPU slot required');
 const {seed}=await originalRegisteredFixture(),hulls=seed.cushionSeeds[0].cushions.map(c=>c.hull),cases=[];
 hulls.forEach((hull,hullIndex)=>{const center=[0,1,2].map(j=>Math.fround(hull.points.reduce((s,p)=>s+p[j],0)/hull.points.length));for(const delta of [[0,0,0],[.1,.04,-.13],[1,.2,-1]]){const point=center.map((x,j)=>Math.fround(x+delta[j]));cases.push({hull,hullIndex,point,expected:Point.queryReference({hull,point})});}});
 const geometry=new Uint32Array(hulls.length*L.hullWords);hulls.forEach((h,i)=>geometry.set(packSharedConvexHull(h),i*L.hullWords));
 const state=new Uint32Array(cases.length*32).fill(0x12345678);const input=new Uint32Array(cases.length*4);cases.forEach((c,i)=>{input[i*4]=c.hullIndex*L.hullWords;input.set(new Uint32Array(Float32Array.from(c.point).buffer),i*4+1);});
 const dynamic=process.env.RESIDENT_POINT_DYNAMIC==='1',queryTransport=process.env.RESIDENT_QUERY_TRANSPORT??'staged',queryChunk=Number(process.env.RESIDENT_QUERY_CHUNK??8),chunked=queryTransport==='chunked';assert.ok(['staged','chunked'].includes(queryTransport));assert.ok(!dynamic||!chunked);const stages=['init',dynamic?'gjk-loop':'gjk','epa','finish'].map(stage=>({repeat:stage==='gjk'?L.gjkIterations/(chunked?queryChunk:1):1,code:`@group(0) @binding(0) var<storage,read> rc_geometry:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> inputs:array<u32>;
${generateConvexPointWGSL(stage,{queryTransport,queryChunk})}
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=arrayLength(&inputs)/4u){return;}let p=gid.x*4u;let s=gid.x*32u;let result=rc_project_convex_stage(gid.x*${L.scratchWords}u,s,inputs[p],vec3<f32>(bitcast<f32>(inputs[p+1u]),bitcast<f32>(inputs[p+2u]),bitcast<f32>(inputs[p+3u])),0u);rc_state[s+16u]=result;${stage==='init'&&dynamic?'rc_state[s+15u]=256u;':''}}`}));
 if(chunked)for(const stage of stages)stage.code=linkResidentWGSL([stage.code]).code;
 const owner=await createNativeOwner('resident convex source projection');try{const[,raw]=await dispatchWordStages(owner,{stages,bindingTypes:['read-only-storage','storage','storage','read-only-storage'],buffers:[{input:geometry},{input:state,readback:true},{words:L.scratchWords*cases.length},{input}],workgroups:cases.length});
 const f=new Float32Array(raw.buffer);for(const[candidate,c]of cases.entries()){const base=candidate*32;assert.equal(raw[base+16],0,'query completion');assert.equal(f[base],1);assert.equal(Boolean(f[base+1]),c.expected.isInside);assert.deepEqual(Array.from(f.subarray(base+2,base+5)),c.expected.point,'original source point');const kinds=['vertex','edge','face','unknown'];assert.equal(kinds[f[base+5]],c.expected.feature.kind);assert.equal(f[base+6],c.expected.feature.index);for(let i=17;i<32;i++)assert.equal(raw[base+i],0x12345678,'lane guard');}
 t.diagnostic(JSON.stringify({queries:cases.length,sharedHulls:hulls.length,sourceExact:true,queryTransport,queryChunk:chunked?queryChunk:1,dispatches:stages.reduce((n,s)=>n+s.repeat,0),fullWorld:false}));
 }finally{owner.release();}
});
