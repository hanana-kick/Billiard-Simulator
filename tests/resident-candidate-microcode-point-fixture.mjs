// HOST fixture: authentic original cushion hulls and independent source query
// results. Only initial bindings enter a GPU runner; expected remains assertions.
import assert from 'node:assert/strict';
import Point from '../src/experimental-convex-point.js';
import {generateConvexPointWGSL,packSharedConvexHull,CONVEX_POINT_LAYOUT as P} from '../src/resident-candidate/convex-point.mjs';
import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
export async function createMicrocodePointFixture(){
 const{seed}=await originalRegisteredFixture(),hulls=seed.cushionSeeds[0].cushions.map(c=>c.hull),cases=[];
 for(const[hullIndex,hull]of hulls.entries()){const center=[0,1,2].map(j=>Math.fround(hull.points.reduce((s,p)=>s+p[j],0)/hull.points.length));for(const delta of[[0,0,0],[.1,.04,-.13],[1,.2,-1]]){const point=center.map((x,j)=>Math.fround(x+delta[j]));cases.push({hullIndex,point,expected:Point.queryReference({hull,point})});}}
 const geometry=new Uint32Array(hulls.length*P.hullWords),state=new Uint32Array(cases.length*32).fill(0x12345678),inputs=new Uint32Array(cases.length*4);hulls.forEach((h,i)=>geometry.set(packSharedConvexHull(h),i*P.hullWords));cases.forEach((c,i)=>{inputs[i*4]=c.hullIndex*P.hullWords;inputs.set(new Uint32Array(Float32Array.from(c.point).buffer),i*4+1);});
 const prefix=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(2) var<storage,read> rc_geometry:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;@group(0) @binding(4) var<storage,read> rc_inputs:array<u32>;`;
 const stages=['init','gjk','epa','finish'].map(stage=>generateConvexPointWGSL(stage).replaceAll('rc_project_convex_stage','rc_micro_point_'+stage));
 const driver=`fn main(gid:vec3<u32>){if(gid.x>=arrayLength(&rc_inputs)/4u){return;}let p=gid.x*4u;let s=gid.x*32u;let scratch=gid.x*${P.scratchWords}u;let hull=rc_inputs[p];let point=vec3<f32>(bitcast<f32>(rc_inputs[p+1u]),bitcast<f32>(rc_inputs[p+2u]),bitcast<f32>(rc_inputs[p+3u]));rc_state[s+17u]=rc_micro_point_init(scratch,s,hull,point,0u);for(var i=0u;i<${P.gjkIterations}u;i++){let r=rc_micro_point_gjk(scratch,s,hull,point,0u);if(r!=0u){rc_state[s+17u]=r;return;}}let epa=rc_micro_point_epa(scratch,s,hull,point,0u);if(epa!=0u){rc_state[s+17u]=epa;return;}rc_state[s+16u]=rc_micro_point_finish(scratch,s,hull,point,0u);}`;
 const source=linkResidentWGSL([prefix,...stages,driver],{entry:'main'}).code,compiled=compileMicrocodeWGSL(source),gid=compiled.functions.find(f=>f.name==='main').params[0];
 return{source,compiled,count:cases.length,cases,bindings:[state,new Uint32Array(1),geometry,new Uint32Array(P.scratchWords*cases.length),inputs],initialSlots:[{slot:gid.slot,value:0,candidateStride:1},{slot:gid.slot+1,value:0},{slot:gid.slot+2,value:0}],layout:P};
}
export function assertMicrocodePointFixture(fixture,state){const a=new Float32Array(state.buffer,state.byteOffset,state.length);for(const[i,c]of fixture.cases.entries()){const b=i*32;assert.equal(state[b+17],0,'all source phase statuses');assert.equal(state[b+16],0,'original query finish success');assert.equal(a[b],1);assert.equal(Boolean(a[b+1]),c.expected.isInside);assert.deepEqual(state.slice(b+2,b+5),new Uint32Array(Float32Array.from(c.expected.point).buffer));assert.equal(['vertex','edge','face','unknown'][a[b+5]],c.expected.feature.kind);assert.equal(a[b+6],c.expected.feature.index);for(let j=18;j<32;j++)assert.equal(state[b+j],0x12345678,'outside original result span');}}
