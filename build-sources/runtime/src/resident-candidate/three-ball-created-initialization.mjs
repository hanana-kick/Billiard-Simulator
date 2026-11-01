// SPDX-License-Identifier: Apache-2.0
// One genuine-three CREATED -> user-changes/pre-collision source plan only.
// HOST execution is explicitly test-only; no physics step, runtime or GPU owner.
import {assertThreeBallCreatedRegistration,threeBallCreatedNumericInputs} from './three-ball-host-admission.mjs';
import {packThreeBallCreatedControlLayout,assertThreeBallCreatedControlLayout} from './three-ball-created-control-layout.mjs';
import {SCENE_LAYOUT as S,generateSceneActivationWGSL} from './scene-activation.mjs';
import {SCENE_INITIALIZATION_LAYOUT as I,generateSceneInitializationWGSL,sceneInitializationTestKernels,decodeSceneInitialization} from './scene-initialization.mjs';
import {compileGraph,executeLowered} from './numeric-program.mjs';
import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import * as C from '../experimental-cue-initialization.js';
const Cue=C.default??globalThis.LabCueInitializationExperimental,owned=new WeakMap(),copy=structuredClone;
const need=(ok,message)=>{if(!ok)throw Object.assign(new RangeError('Three-ball created initialization: '+message),{code:'three-ball-created-initialization-unsupported'});};
export const THREE_BALL_INITIALIZATION_CAPABILITY=Object.freeze({sourcePlanOnly:true,createdBoundaryOnly:true,preCollisionOnly:true,
 hostExecutionTestOnly:true,nativeRegistrationBoundaryVerified:false,nativeMassComparisonRequired:true,gpuQualified:false,
 physicalSteps:0,collisionPrepared:false,wholeH:false,wholeShot:false,rawCandidateCreation:false,runtimeIntegrated:false,defaultBackend:false});
const layout=Object.freeze({scene:0,initialization:S.words,numericInputs:S.words+I.words,numericOutputs:S.words+I.words+120,completion:S.words+I.words+210,words:S.words+I.words+211});

