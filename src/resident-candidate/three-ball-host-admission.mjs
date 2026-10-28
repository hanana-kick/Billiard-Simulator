// SPDX-License-Identifier: Apache-2.0
// Separate initial-only genuine-three-ball HOST contract. Never relabels a
// four-ball/constructor seed, dispatches GPU, or supplies later physical state.
import {importLiveRegisteredThreeBall} from '../browser-initial-import/live-registered-three-ball.mjs';
import {verifyCreationArenaTransition} from './creation-template.mjs';
import {captureAcceptedEventHistory,SOURCE_EVENT_HISTORY_PROFILE} from '../source-event-history.mjs';
import {assertOwnedInputData,equalData} from '../browser-initial-import/exact-data.mjs';
import {validateThreeBallGame,consumeThreeBallGameEvent,finishThreeBallGameAtRest} from './three-ball-game.mjs';
import {exportRegisteredCueInitialization} from '../browser-initial-import/live-initialization.mjs';
import {registry as nativeBodyRegistry} from '../browser-initial-import/initial-cloth.mjs';
const owned=new WeakMap(),copy=structuredClone,key=h=>h.index+':'+h.generation;
const registrations=new WeakSet(),registrationNumerics=new WeakMap(),ownerSeeds=new WeakMap();
const need=(ok,message)=>{if(!ok)throw Object.assign(new RangeError('Three-ball HOST admission: '+message),{code:'three-ball-host-admission-contract'});};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export const THREE_BALL_HOST_CAPABILITY=Object.freeze({initialAdmission:true,sourceOwned:true,hostOnly:true,physicsSteps:0,gpuWork:false,
 numericalOwnerAvailable:false,rawCandidateCreation:false,searchReducer:false,wholeShot:false,runtimeIntegrated:false,defaultBackend:false});
function bits(n){need(Number.isFinite(n),'finite exact source Number');const d=new DataView(new ArrayBuffer(8));d.setFloat64(0,n,true);return[d.getUint32(0,true),d.getUint32(4,true)];}

/** A distinct 25-collider representation, NOT the resident four-ball rule bank.
 * Every emit occupies history, even unkeyed stroke/compliant/obstruction rows.
 * Retired-generation keys outside the last eight remain in full source history;
 * an unmappable last-eight key is unsupported, never silently discarded. */
export function packThreeBallInitialHistory(events,colliders){
 assertOwnedInputData({events,colliders});need(Array.isArray(events)&&events.length<=120&&Array.isArray(colliders)&&colliders.length===25,'full bounded source events and exactly 25 created colliders');
 colliders.forEach(c=>need(c?.handle&&Object.keys(c.handle).sort().join(',')==='generation,index'&&Object.values(c.handle).every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff&&!Object.is(x,-0)),'exact generation-bearing u32 collider handle'));
 need(new Set(colliders.map(c=>key(c.handle))).size===25,'distinct generation-bearing collider identities');
 const tail=events.slice(-8),words=Array(32).fill(0);
 tail.forEach((e,i)=>{
  need(e&&typeof e.label==='string'&&['stroke','contact','cue-obstruction'].includes(e.kind)&&Number.isFinite(e.time)&&e.time>=0,'actual source emit record');
  let pairId=0,keyed=0;
  if(Object.hasOwn(e,'key')){
   need(e.kind==='contact'&&typeof e.key==='string','only original native contacts have pair keys');const parts=e.key.split(':');
   need(parts.length===2&&parts.every(s=>s!==''&&Number.isFinite(Number(s))&&String(Number(s))===s)&&parts.slice().sort().join(':')===e.key,'exact original lexical numeric-handle key');
   const slots=parts.map(s=>{const[index,generation]=bits(Number(s));return colliders.findIndex(c=>c.handle.index===index&&c.handle.generation===generation);});
   need(slots.every(x=>x>=0)&&slots[0]!==slots[1],'last-eight historical collider generation unavailable or repeated');pairId=Math.min(...slots)*25+Math.max(...slots);keyed=1;
  }
  words.splice(i*4,4,pairId,...bits(e.time),keyed);
 });
 return freeze({colliderCount:25,count:tail.length,head:tail.length%8,words});
}

/** Imports owned bytes and the exact source capture. A snapshot hash binds bytes,
 * NOT arbitrary external JS history: the original capture envelope is required.
 * No public entry accepts a caller-supplied projection or expected/future bank. */
