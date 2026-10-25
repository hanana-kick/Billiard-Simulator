import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
/* SPDX-License-Identifier: Apache-2.0
 * Exact word bridge; cue joints remain the sole numerical cue solver owner.
 * Canonical cue bodies NEVER enter the four-ball coupled solver. Principal
 * inertia/radius unused-zero slots are sentinels, not fabricated physical data.
 */
import{CUE_LAYOUT}from'./cue.mjs';
import{compileGraph,executeLowered}from'./numeric-program.mjs';
import'../experimental-ccd-inactive.js';
const Created=globalThis.LabCueCreatedStrokeStageExperimental,Checker=globalThis.LabCcdInactiveExperimental;
export const CUE_CANONICAL_ABI=Object.freeze({bodyStride:64,shaftIndex:4,headIndex:5,localCom:56,worldCom:59,maxExtent:62,ccdThickness:63,
 initialMetadata:612,initialMetadataMagic:0x52434342,savedPreSolveWords:128,preSolveReady:60,preSolveFrame:61,
 unusedSentinels:Object.freeze({principalInertia:25,radius:46,linearIncrement:50,angularIncrement:53}),activeCueCcd:false});
/** Initial source words only, before any candidate evolution. Raw-pose device
 * initialization must replace COM/inertia afterward for its candidate pose. */
export function writeCueBridgeInitialState(state,initial){
 if(!(state instanceof Uint32Array)||state.length<1232)throw new TypeError('Owned cue initial state required');
 const s=Created.validate(initial),a=new Float32Array(state.buffer,state.byteOffset,state.length);state[612]=0x52434342;
 for(const[role,i]of[['shaft',0],['head',1]]){a.set([s.ccd[role].maxExtent,s.ccd[role].ccdThickness],613+i*2);a.set(s.cue[role].worldCom,248+i*3);}return state;
}
export function createCueCcdPrograms(){const plans=Checker.sourcePlans(),pre=compileGraph(plans.pre),post=compileGraph(plans.post),program=new Uint32Array(pre.program.length+post.program.length);program.set(pre.program);program.set(post.program,pre.program.length);return Object.freeze({program,pre:{base:0,compiled:pre,plan:plans.pre},post:{base:pre.program.length,compiled:post,plan:plans.post},scratchWords:Math.max(pre.scratchWords,post.scratchWords)});}
const BRIDGE=String.raw`
fn rc_cue_bridge_copy(a:u32,d:u32,n:u32){for(var i=0u;i<n;i++){rc_state[d+i]=rc_state[a+i];}}
fn rc_cue_bridge_fail(cue:u32,reason:u32)->u32{rc_state[cue+2u]=4u;rc_state[cue+3u]=reason;return 4u;}
fn rc_cue_to_canonical(cue:u32,bodies:u32)->u32{
 let n=arrayLength(&rc_state);if(cue>n || n-cue<1232u || bodies>n || n-bodies<384u){return 2u;}
 if(rc_state[cue+2u]!=1u){return rc_state[cue+2u];}if(rc_state[cue+4u]==0u){return 1u;}
 for(var role=0u;role<2u;role++){
  let q=cue+64u+role*48u;let dst=bodies+(4u+role)*64u;
  if((rc_state[cue+47u]&(1u<<role))==0u && rc_state[cue+612u]!=0x52434342u){return 2u;}
  rc_cue_bridge_copy(q,dst,13u);rc_cue_bridge_copy(q+16u,dst+13u,3u);
  rc_state[dst+16u]=rc_state[q+19u];rc_state[dst+17u]=rc_state[q+20u];rc_state[dst+18u]=rc_state[q+21u];
  rc_state[dst+19u]=rc_state[q+20u];rc_state[dst+20u]=rc_state[q+22u];rc_state[dst+21u]=rc_state[q+23u];
  rc_state[dst+22u]=rc_state[q+21u];rc_state[dst+23u]=rc_state[q+23u];rc_state[dst+24u]=rc_state[q+24u];
  for(var i=0u;i<3u;i++){rc_state[dst+25u+i]=0u;}rc_cue_bridge_copy(q+29u,dst+28u,3u);rc_cue_bridge_copy(q+25u,dst+31u,4u);
  rc_cue_bridge_copy(q+32u,dst+35u,3u);rc_cue_bridge_copy(q+35u,dst+38u,3u);rc_state[dst+41u]=0u;rc_cue_bridge_copy(q+38u,dst+42u,4u);
  rc_state[dst+46u]=0u;rc_cue_bridge_copy(q+32u,dst+47u,3u);for(var i=0u;i<6u;i++){rc_state[dst+50u+i]=0u;}
  rc_cue_bridge_copy(q+13u,dst+56u,3u);rc_cue_bridge_copy(cue+248u+role*3u,dst+59u,3u);
  if((rc_state[cue+47u]&(1u<<role))!=0u){rc_cue_bridge_copy(cue+494u+role*30u+12u,dst+62u,2u);}
  else{rc_cue_bridge_copy(cue+613u+role*2u,dst+62u,2u);}
 }
 return 1u;
}
fn rc_cue_capture_pre_solve(cue:u32,bodies:u32,saved:u32)->u32{
 let n=arrayLength(&rc_state);if(cue>n || n-cue<64u || bodies>n || n-bodies<384u || saved>n || n-saved<128u){return 2u;}
 if(rc_state[cue+2u]!=1u || rc_state[cue+12u]!=1u){return 2u;}rc_cue_bridge_copy(bodies+256u,saved,128u);rc_state[cue+60u]=1u;rc_state[cue+61u]=rc_state[cue+7u];return 1u;
}
// Pose-only reverse adoption. No canonical velocity/force feeds the cue solver.
// The caller has already source-updated canonical COM at59 before adopting.
fn rc_cue_adopt_canonical_pose(cue:u32,bodies:u32)->u32{
 let n=arrayLength(&rc_state);if(cue>n || n-cue<256u || bodies>n || n-bodies<384u){return 2u;}if(rc_state[cue+2u]!=1u){return rc_state[cue+2u];}
 for(var role=0u;role<2u;role++){let q=cue+64u+role*48u;let src=bodies+(4u+role)*64u;rc_cue_bridge_copy(src+6u,q+6u,7u);
  rc_state[q+19u]=rc_state[src+16u];rc_state[q+20u]=rc_state[src+17u];rc_state[q+21u]=rc_state[src+18u];rc_state[q+22u]=rc_state[src+20u];rc_state[q+23u]=rc_state[src+21u];rc_state[q+24u]=rc_state[src+24u];rc_cue_bridge_copy(src+59u,cue+248u+role*3u,3u);
 }return 1u;
}
`;
export function generateCueCanonicalBridgeWGSL(){return BRIDGE;}
/** One role per call/dispatch, shaft then head in source order. The post checker
 * uses a saved PRE-solve body and resident solved NEXT pose. Unsupported active
 * or angle-domain cases invalidate the candidate, never an ordinary pass=false.
 * Caller provides rc_state/rc_program/rc_scratch and the chosen source pre/post
 * program base (createCueCcdPrograms). No source plan is rebuilt at runtime. */
