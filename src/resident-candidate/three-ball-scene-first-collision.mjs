// SPDX-License-Identifier: Apache-2.0
// Distinct genuine-three CREATED -> first-collision/pre-energy scene adapter.
// Exact source integer ordering; no four-ball admission or numerical rewrite.
import {assertThreeBallCreatedOwnerTemplate} from './three-ball-created-owner.mjs';
import {createThreeBallInitialBroadPlan,assertThreeBallInitialBroadPlan,executeThreeBallInitialBroadForTest} from './three-ball-initial-broad.mjs';
import {SCENE_LAYOUT as S,decodeSceneActivation,generateSceneActivationWGSL,sceneActivationTestKernels} from './scene-activation.mjs';
import {SCENE_INITIALIZATION_LAYOUT as I,decodeSceneInitialization} from './scene-initialization.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {equalData} from '../browser-initial-import/exact-data.mjs';
import Cue from '../experimental-cue-created-stroke-stage.js';
import Init from '../experimental-cue-initialization.js';
import Broad from '../experimental-cue-broad-phase.js';
import Journal from '../experimental-contact-graph-journal.js';
import Guard from '../experimental-cue-rigid-exclusion.js';
import Floor from '../experimental-world-lifecycle.js';
import Scene from '../experimental-scene-activation.js';
import {prepareFirstNumericalSource} from './three-ball-first-numerical-source.mjs';
const U=0xffffffff,owned=new WeakMap(),copy=structuredClone,key=h=>h.index+':'+h.generation,align=n=>Math.ceil(n/64)*64;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball first collision: '+m),{code:'three-ball-first-collision-unsupported'});};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export const THREE_BALL_FIRST_SCENE_LAYOUT=freeze({words:48,initialOffset:16,initialStride:5,header:{magic:0,version:1,status:2,phase:3,initialCount:4,bodies:5,dynamics:6,colliders:7,completed:8}});
export const THREE_BALL_FIRST_SCENE_CAPABILITY=freeze({sourcePlanOnly:true,firstCollisionOnly:true,preEnergyOnly:true,
 collisionInputBackend:'resident-source-kernels-host-test-only',cuePreInputBackend:'resident-source-programs-host-test-only',cuePreSourceProgramProducer:true,cuePreResident:false,cueNumberProfile:'original-js-number-v1',jointSolveDeferred:true,
 nativeRegistrationBoundaryVerified:false,nativeFirstCollisionBoundaryVerified:false,physicalSteps:0,
 numericalEnergyEvaluated:false,wholeH:false,gpuQualified:false,runtimeIntegrated:false,defaultBackend:false});
