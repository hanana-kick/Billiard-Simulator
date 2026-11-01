// SPDX-License-Identifier: Apache-2.0
// PhysicsLab.step / optimizer physical outer-boundary owner. This is a device
// continuation adapter, not a forward solver or a candidate generator.
import {APPLICATION_LAYOUT as A,APPLICATION_DRIVER} from './application.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {SCENE_INTEGRATION_LAYOUT as SI} from './scene-integration.mjs';
import {CUE_LAYOUT as Q} from './cue.mjs';
import {WORLD_CCD_LAYOUT as C} from './world-ccd.mjs';
import {RULE_LAYOUT as R} from './physical-rules.mjs';
import {REASON} from './abi.mjs';
import {numberWords} from './source-number.mjs';
const H=Object.freeze({magic:0,version:1,phase:2,detail:3,outer:4,substep:5,subdivisions:6,
  events:7,passSequence:8,passes:9,cueFrame:10,cueAtEntry:11,episodes:12,eventsRestored:13,
  hSequence:14,expiry:15,cancelRequested:16,firstPassSequence:17,initialElapsed:18,
  terminalPublished:20,reserved:21});
export const WORLD_APPLICATION_LAYOUT=Object.freeze({version:1,header:H,headerWords:32,
  events:32,eventStride:4,maxEvents:J.maxEvents,words:32+J.maxEvents*4,
  phases:Object.freeze({idle:0,outerReady:1,cuePre:2,world:3,application:4,applicationDone:5,outer:6,terminal:7}),
  // A final gather completes the phase walk after the last numeric job.
  maximumApplicationJobs:APPLICATION_DRIVER.maximumJobs+1,completeH:false});
export const WORLD_APPLICATION_DETAIL=Object.freeze({none:0,contract:1,eventCapacity:2,
  createdCueContinuationProfile:3,application:4,sourceClock:5,eventSequence:6,expiryRemoval:7});
export const WORLD_APPLICATION_CAPABILITY=Object.freeze({residentSourceClock:true,
  outerSubdivisionsLatched:true,allInternalPassEvents:true,actualExpiryWithdrawal:true,
  sourceCreatedCueMaximumContinuationSeconds:.02,fullRestAfterGoal:true,
  wholeHPhysics:false,rawAdmission:false,hostForwardFallback:false});
/** Initial control state only. The elapsed-zero cue profile is authenticated by
 * the original created source loader, never a future CPU-prepared trajectory. */
export function encodeWorldApplication(){const a=new Uint32Array(WORLD_APPLICATION_LAYOUT.words);a[H.magic]=0x52435741;a[H.version]=1;return a;}
function constants(t){
 const names=['worldApplication','application','applicationRegisters','applicationControl','applicationOutput','rules','cue','scene','journal','manifoldViews','broad','ccd'];
 for(const name of names)if(!Number.isInteger(t?.segments?.[name]?.offset))throw new RangeError('World application requires common '+name+' segment');
 if(t.segments.worldApplication.words!==WORLD_APPLICATION_LAYOUT.words||!Number.isInteger(t.programOffsets?.application))throw new RangeError('Exact world application layout/program required');
 const groups={WA:H,WAL:WORLD_APPLICATION_LAYOUT,WAA:A.header,WAJ:J,WAJH:J.header,WAS:S,WASH:S.header,WASB:S.body,WASI:SI.header,WAQ:Q,WAQH:Q.header,WAC:C,WAR:R};
 const limit=numberWords(.02);
 return names.map(n=>`const WAO_${n}:u32=${t.segments[n].offset}u;`).concat(Object.entries(groups).flatMap(([prefix,g])=>Object.entries(g).filter(([,v])=>Number.isInteger(v)).map(([k,v])=>`const ${prefix}_${k}:u32=${v}u;`)),[
  `const WA_PROGRAM:u32=${t.programOffsets.application}u;`,
  `const WA_LIMIT_LO:u32=${limit[0]}u;const WA_LIMIT_HI:u32=${limit[1]}u;`,
  `const WA_PROFILE_REASON:u32=${REASON.CUE_CONTINUATION_PROFILE}u;`
 ]).join('\n');
}
/** Requires existing application, rule, scene and scene-integration libraries,
 * plus exact source-number scalar helpers. No VM evaluation is reachable. */
