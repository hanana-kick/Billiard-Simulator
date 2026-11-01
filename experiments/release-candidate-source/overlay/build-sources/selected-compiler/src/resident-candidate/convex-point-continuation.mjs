// SPDX-License-Identifier: Apache-2.0
// Opt-in source-control lowering. This is not a replacement GJK algorithm.
// The original step is split at one statement boundary; only five live f32
// values cross that boundary, with their exact words kept in disjoint storage.
import {generateConvexPointWGSL,CONVEX_POINT_LAYOUT as P} from './convex-point.mjs';
const MAGIC=0x52435043;
export const POINT_CONTINUATION_LAYOUT=Object.freeze({
 sourceScratchWords:P.scratchWords,controlOffset:P.scratchWords,controlWords:12,scratchWords:P.scratchWords+12,
 sourceSteps:256,maximumMicroSteps:512,header:Object.freeze({magic:0,phase:1,sourceCalls:2,sourceCap:3,quantum:4,error:5,direction:6,minBound:9,epsilon:10,reserved:11}),
 capability:Object.freeze({sourcePhaseLowering:true,nativeQualified:false,defaultChanged:false})
});
function functionBody(code,name){const start=code.indexOf('fn '+name+'(');if(start<0)throw Error('Missing original source function '+name);const open=code.indexOf('{',start);let depth=1,end=open+1;for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;else if(code[end]==='}')depth--;}if(depth)throw Error('Unbalanced original source function');return code.slice(open+1,end-1);}
export function originalPointGjkSplit(){
 const body=functionBody(generateConvexPointWGSL('gjk'),'rc_point_gjk_step'),boundary='rc_point_setv(11,dir);rc_point_setv(8,rc_point_reduce_simplex());';
 if(body.split(boundary).length!==2)throw Error('Original source GJK continuation boundary changed');const at=body.indexOf(boundary);
 return Object.freeze({prefix:body.slice(0,at),reduceAndTail:body.slice(at),body});
}
/** Same query argument meanings as rc_project_convex_stage. Only this opt-in
 * owner requires 12 MORE scratch words. Repeated `advance` calls consume the
 * original source budget; EPA/finish refuse unfinished or malformed controls.
 * quantum is a bounded textual unroll, never an outer shader loop/back-edge. */
export function generateConvexPointContinuationWGSL(stage,{microStepsPerDispatch=1}={}){
 if(!['init','advance','epa','finish'].includes(stage)||![1,2,4,8].includes(microStepsPerDispatch))throw new RangeError('Explicit original point continuation phase and small quantum required');
 const source=generateConvexPointWGSL(stage==='advance'?'gjk':stage),split=originalPointGjkSplit(),control=P.scratchWords;
 const phases=stage==='advance'?`
var<private> rc_pc_control:u32;
fn rc_pc_prefix(){
${split.prefix}
 rc_scratch[rc_pc_control+6u]=bitcast<u32>(dir.x);rc_scratch[rc_pc_control+7u]=bitcast<u32>(dir.y);rc_scratch[rc_pc_control+8u]=bitcast<u32>(dir.z);
 rc_scratch[rc_pc_control+9u]=bitcast<u32>(min_bound);rc_scratch[rc_pc_control+10u]=bitcast<u32>(eps);rc_scratch[rc_pc_control+1u]=1u;
}
fn rc_pc_reduce(){
 let dir:rc_point_V=rc_point_v3(bitcast<f32>(rc_scratch[rc_pc_control+6u]),bitcast<f32>(rc_scratch[rc_pc_control+7u]),bitcast<f32>(rc_scratch[rc_pc_control+8u]));
 let min_bound:f32=bitcast<f32>(rc_scratch[rc_pc_control+9u]);let eps:f32=bitcast<f32>(rc_scratch[rc_pc_control+10u]);rc_scratch[rc_pc_control+1u]=0u;
${split.reduceAndTail}
}
fn rc_pc_one(){
 let phase=rc_scratch[rc_pc_control+1u];if(phase==2u||phase==3u){return;}
 if(phase==0u){if(rc_scratch[rc_pc_control+2u]>=256u){rc_scratch[rc_pc_control+1u]=2u;return;}rc_scratch[rc_pc_control+2u]++;rc_pc_prefix();}
 else if(phase==1u){rc_pc_reduce();}else{rc_scratch[rc_pc_control+1u]=3u;return;}
 if(rc_scratch[rc_pc_control+1u]==0u&&(rc_scratch[rc_point_scratch]!=0u||rc_scratch[rc_pc_control+2u]==256u)){rc_scratch[rc_pc_control+1u]=2u;}
}
`:'';
 return source+phases+`
fn rc_project_convex_cont_stage(scratch:u32,output:u32,hull:u32,position:vec3<f32>,solid:u32)->u32{
 if(scratch>arrayLength(&rc_scratch)||arrayLength(&rc_scratch)-scratch<${P.scratchWords+12}u){return 3u;}let c=scratch+${control}u;
 ${stage==='init'?`let status=rc_project_convex_stage(scratch,output,hull,position,solid);if(status!=0u){return status;}for(var i=0u;i<12u;i++){rc_scratch[c+i]=0u;}rc_scratch[c]=${MAGIC}u;rc_scratch[c+3u]=256u;rc_scratch[c+4u]=${microStepsPerDispatch}u;return 0u;`:`
 if(rc_scratch[c]!=${MAGIC}u||rc_scratch[c+3u]!=256u||rc_scratch[c+2u]>256u||rc_scratch[c+4u]!=${microStepsPerDispatch}u||rc_scratch[c+5u]!=0u||rc_scratch[c+11u]!=0u||rc_scratch[c+1u]>2u){return 3u;}
 ${stage==='advance'?`rc_point_scratch=scratch;rc_point_output=output;rc_point_hull=hull;rc_point_position=position;rc_point_solid=solid;rc_pc_control=c;
 ${Array.from({length:microStepsPerDispatch},()=>`rc_pc_one();`).join('\n ')}
 if(rc_scratch[c+1u]==3u){rc_scratch[c+5u]=3u;return 3u;}return 0u;`:`
 if(rc_scratch[c+1u]!=2u||(rc_scratch[c+2u]<256u&&rc_scratch[scratch]==0u)){return 3u;}
 return rc_project_convex_stage(scratch,output,hull,position,solid);`}`}
}
`;
}