const L=THREE_BALL_FIRST_SCENE_LAYOUT;
const constants=()=>Object.entries({T3:L,T3H:L.header,T3I:I,T3IH:I.header,T3J:J,T3JH:J.header,T3JC:J.collider,T3CH:J.change}).flatMap(([prefix,obj])=>Object.entries(obj).filter(([,v])=>Number.isInteger(v)).map(([k,v])=>`const ${prefix}_${k}:u32=${v}u;`)).join('\n');
// Adapted from the pinned first collision source branch in scene-world.mjs.
// This NEW entry binds actual three-floor/five-dynamic/25-collider identities.
// It stops exactly at source finishLiveThreeBallCollisionPhase, before energy.
const KERNEL=String.raw`
fn rc_scene_three_fail(s:u32,b:u32)->bool{rc_state[b+T3H_status]=4u;return rc_scene_bad(s,6u);}
fn rc_scene_three_first_collision(s:u32,i:u32,j:u32,b:u32)->bool{
 if(rc_state[b+T3H_magic]!=0x52335343u||rc_state[b+T3H_version]!=1u||rc_state[b+T3H_status]!=1u||rc_state[b+T3H_phase]!=0u||rc_state[b+T3H_completed]!=0u){return rc_scene_three_fail(s,b);}
 if(rc_state[b+T3H_bodies]!=22u||rc_state[b+T3H_dynamics]!=5u||rc_state[b+T3H_colliders]!=25u||rc_state[b+T3H_initialCount]!=3u||rc_state[s+SH_bodySlots]!=22u||rc_state[s+SH_bodyCount]!=22u||rc_state[s+SH_phase]!=1u||rc_state[s+SH_status]!=1u){return rc_scene_three_fail(s,b);}
 if(rc_state[i+T3IH_status]!=1u||rc_state[i+T3IH_phase]!=1u||rc_state[i+T3IH_numericReady]!=7u||rc_state[i+T3IH_colliderCount]!=25u||rc_state[i+T3IH_consumedColliderCount]!=3u||rc_state[s+SH_consumedCount]!=3u||rc_state[s+SH_jointCount]!=2u||rc_state[s+SH_removalCount]!=4u){return rc_scene_three_fail(s,b);}
 var dynamics=0u;for(var n=0u;n<22u;n++){if(!rc_scene_valid_body(s,n)){return rc_scene_three_fail(s,b);}dynamics=dynamics+rc_state[rc_scene_bp(s,n)+SB_dynamic];}if(dynamics!=5u){return rc_scene_three_fail(s,b);}
 if(rc_state[j+T3JH_status]!=0u||rc_state[j+T3JH_phase]!=3u||rc_state[j+T3JH_colliders]!=25u||rc_state[j+T3JH_cueCount]!=3u||rc_state[j+T3JH_cuePresent]!=1u||rc_state[j+T3JH_fromSequence]!=0u||rc_state[j+T3JH_sequence]!=1u||rc_state[j+T3JH_birthPending]!=0u||rc_state[j+T3JH_removed]!=0u||rc_state[j+T3JH_operations]!=0u||rc_state[j+T3JH_events]!=0u){return rc_scene_three_fail(s,b);}
 let changes=rc_state[j+T3JH_changes];let edges=rc_state[j+T3JH_edges];if(changes>125u||edges!=3u+changes){return rc_scene_three_fail(s,b);}var revision=0u;if(changes!=0u){revision=1u;}if(rc_state[j+T3JH_fromRevision]!=0u||rc_state[j+T3JH_revision]!=revision||rc_state[j+T3JH_nextLo]!=4u+changes||rc_state[j+T3JH_nextHi]!=0u){return rc_scene_three_fail(s,b);}
 // Registry generation AND parent identities must match the original initializer.
 for(var c=0u;c<25u;c++){let co=i+T3I_colliderOffset+c*T3I_colliderStride;let q=j+T3J_colliderOffset+c*T3J_colliderStride;let member=rc_state[co+2u];if(!rc_scene_valid_body(s,member)){return rc_scene_three_fail(s,b);}let body=rc_scene_bp(s,member);var cue=0u;if(member==rc_state[s+SH_roleShaft]||member==rc_state[s+SH_roleHead]){cue=1u;}if(rc_state[q+T3JC_cue]!=cue||rc_state[q+T3JC_type]!=rc_state[body+SB_dynamic]){return rc_scene_three_fail(s,b);}if(rc_state[co]!=rc_state[q]||rc_state[co+1u]!=rc_state[q+1u]||rc_state[q+T3JC_bodyIndex]!=rc_state[body+SB_index]||rc_state[q+T3JC_bodyGeneration]!=rc_state[body+SB_generation]||rc_state[q+T3JC_live]!=1u){return rc_scene_three_fail(s,b);}}
 for(var n=0u;n<3u;n++){let e=j+T3J_edgeOffset+n*T3J_edgeStride;let expected=b+T3_initialOffset+n*T3_initialStride;let aSlot=rc_state[e];let cSlot=rc_state[e+1u];if(aSlot>=25u||cSlot>=25u){return rc_scene_three_fail(s,b);}let a=j+T3J_colliderOffset+aSlot*T3J_colliderStride;let c=j+T3J_colliderOffset+cSlot*T3J_colliderStride;if(rc_state[a]!=rc_state[expected]||rc_state[a+1u]!=rc_state[expected+1u]||rc_state[c]!=rc_state[expected+2u]||rc_state[c+1u]!=rc_state[expected+3u]||rc_state[e+2u]!=1u||rc_state[e+3u]!=n+1u||rc_state[e+4u]!=0u){return rc_scene_three_fail(s,b);}}
 for(var n=0u;n<changes;n++){let p=j+T3J_changeOffset+n*T3J_changeStride;let e=j+T3J_edgeOffset+(3u+n)*T3J_edgeStride;let aSlot=rc_state[p+T3CH_collider1Slot];let cSlot=rc_state[p+T3CH_collider2Slot];if(aSlot>=25u||cSlot>=25u||rc_state[p+T3CH_kind]!=1u||rc_state[p+T3CH_edge]!=3u+n||rc_state[p+T3CH_oldActive]!=0u||rc_state[p+T3CH_newActive]!=0u||rc_state[e]!=aSlot||rc_state[e+1u]!=cSlot||rc_state[e+2u]!=0u||rc_state[e+3u]!=rc_state[p+T3CH_lifeLo]||rc_state[e+4u]!=rc_state[p+T3CH_lifeHi]||rc_state[e+3u]!=4u+n||rc_state[e+4u]!=0u){return rc_scene_three_fail(s,b);}let a=j+T3J_colliderOffset+aSlot*T3J_colliderStride;let c=j+T3J_colliderOffset+cSlot*T3J_colliderStride;if(rc_state[a+T3JC_cue]==0u&&rc_state[c+T3JC_cue]==0u){return rc_scene_three_fail(s,b);}}
 // Exact source order: clear consumed body flags; collider flags; joint removal
 // bookkeeping; clear removal queue. No energy reset, force or solve is run.
 for(var n=0u;n<3u;n++){let member=rc_state[s+SL_consumedOffset+n];var expected=rc_state[s+SH_roleShaft];if(n==1u){expected=rc_state[s+SH_roleHead];}if(n==2u){expected=rc_state[s+SH_roleGuide];}if(member!=expected||!rc_scene_valid_body(s,member)){return rc_scene_three_fail(s,b);}rc_state[rc_scene_bp(s,member)+SB_changes]=0u;}
 for(var n=0u;n<3u;n++){let slot=rc_state[i+T3I_modifiedColliderOffset+n];if(slot>=25u){return rc_scene_three_fail(s,b);}let q=j+T3J_colliderOffset+slot*T3J_colliderStride;if(rc_state[q+T3JC_cue]!=1u){return rc_scene_three_fail(s,b);}rc_state[i+T3I_colliderOffset+slot*T3I_colliderStride+3u]=0u;}
 for(var n=0u;n<4u;n++){let first=rc_state[s+SL_removalOffset+2u*n];let second=rc_state[s+SL_removalOffset+2u*n+1u];if(!rc_scene_valid_body(s,first)||!rc_scene_valid_body(s,second)){return rc_scene_three_fail(s,b);}let a=rc_scene_bp(s,first);let c=rc_scene_bp(s,second);let id=rc_state[a+SB_island];if(id==0xffffffffu||id!=rc_state[c+SB_island]){continue;}let av=rc_state[a+SB_activation];let cv=rc_state[c+SB_activation];if((av&0x80000000u)==0u||(av&0x7fffffffu)==0u||(cv&0x80000000u)==0u||(cv&0x7fffffffu)==0u){return rc_scene_three_fail(s,b);}let p=rc_scene_pp(s,id);if(rc_state[p+SP_removed]==0xffffffffu){return rc_scene_three_fail(s,b);}rc_state[p+SP_removed]=rc_state[p+SP_removed]+1u;}
 rc_state[s+SH_removalCount]=0u;rc_state[s+SH_phase]=2u;rc_state[s+SH_sourcePhase]=2u;rc_state[i+T3IH_phase]=2u;
 if(!rc_scene_incidence_from_journal(s,j)){rc_state[b+T3H_status]=4u;return false;}rc_state[b+T3H_phase]=1u;rc_state[b+T3H_completed]=1u;return true;
}
`;
export function generateThreeBallFirstSceneWGSL(){return constants()+'\n'+KERNEL;}
export function threeBallFirstSceneTestKernels(words){return sceneActivationTestKernels(words,{extraWGSL:generateThreeBallFirstSceneWGSL()});}
export function createThreeBallFirstScenePlan(template){
 need(arguments.length===1,'only local original owner template accepted');assertThreeBallCreatedOwnerTemplate(template);const seed=template.seed,edges=seed.contactGraphSeed.edges,floor=seed.application.registry.statics.find(s=>s.kind==='cloth');
 need(edges.length===3&&edges.every(e=>e.active&&key(e.collider1)===key(floor.collider)&&seed.balls.some(b=>key(e.collider2)===key(b.collider))),'initial profile: three original active sphere/floor edges only');
 const initialBroad=createThreeBallInitialBroadPlan(template),bridge=align(initialBroad.initialWords.length),initialWords=new Uint32Array(bridge+L.words);initialWords.set(initialBroad.initialWords);initialWords.set([0x52335343,1,1,0,3,22,5,25,0],bridge);
 edges.forEach((e,n)=>initialWords.set([e.collider1.index,e.collider1.generation,e.collider2.index,e.collider2.generation,1],bridge+L.initialOffset+n*5));
 const layout=freeze({scene:0,initialization:template.registration.layout.initialization,journal:template.segments.journal.offset,bridge,words:initialWords.length});
 const entry=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x!=0u||gid.y!=0u||gid.z!=0u||arrayLength(&rc_state)!=${layout.words}u){return;}let ok=rc_scene_three_first_collision(0u,${layout.initialization}u,${layout.journal}u,${bridge}u);}`;
 const code=linkResidentWGSL([generateSceneActivationWGSL(),generateThreeBallFirstSceneWGSL(),entry]).code;
 const plan=Object.freeze({kind:'resident-three-ball-first-scene-plan-v1',sourceIdentity:template.sourceIdentity,template,initialBroad,layout,initialWords,code,entryPoint:'main',capability:THREE_BALL_FIRST_SCENE_CAPABILITY});Object.preventExtensions(initialWords);owned.set(plan,{template,words:initialWords.slice()});return plan;
}
export function assertThreeBallFirstScenePlan(plan){const p=owned.get(plan);need(p,'local initial-only first-scene plan required');assertThreeBallCreatedOwnerTemplate(p.template);assertThreeBallInitialBroadPlan(plan.initialBroad);let okay=false;try{okay=plan.initialWords.length===p.words.length&&Uint32Array.prototype.every.call(plan.initialWords,(x,i)=>x===p.words[i]);}catch{}need(okay,'initial first-scene words mutated/detached');return plan;}

/** Private bounded source-component preparation. It produces a current owned
 * journal, never takes an expected endpoint or arbitrary physical input. */
async function sourceCollision(seed,numerical=false){
 const token={},stages=[],claimed=[];let cue,broad,journal,guard;
 const own=s=>(stages.push(s),s),claim=s=>(s.claim(token),claimed.push(s),s);
 try{
  cue=claim(own(Cue.createReferencePreWorldStage(seed.cueInitial,{numberProfile:'original-js-number-v1'})));
  const selected=seed.sourceOrigin.selectedIndex,pre=await cue.prepareApplication({selected:copy(seed.balls[selected].state),others:seed.balls.filter((_,i)=>i!==selected).map(b=>copy(b.state))},token),m=pre.metadata;
  need(m.jointSolved===false&&m.jointResult===null&&m.cuePresent&&!m.touching&&!m.birth&&!m.separation&&!m.ballStrongWake&&!m.ballMutableAccess&&m.initialization,'initial non-touching original cue application with deferred joint solve only');
  equalData(pre.linear,seed.balls[selected].state.linear);equalData(pre.angular,seed.balls[selected].state.angular);
  guard=own(Guard.createReferenceGuard({created:seed.cueInitial.sourceCreation.created,roles:seed.cueInitial.sourceCreation.roles,sceneRegistry:seed.sceneRegistry}));
  const exclusion=await guard.check({cue:m.preSolveBodies,balls:seed.balls.map(b=>({body:b.body,translation:b.state.translation,rotation:b.state.rotation,radius:b.radius}))});need(exclusion.admitted===true&&exclusion.pairs===54,'all actual native cue-filter pairs source-separated');
  broad=claim(own(await Broad.createLiveRegisteredThreeBallReferenceStage(seed.cueBroadSeed)));journal=claim(own(Journal.createReferenceStageWithLiveThreeBallCue(seed.contactGraphSeed,broad)));
  const projection=numerical?journal.createProjection(token):null;
  const before=m.initialization,manager=before.manager,poses=seed.balls.map(b=>({body:copy(b.body),translation:copy(b.state.translation),rotation:copy(b.state.rotation)}));
  const receipt=await broad.prepare({cue:copy(m.preSolveBodies),balls:poses,removedBodies:[],activeBodyOrder:manager.awake_island===null?[]:copy(manager.islands.v[manager.awake_island].bodies)},token);
  const graph=await journal.prepare(poses.map(({body,translation})=>({body,translation})),token,receipt);
  const floorGeometry=[],preparedFloors=[],floorStages=[];for(const ball of seed.balls){
   if(ball.state.sleeping){floorGeometry.push({body:copy(ball.body),sleeping:true,active:ball.state.topology.active});preparedFloors.push({state:copy(ball.state),metadata:{geometryRefreshed:false}});floorStages.push(null);continue;}
   const floor=claim(own(Floor.createReferenceSettledContactStage(ball.state))),prepared=await floor.prepare(copy(ball.state),token),edge=graph.graph.edges.find(e=>key(e.collider2)===key(ball.collider));
   need(edge&&edge.active===!!prepared.state.topology.active,'first sphere/floor activity transition requires a different scene profile');floorGeometry.push({body:copy(ball.body),sleeping:false,active:!!prepared.state.topology.active});preparedFloors.push(prepared);floorStages.push(floor);
  }
  const narrow=journal.narrowTransitions([],token);
  // This is the source's own branded current narrow receipt; no relabeling.
  Journal.assertInitialLiveThreeBallCollisionOwned(graph.receipt,'cpu-reference');
  need(narrow.phase==='narrow'&&narrow.status==='pending'&&narrow.fromSequence===0&&narrow.toSequence===1&&narrow.operations.length===0&&narrow.contactEvents.length===0&&(narrow.removedColliders??[]).length===0,'only inactive source cue appends, no active transitions/removals');
  const finished=Init.finishLiveThreeBallCollisionPhase(before,graph.receipt,'cpu-reference'),bodies=copy(finished.bodies);for(const b of seed.bodyRegistry)if(!bodies.some(x=>key(x.handle)===key(b.handle)))bodies.push(copy(b));
  const context={...copy(finished),kind:'source-scene-activation',noOtherPendingChanges:true,bodies},sourceScene=own(Scene.createReferenceStage(context));
  const scene=sourceScene.snapshot(),numeric=numerical?await prepareFirstNumericalSource({seed,metadata:m,preparedFloors,floorStages,before,projection,transaction:graph.receipt,narrow,scene:claim(sourceScene),token,own,claim,cue,solveCue:['cue','sphere'].includes(numerical),solveSpheres:numerical==='sphere'}):null;
  return{registered:copy(before),finished:copy(finished),scene,journal:narrow,numeric,
   preparation:{numberProfile:'original-js-number-v1',jointSolved:m.jointSolved,sourceH:m.sourceH,initialTime:seed.application.time,pendingApplicationTime:m.simulationTime,mutableBodyCalls:copy(m.mutableBodyCalls),exclusion:copy(exclusion),sourceGeometryOnly:true,floorGeometry}};
 }finally{
  for(const s of claimed.slice().reverse()){s.abort(token);s.release(token);}for(const s of stages.reverse())s.dispose();
 }
}
/** HOST differential execution only. No public per-step source/future inputs.
 * All output remains test evidence, not a numerical world continuation. */
export async function executeThreeBallFirstSceneForTest(plan,options={}){return executeFirstScene(plan,options,false);}
/** Internal HOST phase composition. No source outputs or timing are accepted. */
export async function executeThreeBallFirstSceneEnergySourceForTest(plan,options={}){return executeFirstScene(plan,options,'energy');}
/** Internal HOST cue extension; its actual original owner stays leased here. */
export async function executeThreeBallFirstSceneCueSourceForTest(plan,options={}){return executeFirstScene(plan,options,'cue');}
export async function executeThreeBallFirstSceneSphereSourceForTest(plan,options={}){return executeFirstScene(plan,options,'sphere');}
async function executeFirstScene(plan,options,numerical){
 need(options&&Object.keys(options).join(',')==='testOnly'&&options.testOnly===true,'explicit testOnly:true only; no output/journal injection');assertThreeBallFirstScenePlan(plan);
 const template=plan.template,seed=template.seed,broadProducer=await executeThreeBallInitialBroadForTest(plan.initialBroad,{testOnly:true}),source=await sourceCollision(seed,numerical);
 equalData(broadProducer.boundary.registered,source.registered,'independent current cue registration boundary');
 const {proxies,cueProxies,...sourceJournalState}=source.journal.after;equalData(broadProducer.journal.state,sourceJournalState,'resident-generated graph vs independent source oracle');
 for(const k of ['changes','operations','contactEvents','broadPhaseEvents','removedColliders'])equalData(broadProducer.journal[k],source.journal[k]??[],'resident-generated journal '+k);
 // Only resident-kernel-generated words are copied into this HOST test composition.
 // No reference broad, tree, graph or later scene output is serialized.
 const words=plan.initialWords.slice();words.set(broadProducer.words);
 const beforeCollision=words.slice(),k=threeBallFirstSceneTestKernels(words);need(k.rc_scene_three_first_collision(0,plan.layout.initialization,plan.layout.journal,plan.layout.bridge),'distinct three-scene source kernel rejected');
 const initialized=decodeSceneInitialization(words,words.subarray(plan.layout.initialization,plan.layout.initialization+I.words),seed.registration.record,template.registration.control.template);
 Object.assign(initialized,{phase:'live-three-ball-collision-and-connectivity-complete-pre-energy',sourceOrigin:copy(seed.sourceOrigin)});
 const scene=decodeSceneActivation(words,template.registration.control.template);Object.assign(scene,{phase:initialized.phase,sourceOrigin:copy(seed.sourceOrigin)});
 return{kind:'resident-three-ball-first-scene-host-test-result-v1',capability:THREE_BALL_FIRST_SCENE_CAPABILITY,sourceIdentity:plan.sourceIdentity,words,beforeCollision,initialized,scene,history:copy(seed.history),
  broadProducer,sourceExpected:{initialized:source.finished,scene:source.scene,journal:source.journal},preparation:source.preparation,...(numerical?{numericalSource:source.numeric}:{})};
}
