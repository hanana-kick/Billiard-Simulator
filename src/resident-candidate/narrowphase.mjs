/* SPDX-License-Identifier: Apache-2.0
 * Device-owned lifecycle for original single-manifold contacts.
 * Geometry comes from unchanged Rapier/Parry source-ordered graph builders;
 * see those modules and vendor/RAPIER-LICENSE.txt. No CPU continuation.
 */
import * as importedFloor from '../experimental-world-stepper.js';
const Floor=importedFloor.default??globalThis.LabWorldStepperExperimental;
import * as importedPair from '../experimental-cloth-island-world.js';
const Pair=importedPair.default??globalThis.LabClothIslandWorldExperimental;
import * as importedConvex from '../experimental-cushion-roster-world.js';
const Convex=importedConvex.default??globalThis.LabCushionRosterWorldExperimental;
import {compileGraph} from './numeric-program.mjs';

export const NARROW_STATUS = Object.freeze({OK:0,NUMERIC:1,FLOOR_FEATURE:2,INVALID:3});
// Numeric payloads deliberately retain the existing graph pack ABI. World
// gathers current bodies immediately before each call; these are mutable
// caches, not future numerical states. Sidecars contain exact integer fields.
export const NARROW_LAYOUT = Object.freeze({floorWords:144,pairWords:336,convexWords:400,
 floor:Object.freeze({pair:128,manifold:129,point:130,active:131,recycle:132,localN1:133,contactId:136,status:137,refreshed:138,oldActive:139}),
 pair:Object.freeze({feature1:320,feature2:321,contactId:322,status:323,refreshed:324,oldActive:325}),
 convex:Object.freeze({feature1:384,feature2:385,contactId:386,status:387,refreshed:388,oldActive:389,pair:390,oldPoint:391,needsProjection:392,warmTangent:372,tangentImpulse:374})});
function words(a){return new Uint32Array(a.buffer,a.byteOffset,a.length).slice();}
export function packFloorNarrow(s){
 const out=new Uint32Array(NARROW_LAYOUT.floorWords);out.set(words(Floor.pack({...s,recycleValid:s.topology.recycleValid})));
 const t=s.topology,L=NARROW_LAYOUT.floor;for(const key of ['pair','manifold','point','active','recycle'])out[L[key]]=Number(t[{pair:'pairPresent',manifold:'manifoldPresent',point:'pointPresent',active:'active',recycle:'recycleValid'}[key]]??(key==='manifold'&&t.pairPresent&&(t.pointPresent||t.recycleValid)));
 out.set(words(Float32Array.from(s.localN1??(t.manifoldPresent?s.normal:[0,0,0]))),L.localN1);out[L.contactId]=s.contactId;out[118]=words(Float32Array.of(s.contactRecycleDistance))[0];return out;
}
export function packPairNarrow(s){const out=new Uint32Array(NARROW_LAYOUT.pairWords);out.set(words(Pair.pack(s)));out[320]=s.feature1??0;out[321]=s.feature2??0;out[322]=s.contactId;return out;}
export function packConvexNarrow(s){const out=new Uint32Array(NARROW_LAYOUT.convexWords);out.set(words(Convex.pack(s)));const c=s.cushions[s.queryIndex??0];out[384]=c.feature1??0;out[385]=c.feature2??0;out[386]=c.contactId;out[390]=Number(c.pairPresent);out.set(words(Float32Array.from(c.warmTangent??[0,0])),372);out.set(words(Float32Array.from(c.tangentImpulse??[0,0])),374);return out;}

export function createNarrowPrograms(){
 const source={floor:Floor.buildPlan(12,4,1,true),pair:Pair.geometryPlan(true),convexRecycle:Convex.recyclePlan(),convex:Convex.geometryPlan()};
 let size=0,scratchWords=0;const entries={};
 for(const[name,plan]of Object.entries(source)){const compiled=compileGraph(plan);entries[name]={base:size,plan,compiled};size+=compiled.program.length;scratchWords=Math.max(scratchWords,compiled.scratchWords);}
 const program=new Uint32Array(size);for(const e of Object.values(entries))program.set(e.compiled.program,e.base);
 return Object.freeze({entries,program,scratchWords});
}

