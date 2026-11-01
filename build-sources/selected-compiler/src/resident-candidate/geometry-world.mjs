/* SPDX-License-Identifier: Apache-2.0
 * Address-only bridge for original source geometry caches. Arithmetic remains
 * in narrowphase.mjs; this module never substitutes analytic collision rules.
 * Fixed cache owners are generation-bearing collider pairs, not dense edge IDs.
 */
import {GEOMETRY_CATALOG as C} from './geometry-state.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
export const GEOMETRY_WORLD_LAYOUT=Object.freeze({factsWords:6,viewWords:8,maxRows:26,status:Object.freeze({ok:0,invalid:1,unsupported:2})});
// Source pack maps, in ascending source destination order. The common body64
// is shared by the source coupled solver, cue, scene and CCD owners.
const FLOOR_MAP=Object.freeze([[0,0,31],[34,35,3],[37,38,3],[42,41,1],[43,42,1],[44,43,1],[46,44,1],[47,45,1],[48,46,1],[110,31,4]]);
const contactMap=Object.freeze({
 0:[[0,55,15],[15,72,3],[18,71,1],[19,70,1],[20,96,2],[22,115,2]],
 1:[[0,148,20],[20,139,2],[22,168,2]],
 2:[[0,272,22],[22,372,2]]
});
export function generateGeometryWorldWGSL(){
 const move=(to,from,n)=>`for(var i=0u;i<${n}u;i++){rc_state[${to}+i]=rc_state[${from}+i];}`;
 const branchMap=(map,reverse=false)=>Object.entries(map).map(([kind,rows])=>`case ${kind}u:{${rows.map(([dest,src,n])=>move(reverse?`base+${src}u`:`contact+${dest}u`,reverse?`contact+${dest}u`:`base+${src}u`,n)).join('')}}`).join('\n');
 return `
fn rc_geo_row(catalog:u32,row:u32)->u32{return catalog+row*${C.stride}u;}
fn rc_geo_cache(catalog:u32,cache:u32,row:u32)->u32{return cache+rc_geometry[rc_geo_row(catalog,row)+7u];}
// Called immediately before source narrowphase with current canonical bodies.
// collisionDt is a device source f32 bit pattern, not a CPU-selected solve dt.
fn rc_geometry_gather(catalog:u32,cache:u32,bodies:u32,row:u32,collisionDt:u32)->u32{
 if(row>=26u){return 1u;}let r=rc_geo_row(catalog,row);let kind=rc_geometry[r];let base=cache+rc_geometry[r+7u];let a=rc_geometry[r+5u];let b=rc_geometry[r+6u];
 if(kind>2u||b>=4u||(kind==1u&&(a>=4u||a==b))||(kind!=1u&&a!=0xffffffffu)){return 1u;}
 let body=bodies+b*64u;
 if(kind==0u){${FLOOR_MAP.map(([dest,src,n])=>move(`base+${dest}u`,`body+${src}u`,n)).join('')}rc_state[base+40u]=collisionDt;}
 else{if(kind==1u){let first=bodies+a*64u;${move('base','first',64)}${move('base+64u','body',64)}}else{${move('base','body',64)}}rc_state[base+128u]=collisionDt;}
 return 0u;
}
fn rc_geometry_find(catalog:u32,count:u32,c1:u32,g1:u32,c2:u32,g2:u32)->u32{
 if(count>26u){return 0xffffffffu;}for(var row=0u;row<count;row++){let r=rc_geo_row(catalog,row);if(rc_geometry[r+1u]==c1&&rc_geometry[r+2u]==g1&&rc_geometry[r+3u]==c2&&rc_geometry[r+4u]==g2){return row;}}return 0xffffffffu;
}
fn rc_geometry_to_contact(catalog:u32,cache:u32,row:u32,contact:u32)->u32{
 if(row>=26u){return 1u;}let r=rc_geo_row(catalog,row);let kind=rc_geometry[r];let base=cache+rc_geometry[r+7u];if(rc_state[cache+rc_geometry[r+14u]]!=0u){return 1u;}
 for(var i=0u;i<32u;i++){rc_state[contact+i]=0u;}switch kind{${branchMap(contactMap)}default:{return 2u;}}return 0u;
}
// Only solver-mutated impulses/warmstarts return. Geometry, tangentImpulse and
// contact IDs retain their original phase ownership; never overwrite a cache
// by copying an entire solver contact record after its source integration.
fn rc_geometry_from_contact(catalog:u32,cache:u32,row:u32,contact:u32)->u32{
 if(row>=26u){return 1u;}let r=rc_geo_row(catalog,row);let kind=rc_geometry[r];let base=cache+rc_geometry[r+7u];
 switch kind{case 0u:{${move('base+72u','contact+15u',3)}${move('base+71u','contact+18u',1)}${move('base+70u','contact+19u',1)}${move('base+115u','contact+22u',2)}}case 1u:{${move('base+163u','contact+15u',3)}${move('base+166u','contact+18u',2)}${move('base+168u','contact+22u',2)}}case 2u:{${move('base+287u','contact+15u',3)}${move('base+290u','contact+18u',2)}${move('base+372u','contact+22u',2)}}default:{return 2u;}}return 0u;
}
// Produce source journal facts and application manifold views from actual
// resident caches AFTER numerical geometry. Unknown cache owners are explicit
// unsupported. Cue geometry supplies its separate exact cache views later;
// an unknown or empty-looking edge is never guessed inactive here.
fn rc_geometry_publish_edge(catalog:u32,count:u32,cache:u32,journal:u32,edge:u32,facts:u32,views:u32)->u32{
 if(edge>=rc_state[journal+${J.header.edges}u]){return 1u;}let e=journal+${J.edgeOffset}u+edge*${J.edgeStride}u;let c1=journal+${J.colliderOffset}u+rc_state[e]*${J.colliderStride}u;let c2=journal+${J.colliderOffset}u+rc_state[e+1u]*${J.colliderStride}u;
 let row=rc_geometry_find(catalog,count,rc_state[c1],rc_state[c1+1u],rc_state[c2],rc_state[c2+1u]);if(row==0xffffffffu){return 2u;}let r=rc_geo_row(catalog,row);let kind=rc_geometry[r];let base=cache+rc_geometry[r+7u];let status=rc_state[cache+rc_geometry[r+14u]];if(status!=0u){return 2u;}
 var present=0u;var point=0u;var activePoint=0u;var manifold=0u;
 switch kind{case 0u:{present=rc_state[base+128u];manifold=rc_state[base+129u];point=rc_state[base+130u];activePoint=rc_state[base+131u];}case 1u:{present=u32(bitcast<f32>(rc_state[base+203u])!=0.0);manifold=present;point=u32(bitcast<f32>(rc_state[base+201u])!=0.0);activePoint=u32(bitcast<f32>(rc_state[base+202u])!=0.0);}case 2u:{present=rc_state[base+390u];manifold=present;point=u32(bitcast<f32>(rc_state[base+317u])!=0.0);activePoint=u32(bitcast<f32>(rc_state[base+318u])!=0.0);}default:{return 2u;}}
 if(present!=1u||point>1u||activePoint>point||manifold>1u){return 1u;}let g=facts+edge*6u;rc_state[g]=edge;rc_state[g+1u]=rc_state[e+3u];rc_state[g+2u]=rc_state[e+4u];rc_state[g+3u]=activePoint;rc_state[g+4u]=1u;rc_state[g+5u]=0u;
 let v=views+edge*8u;rc_state[v]=rc_state[e+3u];rc_state[v+1u]=rc_state[e+4u];rc_state[v+2u]=manifold;rc_state[v+3u]=cache+rc_geometry[r+11u];rc_state[v+4u]=point;rc_state[v+5u]=cache+rc_geometry[r+12u];rc_state[v+6u]=1u;rc_state[v+7u]=0u;return 0u;
}
`;
}
