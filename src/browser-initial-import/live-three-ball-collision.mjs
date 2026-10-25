// SPDX-License-Identifier: Apache-2.0
// Initial collision/connectivity preparation only: no integration, energy scan,
// numerical solve, application step, or committed post-step world is implied.
import {importLiveThreeBallBroad} from './live-three-ball-broad.mjs';
import {flatBalls} from './initial-cloth.mjs';
import * as importedInit from '../experimental-cue-initialization.js';
import * as importedBroad from '../experimental-cue-broad-phase.js';
import * as importedJournal from '../experimental-contact-graph-journal.js';
import * as importedGuard from '../experimental-cue-rigid-exclusion.js';
import * as importedFloor from '../experimental-world-lifecycle.js';
const Init=importedInit.default??globalThis.LabCueInitializationExperimental,Q=importedBroad.default??globalThis.LabCueBroadPhaseExperimental,
 J=importedJournal.default??globalThis.LabContactGraphJournalExperimental,Guard=importedGuard.default??globalThis.LabCueRigidExclusionExperimental,
 Floor=importedFloor.default??globalThis.LabWorldLifecycleExperimental;
const copy=x=>structuredClone(x),same=(a,b)=>a.index===b.index&&a.generation===b.generation;
export const CAPABILITY=Object.freeze({kind:'live-three-ball-initial-collision-preparation',firstSubstepComplete:false,
 wholeShot:false,commitAvailable:false,cpuFallback:false,initialFloorOnly:true,rigidCueContacts:false,
 nativePostCollisionSnapshot:false,newInactiveCueCacheState:false});
