import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
/* SPDX-License-Identifier: Apache-2.0
 * Resident composition of the unchanged floor/pair/convex cache owners.
 * One candidate owns one scratch region; all 26 cache lifetimes are visited in
 * original floor, pair, then cushion source order. The journal supplies actual
 * pair presence and the scene adapter supplies the PRE-observation visit mask.
 */
import {generateGeometryWorldWGSL} from './geometry-world.mjs';
import {generateNarrowphaseWGSL} from './narrowphase.mjs';

import {generateConvexPointWGSL,CONVEX_POINT_LAYOUT} from './convex-point.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
export const WORLD_GEOMETRY_LAYOUT=Object.freeze({header:Object.freeze({status:24,cursor:25,cache:26,present:27,visited:28,projection:29,edge:30,phase:31}),rows:26,refreshedWords:128,stages:Object.freeze(['select','floor','pair','convexPrepare','init','gjk','epa','finish','convexFinish','advance']),gjkDispatches:CONVEX_POINT_LAYOUT.gjkIterations,capability:Object.freeze({sourceCacheLifecycle:true,wholeH:false,liveCueGeometry:false})});
function offsets(t){const names=['bodies','caches','journal','geometryFacts','manifoldViews','geometryRefreshed','projectionOutput'];if(names.some(n=>!Number.isInteger(t?.segments?.[n]?.offset)))throw new TypeError('Complete world bank geometry segments required');return Object.fromEntries(names.map(n=>[n,t.segments[n].offset]));}
/** Functions only. The caller provides rc_state/scratch/program/geometry and
 * exact scene-mask functions; it never sends per-row presence or hit flags. */