// Same mechanical packing as cue-orchestration.initialPack. The original
// source graph/validator/compiler are reused, not rewritten or parameterized.
function packNumeric(input){
 const s=Cue.validate(input),a=new Float32Array(40);a.set(s.translation);a.set(s.rotation,3);a.set(s.localCom,7);a[10]=s.localInvMass;a.set(s.invPrincipalInertia,11);a.set(s.principalFrame,14);a[18]=+(s.bodyType==='Dynamic');a[19]=s.colliders.length;
 for(let i=0;i<2;i++){a[29+i*10]=1;const c=s.colliders[i];if(c)a.set([c.shape==='Cylinder'?2:1,c.radius,c.halfHeight,...c.localTranslation,...c.localRotation],20+i*10);}return new Uint32Array(a.buffer);
}
function shader(compilation){
 const entry=`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 if(gid.x!=0u||gid.y!=0u||gid.z!=0u){return;}let i=${layout.initialization}u;
 if(arrayLength(&rc_state)!=${layout.words}u){return;}rc_state[${layout.completion}u]=4u;
 if(arrayLength(&rc_scratch)!=${compilation.scratchWords}u){rc_scene_created_fail(0u,i,4u);return;}
 if(rc_state[${S.header.phase}u]!=8u||rc_state[i+${I.header.phase}u]!=0u||rc_state[${S.header.status}u]!=1u||rc_state[i+${I.header.status}u]!=1u||rc_state[${S.header.bodySlots}u]!=22u||rc_state[i+${I.header.colliderCount}u]!=25u){rc_scene_created_fail(0u,i,6u);return;}
 var ready=0u;for(var role=0u;role<3u;role++){
  for(var j=0u;j<40u;j++){rc_scratch[j]=rc_state[${layout.numericInputs}u+role*40u+j];}
  if(rc_num_eval(0u,0u)!=1u){rc_scene_created_fail(0u,i,5u);return;}
  for(var j=0u;j<30u;j++){rc_state[${layout.numericOutputs}u+role*30u+j]=rc_scratch[rc_program[${compilation.outputOffset}u+j]];}ready=ready|(1u<<role);
 }
 if(rc_scene_created_initialize(0u,i,${layout.numericOutputs}u,ready)){rc_state[${layout.completion}u]=1u;}
}`;
 return linkResidentWGSL(['@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n@group(0) @binding(1) var<storage,read> rc_program:array<u32>;\n@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;',generateProfiledNumericWGSL(NUMERIC_PROFILE.PRESERVED_F32),generateSceneActivationWGSL(),generateSceneInitializationWGSL(),entry]).code;
}
export function createThreeBallCreatedInitializationPlan(registration){
 assertThreeBallCreatedRegistration(registration);const control=packThreeBallCreatedControlLayout(registration),inputs=threeBallCreatedNumericInputs(registration);
 need(inputs.length===3&&inputs.map(x=>x.role).join(',')==='shaft,head,guide','exact three original cue input roles');
 const compilation=compileGraph(Cue.buildPlan());need(compilation.inputCount===40&&compilation.outputCount===30,'unchanged source graph ABI');
 const initialWords=new Uint32Array(layout.words);initialWords.set(control.sceneWords);initialWords.set(control.initializationWords,layout.initialization);inputs.forEach((x,i)=>initialWords.set(packNumeric(x),layout.numericInputs+i*40));
 const program=compilation.program.slice(),plan=Object.freeze({kind:'resident-three-ball-created-initialization-plan-v1',version:1,
  sourceIdentity:registration.sourceIdentity,capability:THREE_BALL_INITIALIZATION_CAPABILITY,control,layout,initialWords,program,
  numericProfile:NUMERIC_PROFILE.PRESERVED_F32,scratchWords:compilation.scratchWords,code:shader(compilation),entryPoint:'main',workgroups:1,history:registration.history});
 Object.preventExtensions(initialWords);Object.preventExtensions(program);
 owned.set(plan,{registration,initial:initialWords.slice(),program:program.slice()});return plan;
}
export function assertThreeBallCreatedInitializationPlan(plan){
 const p=owned.get(plan);need(p,'locally created initial-only source plan required');assertThreeBallCreatedRegistration(p.registration);assertThreeBallCreatedControlLayout(plan.control);
 for(const[name,expected]of [['initialWords',p.initial],['program',p.program]]){let valid=false;try{const a=plan[name];valid=a instanceof Uint32Array&&a.length===expected.length&&Uint32Array.prototype.every.call(a,(x,i)=>x===expected[i]);}catch{/* detached buffers are unsupported */}need(valid,'initial/program words mutated or detached: '+name);}return plan;
}
/** Test interpreter only. Never accepts caller-provided numeric outputs or a
 * later world state; each invocation starts from the sealed original t0 plan. */
export function executeThreeBallCreatedInitializationForTest(plan,options={}){
 need(options&&Object.getPrototypeOf(options)===Object.prototype&&Object.keys(options).join(',')==='testOnly'&&options.testOnly===true,'only explicit testOnly:true accepted; no outputs/future injection or production HOST fallback');assertThreeBallCreatedInitializationPlan(plan);
 const {registration}=owned.get(plan),words=plan.initialWords.slice();
 for(let role=0;role<3;role++){
  const source=words.slice(layout.numericInputs+role*40,layout.numericInputs+(role+1)*40),out=executeLowered(plan.program,new Float32Array(source.buffer),{testOnly:true});
  words.set(new Uint32Array(out.buffer,out.byteOffset,out.length),layout.numericOutputs+role*30);
 }
 const kernels=sceneInitializationTestKernels(words);need(kernels.rc_scene_created_initialize(0,layout.initialization,layout.numericOutputs,7),'existing source registration rejected, reason '+words[S.header.reason]);words[layout.completion]=1;
 const initialized=decodeSceneInitialization(words,words.subarray(layout.initialization,layout.initialization+I.words),registration.record,plan.control.template);
 // Generic diagnostic phase naming is not authority to enter collision work.
 Object.assign(initialized,{phase:'live-three-ball-user-changes-complete-pre-collision',sourceOrigin:copy(registration.record.created.sourceOrigin),
  pendingCollisionWork:{kind:'live-three-ball-collision-not-owned',sourceBoundary:registration.record.created.boundary,requiresBroadPhaseInsertions:copy(registration.record.created.modifiedColliders),postCollisionManagerComplete:false}});
 return{kind:'resident-three-ball-created-initialization-host-test-result-v1',backend:'host-source-test',capability:THREE_BALL_INITIALIZATION_CAPABILITY,sourceIdentity:plan.sourceIdentity,words,initialized,history:copy(plan.history)};
}
