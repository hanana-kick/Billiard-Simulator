// SPDX-License-Identifier: Apache-2.0
// Genuine-three CREATED initial broad/BVH/journal producer. This is an initial
// boundary, not a whole h or a replacement for the unported cue-pre owner.
import {assertThreeBallCreatedOwnerTemplate} from './three-ball-created-owner.mjs';
import {executeThreeBallCreatedInitializationForTest} from './three-ball-created-initialization.mjs';
import {createWorldBroadPrograms,generateWorldBroadWGSL,WORLD_BROAD_LAYOUT as B} from './world-broad.mjs';
import {generateBvhWGSL,unpackBvhState,BVH_LAYOUT as V,BVH_HEADER as VH} from './bvh.mjs';
import {generateContactJournalWGSL,decodeContactJournal,CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {generateContactRosterWGSL} from './contact-roster.mjs';
import {generateSceneActivationWGSL,SCENE_LAYOUT as S} from './scene-activation.mjs';
import {SCENE_INITIALIZATION_LAYOUT as I} from './scene-initialization.mjs';
import {generateNumericLibraryWGSL} from './numeric-program.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {equalData} from '../browser-initial-import/exact-data.mjs';
import {createThreeBallInitialCuePrefixPlan,assertThreeBallInitialCuePrefixPlan,executeThreeBallInitialCuePrefixForTest,assertThreeBallInitialCuePrefixResult} from './three-ball-initial-cue-prefix.mjs';
import {CUE_LAYOUT as Q} from './cue.mjs';
import Guard from '../experimental-cue-rigid-exclusion.js';
import Floor from '../experimental-world-lifecycle.js';
const owned=new WeakMap(),boundaries=new WeakMap(),copy=structuredClone,align=n=>Math.ceil(n/64)*64,key=h=>h.index+':'+h.generation;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball initial broad: '+m),{code:'three-ball-initial-broad-unsupported'});};
const H=Object.freeze({magic:0,version:1,status:2,phase:3,cuePreAdmission:4,exclusionAdmission:5,floorMask:6,evaluations:7,sourceSequence:8,sourceRevision:9});
export const THREE_BALL_INITIAL_BROAD_LAYOUT=Object.freeze({controlWords:32,geometryRows:128,geometryStride:6,header:H});
export const THREE_BALL_INITIAL_BROAD_CAPABILITY=Object.freeze({initialOnly:true,sourcePlanOnly:true,
 boundsBvhJournalProducer:'resident-source-kernels',cuePreBoundary:'resident-source-programs-host-test-only',cuePreSourceProgramProducer:true,
 cuePreResident:false,rigidExclusionResident:false,floorGeometryResident:false,hostExecutionTestOnly:true,
 nativeBoundaryVerified:false,physicalSteps:0,wholeH:false,gpuQualified:false,runtimeIntegrated:false,defaultBackend:false});

function ownerWGSL(d){return `
fn rc_three_broad_fail(c:u32)->bool{rc_state[c+2u]=4u;return false;}
fn rc_three_broad_begin()->bool{
 let c=${d.control}u;let b=${d.broad}u;let v=${d.bvh}u;let j=${d.journal}u;let i=${d.initialization}u;
 if(rc_state[c]!=0x52334250u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+4u]!=1u||rc_state[c+5u]!=1u||rc_state[c+6u]!=7u||rc_state[c+8u]!=0u||rc_state[c+9u]!=0u){return rc_three_broad_fail(c);}
 if(rc_state[${S.header.bodySlots}u]!=22u||rc_state[${S.header.bodyCount}u]!=22u||rc_state[${S.header.phase}u]!=1u||rc_state[${S.header.status}u]!=1u||rc_state[i+${I.header.status}u]!=1u||rc_state[i+${I.header.phase}u]!=1u||rc_state[i+${I.header.numericReady}u]!=7u||rc_state[i+${I.header.colliderCount}u]!=25u){return rc_three_broad_fail(c);}
 if(rc_state[b+${B.header.colliders}u]!=25u||rc_state[b+${B.header.bodies}u]!=6u||rc_state[b+${B.header.freshCount}u]!=3u||rc_state[b+${B.header.first}u]!=1u||rc_state[v+${VH.leaves}u]!=22u||rc_state[v+${VH.first}u]!=1u||rc_state[j+${J.header.colliders}u]!=25u||rc_state[j+${J.header.edges}u]!=3u||rc_state[j+${J.header.sequence}u]!=0u||rc_state[j+${J.header.revision}u]!=0u||rc_state[j+${J.header.cueCount}u]!=3u||rc_state[j+${J.header.cuePresent}u]!=1u){return rc_three_broad_fail(c);}
 if(rc_bvh_set_scratch(v,${d.bvhScratch}u)!=0u){return rc_three_broad_fail(c);}
 rc_world_broad_begin_collision(b,v,j,0u,0xffffffffu);if(rc_state[b]!=0u||rc_state[j]!=0u){return rc_three_broad_fail(c);}rc_state[c+3u]=1u;return true;
}
fn rc_three_broad_gather(){let c=${d.control}u;if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u){return;}rc_world_broad_gather(${d.broad}u,${d.journal}u,0u,0u);}
fn rc_three_broad_evaluate(){let c=${d.control}u;let b=${d.broad}u;if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u){return;}let pending=rc_state[b+${B.header.job}u]==1u&&rc_state[b+${B.header.completion}u]==0u;rc_world_broad_evaluate(b,0u,0u);if(pending){rc_state[c+7u]++;}}
fn rc_three_broad_scatter(){let c=${d.control}u;if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u){return;}rc_world_broad_scatter(${d.broad}u,0u);if(rc_state[${d.broad}u]!=0u){rc_three_broad_fail(c);}}
fn rc_three_broad_commit()->bool{
 let c=${d.control}u;let b=${d.broad}u;let j=${d.journal}u;
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+7u]!=3u){return rc_three_broad_fail(c);}
 rc_world_broad_commit_collision(b,${d.bvh}u,j);if(rc_state[b]!=0u||rc_state[j]!=0u){return rc_three_broad_fail(c);}
 // The explicit external boundary owns three unchanged active floors and
 // source-separated cue shapes. It is NOT an assumed inactive narrowphase.
 let count=rc_state[j+${J.header.edges}u];if(count<3u||count>128u){return rc_three_broad_fail(c);}
 for(var n=0u;n<count;n++){let e=j+${J.edgeOffset}u+n*${J.edgeStride}u;let g=${d.geometry}u+n*6u;let x=rc_state[e];let y=rc_state[e+1u];
  if(x>=25u||y>=25u){return rc_three_broad_fail(c);}let a=j+${J.colliderOffset}u+x*${J.colliderStride}u;let z=j+${J.colliderOffset}u+y*${J.colliderStride}u;
  var isActive=0u;if(n<3u){if(rc_state[e+2u]!=1u||rc_state[e+3u]!=n+1u||rc_state[e+4u]!=0u||rc_state[a+${J.collider.cue}u]!=0u||rc_state[z+${J.collider.cue}u]!=0u){return rc_three_broad_fail(c);}isActive=1u;}else{if(rc_state[e+2u]!=0u||(rc_state[a+${J.collider.cue}u]==0u&&rc_state[z+${J.collider.cue}u]==0u)){return rc_three_broad_fail(c);}}
  rc_state[g]=n;rc_state[g+1u]=rc_state[e+3u];rc_state[g+2u]=rc_state[e+4u];rc_state[g+3u]=isActive;rc_state[g+4u]=1u;rc_state[g+5u]=0u;
 }
 rc_world_broad_narrow(b,j,${d.geometry}u,count);if(rc_state[b]!=0u||rc_state[j]!=0u||rc_state[j+${J.header.phase}u]!=3u||rc_state[j+${J.header.sequence}u]!=1u||rc_state[j+${J.header.operations}u]!=0u||rc_state[j+${J.header.events}u]!=0u){return rc_three_broad_fail(c);}
 rc_state[c+3u]=2u;return true;
}
// Fixed transport work only; each emitted evaluator is outside the source
// walks. Device schedule may use these five entries as separate pipelines.
fn rc_three_broad_run(){if(!rc_three_broad_begin()){return;}for(var n=0u;n<25u;n++){rc_three_broad_gather();rc_three_broad_evaluate();rc_three_broad_scatter();}rc_three_broad_commit();}
`;}
export function createThreeBallInitialBroadPlan(template){
 need(arguments.length===1,'only authenticated original initial template');assertThreeBallCreatedOwnerTemplate(template);
 const cuePrefix=createThreeBallInitialCuePrefixPlan(template),control=align(template.initialWords.length),geometry=control+32,words=align(geometry+128*6),initialWords=new Uint32Array(words);initialWords.set(template.initialWords);initialWords.set([0x52334250,1,1],control);
 const d=Object.freeze({scene:0,initialization:template.registration.layout.initialization,...Object.fromEntries(['bodies','cue','journal','bvh','bvhScratch','broad'].map(k=>[k,template.segments[k].offset])),control,geometry,words});
 const programs=createWorldBroadPrograms(),program=programs.program.slice(),globals='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n@group(0) @binding(1) var<storage,read> rc_program:array<u32>;\n@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;';
 const library=[globals,generateNumericLibraryWGSL({preserveSubnormals:true}),generateBvhWGSL(),generateContactRosterWGSL(),generateContactJournalWGSL(),generateSceneActivationWGSL(),generateWorldBroadWGSL(programs),ownerWGSL(d)].join('\n');
 const source=linkResidentWGSL([library],{entry:'rc_three_broad_run'}).code;
 const stages=['begin','gather','evaluate','scatter','commit'].map(name=>Object.freeze({name,code:linkResidentWGSL([library,`@compute @workgroup_size(1) fn main(){rc_three_broad_${name}();}`]).code,entryPoint:'main'}));
 const commands=Object.freeze([Object.freeze({stage:0}),Object.freeze({stages:Object.freeze([1,2,3]),cycles:25}),Object.freeze({stage:4})]);
 const plan=Object.freeze({kind:'resident-three-ball-initial-broad-plan-v1',sourceIdentity:template.sourceIdentity,template,cuePrefix,layout:d,initialWords,program,scratchWords:programs.scratchWords,source,stages:Object.freeze(stages),commands,capability:THREE_BALL_INITIAL_BROAD_CAPABILITY});
 for(const a of[initialWords,program])Object.preventExtensions(a);owned.set(plan,{initial:initialWords.slice(),program:program.slice(),compiled:null});return plan;
}
export function assertThreeBallInitialBroadPlan(plan){const p=owned.get(plan);need(p,'locally branded original initial broad plan');assertThreeBallCreatedOwnerTemplate(plan.template);assertThreeBallInitialCuePrefixPlan(plan.cuePrefix);for(const[k,want]of[['initialWords',p.initial],['program',p.program]]){let ok=false;try{const a=plan[k];ok=a.length===want.length&&a.every((x,i)=>x===want[i]);}catch{}need(ok,'initial words/program mutated or detached: '+k);}return plan;}

// Current cue values and clocks come only from the sealed numerical producer.
// Original rigid-exclusion/floor owners remain explicit HOST-only admission
// dependencies. No reference cue preparation, future tree or journal is input.
async function prepareBoundary(plan,registered){
 const seed=plan.template.seed,prefix=await executeThreeBallInitialCuePrefixForTest(plan.cuePrefix,{testOnly:true});assertThreeBallInitialCuePrefixResult(prefix,{template:plan.template});
 const q=prefix.layout.cue,body=prefix.layout.bodies,a=prefix.words,f=new Float32Array(a.buffer),init=plan.template.registration.layout.numericOutputs;
 equalData(Array.from(a.subarray(q+Q.initialOutputs,q+Q.initialOutputs+90)),Array.from(registered.words.subarray(init,init+90)),'independent resident numeric registration agreement');
 const preSolveBodies={};for(const[role,i]of[['shaft',0],['head',1]]){
  const p=q+Q.joint+i*48,current=copy(seed.cueInitial.cue[role]);for(const[name,offset,n]of[['linear',0,3],['angular',3,3],['translation',6,3],['rotation',9,4],['localCom',13,3],['invMass',16,3],['invInertia',19,6],['principalFrame',25,4],['invPrincipalInertia',29,3],['userForce',32,3],['userTorque',35,3]])current[name]=Array.from(f.slice(p+offset,p+offset+n));
  current.worldCom=Array.from(f.slice(body+(3+i)*64+59,body+(3+i)*64+62));current.linearDamping=f[p+38];current.angularDamping=f[p+39];current.gyroscopic=f[p+40]!==0;current.allowFastRotation=f[p+41]!==0;preSolveBodies[role]=current;
 }
 const token={},stages=[],claimed=[],own=s=>(stages.push(s),s),claim=s=>(s.claim(token),claimed.push(s),s);
 try{
  const guard=own(Guard.createReferenceGuard({created:seed.cueInitial.sourceCreation.created,roles:seed.cueInitial.sourceCreation.roles,sceneRegistry:seed.sceneRegistry}));
  const exclusion=await guard.check({cue:preSolveBodies,balls:seed.balls.map(b=>({body:b.body,translation:b.state.translation,rotation:b.state.rotation,radius:b.radius}))});need(exclusion.admitted===true&&exclusion.pairs===54,'source-separated exact native cue-filter roster');
  for(const ball of seed.balls){const e=seed.contactGraphSeed.edges.find(e=>key(e.collider2)===key(ball.collider));need(e?.active===true,'source initial active floor');if(ball.state.sleeping){need(ball.state.topology.active===true,'sleeping source floor');continue;}const floor=claim(own(Floor.createReferenceSettledContactStage(ball.state))),p=await floor.prepare(copy(ball.state),token);need(p.state.topology.active===true,'source floor geometry must remain active');}
  const metadata={initialization:copy(registered.initialized),preSolveBodies,sourceH:prefix.clock.h,simulationTime:prefix.clock.time,mutableBodyCalls:copy(prefix.mutableBodyCalls),jointSolved:false,jointResult:null,cuePresent:a[q+Q.header.present]!==0,touching:a[q+Q.header.active]!==0,birth:a[q+43]!==0,separation:a[q+44]!==0,ballStrongWake:a[q+46]!==0,ballMutableAccess:a[q+45]!==0};
  need(metadata.cuePresent&&!metadata.touching&&a[q+Q.header.needsSolve]===1&&a[q+Q.header.removedCount]===0,'actual numerical deferred initial cue boundary');
  const receipt=Object.freeze({kind:'owned-three-ball-cue-pre-boundary-host-test-only',sourceIdentity:plan.sourceIdentity});boundaries.set(receipt,{plan,prefix,registered:copy(registered.initialized),cuePreResident:false,cuePreSourceProgramProducer:true,numberProfile:'original-js-number-v1',metadata,exclusion:copy(exclusion),floorMask:7});return receipt;
 }finally{for(const s of claimed.reverse()){s.abort(token);s.release(token);}for(const s of stages.reverse())s.dispose();}
}
function installBoundary(plan,receipt,words){
 const b=boundaries.get(receipt);need(b?.plan===plan&&receipt.sourceIdentity===plan.sourceIdentity,'current locally owned cue-pre boundary');assertThreeBallInitialCuePrefixResult(b.prefix,{template:plan.template});
 // Copy only the numerical producer-owned ranges, never its expected oracle or
 // untouched registration/control areas. The actual cue lifecycle clock/frame
 // now accompanies the already-generated current canonical cue rows.
 const d=b.prefix.layout;words.set(b.prefix.words.subarray(d.cue,d.cue+d.cueWords),plan.layout.cue);words.set(b.prefix.words.subarray(d.bodies+3*64,d.bodies+5*64),plan.layout.bodies+3*64);
 words.set([1,1,b.floorMask],plan.layout.control+H.cuePreAdmission);return b;
}
export async function executeThreeBallInitialBroadForTest(plan,options={}){
 need(options&&Object.keys(options).join(',')==='testOnly'&&options.testOnly===true,'explicit testOnly:true only; no receipt/state/output injection');assertThreeBallInitialBroadPlan(plan);
 const registered=executeThreeBallCreatedInitializationForTest(plan.template.registration,{testOnly:true}),receipt=await prepareBoundary(plan,registered);
 const words=plan.initialWords.slice();words.set(registered.words);const boundary=installBoundary(plan,receipt,words);equalData(registered.initialized,boundary.registered,'independent current source registration');
 const before=words.slice();await executeThreeBallInitialBroadWordsForTest(plan,words,{testOnly:true});
 need(words[plan.layout.control+H.status]===1&&words[plan.layout.control+H.phase]===2,'resident source producer rejected: '+[words[plan.layout.broad],words[plan.layout.bvh+18],words[plan.layout.journal]].join('/'));
 return{kind:'resident-three-ball-initial-broad-host-test-result-v1',sourceIdentity:plan.sourceIdentity,capability:THREE_BALL_INITIAL_BROAD_CAPABILITY,words,before,boundary:copy((({plan,prefix,...x})=>x)(boundary)),bvh:unpackBvhState(words.subarray(plan.layout.bvh,plan.layout.bvh+V.words)),journal:decodeContactJournal(words.subarray(plan.layout.journal,plan.layout.journal+J.words)),broad:words.slice(plan.layout.broad,plan.layout.broad+B.words)};
}
/** Low-level TEST corruption harness. No ownership or production receipt is
 * granted by this function; only exact emitted source execution is exposed. */
export async function executeThreeBallInitialBroadWordsForTest(plan,words,{testOnly=false}={}){
 need(testOnly===true&&words instanceof Uint32Array&&words.length===plan.layout.words,'explicit exact-sized test words');assertThreeBallInitialBroadPlan(plan);
 const p=owned.get(plan),{compileMicrocodeWGSL}=await import('./microcode-compiler.mjs'),{createMicrocodeVmReferenceForTest}=await import('./microcode-vm.mjs');
 p.compiled??=compileMicrocodeWGSL(plan.source,{entry:'rc_three_broad_run'});const a=p.compiled;
 const vm=createMicrocodeVmReferenceForTest({testOnly:true,code:a.instructions,count:1,localWords:a.localWords,stackCapacity:a.callDepth,entryPc:a.entryPc,bindings:[words,plan.program,new Uint32Array(1),new Uint32Array(plan.scratchWords),new Uint32Array(1)]});vm.begin();let status=1,steps=0;
 while(status===1){status=vm.advance(0,65536);need(++steps<=4096,'test VM cap, not a source physics cap');}need(status===2,'source WGSL test VM failure status '+status+' error '+vm.state[3]);return words;
}
