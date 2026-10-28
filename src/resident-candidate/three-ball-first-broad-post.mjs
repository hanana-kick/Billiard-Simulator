// SPDX-License-Identifier: Apache-2.0
// Genuine-three first inactive-while-cue postSolve BVH/journal ownership.
// Partial owner seal only: no cue/application clock or whole-h publication.
import {assertThreeBallFirstPostPlan,executeThreeBallFirstPostForTest,executeThreeBallFirstPostPhysicalForTest,assertThreeBallFirstPostPhysicalResult,THREE_BALL_FIRST_POST_HEADER as P} from './three-ball-first-post.mjs';
import {assertThreeBallInitialInactiveWhileCueReceipt,THREE_BALL_FIRST_SPHERE_HEADER as C} from './three-ball-first-sphere.mjs';
import {THREE_BALL_FIRST_CUE_HEADER as Q} from './three-ball-first-cue.mjs';
import {assertThreeBallInitialBroadPlan} from './three-ball-initial-broad.mjs';
import {createWorldBroadPrograms,generateWorldBroadWGSL,WORLD_BROAD_LAYOUT as B} from './world-broad.mjs';
import {generateBvhWGSL,unpackBvhState,BVH_LAYOUT as V} from './bvh.mjs';
import {generateContactJournalWGSL,decodeContactJournal,CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {generateContactRosterWGSL,CONTACT_ROSTER_LAYOUT as R} from './contact-roster.mjs';
import {generateSceneActivationWGSL,SCENE_LAYOUT as S} from './scene-activation.mjs';
import {THREE_BALL_SOLVER_LAYOUT as T} from './three-ball-solver.mjs';
import {generateNumericLibraryWGSL} from './numeric-program.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {createThreeBallFirstFinalMassPlan,assertThreeBallFirstFinalMassPlan,generateThreeBallFirstFinalMassWGSL} from './three-ball-first-final-mass.mjs';
const owned=new WeakMap(),receipts=new WeakMap(),align=n=>Math.ceil(n/64)*64;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball first broad post: '+m),{code:'three-ball-first-broad-post-unsupported'});};
export const THREE_BALL_FIRST_BROAD_POST_CAPABILITY=Object.freeze({sourcePlanOnly:true,hostExecutionTestOnly:true,
 initialInactiveWhileCueOnly:true,generalCcd:false,actualSpheres:3,actualCueDynamics:2,
 currentPoseSource:'owned-completed-cue-and-sphere-kernels',pendingGraphSource:'resident-initial-broad-producer',
 bvhPostSolve:true,journalOwnerSeal:true,worldCommit:false,cueClockCommit:false,applicationClockCommit:false,
 nativeBoundaryVerified:false,wholeH:false,physicalSteps:0,gpuQualified:false,runtimeIntegrated:false,defaultBackend:false});
export const THREE_BALL_FIRST_PHYSICAL_BROAD_POST_CAPABILITY=Object.freeze({...THREE_BALL_FIRST_BROAD_POST_CAPABILITY,inputBoundary:'all-physical-postchecks-before-application',applicationAlreadyApplied:false});
export const THREE_BALL_FIRST_FINAL_MASS_BROAD_POST_CAPABILITY=Object.freeze({...THREE_BALL_FIRST_PHYSICAL_BROAD_POST_CAPABILITY,finalMass:true,finalMassOrder:'after-each-awake-body-collider-harvest-before-bvh-set-aabbs'});
export const THREE_BALL_FIRST_PRODUCED_ROSTER_FINAL_MASS_BROAD_POST_CAPABILITY=Object.freeze({...THREE_BALL_FIRST_FINAL_MASS_BROAD_POST_CAPABILITY,producedRoster:true,rosterLifecycle:'already-applied-current-journal',legacyHostExecutor:false});
export const THREE_BALL_FIRST_BROAD_POST_HEADER=Object.freeze({magic:0,version:1,status:2,phase:3,evaluations:4,updateCount:5,completed:6,epoch:7,profile:8,massPending:9,massSceneSlot:10,massBodies:11});

function ownerWGSL(d){return `
fn rc_three_broad_post_fail()->bool{rc_state[${d.control+2}u]=4u;return false;}
// This is an acknowledgement of the ALREADY EXECUTED distinct three-roster
// lifecycle, not a fabricated applied flag or a second roster transaction.
// The admitted profile has no transitions; every identity, lifetime, current
// sequence/epoch, body registry and ordered awake list must agree first.
fn rc_three_broad_post_roster_valid()->bool{
 let j=${d.journal}u;let r=${d.roster}u;let t=${d.solver}u;
 if(rc_state[j]!=0u||rc_state[j+${J.header.phase}u]!=3u||rc_state[j+${J.header.colliders}u]!=25u||rc_state[j+${J.header.edges}u]!=3u||rc_state[j+${J.header.sequence}u]!=1u||rc_state[j+${J.header.revision}u]!=0u||rc_state[j+${J.header.fromSequence}u]!=0u||rc_state[j+${J.header.fromRevision}u]!=0u||rc_state[j+${J.header.nextLo}u]!=4u||rc_state[j+${J.header.nextHi}u]!=0u||rc_state[j+${J.header.changes}u]!=0u||rc_state[j+${J.header.operations}u]!=0u||rc_state[j+${J.header.events}u]!=0u||rc_state[j+${J.header.broad}u]!=0u||rc_state[j+${J.header.removed}u]!=0u||rc_state[j+${J.header.birthPending}u]!=0u||rc_state[j+${J.header.rosterApplied}u]!=${d.producedRoster?1:0}u){return false;}
 if(rc_state[r+${R.header.status}u]!=0u||rc_state[r+${R.header.phase}u]!=0u||rc_state[r+${R.header.edgeCount}u]!=3u||rc_state[r+${R.header.bodyCount}u]!=22u||rc_state[r+${R.header.sequence}u]!=1u||rc_state[r+${R.header.revision}u]!=0u||rc_state[r+${R.header.nextSequence}u]!=1u||rc_state[r+${R.header.nextRevision}u]!=0u||rc_state[r+${R.header.nextLifeLo}u]!=4u||rc_state[r+${R.header.nextLifeHi}u]!=0u||rc_state[r+${R.header.valid}u]!=1u||rc_state[r+${R.header.activeEpoch}u]!=rc_state[${S.header.epoch}u]||rc_state[r+${R.header.graphEpoch}u]!=rc_state[r+${R.header.activeEpoch}u]||rc_state[r+${R.header.graphMultibodyEpoch}u]!=rc_state[r+${R.header.multibodyEpoch}u]){return false;}
 if(rc_state[t+${T.header.status}u]!=0u||rc_state[t+${T.header.phase}u]!=2u||rc_state[t+${T.header.journalSequence}u]!=1u||rc_state[t+${T.header.journalRevision}u]!=0u||rc_state[t+${T.header.activeEpoch}u]!=rc_state[${S.header.epoch}u]){return false;}
 for(var n=0u;n<22u;n++){if(!rc_scene_valid_body(0u,n)){return false;}let b=rc_scene_bp(0u,n);let at=rc_body(r,rc_state[b+${S.body.index}u],rc_state[b+${S.body.generation}u]);if(at==0xffffffffu||rc_state[r+at+2u]!=rc_state[b+${S.body.dynamic}u]){return false;}}
 let awake=rc_state[${S.header.awake}u];var count=0u;if(awake!=0xffffffffu){let chunk=rc_scene_cp(0u,awake);count=rc_state[chunk+1u];if(count>5u||rc_state[r+${R.header.awakeCount}u]!=count){return false;}for(var n=0u;n<count;n++){let b=rc_scene_bp(0u,rc_state[chunk+2u+n]);let member=rc_state[r+${R.awakeOffset}u+n];if(member>=22u){return false;}let q=r+${R.bodyOffset}u+member*${R.bodyStride}u;if(rc_state[q]!=rc_state[b+${S.body.index}u]||rc_state[q+1u]!=rc_state[b+${S.body.generation}u]||rc_state[q+3u]!=rc_state[b+${S.body.activeIndex}u]||rc_state[b+${S.body.activation+4}u]!=0u){return false;}}}if(count!=rc_state[r+${R.header.awakeCount}u]){return false;}
 for(var n=0u;n<3u;n++){let e=j+${J.edgeOffset}u+n*${J.edgeStride}u;let x=rc_state[e];let y=rc_state[e+1u];if(x>=25u||y>=25u||rc_state[e+2u]!=1u||rc_state[e+3u]!=n+1u||rc_state[e+4u]!=0u){return false;}let a=j+${J.colliderOffset}u+x*${J.colliderStride}u;let b=j+${J.colliderOffset}u+y*${J.colliderStride}u;let q=r+${R.edgeOffset}u+n*${R.edgeStride}u;
  if(rc_state[a+${J.collider.live}u]!=1u||rc_state[b+${J.collider.live}u]!=1u||rc_state[a+${J.collider.cue}u]!=0u||rc_state[b+${J.collider.cue}u]!=0u){return false;}
  for(var k=0u;k<2u;k++){if(rc_state[q+k]!=rc_state[a+k]||rc_state[q+2u+k]!=rc_state[b+k]||rc_state[q+4u+k]!=rc_state[a+2u+k]||rc_state[q+6u+k]!=rc_state[b+2u+k]){return false;}}
  if(rc_state[q+${R.edge.active}u]!=1u||rc_state[q+${R.edge.lifeLo}u]!=rc_state[e+3u]||rc_state[q+${R.edge.lifeHi}u]!=0u){return false;}
 }return true;
}
fn rc_three_broad_post_begin()->bool{
 let c=${d.control}u;let b=${d.broad}u;let v=${d.bvh}u;let p=${d.postControl}u;let q=${d.cueControl}u;let s=${d.sphereControl}u;
 if(rc_state[c]!=0x52334243u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+6u]!=0u||rc_state[c+8u]!=${d.producedRoster?3:d.finalMass?2:d.physical?1:0}u||rc_state[${d.initialBroadControl+2}u]!=1u||rc_state[${d.initialBroadControl+3}u]!=2u){return rc_three_broad_post_fail();}
 if(rc_state[${S.header.status}u]!=1u||rc_state[${S.header.phase}u]!=${d.physical?6:3}u||rc_state[${S.header.bodyCount}u]!=22u||rc_state[p+${P.status}u]!=1u||${d.physical?`rc_state[p+${P.phase}u]!=1u||rc_state[p+${P.cursor}u]!=0u||rc_state[p+${P.patchMask}u]!=0u||rc_state[p+${P.completed}u]!=0u||rc_state[p+${P.fatMask}u]!=rc_state[p+${P.requiredMask}u]`:`rc_state[p+${P.phase}u]!=2u||rc_state[p+${P.completed}u]!=1u`}||rc_state[s+${C.status}u]!=1u||rc_state[s+${C.phase}u]!=2u||rc_state[s+${C.completed}u]!=1u||rc_state[s+${C.awakeMask}u]!=rc_state[s+${C.postMask}u]||rc_state[q+${Q.status}u]!=1u||rc_state[q+${Q.phase}u]!=3u||rc_state[q+${Q.completed}u]!=1u||rc_state[q+${Q.ccdMask}u]!=3u){return rc_three_broad_post_fail();}
 if(rc_state[v+18u]!=0u||rc_state[v+1u]!=25u||rc_state[v+12u]!=0u||rc_state[b+${B.header.colliders}u]!=25u||rc_state[b+${B.header.bodies}u]!=6u||rc_state[b+${B.header.first}u]!=0u||!rc_three_broad_post_roster_valid()){return rc_three_broad_post_fail();}
 ${d.finalMass?`if(rc_state[c+9u]!=0u||rc_state[c+11u]!=0u||rc_state[${d.massState+2}u]!=1u||rc_state[${d.massState+3}u]!=0u||rc_state[${d.massState+4}u]!=0u||rc_state[${d.massState+5}u]!=0u){return rc_three_broad_post_fail();}`:''}
 rc_state[c+7u]=rc_state[${S.header.epoch}u];rc_world_broad_begin_post(b,${d.journal}u,0u);if(rc_state[b]!=0u){return rc_three_broad_post_fail();}rc_state[c+5u]=rc_state[b+${B.header.updateCount}u];rc_state[c+3u]=1u;return true;
}
fn rc_three_broad_post_gather(){let c=${d.control}u;if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u){return;}${d.finalMass?`if(rc_state[c+9u]!=0u){rc_three_broad_post_fail();return;}`:''}rc_world_broad_gather(${d.broad}u,${d.journal}u,0u,0u);}
fn rc_three_broad_post_evaluate(){let c=${d.control}u;let b=${d.broad}u;if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u){return;}let pending=rc_state[b+${B.header.job}u]==1u&&rc_state[b+${B.header.completion}u]==0u;rc_world_broad_evaluate(b,0u,0u);if(pending){rc_state[c+4u]++;}}
fn rc_three_broad_post_scatter(){let c=${d.control}u;if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u){return;}${d.finalMass?`
 // Native advance_to_final_positions: harvest this parent's LAST collider,
 // refresh its world mass properties, then advance to the next awake body.
 // Inspect original descriptor slots BEFORE generic scatter replaces them
 // with actual collider indices (the two need not agree after recycling).
 let b=${d.broad}u;var bodyEnd=false;var member=0xffffffffu;
 if(rc_state[c+9u]!=0u){rc_three_broad_post_fail();return;}
 if(rc_state[b]==0u&&rc_state[b+19u]==1u&&rc_state[b+20u]<rc_state[b+7u]){
  let row=rc_state[b+20u];let slot=rc_state[b+704u+row*8u];
  if(slot>=rc_state[b+3u]){rc_three_broad_post_fail();return;}
  let binding=rc_state[rc_wb_c(b,slot)+2u];if(binding>=rc_state[b+4u]){rc_three_broad_post_fail();return;}
  member=rc_state[rc_wb_body(b,binding)+3u];bodyEnd=row+1u==rc_state[b+7u];
  if(!bodyEnd){let nextSlot=rc_state[b+704u+(row+1u)*8u];if(nextSlot>=rc_state[b+3u]){rc_three_broad_post_fail();return;}bodyEnd=rc_state[rc_wb_c(b,nextSlot)+2u]!=binding;}
 }
 `:''}rc_world_broad_scatter(${d.broad}u,0u);if(rc_state[${d.broad}u]!=0u){rc_three_broad_post_fail();return;}${d.finalMass?`if(bodyEnd){rc_state[c+9u]=1u;rc_state[c+10u]=member;}`:''}}
${d.finalMass?`
fn rc_three_broad_post_mass_gather(){let c=${d.control}u;if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+9u]==0u){return;}if(!rc_three_final_mass_gather(rc_state[c+10u])){rc_three_broad_post_fail();}}
fn rc_three_broad_post_mass_evaluate(){let c=${d.control}u;if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+9u]==0u){return;}if(!rc_three_final_mass_evaluate()){rc_three_broad_post_fail();}}
fn rc_three_broad_post_mass_scatter(){let c=${d.control}u;if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+9u]==0u){return;}if(!rc_three_final_mass_scatter(rc_state[c+10u])){rc_three_broad_post_fail();return;}rc_state[c+9u]=0u;rc_state[c+11u]++;}
`:''}
fn rc_three_broad_post_finish()->bool{
 let c=${d.control}u;let b=${d.broad}u;let j=${d.journal}u;
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=rc_state[c+5u]||rc_state[c+7u]!=rc_state[${S.header.epoch}u]||!rc_three_broad_post_roster_valid()){return rc_three_broad_post_fail();}
 ${d.finalMass?`if(rc_state[c+9u]!=0u||!rc_three_final_mass_finish()||rc_state[c+11u]!=rc_state[${d.massState+4}u]){return rc_three_broad_post_fail();}`:''}
 rc_world_broad_commit_post(b,${d.bvh}u);if(rc_state[b]!=0u){return rc_three_broad_post_fail();}
 ${d.producedRoster?'':`rc_state[j+${J.header.rosterApplied}u]=1u;`}rc_world_broad_finish(b,j);if(rc_state[b]!=0u||rc_state[b+${B.header.phase}u]!=0u||rc_state[j]!=0u||rc_state[j+${J.header.phase}u]!=0u){return rc_three_broad_post_fail();}
 rc_state[c+3u]=2u;rc_state[c+6u]=1u;return true;
}
fn rc_three_broad_post_run(){if(!rc_three_broad_post_begin()){return;}for(var n=0u;n<25u;n++){rc_three_broad_post_gather();rc_three_broad_post_evaluate();rc_three_broad_post_scatter();${d.finalMass?'rc_three_broad_post_mass_gather();rc_three_broad_post_mass_evaluate();rc_three_broad_post_mass_scatter();':''}}rc_three_broad_post_finish();}
`;}

