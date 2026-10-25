import test from 'node:test';
import assert from 'node:assert/strict';
import Point from '../src/experimental-convex-point.js';
import {generateConvexPointWGSL,packSharedConvexHull,CONVEX_POINT_LAYOUT as L} from '../src/resident-candidate/convex-point.mjs';
import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createNativeOwner,dispatchWordStages} from './resident-candidate-gpu-support.mjs';

// Distinct, opt-in compiler experiment. The production/default one-step GJK
// path is unchanged. Linking only removes unreachable function declarations;
// it cannot alter arithmetic, feature ordering, source caps or EPA fallback.
let pending;
const fixture=()=>pending??=(async()=>{
 const{seed}=await originalRegisteredFixture(),hulls=seed.cushionSeeds[0].cushions.map(c=>c.hull),cases=[];
 hulls.forEach((hull,hullIndex)=>{
  const center=[0,1,2].map(axis=>Math.fround(hull.points.reduce((s,p)=>s+p[axis],0)/hull.points.length));
  for(const delta of[[0,0,0],[.1,.04,-.13],[1,.2,-1]]){
   const point=center.map((x,axis)=>Math.fround(x+delta[axis]));
   cases.push({hullIndex,point,expected:Point.queryReference({hull,point})});
  }
 });
 const geometry=new Uint32Array(hulls.length*L.hullWords);
 hulls.forEach((h,i)=>geometry.set(packSharedConvexHull(h),i*L.hullWords));
 const state=new Uint32Array(cases.length*32).fill(0x12345678),inputs=new Uint32Array(cases.length*4);
 cases.forEach((c,i)=>{inputs[i*4]=c.hullIndex*L.hullWords;inputs.set(new Uint32Array(Float32Array.from(c.point).buffer),i*4+1);});
 const prefix=`@group(0) @binding(0) var<storage,read> rc_geometry:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> inputs:array<u32>;`;
 const stages=['init','gjk-loop','epa','finish'].map(stage=>{
  const source=generateConvexPointWGSL(stage),entry=`
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 if(gid.x>=arrayLength(&inputs)/4u){return;}let input=gid.x*4u;let output=gid.x*32u;
 ${stage==='init'?'rc_state[output+17u]=0u;':''}
 let result=rc_project_convex_stage(gid.x*${L.scratchWords}u,output,inputs[input],vec3<f32>(bitcast<f32>(inputs[input+1u]),bitcast<f32>(inputs[input+2u]),bitcast<f32>(inputs[input+3u])),0u);
 rc_state[output+16u]=result;if(result!=0u){rc_state[output+17u]=result;}
 ${stage==='init'?`rc_state[output+15u]=${L.gjkIterations}u;`:''}
}`;
  const linked=linkResidentWGSL([prefix,source,entry]);
  return{stage,repeat:1,code:linked.code,functions:linked.functions,removedFunctions:linked.removedFunctions,inputBytes:linked.inputBytes};
 });
 return{hulls,cases,geometry,state,inputs,stages};
})();

test('linked point loop retains the exact source 256-step boundary and original fixtures',async()=>{
 const f=await fixture();assert.equal(f.cases.length,12);assert.equal(f.hulls.length,4);assert.equal(L.gjkIterations,256);
 assert.deepEqual(f.stages.map(s=>s.stage),['init','gjk-loop','epa','finish']);assert.equal(f.stages.reduce((n,s)=>n+s.repeat,0),4);
 const init=f.stages[0],gjk=f.stages[1],epa=f.stages[2];
 assert.match(init.code,/rc_state\[output\+15u\]=256u/);
 assert.match(gjk.code,/let steps=rc_state\[output\+15u\]/);assert.match(gjk.code,/steps>256u/);assert.match(gjk.code,/steps!=256u/);
 assert.match(gjk.code,/for\(var i=0u;i<steps;i\+\+\)/);assert.match(gjk.code,/rc_point_gjk_step\(\)/);
 assert.doesNotMatch(gjk.code,/fn rc_point_point_epa\(/,'unreachable EPA source is absent from the GJK pipeline');assert.match(epa.code,/fn rc_point_point_epa\(/);
 for(const s of f.stages){assert.ok(s.removedFunctions>0,s.stage+' actually prunes unreachable functions');assert.ok(s.code.length<s.inputBytes);}
 // The exact bounded loop is already in the resident adapter. The experiment
 // only routes that unchanged declaration through the normal phase linker.
 const exact=generateConvexPointWGSL('gjk-loop').slice(generateConvexPointWGSL('gjk-loop').indexOf('fn rc_project_convex_stage'));
 assert.ok(gjk.code.includes(exact.trim()));
 console.log(JSON.stringify({scope:'linked-point-loop-host-not-native',stages:f.stages.map(({stage,code,inputBytes,functions,removedFunctions})=>({stage,inputBytes,linkedBytes:code.length,functions,removedFunctions})),sourceIterations:256,defaultChanged:false}));
});

test('actual linked dynamic point loop matches the unchanged native-topology source',{
 skip:process.env.RUN_RESIDENT_POINT_LINKED_LOOP_GPU!=='1',timeout:900000
},async t=>{
 const f=await fixture(),owner=await createNativeOwner('linked source point GJK loop');
 try{
  const[,raw]=await dispatchWordStages(owner,{
   stages:f.stages,bindingTypes:['read-only-storage','storage','storage','read-only-storage'],
   buffers:[{input:f.geometry},{input:f.state,readback:true},{words:L.scratchWords*f.cases.length},{input:f.inputs}],
   workgroups:f.cases.length,label:'linked original point source loop'
  });
  const values=new Float32Array(raw.buffer);
  for(const[candidate,c]of f.cases.entries()){
   const base=candidate*32;assert.equal(raw[base+17],0,'all phase return codes remain successful '+candidate);assert.equal(raw[base+16],0,'final completion '+candidate);
   assert.equal(values[base],1);assert.equal(Boolean(values[base+1]),c.expected.isInside);
   assert.deepEqual(Array.from(values.subarray(base+2,base+5)),c.expected.point,'unchanged source projected point '+candidate);
   assert.equal(['vertex','edge','face','unknown'][values[base+5]],c.expected.feature.kind);assert.equal(values[base+6],c.expected.feature.index);
   assert.equal(raw[base+15],0,'source loop metadata consumed');for(let i=18;i<32;i++)assert.equal(raw[base+i],0x12345678,'candidate lane guard');
  }
  t.diagnostic(JSON.stringify({queries:f.cases.length,sharedOriginalHulls:f.hulls.length,sourceIterations:256,dispatches:4,submissions:1,intermediateReadbacks:0,linkedOnly:true,defaultChanged:false,fullWorld:false,hardwarePerformance:false,adapter:owner.adapterInfo}));
 }finally{owner.release();}
});