export async function createReferenceCollisionPreparation(decoder,input){return create(decoder,input,null);}
export async function createGpuCollisionPreparation(device,decoder,input){
 if(typeof globalThis.GPUDevice!=='function'||!(device instanceof globalThis.GPUDevice))throw TypeError('Actual same-realm GPUDevice required; no CPU fallback');
 return create(decoder,input,device);
}
async function create(decoder,input,device){
 const {seed,projection,broad}=await importLiveThreeBallBroad(decoder,input),origin=broad.initialContactOrigin;
 if(origin.retainedCushions.length||origin.retainedDynamicPairs.length||origin.edges.length!==3)throw RangeError('Initial three-ball collision preparation currently owns only three retained floor contacts');
 const created={...seed.userChanges.created,integration:copy(projection.created.state.integration_parameters)},source={...seed.userChanges,created};
 const find=h=>{const c=created.colliders.find(c=>same(c.handle,h));if(!c)throw RangeError('Source collider missing');return c;};
 const descriptor=h=>{const c=find(h);return {handle:copy(h),groups:copy(c.flags.collision_groups),solverGroups:copy(c.flags.solver_groups),shapeType:c.shape.variant};};
 const registry=projection.application.registry,sceneRegistry={kind:'original-physicslab-initial-scene-registry',snapshotSha256:projection.created.snapshotSha256,staticCount:16,
  objects:registry.objects.map(o=>({...copy(o),primaryCollider:descriptor(o.collider),pairCollider:descriptor(o.pairCollider)})),statics:registry.statics.map(o=>({...copy(o),collider:descriptor(o.collider)}))};
 const balls=flatBalls({objects:registry.objects,roles:source.roles,created},'created',{state:projection.created.typedState});
 for(const ball of balls){const floor=registry.statics.find(s=>s.kind==='cloth'),p=projection.created.contactPairs.find(p=>same(p.collider1,floor.collider)&&same(p.collider2,ball.collider)),rigid=p.contacts.value,m=rigid.manifolds[0],point=m.points[0];
  ball.state.topology.manifoldPresent=!!m;Object.assign(ball.state,{localN1:copy(m.local_n1),feature1:point.fid1,feature2:point.fid2,solverColor:rigid.solver_color});}
 const backend=device?'webgpu':'cpu-reference',token={},owned=[],claimed=[];let q,j,guard,initializer;const floors=[];
 try{
  initializer=device?await Init.createGpuInitializer(device):null;if(initializer)owned.push(initializer);
  q=device?await Q.createLiveRegisteredThreeBallGpuStage(device,broad.broadSeed):await Q.createLiveRegisteredThreeBallReferenceStage(broad.broadSeed);owned.push(q);
  j=device?await J.createGpuStageWithLiveThreeBallCue(device,broad.graphSeed,q):J.createReferenceStageWithLiveThreeBallCue(broad.graphSeed,q);owned.push(j);
  guard=device?await Guard.createGpuGuard(device,{created,roles:source.roles,sceneRegistry}):Guard.createReferenceGuard({created,roles:source.roles,sceneRegistry});owned.push(guard);
  for(const ball of balls){const f=device?await Floor.createGpuSettledContactStage(device,ball.state):Floor.createReferenceSettledContactStage(ball.state);floors.push(f);owned.push(f);}
  for(const component of [q,j,...floors]){component.claim(token);claimed.push(component);}
 }catch(error){for(const c of claimed.reverse())c.release(token);for(const c of owned.reverse())c.dispose();throw error;}
 let busy=false,disposed=false,pending=null;
 const available=()=>{if(busy||disposed)throw Error('Collision preparation unavailable');};
 const cancel=signal=>{if(signal?.aborted)throw signal.reason??new DOMException('Collision preparation cancelled','AbortError');};
 const rollback=()=>{for(const f of floors)f.abort(token);j.abort(token);q.abort(token);pending=null;};
 const snapshot=()=>copy({capability:CAPABILITY,backend,sourceOrigin:projection.sourceOrigin,application:projection.application,
  initialNative:projection.created.state,broad:q.snapshot(),graph:j.snapshot(),phase:'liveRegisteredThreeBallStrikeCreated'});
 return Object.freeze({capability:CAPABILITY,backend,snapshot,
  async prepare({signal}={}){
   available();if(pending)throw Error('Abort prior collision preparation before retry');cancel(signal);busy=true;
   try{
    const numeric=initializer?await initializer.initializeBatch(seed.numericInputs):seed.numericInputs.map(Init.initializeReference);cancel(signal);
    const initialized=Init.initializeLiveRegisteredThreeBallUserChanges(source,Object.fromEntries(numeric.map((n,i)=>[seed.numericInputs[i].role,n])));
    const own=copy(broad.own);own.activeBodyOrder=initialized.manager.awake_island===null?[]:copy(initialized.manager.islands.v[initialized.manager.awake_island].bodies);
    const pre=await q.prepare(own,token),graph=await j.prepare(own.balls.map(({body,translation})=>({body,translation})),token,pre);cancel(signal);
    const geometry=[];
    for(let i=0;i<balls.length;i++)geometry.push(balls[i].state.sleeping?{state:copy(balls[i].state),sourceSleepingCacheRetained:true}:await floors[i].prepare(balls[i].state,token));
    const floor=registry.statics.find(s=>s.kind==='cloth'),transitions=[];
    for(const edge of graph.graph.edges){
     const index=balls.findIndex(b=>same(b.collider,edge.collider2)&&same(floor.collider,edge.collider1));
     if(index>=0){const active=!!geometry[index].state.topology.active;if(active!==edge.active)transitions.push({collider1:edge.collider1,collider2:edge.collider2,active});}
    }
    const exclusion=await guard.check({cue:own.cue,balls:balls.map(b=>({body:b.body,radius:b.radius,translation:b.state.translation,rotation:b.state.rotation}))});cancel(signal);
    const narrow=j.narrowTransitions(transitions,token),collision=Init.finishLiveThreeBallCollisionPhase(initialized,graph.receipt,backend);
    cancel(signal);pending={collision,geometry,exclusion,broad:Q.readReceipt(pre),graph:narrow,initialContactOrigin:copy(origin)};return copy(pending);
   }catch(error){rollback();throw error;}finally{busy=false;}
  },
  abort(){available();rollback();},
  commit(){throw Object.assign(new RangeError('Energy scan and numerical solve are not implemented; collision preparation cannot commit a physics step'),{code:'three-ball-live-first-substep-unavailable'});},
  dispose(){available();rollback();for(const c of claimed.reverse())c.release(token);for(const c of owned.reverse())c.dispose();disposed=true;}
 });
}