export function createThreeBallFirstBroadPostPlan(post){need(arguments.length===1,'only locally branded first-post plan');return createPlan(post,false);}
export function createThreeBallFirstPhysicalBroadPostPlan(post){need(arguments.length===1,'only locally branded first-post plan');return createPlan(post,true);}
export function createThreeBallFirstFinalMassBroadPostPlan(post){need(arguments.length===1,'only locally branded first-post plan');return createPlan(post,true,true);}
/** Distinct same-bank producer profile. Never rebrands the legacy HOST roster. */
export function createThreeBallFirstProducedRosterFinalMassBroadPostPlan(post){need(arguments.length===1,'only locally branded first-post plan');return createPlan(post,true,true,true);}
function createPlan(post,physical,finalMass=false,producedRoster=false){
 assertThreeBallFirstPostPlan(post);
 const first=post.sphere.cue.numerical.first,initialBroad=first.initialBroad;assertThreeBallInitialBroadPlan(initialBroad);
 const control=align(post.initialWords.length),massState=control+32,massPlan=finalMass?createThreeBallFirstFinalMassPlan(first.template):null,initialWords=new Uint32Array(massState+(massPlan?.initialWords.length??0));initialWords.set(post.initialWords);initialWords.set([0x52334243,1,1],control);initialWords[control+8]=producedRoster?3:finalMass?2:+physical;if(massPlan)initialWords.set(massPlan.initialWords,massState);
 const d=Object.freeze({...post.layout,...Object.fromEntries(['broad','bvh','bvhScratch'].map(k=>[k,initialBroad.layout[k]])),initialBroadControl:initialBroad.layout.control,control,physical,finalMass,...(producedRoster?{producedRoster:true}:{}),massState,words:initialWords.length});
 const programs=createWorldBroadPrograms(),program=new Uint32Array(programs.program.length+(massPlan?.program.length??0));program.set(programs.program);if(massPlan)program.set(massPlan.program,programs.program.length);const globals='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n@group(0) @binding(1) var<storage,read> rc_program:array<u32>;\n@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;';
 const library=[globals,generateNumericLibraryWGSL({preserveSubnormals:true}),generateBvhWGSL(),generateContactRosterWGSL(),generateContactJournalWGSL(),generateSceneActivationWGSL(),generateWorldBroadWGSL(programs),massPlan?generateThreeBallFirstFinalMassWGSL(massPlan,{stateBase:massState,programBase:programs.program.length,scratchBase:0}):'',ownerWGSL(d)].join('\n');
 const source=linkResidentWGSL([library],{entry:'rc_three_broad_post_run'}).code,stages=Object.freeze(['begin','gather','evaluate','scatter',...(finalMass?['mass_gather','mass_evaluate','mass_scatter']:[]),'finish'].map(name=>Object.freeze({name,code:linkResidentWGSL([library,`@compute @workgroup_size(1) fn main(){rc_three_broad_post_${name}();}`]).code,entryPoint:'main'}))),commands=Object.freeze([Object.freeze({stage:0}),Object.freeze({stages:Object.freeze(finalMass?[1,2,3,4,5,6]:[1,2,3]),cycles:25}),Object.freeze({stage:finalMass?7:4})]);
 const plan=Object.freeze({kind:producedRoster?'resident-three-ball-first-produced-roster-final-mass-broad-post-plan-v1':finalMass?'resident-three-ball-first-final-mass-broad-post-plan-v1':physical?'resident-three-ball-first-physical-broad-post-plan-v1':'resident-three-ball-first-broad-post-plan-v1',physical,finalMass,...(producedRoster?{producedRoster:true}:{}),massPlan,post,template:first.template,sourceIdentity:post.sourceIdentity,layout:d,initialWords,program,scratchWords:Math.max(programs.scratchWords,massPlan?.scratchWords??0),source,stages,commands,capability:producedRoster?THREE_BALL_FIRST_PRODUCED_ROSTER_FINAL_MASS_BROAD_POST_CAPABILITY:finalMass?THREE_BALL_FIRST_FINAL_MASS_BROAD_POST_CAPABILITY:physical?THREE_BALL_FIRST_PHYSICAL_BROAD_POST_CAPABILITY:THREE_BALL_FIRST_BROAD_POST_CAPABILITY});
 for(const a of[initialWords,program])Object.preventExtensions(a);owned.set(plan,{initial:initialWords.slice(),program:program.slice(),compiled:null});return plan;
}
export function assertThreeBallFirstBroadPostPlan(plan){const p=owned.get(plan);need(p,'locally owned broad post plan');assertThreeBallFirstPostPlan(plan.post);if(plan.massPlan)assertThreeBallFirstFinalMassPlan(plan.massPlan);for(const[k,want]of[['initialWords',p.initial],['program',p.program]]){let ok=false;try{const a=plan[k];ok=a.length===want.length&&a.every((x,i)=>x===want[i]);}catch{}need(ok,'initial words/program mutated or detached: '+k);}return plan;}
export function assertThreeBallFirstProducedRosterFinalMassBroadPostPlan(plan){assertThreeBallFirstBroadPostPlan(plan);need(plan.producedRoster===true&&plan.finalMass===true&&plan.physical===true,'distinct produced-roster final-mass profile');return plan;}
export async function executeThreeBallFirstFinalMassBroadPostForTest(plan,options={}){assertThreeBallFirstBroadPostPlan(plan);need(plan.finalMass===true,'distinct final-mass plan required');return executeThreeBallFirstBroadPostForTest(plan,options);}
export async function executeThreeBallFirstPhysicalBroadPostForTest(plan,options={}){assertThreeBallFirstBroadPostPlan(plan);need(plan.physical===true,'distinct physical-pre-application plan required');return executeThreeBallFirstBroadPostForTest(plan,options);}
export async function executeThreeBallFirstBroadPostForTest(plan,options={}){
 need(options&&Object.keys(options).join(',')==='testOnly'&&options.testOnly===true,'explicit testOnly only; no pending/result/pose/queue injection');assertThreeBallFirstBroadPostPlan(plan);need(plan.producedRoster!==true,'produced-roster profile requires actual same-bank producer; legacy HOST oracle executor unavailable');
 const post=await (plan.physical?executeThreeBallFirstPostPhysicalForTest:executeThreeBallFirstPostForTest)(plan.post,{testOnly:true});if(!post.available)return{kind:'resident-three-ball-first-broad-post-host-test-result-v1',available:false,reason:post.reason,post,capability:plan.capability};
 if(plan.physical)assertThreeBallFirstPostPhysicalResult(post,{plan:plan.post});assertThreeBallInitialInactiveWhileCueReceipt(post.receipt);const words=plan.initialWords.slice();words.set(post.words);const before=words.slice();await executeThreeBallFirstBroadPostWordsForTest(plan,words,{testOnly:true});const d=plan.layout;
 need(words[d.control+2]===1&&words[d.control+3]===2&&words[d.control+6]===1,'resident post owner rejected '+[words[d.broad],words[d.bvh+18],words[d.journal]].join('/'));
 const receipt=Object.freeze({kind:plan.physical?'owned-three-ball-physical-broad-journal-seal-host-test-only':'owned-three-ball-first-broad-journal-seal-host-test-only',sourceIdentity:plan.sourceIdentity,physicalPreApplication:plan.physical,finalMass:plan.finalMass,worldCommitted:false,generalCcd:false,nativeParity:false});
 const result=Object.freeze({kind:'resident-three-ball-first-broad-post-host-test-result-v1',available:true,sourceIdentity:plan.sourceIdentity,capability:plan.capability,plan,words,before,post,receipt,bvh:unpackBvhState(words.subarray(d.bvh,d.bvh+V.words)),journal:decodeContactJournal(words.subarray(d.journal,d.journal+J.words)),broad:words.slice(d.broad,d.broad+B.words)});receipts.set(receipt,{plan,result,words,sealed:words.slice()});return result;
}
export function assertThreeBallFirstBroadPostReceipt(receipt){need(arguments.length===1,'only local sealed owner receipt');const r=receipts.get(receipt);need(r,'local completed initial broad/journal owner, not whole-h authority');assertThreeBallFirstBroadPostPlan(r.plan);if(r.plan.physical)assertThreeBallFirstPostPhysicalResult(r.result.post,{plan:r.plan.post});let ok=false;try{ok=r.words.length===r.sealed.length&&r.words.every((x,i)=>x===r.sealed[i]);}catch{}need(ok,'completed broad/journal bank mutated or detached');return receipt;}
export function assertThreeBallFirstBroadPostResult(result,options){need(arguments.length===2&&options&&Object.keys(options).join(',')==='plan','exact result and locally owned plan');assertThreeBallFirstBroadPostReceipt(result?.receipt);const r=receipts.get(result.receipt);need(r.result===result&&r.plan===options.plan,'original result identity and plan, not copied/hash-only state');return result;}
export function assertThreeBallFirstPhysicalBroadPostResult(result,options){assertThreeBallFirstBroadPostResult(result,options);need(result.plan.physical===true&&result.receipt.physicalPreApplication===true,'distinct physical-pre-application result required');return result;}
export function assertThreeBallFirstFinalMassBroadPostResult(result,options){assertThreeBallFirstPhysicalBroadPostResult(result,options);need(result.plan.finalMass===true&&result.receipt.finalMass===true,'distinct native final-mass boundary required');return result;}
/** Exact emitted-source HOST corruption harness, never a runtime fallback. */
export async function executeThreeBallFirstBroadPostWordsForTest(plan,words,{testOnly=false}={}){
 need(testOnly===true&&words instanceof Uint32Array&&words.length===plan.layout.words,'explicit exact-sized test words');assertThreeBallFirstBroadPostPlan(plan);
 const p=owned.get(plan),{compileMicrocodeWGSL}=await import('./microcode-compiler.mjs'),{createMicrocodeVmReferenceForTest}=await import('./microcode-vm.mjs');p.compiled??=compileMicrocodeWGSL(plan.source,{entry:'rc_three_broad_post_run'});const a=p.compiled;
 const vm=createMicrocodeVmReferenceForTest({testOnly:true,code:a.instructions,count:1,localWords:a.localWords,stackCapacity:a.callDepth,entryPc:a.entryPc,bindings:[words,plan.program,new Uint32Array(1),new Uint32Array(plan.scratchWords),new Uint32Array(1)]});vm.begin();let status=1,chunks=0;
 while(status===1){status=vm.advance(0,65536);need(++chunks<=4096,'test transport instruction cap, not a physics cap');}need(status===2,'source WGSL test VM status '+status+' error '+vm.state[3]);return words;
}