export function generateCueInactiveCcdWGSL({includeNumericLibrary=true,includeBridge=true,numericProfile}={}){return(includeNumericLibrary?generateProfiledNumericWGSL(numericProfile):'')+(includeBridge?BRIDGE:'')+`
fn rc_cue_inactive_ccd(cue:u32,bodies:u32,saved:u32,np:u32,scratch:u32,role:u32,post:bool)->u32{
 let n=arrayLength(&rc_state);if(cue>n || n-cue<256u || bodies>n || n-bodies<384u || role>1u){return 2u;}
 if(rc_state[cue+2u]!=1u){return rc_state[cue+2u];}if(rc_state[cue+4u]==0u){return 1u;}
 let next=bodies+(4u+role)*64u;var current=next;
 if(post){if(saved>n || n-saved<128u || rc_state[cue+60u]!=1u || rc_state[cue+61u]!=rc_state[cue+7u]){return 2u;}current=saved+role*64u;}
 if(!(bitcast<f32>(rc_state[current+62u])>0.0) || !(bitcast<f32>(rc_state[current+63u])>0.0) || !(bitcast<f32>(rc_state[cue+195u])>0.0)){return rc_cue_bridge_fail(cue,15u);}
 if(np>arrayLength(&rc_program) || arrayLength(&rc_program)-np<12u || rc_program[np+3u]!=64u || rc_program[np+4u]!=select(11u,20u,post) || scratch>arrayLength(&rc_scratch) || rc_program[np+5u]+1u>arrayLength(&rc_scratch)-scratch){return 2u;}
 for(var i=0u;i<64u;i++){rc_scratch[scratch+i]=0u;}for(var i=0u;i<13u;i++){rc_scratch[scratch+i]=rc_state[current+i];}
 for(var i=0u;i<3u;i++){rc_scratch[scratch+13u+i]=rc_state[current+47u+i];rc_scratch[scratch+16u+i]=rc_state[current+38u+i];rc_scratch[scratch+19u+i]=rc_state[current+13u+i];rc_scratch[scratch+31u+i]=rc_state[current+56u+i];}
 for(var i=0u;i<9u;i++){rc_scratch[scratch+22u+i]=rc_state[current+16u+i];}rc_scratch[scratch+34u]=rc_state[current+62u];rc_scratch[scratch+35u]=rc_state[current+63u];rc_scratch[scratch+36u]=rc_state[cue+64u+131u];
 if(post){for(var i=0u;i<7u;i++){rc_scratch[scratch+37u+i]=rc_state[next+6u+i];}}
 let status=rc_num_eval(np,scratch);if(status!=1u){rc_state[cue+2u]=status;rc_state[cue+3u]=12u;return status;}
 let out=np+rc_program[np+8u];let activeIndex=select(9u,17u,post);let supportedIndex=select(10u,18u,post);
 if(bitcast<f32>(rc_scratch[scratch+rc_program[out+supportedIndex]])!=1.0){return rc_cue_bridge_fail(cue,13u);}
 if(bitcast<f32>(rc_scratch[scratch+rc_program[out+activeIndex]])!=0.0){return rc_cue_bridge_fail(cue,14u);}return 1u;
}
`;}
/** TEST ONLY exact integer shader dialect execution, no numerical evolution. */
export function cueBridgeTestKernels(rc_state){
 if(!(rc_state instanceof Uint32Array))throw new TypeError('Owned u32 storage required');
 const names=[...BRIDGE.matchAll(/fn (rc_cue_\w+)\(/g)].map(x=>x[1]);
 const code=BRIDGE.replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?\s*\{/g,(_,n,args)=>`function ${n}(${args.replace(/:(?:u32|bool)/g,'')}){`).replace(/:(?:u32|bool)(?=\s*=)/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replaceAll('arrayLength(&rc_state)','rc_state.length');
 return new Function('rc_state',code+'\nreturn {'+names.join(',')+'};')(rc_state);
}