export async function admitThreeBallHost(decoder,input){
 const projection=await importLiveRegisteredThreeBall(decoder,input),{before,created,application:a,preStrikeApplication:b,sourceOrigin:o}=projection;
 const by=method=>projection.strikeCreationJournal.filter(e=>e.method===method).map(e=>copy(e.result.handle));
 const arenas={
  bodies:verifyCreationArenaTransition(before.state.bodies.bodies,created.state.bodies.bodies,by('createRigidBody'),'three-ball bodies'),
  colliders:verifyCreationArenaTransition(before.state.colliders.colliders,created.state.colliders.colliders,by('createCollider'),'three-ball colliders'),
  joints:verifyCreationArenaTransition(before.state.impulse_joints.joint_ids,created.state.impulse_joints.joint_ids,by('createImpulseJoint'),'three-ball joints')};
 // This first HOST profile admits the proven source insertion fast path only.
 equalData(before.state.bodies.modified_bodies,[[],null]);equalData(before.state.colliders.modified_colliders,[[],null]);
 equalData(created.state.bodies.modified_bodies,[by('createRigidBody'),null]);equalData(created.state.colliders.modified_colliders,[by('createCollider'),null]);
 // Dense decoded-native row is not a resident scene slot or body address.
 const nativeBodyRow=h=>{const n=created.bodies.findIndex(b=>key(b.handle)===key(h));need(n>=0,'exact native body generation');return n;};
 const bindings=a.registry.objects.map(o=>({objectIndex:o.index,id:o.id,body:copy(o.body),nativeBodyRow:nativeBodyRow(o.body),primaryCollider:copy(o.collider),pairCollider:copy(o.pairCollider)}));
 const cue=Object.fromEntries(['shaft','head','guide'].map(role=>[role,{body:copy(a.cue[role]),nativeBodyRow:nativeBodyRow(a.cue[role])}]));
 cue.shaft.colliders=[copy(a.cue.shaftCollider)];cue.head.colliders=[copy(a.cue.tipCollider),copy(a.cue.neckCollider)];cue.guide.colliders=[];
 const history=captureAcceptedEventHistory(b,a),preStrike=packThreeBallInitialHistory(history.preStrikeEventHistory,created.colliders),atCreated=packThreeBallInitialHistory(history.initialEventHistory,created.colliders);
 const admission=freeze({kind:'resident-genuine-three-ball-host-admission-v1',version:1,capability:THREE_BALL_HOST_CAPABILITY,
  source:{revision:created.sourceRevision,engineSha256:created.engineSha256,preStrikeSnapshotSha256:before.snapshotSha256,createdSnapshotSha256:created.snapshotSha256,strikeCreationJournalSha256:projection.strikeCreationJournalSha256,boundary:projection.boundary,preStrikeClock:copy(o.preStrikeClock),clock:copy(o.createdClock),settings:copy(o.settings)},
  counts:{balls:3,preStrikeBodies:19,createdBodies:22,preStrikeColliders:22,createdColliders:25,dynamicBodies:5,fixedBodies:17,cueJoints:2,ballCapacity:3,unusedBallSlots:0},
  selection:{selectedId:o.selectedId,selectedIndex:o.selectedIndex,selectedBody:copy(o.selectedBody),targetIds:copy(o.targetIds),routeTargets:copy(o.routeTargets),gameMode:'free',gameKind:'three',opponentProhibited:false},
  rules:{gameClass:'ThreeBallGame',requiredCushions:3,routeOptions:copy(a.controller.routeOptions),searchTerminationImplemented:false},
  native:{bindings,cue,arenas,bodyOrder:created.bodies.map(b=>copy(b.handle)),colliderOrder:created.colliders.map(c=>copy(c.handle)),jointOrder:by('createImpulseJoint')},
  history:{profile:SOURCE_EVENT_HISTORY_PROFILE,preStrikeEvents:history.preStrikeEventHistory,createdEvents:history.initialEventHistory,preStrike,created:atCreated,strokeTime:bits(a.time)},
  gameBefore:validateThreeBallGame(b.game),gameCreated:validateThreeBallGame(a.game)});
 owned.set(admission,projection);return admission;
}
export function assertThreeBallHostAdmission(admission){need(owned.has(admission),'original locally verified admission required; copies are not receipts');return admission;}
export function requireThreeBallResidentOwner(admission){assertThreeBallHostAdmission(admission);throw Object.assign(new RangeError('Genuine three-ball resident numerical owner is not implemented; no four-ball seed, fake fourth body, or physical miss may be substituted.'),{code:'three-ball-resident-owner-unavailable'});}

/** A new locally branded INITIAL projection, never arbitrary projected input.
 * The shared exporter rechecks original native bytes and source creation calls;
 * it does not evaluate its numeric initialization inputs or advance the world. */
