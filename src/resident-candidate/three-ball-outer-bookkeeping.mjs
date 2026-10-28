// SPDX-License-Identifier: Apache-2.0
// PhysicsLab.step's outer-loop bookkeeping only. No physics, score, query
// finalization or presentation telemetry is inferred by this component.
import {assertThreeBallCreatedOwnerTemplate} from './three-ball-created-owner.mjs';
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {numberWords} from './source-number.mjs';
const owned=new WeakMap(),need=(ok,message)=>{if(!ok)throw new RangeError('Three-ball outer bookkeeping: '+message);};
export const THREE_BALL_OUTER_LAYOUT=Object.freeze({words:96,magic:0,version:1,status:2,phase:3,subdivisions:4,inner:5,completedOuter:6,reason:7,acceptedFrame:8,acceptedSequence:9,entryFrame:10,entrySequence:11,latchedCue:12,nativeDt:13,strokeSubsteps:14,dt:16,h:18,time:20,steps:22,entryTime:24,entrySteps:26});
export function createThreeBallOuterBookkeepingPlan(template){
 need(arguments.length===1,'one authentic template');assertThreeBallCreatedOwnerTemplate(template);const a=template.seed.application;
 need(a.strokeSubsteps===64&&template.seed.cueInitial.application.subdivisions===64,'authentic source strokeSubsteps64');
 need(Number.isFinite(a.dt)&&a.dt>0&&Number.isFinite(a.time)&&Number.isSafeInteger(a.steps)&&a.steps>=0,'original finite clocks');
 const nativeDt=template.seed.nativeInitial.integration_parameters.dt;need(nativeDt===Math.fround(a.dt),'actual created native dt agrees with ready outer boundary');
 const initialWords=new Uint32Array(96);initialWords.set([0x52334f55,1,1]);initialWords[14]=a.strokeSubsteps;initialWords[13]=new Uint32Array(Float32Array.of(nativeDt).buffer)[0];
 for(const[at,value]of [[16,a.dt],[20,a.time],[22,a.steps]])initialWords.set(numberWords(value),at);
 const plan=Object.freeze({kind:'genuine-three-outer-bookkeeping-source-v1',template,sourceIdentity:template.sourceIdentity,layout:THREE_BALL_OUTER_LAYOUT,initialWords,capability:Object.freeze({sourceBookkeepingOnly:true,presentationTelemetryExcluded:true,queryObservation:false,controllerFinish:false,threeBallGame:false,physicalOuterStepVerified:false,gpuQualified:false})});owned.set(plan,initialWords.slice());return plan;
}
export function assertThreeBallOuterBookkeepingPlan(plan){const seal=owned.get(plan);need(seal&&seal.length===plan.initialWords.length&&seal.every((v,i)=>v===plan.initialWords[i]),'local immutable initial plan');assertThreeBallCreatedOwnerTemplate(plan.template);return plan;}
export function generateThreeBallOuterBookkeepingWGSL(plan,{stateBase,retainedBase,applicationBase,firstApplicationBase,cueBase,journalBase,sceneBase=0}={}){
 assertThreeBallOuterBookkeepingPlan(plan);for(const x of [stateBase,retainedBase,applicationBase,firstApplicationBase,cueBase,journalBase,sceneBase])need(Number.isSafeInteger(x)&&x>=0&&x<0x10000000,'absolute owned bases');
 const o=stateBase,h=retainedBase,a=applicationBase,f=firstApplicationBase,q=cueBase,j=journalBase,s=sceneBase;
 return `
fn rc_three_outer_fail(reason:u32)->bool{if(rc_state[${o+2}u]==1u){rc_state[${o+2}u]=4u;rc_state[${o+7}u]=reason;}return false;}
fn rc_three_outer_begin()->bool{
 let o=${o}u;let h=${h}u;let q=${q}u;
 if(rc_state[o]!=0x52334f55u||rc_state[o+1u]!=1u||rc_state[o+2u]!=1u||(rc_state[o+3u]!=0u&&rc_state[o+3u]!=2u)||rc_state[o+14u]!=64u||rc_state[h]!=0x52335248u||rc_state[h+1u]!=1u||rc_state[h+2u]!=1u||rc_state[h+25u]!=0u||rc_state[q+2u]!=1u||rc_state[q+4u]>1u||rc_state[q+12u]!=0u||rc_state[${j}u]!=0u||rc_state[${j+1}u]!=0u){return rc_three_outer_fail(1u);}
 if(rc_state[o+3u]==0u){if(rc_state[h+3u]!=0u||rc_state[h+26u]!=0u||rc_state[h+4u]!=0u||rc_state[o+8u]!=0u||rc_state[o+9u]!=0u||rc_state[${j+4}u]!=0u){return rc_three_outer_fail(1u);}}
 else{if(rc_state[h+3u]!=1u||rc_state[h+26u]!=1u||rc_state[h+4u]!=rc_state[o+8u]||rc_state[h+8u]!=rc_state[o+9u]||rc_state[o+5u]!=rc_state[o+4u]){return rc_three_outer_fail(1u);}for(var n=0u;n<2u;n++){if(rc_state[o+20u+n]!=rc_state[h+12u+n]){return rc_three_outer_fail(2u);}}}
 for(var n=0u;n<2u;n++){if(rc_state[o+16u+n]!=rc_state[h+18u+n]||rc_state[o+22u+n]!=rc_state[h+22u+n]||rc_state[o+20u+n]!=rc_state[q+20u+n]){return rc_three_outer_fail(2u);}}
 let subdivisions=select(1u,rc_state[o+14u],rc_state[q+4u]==1u);let dt=RcF64(rc_state[o+16u],rc_state[o+17u]);let step=rc_f64_div(dt,rc_f64_from_u32(subdivisions));if(!rc_f64_finite(step)||rc_f64_zero(step)){return rc_three_outer_fail(2u);}
 rc_state[o+4u]=subdivisions;rc_state[o+5u]=0u;rc_state[o+10u]=rc_state[o+8u];rc_state[o+11u]=rc_state[o+9u];rc_state[o+12u]=rc_state[q+4u];rc_state[o+18u]=step.x;rc_state[o+19u]=step.y;rc_state[o+13u]=rc_f64_to_f32_bits(step);for(var n=0u;n<2u;n++){rc_state[o+24u+n]=rc_state[o+20u+n];rc_state[o+26u+n]=rc_state[o+22u+n];}rc_state[o+3u]=1u;return true;
}
fn rc_three_outer_accept_h()->bool{
 let o=${o}u;let h=${h}u;let q=${q}u;var a=${a}u;if(rc_state[h+4u]==1u){a=${f}u;}
 if(rc_state[o]!=0x52334f55u||rc_state[o+1u]!=1u||rc_state[o+2u]!=1u||rc_state[o+3u]!=1u||rc_state[o+5u]>=rc_state[o+4u]||(rc_state[o+4u]!=1u&&rc_state[o+4u]!=64u)||rc_state[o+8u]!=rc_state[o+10u]+rc_state[o+5u]||rc_state[o+9u]!=rc_state[o+11u]+rc_state[o+5u]||rc_state[o+8u]==0xffffffffu||rc_state[o+9u]==0xffffffffu||rc_state[h+2u]!=1u||rc_state[h+3u]!=1u||rc_state[h+25u]!=0u||rc_state[h+26u]!=1u||rc_state[h+4u]!=rc_state[o+8u]+1u||rc_state[h+8u]!=rc_state[o+9u]+1u||rc_state[a+2u]!=1u||rc_state[a+6u]!=1u||rc_state[q+12u]!=0u||rc_state[${j}u]!=0u||rc_state[${j+1}u]!=0u||rc_state[${j+4}u]!=rc_state[h+8u]||rc_state[${s+S.header.status}u]!=1u||rc_state[${s+S.header.phase}u]!=3u){return rc_three_outer_fail(3u);}
 if(rc_state[q+4u]==1u&&(rc_state[q+7u]!=rc_state[h+4u]||rc_state[q+8u]!=rc_state[h+4u]%64u)){return rc_three_outer_fail(3u);}
 let next=rc_f64_add(RcF64(rc_state[o+20u],rc_state[o+21u]),RcF64(rc_state[o+18u],rc_state[o+19u]));if(!rc_f64_finite(next)||next.x!=rc_state[a+20u]||next.y!=rc_state[a+21u]){return rc_three_outer_fail(4u);}
 for(var n=0u;n<2u;n++){if(rc_state[a+20u+n]!=rc_state[h+12u+n]||rc_state[a+20u+n]!=rc_state[q+20u+n]||rc_state[a+18u+n]!=rc_state[o+22u+n]||rc_state[a+12u+n]!=rc_state[o+18u+n]){return rc_three_outer_fail(4u);}}
 rc_state[o+20u]=next.x;rc_state[o+21u]=next.y;rc_state[o+8u]=rc_state[h+4u];rc_state[o+9u]=rc_state[h+8u];rc_state[o+5u]++;return true;
}
fn rc_three_outer_finish()->bool{
 let o=${o}u;let h=${h}u;if(rc_state[o]!=0x52334f55u||rc_state[o+1u]!=1u||rc_state[o+2u]!=1u||rc_state[o+3u]!=1u||rc_state[o+5u]!=rc_state[o+4u]||(rc_state[o+4u]!=1u&&rc_state[o+4u]!=64u)||rc_state[o+8u]!=rc_state[o+10u]+rc_state[o+5u]||rc_state[o+9u]!=rc_state[o+11u]+rc_state[o+5u]||rc_state[o+6u]==0xffffffffu||rc_state[h+2u]!=1u||rc_state[h+3u]!=1u||rc_state[h+4u]!=rc_state[o+8u]||rc_state[h+8u]!=rc_state[o+9u]){return rc_three_outer_fail(5u);}
 let steps=rc_f64_add(RcF64(rc_state[o+22u],rc_state[o+23u]),rc_f64_from_u32(1u));if(!rc_f64_finite(steps)){return rc_three_outer_fail(5u);}
 // Exactly PhysicsLab's order: native setter rounds dt to f32, then JS steps++.
 rc_state[o+13u]=rc_f64_to_f32_bits(RcF64(rc_state[o+16u],rc_state[o+17u]));rc_state[o+22u]=steps.x;rc_state[o+23u]=steps.y;rc_state[h+22u]=steps.x;rc_state[h+23u]=steps.y;rc_state[${a+18}u]=steps.x;rc_state[${a+19}u]=steps.y;rc_state[o+6u]++;rc_state[o+3u]=2u;return true;
}
`;}
