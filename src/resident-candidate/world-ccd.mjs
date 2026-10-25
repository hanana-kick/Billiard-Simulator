// SPDX-License-Identifier: Apache-2.0
// Canonical-world binding of experimental-three-ball-ccd-world.advanceCcdOuter.
// This module owns no replacement physics. Entry values stay resident while the
// original scene/solver runs; only its solved next pose enters the post check.
import {CCD_LAYOUT,createCcdPrograms} from './ccd.mjs';
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {SCENE_WORLD_LAYOUT as W} from './scene-world.mjs';
const H=Object.freeze({phase:0,numericReady:1,entryAwakeMask:2,entryEpoch:3,journalSequence:4,journalRevision:5,preEvaluations:6,postEvaluations:7,clampMask:8,activeCount:9,mode:10,cursor:11,pendingMask:12,checkedMask:13});
export const WORLD_CCD_LAYOUT=Object.freeze({offset:1184,words:96,header:H,activeOrder:16,phases:Object.freeze({collision:0,pre:1,solve:2,post:3,clamped:4,complete:5,inactivePre:10,inactivePreComplete:11,inactiveNewlyAwake:12,inactiveSolver:13,inactivePost:14,inactiveComplete:15})});
export const WORLD_CCD_CAPABILITY=Object.freeze({postCueOnly:false,activeCcdPostCueOnly:true,liveCueInactiveGate:true,sourceOrdering:true,retainsEntryForce:true,hostForwardFallback:false,completeH:false,nativeWorldParity:false});
const need=(v,m)=>{if(!v)throw new RangeError('World CCD: '+m);};
/** Immutable identity specialization only. No candidate parameter or future
 * numerical value is compiled into this integer adapter. */