export async function projectThreeBallCreatedRegistration(admission){
 assertThreeBallHostAdmission(admission);const p=owned.get(admission),row={...p.created,hCount:0,outerStep:0,outerSubstep:0,boundary:p.boundary,candidateInput:true,
  nativeFrameIndex:p.sourceOrigin.createdClock.nativeFrameIndex,apiJournalLength:14,application:p.application,sourceOrigin:p.sourceOrigin};
 const seed=await exportRegisteredCueInitialization({[p.boundary]:row,strikeCreationJournal:p.strikeCreationJournal},'three');
 const result=freeze({kind:'three-ball-created-registration-input-v1',admission,sourceIdentity:admission.source.createdSnapshotSha256,
  record:seed.userChanges,bodyRegistry:nativeBodyRegistry({state:p.created.typedState}),history:copy(admission.history),
  capability:{initialOnly:true,sourceOwned:true,numericInitialized:false,physicsSteps:0,residentExecution:false}});
 registrations.add(result);registrationNumerics.set(result,freeze(copy(seed.numericInputs)));return result;
}
export function assertThreeBallCreatedRegistration(value){need(registrations.has(value),'locally projected genuine-three created registration required');assertThreeBallHostAdmission(value.admission);need(value.sourceIdentity===value.admission.source.createdSnapshotSha256,'exact created source identity');return value;}
/** Original created attachment/pose inputs only, never initialized outputs.
 * The exporter already bound these to the owned typed bytes and creation calls. */
export function threeBallCreatedNumericInputs(registration){assertThreeBallCreatedRegistration(registration);return registrationNumerics.get(registration);}

/** HOST observation adapter only. Input is the already accepted original emits,
 * not raw collision candidates (the PhysicsLab debounce remains upstream).
 * Initial history seeds the last-eight FIFO; it is NEVER replayed into the new
 * shot. A native producer/route-search/GPU adapter remains unimplemented. */
export function createThreeBallHostObserver(admission){
 assertThreeBallHostAdmission(admission);let game=copy(admission.gameCreated),events=copy(admission.history.createdEvents),emissions=0,finished=false,lastTime=owned.get(admission).application.time;
 const snapshot=()=>({game:copy(game),eventHistory:copy(events),postCreationEmissionCount:emissions,finished});
 return Object.freeze({snapshot,
  emit(event){
   need(!finished,'cannot emit after source turn finish');assertOwnedInputData(event);
   need(event&&Object.getPrototypeOf(event)===Object.prototype&&['stroke','contact','cue-obstruction'].includes(event.kind)&&typeof event.label==='string'&&Number.isFinite(event.time)&&event.time>=lastTime,'source-ordered original emit required');
   need(event.kind!=='stroke','another strike is not part of this accepted shot');
   const next=consumeThreeBallGameEvent(game,event);events=[...events,copy(event)].slice(-120);game=next;lastTime=event.time;emissions++;return snapshot();
  },
  finish(observation){need(!finished,'source turn already finished');const result=finishThreeBallGameAtRest(game,observation);game=result.game;finished=result.status==='finished';return{...result,eventHistory:copy(events),postCreationEmissionCount:emissions};}
 });
}

/** Authenticated complete INITIAL native data plus exact component projections.
 * This is not a native registration/first-h checkpoint or an executable world. */
export async function createThreeBallCreatedOwnerSeed(admission){
 need(arguments.length===1,'owner seed accepts only its locally verified admission, never options/outputs');assertThreeBallHostAdmission(admission);const p=owned.get(admission),registration=await projectThreeBallCreatedRegistration(admission);
 const {projectThreeBallCreatedOwnerData}=await import('../browser-initial-import/live-three-ball-owner-data.mjs');
 const data=await projectThreeBallCreatedOwnerData(p,{userChanges:copy(registration.record),numericInputs:copy(threeBallCreatedNumericInputs(registration))});
 const seed=freeze({...data,kind:'resident-three-ball-created-owner-seed-v1',admission,registration,history:copy(admission.history),
  capability:{sourceOwned:true,initialOnly:true,completeNativeInitialData:true,realSolverContactRoster:true,physicsSteps:0,nativeRegistrationBoundaryVerified:false,wholeH:false,runtimeIntegrated:false}});
 ownerSeeds.set(seed,admission);return seed;
}
export function assertThreeBallCreatedOwnerSeed(seed){
 const admission=ownerSeeds.get(seed);need(admission,'locally projected original three-ball owner seed required');assertThreeBallHostAdmission(admission);
 need(seed.initialSnapshotSha256===admission.source.createdSnapshotSha256,'exact initial owner snapshot identity');return seed;
}
