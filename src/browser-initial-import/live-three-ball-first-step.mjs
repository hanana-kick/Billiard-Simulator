// SPDX-License-Identifier: Apache-2.0
// Bounded source-exact first-substep transaction. No constructor/four-ball alias.
import {importLiveThreeBallStepSeed} from './live-three-ball-step-seed.mjs';
import '../experimental-live-three-ball-origin.js';
import * as ICue from '../experimental-cue-created-stroke-stage.js';
import * as IInit from '../experimental-cue-initialization.js';
import * as IQ from '../experimental-cue-broad-phase.js';
import * as IJ from '../experimental-contact-graph-journal.js';
import * as IG from '../experimental-cue-rigid-exclusion.js';
import * as IL from '../experimental-world-lifecycle.js';
import * as IS from '../experimental-scene-activation.js';
import * as IP from '../experimental-angular-patch.js';
import * as IC from '../experimental-ccd-inactive.js';
import * as IB from '../experimental-ccd-bvh-world-bridge.js';
import * as IE from '../experimental-cue-empty-pair-cache.js';
import * as IH from '../experimental-cue-empty-convex-cache.js';
import * as IW from '../experimental-three-ball-ccd-world.js';
const get=(m,n)=>m.default??globalThis[n],Cue=get(ICue,'LabCueCreatedStrokeStageExperimental'),Init=get(IInit,'LabCueInitializationExperimental'),Q=get(IQ,'LabCueBroadPhaseExperimental'),J=get(IJ,'LabContactGraphJournalExperimental'),Guard=get(IG,'LabCueRigidExclusionExperimental'),Floor=get(IL,'LabWorldLifecycleExperimental'),Scene=get(IS,'LabSceneActivationExperimental'),Patch=get(IP,'LabAngularPatchExperimental'),CCD=get(IC,'LabCcdInactiveExperimental'),Bvh=get(IB,'LabCcdBvhWorldBridgeExperimental'),Empty=get(IE,'LabCueEmptyPairCacheExperimental'),Hull=get(IH,'LabCueEmptyConvexCacheExperimental'),World=get(IW,'LabThreeBallCcdWorldExperimental');
const copy=x=>structuredClone(x),same=(a,b)=>a.index===b.index&&a.generation===b.generation,key=h=>h.index+':'+h.generation,f=Math.fround;
export const CAPABILITY=Object.freeze({kind:'live-three-ball-first-substep',wholeShot:false,maximumSteps:1,cpuFallback:false,initialFloorOnly:true,rigidCueContacts:false});
export const FIRST_OUTER_CAPABILITY=Object.freeze({...CAPABILITY,kind:'live-three-ball-first-outer-substeps',maximumSteps:64});
export const TIP_CONTACT_CAPABILITY=Object.freeze({...CAPABILITY,kind:'live-three-ball-first-tip-contact',maximumSteps:1024,aftermathSubsteps:4,eventBounded:true});
export const createReferenceTipContactOwner=(decoder,input)=>create(decoder,input,null,TIP_CONTACT_CAPABILITY.maximumSteps,true);
export async function createGpuTipContactOwner(device,decoder,input){if(typeof globalThis.GPUDevice!=='function'||!(device instanceof globalThis.GPUDevice))throw TypeError('Actual same-realm GPUDevice required');return create(decoder,input,device,TIP_CONTACT_CAPABILITY.maximumSteps,true);}
export const createReferenceFirstOuterOwner=(decoder,input)=>create(decoder,input,null,64);
export async function createGpuFirstOuterOwner(device,decoder,input){if(typeof globalThis.GPUDevice!=='function'||!(device instanceof globalThis.GPUDevice))throw TypeError('Actual same-realm GPUDevice required');return create(decoder,input,device,64);}
export const createReferenceFirstStepOwner=(decoder,input)=>create(decoder,input,null);
export async function createGpuFirstStepOwner(device,decoder,input){if(typeof globalThis.GPUDevice!=='function'||!(device instanceof globalThis.GPUDevice))throw TypeError('Actual same-realm GPUDevice required');return create(decoder,input,device);}
// Rapier broad_phase_bvh/update.rs:418-429; data/coarena.rs ensure_element_exist.
// Current source insertion/deletion receipts own all changed pairs. Existing stamps and
// adjacency order are retained, while the serialized pair map is key-sorted.
function ownedPairState(seed,receipt,stage,backend,frame,current){
 const r=Q.assertReceipt(receipt,stage,backend,'pre');
 if(r.frame!==(current?.frame??0)||r.initialSnapshotSha256!==seed.initialSnapshotSha256||r.removedColliders.length)throw RangeError('Exact current insertion receipt required for native pair serialization');
 const pairs=copy(current?.ownedBvh.pairs??seed.initialBroadPhase.pairs),pair_adjacency=copy(current?.ownedBvh.pair_adjacency??seed.initialBroadPhase.pair_adjacency),data=pair_adjacency.data;
 for(const e of r.events){
  if(e.kind==='DeletePair'){const index=pairs.findIndex(([p])=>same(p[0],e.collider1)&&same(p[1],e.collider2));if(index<0)throw RangeError('Deleting absent native pair');pairs.splice(index,1);for(const [a,b]of [[e.collider1,e.collider2],[e.collider2,e.collider1]]){const slot=data[a.index];if(slot?.[0]!==a.generation)throw RangeError('Native pair adjacency generation mismatch');const at=slot[1].findIndex(h=>same(h,b));if(at<0)throw RangeError('Native pair adjacency missing endpoint');const last=slot[1].pop();if(at<slot[1].length)slot[1][at]=last;}continue;}
  if(e.kind!=='AddPair'||pairs.some(([p])=>same(p[0],e.collider1)&&same(p[1],e.collider2)))throw RangeError('Initial native pair owner only admits distinct source insertion events');
  pairs.push([[copy(e.collider1),copy(e.collider2)],frame]);
  for(const [a,b] of [[e.collider1,e.collider2],[e.collider2,e.collider1]]){while(data.length<=a.index)data.push([4294967295,[]]);if(data[a.index][0]!==a.generation)data[a.index]=[a.generation,[]];data[a.index][1].push(copy(b));}
 }
 pairs.sort(([a],[b])=>a[0].index-b[0].index||a[0].generation-b[0].generation||a[1].index-b[1].index||a[1].generation-b[1].generation);
 if(pairs.length!==r.after.pairs.length||pairs.some(([p])=>!r.after.pairs.some(e=>same(e.collider1,p[0])&&same(e.collider2,p[1]))))throw RangeError('Full pair-map receipt mismatch');
 return{pairs,pair_adjacency};
}
const ccdInput=(s,next)=>({kind:'dynamic-body-ccd-check',bodyType:'dynamic',sleeping:false,softFrame:false,...copy(s.ccdBody),dt:s.dt,linear:s.linear,angular:s.angular,translation:s.translation,rotation:s.rotation,invMass:s.invMass,invInertia:s.invInertia,localCom:[0,0,0],force:s.force,...(next?{nextTranslation:next.translation,nextRotation:next.rotation}:{})});
async function create(decoder,input,device,maximumSteps=1,eventBounded=false){
 const capability=eventBounded?TIP_CONTACT_CAPABILITY:maximumSteps===1?CAPABILITY:FIRST_OUTER_CAPABILITY;
 const seed=await importLiveThreeBallStepSeed(decoder,input),{projection,broad}=seed,origin=broad.initialContactOrigin,roles=seed.cueInitial.sourceCreation.roles;
 if(origin.retainedCushions.length||origin.retainedDynamicPairs.length||origin.edges.length!==3)throw RangeError('First-step owner requires three retained floor contacts');
 const backend=device?'webgpu':'cpu-reference',token={},owned=[],claimed=[],floors=[],patches=[],emptyConvexStages=[];let cue,q,j,guard,ccd,bvh,emptyCueCache;
 const own=x=>(owned.push(x),x),claim=x=>(x.claim(token),claimed.push(x),x);
 try{
  cue=claim(own(device?await Cue.createGpuPreWorldStage(device,seed.cueInitial):Cue.createReferencePreWorldStage(seed.cueInitial)));
  q=claim(own(device?await Q.createLiveRegisteredThreeBallGpuStage(device,broad.broadSeed):await Q.createLiveRegisteredThreeBallReferenceStage(broad.broadSeed)));
  j=claim(own(device?await J.createGpuStageWithLiveThreeBallCue(device,broad.graphSeed,q):J.createReferenceStageWithLiveThreeBallCue(broad.graphSeed,q)));
  const app=projection.application,created=seed.cueInitial.sourceCreation.created,find=h=>created.colliders.find(c=>same(c.handle,h)),descriptor=h=>{const c=find(h);return{handle:copy(h),groups:copy(c.flags.collision_groups),solverGroups:copy(c.flags.solver_groups),shapeType:c.shape.variant};};
  const sceneRegistry={kind:'original-physicslab-initial-scene-registry',snapshotSha256:projection.created.snapshotSha256,staticCount:16,objects:app.registry.objects.map(o=>({...copy(o),primaryCollider:descriptor(o.collider),pairCollider:descriptor(o.pairCollider)})),statics:app.registry.statics.map(o=>({...copy(o),collider:descriptor(o.collider)}))};
  guard=own(device?await Guard.createGpuGuard(device,{created,roles,sceneRegistry}):Guard.createReferenceGuard({created,roles,sceneRegistry}));
  for(const b of seed.balls){floors.push(claim(own(device?await Floor.createGpuSettledContactStage(device,b.state):Floor.createReferenceSettledContactStage(b.state))));const p={materialKind:'cloth',mass:b.mass,radius:b.radius,gravity:9.81,h:1/61440,rollingLength:.00045,spinLength:.00035};patches.push(own(device?await Patch.createGpuPostWorldStage(device,p):Patch.createReferencePostWorldStage(p)));}
  ccd=own(device?await CCD.createGpuChecker(device):{pre:CCD.preReference,post:CCD.postReference,dispose(){}});
  bvh=own(await(device?Bvh.createGpuStage(device,broad.broadSeed):Bvh.createReferenceStage(broad.broadSeed)));
  emptyCueCache=own(device?await Empty.createGpuStage(device):Empty.createReferenceStage());
  for(const r of seed.cueEmptyConvexHulls)emptyConvexStages.push({hull:r.hull,stage:own(device?await Hull.createGpuStage(device,{hull:r.hull}):Hull.createReferenceStage({hull:r.hull}))});
  q.bindSeparatedCacheOwner(emptyCueCache,guard,token,emptyConvexStages);
 }catch(e){for(const c of claimed.reverse())c.release(token);for(const c of owned.reverse())c.dispose();throw e;}
 let busy=false,disposed=false,pending=null,committed=null,scene=null,floorPrepared=[];
 const check=()=>{if(busy||disposed||committed?.eventBoundary?.complete||(committed?.frame??0)>=maximumSteps)throw Error('Bounded live-three owner unavailable');},cancel=s=>{if(s?.aborted)throw s.reason??new DOMException('Cancelled','AbortError');};
 const rollback=()=>{cue.abort(token);floors.forEach(x=>x.abort(token));j.abort(token);q.abort(token);bvh.abort();if(scene){scene.abort(token);if(!committed){scene.release(token);scene.dispose();scene=null;}}pending=null;};
 const snapshot=()=>copy(committed??{capability,backend,sourceOrigin:projection.sourceOrigin,application:projection.application,initialNative:projection.created.state,phase:projection.boundary});
 const broadInput=(balls,cueBodies,context)=>({cue:copy(cueBodies),balls:balls.map(b=>({body:copy(b.body),translation:b.state.translation.slice(),rotation:b.state.rotation.slice()})),removedBodies:[],activeBodyOrder:context.manager.awake_island===null?[]:copy(context.manager.islands.v[context.manager.awake_island].bodies)});
 return Object.freeze({capability,backend,snapshot,
 async prepare(options={}){if(!options||Object.getPrototypeOf(options)!==Object.prototype||Object.keys(options).some(k=>k!=='signal'))throw TypeError('Only cancellation metadata is accepted; per-step state injection prohibited');const {signal}=options;check();if(pending)throw Error('Abort pending first step before retry');cancel(signal);busy=true;try{
  const frame=committed?.frame??0,balls=copy(committed?.balls??seed.balls),selected=projection.sourceOrigin.selectedIndex,pre=await cue.prepare({selected:balls[selected].state,others:balls.filter((_,i)=>i!==selected).map(b=>b.state)},token);cancel(signal);
  balls[selected].state.linear=pre.linear.slice();balls[selected].state.angular=pre.angular.slice();if(!pre.metadata.cuePresent)throw RangeError('First-step cue removal unsupported');
  const exclusion=await guard.check({cue:pre.metadata.preSolveBodies,balls:balls.map(b=>({body:b.body,translation:b.state.translation,rotation:b.state.rotation,radius:b.radius}))});
  const before=frame===0?pre.metadata.initialization:scene.beginFrame({apiCalls:pre.metadata.mutableBodyCalls.map(c=>({body:roles[c.body],strongWake:c.strongWake})),removedBodies:[]},token),ownPre=broadInput(balls,pre.metadata.preSolveBodies,before);bvh.begin();await bvh.collision(ownPre);await bvh.beforeQueries();
  const receipt=await q.prepare(ownPre,token),graph=await j.prepare(ownPre.balls.map(({body,translation})=>({body,translation})),token,receipt),geometry=[];floorPrepared=[];
  // Original user changes own the wake. Never force activation merely because
  // a tip is near: adopt only the sleeping→awake result of this Scene frame.
  const wokenBodies=[];for(const b of balls){const own=before.bodies.find(x=>same(x.handle,b.body));if(!own)throw RangeError('Owned scene body missing before geometry');if(b.state.sleeping&&own.activation.sleeping===false){b.state.sleeping=false;b.state.activation=copy(own.activation);wokenBodies.push(copy(b.body));}}
  for(let i=0;i<balls.length;i++){const s=balls[i].state;if(s.sleeping){geometry.push({state:copy(s)});floorPrepared.push(false);}else{if(!(await ccd.pre(ccdInput(s))).admitted)throw RangeError('Active CCD not admitted');geometry.push(await floors[i].prepare(s,token));floorPrepared.push(true);}}
  const floor=projection.application.registry.statics.find(x=>x.kind==='cloth'),transitions=[];
  for(const e of graph.graph.edges){const i=balls.findIndex(b=>same(b.collider,e.collider2)&&same(floor.collider,e.collider1));if(i<0){if(!broad.graphSeed.cueColliders.some(h=>same(h,e.collider1)||same(h,e.collider2)))throw RangeError('Unsupported new rigid contact');if(e.active)throw RangeError('Active cue rigid contact');}else{const active=!!geometry[i].state.topology.active;if(active!==e.active)transitions.push({collider1:e.collider1,collider2:e.collider2,active});}}
  const narrow=j.narrowTransitions(transitions,token);
  if(frame===0){const collision=Init.finishLiveThreeBallCollisionPhase(before,graph.receipt,backend),bodies=copy(collision.bodies);
   for(const b of seed.bodyRegistry)if(!bodies.some(x=>same(x.handle,b.handle)))bodies.push(copy(b));
   const context={...collision,kind:'source-scene-activation',noOtherPendingChanges:true,bodies};scene=await(device?Scene.createGpuStage(device,context):Scene.createReferenceStage(context));scene.claim(token);scene.beginFrame({apiCalls:[],removedBodies:[]},token);
  }else if(pre.metadata.initialization)throw RangeError('Recurrent step cannot reinitialize original source');
  const next={frame,balls,globalEdges:copy(narrow.after.edges),emptyCuePairs:copy(committed?.emptyCuePairs??[]),emptyCueConvexPairs:copy(committed?.emptyCueConvexPairs??[])};await World.prepareEmptyCueCaches(seed,{emptyCueCache},next,pre.metadata,narrow,exclusion,backend);await World.prepareEmptyConvexCaches(seed,{emptyConvexStages},next,pre.metadata,narrow,exclusion,backend);cancel(signal);
  const connectivity={kind:'owned-rigid-contact-connectivity',bodyColliders:broad.broadSeed.bodyColliders.filter(b=>balls.some(x=>same(x.body,b.body))),colliders:broad.graphSeed.colliders.filter(c=>narrow.after.liveColliders.some(h=>same(h,c.handle))).map(c=>({handle:c.handle,body:c.body})),edges:narrow.after.edges,adjacency:narrow.after.adjacency};
  const physical=geometry.map((p,i)=>({handle:balls[i].body,...copy(p.state)}));for(const role of ['shaft','head'])physical.push({handle:roles[role],...copy(pre.metadata.preSolveBodies[role]),gravity:[0,f(-9.81),0]});
  const observed=await scene.observe(physical,{dt:f(1/61440),lengthUnit:balls[0].state.lengthUnit,connectivity},narrow.operations,token),by=new Map(observed.bodies.map(b=>[key(b.handle),b])),modified=[],prePatchBalls=[];
  for(const role of ['shaft','head']){const a=by.get(key(roles[role]));if(!a||a.activation.sleeping||a.force.some(x=>x!==0)||a.torque.some(x=>x!==0))throw RangeError('Disconnected cue requires awake zero force');}
  for(let i=0;i<balls.length;i++){const a=by.get(key(balls[i].body)),entry=balls[i].state;if(!a){if(!entry.sleeping)throw RangeError('Missing active body');prePatchBalls.push(copy(entry));continue;}let s;if(a.activation.sleeping)s=floors[i].skipSleeping({activation:a.activation,activationPhase:a.activationPhase,force:a.force},token).state;else{s=(await floors[i].solvePrepared({activation:a.activation,activationPhase:a.activationPhase,ccdPhase:'source-prediction-inactive'},token)).state;if(!(await ccd.post(ccdInput(entry,s))).admitted)throw RangeError('Post-solve CCD not admitted');}s.force=a.force.slice();s.ccdBody.force=a.force.slice();s.ccdBody.torque=a.torque.slice();prePatchBalls.push(copy(s));if(!a.activation.sleeping){const patch=await patches[i].step(s);s.angular=patch.angular.slice();if(patch.metadata.requiresModifiedBodyTracking)modified.push(balls[i].body);}balls[i].state=s;}
  const postScene=scene.postApplication(modified,token),solvedCue={shaft:pre.metadata.jointResult.shaft,head:pre.metadata.jointResult.head};
  await bvh.moved(broadInput(balls,solvedCue,observed.context));const post=await q.postSolve(broadInput(balls,solvedCue,postScene),token),postGraph=await j.postSolve(balls.map(b=>({body:b.body,translation:b.state.translation})),token,post);
  for(let i=0;i<balls.length;i++){balls[i].state.topology.ballMin=copy(postGraph.proxies[i].min);balls[i].state.topology.ballMax=copy(postGraph.proxies[i].max);}
  cancel(signal);cue.assertPrepared(token);j.assertPrepared(token);q.assertPrepared(token);scene.assertPrepared(token);floors.forEach((p,i)=>{if(floorPrepared[i])p.assertPrepared(token);});
  const tipEvents=copy(committed?.tipEvents??[]),time=committed?.time??projection.application.time;
  if(pre.metadata.birth){const point=pre.metadata.tip.pointF32;tipEvents.push({kind:'contact',label:balls[selected].label+' ↔ 큐 팁',time,position:{x:point[0],y:point[1],z:point[2]},selectedId:balls[selected].id,selectedIndex:selected,body:copy(balls[selected].body),frame:frame+1});}
  const firstTipContact=committed?.firstTipContact??(pre.metadata.birth?{frame:frame+1,time,selectedId:balls[selected].id,selectedIndex:selected,body:copy(balls[selected].body)}:null),eventBoundary=eventBounded?{kind:'first-compliant-tip-contact',firstContactFrame:firstTipContact?.frame??null,aftermathSubsteps:capability.aftermathSubsteps,complete:firstTipContact!==null&&frame+1>=firstTipContact.frame+capability.aftermathSubsteps}:null;
  pending={capability,backend,tipEvents,firstTipContact:copy(firstTipContact),eventBoundary,wokenBodies,frame:frame+1,outerSubstep:(frame+1)%64,outerStep:Math.floor((frame+1)/64),time:(committed?.time??projection.application.time)+1/61440,globalEdges:copy(postGraph.edges),phase:'post-world-step-post-application',sourceOrigin:copy(projection.sourceOrigin),balls,prePatchBalls,cue:copy(pre.metadata.jointResult),cueMetadata:copy(pre.metadata),scene:copy(postScene),nativeScene:copy(observed.context),contactGraph:copy(postGraph),ownedBvh:{...bvh.stage.preview(),...ownedPairState(broad.broadSeed,receipt,q,backend,bvh.stage.preview().frame_index,committed)},emptyCuePairs:next.emptyCuePairs??[],emptyCueConvexPairs:next.emptyCueConvexPairs??[],contactEvents:copy(narrow.contactEvents)};return copy(pending);
 }catch(e){rollback();throw e;}finally{busy=false;}},
 abort(){check();rollback();},commit(){check();if(!pending)throw Error('Prepared first step required');cue.assertPrepared(token);q.assertPrepared(token);j.assertPrepared(token);scene.assertPrepared(token);floors.forEach((p,i)=>{if(floorPrepared[i])p.assertPrepared(token);});cue.commit(token);floors.forEach((p,i)=>{if(floorPrepared[i])p.commit(token);});j.commit(token);q.commit(token);scene.commit(token);bvh.commit();committed=pending;pending=null;return snapshot();},
 dispose(){if(busy)throw Error('Owner busy');if(disposed)return;rollback();if(scene){scene.release(token);scene.dispose();scene=null;}for(const c of claimed.reverse())c.release(token);for(const c of owned.reverse())c.dispose();disposed=true;}
 });
}
