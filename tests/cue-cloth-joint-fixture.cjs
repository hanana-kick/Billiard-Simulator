'use strict';
// SPDX-License-Identifier: Apache-2.0
// TEST ONLY: genuine original full-world boundaries seed a prepared numerical
// component, never an autonomous candidate world or per-frame native feedback.
const assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8'),crypto=require('node:crypto'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../../billiard-elevated-flight-oracle/.browser-decoder-evidence/elevated-flight')+path.sep;
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
function load(file){const bytes=fs.readFileSync(file),m=JSON.parse(fs.readFileSync(file+'.json'));assert.equal(hash(bytes),m.sha256);const data=v8.deserialize(bytes);assert.deepEqual(data.identity,m.identity);assert.equal(data.identity.original.engineSha256,'fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4');assert.equal(data.identity.original.sourceRevision,'b716d375efc0201003f0cd9ef7168eee0b62c177');assert.equal(hash(fs.readFileSync(path.resolve(__dirname,'../vendor/rapier.cjs'))),data.identity.original.engineSha256);for(const file of['src/physics.js','src/controller.js','src/math.js','src/game-rules.js','src/render-cadence.js'])assert.equal(hash(fs.readFileSync(path.resolve(__dirname,'..',file))),data.identity.original.sources[file],'Unchanged original '+file);return{data,manifest:m};}
function body(b){const m=b.mprops,l=m.local_mprops;return{linear:copy(b.vels.linvel),angular:copy(b.vels.angvel),translation:copy(b.pos.position.translation),rotation:copy(b.pos.position.rotation),localCom:copy(l.local_com),invMass:copy(m.effective_inv_mass),invInertia:['m11','m12','m13','m22','m23','m33'].map(k=>m.effective_world_inv_inertia[k]),principalFrame:copy(l.principal_inertia_local_frame),invPrincipalInertia:copy(l.inv_principal_inertia),userForce:copy(b.forces.user_force),userTorque:copy(b.forces.user_torque),gravityScale:b.forces.gravity_scale,linearDamping:b.damping.linear_damping,angularDamping:b.damping.angular_damping,gyroscopic:b.forces.gyroscopic_forces_enabled,allowFastRotation:b.ccd.allow_fast_rotation,sleeping:b.activation.sleeping,canSleep:b.activation.normalized_linear_threshold>=0,lockedAxes:m.flags,extraSolverIterations:b.additional_solver_iterations,extraPgsIterations:b.additional_pgs_iterations};}
function joint(j,kind){return{kind,masks:{locked:j.data.locked_axes,limited:j.data.limit_axes,motor:j.data.motor_axes,coupled:j.data.coupled_axes},localFrame1:copy(j.data.local_frame1),localFrame2:copy(j.data.local_frame2),naturalFrequency:j.data.softness.natural_frequency,dampingRatio:j.data.softness.damping_ratio,limits:[j.data.limits[0].min,j.data.limits[0].max]};}
function cueContact(row){return row.contactPairs.find(p=>p.collider1.index===0&&p.collider2.index===25)?.contacts.value.manifolds[0];}
function prepare(row){
 assert.equal(row.candidateInput,false,'Component fixture, not a world-creation seed');
 assert.equal(hash(row.snapshot),row.snapshotSha256,'Original bytes retained');
 assert.ok(row.boundary.endsWith('-preWorld')||row.boundary.endsWith('-preSolve'),'Exact preWorld or verified source pre-solve input required');
 const p=row.state.integration_parameters,shaft=row.bodies.find(b=>b.handle.index===20),head=row.bodies.find(b=>b.handle.index===21),guide=row.bodies.find(b=>b.handle.index===22),q=cueContact(row);
 assert.ok(shaft&&head&&guide&&q);assert.equal(guide.body_type,'Fixed');
 assert.equal(shaft.ccd.ccd_active,false);assert.equal(head.ccd.ccd_active,false);
 assert.deepEqual(q.data.rigid_body1,{index:0,generation:0});assert.deepEqual(q.data.rigid_body2,head.handle);
 assert.equal(q.points.length,1);assert.equal(q.data.solver_contacts.length,1);assert.equal(q.data.relative_dominance,128);
 assert.equal(q.data.solver_color,127);assert.equal(p.friction_model,'Simplified');
 // No other native rigid contact is active on this two-dynamic component.
 const onCue=row.contactPairs.flatMap(pair=>pair.contacts.value.manifolds).filter(m=>[m.data.rigid_body1,m.data.rigid_body2].some(h=>same(h,shaft.handle)||same(h,head.handle))&&m.data.solver_contacts.length);
 assert.deepEqual(onCue,[q]);
 const j=row.joints;assert.equal(j.length,2);assert.equal(j[0].solver_color,0);assert.equal(j[1].solver_color,127);
 const c=q.data.solver_contacts[0],d=q.points[0].data;
 return{kind:'prepared-actual-cue-cloth',bodyCount:4,dynamicBodyCount:2,fixedBodyCount:2,jointCount:2,contactCount:1,ccdSplit:false,solverSubsteps:p.num_solver_iterations,biasedPasses:p.num_internal_pgs_iterations,relaxPasses:p.num_internal_stabilization_iterations,warmstartJoints:p.warmstart_joints,frictionInBiasPass:p.friction_in_bias_pass,dt:p.dt,lengthUnit:p.length_unit,normalizedMaxLinearVelocity:p.normalized_max_linear_velocity,normalizedMaxCorrectiveVelocity:p.normalized_max_corrective_velocity,dynamicFrequency:p.contact_softness.natural_frequency,dynamicDamping:p.contact_softness.damping_ratio,staticFrequency:p.static_contact_softness.natural_frequency,staticDamping:p.static_contact_softness.damping_ratio,warmstartCoefficient:p.warmstart_coefficient,shaft:body(shaft),head:body(head),guide:copy(guide.pos.position),joints:[joint(j[0],'flex'),joint(j[1],'guide')],contact:{kind:'cloth',body1:-1,body2:1,contactCount:1,relativeDominance:q.data.relative_dominance,normal:copy(q.data.normal),anchor1:copy(c.anchor1),anchor2:copy(c.anchor2),dp1:copy(d.solver_dp1),dp2:copy(d.solver_dp2),warmWorld:copy(d.warmstart_tangent_world),warmImpulse:d.warmstart_impulse,impulse:d.impulse,friction:q.data.friction,restitution:q.data.restitution,tangentVelocity:copy(c.tangent_velocity)}};
}
function expected(row){const j=row.joints,q=cueContact(row),d=q.points[0].data;return{shaft:body(row.bodies.find(b=>b.handle.index===20)),head:body(row.bodies.find(b=>b.handle.index===21)),impulses:[...j[0].impulses.slice(3),j[0].impulses[0],...j[1].impulses.slice(3),j[1].impulses[1],j[1].impulses[2],j[1].data.limits[0].impulse],contact:{impulse:d.impulse,warmImpulse:d.warmstart_impulse,warmTangent:copy(d.warmstart_tangent_impulse),warmWorld:copy(d.warmstart_tangent_world)}};}
function fixtures(data,hs=[424,425,426,463]){return hs.map(h=>{const pre=data.rows.find(r=>r.hCount===h&&r.boundary.endsWith('-preWorld')),post=data.rows.find(r=>r.hCount===h&&r.boundary.endsWith('-postWorld'));assert.ok(pre&&post,'Matched original preWorld/postWorld '+h);const a=cueContact(pre),b=cueContact(post);
 // Frozen/recycled narrowphase geometry is byte-for-value unchanged through
 // this native step. Only PRE-world values enter the candidate numerical graph.
 for(const k of['solver_contacts','normal','friction','restitution','relative_dominance'])assert.deepEqual(a.data[k],b.data[k],'Retained source contact '+k);
 for(const k of['solver_dp1','solver_dp2'])assert.deepEqual(a.points[0].data[k],b.points[0].data[k]);
 return{name:'original-fullworld-cuecloth-h'+h,input:prepare(pre),expected:expected(post),preSnapshotSha256:pre.snapshotSha256,postSnapshotSha256:post.snapshotSha256};});}

