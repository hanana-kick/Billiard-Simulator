// SPDX-License-Identifier: Apache-2.0
// Genuine three-sphere INITIAL owner composition. The bank holds authentic t0
// words, NOT a completed registration/collision/h or a runtime evaluator.
import {assertThreeBallCreatedOwnerSeed} from './three-ball-host-admission.mjs';
import {createThreeBallCreatedInitializationPlan,assertThreeBallCreatedInitializationPlan} from './three-ball-created-initialization.mjs';
import {encodeContactRoster} from './contact-roster.mjs';
import {encodeContactJournal} from './contact-journal.mjs';
import {packBvhState,BVH_SCRATCH_WORDS} from './bvh.mjs';
import {encodeWorldBroad,createWorldBroadPrograms,WORLD_BROAD_LAYOUT} from './world-broad.mjs';
import {createCueProgramBundle,packCueInitialState} from './cue-orchestration.mjs';
import {writeCueBridgeInitialState} from './cue-bridge.mjs';
import {packCanonicalBallBody} from './geometry-state.mjs';
import {packFloorNarrow} from './narrowphase.mjs';
import * as NativeBvh from '../experimental-ccd-bvh-state.js';
import {equalData} from '../browser-initial-import/exact-data.mjs';
import Guard from '../experimental-cue-rigid-exclusion.js';
import {compileGraph} from './numeric-program.mjs';
import {packSharedConvexHull} from './convex-point.mjs';
const owned=new WeakMap(),U=0xffffffff,copy=structuredClone,key=h=>h.index+':'+h.generation,align=n=>Math.ceil(n/64)*64;
const need=(ok,message)=>{if(!ok)throw Object.assign(new RangeError('Three-ball created owner: '+message),{code:'three-ball-created-owner-contract'});};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export const THREE_BALL_ONE_H_MISSING_LINKS=freeze([
 {owner:'scene-world',files:['three-ball-scene-first-collision.mjs','three-ball-first-numerical.mjs','scene-world.mjs'],boundary:'distinct first collision and source-inactive-initial-h energy/gather HOST adapters exist; actual cue-joint/CCD pass and resident geometry scheduling remain uncomposed'},
 {owner:'sphere-geometry',files:['geometry-state.mjs','geometry-world.mjs','world-geometry.mjs'],boundary:'18 genuine floor/pair/cushion rows; live-three pair/cushion normalization and cursor/gather/writeback unported'},
 {owner:'solver',files:['three-ball-solver.mjs','coupled-solver.mjs'],boundary:'distinct three-sphere floor-only gather and ordered first cue component exist; fresh cue metadata, sphere solve/writeback/post-CCD and complete world commit remain unavailable'},
 {owner:'cue-world',files:['cue-bridge.mjs','world-cue-geometry.mjs','cue-cloth-cache.mjs'],boundary:'canonical cue indices 3/4, actual filtered 25-collider geometry, lifecycle caches and owned cue-cloth contact'},
 {owner:'ccd',files:['ccd.mjs','world-h.mjs'],boundary:'three-sphere/five-dynamic integration and actual native pre/post CCD pass authority'},
 {owner:'application-and-rules',files:['application.mjs','world-application.mjs','world-h.mjs','physical-rules.mjs'],boundary:'PhysicsLab latched outer subdivisions/clock/event ordering and distinct ThreeBallGame/controller/search completion'},
 {owner:'native-parity',files:['three-ball-created-initialization.mjs'],boundary:'no observed native internal registration boundary or original outer-step parity; source agreement is not native parity'}
]);
export const THREE_BALL_CREATED_OWNER_CAPABILITY=freeze({initialOnly:true,sourceOwned:true,hostSerialization:true,
 registrationSourcePlanAvailable:true,preCollisionOnly:true,nativeRegistrationBoundaryVerified:false,
 nativeT0DataVerified:true,completeOneHSourcePlan:false,physicalSteps:0,gpuQualified:false,
 wholeH:false,wholeShot:false,rawCandidateCreation:false,searchEvaluator:false,runtimeIntegrated:false,defaultBackend:false});

