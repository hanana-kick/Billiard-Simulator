'use strict';
// SPDX-License-Identifier: Apache-2.0
// Initial-only projection of the original controller's strikeCreated snapshot.
// No restored native world, first-h output, future cache, or settling is accepted.
const assert=require('node:assert/strict');
const F=require('./four-ball-created-fixture.cjs'), Three=require('./three-ball-scene-fixture.cjs');
const InitSeed=require('./four-ball-initialization-seed.cjs'), BroadSeed=require('./four-ball-broad-graph-seed.cjs'), ClothSeed=require('./four-ball-cloth-birth-seed.cjs');
const Variant=require('../src/experimental-cue-created-variant');
const Joints=require('../src/experimental-cue-joint-snapshot'),Hull=require('../src/experimental-cue-convex-topology');
const copy=x=>structuredClone(x),f=Math.fround,same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation,key=h=>h.index+':'+h.generation;
const nativeHandle=h=>{const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);};
function exportInitialSeed(input){
 assert.deepEqual(Object.keys(input).sort(),['modeCreationJournal','strikeCreated','strikeCreationJournal']);
 const row=input.strikeCreated,initial=InitSeed.exportInitialSeed(input),broad=BroadSeed.exportInitialSeeds(input),clothBirthSeed=ClothSeed.exportInitialSeed({strikeCreated:row});
 const d={schemaVersion:1,parryVersion:'0.31.1',state:row.typedState,sourceRevision:row.sourceRevision,engineSha256:row.engineSha256,engineVersion:'0.21.0',verification:row.verification,byteLength:row.snapshotBytes,inputSha256:row.snapshotSha256};
 const source=initial.userChanges,roles=source.roles,created={...copy(source.created),snapshot:row.snapshot,integration:copy(row.state.integration_parameters)};
 source.created=created;
 const objects=copy(row.application.registry.objects),selectedIndex=objects.findIndex(o=>o.id===row.application.controller.selectedId);
 assert.ok(selectedIndex>=0&&same(objects[selectedIndex].body,roles.ball),'Selected source object identity, never ID/index confusion');
 Object.assign(created,{sourceSelectedId:row.application.controller.selectedId,sourceSelectedIndex:selectedIndex,sourceSelectedBody:copy(objects[selectedIndex].body)});
 const find=h=>{const c=row.colliders.find(c=>same(c.handle,h));assert.ok(c);return c;};
 const descriptor=h=>{const c=find(h);return{handle:copy(h),material:copy(c.material),groups:copy(c.flags.collision_groups),solverGroups:copy(c.flags.solver_groups),shapeType:c.shape.variant};};
 const sceneRegistry={kind:'original-physicslab-initial-scene-registry',snapshotSha256:row.snapshotSha256,staticCount:16,
  objects:objects.map(o=>({...copy(o),primaryCollider:descriptor(o.collider),pairCollider:descriptor(o.pairCollider)})),
  statics:row.application.registry.statics.map(s=>({...copy(s),collider:descriptor(s.collider)}))};
 const record={objects:objects.slice(0,3),roles,created};
 const balls=Three.flatBalls(record,'created',d);
 const b=created.bodies.freshBall,m=b.mprops,l=m.local_mprops,ii=m.effective_world_inv_inertia,ip=created.integration;
 balls.push({...copy(objects[3]),state:{kind:'original-fresh-fourth-body-without-cloth',translation:copy(b.pos.position.translation),rotation:copy(b.pos.position.rotation),linear:copy(b.vels.linvel),angular:copy(b.vels.angvel),
  radius:find(objects[3].collider).shape.value.radius,invMass:copy(m.effective_inv_mass),invInertia:['m11','m12','m13','m12','m22','m23','m13','m23','m33'].map(k=>ii[k]),
  invPrincipalInertia:copy(l.inv_principal_inertia),principalFrame:copy(l.principal_inertia_local_frame),force:copy(b.forces.force),activation:copy(b.activation),canSleep:true,sleeping:false,ccdEnabled:true,maxCcdSubsteps:4,
  ccdBody:{ccdEnabled:true,maxCcdSubsteps:4,softCcdPrediction:b.ccd.soft_ccd_prediction,maxExtent:m.max_extent,ccdThickness:b.ccd.ccd_thickness,force:copy(b.forces.force),torque:copy(b.forces.torque)},
  dt:f(row.application.dt/row.application.strokeSubsteps),lengthUnit:ip.length_unit,substeps:ip.num_solver_iterations,pgsIterations:ip.num_internal_pgs_iterations,stabilizationIterations:ip.num_internal_stabilization_iterations}});
 const app=row.application,cue=app.cue,e=Joints.exportCueJoints(d,Object.fromEntries(Object.entries({shaftBody:cue.shaft,headBody:cue.head,guideBody:cue.guide,flex:cue.flex,prismatic:cue.prismatic}).map(([k,h])=>[k,nativeHandle(h)])),F.D),[flex,guide]=e.joints;
 const body=q=>({...copy(q),translation:copy(q.pose.translation),rotation:copy(q.pose.rotation)}),ccd=role=>{const b=created.bodies[role];return{ccdEnabled:b.ccd.ccd_enabled,maxCcdSubsteps:4,softCcdPrediction:b.ccd.soft_ccd_prediction,maxExtent:b.mprops.max_extent,ccdThickness:b.ccd.ccd_thickness,force:copy(b.forces.force),torque:copy(b.forces.torque)};};
 const p=app.params;
 const cueInitial={kind:'actual-cue-created-stroke-pre-world',boundary:'source-created-strike-pre-first-h',disconnectedConstraintComponents:true,rigidCueContacts:0,
  cue:{kind:'isolated-actual-cue',componentProjection:'original-shaft-head-fixed-guide',bodyCount:3,jointCount:2,contactCount:0,ccdSplit:false,...e.parameters,dt:f(app.dt/app.strokeSubsteps),shaft:body(flex.body1),head:body(flex.body2),guide:copy(guide.body1.pose),joints:copy(e.joints)},
  ccd:{shaft:ccd('shaft'),head:ccd('head')},sourceCreation:source,initializationInputs:initial.numericInputs,
  application:{fixtureVariant:Variant.FOUR_BALL_SOURCE_INPUT,environmentContract:'original-controller-four-ball-created-layout',selectedId:app.controller.selectedId,selectedIndex,strikeSettings:copy(app.controller.settings),dt:app.dt,subdivisions:app.strokeSubsteps,initialElapsed:0,initialTime:app.time,started:cue.started,
   axis:['x','y','z'].map(k=>cue.pose.direction[k]),active:false,contacted:false,tangent:[0,0,0],radius:objects[selectedIndex].radius,tipRadius:.006,lateralStiffness:p.cueLateralStiffness,lateralDamping:p.cueLateralDamping,normalStiffness:p.tipNormalStiffness,normalDamping:p.tipNormalDamping,tangentStiffness:p.tipTangentialStiffness,tangentDamping:p.tipTangentialDamping,friction:p.tipFriction}};
 Variant.validateCreatedInput(cueInitial);
 const floor=sceneRegistry.statics.find(s=>s.kind==='cloth'),material=c=>({groups:((c.flags.collision_groups.memberships<<16)|c.flags.collision_groups.filter)>>>0,friction:c.material.friction,restitution:c.material.restitution,frictionRule:2,restitutionRule:2,contactSkin:c.contact_skin,parentLocalIdentity:true,mass:c.mprops.variant==='Mass'?c.mprops.value:undefined});
 const globalEdges=copy(broad.graphSeed.edges),floorRank=i=>{const at=globalEdges.findIndex(e=>same(e.collider2,objects[i].collider));return at<0?globalEdges.length:at;};
 const pairSeeds=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]].map(indices=>{
  const ballIndices=indices.slice().sort((a,b)=>objects[a].pairCollider.index-objects[b].pairCollider.index),selected=ballIndices.map(i=>objects[i]);
  const pairAdjacency=selected.map(o=>{const a=broad.graphSeed.adjacency.find(a=>same(a.collider,o.pairCollider));assert.ok(a);assert.equal(a.incoming.length+a.outgoing.length,0);return[];});
  return{key:indices.join(''),ballIndices,initialSnapshotSha256:row.snapshotSha256,seed:{kind:'original-initial-four-ball-two-body-contact-phase',phase:'post-world-step-post-application',boundary:'strikeCreated',initialSnapshotSha256:row.snapshotSha256,
   floorBody:copy(floor.body),floorCollider:copy(floor.collider.handle),floorMaterial:material(find(floor.collider.handle)),bodies:selected.map(o=>({bodyHandle:copy(o.body),primaryCollider:copy(o.collider),pairCollider:copy(o.pairCollider),primaryMaterial:material(find(o.collider)),pairMaterial:material(find(o.pairCollider))})),
   floorOrder:[0,1].sort((a,b)=>floorRank(ballIndices[a])-floorRank(ballIndices[b])),pair:{pairPresent:0,pointPresent:0,active:0,recycleValid:0},globalEdges:copy(globalEdges),pairAdjacency}};
 });
 const staticProxies=sceneRegistry.statics.map(s=>{const p=row.proxies.find(p=>p.index===s.collider.handle.index);assert.ok(p);return{colliderHandle:copy(s.collider.handle),bodyHandle:copy(s.body),bodyType:'Fixed',groups:material(find(s.collider.handle)).groups,min:copy(p.min),max:copy(p.max)};});
 const rails=sceneRegistry.statics.filter(s=>s.kind==='cushion');assert.equal(rails.length,4);
 const cushionSeeds=objects.map((o,i)=>{const primary=find(o.collider);return{kind:i===3?'original-initial-fourth-ball-cushion-contact-phase':'original-selected-cushion-contact-phase',phase:'post-world-step-post-application',...(i===3?{boundary:'strikeCreated',initialSnapshotSha256:row.snapshotSha256}:{}),selectedSingleton:true,
  ballBody:copy(o.body),ballCollider:copy(o.collider),floorBody:copy(floor.body),floorCollider:copy(floor.collider.handle),primaryMaterial:material(primary),pairChannel:material(find(o.pairCollider)),globalEdges:copy(globalEdges),selectedAdjacency:copy(broad.graphSeed.adjacency.find(a=>same(a.collider,o.collider)).incoming),originalStaticColliderCount:16,staticProxies:copy(staticProxies),
  cushions:rails.map(r=>{const co=find(r.collider.handle),m=material(co),p=staticProxies.find(p=>same(p.colliderHandle,co.handle));return{hull:Hull.exportNativeHull(d,nativeHandle(co.handle),F.D),bodyHandle:copy(r.body),colliderHandle:copy(co.handle),identityPose:true,groups:m.groups,frictionRule:2,restitutionRule:2,contactSkin:0,colliderFriction:m.friction,colliderRestitution:m.restitution,friction:f(m.friction*primary.material.friction),restitution:f(m.restitution*primary.material.restitution),proxy:{min:copy(p.min),max:copy(p.max)},cache:{pairPresent:0,pointPresent:0,active:0,recycleValid:0,solverColor:255}};})};});
 const bodyRegistry=Three.registry(d),bodyColliders=objects.map(o=>({body:copy(o.body),colliders:copy(row.bodies.find(b=>same(b.handle,o.body)).colliders)}));
 const cueEmptyConvexHulls=created.colliders.filter(c=>c.shape.variant==='ConvexPolyhedron'&&sceneRegistry.statics.some(r=>same(r.collider.handle,c.handle))).map(c=>({collider:copy(c.handle),body:copy(c.parent.handle),hull:Hull.exportNativeHull(d,nativeHandle(c.handle),F.D)}));assert.equal(cueEmptyConvexHulls.length,8);
 return{cueEmptyConvexHulls,kind:'original-four-ball-created-world',boundary:'strikeCreated',initialSnapshotSha256:row.snapshotSha256,selectedIndex,selectedId:app.controller.selectedId,balls,sceneRegistry,staticProxies,globalEdges,bodyRegistry,bodyColliders,cushionSeeds,cueInitial,clothBirthSeed,pairSeeds,pairSeed:pairSeeds[0].seed,contactGraphSeed:broad.graphSeed,cueBroadSeed:broad.broadSeed,game:copy(app.game)};
}
module.exports={exportInitialSeed};
