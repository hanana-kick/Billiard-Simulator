'use strict';
// SPDX-License-Identifier: Apache-2.0
// Initial-only projection of the original controller's goalStrikeCreated snapshot.
// No restored native world, first-h output, future cache, or settling is accepted.
const assert=require('node:assert/strict');
const F=require('./four-ball-created-fixture.cjs'), Three=require('./three-ball-scene-fixture.cjs');
const InitSeed=require('./goal-four-initialization-seed.cjs'), BroadSeed=require('./goal-four-broad-graph-seed.cjs'), InitialContacts=require('./goal-four-initial-contact-import.cjs');
const Joints=require('../src/experimental-cue-joint-snapshot'),Hull=require('../src/experimental-cue-convex-topology');
const copy=x=>structuredClone(x),f=Math.fround,same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation,key=h=>h.index+':'+h.generation;
const nativeHandle=h=>{const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);};
const PLACEMENT_KIND='source-artifact-derived-placement-provenance';
const MOVE_METHODS=['propagateModifiedBodyPositionsToColliders','setTranslation','setLinvel','setAngvel','resetForces','resetTorques','propagateModifiedBodyPositionsToColliders','propagateModifiedBodyPositionsToColliders'];
function validatePlacementProvenance(value,row){
 assert.deepEqual(Object.keys(value).sort(),['boundary','initialSnapshotSha256','kind','numericalInput','placementApiJournal','placementApiJournalSha256','placements'].sort());
 assert.equal(value.kind,PLACEMENT_KIND);assert.equal(value.numericalInput,false);
 assert.equal(value.boundary,'goalStrikeCreated');assert.equal(value.initialSnapshotSha256,row.snapshotSha256);
 assert.equal(value.placementApiJournalSha256,F.journalDigest(value.placementApiJournal));
 assert.equal(value.placements.length,4);assert.equal(value.placementApiJournal.length,32);
 assert.deepEqual(value.placements.map(p=>p.id),[1,2,3,4]);
 const finiteArray=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
 const sample=s=>{for(const [name,n]of[['translation',3],['rotation',4],['linear',3],['angular',3],['invInertia',9]])assert.ok(finiteArray(s[name],n));assert.equal(typeof s.sleeping,'boolean');};
 value.placements.forEach((p,index)=>{
  assert.deepEqual(Object.keys(p).sort(),['accepted','after','before','id','method','position']);
  assert.equal(p.method,'LabController.move');assert.equal(p.accepted,true);
  assert.deepEqual(Object.keys(p.position).sort(),['x','y','z']);assert.ok(Object.values(p.position).every(Number.isFinite));
  sample(p.before);sample(p.after);
  const object=row.application.registry.objects.find(o=>o.id===p.id);assert.ok(object);
  const journal=value.placementApiJournal.slice(index*8,index*8+8);
  assert.deepEqual(journal.map(e=>e.method),MOVE_METHODS);
  for(const e of journal){
   assert.equal(e.phase,'placement');assert.equal(e.nativeStepsBefore,72);assert.equal(e.nativeStepsAfter,72);
   assert.ok(Number.isInteger(e.order)&&e.order>=0&&e.order<row.apiJournalLength);
   if(e.method==='propagateModifiedBodyPositionsToColliders'){assert.equal(e.target.kind,'World');assert.deepEqual(e.args,[]);}
   else{assert.equal(e.target.kind,'RigidBody');assert.ok(same(e.target.handle,object.body));}
  }
  const translation=journal[1];assert.equal(translation.args[0].kind,'descriptor');
  assert.deepEqual(translation.args[0].fields,p.position);assert.equal(translation.args[1],true);
  assert.deepEqual(p.after.translation,['x','y','z'].map(k=>f(p.position[k])));
  for(const e of journal.slice(2,4)){assert.equal(e.args[0].kind,'descriptor');assert.deepEqual(e.args[0].fields,{x:0,y:0,z:0});assert.equal(e.args[1],true);}
  for(const e of journal.slice(4,6))assert.deepEqual(e.args,[true]);
 });
 value.placementApiJournal.forEach((e,i,a)=>{if(i)assert.equal(e.order,a[i-1].order+1);});
 return copy(value);
}
// The caller must first use the source artifact loader. This read-only helper
// copies observed move results and the actual API journal, never input geometry,
// beforeStrike, expected h1, score, frames, or any future state.
function placementProvenanceFromRecord(record){
 assert.ok(['original-controller-four-ball-placed-goal-holdout-v1','original-controller-four-ball-cushion-holdout-v1','original-controller-elevated-flight-controller-v1',InitSeed.AWAKE_SOURCE_SCHEMA].includes(record.schema),'Verified original placement or retained-cushion source artifact required');
 assert.equal(record.initialBoundary,'goalStrikeCreated');assert.equal(record.candidateStateUsed,false);assert.equal(record.nativeRestoreUsed,false);
 const row=record.boundaries.goalStrikeCreated,journal=record.apiJournal.filter(e=>e.phase==='placement');
 return validatePlacementProvenance({kind:PLACEMENT_KIND,numericalInput:false,boundary:'goalStrikeCreated',
  initialSnapshotSha256:row.snapshotSha256,placements:copy(record.placements),placementApiJournal:copy(journal),
  placementApiJournalSha256:F.journalDigest(journal)},row);
}
function exportInitialSeed(input,placementProvenance){
 assert.deepEqual(Object.keys(input).sort(),['goalStrikeCreated','strikeCreationJournal']);
 const row=input.goalStrikeCreated,initial=InitSeed.exportInitialSeed(input),broad=BroadSeed.exportInitialSeeds(input),initialContactOrigin=copy(broad.initialContactOrigin);
 const provenance={...copy(initial.provenance),placementProvenanceIncluded:placementProvenance!==undefined,
  ...(placementProvenance===undefined?{}:{placement:validatePlacementProvenance(placementProvenance,row)})};
 const d={schemaVersion:1,parryVersion:'0.31.1',state:row.typedState,sourceRevision:row.sourceRevision,engineSha256:row.engineSha256,engineVersion:'0.21.0',verification:row.verification,byteLength:row.snapshotBytes,inputSha256:row.snapshotSha256};
 const initialReadiness=initial.initialReadiness===undefined?undefined:copy(initial.initialReadiness);
 if(initialReadiness){assert.deepEqual(initialReadiness,provenance.initialReadiness);assert.deepEqual(initialReadiness,initial.userChanges.created.initialReadiness);}
 const source=initial.userChanges,roles=source.roles,created={...copy(source.created),snapshot:row.snapshot,integration:copy(row.state.integration_parameters)};
 source.created=created;
 const objects=copy(row.application.registry.objects),selectedIndex=objects.findIndex(o=>o.id===row.application.controller.selectedId);
 assert.ok(selectedIndex>=0&&same(objects[selectedIndex].body,roles.ball),'Selected source object identity, never ID/index confusion');
 assert.equal(selectedIndex,0);assert.equal(objects[selectedIndex].id,1);
 const find=h=>{const c=row.colliders.find(c=>same(c.handle,h));assert.ok(c);return c;};
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
 for(const ball of balls){const pair=row.contactPairs.find(p=>same(p.collider1,initialFloor.collider.handle)&&same(p.collider2,ball.collider));assert.equal(pair.contacts.variant,'Rigid');const rigid=pair.contacts.value,m=rigid.manifolds[0],point=m.points[0];ball.state.topology.manifoldPresent=!!m;Object.assign(ball.state,{localN1:copy(m.local_n1),feature1:point.fid1,feature2:point.fid2,solverColor:rigid.solver_color});}

 const app=row.application,cue=app.cue,e=Joints.exportCueJoints(d,Object.fromEntries(Object.entries({shaftBody:cue.shaft,headBody:cue.head,guideBody:cue.guide,flex:cue.flex,prismatic:cue.prismatic}).map(([k,h])=>[k,nativeHandle(h)])),F.D),[flex,guide]=e.joints;
 const body=q=>({...copy(q),translation:copy(q.pose.translation),rotation:copy(q.pose.rotation)}),ccd=role=>{const b=created.bodies[role];return{ccdEnabled:b.ccd.ccd_enabled,maxCcdSubsteps:4,softCcdPrediction:b.ccd.soft_ccd_prediction,maxExtent:b.mprops.max_extent,ccdThickness:b.ccd.ccd_thickness,force:copy(b.forces.force),torque:copy(b.forces.torque)};};
 const p=app.params;
 const cueInitial={kind:'actual-cue-created-stroke-pre-world',boundary:'source-created-strike-pre-first-h',disconnectedConstraintComponents:true,rigidCueContacts:0,
  cue:{kind:'isolated-actual-cue',componentProjection:'original-shaft-head-fixed-guide',bodyCount:3,jointCount:2,contactCount:0,ccdSplit:false,...e.parameters,dt:f(app.dt/app.strokeSubsteps),shaft:body(flex.body1),head:body(flex.body2),guide:copy(guide.body1.pose),joints:copy(e.joints)},
  ccd:{shaft:ccd('shaft'),head:ccd('head')},sourceCreation:source,initializationInputs:initial.numericInputs,
  application:{environmentContract:'original-controller-placed-goal-four-ball-layout',selectedId:app.controller.selectedId,selectedIndex,strikeSettings:copy(app.controller.settings),dt:app.dt,subdivisions:app.strokeSubsteps,initialElapsed:0,initialTime:app.time,started:cue.started,
   axis:['x','y','z'].map(k=>cue.pose.direction[k]),active:false,contacted:false,tangent:[0,0,0],radius:objects[selectedIndex].radius,tipRadius:.006,lateralStiffness:p.cueLateralStiffness,lateralDamping:p.cueLateralDamping,normalStiffness:p.tipNormalStiffness,normalDamping:p.tipNormalDamping,tangentStiffness:p.tipTangentialStiffness,tangentDamping:p.tipTangentialDamping,friction:p.tipFriction}};
 const Variant=require('../src/experimental-cue-created-variant');if(!Object.keys(F.SETTINGS).every(k=>app.controller.settings[k]===F.SETTINGS[k]))cueInitial.application.fixtureVariant=Variant.PLACED_FOUR_BALL_SOURCE_INPUT;
 const floor=sceneRegistry.statics.find(s=>s.kind==='cloth'),material=c=>({groups:((c.flags.collision_groups.memberships<<16)|c.flags.collision_groups.filter)>>>0,friction:c.material.friction,restitution:c.material.restitution,frictionRule:2,restitutionRule:2,contactSkin:c.contact_skin,parentLocalIdentity:true,mass:c.mprops.variant==='Mass'?c.mprops.value:undefined});
 const globalEdges=copy(broad.graphSeed.edges),floorRank=i=>{const at=globalEdges.findIndex(e=>same(e.collider1,floor.collider.handle)&&same(e.body1,floor.body)&&same(e.collider2,objects[i].collider)&&same(e.body2,objects[i].body));assert.ok(at>=0,'Every settled sphere has its exact existing cloth edge');return at;};
 assert.deepEqual(globalEdges,initialContactOrigin.edges,'Only explicitly imported initial contact origins may enter the world');objects.forEach((_,i)=>floorRank(i));
 const pairSeeds=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]].map(indices=>{
  const {ballIndices,...pairOrigin}=InitialContacts.projectPairOrigin(initialContactOrigin,broad.graphSeed,objects,indices),selected=ballIndices.map(i=>objects[i]);
  return{key:indices.join(''),ballIndices,initialSnapshotSha256:row.snapshotSha256,seed:{kind:'original-placed-goal-four-ball-two-body-contact-phase',phase:'post-world-step-post-application',boundary:'goalStrikeCreated',initialSnapshotSha256:row.snapshotSha256,initialContactOrigin:copy(initialContactOrigin),
   floorBody:copy(floor.body),floorCollider:copy(floor.collider.handle),floorMaterial:material(find(floor.collider.handle)),bodies:selected.map(o=>({bodyHandle:copy(o.body),primaryCollider:copy(o.collider),pairCollider:copy(o.pairCollider),primaryMaterial:material(find(o.collider)),pairMaterial:material(find(o.pairCollider))})),
   floorOrder:[0,1].sort((a,b)=>floorRank(ballIndices[a])-floorRank(ballIndices[b])),...pairOrigin,globalEdges:copy(globalEdges)}};
 });
 const staticProxies=sceneRegistry.statics.map(s=>{const p=row.proxies.find(p=>p.index===s.collider.handle.index);assert.ok(p);return{colliderHandle:copy(s.collider.handle),bodyHandle:copy(s.body),bodyType:'Fixed',groups:material(find(s.collider.handle)).groups,min:copy(p.min),max:copy(p.max)};});
 const rails=sceneRegistry.statics.filter(s=>s.kind==='cushion');assert.equal(rails.length,4);
 const cushionSeeds=objects.map((o,i)=>{const primary=find(o.collider);return{kind:'original-selected-cushion-contact-phase',phase:'post-world-step-post-application',boundary:'goalStrikeCreated',initialSnapshotSha256:row.snapshotSha256,initialContactOrigin:copy(initialContactOrigin),selectedSingleton:true,
  ballBody:copy(o.body),ballCollider:copy(o.collider),floorBody:copy(floor.body),floorCollider:copy(floor.collider.handle),primaryMaterial:material(primary),pairChannel:material(find(o.pairCollider)),globalEdges:copy(globalEdges),selectedAdjacency:copy(broad.graphSeed.adjacency.find(a=>same(a.collider,o.collider)).incoming),originalStaticColliderCount:16,staticProxies:copy(staticProxies),
  cushions:rails.map((r,j)=>{const co=find(r.collider.handle),m=material(co),p=staticProxies.find(p=>same(p.colliderHandle,co.handle)),retained=initialContactOrigin.retainedCushions.find(c=>c.ballIndex===i&&c.cushionIndex===j);if(retained){assert.ok(same(retained.collider1,co.handle)&&same(retained.collider2,o.collider));}return{hull:Hull.exportNativeHull(d,nativeHandle(co.handle),F.D),bodyHandle:copy(r.body),colliderHandle:copy(co.handle),identityPose:true,groups:m.groups,frictionRule:2,restitutionRule:2,contactSkin:0,colliderFriction:m.friction,colliderRestitution:m.restitution,friction:f(m.friction*primary.material.friction),restitution:f(m.restitution*primary.material.restitution),proxy:{min:copy(p.min),max:copy(p.max)},cache:retained?copy(retained.cache):{pairPresent:0,pointPresent:0,active:0,recycleValid:0,solverColor:255}};})};});
 const bodyRegistry=Three.registry(d),bodyColliders=objects.map(o=>({body:copy(o.body),colliders:copy(row.bodies.find(b=>same(b.handle,o.body)).colliders)}));
 const cueEmptyConvexHulls=created.colliders.filter(c=>c.shape.variant==='ConvexPolyhedron'&&sceneRegistry.statics.some(r=>same(r.collider.handle,c.handle))).map(c=>({collider:copy(c.handle),body:copy(c.parent.handle),hull:Hull.exportNativeHull(d,nativeHandle(c.handle),F.D)}));assert.equal(cueEmptyConvexHulls.length,8);
 return{cueEmptyConvexHulls,initialContactOrigin,solverContactRoster:require('../src/experimental-solver-contact-roster').seedFromSourceSnapshot(row),kind:'original-placed-goal-four-ball-created-world',boundary:'goalStrikeCreated',initialSnapshotSha256:row.snapshotSha256,selectedIndex,selectedId:app.controller.selectedId,balls,sceneRegistry,staticProxies,globalEdges,bodyRegistry,bodyColliders,cushionSeeds,cueInitial,pairSeeds,pairSeed:pairSeeds[0].seed,contactGraphSeed:broad.graphSeed,cueBroadSeed:broad.broadSeed,game:copy(app.game),sourceApplicationSteps:app.steps,sourceApplicationTime:app.time,initialContactEvents:copy(app.events.filter(e=>e.kind==='contact')),
  ...(initialReadiness?{initialReadiness}:{}),provenance};
}
module.exports={exportInitialSeed,placementProvenanceFromRecord,validatePlacementProvenance};