export function generateWorldApplicationWGSL(template){return constants(template)+'\n'+CONTROL;}
export function generateWorldApplicationEvaluateWGSL(template){return constants(template)+WORK+`
fn rc_world_application_evaluate(bank:u32,scratch:u32){
 let b=bank+WAO_worldApplication;let phase=rc_state[b+WA_phase];
 if(rc_state[bank+2u]!=1u||(phase!=4u&&phase!=6u)){return;}
 rc_application_stage_evaluate(bank+WAO_application,rc_world_application_work(bank,scratch));
}`;}
const WORK=`
fn rc_world_application_work(bank:u32,scratch:u32)->RcApplicationWork{return RcApplicationWork(WA_PROGRAM,bank+WAO_applicationRegisters,bank+WAO_applicationControl,bank+WAO_applicationOutput,scratch);}
`;
const CONTROL=WORK+String.raw`
fn rc_world_application_fail(bank:u32,reason:u32,detail:u32)->bool{
 if(rc_state[bank+2u]==1u){rc_state[bank+2u]=4u;rc_state[bank+3u]=reason;rc_state[bank+WAO_worldApplication+WA_detail]=detail;}return false;
}
fn rc_world_application_live(bank:u32,phase:u32)->bool{
 let b=bank+WAO_worldApplication;if(rc_state[bank+2u]!=1u){return false;}
 if(rc_state[b+WA_magic]!=0x52435741u||rc_state[b+WA_version]!=1u||rc_state[b+WA_phase]!=phase){return rc_world_application_fail(bank,6u,1u);}return true;
}
fn rc_world_application_check(bank:u32)->bool{
 if(rc_state[bank+WAO_application]!=0u){return rc_world_application_fail(bank,select(6u,5u,rc_state[bank+WAO_application]==4u),4u);}
 if(rc_state[bank+WAO_rules+WAR_status]==4u){return rc_world_application_fail(bank,select(6u,4u,rc_state[bank+WAO_rules+WAR_reason]==10u),4u);}return true;
}
// PhysicsLab computes subdivisions once at OUTER entry, not after retirement.
fn rc_world_application_begin_outer(bank:u32)->bool{
 if(!rc_world_application_live(bank,0u)){return false;}let b=bank+WAO_worldApplication;let a=bank+WAO_application;let q=bank+WAO_cue;
 if(rc_state[bank+WASI_phase]!=0u||rc_state[a+WAA_cuePresent]!=rc_state[q+WAQH_present]||rc_state[bank+WAO_rules+WAR_status]!=1u){return rc_world_application_fail(bank,6u,1u);}
 rc_application_begin_outer(a);if(!rc_world_application_check(bank)){return false;}let n=rc_state[a+WAA_outerSubsteps];if(n!=1u&&n!=64u){return rc_world_application_fail(bank,6u,1u);}
 rc_state[b+WA_substep]=0u;rc_state[b+WA_subdivisions]=n;rc_state[b+WA_phase]=1u;return true;
}
// Before cue.prepareApplication. Preserve the original bounded created-owner
// guard elapsed-initialElapsed >= .02 as UNSUPPORTED, never horizon/miss.
fn rc_world_application_begin_h(bank:u32)->bool{
 if(!rc_world_application_live(bank,1u)){return false;}let b=bank+WAO_worldApplication;let a=bank+WAO_application;let q=bank+WAO_cue;
 if(rc_state[bank+WASI_phase]!=0u||rc_state[b+WA_substep]>=rc_state[b+WA_subdivisions]||rc_state[a+WAA_cuePresent]!=rc_state[q+WAQH_present]||rc_state[q+WAQH_status]!=1u||rc_state[q+WAQH_needsSolve]!=0u){return rc_world_application_fail(bank,6u,1u);}
 let present=rc_state[q+WAQH_present];if(present>1u){return rc_world_application_fail(bank,6u,1u);}
 if(present!=0u){
  if(!rc_f64_eq(rc_app_number(a+WAA_time),rc_app_number(q+WAQH_time))||!rc_f64_eq(rc_app_number(a+WAA_h),rc_app_number(q+WAQH_h))){return rc_world_application_fail(bank,6u,5u);}
  let elapsed=rc_f64_sub(rc_app_number(q+WAQH_elapsed),rc_app_number(b+WA_initialElapsed));
  if(rc_f64_le(RcF64(WA_LIMIT_LO,WA_LIMIT_HI),elapsed)){return rc_world_application_fail(bank,WA_PROFILE_REASON,3u);}
 }
 let dt=rc_f64_to_f32_bits(rc_app_number(a+WAA_h));if((dt&0x80000000u)!=0u||(dt&0x7f800000u)==0x7f800000u||(dt&0x7fffffffu)==0u){return rc_world_application_fail(bank,5u,5u);}
 rc_state[bank+10u]=dt;rc_state[b+WA_events]=0u;rc_state[b+WA_passes]=0u;rc_state[b+WA_eventsRestored]=0u;rc_state[b+WA_expiry]=0u;
 rc_state[b+WA_cueFrame]=rc_state[q+WAQH_frame];rc_state[b+WA_cueAtEntry]=present;rc_state[b+WA_episodes]=rc_state[q+WAQH_contactEpisodes];
 rc_state[b+WA_firstPassSequence]=rc_state[bank+WAO_journal+WAJH_sequence];rc_state[b+WA_passSequence]=rc_state[b+WA_firstPassSequence];rc_state[b+WA_hSequence]=rc_state[bank+5u];rc_state[b+WA_phase]=2u;return true;
}
// After actual cue numeric preapplication AND scene receipt consumption, but
// before collision. Birth emission uses OLD application time. Other-sphere
// compliant contacts remain rejected by the source cue separation owner.
fn rc_world_application_after_cue_pre(bank:u32)->bool{
 if(!rc_world_application_live(bank,2u)){return false;}let b=bank+WAO_worldApplication;let a=bank+WAO_application;let q=bank+WAO_cue;
 if(rc_state[bank+WASI_phase]!=1u||rc_state[q+WAQH_status]!=1u){return rc_world_application_fail(bank,6u,1u);}
 if(rc_state[b+WA_cueAtEntry]!=0u){
  if(rc_state[b+WA_cueFrame]==0xffffffffu||rc_state[q+WAQH_frame]!=rc_state[b+WA_cueFrame]+1u||rc_state[q+43u]>1u||rc_state[q+WAQH_contactEpisodes]!=rc_state[b+WA_episodes]+rc_state[q+43u]){return rc_world_application_fail(bank,6u,1u);}
  if(!rc_f64_eq(rc_app_number(q+WAQH_time),rc_f64_add(rc_app_number(a+WAA_time),rc_app_number(a+WAA_h)))){return rc_world_application_fail(bank,6u,5u);}
  if(rc_state[q+43u]!=0u){rc_application_emit_nonkey(a,bank+WAO_rules);}
 }else if(rc_state[q+WAQH_present]!=0u||rc_state[q+WAQH_frame]!=rc_state[b+WA_cueFrame]){return rc_world_application_fail(bank,6u,1u);}
 if(rc_state[q+WAQH_present]==0u){for(var role=0u;role<3u;role++){let member=rc_state[q+WAQH_headSlot+role];if(rc_scene_valid_body(bank+WAO_scene,member)){return rc_world_application_fail(bank,6u,7u);}}rc_application_cue_removed(a);}
 else if(rc_state[q+WAQH_present]!=1u||rc_state[a+WAA_cuePresent]!=1u){return rc_world_application_fail(bank,6u,1u);}
 rc_state[b+WA_phase]=3u;return rc_world_application_check(bank);
}
// Original CCD pendingEvents.push(...contactEvents), preserving stopped and
// removal rows too. Capture once per source journal sequence before its next
// begin clears the queue. No filtering here: source uses FINAL h velocities.
fn rc_world_application_capture_events(bank:u32)->bool{
 if(!rc_world_application_live(bank,3u)){return false;}let b=bank+WAO_worldApplication;let j=bank+WAO_journal;
 if(rc_state[j]!=0u||rc_state[j+WAJH_phase]!=3u||rc_state[b+WA_eventsRestored]!=0u){return rc_world_application_fail(bank,6u,1u);}
 let sequence=rc_state[j+WAJH_sequence];if(sequence==rc_state[b+WA_passSequence]){return true;}
 if(rc_state[b+WA_passSequence]==0xffffffffu||sequence!=rc_state[b+WA_passSequence]+1u||rc_state[b+WA_passes]>=4u){return rc_world_application_fail(bank,6u,6u);}
 let n=rc_state[j+WAJH_events];let count=rc_state[b+WA_events];if(n>WAL_maxEvents||count>WAL_maxEvents||n>WAL_maxEvents-count){return rc_world_application_fail(bank,4u,2u);}
 for(var i=0u;i<n;i++){let src=j+WAJ_eventOffset+i*4u;let dst=b+WAL_events+(count+i)*4u;
  if(rc_state[src]>=rc_state[j+WAJH_colliders]||rc_state[src+1u]>=rc_state[j+WAJH_colliders]||rc_state[src+2u]>1u){return rc_world_application_fail(bank,6u,1u);}
  for(var k=0u;k<4u;k++){rc_state[dst+k]=rc_state[src+k];}
 }
 rc_state[b+WA_events]=count+n;rc_state[b+WA_passSequence]=sequence;rc_state[b+WA_passes]++;return true;
}
// Live-cue: post-moved broad is complete, journal stays pending until angular
// and postApplication. Post-cue: every CCD pass already sealed its journal;
// only the source CCD authority's FINAL phase allows this once-h application.
fn rc_world_application_begin_post_h(bank:u32)->bool{
 if(!rc_world_application_live(bank,3u)){return false;}let b=bank+WAO_worldApplication;let a=bank+WAO_application;let j=bank+WAO_journal;let c=bank+WAO_ccd;
 if(rc_state[bank+WASI_phase]!=5u||rc_state[bank+WAO_scene+WASH_phase]!=6u||rc_state[bank+WAO_broad]!=0u||rc_state[j]!=0u||rc_state[c]!=0u||rc_state[b+WA_passes]==0u||rc_state[b+WA_passSequence]!=rc_state[j+WAJH_sequence]){return rc_world_application_fail(bank,6u,1u);}
 // The separation h remains in the live-cue source owner even though the cue
 // was removed before world.step; active CCD begins on the following h.
 if(rc_state[b+WA_cueAtEntry]!=0u){if(rc_state[c+WAC_offset]!=15u||rc_state[j+WAJH_phase]!=3u||rc_state[bank+WAO_broad+1u]!=3u||rc_state[b+WA_passes]!=1u){return rc_world_application_fail(bank,6u,1u);}}
 else{if(rc_state[c+1u]!=3u||rc_state[c+WAC_offset]!=5u||rc_state[j+WAJH_phase]!=0u||rc_state[bank+WAO_broad+1u]!=0u){return rc_world_application_fail(bank,6u,1u);}}
 let n=rc_state[b+WA_events];for(var i=0u;i<n*4u;i++){rc_state[j+WAJ_eventOffset+i]=rc_state[b+WAL_events+i];}rc_state[j+WAJH_events]=n;rc_state[b+WA_eventsRestored]=1u;
 rc_application_stage_begin(a,15u);if(!rc_world_application_check(bank)){return false;}rc_state[b+WA_phase]=4u;return true;
}
fn rc_world_application_gather(bank:u32,scratch:u32){let b=bank+WAO_worldApplication;let phase=rc_state[b+WA_phase];if(rc_state[bank+2u]!=1u||(phase!=4u&&phase!=6u)){return;}rc_application_stage_gather(bank+WAO_application,bank+WAO_journal,bank+WAO_manifoldViews,bank+WAO_scene,bank+WAO_rules,rc_world_application_work(bank,scratch));rc_world_application_check(bank);}
fn rc_world_application_scatter(bank:u32,scratch:u32){let b=bank+WAO_worldApplication;let phase=rc_state[b+WA_phase];if(rc_state[bank+2u]!=1u||(phase!=4u&&phase!=6u)){return;}rc_application_stage_scatter(bank+WAO_application,bank+WAO_journal,bank+WAO_manifoldViews,bank+WAO_scene,bank+WAO_rules,rc_world_application_work(bank,scratch));rc_world_application_check(bank);}
// Source removeCue after angular, at NEW time. This mutates the actual source
// island/chunk manager now; collider withdrawal remains queued for next h.
// The .02 created profile makes this .22 branch unreachable in today's admitted
// live-cue continuation. Keeping the real branch is NOT an admission extension.
fn rc_world_application_expire_cue(bank:u32)->bool{
 let b=bank+WAO_worldApplication;let a=bank+WAO_application;let q=bank+WAO_cue;let scene=bank+WAO_scene;
 if(rc_state[a+WAA_removeCue]==0u||rc_state[q+WAQH_present]==0u){return true;}
 if(rc_state[scene+WASH_phase]!=3u||rc_state[q+WAQH_status]!=1u||rc_state[q+WAQH_needsSolve]!=0u||rc_state[q+WAQH_removedCount]!=0u||rc_state[q+WAQH_frame]!=rc_state[bank+WASI_cueFrame]){return rc_world_application_fail(bank,6u,7u);}
 for(var role=0u;role<3u;role++){let member=rc_state[q+WAQH_headSlot+role];if(!rc_scene_valid_body(scene,member)){return rc_world_application_fail(bank,6u,7u);}}
 for(var role=0u;role<3u;role++){if(!rc_scene_remove_body(scene,rc_state[q+WAQH_headSlot+role])){return rc_world_application_fail(bank,6u,7u);}rc_state[q+WAQ_removedRoles+role]=role;}
 rc_state[q+WAQH_present]=0u;rc_state[q+WAQH_removedCount]=3u;rc_state[q+WAQH_endedValid]=1u;rc_state[q+WAQH_ended]=rc_state[a+WAA_time];rc_state[q+WAQH_ended+1u]=rc_state[a+WAA_time+1u];
 rc_application_cue_removed(a);rc_state[b+WA_expiry]=1u;return true;
}
fn rc_world_application_finish_post_h(bank:u32)->bool{
 if(!rc_world_application_live(bank,4u)){return false;}let a=bank+WAO_application;if(!rc_world_application_check(bank)){return false;}
 if(rc_state[a+WAA_complete]!=1u||rc_state[a+WAA_jobType]!=0u||rc_state[a+WAA_mode]!=15u){return rc_world_application_fail(bank,6u,1u);}
 if(!rc_world_application_expire_cue(bank)||!rc_world_scene_after_application(bank)){return false;}rc_state[bank+WAO_worldApplication+WA_phase]=5u;return true;
}
// Call after the live journal finish (postcue is already sealed) and actual
// rc_world_scene_finish. This is the sole hSequence increment authority.
fn rc_world_application_finish_h(bank:u32)->bool{
 if(!rc_world_application_live(bank,5u)){return false;}let b=bank+WAO_worldApplication;let a=bank+WAO_application;
 if(rc_state[bank+WASI_phase]!=0u||rc_state[bank+WAO_scene+WASH_phase]!=3u||rc_state[bank+WAO_journal+WAJH_phase]!=0u||rc_state[bank+WAO_broad+1u]!=0u||rc_state[bank+5u]!=rc_state[b+WA_hSequence]||rc_state[bank+5u]==0xffffffffu){return rc_world_application_fail(bank,6u,1u);}
 rc_state[bank+5u]++;rc_state[b+WA_substep]++;if(rc_state[b+WA_substep]>rc_state[b+WA_subdivisions]){return rc_world_application_fail(bank,6u,1u);}
 if(rc_state[b+WA_substep]==rc_state[b+WA_subdivisions]){rc_application_stage_begin(a,16u);if(!rc_world_application_check(bank)){return false;}rc_state[b+WA_phase]=6u;}else{rc_state[b+WA_phase]=1u;}return true;
}
fn rc_world_application_finish_outer(bank:u32)->bool{
 if(!rc_world_application_live(bank,6u)){return false;}let b=bank+WAO_worldApplication;let a=bank+WAO_application;let r=bank+WAO_rules;
 if(!rc_world_application_check(bank)){return false;}if(rc_state[a+WAA_complete]!=1u||rc_state[a+WAA_jobType]!=0u||rc_state[a+WAA_mode]!=16u||rc_state[b+WA_outer]==0xffffffffu){return rc_world_application_fail(bank,6u,1u);}
 rc_state[b+WA_outer]++;if(rc_state[r+WAR_steps]!=rc_state[b+WA_outer]){return rc_world_application_fail(bank,6u,1u);}let status=rc_state[r+WAR_status];
 if(status==1u){rc_state[b+WA_phase]=0u;return true;}if(status!=2u&&status!=3u&&status!=5u&&status!=7u){return rc_world_application_fail(bank,6u,1u);}
 rc_state[bank+2u]=status;rc_state[bank+3u]=select(0u,7u,status==5u);if(status==7u){rc_state[bank+3u]=5u;}rc_state[b+WA_phase]=7u;rc_state[b+WA_terminalPublished]=1u;return true;
}
// Explicit device cancellation command: terminate at a dispatch boundary,
// never run partial physics into pass/miss or reinterpret cancellation as miss.
fn rc_world_application_cancel(bank:u32){let status=rc_state[bank+2u];if(status!=0u&&status!=1u){return;}rc_state[bank+WAO_worldApplication+WA_cancelRequested]=1u;rc_state[bank+2u]=6u;rc_state[bank+3u]=8u;rc_state[bank+WAO_worldApplication+WA_phase]=7u;rc_state[bank+WAO_rules+WAR_status]=6u;rc_state[bank+WAO_rules+WAR_reason]=13u;}
fn rc_world_application_result(bank:u32)->vec4<u32>{let status=rc_state[bank+2u];var matched=0xffffffffu;if(status==2u){matched=1u;}else if(status==3u){matched=0u;}return vec4<u32>(rc_state[bank+4u],status,matched,rc_state[bank+3u]);}
`;
/** Test-only dialect of the actual adapter, with explicitly supplied source
 * kernels. No dependencies are fabricated and no runtime fallback is exported. */
export function worldApplicationTestKernels(words,template,dependencies){
 // Reuse the single control constants/work declaration and append evaluate.
 let code=generateWorldApplicationWGSL(template)+'\nfn rc_world_application_evaluate'+generateWorldApplicationEvaluateWGSL(template).split('fn rc_world_application_evaluate')[1];
 const names=[...code.matchAll(/fn (rc_\w+)\(/g)].map(m=>m[1]);
 code=code.replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool|RcApplicationWork|vec4<u32>))?\s*\{/g,(_,n,args)=>`function ${n}(${args.replace(/:(?:u32|bool|RcApplicationWork)/g,'')}){`).replace(/:(?:u32|bool)(?=\s*=)/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/vec4<u32>/g,'Vec4');
 return new Function('rc_state','select',...Object.keys(dependencies),code+'\nreturn {'+names.join(',')+'};')(words,(a,b,p)=>p?b:a,...Object.values(dependencies));
}