// Caller owns rc_state / rc_scratch / rc_program storage and invokes the shared
// numeric library. Every call receives absolute offsets; disjoint candidates
// cannot touch another candidate's cache. Nonzero status invalidates draft h.
export function generateNarrowphaseWGSL(programs=createNarrowPrograms()){
 const out=(name,key,j=0)=>{const e=programs.entries[name],layout=e.plan.outputLayout??e.plan.layout;return e.compiled.outputSlots[layout[key].offset+j];};
 const write=(name,key,destination,length=1)=>Array.from({length},(_,i)=>`rc_state[base+${destination+i}u]=rc_scratch[scratch+${out(name,key,i)}u];`).join('\n');
 const nonzero=(name,key)=>`(rc_scratch[scratch+${out(name,key)}u]&0x7fffffffu)!=0u`;
 return `
fn rc_narrow_copy_input(base:u32,scratch:u32,n:u32){for(var i=0u;i<n;i++){rc_scratch[scratch+i]=rc_state[base+i];}}
fn rc_narrow_zero(base:u32,at:u32,n:u32){for(var i=0u;i<n;i++){rc_state[base+at+i]=0u;}}
fn rc_narrow_floor_clear_point(base:u32){rc_narrow_zero(base,70u,7u);rc_state[base+114u]=0u;rc_narrow_zero(base,115u,2u);rc_state[base+136u]=0u;}
fn rc_narrow_floor_clear_manifold(base:u32){rc_state[base+129u]=0u;rc_state[base+130u]=0u;rc_state[base+131u]=0u;rc_state[base+132u]=0u;rc_state[base+117u]=0u;rc_narrow_floor_clear_point(base);rc_narrow_zero(base,55u,3u);rc_narrow_zero(base,84u,3u);rc_narrow_zero(base,133u,3u);}
fn rc_narrow_floor(base:u32,scratch:u32,programOffset:u32,present:u32,visited:u32)->u32{
 rc_state[base+137u]=0u;rc_state[base+138u]=0u;let oldPair=rc_state[base+128u];let oldPoint=rc_state[base+130u];rc_state[base+139u]=rc_state[base+131u];rc_state[base+128u]=present;
 if(present==0u){rc_narrow_floor_clear_manifold(base);return 0u;}
 if(oldPair==0u){rc_narrow_floor_clear_manifold(base);}
 if(visited==0u){return 0u;}
 rc_state[base+117u]=select(0u,0x3f800000u,rc_state[base+132u]!=0u);
 rc_narrow_copy_input(base,scratch,128u);if(rc_num_eval(programOffset+${programs.entries.floor.base}u,scratch)!=1u){rc_state[base+137u]=1u;return 1u;}
 if(!(${nonzero('floor','inside')})){rc_state[base+137u]=2u;return 2u;}
 if(${nonzero('floor','recycled')}){return 0u;}
 rc_state[base+138u]=1u;
 if(rc_state[base+129u]==0u){rc_narrow_zero(base,55u,3u);rc_narrow_zero(base,84u,3u);rc_narrow_zero(base,133u,3u);rc_state[base+129u]=1u;}
 let hasPoint=${nonzero('floor','geometricPoint')};let isActive=hasPoint&&(${nonzero('floor','qualified')});rc_state[base+130u]=u32(hasPoint);rc_state[base+131u]=u32(isActive);
 if(!hasPoint||oldPoint==0u||oldPair==0u){rc_narrow_floor_clear_point(base);}
 if(hasPoint&&(oldPoint==0u||oldPair==0u)){rc_narrow_zero(base,64u,6u);}
 ${write('floor','recycleTranslation',87,3)}${write('floor','recycleRotation',90,4)}
 // Caller puts the exact f32 source contactRecycleDistance in numeric slot118.
 rc_state[base+119u]=bitcast<u32>(bitcast<f32>(rc_state[base+104u])*bitcast<f32>(rc_state[base+41u]));
 rc_state[base+95u]=select(bitcast<u32>(min(bitcast<f32>(rc_state[base+118u]),bitcast<f32>(rc_state[base+119u]))),rc_state[base+118u],isActive);rc_state[base+132u]=1u;rc_state[base+117u]=0x3f800000u;
 if(hasPoint){${write('floor','localP1',78,3)}${write('floor','localP2',81,3)}${write('floor','localN2',84,3)}${write('floor','contactDistance',77)}rc_state[base+133u]=0u;rc_state[base+134u]=0x3f800000u;rc_state[base+135u]=0u;}
 for(var i=0u;i<3u;i++){rc_state[base+55u+i]=rc_state[base+133u+i];}
 if(isActive){${write('floor','anchor1',58,3)}${write('floor','anchor2',61,3)}${write('floor','dp1',64,3)}${write('floor','dp2',67,3)}rc_state[base+136u]=select(0u,0x80000000u,(rc_state[base+70u]&0x7fffffffu)==0u);rc_state[base+114u]=bitcast<u32>(f32(rc_state[base+136u]));}
 return 0u;
}
fn rc_narrow_pair_clear(base:u32){rc_narrow_zero(base,157u,13u);rc_narrow_zero(base,217u,2u);rc_state[base+216u]=0u;rc_state[base+322u]=0u;}
fn rc_narrow_pair(base:u32,scratch:u32,programOffset:u32,present:u32,visited:u32)->u32{
 rc_state[base+323u]=0u;rc_state[base+324u]=0u;let oldPair=(rc_state[base+203u]&0x7fffffffu)!=0u;let oldPoint=(rc_state[base+201u]&0x7fffffffu)!=0u;rc_state[base+325u]=u32((rc_state[base+202u]&0x7fffffffu)!=0u);
 if(present!=0u&&!oldPair){rc_narrow_zero(base,148u,56u);for(var q=189u;q<=197u;q+=4u){rc_state[base+q]=0x3f800000u;}rc_narrow_zero(base,216u,3u);rc_narrow_zero(base,320u,3u);}
 rc_state[base+203u]=select(0u,0x3f800000u,present!=0u);
 if(present==0u){rc_narrow_zero(base,200u,3u);rc_narrow_pair_clear(base);return 0u;}
 if(visited==0u){return 0u;}
 rc_narrow_copy_input(base,scratch,320u);if(rc_num_eval(programOffset+${programs.entries.pair.base}u,scratch)!=1u){rc_state[base+323u]=1u;return 1u;}
 if(${nonzero('pair','recycled')}){return 0u;}
 rc_state[base+324u]=1u;${write('pair','pointPresent',201)}${write('pair','active',202)}
 let hasPoint=(rc_state[base+201u]&0x7fffffffu)!=0u;let isActive=(rc_state[base+202u]&0x7fffffffu)!=0u;
 if(!hasPoint||!oldPoint||!oldPair){rc_narrow_pair_clear(base);}
 ${write('pair','recycleTranslation',183,3)}${write('pair','recycleRelativeRotation',186,4)}${write('pair','recycleRotation1',190,4)}${write('pair','recycleRotation2',194,4)}${write('pair','maxExtent',198)}
 rc_state[base+219u]=bitcast<u32>(bitcast<f32>(rc_state[base+137u])*bitcast<f32>(rc_state[base+129u]));rc_state[base+199u]=select(bitcast<u32>(min(bitcast<f32>(rc_state[base+138u]),bitcast<f32>(rc_state[base+219u]))),rc_state[base+138u],isActive);rc_state[base+200u]=0x3f800000u;
 if(hasPoint){${write('pair','normal',148,3)}${write('pair','localP1',170,3)}${write('pair','localP2',173,3)}${write('pair','localN1',176,3)}${write('pair','localN2',179,3)}${write('pair','contactDistance',182)}${write('pair','anchor1',151,3)}${write('pair','anchor2',154,3)}${write('pair','dp1',157,3)}${write('pair','dp2',160,3)}rc_state[base+320u]=0xc0000000u;rc_state[base+321u]=0xc0000000u;rc_state[base+322u]=select(0u,0x80000000u,(rc_state[base+167u]&0x7fffffffu)==0u);rc_state[base+216u]=bitcast<u32>(f32(rc_state[base+322u]));}
 return 0u;
}
fn rc_narrow_convex_clear(base:u32){rc_narrow_zero(base,281u,11u);rc_narrow_zero(base,372u,4u);rc_state[base+386u]=0u;}
// Return 1 only when the source cache requires a native projection. The owner
// then calls rc_project_convex using the current body position and immutable
// hull; no host-provided point/normal or state-dependent continuation is used.
fn rc_narrow_convex_prepare(base:u32,scratch:u32,programOffset:u32,present:u32,visited:u32)->u32{
 rc_state[base+387u]=0u;rc_state[base+388u]=0u;rc_state[base+392u]=0u;let oldPair=rc_state[base+390u];rc_state[base+391u]=u32((rc_state[base+317u]&0x7fffffffu)!=0u);rc_state[base+389u]=u32((rc_state[base+318u]&0x7fffffffu)!=0u);rc_state[base+390u]=present;
 if(present!=0u&&oldPair==0u){rc_narrow_zero(base,272u,20u);rc_narrow_zero(base,294u,13u);rc_state[base+316u]=0u;rc_state[base+317u]=0u;rc_state[base+318u]=0u;rc_narrow_zero(base,384u,3u);rc_narrow_convex_clear(base);}
 if(present==0u){rc_narrow_zero(base,316u,3u);rc_narrow_convex_clear(base);return 0u;}
 if(visited==0u){return 0u;}
 rc_narrow_copy_input(base,scratch,368u);if(rc_num_eval(programOffset+${programs.entries.convexRecycle.base}u,scratch)!=1u){rc_state[base+387u]=1u;return 2u;}
 if(${nonzero('convexRecycle','recycled')}){return 0u;}rc_state[base+388u]=1u;rc_state[base+392u]=1u;return 1u;
}
fn rc_narrow_convex_finish(base:u32,scratch:u32,programOffset:u32,projection:u32)->u32{
 if(rc_state[base+387u]!=0u||rc_state[base+392u]!=1u||rc_state[projection]!=0x3f800000u){rc_state[base+387u]=3u;return 3u;}
 for(var i=0u;i<3u;i++){rc_state[base+64u+i]=rc_state[projection+2u+i];}rc_state[base+67u]=rc_state[projection+1u];
 rc_narrow_copy_input(base,scratch,368u);if(rc_num_eval(programOffset+${programs.entries.convex.base}u,scratch)!=1u){rc_state[base+387u]=1u;return 1u;}
 let hasPoint=${nonzero('convex','pointPresent')};let isActive=${nonzero('convex','active')};if(!hasPoint||rc_state[base+391u]==0u){rc_narrow_convex_clear(base);}
 ${write('convex','pointPresent',317)}${write('convex','active',318)}${write('convex','recycleTranslation',307,3)}${write('convex','recycleRotation',310,4)}${write('convex','maxDrift',315)}${write('convex','maxExtent',314)}rc_state[base+316u]=0x3f800000u;
 if(hasPoint){${write('convex','localP1',294,3)}${write('convex','localP2',297,3)}${write('convex','localN1',300,3)}${write('convex','localN2',303,3)}${write('convex','contactDistance',306)}${write('convex','normal',272,3)}
 let kind=u32(bitcast<f32>(rc_state[projection+5u]));let index=u32(bitcast<f32>(rc_state[projection+6u]));if(kind>3u){rc_state[base+387u]=3u;return 3u;}var prefix=0u;switch kind{case 0u:{prefix=0x40000000u;}case 1u:{prefix=0x80000000u;}case 2u:{prefix=0xc0000000u;}default:{}}rc_state[base+384u]=prefix|index;rc_state[base+385u]=0xc0000000u;
 }
 if(isActive){${write('convex','anchor1',275,3)}${write('convex','anchor2',278,3)}${write('convex','dp1',281,3)}${write('convex','dp2',284,3)}rc_state[base+386u]=select(0u,0x80000000u,(rc_state[base+291u]&0x7fffffffu)==0u);}
 rc_state[base+392u]=0u;return 0u;
}

`;
}