// Exact INITIAL word movement from rc_cue_to_canonical. Unlike that existing
// four-ball entry, the destinations are explicitly the two real cue bindings.
// Zero principal/radius/increment lanes are the existing unused ABI sentinels,
// NOT an invented sphere or initialized native mass/pose output.
function initialCueBodies(cue){
 need(cue[2]===1&&cue[4]===1&&cue[47]===0&&cue[612]===0x52434342,'uninitialized original cue metadata required');
 const out=new Uint32Array(128),put=(src,dst,n)=>out.set(cue.subarray(src,src+n),dst);
 for(let role=0;role<2;role++){
  const q=64+role*48,d=role*64;put(q,d,13);put(q+16,d+13,3);
  out.set([cue[q+19],cue[q+20],cue[q+21],cue[q+20],cue[q+22],cue[q+23],cue[q+21],cue[q+23],cue[q+24]],d+16);
  put(q+29,d+28,3);put(q+25,d+31,4);put(q+32,d+35,3);put(q+35,d+38,3);put(q+38,d+42,4);put(q+32,d+47,3);
  put(q+13,d+56,3);put(248+role*3,d+59,3);put(613+role*2,d+62,2);
 }return out;
}
/** No user-provided layouts, projections, outputs or continuation bank. */
export async function packThreeBallCreatedOwnerTemplate(seed){
 need(arguments.length===1,'owner template accepts only its locally branded initial seed');assertThreeBallCreatedOwnerSeed(seed);const registration=createThreeBallCreatedInitializationPlan(seed.registration),control=registration.control;
 const roles=seed.cueBroadSeed.roles,slot=h=>{const n=control.template.bodies.findIndex(b=>key(b.handle)===key(h));need(n>=0,'exact generation-bearing scene slot');return n;};
 const cuePrograms=createCueProgramBundle(),broadPrograms=createWorldBroadPrograms();
 const cue=writeCueBridgeInitialState(packCueInitialState(seed.cueInitial,cuePrograms,{sceneSlots:[slot(roles.head),slot(roles.shaft),slot(roles.guide),slot(roles.ball)]}),seed.cueInitial);
 const bodies=new Uint32Array(5*64);seed.balls.forEach((b,i)=>bodies.set(packCanonicalBallBody(b.state),i*64));bodies.set(initialCueBodies(cue),3*64);
 const journal=encodeContactJournal(seed.contactGraphSeed,{bodyColliderOrder:seed.bodyColliderOrder}),roster=encodeContactRoster(seed.solverContactRoster);
 // This source owner has one non-native serialized field: its initial
 // deferred optimizer flag. Reuse its actual initializer, never invent h1 data.
 const sourceBvh=await (NativeBvh.default??globalThis.LabCcdBvhStateExperimental).createReferenceStage(seed.cueBroadSeed);let sourceBvhInitial;
 try{sourceBvhInitial=sourceBvh.snapshot();}finally{sourceBvh.dispose();}
 const nativeBvh=seed.nativeInitial.broad_phase;
 for(const [k,v]of Object.entries(sourceBvhInitial))if(k!=='deferred_optimize_pending')equalData(v,nativeBvh[k],'native t0 BVH field '+k+' must remain exact');
 equalData(Object.keys(nativeBvh).filter(k=>!Object.hasOwn(sourceBvhInitial,k)),['pairs','pair_adjacency'],'native fields outside BVH tree: '+Object.keys(nativeBvh).filter(k=>!Object.hasOwn(sourceBvhInitial,k)).join(','));
 need(sourceBvhInitial.deferred_optimize_pending===false,'unchanged initial source optimizer flag');
 const bvh=packBvhState(sourceBvhInitial,{generations:Array.from({length:25},(_,i)=>seed.nativeColliders.find(c=>c.handle.index===i)?.handle.generation??null),
  removableLeaves:seed.contactGraphSeed.cueColliders.map(h=>h.index),freshOrder:seed.cueBroadSeed.modifiedColliders.map(h=>h.index),firstUpdate:true,initialLeaves:22,minimumLeaves:22,maximumLeaves:25});
 const parts=[],segments={};let count=0;
 const add=(name,data)=>{count=align(count);const words=typeof data==='number'?new Uint32Array(data):data;segments[name]={offset:count,words:words.length};parts.push([count,words]);count+=words.length;return segments[name].offset;};
 add('registration',registration.initialWords);const bodyBase=add('bodies',bodies);add('cue',cue);add('journal',journal);add('roster',roster);add('bvh',bvh);const scratch=add('bvhScratch',BVH_SCRATCH_WORDS);
 const bindings=control.bindings.dynamic.map(b=>({...copy(b),bodyBase:bodyBase+b.canonicalIndex*64}));bindings.push({...copy(control.bindings.guide),bodyBase:U});
 add('broad',encodeWorldBroad(seed.cueBroadSeed,{bindings}));
 const floors=seed.balls.map(b=>packFloorNarrow(b.state));add('floorCaches',Uint32Array.from(floors.flatMap(a=>Array.from(a))));
 add('cueGuardInputs',new Uint32Array(Float32Array.from(seed.cueGuard.pairs.flatMap(p=>p.initialInputs)).buffer));
 const hulls=seed.cueEmptyConvexHulls.map(h=>packSharedConvexHull(h.hull));add('convexHulls',Uint32Array.from(hulls.flatMap(a=>Array.from(a))));
 const initialWords=new Uint32Array(align(count));for(const[at,a]of parts)initialWords.set(a,at);initialWords[segments.bvh.offset+20]=scratch;
 const programs={cue:cuePrograms.program.slice(),broad:broadPrograms.program.slice(),cueGuard:compileGraph(Guard.buildPlan()).program},relocations=[segments.bvh.offset+20,...bindings.filter(b=>b.bodyBase!==U).map((_,i)=>segments.broad.offset+WORLD_BROAD_LAYOUT.bodyOffset+i*WORLD_BROAD_LAYOUT.bodyStride+2)];
 const result=Object.freeze({kind:'resident-three-ball-created-owner-template-v1',version:1,sourceIdentity:seed.initialSnapshotSha256,capability:THREE_BALL_CREATED_OWNER_CAPABILITY,
  counts:freeze({balls:3,dynamicBodies:5,fixedBodies:17,bodySlots:22,colliders:25,initialBvhLeaves:22,maximumBvhLeaves:25,sphereGeometryRows:18,cueFilterPairs:seed.cueGuard.pairs.length,canonicalBodyRows:5}),
  seed,registration,sourceBvhInitial:freeze(sourceBvhInitial),nativeBroadPairs:seed.nativeInitial.broad_phase.pairs,nativeBroadAdjacency:seed.nativeInitial.broad_phase.pair_adjacency,segments:freeze(segments),bindings:freeze(bindings),initialWords,programs:Object.freeze(programs),relocations:freeze(relocations),
  geometryCatalog:seed.geometryCatalog,history:seed.history,game:seed.game,missingLinks:THREE_BALL_ONE_H_MISSING_LINKS});
 for(const a of [initialWords,...Object.values(programs)])Object.preventExtensions(a);
 owned.set(result,{seed,words:initialWords.slice(),programs:Object.fromEntries(Object.entries(programs).map(([k,a])=>[k,a.slice()]))});return result;
}
export function assertThreeBallCreatedOwnerTemplate(plan){
 const p=owned.get(plan);need(p,'locally packed original three-ball owner required');assertThreeBallCreatedOwnerSeed(p.seed);assertThreeBallCreatedInitializationPlan(plan.registration);
 for(const[name,a,expected]of [['initialWords',plan.initialWords,p.words],...Object.entries(p.programs).map(([name,expected])=>[name,plan.programs[name],expected])]){let valid=false;try{valid=a instanceof Uint32Array&&a.length===expected.length&&Uint32Array.prototype.every.call(a,(x,i)=>x===expected[i]);}catch{}need(valid,'initial words/program mutated or detached: '+name);}return plan;
}
export function requireThreeBallOneHOwner(plan){
 need(arguments.length===1,'no injected evaluator/options');assertThreeBallCreatedOwnerTemplate(plan);throw Object.assign(new RangeError('Genuine three-ball initial owner data is admitted; complete one-h source owner is unavailable. No four-ball substitute or physical miss is allowed.'),{code:'three-ball-one-h-owner-unavailable',missingLinks:THREE_BALL_ONE_H_MISSING_LINKS});
}