export function worldCcdBindings(input){const rows=Array.isArray(input)?input:input?.bindings;need(Array.isArray(rows)&&rows.length>=4,'four original canonical ball bindings');const out=rows.slice(0,4).map((r,i)=>{need(r.body&&Number.isInteger(r.body.index)&&Number.isInteger(r.body.generation)&&Number.isInteger(r.sceneSlot)&&r.sceneSlot>=0&&r.sceneSlot<32,'generation-bearing scene slot');return Object.freeze({canonicalIndex:i,index:r.body.index,generation:r.body.generation,sceneSlot:r.sceneSlot});});need(new Set(out.map(r=>r.sceneSlot)).size===4&&new Set(out.map(r=>r.index+':'+r.generation)).size===4,'distinct original identities');return Object.freeze(out);}
export function generateWorldCcdWGSL(input,programs=createCcdPrograms()){const pre=programs.entries.pre,post=programs.entries.post;const rows=worldCcdBindings(input),slot=rows.map(r=>r.sceneSlot+'u').join(','),index=rows.map(r=>r.index+'u').join(','),generation=rows.map(r=>r.generation+'u').join(',');need(WORLD_CCD_LAYOUT.offset+WORLD_CCD_LAYOUT.words<=CCD_LAYOUT.words,'nonoverlapping reserved tail');return `
const RC_WCCD_SLOTS:array<u32,4>=array<u32,4>(${slot});
const RC_WCCD_INDICES:array<u32,4>=array<u32,4>(${index});
const RC_WCCD_GENERATIONS:array<u32,4>=array<u32,4>(${generation});
fn rc_world_ccd_adapter(b:u32)->u32{return b+1184u;}
fn rc_world_ccd_scene_body(b:u32,scene:u32,bridge:u32,i:u32)->u32{
 if(i>=4u){rc_ccd_fail(b,3u);return 0xffffffffu;}let slot=RC_WCCD_SLOTS[i];let p=scene+${S.bodyOffset}u+slot*${S.bodyStride}u;
 if(slot>=rc_state[scene+${S.header.bodySlots}u]||rc_state[p+${S.body.present}u]!=1u||rc_state[p+${S.body.dynamic}u]!=1u||rc_state[p+${S.body.index}u]!=RC_WCCD_INDICES[i]||rc_state[p+${S.body.generation}u]!=RC_WCCD_GENERATIONS[i]||rc_state[bridge+${W.bodyMapOffset}u+slot]!=i){rc_ccd_fail(b,3u);return 0xffffffffu;}return p;
}
// Called once per application h, after cue withdrawal is authoritative. The
// shared fixed seed lives once in the tile's rc_state tail, not in every bank.
fn rc_world_ccd_begin(world:u32,b:u32,dtWord:u32,minDtWord:u32,cuePresent:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}if(cuePresent!=0u){return rc_ccd_fail(b,2u);}let a=rc_world_ccd_adapter(b);if(rc_state[a]!=0u&&rc_state[a]!=5u&&rc_state[a]!=15u){return rc_ccd_fail(b,4u);}
 if(rc_ccd_begin(b,bitcast<f32>(dtWord),bitcast<f32>(minDtWord))!=0u){return rc_state[b];}for(var i=0u;i<96u;i++){rc_state[a+i]=0u;}rc_state[world+10u]=rc_state[b+5u];return 0u;
}
// Exact boundary: collision operations complete, BEFORE force/hot/energy.
// Do not call with the final awake list after sleep (source order can differ).
fn rc_world_ccd_pre_begin(world:u32,b:u32,bodies:u32,scene:u32,bridge:u32,broad:u32,journal:u32,seed:u32,bvh:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}let a=rc_world_ccd_adapter(b);
 if(rc_state[a]!=0u||rc_state[b+1u]!=1u||rc_state[scene+${S.header.status}u]!=1u||rc_state[scene+${S.header.phase}u]!=5u||rc_state[bridge+${W.header.status}u]!=1u||rc_state[bridge+${W.header.phase}u]!=1u||rc_state[broad]!=0u||rc_state[broad+1u]!=2u||rc_state[journal]!=0u||rc_state[journal+1u]!=3u||rc_state[journal+15u]!=0u||rc_state[bvh+18u]!=0u||rc_state[bvh+11u]!=0u){return rc_ccd_fail(b,4u);}
 for(var i=0u;i<4u;i++){let p=rc_world_ccd_scene_body(b,scene,bridge,i);if(p==0xffffffffu){return rc_state[b];}let sourceBody=bodies+i*64u;let targetBody=b+32u+i*80u;
  rc_ccd_copy(targetBody,sourceBody,13u);rc_ccd_copy(targetBody+13u,sourceBody+47u,3u);rc_ccd_copy(targetBody+16u,sourceBody+38u,3u);rc_ccd_copy(targetBody+19u,sourceBody+13u,3u);rc_ccd_copy(targetBody+22u,sourceBody+16u,9u);
  // Source local COM is zero; maxExtent/thickness34/35 remain authenticated
  // CCD metadata. Canonical ball64 slots62/63 are not those initial fields.
  for(var k=0u;k<3u;k++){rc_state[targetBody+31u+k]=0u;}rc_state[targetBody+36u]=rc_state[b+5u];rc_ccd_copy(targetBody+64u,sourceBody+31u,4u);rc_ccd_copy(targetBody+68u,sourceBody+28u,3u);rc_state[targetBody+71u]=select(0u,1u,rc_state[p+${S.body.activation+4}u]!=0u);if(rc_state[targetBody+71u]>1u){return rc_ccd_fail(b,3u);}
 }
 var count=0u;var mask=0u;let awake=rc_state[scene+${S.header.awake}u];if(awake!=0xffffffffu){if(awake>=32u){return rc_ccd_fail(b,3u);}let compact=rc_state[scene+${S.chunkMapOffset}u+awake];if(compact>=6u){return rc_ccd_fail(b,3u);}let chunk=scene+${S.chunkOffset}u+compact*${S.chunkStride}u;if(rc_state[chunk]!=awake){return rc_ccd_fail(b,3u);}count=rc_state[chunk+1u];if(count>4u){return rc_ccd_fail(b,2u);}for(var j=0u;j<count;j++){let member=rc_state[chunk+2u+j];if(member>=32u){return rc_ccd_fail(b,3u);}let i=rc_state[bridge+${W.bodyMapOffset}u+member];if(i>=4u){return rc_ccd_fail(b,2u);}if(member!=RC_WCCD_SLOTS[i]||(mask&(1u<<i))!=0u||rc_state[b+32u+i*80u+71u]!=0u){return rc_ccd_fail(b,3u);}mask|=1u<<i;rc_state[a+16u+j]=i;}}
 for(var i=0u;i<4u;i++){if((rc_state[b+32u+i*80u+71u]==0u)!=((mask&(1u<<i))!=0u)){return rc_ccd_fail(b,3u);}}
 rc_state[a+2u]=mask;rc_state[a+3u]=rc_state[scene+${S.header.epoch}u];rc_state[a+4u]=rc_state[journal+4u];rc_state[a+5u]=rc_state[journal+5u];rc_state[a+9u]=count;rc_state[a+1u]=0u;rc_state[a+8u]=0u;
 if(rc_ccd_pre_begin(b,seed,bvh,a+16u,count)!=0u){return rc_state[b];}rc_state[a]=1u;rc_state[world+10u]=rc_state[b+5u];return 0u;
}
// Standalone numeric dispatch. Never inline this into a controller/phase loop.
fn rc_world_ccd_evaluate(b:u32,scratch:u32,program:u32){
 if(rc_state[b]!=0u){return;}let a=rc_world_ccd_adapter(b);let phase=rc_state[a];if(phase!=1u&&phase!=3u){return;}if(rc_state[a+1u]!=0u||rc_state[b+14u]==0u){rc_ccd_fail(b,4u);return;}
 var request=vec2<u32>(0u,0u);if(phase==1u){request=rc_ccd_pre_numeric_request(b);}else{request=rc_ccd_body_numeric_request(b);}if(!rc_ccd_eval(b,request.y,request.x,scratch,program)){return;}rc_state[a+1u]=1u;if(phase==1u){rc_state[a+6u]++;}else{rc_state[a+7u]++;}
}
fn rc_world_ccd_apply_clamps(b:u32,bodies:u32){let a=rc_world_ccd_adapter(b);if(rc_state[b]!=0u){return;}if(rc_state[b+13u]!=1u||rc_state[b+14u]!=0u){rc_ccd_fail(b,4u);return;}var mask=0u;
 for(var i=0u;i<4u;i++){let out=b+352u+i*24u;let sleeping=rc_state[b+32u+i*80u+71u];if(rc_state[out+2u]>1u||(sleeping!=0u&&rc_state[out+2u]!=0u)){rc_ccd_fail(b,3u);return;}if(rc_state[out+2u]!=0u){let dst=bodies+i*64u;rc_ccd_copy(dst+6u,out+4u,3u);rc_ccd_copy(dst+9u,out+7u,4u);rc_ccd_copy(dst+16u,out+11u,9u);mask|=1u<<i;}}
 rc_state[a+8u]=mask;rc_state[a]=4u;
}
// AFTER original scene observation and solver scatter; only next pose is new.
fn rc_world_ccd_post_begin(b:u32,bodies:u32,scene:u32,bridge:u32,seed:u32,bvh:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}let a=rc_world_ccd_adapter(b);if(rc_state[a]!=2u||rc_state[b+1u]!=2u||rc_state[scene+${S.header.status}u]!=1u||rc_state[scene+${S.header.phase}u]!=6u||rc_state[bridge+${W.header.status}u]!=1u||rc_state[bridge+${W.header.phase}u]!=2u){return rc_ccd_fail(b,4u);}
 for(var i=0u;i<4u;i++){let p=rc_world_ccd_scene_body(b,scene,bridge,i);if(p==0xffffffffu){return rc_state[b];}let sleeping=select(0u,1u,rc_state[p+${S.body.activation+4}u]!=0u);if(sleeping>1u||(sleeping==0u&&(rc_state[a+2u]&(1u<<i))==0u)){return rc_ccd_fail(b,3u);}let targetBody=b+32u+i*80u;rc_ccd_copy(targetBody+37u,bodies+i*64u+6u,7u);rc_state[targetBody+71u]=sleeping;}
 rc_state[a+1u]=0u;rc_state[a]=3u;if(rc_ccd_post_begin(b,seed,bvh)!=0u){return rc_state[b];}if(rc_state[b+14u]==0u){rc_world_ccd_apply_clamps(b,bodies);}return rc_state[b];
}
// Standalone integer/scalar control dispatch: no numeric VM reachable.
fn rc_world_ccd_pre_control(world:u32,b:u32,scratch:u32,program:u32){
 if(rc_state[b]!=0u){return;}let a=rc_world_ccd_adapter(b);if(rc_state[a]!=1u){return;}if(rc_state[a+1u]!=1u){rc_ccd_fail(b,4u);return;}rc_state[a+1u]=0u;rc_ccd_pre_control(b,scratch,program);if(rc_state[b]!=0u){return;}if(rc_state[b+14u]==0u){if(rc_state[b+1u]!=2u){rc_ccd_fail(b,4u);return;}rc_state[a]=2u;rc_state[world+10u]=rc_state[b+6u];}
}
fn rc_world_ccd_post_control(b:u32,bodies:u32,scratch:u32,program:u32){
 if(rc_state[b]!=0u){return;}let a=rc_world_ccd_adapter(b);if(rc_state[a]!=3u){return;}if(rc_state[a+1u]!=1u){rc_ccd_fail(b,4u);return;}rc_state[a+1u]=0u;rc_ccd_post_control(b,scratch,program);if(rc_state[b]!=0u){return;}if(rc_state[b+14u]==0u){rc_world_ccd_apply_clamps(b,bodies);}
}
// Compatibility wrapper for host ordering diagnostics. Production pipelines use
// the two separate entry call trees above: source pre/post branches are never
// combined with BVH mutation or duplicate GJK private temporaries in one kernel.
fn rc_world_ccd_control(world:u32,b:u32,bodies:u32,scratch:u32,program:u32){let phase=rc_state[rc_world_ccd_adapter(b)];if(phase==1u){rc_world_ccd_pre_control(world,b,scratch,program);}else if(phase==3u){rc_world_ccd_post_control(b,bodies,scratch,program);}}
// Require actual finished broad/journal ownership, not a caller boolean. The
// outer owner then opens the next scene internal pass, or applies the single
// outer angular/rule patch. It must not patch between selected CCD passes.
fn rc_world_ccd_advance(world:u32,b:u32,broad:u32,journal:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}let a=rc_world_ccd_adapter(b);if(rc_state[a]!=4u||rc_state[broad]!=0u||rc_state[broad+1u]!=0u||rc_state[journal]!=0u||rc_state[journal+1u]!=0u||rc_state[journal+4u]!=rc_state[a+4u]||rc_state[journal+5u]!=rc_state[a+5u]){return rc_ccd_fail(b,4u);}
 if(rc_ccd_advance_pass(b)!=0u){return rc_state[b];}if(rc_state[b+1u]==3u){rc_state[a]=5u;rc_state[world+10u]=rc_state[b+8u];}else{rc_state[a]=0u;rc_state[world+10u]=rc_state[b+5u];}return 0u;
}
// Live-cue mode is deliberately separate: original pre/post inactive predicates
// reject active CCD. Capture before broad/narrow wakes; then a second pre gate
// covers newly awakened balls after force observation and before solve.
fn rc_world_ccd_inactive_next(b:u32,bodies:u32){let a=rc_world_ccd_adapter(b);let phase=rc_state[a];var i=rc_state[a+11u];let mask=rc_state[a+12u];loop{if(i>=4u){rc_state[a]=phase+1u;if(phase==14u){rc_state[b+1u]=3u;}return;}if((mask&(1u<<i))!=0u){break;}i++;}rc_state[a+11u]=i;let row=b+32u+i*80u;rc_ccd_copy(b+448u,row,64u);if(phase==12u){rc_ccd_copy(b+461u,bodies+i*64u+47u,3u);rc_ccd_copy(b+464u,bodies+i*64u+38u,3u);}rc_state[a+1u]=0u;}
fn rc_world_ccd_inactive_begin(world:u32,b:u32,bodies:u32,scene:u32,bridge:u32,dtWord:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}let a=rc_world_ccd_adapter(b);if((rc_state[a]!=0u&&rc_state[a]!=15u)||rc_state[scene+${S.header.status}u]!=1u||(rc_state[scene+${S.header.phase}u]!=1u&&rc_state[scene+${S.header.phase}u]!=4u)||rc_state[bridge+${W.header.status}u]!=1u||(dtWord&0x80000000u)!=0u||(dtWord&0x7fffffffu)==0u||(dtWord&0x7f800000u)==0x7f800000u){return rc_ccd_fail(b,4u);}
 for(var j=0u;j<32u;j++){rc_state[b+j]=0u;}for(var j=0u;j<96u;j++){rc_state[a+j]=0u;}rc_state[b+1u]=2u;rc_state[b+5u]=dtWord;rc_state[b+6u]=dtWord;rc_state[b+8u]=dtWord;rc_state[world+10u]=dtWord;var mask=0u;
 for(var i=0u;i<4u;i++){let p=rc_world_ccd_scene_body(b,scene,bridge,i);if(p==0xffffffffu){return rc_state[b];}let sourceBody=bodies+i*64u;let targetBody=b+32u+i*80u;rc_ccd_copy(targetBody,sourceBody,13u);rc_ccd_copy(targetBody+13u,sourceBody+47u,3u);rc_ccd_copy(targetBody+16u,sourceBody+38u,3u);rc_ccd_copy(targetBody+19u,sourceBody+13u,3u);rc_ccd_copy(targetBody+22u,sourceBody+16u,9u);for(var k=0u;k<3u;k++){rc_state[targetBody+31u+k]=0u;}rc_state[targetBody+36u]=dtWord;rc_ccd_copy(targetBody+64u,sourceBody+31u,4u);rc_ccd_copy(targetBody+68u,sourceBody+28u,3u);let sleeping=select(0u,1u,rc_state[p+${S.body.activation+4}u]!=0u);if(sleeping>1u){return rc_ccd_fail(b,3u);}rc_state[targetBody+71u]=sleeping;if(sleeping==0u){mask|=1u<<i;}}
 rc_state[a]=10u;rc_state[a+10u]=1u;rc_state[a+2u]=mask;rc_state[a+12u]=mask;rc_world_ccd_inactive_next(b,bodies);return rc_state[b];
}
fn rc_world_ccd_inactive_newly_awake_begin(b:u32,bodies:u32,scene:u32,bridge:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}let a=rc_world_ccd_adapter(b);if(rc_state[a]!=11u||rc_state[a+10u]!=1u||rc_state[scene+${S.header.status}u]!=1u||rc_state[scene+${S.header.phase}u]!=6u||rc_state[bridge+${W.header.status}u]!=1u||rc_state[bridge+${W.header.phase}u]!=2u){return rc_ccd_fail(b,4u);}var mask=0u;
 for(var i=0u;i<4u;i++){let p=rc_world_ccd_scene_body(b,scene,bridge,i);if(p==0xffffffffu){return rc_state[b];}let sleeping=select(0u,1u,rc_state[p+${S.body.activation+4}u]!=0u);if(sleeping>1u){return rc_ccd_fail(b,3u);}if(sleeping==0u&&(rc_state[a+2u]&(1u<<i))==0u){mask|=1u<<i;}}
 rc_state[a]=12u;rc_state[a+11u]=0u;rc_state[a+12u]=mask;rc_state[a+13u]=0u;rc_world_ccd_inactive_next(b,bodies);return rc_state[b];
}
fn rc_world_ccd_inactive_post_begin(b:u32,bodies:u32,scene:u32,bridge:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}let a=rc_world_ccd_adapter(b);if(rc_state[a]!=13u||rc_state[a+10u]!=1u||rc_state[scene+${S.header.status}u]!=1u||rc_state[scene+${S.header.phase}u]!=6u||rc_state[bridge+${W.header.status}u]!=1u||rc_state[bridge+${W.header.phase}u]!=2u){return rc_ccd_fail(b,4u);}var mask=0u;
 for(var i=0u;i<4u;i++){let p=rc_world_ccd_scene_body(b,scene,bridge,i);if(p==0xffffffffu){return rc_state[b];}let sleeping=select(0u,1u,rc_state[p+${S.body.activation+4}u]!=0u);if(sleeping>1u){return rc_ccd_fail(b,3u);}if(sleeping==0u){mask|=1u<<i;}let row=b+32u+i*80u;rc_ccd_copy(row+37u,bodies+i*64u+6u,7u);rc_state[row+71u]=sleeping;}
 rc_state[a]=14u;rc_state[a+11u]=0u;rc_state[a+12u]=mask;rc_state[a+13u]=0u;rc_world_ccd_inactive_next(b,bodies);return rc_state[b];
}
fn rc_world_ccd_inactive_evaluate(b:u32,scratch:u32,program:u32){if(rc_state[b]!=0u){return;}let a=rc_world_ccd_adapter(b);let phase=rc_state[a];if(phase!=10u&&phase!=12u&&phase!=14u){return;}if(rc_state[a+1u]!=0u){rc_ccd_fail(b,4u);return;}var which=${pre.id}u;if(phase==14u){which=${post.id}u;}if(!rc_ccd_eval(b,b+448u,which,scratch,program)){return;}rc_state[a+1u]=1u;if(phase==14u){rc_state[a+7u]++;}else{rc_state[a+6u]++;}}
fn rc_world_ccd_inactive_control(b:u32,bodies:u32){if(rc_state[b]!=0u){return;}let a=rc_world_ccd_adapter(b);let phase=rc_state[a];if(phase!=10u&&phase!=12u&&phase!=14u){return;}if(rc_state[a+1u]!=1u){rc_ccd_fail(b,4u);return;}let i=rc_state[a+11u];if(i>=4u){rc_ccd_fail(b,3u);return;}var isActive=rc_state[b+704u+${pre.plan.layout.active.offset}u];var supported=rc_state[b+704u+${pre.plan.layout.supported.offset}u];if(phase==14u){isActive=rc_state[b+704u+${post.plan.layout.active.offset}u];supported=rc_state[b+704u+${post.plan.layout.supported.offset}u];}if((isActive!=0u&&isActive!=0x3f800000u)||(supported!=0u&&supported!=0x3f800000u)){rc_ccd_fail(b,1u);return;}if(isActive!=0u||supported==0u){rc_ccd_fail(b,2u);return;}rc_state[a+13u]|=1u<<i;rc_state[a+11u]=i+1u;rc_state[a+1u]=0u;rc_world_ccd_inactive_next(b,bodies);}

`;}