function preparedFixtures(file,original){
 const bytes=fs.readFileSync(file),manifest=JSON.parse(fs.readFileSync(file+'.json'));assert.equal(hash(bytes),manifest.sha256);const source=v8.deserialize(bytes);assert.equal(source.candidateInput,false);assert.equal(source.initialOnlyWorldRecurrence,false);assert.equal(source.sourceBuild.productionRuntimeChanged,false);assert.equal(source.sourceBuild.original.sourceRevision,'b716d375efc0201003f0cd9ef7168eee0b62c177');
 return source.captures.map(capture=>{const h=capture.h,pre=original.rows.find(r=>r.hCount===h&&r.boundary.endsWith('-preWorld')),post=original.rows.find(r=>r.hCount===h&&r.boundary.endsWith('-postWorld'));assert.ok(pre&&post);assert.equal(capture.inputSha256,pre.snapshotSha256);assert.equal(capture.originalPostSha256,post.snapshotSha256);assert.equal(capture.source.instrumentedAndIndependentPostBytesEqual,true);assert.ok(capture.nativePostDifferences.every(d=>d.signedZeroOnly),'Source-native/WASM differs only in zero sign cache writeback');
 const p=capture.prepared;assert.equal(p.phase,'post-solver-graph');const bodies=p.bodies.bodies.items.flatMap((entry,index)=>entry.value&&typeof entry.value==='object'?[{handle:{index,generation:entry.generation},...copy(entry.value)}]:[]);
 for(const b of bodies){const before=pre.bodies.find(x=>same(x.handle,b.handle));assert.deepEqual(b.pos.position,before.pos.position,'Pre-solve source body pose is genuine preWorld');assert.deepEqual(b.vels,before.vels,'Pre-solve source body velocity is genuine preWorld');}
 const row={...pre,boundary:'source-prepared-cuecloth-h'+h+'-preSolve',state:p,bodies,joints:p.impulse_joints.joint_graph.graph.edges.map(e=>e.weight),contactPairs:p.narrow_phase.contact_graph.graph.edges.map(e=>e.weight)};
 return{name:'original-fullworld-presolve-cuecloth-h'+h,input:prepare(row),expected:expected(post),preSnapshotSha256:pre.snapshotSha256,postSnapshotSha256:post.snapshotSha256,preparedArtifactSha256:manifest.sha256,sourceObserverAgreement:true};
 });
}
module.exports={ROOT,load,body,joint,cueContact,prepare,expected,fixtures,preparedFixtures};