export function generateWorldGeometryWGSL(template,stage,{numericProfile,queryTransport='staged',queryChunk=8}={}){
 if(!['staged','resident-loop','chunked'].includes(queryTransport)||![2,4,8].includes(queryChunk))throw new RangeError('Explicit source query transport required');
 const loop=queryTransport==='resident-loop',chunked=queryTransport==='chunked';
 if(!WORLD_GEOMETRY_LAYOUT.stages.includes(stage)&&stage!=='control')throw new RangeError('Original geometry stage required');
 const o=offsets(template),narrow=template.bundles.narrow,p=template.programOffsets.narrow,catalog=template.geometryOffsets.catalog,hulls=template.geometryOffsets.hulls;
 const helpers=`
fn rc_world_geometry_refreshed(bank:u32,edge:u32)->u32 {if(edge>=128u){return 0xffffffffu;}return rc_state[bank+${o.geometryRefreshed}u+edge];}
fn rc_world_geometry_fail(bank:u32,reason:u32){if(rc_state[bank+24u]==0u){rc_state[bank+24u]=reason;}}
fn rc_world_geometry_begin(bank:u32){
 if(rc_state[bank+${o.journal}u+${J.header.status}u]!=0u||rc_state[bank+${o.journal}u+${J.header.phase}u]!=2u){rc_world_geometry_fail(bank,1u);return;}
 for(var i=24u;i<32u;i++){rc_state[bank+i]=0u;}
 for(var e=0u;e<128u;e++){rc_state[bank+${o.geometryRefreshed}u+e]=0xffffffffu;for(var i=0u;i<6u;i++){rc_state[bank+${o.geometryFacts}u+e*6u+i]=0u;}for(var i=0u;i<8u;i++){rc_state[bank+${o.manifoldViews}u+e*8u+i]=0u;}}
}
fn rc_world_geometry_row(bank:u32)->u32{return ${catalog}u+rc_state[bank+25u]*16u;}
fn rc_world_geometry_ready(bank:u32,kind:u32)->bool{return rc_state[bank+24u]==0u&&rc_state[bank+25u]<26u&&rc_state[bank+31u]==1u&&rc_geometry[rc_world_geometry_row(bank)]==kind;}
fn rc_world_geometry_point_ready(bank:u32)->bool{return rc_world_geometry_ready(bank,2u)&&rc_state[bank+29u]==1u;}
fn rc_world_geometry_complete(bank:u32)->bool{
 if(rc_state[bank+24u]!=0u||rc_state[bank+25u]!=26u||rc_state[bank+31u]!=0u){return false;}
 // Cue geometry runs its separate authenticated owner before this gate.
 let j=bank+${o.journal}u;for(var e=0u;e<rc_state[j+${J.header.edges}u];e++){let f=bank+${o.geometryFacts}u+e*6u;let ep=j+${J.edgeOffset}u+e*${J.edgeStride}u;if(rc_state[f]!=e||rc_state[f+1u]!=rc_state[ep+3u]||rc_state[f+2u]!=rc_state[ep+4u]||rc_state[f+4u]!=1u||rc_state[bank+${o.geometryRefreshed}u+e]>1u){rc_world_geometry_fail(bank,3u);return false;}}return true;
}
`;
 if(stage==='control')return helpers;
 let library='',body='';
 if(stage==='select')body=`
 if(rc_state[bank+24u]!=0u||rc_state[bank+25u]>=26u){return;}if(rc_state[bank+31u]!=0u){rc_world_geometry_fail(bank,1u);return;}
 let r=rc_world_geometry_row(bank);let j=bank+${o.journal}u;var c1=0xffffffffu;var c2=0xffffffffu;
 for(var i=0u;i<rc_state[j+${J.header.colliders}u];i++){let c=j+${J.colliderOffset}u+i*${J.colliderStride}u;if(rc_state[c]==rc_geometry[r+1u]&&rc_state[c+1u]==rc_geometry[r+2u]){c1=i;}if(rc_state[c]==rc_geometry[r+3u]&&rc_state[c+1u]==rc_geometry[r+4u]){c2=i;}}
 if(c1==0xffffffffu||c2==0xffffffffu){rc_world_geometry_fail(bank,3u);return;}var edge=0xffffffffu;
 for(var e=0u;e<rc_state[j+${J.header.edges}u];e++){let ep=j+${J.edgeOffset}u+e*${J.edgeStride}u;if(rc_state[ep]==c1&&rc_state[ep+1u]==c2){edge=e;break;}}
 rc_state[bank+26u]=bank+${o.caches}u+rc_geometry[r+7u];rc_state[bank+27u]=u32(edge!=0xffffffffu);rc_state[bank+28u]=u32(rc_world_scene_geometry_visited(bank,c1,c2));rc_state[bank+29u]=0u;rc_state[bank+30u]=edge;rc_state[bank+31u]=1u;
 if(rc_geometry[r]==0u){rc_state[bank+28u]=u32(rc_world_scene_geometry_dynamic_awake(bank,c2));if(rc_state[bank+28u]==0u&&rc_state[rc_state[bank+26u]+128u]!=rc_state[bank+27u]){rc_world_geometry_fail(bank,3u);return;}}
 if(rc_geometry_gather(${catalog}u,bank+${o.caches}u,bank+${o.bodies}u,rc_state[bank+25u],rc_state[bank+10u])!=0u){rc_world_geometry_fail(bank,1u);}
 `;
 else if(['floor','pair','convexPrepare','convexFinish'].includes(stage)){
  library=generateProfiledNumericWGSL(numericProfile)+'\n'+generateNarrowphaseWGSL(narrow);
  if(stage==='floor'||stage==='pair')body=`if(!rc_world_geometry_ready(bank,${stage==='floor'?0:1}u)){return;}if(rc_narrow_${stage}(rc_state[bank+26u],scratch,${p}u,rc_state[bank+27u],rc_state[bank+28u])!=0u){rc_world_geometry_fail(bank,2u);}`;
  else if(stage==='convexPrepare')body=`if(!rc_world_geometry_ready(bank,2u)){return;}let result=rc_narrow_convex_prepare(rc_state[bank+26u],scratch,${p}u,rc_state[bank+27u],rc_state[bank+28u]);if(result==2u){rc_world_geometry_fail(bank,2u);}else{rc_state[bank+29u]=result;}`;
  else body=`if(!rc_world_geometry_point_ready(bank)){return;}if(rc_narrow_convex_finish(rc_state[bank+26u],scratch,${p}u,bank+${o.projectionOutput}u)!=0u){rc_world_geometry_fail(bank,2u);}`;
 }else if(['init','gjk','epa','finish'].includes(stage)){
  library=generateConvexPointWGSL(stage==='gjk'&&loop?'gjk-loop':stage,{queryTransport:chunked?'chunked':'staged',queryChunk});body=`if(!rc_world_geometry_point_ready(bank)){return;}let r=rc_world_geometry_row(bank);let body=bank+${o.bodies}u+rc_geometry[r+6u]*64u;let position=vec3<f32>(bitcast<f32>(rc_state[body+6u]),bitcast<f32>(rc_state[body+7u]),bitcast<f32>(rc_state[body+8u]));if(rc_project_convex_stage(scratch,bank+${o.projectionOutput}u,${hulls}u+rc_geometry[r+9u],position,0u)!=0u){rc_world_geometry_fail(bank,2u);}`;
  if(stage==='init'&&loop)body+=`rc_state[bank+${o.projectionOutput+15}u]=256u;`;
 }else body=`
 if(rc_state[bank+24u]!=0u||rc_state[bank+25u]>=26u){return;}if(rc_state[bank+31u]!=1u){rc_world_geometry_fail(bank,1u);return;}let row=rc_state[bank+25u];let r=rc_world_geometry_row(bank);let cache=rc_state[bank+26u];let edge=rc_state[bank+30u];
 if(edge!=0xffffffffu){if(rc_geometry_publish_edge(${catalog}u,26u,bank+${o.caches}u,bank+${o.journal}u,edge,bank+${o.geometryFacts}u,bank+${o.manifoldViews}u)!=0u){rc_world_geometry_fail(bank,2u);return;}var refreshed=138u;if(rc_geometry[r]==1u){refreshed=324u;}if(rc_geometry[r]==2u){refreshed=388u;}rc_state[bank+${o.geometryRefreshed}u+edge]=rc_state[cache+refreshed];}
 rc_state[bank+25u]=row+1u;rc_state[bank+31u]=0u;
 `;
 return helpers+'\n'+generateGeometryWorldWGSL()+'\n'+library+`\nfn rc_world_geometry_stage(bank:u32,scratch:u32){${body}}\n`;
}
