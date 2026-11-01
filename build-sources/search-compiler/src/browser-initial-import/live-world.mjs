// SPDX-License-Identifier: Apache-2.0
// Browser-native, initial-only source projection. Adapted from the proven tests/goal-four-world-seed.cjs.
// Numerical values, generations and caches are copied from verified native bytes;
// this adapter never creates/restores/steps physics or accepts future output.
import '../experimental-live-registered-origin.js';
import {validateSeedEventHistory} from '../source-event-history.mjs';
import * as D from '../../tools/rapier-snapshot-decoder/browser.mjs';
import {requireThat,equal,equalData,plain,hash,journalDigest,copy} from './exact-data.mjs';
import * as importedOrigin from '../experimental-live-registered-origin.js';
const Origin=importedOrigin.default??globalThis.LabLiveRegisteredOriginExperimental;
import * as InitSeed from './live-initialization.mjs';
import * as BroadSeed from './live-broad-graph.mjs';
import * as Three from './initial-cloth.mjs';
import * as Joints from './cue-joints.mjs';
import * as importedHull from '../experimental-cue-convex-topology.js';
const Hull=importedHull.default??globalThis.LabCueConvexTopologyExperimental;
const f=Math.fround,same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation,key=h=>h.index+':'+h.generation;
import * as InitialContacts from './live-initial-contact.mjs';
import * as importedVariant from '../experimental-cue-created-variant.js';
import * as importedRoster from '../experimental-solver-contact-roster.js';
const Variant=importedVariant.default??globalThis.LabCueCreatedVariantExperimental,Roster=importedRoster.default??globalThis.LabSolverContactRosterExperimental;
const SETTINGS={angle:0,elevation:8,tipX:0,tipY:0,speed:2};
const nativeHandle=h=>{const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);};
async function exportInitialSeed(input){
 equalData(Object.keys(input).sort(),['liveRegisteredStrikeCreated','strikeCreationJournal']);
 const row=input.liveRegisteredStrikeCreated,initial=await InitSeed.exportInitialSeed(input),broad=await BroadSeed.exportInitialSeeds(input),initialContactOrigin=copy(broad.initialContactOrigin);
 const provenance={...copy(initial.provenance),placementProvenanceIncluded:false};
 const d={schemaVersion:1,parryVersion:'0.31.1',state:row.typedState,sourceRevision:row.sourceRevision,engineSha256:row.engineSha256,engineVersion:'0.21.0',verification:row.verification,byteLength:row.snapshotBytes,inputSha256:row.snapshotSha256};
 const source=initial.userChanges,roles=source.roles,created={...copy(source.created),snapshot:row.snapshot,integration:copy(row.state.integration_parameters)};
 source.created=created;
 const objects=copy(row.application.registry.objects),selectedIndex=objects.findIndex(o=>o.id===row.application.controller.selectedId);
 requireThat(selectedIndex>=0&&same(objects[selectedIndex].body,roles.ball),'Selected source object identity, never ID/index confusion');
 equal(selectedIndex,row.sourceOrigin.selectedIndex);equal(objects[selectedIndex].id,row.sourceOrigin.selectedId);
 const find=h=>{const c=row.colliders.find(c=>same(c.handle,h));requireThat(c);return c;};
 const descriptor=h=>{const c=find(h);return{handle:copy(h),material:copy(c.material),groups:copy(c.flags.collision_groups),solverGroups:copy(c.flags.solver_groups),shapeType:c.shape.variant};};
 const sceneRegistry={kind:'original-physicslab-initial-scene-registry',snapshotSha256:row.snapshotSha256,staticCount:16,
  objects:objects.map(o=>({...copy(o),primaryCollider:descriptor(o.collider),pairCollider:descriptor(o.pairCollider)})),
  statics:row.application.registry.statics.map(s=>({...copy(s),collider:descriptor(s.collider)}))};
 const record={objects,roles,created};
 const balls=Three.flatBalls(record,'created',d);
 // Preserve source floor cache metadata not packed into the existing singleton
 // arithmetic graph. The fixed-face geometry guard remains mandatory, and the
 // world test compares these retained values at every native cache checkpoint.
 const initialFloor=sceneRegistry.statics.find(s=>s.kind==='cloth');
 for(const ball of balls){const pair=row.contactPairs.find(p=>same(p.collider1,initialFloor.collider.handle)&&same(p.collider2,ball.collider));equal(pair.contacts.variant,'Rigid');const rigid=pair.contacts.value,m=rigid.manifolds[0],point=m.points[0];ball.state.topology.manifoldPresent=!!m;Object.assign(ball.state,{localN1:copy(m.local_n1),feature1:point.fid1,feature2:point.fid2,solverColor:rigid.solver_color});}

 const historyFields=Object.fromEntries(['initialEventHistoryProfile','preStrikeEventHistory','initialEventHistory'].filter(k=>Object.hasOwn(row,k)).map(k=>[k,copy(row[k])]));
 validateSeedEventHistory({...historyFields,kind:'original-live-registered-four-ball-created-world',sourceOrigin:row.sourceOrigin,initialSnapshotSha256:row.snapshotSha256,initialContactEvents:row.application.events.filter(e=>e.kind==='contact')});
 const app=row.application,cue=app.cue,e=await Joints.exportCueJoints(d,Object.fromEntries(Object.entries({shaftBody:cue.shaft,headBody:cue.head,guideBody:cue.guide,flex:cue.flex,prismatic:cue.prismatic}).map(([k,h])=>[k,nativeHandle(h)])),D),[flex,guide]=e.joints;
 const body=q=>({...copy(q),translation:copy(q.pose.translation),rotation:copy(q.pose.rotation)}),ccd=role=>{const b=created.bodies[role];return{ccdEnabled:b.ccd.ccd_enabled,maxCcdSubsteps:4,softCcdPrediction:b.ccd.soft_ccd_prediction,maxExtent:b.mprops.max_extent,ccdThickness:b.ccd.ccd_thickness,force:copy(b.forces.force),torque:copy(b.forces.torque)};};
 const p=app.params;
 const cueInitial={sourceOrigin:copy(row.sourceOrigin),kind:'actual-cue-created-stroke-pre-world',boundary:'source-created-strike-pre-first-h',disconnectedConstraintComponents:true,rigidCueContacts:0,
  cue:{kind:'isolated-actual-cue',componentProjection:'original-shaft-head-fixed-guide',bodyCount:3,jointCount:2,contactCount:0,ccdSplit:false,...e.parameters,dt:f(app.dt/app.strokeSubsteps),shaft:body(flex.body1),head:body(flex.body2),guide:copy(guide.body1.pose),joints:copy(e.joints)},
  ccd:{shaft:ccd('shaft'),head:ccd('head')},sourceCreation:source,initializationInputs:initial.numericInputs,
  application:{environmentContract:'original-controller-live-registered-four-ball-layout',selectedId:app.controller.selectedId,selectedIndex,strikeSettings:copy(app.controller.settings),dt:app.dt,subdivisions:app.strokeSubsteps,initialElapsed:0,initialTime:app.time,started:cue.started,
   axis:['x','y','z'].map(k=>cue.pose.direction[k]),active:false,contacted:false,tangent:[0,0,0],radius:objects[selectedIndex].radius,tipRadius:.006,lateralStiffness:p.cueLateralStiffness,lateralDamping:p.cueLateralDamping,normalStiffness:p.tipNormalStiffness,normalDamping:p.tipNormalDamping,tangentStiffness:p.tipTangentialStiffness,tangentDamping:p.tipTangentialDamping,friction:p.tipFriction}};
 cueInitial.application.fixtureVariant=Origin.FIXTURE_VARIANT;
 const floor=sceneRegistry.statics.find(s=>s.kind==='cloth'),material=c=>({groups:((c.flags.collision_groups.memberships<<16)|c.flags.collision_groups.filter)>>>0,friction:c.material.friction,restitution:c.material.restitution,frictionRule:2,restitutionRule:2,contactSkin:c.contact_skin,parentLocalIdentity:true,mass:c.mprops.variant==='Mass'?c.mprops.value:undefined});
 const globalEdges=copy(broad.graphSeed.edges),floorRank=i=>{const at=globalEdges.findIndex(e=>same(e.collider1,floor.collider.handle)&&same(e.body1,floor.body)&&same(e.collider2,objects[i].collider)&&same(e.body2,objects[i].body));requireThat(at>=0,'Every settled sphere has its exact existing cloth edge');return at;};
 equalData(globalEdges,initialContactOrigin.edges,'Only explicitly imported initial contact origins may enter the world');objects.forEach((_,i)=>floorRank(i));
 const pairSeeds=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]].map(indices=>{
  const {ballIndices,...pairOrigin}=InitialContacts.projectPairOrigin(initialContactOrigin,broad.graphSeed,objects,indices),selected=ballIndices.map(i=>objects[i]);
  return{key:indices.join(''),ballIndices,initialSnapshotSha256:row.snapshotSha256,seed:{sourceOrigin:copy(row.sourceOrigin),kind:'original-live-registered-four-ball-two-body-contact-phase',phase:'post-world-step-post-application',boundary:'liveRegisteredStrikeCreated',initialSnapshotSha256:row.snapshotSha256,initialContactOrigin:copy(initialContactOrigin),
   floorBody:copy(floor.body),floorCollider:copy(floor.collider.handle),floorMaterial:material(find(floor.collider.handle)),bodies:selected.map(o=>({bodyHandle:copy(o.body),primaryCollider:copy(o.collider),pairCollider:copy(o.pairCollider),primaryMaterial:material(find(o.collider)),pairMaterial:material(find(o.pairCollider))})),
   floorOrder:[0,1].sort((a,b)=>floorRank(ballIndices[a])-floorRank(ballIndices[b])),...pairOrigin,globalEdges:copy(globalEdges)}};
 });
 const staticProxies=sceneRegistry.statics.map(s=>{const p=row.proxies.find(p=>p.index===s.collider.handle.index);requireThat(p);return{colliderHandle:copy(s.collider.handle),bodyHandle:copy(s.body),bodyType:'Fixed',groups:material(find(s.collider.handle)).groups,min:copy(p.min),max:copy(p.max)};});
 const rails=sceneRegistry.statics.filter(s=>s.kind==='cushion');equal(rails.length,4);
 const hulls=new Map();for(const c of created.colliders.filter(c=>c.shape.variant==='ConvexPolyhedron'))hulls.set(key(c.handle),await Hull.exportNativeHullBrowser(d,nativeHandle(c.handle),D));
 const cushionSeeds=objects.map((o,i)=>{const primary=find(o.collider);return{sourceOrigin:copy(row.sourceOrigin),kind:'original-selected-cushion-contact-phase',phase:'post-world-step-post-application',boundary:'liveRegisteredStrikeCreated',initialSnapshotSha256:row.snapshotSha256,initialContactOrigin:copy(initialContactOrigin),selectedSingleton:true,
  ballBody:copy(o.body),ballCollider:copy(o.collider),floorBody:copy(floor.body),floorCollider:copy(floor.collider.handle),primaryMaterial:material(primary),pairChannel:material(find(o.pairCollider)),globalEdges:copy(globalEdges),selectedAdjacency:copy(broad.graphSeed.adjacency.find(a=>same(a.collider,o.collider)).incoming),originalStaticColliderCount:16,staticProxies:copy(staticProxies),
  cushions:rails.map((r,j)=>{const co=find(r.collider.handle),m=material(co),p=staticProxies.find(p=>same(p.colliderHandle,co.handle)),retained=initialContactOrigin.retainedCushions.find(c=>c.ballIndex===i&&c.cushionIndex===j);if(retained){requireThat(same(retained.collider1,co.handle)&&same(retained.collider2,o.collider));}return{hull:hulls.get(key(co.handle)),bodyHandle:copy(r.body),colliderHandle:copy(co.handle),identityPose:true,groups:m.groups,frictionRule:2,restitutionRule:2,contactSkin:0,colliderFriction:m.friction,colliderRestitution:m.restitution,friction:f(m.friction*primary.material.friction),restitution:f(m.restitution*primary.material.restitution),proxy:{min:copy(p.min),max:copy(p.max)},cache:retained?copy(retained.cache):{pairPresent:0,pointPresent:0,active:0,recycleValid:0,solverColor:255}};})};});
 const bodyRegistry=Three.registry(d),bodyColliders=objects.map(o=>({body:copy(o.body),colliders:copy(row.bodies.find(b=>same(b.handle,o.body)).colliders)}));
 const cueEmptyConvexHulls=created.colliders.filter(c=>c.shape.variant==='ConvexPolyhedron'&&sceneRegistry.statics.some(r=>same(r.collider.handle,c.handle))).map(c=>({collider:copy(c.handle),body:copy(c.parent.handle),hull:hulls.get(key(c.handle))}));equal(cueEmptyConvexHulls.length,8);
 return{...historyFields,sourceOrigin:copy(row.sourceOrigin),cueEmptyConvexHulls,initialContactOrigin,solverContactRoster:Roster.seedFromSourceSnapshot(row),kind:'original-live-registered-four-ball-created-world',boundary:'liveRegisteredStrikeCreated',initialSnapshotSha256:row.snapshotSha256,selectedIndex,selectedId:app.controller.selectedId,balls,sceneRegistry,staticProxies,globalEdges,bodyRegistry,bodyColliders,cushionSeeds,cueInitial,pairSeeds,pairSeed:pairSeeds[0].seed,contactGraphSeed:broad.graphSeed,cueBroadSeed:broad.broadSeed,game:copy(app.game),sourceApplicationSteps:app.steps,sourceApplicationTime:app.time,initialContactEvents:copy(app.events.filter(e=>e.kind==='contact')),
  provenance};
}
export {exportInitialSeed};
