// SPDX-License-Identifier: Apache-2.0
// Genuine recurrence: the unchanged first-h graph, then an additive current
// prefix graph sharing its one bank. No h1/reference output is an input.
import {createThreeBallFirstHPlan,assertThreeBallFirstHPlan,buildThreeBallFirstHSource,executeThreeBallFirstHWordsForTest} from './three-ball-first-h.mjs';
import {generateCueOrchestrationWGSL} from './cue-orchestration.mjs';
import {generateSceneActivationWGSL,SCENE_LAYOUT as S} from './scene-activation.mjs';
import {generateSceneWorldWGSL,SCENE_WORLD_LAYOUT as W} from './scene-world.mjs';
import {generateThreeBallRetainedTapeWGSL} from './three-ball-retained-tape.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {CUE_LAYOUT as Q} from './cue.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
const owned=new WeakMap(),results=new WeakMap(),need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball second prefix: '+m),{code:'three-ball-second-prefix-unsupported'});};
export const THREE_BALL_SECOND_PREFIX_CAPABILITY=Object.freeze({actualSpheres:3,actualCueDynamics:2,colliders:25,initialSameBank:true,sourceProgramOnly:true,hostCallbackFree:true,endpoint:'second-inner-h-current-prefix-user-change-drain',completedInnerH:1,secondPrefix:true,secondCollision:false,secondH:false,wholeH:false,nativeWholeHVerified:false,runtimeIntegrated:false,gpuQualified:false});
export function createThreeBallSecondPrefixPlan(template){
 need(arguments.length===1,'only authentic initial template');const first=createThreeBallFirstHPlan(template),control=first.layout.words,initialWords=new Uint32Array(control+32);initialWords.set(first.initialWords);initialWords.set([0x52333250,1,1],control);
 const plan=Object.freeze({kind:'resident-three-ball-second-prefix-plan-v1',template,sourceIdentity:template.sourceIdentity,first,layout:Object.freeze({...first.layout,secondControl:control,words:initialWords.length}),initialWords,program:first.program,geometry:first.geometry,scratchWords:first.scratchWords,capability:THREE_BALL_SECOND_PREFIX_CAPABILITY});Object.preventExtensions(initialWords);owned.set(plan,{seal:initialWords.slice(),compiled:null});return plan;
}
export function assertThreeBallSecondPrefixPlan(plan){const r=owned.get(plan);need(r,'local original plan');assertThreeBallFirstHPlan(plan.first);need(plan.initialWords.length===r.seal.length&&plan.initialWords.every((x,i)=>x===r.seal[i]),'initial words mutated');return plan;}
export function generateThreeBallSecondPrefixWGSL(plan){return generatePrefix(plan,null);}
export function generateThreeBallRetainedPrefixWGSL(plan,controlBase){need(Number.isSafeInteger(controlBase)&&controlBase>=plan.layout.words&&controlBase<0x10000000,'retained prefix control after owned bank');return generatePrefix(plan,controlBase);}
export function generateThreeBallOuterPrefixWGSL(plan,controlBase){need(Number.isSafeInteger(controlBase)&&controlBase>=plan.layout.words&&controlBase<0x10000000,'outer prefix owned control');return generatePrefix(plan,controlBase,true);}
function generatePrefix(plan,controlBase,outer=false){assertThreeBallSecondPrefixPlan(plan);const d=plan.layout,c=d.secondControl,q=d.cue,b=d.bodies,p=plan.first.programOffsets.cue,selected=plan.template.seed.sourceOrigin.selectedIndex,retained=controlBase!==null,entryFrame=retained?`rc_state[${controlBase+5}u]`:'1u',frame=retained?`rc_state[${controlBase+6}u]`:'2u',entrySubstep=outer?`(${entryFrame}%64u)`:entryFrame,substep=outer?`(${frame}%64u)`:frame,entrySequence=retained?`rc_state[${controlBase+7}u]`:'1u',proof=retained?`rc_state[${controlBase}u]!=0x52335248u||rc_state[${controlBase+1}u]!=1u||rc_state[${controlBase+2}u]!=1u||rc_state[${controlBase+3}u]!=2u||rc_state[${controlBase+25}u]!=1u||rc_state[${c+8}u]!=rc_state[${controlBase+6}u]||`:'';
 return `
fn rc_three_h2_fail(reason:u32)->bool{if(rc_state[${c+2}u]==1u){rc_state[${c+2}u]=4u;rc_state[${c+4}u]=reason;}return false;}
fn rc_three_h2_prefix_begin()->bool{
 if(${proof}rc_state[${c}u]!=0x52333250u||rc_state[${c+1}u]!=1u||rc_state[${c+2}u]!=1u||rc_state[${c+3}u]!=0u||rc_state[${c+5}u]!=0u||rc_state[${d.control+2}u]!=1u||rc_state[${d.control+3}u]!=11u||rc_state[${d.control+5}u]!=1u||rc_state[${d.control+6}u]!=1u||!rc_three_tape_preserved()){return rc_three_h2_fail(1u);}
 if(rc_state[${S.header.status}u]!=1u||rc_state[${S.header.phase}u]!=3u||rc_state[${S.header.bodyCount}u]!=22u||rc_state[${q+Q.header.status}u]!=1u||rc_state[${q+Q.header.frame}u]!=${entryFrame}||rc_state[${q+Q.header.outerSubstep}u]!=${entrySubstep}||rc_state[${q+Q.header.needsSolve}u]!=0u||rc_state[${q+Q.header.present}u]!=1u||rc_state[${d.journal}u]!=0u||rc_state[${d.journal+J.header.phase}u]!=0u||rc_state[${d.journal+J.header.sequence}u]!=${entrySequence}||rc_state[${d.broad}u]!=0u||rc_state[${d.broad+1}u]!=0u||rc_state[${d.energy+W.header.firstPending}u]!=0u){return rc_three_h2_fail(2u);}
 rc_state[${c+6}u]=rc_state[${S.header.epoch}u];if(rc_cue_begin(${q}u,${p}u,0u)!=0u){return rc_three_h2_fail(3u);}rc_state[${c+3}u]=1u;return true;
}
fn rc_three_h2_prefix_scatter(){let phase=rc_state[${q+Q.header.stage}u];let kind=rc_state[${q+48}u];let ready=rc_state[${q+59}u];let status=rc_cue_scatter(${q}u,${b+selected*64}u,${p}u,0u);if(phase==2u&&kind==2u&&ready==1u&&status<=1u){for(var n=0u;n<6u;n++){rc_state[${d.helperTorque}u+n]=rc_state[${q+Q.sourceOutput+36}u+n];}for(var n=0u;n<6u;n++){rc_state[${d.helperTorque+6}u+n]=0u;}}}
fn rc_three_h2_prefix_bridge()->bool{
 let q=${q}u;let b=${b}u;
 // Every original no-contact/deferred branch predicate is produced by the
 // just-executed prefix. This does not authorize rigid exclusion or CCD.
 if(rc_state[${c+2}u]!=1u||rc_state[${c+3}u]!=1u||rc_state[q]!=0x52434351u||rc_state[q+1u]!=1u||rc_state[q+2u]!=1u||rc_state[q+4u]!=1u||rc_state[q+5u]!=0u||rc_state[q+6u]!=0u||rc_state[q+7u]!=${frame}||rc_state[q+8u]!=${substep}||rc_state[q+9u]!=0u||rc_state[q+10u]!=2u||rc_state[q+11u]!=0u||rc_state[q+12u]!=1u||rc_state[q+13u]!=1u||rc_state[q+14u]!=5u||rc_state[q+43u]!=0u||rc_state[q+44u]!=0u||rc_state[q+46u]!=0u||rc_state[q+47u]!=7u){return rc_three_h2_fail(4u);}
 for(var role=0u;role<2u;role++){
  let src=q+64u+role*48u;let dst=b+(3u+role)*64u;
  // Canonical force/COM fields are the current native API projection, not t0.
  for(var n=0u;n<64u;n++){rc_state[dst+n]=0u;}
  for(var n=0u;n<13u;n++){rc_state[dst+n]=rc_state[src+n];}for(var n=0u;n<3u;n++){rc_state[dst+13u+n]=rc_state[src+16u+n];rc_state[dst+28u+n]=rc_state[src+29u+n];rc_state[dst+35u+n]=rc_state[src+32u+n];rc_state[dst+38u+n]=rc_state[src+35u+n];rc_state[dst+47u+n]=rc_state[src+32u+n];rc_state[dst+56u+n]=rc_state[src+13u+n];rc_state[dst+59u+n]=rc_state[q+248u+role*3u+n];}
  rc_state[dst+16u]=rc_state[src+19u];rc_state[dst+17u]=rc_state[src+20u];rc_state[dst+18u]=rc_state[src+21u];rc_state[dst+19u]=rc_state[src+20u];rc_state[dst+20u]=rc_state[src+22u];rc_state[dst+21u]=rc_state[src+23u];rc_state[dst+22u]=rc_state[src+21u];rc_state[dst+23u]=rc_state[src+23u];rc_state[dst+24u]=rc_state[src+24u];
  for(var n=0u;n<4u;n++){rc_state[dst+31u+n]=rc_state[src+25u+n];rc_state[dst+42u+n]=rc_state[src+38u+n];}rc_state[dst+62u]=rc_state[q+494u+role*30u+12u];rc_state[dst+63u]=rc_state[q+494u+role*30u+13u];
 }
 return true;
}
fn rc_three_h2_user_changes()->bool{
 if(!rc_three_h2_prefix_bridge()||!rc_scene_begin(0u)){return rc_three_h2_fail(5u);}
 // PhysicsLab source head reset/addForce, then shaft addForce. Existing ball
 // patch queue precedes these accesses; scene drain preserves exact FIFO.
 for(var n=0u;n<2u;n++){let row=${q+Q.mutableCalls}u+n*3u;let member=rc_state[row+2u];if(rc_state[row]!=n||rc_state[row+1u]>1u||member!=rc_state[${q+Q.header.headSlot}u+n]||!rc_scene_api_call(0u,member,rc_state[row+1u]!=0u)){return rc_three_h2_fail(5u);}}
 if(!rc_scene_drain_modified(0u)||!rc_scene_world_begin_pass(0u,${d.energy}u)||!rc_three_tape_preserved()){return rc_three_h2_fail(6u);}
 rc_state[${c+7}u]=rc_state[${S.header.epoch}u];rc_state[${c+3}u]=2u;rc_state[${c+5}u]=1u;return true;
}
`;}
export function buildThreeBallSecondPrefixSource(plan){assertThreeBallSecondPrefixPlan(plan);const d=plan.layout,p=plan.first.programOffsets.cue,q=d.cue,selected=plan.template.seed.sourceOrigin.selectedIndex,c=d.secondControl;
 const globals='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(2) var<storage,read> rc_geometry:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;',run=`fn rc_three_h2_prefix_run(){if(!rc_three_h2_prefix_begin()){return;}for(var n=0u;n<640u;n++){if(rc_state[${c+2}u]==1u){rc_cue_prepare(${q}u,${d.bodies+selected*64}u,${d.others}u,2u,${p}u,0u);rc_cue_numeric(${q}u,${p}u,0u);rc_cue_source(${q}u,${p}u);rc_three_h2_prefix_scatter();}}rc_three_h2_user_changes();}`;
 const source=linkResidentWGSL([globals,generateSceneActivationWGSL(),generateSceneWorldWGSL({includeNumericLibrary:false,includeRosterBridge:false,continuationOnly:true}),generateThreeBallRetainedTapeWGSL(plan.first.tape,{stateBase:d.tape,geometryBase:plan.first.tapeGeometry}),...['prepare','numeric','source','scatter'].map(generateCueOrchestrationWGSL),generateThreeBallSecondPrefixWGSL(plan),run],{entry:'rc_three_h2_prefix_run'}).code;
 return Object.freeze({source,entry:'rc_three_h2_prefix_run',first:buildThreeBallFirstHSource(plan.first),endpoint:plan.capability.endpoint});
}
export async function executeThreeBallSecondPrefixWordsForTest(plan,words,{testOnly=false,secondOnly=false}={}){
 need(testOnly===true&&words instanceof Uint32Array&&words.length===plan.layout.words,'exact-sized test bank');assertThreeBallSecondPrefixPlan(plan);if(!secondOnly)await executeThreeBallFirstHWordsForTest(plan.first,words.subarray(0,plan.first.layout.words),{testOnly:true});const r=owned.get(plan);
 if(!r.compiled){const{compileMicrocodeWGSL}=await import('./microcode-compiler.mjs'),graph=buildThreeBallSecondPrefixSource(plan);r.compiled=compileMicrocodeWGSL(graph.source,{entry:graph.entry,intrinsics:'source-numeric-v1'});}
 const{createMicrocodeVmReferenceForTest}=await import('./microcode-vm.mjs'),{microcodeIntrinsicReference}=await import('../../tests/resident-candidate-microcode-intrinsic-reference.mjs'),code=r.compiled,vm=createMicrocodeVmReferenceForTest({testOnly:true,code:code.instructions,count:1,localWords:code.localWords,stackCapacity:code.callDepth,entryPc:code.entryPc,intrinsics:'source-numeric-v1',intrinsicHandler:microcodeIntrinsicReference,bindings:[words,plan.program,plan.geometry,new Uint32Array(plan.scratchWords),new Uint32Array(1)]});vm.begin();let status=1,chunks=0;while(status===1){status=vm.advance(0,65536);need(++chunks<8192,'bounded prefix transport');}need(status===2,'prefix VM error '+vm.state[3]);return words;
}
export async function executeThreeBallSecondPrefixForTest(plan,options={}){need(options&&Object.keys(options).join(',')==='testOnly'&&options.testOnly===true,'explicit test only; no future states');assertThreeBallSecondPrefixPlan(plan);const words=plan.initialWords.slice();await executeThreeBallSecondPrefixWordsForTest(plan,words,{testOnly:true});const c=plan.layout.secondControl,result=Object.freeze({kind:'resident-three-ball-second-prefix-result-v1',plan,words,sourceIdentity:plan.sourceIdentity,available:words[c+2]===1&&words[c+5]===1,reason:words[c+4],capability:plan.capability});results.set(result,{plan,seal:words.slice()});return result;}
export function assertThreeBallSecondPrefixResult(result,{plan}={}){const r=results.get(result);need(r?.plan===plan,'exact locally sealed result/plan');assertThreeBallSecondPrefixPlan(plan);need(result.words.length===r.seal.length&&result.words.every((x,i)=>x===r.seal[i]),'completed bank mutated');return result;}
