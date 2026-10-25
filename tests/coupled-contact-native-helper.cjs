'use strict';
// SPDX-License-Identifier: Apache-2.0
// Expected-only prepared-component input. This is NOT an initial-world importer,
// and must never be wired into a candidate runtime or recurrent world owner.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8');
const {execFileSync}=require('node:child_process');
const C=require('./four-ball-created-fixture.cjs');
const f=Math.fround,U=0xffffffff,copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
const PREPARED_PHASE='post-solver-graph';
function occupied(arena){return arena.items.flatMap((entry,index)=>entry&&typeof entry==='object'&&'generation'in entry?[{handle:{index,generation:entry.generation},...entry.value}]:[]);}
function loadOriginal(file,h=555){
 assert.ok(path.isAbsolute(file),'Explicit original oracle artifact required');
 const bytes=fs.readFileSync(file),manifest=JSON.parse(fs.readFileSync(file+'.json','utf8'));
 assert.equal(C.hash(bytes),manifest.sha256);assert.equal(bytes.length,manifest.bytes);
 const original=v8.deserialize(bytes);assert.equal(original.schema,'original-controller-coupled-four-ball-oracle-v1');assert.deepEqual(original.identity,manifest.identity);
 assert.equal(original.identity.original.sourceRevision,C.D.SOURCE_REVISION);assert.equal(original.identity.original.engineSha256,C.D.ENGINE_SHA256);
 assert.equal(C.hash(fs.readFileSync(path.join(__dirname,'../vendor/rapier.cjs'))),C.D.ENGINE_SHA256);
 assert.equal(original.record.candidateStateUsed,false);assert.equal(original.record.nativeRestoreUsed,false);assert.deepEqual(original.setterCalls,[]);
 assert.equal(original.observerAgreement.unobservedOriginalAgreement,true);assert.equal(original.observerAgreement.exactContactAndGameObservables,true);
 const rows=['preWorld','postWorld'].map(phase=>original.rows.find(r=>r.hCount===h&&r.boundary===`expected-only-h${h}-${phase}`));
 assert.ok(rows.every(Boolean),'Original preWorld/postWorld pair required');
 for(const row of rows){assert.equal(row.candidateInput,false);assert.equal(C.hash(row.snapshot),row.snapshotSha256);assert.deepEqual(C.D.encodeLosslessTree(row.typedState),Buffer.from(row.snapshot));assert.deepEqual(C.plain(row.typedState),row.state);}
 assert.equal(rows[0].joints.length,0,'Cue must already be withdrawn; no pending joint replay');
 return {original,manifest,h,pre:rows[0],post:rows[1]};
}
function verifyProbe(binary,provenanceFile){
 assert.ok(path.isAbsolute(binary)&&path.isAbsolute(provenanceFile),'Explicit isolated source probe and provenance required');
 const proof=JSON.parse(fs.readFileSync(provenanceFile,'utf8'));
 assert.equal(proof.original.sourceRevision,C.D.SOURCE_REVISION);assert.equal(proof.productionRuntimeChanged,false);
 assert.equal(C.hash(fs.readFileSync(binary)),proof.binarySha256,'Exact instrumented helper bytes');
 // Require a read-only observation after native graph maintenance, not merely
 // after activation while old solver-body IDs/buckets may still be installed.
 assert.ok(proof.instrumentation.replacements.some(x=>x.marker==='        narrow_phase.maintain_solver_contact_graph(islands, bodies, colliders, multibody_joints);'&&x.position==='after'&&x.inserted.includes('"'+PREPARED_PHASE+'"')),'Actual source graph-maintenance boundary required');
 return {proof,sha256:C.hash(fs.readFileSync(provenanceFile))};
}
function capturePrepared(record,binary,provenanceFile){
 assert.equal(process.env.COUPLED_CONTACT_SERIAL_SLOT,'1','Coordinator native/GPU serial slot required');
 const verified=verifyProbe(binary,provenanceFile);
 const source=JSON.parse(execFileSync(binary,[],{input:record.pre.snapshot,encoding:'utf8',maxBuffer:64*1024*1024,timeout:30000}));
 assert.equal(source.schema,'original-four-ball-scene-source-boundary-v1');assert.equal(source.sourceRevision,C.D.SOURCE_REVISION);assert.equal(source.engineSha256,C.D.ENGINE_SHA256);
 assert.equal(source.inputSha256,record.pre.snapshotSha256);assert.equal(source.originalWasmOracle,false);assert.equal(source.instrumentedAndIndependentPostBytesEqual,true);assert.equal(source.serializedInitialStatePreserved,true);assert.equal(source.serializedInitialQueueOrderPreserved,true);
 assert.deepEqual(source.sourceJointJournal,[]);
 const phases=source.boundaries.map(C.plain),raw=phases.find(x=>x.phase===PREPARED_PHASE);
 assert.ok(raw,'Actual post-narrow/post-activation/post-graph pre-solver snapshot required');
 return {source,raw,provenanceSha256:verified.sha256,nativePostMatchesOriginalBytes:source.nativePostSha256===record.post.snapshotSha256};
}
function bodyInput(body,colliders){
 assert.equal(body.body_type,'Dynamic');assert.equal(body.activation.sleeping,false);assert.equal(body.mprops.flags,0);assert.equal(body.additional_solver_iterations,0);assert.equal(body.additional_pgs_iterations,0);assert.deepEqual(body.mprops.local_mprops.local_com,[0,0,0]);
 const own=colliders.filter(c=>same(c.parent.handle,body.handle));assert.equal(own.length,2,'Original dual sphere channels');assert.ok(own.every(c=>c.shape.variant==='Ball'));
 const m=body.mprops.effective_world_inv_inertia,principal=body.mprops.local_mprops.inv_principal_inertia;
 return {linear:copy(body.vels.linvel),angular:copy(body.vels.angvel),translation:copy(body.pos.position.translation),rotation:copy(body.pos.position.rotation),invMass:copy(body.mprops.effective_inv_mass),invInertia:[m.m11,m.m12,m.m13,m.m12,m.m22,m.m23,m.m13,m.m23,m.m33],principalInertia:principal.map(x=>f(1/x)),invPrincipalInertia:copy(principal),principalFrame:copy(body.mprops.local_mprops.principal_inertia_local_frame),userForce:copy(body.forces.user_force),userTorque:copy(body.forces.user_torque),gravityScale:body.forces.gravity_scale,linearDamping:body.damping.linear_damping,angularDamping:body.damping.angular_damping,gyroscopic:body.forces.gyroscopic_forces_enabled,allowFastRotation:body.ccd.allow_fast_rotation,radius:own[0].shape.value.radius};
}
function prepare(record,capture){
 const raw=capture.raw,nativeBodies=occupied(raw.bodies.bodies),colliders=occupied(raw.colliders.colliders),awake=raw.islands.awake_island;
 assert.notEqual(awake,null);const handles=raw.islands.islands.v[awake].bodies,active=handles.map(h=>nativeBodies.find(b=>same(b.handle,h)));
 assert.equal(nativeBodies.filter(b=>b.body_type==='Dynamic').length,4,'Original four-ball world, not a reduced native fixture');
 assert.equal(active.length,3,'h555 shared component: cue and two awakened reds; opponent is still asleep');
 const bodies=active.map(b=>bodyInput(b,colliders)),p=raw.integration_parameters;
 assert.equal(p.friction_model,'Simplified');assert.equal(p.friction_in_bias_pass,false);
 const input={dt:p.dt,lengthUnit:p.length_unit,normalizedMaxLinearVelocity:p.normalized_max_linear_velocity,dynamicFrequency:p.contact_softness.natural_frequency,dynamicDamping:p.contact_softness.damping_ratio,staticFrequency:p.static_contact_softness.natural_frequency,staticDamping:p.static_contact_softness.damping_ratio,warmstartCoefficient:p.warmstart_coefficient,normalizedMaxCorrectiveVelocity:p.normalized_max_corrective_velocity,frictionInBiasPass:p.friction_in_bias_pass,gravity:copy(raw.gravity),substeps:p.num_solver_iterations,pgsIterations:p.num_internal_pgs_iterations,stabilizationIterations:p.num_internal_stabilization_iterations,bodies,contacts:[]};
 const config={bodyCount:bodies.length,substeps:input.substeps,pgsIterations:input.pgsIterations,stabilizationIterations:input.stabilizationIterations,contacts:[],contactOrder:[]},ordered=[];
 const edges=raw.narrow_phase.contact_graph.graph.edges;
 raw.narrow_phase.solver_contact_graph.buckets.forEach((bucket,color)=>bucket.forEach(ref=>{
  const pair=edges[ref.edge].weight;assert.equal(pair.contacts.variant,'Rigid');const manifold=pair.contacts.value.manifolds[ref.manifold],data=manifold.data;
  assert.equal(data.solver_color,color);assert.equal(manifold.points.length,1);assert.equal(data.solver_contacts.length,1);
  const sc=data.solver_contacts[0],point=manifold.points[sc.contact_id[0]&0x7fffffff];assert.ok(point);
  const first=data.solver_body_ids[0],second=data.solver_body_ids[1],fixed=first===U;
  assert.ok(second<active.length);assert.ok(fixed||first<active.length);
  if(fixed)assert.equal(pair.collider1.index,record.original.record.boundaries.goalStrikeCreated.application.registry.statics.find(x=>x.kind==='cloth').collider.index,'h555 fixed contact is original cloth');
  assert.deepEqual(sc.tangent_velocity,[0,0,0]);assert.equal(point.data.warmstart_twist_impulse,0);
  const spec={kind:fixed?'cloth':'dynamic-sphere',body1:fixed?null:first,body2:second},contact={normal:copy(data.normal),anchor1:copy(sc.anchor1),anchor2:copy(sc.anchor2),dp1:copy(point.data.solver_dp1),dp2:copy(point.data.solver_dp2),warmWorld:copy(point.data.warmstart_tangent_world),warmImpulse:point.data.warmstart_impulse,impulse:point.data.impulse,friction:data.friction,restitution:data.restitution};
  const index=config.contacts.length;config.contacts.push(spec);config.contactOrder.push(index);input.contacts.push(contact);ordered.push({edge:ref.edge,manifold:ref.manifold,color,pair:copy([pair.collider1,pair.collider2]),pointId:sc.contact_id[0]&0x7fffffff,sourceBodyIds:copy(data.solver_body_ids)});
  // The solver reads these frozen geometry fields and never rewrites them.
  // The original independent WASM after-step validates that witness directly.
  const expected=record.post.state.narrow_phase.contact_graph.graph.edges[ref.edge].weight.contacts.value.manifolds[ref.manifold];
  assert.deepEqual(expected.data.normal,data.normal);assert.deepEqual(expected.data.solver_contacts[0].anchor1,sc.anchor1);assert.deepEqual(expected.data.solver_contacts[0].anchor2,sc.anchor2);assert.deepEqual(expected.points[0].data.solver_dp1,point.data.solver_dp1);assert.deepEqual(expected.points[0].data.solver_dp2,point.data.solver_dp2);
 }));
 assert.deepEqual(ordered.map(x=>x.edge),[4,5,0]);assert.deepEqual(ordered.map(x=>x.color),[0,1,127]);
 assert.deepEqual(config.contacts.map(x=>[x.kind,x.body1,x.body2]),[['dynamic-sphere',0,1],['dynamic-sphere',0,2],['cloth',null,0]]);
 for(let i=0;i<active.length;i++){
  const old=record.pre.bodies.find(b=>same(b.handle,active[i].handle));assert.ok(old);
  assert.deepEqual(active[i].pos.position,old.pos.position,'No future solved pose in prepared input');assert.deepEqual(active[i].vels,old.vels,'No future solved velocity in prepared input');
  const expected=record.post.bodies.find(b=>same(b.handle,active[i].handle));assert.equal(expected.ccd.ccd_active,false,'No active CCD clamp in this component witness');
 }
 const sleeping=nativeBodies.filter(b=>b.body_type==='Dynamic'&&b.activation.sleeping);assert.equal(sleeping.length,1);
 const sleepingExpected=record.post.bodies.find(b=>same(b.handle,sleeping[0].handle));assert.deepEqual(sleepingExpected.pos,sleeping[0].pos);assert.deepEqual(sleepingExpected.vels,sleeping[0].vels);
 return {config,input,handles:copy(handles),ordered,scope:'one-h555-prepared-component-in-original-four-ball-world-three-active-bodies',source:capture.source,provenanceSha256:capture.provenanceSha256,nativePostMatchesOriginalBytes:capture.nativePostMatchesOriginalBytes};
}
function expected(record,fixture){
 const bodies=fixture.handles.map(h=>{
  const b=record.post.bodies.find(b=>same(b.handle,h)),m=b.mprops.effective_world_inv_inertia;
  return [...b.vels.linvel,...b.vels.angvel,...b.pos.position.translation,...b.pos.position.rotation,m.m11,m.m12,m.m13,m.m12,m.m22,m.m23,m.m13,m.m23,m.m33,...b.forces.force];
 });
 const contacts=fixture.ordered.map(ref=>{
  const m=record.post.state.narrow_phase.contact_graph.graph.edges[ref.edge].weight.contacts.value.manifolds[ref.manifold],p=m.points[ref.pointId].data;
  return [p.impulse,p.warmstart_impulse,...p.warmstart_tangent_impulse,...p.warmstart_tangent_world];
 });
 return {bodies,contacts};
}
module.exports={PREPARED_PHASE,loadOriginal,verifyProbe,capturePrepared,prepare,expected};
