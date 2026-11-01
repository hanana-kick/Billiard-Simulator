// SPDX-License-Identifier: Apache-2.0
// Pure initial projection; source lineage and supported boundary are documented
// in docs/browser-initial-four-ball-import.md. No world restore or physics step.
import '../experimental-live-registered-origin.js';
import '../experimental-live-three-ball-origin.js';
import * as D from '../../tools/rapier-snapshot-decoder/browser.mjs';
import * as Three from './initial-cloth.mjs';
import * as I from './initial-body.mjs';
import * as Joints from './cue-joints.mjs';
import * as importedHull from '../experimental-cue-convex-topology.js';
import * as importedVariant from '../experimental-cue-created-variant.js';
const Variant=importedVariant.default??globalThis.LabCueCreatedVariantExperimental;
import {requireThat,equal,equalData,plain,hash,journalDigest,verifyDecoded,copy,assertOwnedInputData} from './exact-data.mjs';
const Hull=importedHull.default??globalThis.LabCueConvexTopologyExperimental;
const F=D.field,f=Math.fround,U=0xffffffff,same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation,key=h=>h.index+':'+h.generation;
const SUPPORTED_SETTINGS=Object.freeze({angle:0,elevation:8,tipX:0,tipY:0,speed:2});
const nativeHandle=h=>{const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);};
const CUE_METHODS = ['createRigidBody', 'createCollider', 'createRigidBody', 'createCollider',
  'createCollider', 'createImpulseJoint', 'setContactsEnabled', 'createRigidBody',
  'createImpulseJoint', 'setLimits', 'setContactsEnabled', 'setLinvel', 'setLinvel'];
const MODE_METHODS = ['createRigidBody', 'createCollider', 'createCollider'];
function descriptor(value) { equal(value?.kind, 'descriptor'); return value.fields; }
function vector(value, keys) { const d = descriptor(value); return keys.map(k => d[k]); }
function bodyStartedDefault(event) {
  const d = descriptor(event.args[0]);
  equal(d.mass, 0); equal(d.massOnly, false);
  equalData(vector(d.centerOfMass, ['x', 'y', 'z']), [0, 0, 0]);
  equalData(vector(d.principalAngularInertia, ['x', 'y', 'z']), [0, 0, 0]);
  equalData(vector(d.angularInertiaLocalFrame, ['x', 'y', 'z', 'w']), [0, 0, 0, 1]);
  for (const key of ['translationsEnabledX', 'translationsEnabledY', 'translationsEnabledZ',
    'rotationsEnabledX', 'rotationsEnabledY', 'rotationsEnabledZ', 'enabled']) equal(d[key], true);
  return true;
}
function journal(rows, methods, phase, row) {
  requireThat(Array.isArray(rows)); equalData(rows.map(e => e.method), methods);
  rows.forEach((e, index) => {
    equal(e.phase, phase); equal(e.nativeStepsBefore, 72); equal(e.nativeStepsAfter, 72);
    requireThat(Number.isInteger(e.order) && e.order < row.apiJournalLength);
    if (index) equal(e.order, rows[index - 1].order + 1);
  });
  return rows.map(e => {
    const out = {method: e.method, handle: copy((e.result || e.target).handle)};
    if (e.method === 'createRigidBody') out.initialLocalMassWasDefault = bodyStartedDefault(e);
    if (e.method === 'createCollider') out.parent = copy(e.args[1].handle);
    if (e.method === 'createImpulseJoint') Object.assign(out, {
      body1: copy(e.args[1].handle), body2: copy(e.args[2].handle), wakeUp: e.args[3]});
    if (e.method === 'setLinvel') Object.assign(out, {
      linear: vector(e.args[0], ['x', 'y', 'z']), wakeUp: e.args[1]});
    if (e.method === 'setLimits' || e.method === 'setContactsEnabled') out.args = copy(e.args);
    return out;
  });
}
function initializationSeed(input) {
  equalData(Object.keys(input).sort(), ['modeCreationJournal', 'strikeCreated', 'strikeCreationJournal']);
  const {strikeCreated: row, modeCreationJournal, strikeCreationJournal} = input;
  equal(row.boundary, 'strikeCreated'); equal(row.candidateInput, true);
  equal(row.sourceRevision, D.SOURCE_REVISION); equal(row.engineSha256, D.ENGINE_SHA256);
  equal(row.nativeSteps, 72); equal(row.application.time, 0); equal(row.application.steps, 0);
  equal(row.application.controller.gameMode, 'four'); equal(row.application.controller.selectedId, row.application.registry.objects[0].id);
  equalData(row.application.controller.settings, SUPPORTED_SETTINGS);
  equal(row.verification.nativeBincodeByteIdentical, true);
  equal(row.verification.javascriptTypedReencodeByteIdentical, true);
  // Re-project the byte-verified typed initial tree, not caller convenience
  // copies of mass, IDs, managers or queues that might contain a later state.
  const state = row.typedState;
  const occupied = field => F(F(F(state, field), field), 'items').items.flatMap((entry, index) =>
    entry.variant === 'Occupied' ? [{handle: {index, generation: Number(F(entry, 'generation').value)},
      ...plain(F(entry, 'value'))}] : []);
  const allBodies = occupied('bodies'), colliders = occupied('colliders');
  equal(allBodies.length, 23); equal(colliders.length, 27);
  const registry = row.application.registry, cue = row.application.cue;
  equal(registry.objects.length, 4); equal(registry.statics.length, 16); requireThat(cue);
  const roles = {ball: copy(registry.objects[0].body), otherBall1: copy(registry.objects[1].body),
    otherBall2: copy(registry.objects[2].body), freshBall: copy(registry.objects[3].body),
    floor: copy(registry.statics.find(s => s.kind === 'cloth').body),
    shaft: copy(cue.shaft), head: copy(cue.head), guide: copy(cue.guide)};
  const bodies = Object.fromEntries(Object.entries(roles).map(([role, handle]) => {
    const body = allBodies.find(b => same(b.handle, handle)); requireThat(body); return [role, copy(body)];
  }));
  const modeEvents = journal(modeCreationJournal, MODE_METHODS, 'modeCreation', row),
    events = journal(strikeCreationJournal, CUE_METHODS, 'strikeCreation', row);
  requireThat(modeCreationJournal.at(-1).order < strikeCreationJournal[0].order);
  const created = {sourceRevision: row.sourceRevision, engineSha256: row.engineSha256,
    boundary: 'strikeCreated', originalFourBallCreation: true, snapshotSha256: row.snapshotSha256,
    bodies, colliders, islands: plain(F(state, 'islands')),
    modifiedBodies: plain(F(F(state, 'bodies'), 'modified_bodies'))[0],
    modifiedColliders: plain(F(F(state, 'colliders'), 'modified_colliders'))[0],
    jointState: plain(F(state, 'impulse_joints'))};
  const freshRoles = ['freshBall', 'shaft', 'head', 'guide'];
  equalData(created.modifiedBodies, freshRoles.map(role => roles[role]));
  equalData(created.modifiedColliders, freshRoles.flatMap(role => bodies[role].colliders));
  const sourceJournal = [...modeCreationJournal, ...strikeCreationJournal];
  const numericInputs = freshRoles.map(role => {
    const b = bodies[role], m = b.mprops, local = m.local_mprops;
    equal(b.changes, 255); requireThat(Object.values(b.ids).every(id => id === 0xffffffff));
    const bodyEvent = sourceJournal.find(e => e.method === 'createRigidBody' && same(e.result.handle, roles[role]));
    requireThat(bodyEvent); equal(bodyStartedDefault(bodyEvent), true);
    const bd = descriptor(bodyEvent.args[0]); equal(bd.status, role === 'guide' ? 1 : 0);
    equalData(vector(bd.translation, ['x', 'y', 'z']).map(f), b.pos.position.translation);
    equalData(vector(bd.rotation, ['x', 'y', 'z', 'w']).map(f), b.pos.position.rotation);
    const attachments = b.colliders.map(handle => {
      const c = colliders.find(c => same(c.handle, handle)); requireThat(c); requireThat(same(c.parent.handle, roles[role]));
      const event = sourceJournal.find(e => e.method === 'createCollider' && same(e.result.handle, handle));
      requireThat(event); requireThat(same(event.args[1].handle, roles[role]));
      const cd = descriptor(event.args[0]), shape = descriptor(cd.shape);
      equal(cd.enabled, true); equal(cd.massPropsMode, 1);
      equal(c.mprops.variant, 'Mass'); equal(f(cd.mass), c.mprops.value);
      equal(f(shape.radius), c.shape.value.radius);
      equal(shape.type, c.shape.variant === 'Ball' ? 0 : 10);
      if (c.shape.variant === 'Cylinder') equal(f(shape.halfHeight), c.shape.value.half_height);
      equalData(vector(cd.translation, ['x', 'y', 'z']).map(f), c.parent.pos_wrt_parent.translation);
      equalData(vector(cd.rotation, ['x', 'y', 'z', 'w']).map(f), c.parent.pos_wrt_parent.rotation);
      return {handle: copy(handle), shape: c.shape.variant, halfHeight: c.shape.value.half_height ?? 0,
        radius: c.shape.value.radius, massMode: c.mprops.variant, mass: c.mprops.value,
        enabled: c.flags.enabled === 'Enabled', localTranslation: copy(c.parent.pos_wrt_parent.translation),
        localRotation: copy(c.parent.pos_wrt_parent.rotation)};
    });
    const attachedEvents = sourceJournal.filter(e => e.method === 'createCollider' && same(e.args[1].handle, roles[role]));
    equalData(attachedEvents.map(e => e.result.handle), b.colliders);
    return I.validate({kind: role === 'freshBall' ? 'source-created-four-ball-body-initialization' : 'source-created-cue-body-initialization',
      sourceRevision: created.sourceRevision, phase: 'post-source-strike-pre-first-h', role,
      bodyType: b.body_type, enabled: b.enabled, lockedAxes: m.flags, initialMaxExtent: m.max_extent,
      additionalLocalMass: m.additional_local_mprops, initialLocalMassWasDefault: true,
      translation: copy(b.pos.position.translation), rotation: copy(b.pos.position.rotation),
      localCom: copy(local.local_com), localInvMass: local.inv_mass,
      invPrincipalInertia: copy(local.inv_principal_inertia), principalFrame: copy(local.principal_inertia_local_frame),
      colliders: attachments, creationColliders: copy(attachments)});
  });
  equal(numericInputs[0].colliders.length, 2);
  equal(bodies.freshBall.ccd.ccd_thickness, f(.03075));
  equal(bodies.freshBall.mprops.max_extent, 0);
  return {kind: 'original-four-ball-initialization-component-seed', numericInputs,
    userChanges: {created, roles, modeEvents, events},
    provenance: {sourceRevision: created.sourceRevision, engineSha256: created.engineSha256,
      initialSnapshotSha256: created.snapshotSha256, boundary: 'strikeCreated', nativeSteps: 72,
      modeCreationJournalSha256: row.modeCreationJournalSha256,
      strikeCreationJournalSha256: row.strikeCreationJournalSha256,
      expectedFirstHStateIncluded: false, broadPhaseBirthImplemented: false, contactBirthImplemented: false}};
}

function graphView(row,colliders=row.colliders){
 const graph=row.state.narrow_phase.contact_graph.graph,by=new Map(row.colliders.map(c=>[c.handle.index,c]));
 const edges=graph.edges.map(({weight:e})=>({collider1:copy(e.collider1),collider2:copy(e.collider2),body1:copy(by.get(e.collider1.index).parent.handle),body2:copy(by.get(e.collider2.index).parent.handle),active:e.contacts.variant==='Rigid'&&e.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)}));
 const adjacency=colliders.map(c=>{const node=graph.nodes.find(n=>same(n.weight,c.handle)),out={collider:copy(c.handle),outgoing:[],incoming:[]};if(node)for(let side=0;side<2;side++){const seen=new Set();let at=node.next[side];while(at!==U){requireThat(!seen.has(at)&&graph.edges[at]);seen.add(at);out[side?'incoming':'outgoing'].push(at);at=graph.edges[at].next[side];}}return out;});return{edges,adjacency};
}
function broadSeeds(input){
 equalData(Object.keys(input).sort(),['modeCreationJournal','strikeCreated','strikeCreationJournal']);
 const {strikeCreated,modeCreationJournal,strikeCreationJournal}=input,row=strikeCreated;
 equal(row.boundary,'strikeCreated');equal(row.candidateInput,true);equal(row.nativeSteps,72);equal(row.sourceRevision,D.SOURCE_REVISION);
 // Rebuild from the exact typed snapshot, rather than trust duplicated plain
 // projections or any pre/postWorld record supplied alongside the input.
 const state=plain(row.typedState);equalData(row.state,state);
 // Body/collider convenience rows are verified against the typed arena here.
 const arena=a=>a.items.flatMap((entry,index)=>entry&&typeof entry==='object'&&'generation' in entry?[{handle:{index,generation:entry.generation},...entry.value}]:[]);
 const nativeBodies=arena(state.bodies.bodies),nativeColliders=arena(state.colliders.colliders);
 equalData(row.bodies,nativeBodies);equalData(row.colliders,nativeColliders);
 const objects=row.application.registry.objects,cue=row.application.cue;
 equal(objects.length,4);equal(row.application.registry.statics.length,16);equal(row.application.steps,0);equal(row.application.time,0);
 const roles={ball:copy(objects[0].body),otherBall1:copy(objects[1].body),otherBall2:copy(objects[2].body),otherBall3:copy(objects[3].body),shaft:copy(cue.shaft),head:copy(cue.head),guide:copy(cue.guide)};
 const colliders=row.colliders.map(c=>{const body=row.bodies.find(b=>same(b.handle,c.parent.handle));requireThat(body);return{...copy(c),bodyType:body.body_type,softCcdPrediction:body.ccd.soft_ccd_prediction};});
 const bodyColliders=row.bodies.filter(b=>b.body_type==='Dynamic'||same(b.handle,roles.guide)).map(b=>({body:copy(b.handle),colliders:copy(b.colliders)}));
 const fourth=objects[3],cloth=row.application.registry.statics.find(s=>s.kind==='cloth');
 const initialFourBallBirth={kind:'original-controller-fourth-sphere-before-first-h',boundary:'strikeCreated',initialSnapshotSha256:row.snapshotSha256,body:copy(fourth.body),primary:copy(fourth.collider),pair:copy(fourth.pairCollider),clothCollider:copy(cloth.collider),modeCreationJournal:copy(modeCreationJournal),strikeCreationJournal:copy(strikeCreationJournal)};
 const broadSeed={kind:'source-created-initial-four-ball-cue-broad-phase',sourceRevision:row.sourceRevision,phase:'original-constructor72-strike-created-before-first-h',constructorNativeSettlingSteps:72,additionalApplicationSettlingSteps:0,initialSnapshotSha256:row.snapshotSha256,createdSnapshotSha256:row.snapshotSha256,sourcePipelineCompleted:true,initialBroadPhase:copy(state.broad_phase),colliders,bodyColliders,modifiedColliders:copy(state.colliders.modified_colliders[0]),roles,lengthUnit:state.integration_parameters.length_unit,normalizedPredictionDistance:state.integration_parameters.normalized_prediction_distance,initialFourBallBirth};
 const proxies=new Map();for(const n of state.broad_phase.tree.nodes)for(const c of[n.left,n.right])if((c.data&0x3fffffff)===1)proxies.set(c.children,{min:copy(c.mins),max:copy(c.maxs)});
 const normalized=colliders.map(c=>({handle:copy(c.handle),body:copy(c.parent.handle),type:c.bodyType,groups:((c.flags.collision_groups.memberships<<16)|c.flags.collision_groups.filter)>>>0,enabled:c.flags.enabled==='Enabled',sensor:c.coll_type!=='Solid',activeCollisionTypes:c.flags.active_collision_types,activeHooks:c.flags.active_hooks,contactSkin:c.contact_skin,parentLocalIdentity:c.parent.pos_wrt_parent.translation.every(x=>x===0)&&c.parent.pos_wrt_parent.rotation.every((x,i)=>x===[0,0,0,1][i]),...(c.bodyType==='Fixed'?copy(proxies.get(c.handle.index)):{})}));
 const graphSeed={kind:'original-initial-four-ball-cue-contact-graph',initialSnapshotSha256:row.snapshotSha256,adaptiveChangeDetectionMargin:false,lengthUnit:broadSeed.lengthUnit,normalizedPredictionDistance:broadSeed.normalizedPredictionDistance,cueColliders:[cue.shaftCollider,cue.tipCollider,cue.neckCollider].map(copy),colliders:normalized,bodies:objects.map((o,i)=>{const co=colliders.find(c=>same(c.handle,o.collider));equal(proxies.has(o.collider.index),i<3);equal(proxies.has(o.pairCollider.index),i<3);return{body:copy(o.body),primary:copy(o.collider),pair:copy(o.pairCollider),radius:co.shape.value.radius,softCcdPrediction:co.softCcdPrediction,...(i<3?copy(proxies.get(o.collider.index)):{proxyAbsent:true})};}),...graphView(row)};
 const pose=body=>({translation:copy(body.pos.position.translation),rotation:copy(body.pos.position.rotation)}),find=h=>row.bodies.find(b=>same(b.handle,h));
 const own={balls:objects.map(o=>({body:copy(o.body),...pose(find(o.body))})),cue:{shaft:pose(find(roles.shaft)),head:pose(find(roles.head))},removedBodies:[],activeBodyOrder:bodyColliders.filter(b=>!same(b.body,roles.guide)).map(b=>copy(b.body))};
 return{broadSeed,graphSeed,own};
}

function clothBirthSeed(input) {
  equalData(Object.keys(input), ['strikeCreated']);
  const row = input.strikeCreated;
  equal(row.boundary, 'strikeCreated'); equal(row.candidateInput, true);
  equal(row.nativeSteps, 72); equal(row.sourceRevision, D.SOURCE_REVISION);
  equal(row.engineSha256, D.ENGINE_SHA256);
  const state = plain(row.typedState); equalData(row.state, state);
  const arena = a => a.items.flatMap((entry, index) => entry && typeof entry === 'object' && 'generation' in entry
    ? [{handle: {index, generation: entry.generation}, ...entry.value}] : []);
  equalData(row.bodies, arena(state.bodies.bodies));
  equalData(row.colliders, arena(state.colliders.colliders));
  const objects = row.application.registry.objects, fourth = objects[3];
  equal(objects.length, 4); equal(row.application.registry.statics.length, 16);
  equal(row.application.steps, 0); equal(row.application.time, 0);
  const cloth = row.application.registry.statics.find(s => s.kind === 'cloth');
  const body = row.bodies.find(b => same(b.handle, fourth.body));
  const ball = row.colliders.find(c => same(c.handle, fourth.collider));
  const passive = row.colliders.find(c => same(c.handle, fourth.pairCollider));
  const floor = row.colliders.find(c => same(c.handle, cloth.collider));
  equal(row.contactPairs.some(p => same(p.collider1, ball.handle) || same(p.collider2, ball.handle)), false);
  const proxies = []; for (const n of state.broad_phase.tree.nodes) for (const c of [n.left, n.right])
    if ((c.data & 0x3fffffff) === 1) proxies.push({index: c.children, min: copy(c.mins), max: copy(c.maxs)});
  equalData(row.proxies, proxies);
  equal(proxies.some(p => p.index === ball.handle.index || p.index === passive.handle.index), false);
  const floorProxy = proxies.find(p => p.index === floor.handle.index); requireThat(floorProxy);
  const ip = state.integration_parameters;
  return {kind: 'original-fourth-ball-first-cloth-birth', boundary: 'strikeCreated', sourceRevision: row.sourceRevision,
    initialSnapshotSha256: row.snapshotSha256, constructorNativeSettlingSteps: 72, additionalApplicationSettlingSteps: 0,
    body: copy(body), ball: copy(ball), passive: copy(passive), floor: copy(floor),
    floorProxy: {min: copy(floorProxy.min), max: copy(floorProxy.max)}, gravity: copy(state.gravity),
    parameters: Object.fromEntries(['dt', 'contact_softness', 'static_contact_softness', 'warmstart_coefficient',
      'length_unit', 'normalized_max_corrective_velocity', 'normalized_prediction_distance', 'normalized_max_linear_velocity',
      'num_solver_iterations', 'num_internal_pgs_iterations', 'num_internal_stabilization_iterations', 'max_ccd_substeps',
      'contact_recycling', 'normalized_contact_recycle_distance', 'friction_in_bias_pass', 'friction_model'].map(k => [k, copy(ip[k])])),
    application: {dt: row.application.dt, strokeSubsteps: row.application.strokeSubsteps},
    initialAbsence: {proxy: true, pair: true, point: true, recycleState: true}};
}

async function worldSeed(input){
 equalData(Object.keys(input).sort(),['modeCreationJournal','strikeCreated','strikeCreationJournal']);
 const row=input.strikeCreated,initial=initializationSeed(input),broad=broadSeeds(input),birthSeed=clothBirthSeed({strikeCreated:row});
 const d={schemaVersion:1,parryVersion:'0.31.1',state:row.typedState,sourceRevision:row.sourceRevision,engineSha256:row.engineSha256,engineVersion:'0.21.0',verification:row.verification,byteLength:row.snapshotBytes,inputSha256:row.snapshotSha256};
 const source=initial.userChanges,roles=source.roles,created={...copy(source.created),snapshot:row.snapshot,integration:copy(row.state.integration_parameters)};
 source.created=created;
 const objects=copy(row.application.registry.objects),selectedIndex=objects.findIndex(o=>o.id===row.application.controller.selectedId);
 requireThat(selectedIndex>=0&&same(objects[selectedIndex].body,roles.ball),'Selected source object identity, never ID/index confusion');
 Object.assign(created,{sourceSelectedId:row.application.controller.selectedId,sourceSelectedIndex:selectedIndex,sourceSelectedBody:copy(objects[selectedIndex].body)});
 const find=h=>{const c=row.colliders.find(c=>same(c.handle,h));requireThat(c);return c;};
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
 const app=row.application,cue=app.cue,e=await Joints.exportCueJoints(d,Object.fromEntries(Object.entries({shaftBody:cue.shaft,headBody:cue.head,guideBody:cue.guide,flex:cue.flex,prismatic:cue.prismatic}).map(([k,h])=>[k,nativeHandle(h)])),D),[flex,guide]=e.joints;
 const body=q=>({...copy(q),translation:copy(q.pose.translation),rotation:copy(q.pose.rotation)}),ccd=role=>{const b=created.bodies[role];return{ccdEnabled:b.ccd.ccd_enabled,maxCcdSubsteps:4,softCcdPrediction:b.ccd.soft_ccd_prediction,maxExtent:b.mprops.max_extent,ccdThickness:b.ccd.ccd_thickness,force:copy(b.forces.force),torque:copy(b.forces.torque)};};
 const p=app.params;
 const cueInitial={kind:'actual-cue-created-stroke-pre-world',boundary:'source-created-strike-pre-first-h',disconnectedConstraintComponents:true,rigidCueContacts:0,
  cue:{kind:'isolated-actual-cue',componentProjection:'original-shaft-head-fixed-guide',bodyCount:3,jointCount:2,contactCount:0,ccdSplit:false,...e.parameters,dt:f(app.dt/app.strokeSubsteps),shaft:body(flex.body1),head:body(flex.body2),guide:copy(guide.body1.pose),joints:copy(e.joints)},
  ccd:{shaft:ccd('shaft'),head:ccd('head')},sourceCreation:source,initializationInputs:initial.numericInputs,
  application:{environmentContract:'original-controller-four-ball-created-layout',selectedId:app.controller.selectedId,selectedIndex,strikeSettings:copy(app.controller.settings),dt:app.dt,subdivisions:app.strokeSubsteps,initialElapsed:0,initialTime:app.time,started:cue.started,
   axis:['x','y','z'].map(k=>cue.pose.direction[k]),active:false,contacted:false,tangent:[0,0,0],radius:objects[selectedIndex].radius,tipRadius:.006,lateralStiffness:p.cueLateralStiffness,lateralDamping:p.cueLateralDamping,normalStiffness:p.tipNormalStiffness,normalDamping:p.tipNormalDamping,tangentStiffness:p.tipTangentialStiffness,tangentDamping:p.tipTangentialDamping,friction:p.tipFriction}};
 cueInitial.application.fixtureVariant=Variant.FOUR_BALL_SOURCE_INPUT;
 const floor=sceneRegistry.statics.find(s=>s.kind==='cloth'),material=c=>({groups:((c.flags.collision_groups.memberships<<16)|c.flags.collision_groups.filter)>>>0,friction:c.material.friction,restitution:c.material.restitution,frictionRule:2,restitutionRule:2,contactSkin:c.contact_skin,parentLocalIdentity:true,mass:c.mprops.variant==='Mass'?c.mprops.value:undefined});
 const globalEdges=copy(broad.graphSeed.edges),floorRank=i=>{const at=globalEdges.findIndex(e=>same(e.collider2,objects[i].collider));return at<0?globalEdges.length:at;};
 const pairSeeds=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]].map(indices=>{
  const ballIndices=indices.slice().sort((a,b)=>objects[a].pairCollider.index-objects[b].pairCollider.index),selected=ballIndices.map(i=>objects[i]);
  const pairAdjacency=selected.map(o=>{const a=broad.graphSeed.adjacency.find(a=>same(a.collider,o.pairCollider));requireThat(a);equal(a.incoming.length+a.outgoing.length,0);return[];});
  return{key:indices.join(''),ballIndices,initialSnapshotSha256:row.snapshotSha256,seed:{kind:'original-initial-four-ball-two-body-contact-phase',phase:'post-world-step-post-application',boundary:'strikeCreated',initialSnapshotSha256:row.snapshotSha256,
   floorBody:copy(floor.body),floorCollider:copy(floor.collider.handle),floorMaterial:material(find(floor.collider.handle)),bodies:selected.map(o=>({bodyHandle:copy(o.body),primaryCollider:copy(o.collider),pairCollider:copy(o.pairCollider),primaryMaterial:material(find(o.collider)),pairMaterial:material(find(o.pairCollider))})),
   floorOrder:[0,1].sort((a,b)=>floorRank(ballIndices[a])-floorRank(ballIndices[b])),pair:{pairPresent:0,pointPresent:0,active:0,recycleValid:0},globalEdges:copy(globalEdges),pairAdjacency}};
 });
 const staticProxies=sceneRegistry.statics.map(s=>{const p=row.proxies.find(p=>p.index===s.collider.handle.index);requireThat(p);return{colliderHandle:copy(s.collider.handle),bodyHandle:copy(s.body),bodyType:'Fixed',groups:material(find(s.collider.handle)).groups,min:copy(p.min),max:copy(p.max)};});
 const rails=sceneRegistry.statics.filter(s=>s.kind==='cushion');equal(rails.length,4);
 const hulls=new Map();for(const c of created.colliders.filter(c=>c.shape.variant==='ConvexPolyhedron'))hulls.set(key(c.handle),await Hull.exportNativeHullBrowser(d,nativeHandle(c.handle),D));
 const cushionSeeds=objects.map((o,i)=>{const primary=find(o.collider);return{kind:i===3?'original-initial-fourth-ball-cushion-contact-phase':'original-selected-cushion-contact-phase',phase:'post-world-step-post-application',...(i===3?{boundary:'strikeCreated',initialSnapshotSha256:row.snapshotSha256}:{}),selectedSingleton:true,
  ballBody:copy(o.body),ballCollider:copy(o.collider),floorBody:copy(floor.body),floorCollider:copy(floor.collider.handle),primaryMaterial:material(primary),pairChannel:material(find(o.pairCollider)),globalEdges:copy(globalEdges),selectedAdjacency:copy(broad.graphSeed.adjacency.find(a=>same(a.collider,o.collider)).incoming),originalStaticColliderCount:16,staticProxies:copy(staticProxies),
  cushions:rails.map(r=>{const co=find(r.collider.handle),m=material(co),p=staticProxies.find(p=>same(p.colliderHandle,co.handle));return{hull:hulls.get(key(co.handle)),bodyHandle:copy(r.body),colliderHandle:copy(co.handle),identityPose:true,groups:m.groups,frictionRule:2,restitutionRule:2,contactSkin:0,colliderFriction:m.friction,colliderRestitution:m.restitution,friction:f(m.friction*primary.material.friction),restitution:f(m.restitution*primary.material.restitution),proxy:{min:copy(p.min),max:copy(p.max)},cache:{pairPresent:0,pointPresent:0,active:0,recycleValid:0,solverColor:255}};})};});
 const bodyRegistry=Three.registry(d),bodyColliders=objects.map(o=>({body:copy(o.body),colliders:copy(row.bodies.find(b=>same(b.handle,o.body)).colliders)}));
 const cueEmptyConvexHulls=created.colliders.filter(c=>c.shape.variant==='ConvexPolyhedron'&&sceneRegistry.statics.some(r=>same(r.collider.handle,c.handle))).map(c=>({collider:copy(c.handle),body:copy(c.parent.handle),hull:hulls.get(key(c.handle))}));equal(cueEmptyConvexHulls.length,8);
 return{cueEmptyConvexHulls,kind:'original-four-ball-created-world',boundary:'strikeCreated',initialSnapshotSha256:row.snapshotSha256,selectedIndex,selectedId:app.controller.selectedId,balls,sceneRegistry,staticProxies,globalEdges,bodyRegistry,bodyColliders,cushionSeeds,cueInitial,clothBirthSeed:birthSeed,pairSeeds,pairSeed:pairSeeds[0].seed,contactGraphSeed:broad.graphSeed,cueBroadSeed:broad.broadSeed,game:copy(app.game)};
}

const CAPTURE_KEYS=['apiJournalLength','application','boundary','candidateInput','modeCreationJournal','nativeSteps','strikeCreationJournal'];
const INPUT_KEYS=['capture','decoded','snapshot'];
const APPLICATION_KEYS=['controller','cue','dt','events','game','nextId','params','registry','revision','shots','steps','strokeSubsteps','time'];
const PARAMS=Object.freeze({gravity:9.81,clothFriction:.2,ballFriction:.04,ballRestitution:.93,cushionFriction:.15,cushionRestitution:.82,clothRestitution:.2,tipFriction:.7,tipNormalStiffness:1000000,tipTangentialStiffness:400000,tipNormalDamping:110,tipTangentialDamping:10,cueLateralStiffness:1200,cueLateralDamping:1,rollingLength:.00045,spinLength:.00035});
function handle(h){requireThat(h&&Object.keys(h).sort().join(',')==='generation,index'&&[h.index,h.generation].every(x=>Number.isInteger(x)&&x>=0&&x<=U&&!Object.is(x,-0)),'Exact generation-bearing source handle required');return{index:h.index,generation:h.generation};}
function canonicalizeCaptureHandles(c){
  // Only mutate the already-owned capture. Transport may reorder object keys,
  // but the unchanged runtime's strict identity checks expect native handle
  // representation {index,generation}. Validate before rebuilding, never drop
  // extra fields, coerce values, infer IDs or reorder unrelated source data.
  const a=c.application;
  for(const o of a.registry.objects)for(const k of ['body','collider','pairCollider'])o[k]=handle(o[k]);
  for(const o of a.registry.statics)for(const k of ['body','collider'])o[k]=handle(o[k]);
  for(const k of ['shaft','head','guide','shaftCollider','tipCollider','neckCollider','flex','prismatic'])a.cue[k]=handle(a.cue[k]);
  const pending=[...c.modeCreationJournal,...c.strikeCreationJournal],seen=new WeakSet();
  while(pending.length){
    const value=pending.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);
    // Source API references in targets, results and nested descriptor args all
    // name their native identity with the explicit `handle` field.
    for(const k of Object.keys(value))if(k==='handle')value[k]=handle(value[k]);else pending.push(value[k]);
  }
}
const exactKeys=(value,keys)=>equalData(Object.keys(value).sort(),keys.slice().sort(),'Unexpected source capture fields');
function validateCapture(c) {
  equalData(Object.keys(c).sort(),CAPTURE_KEYS,'Only the initial boundary and contemporaneous application/journals are accepted');
  equal(c.boundary,'strikeCreated');equal(c.candidateInput,true);equal(c.nativeSteps,72);
  requireThat(Number.isSafeInteger(c.apiJournalLength)&&c.apiJournalLength>=16,'Actual source journal sequence required');
  const a=c.application;equalData(Object.keys(a).sort(),APPLICATION_KEYS);
  exactKeys(a.registry,['staticCount','objects','statics']);equal(a.registry.staticCount,16);
  exactKeys(a.controller,['gameMode','selectedId','paused','settings','undoCount','redoCount']);
  exactKeys(a.cue,['shaft','head','guide','shaftCollider','tipCollider','neckCollider','flex','prismatic','selectedId','pose','started','contacted','contacts','obstructions','stats']);
  exactKeys(a.cue.pose,['direction','side','up','contact','tip','rotation','shaftCenter','surface']);
  for(const [k,v]of Object.entries(a.cue.pose)){exactKeys(v,k==='rotation'?['x','y','z','w']:['x','y','z']);requireThat(Object.values(v).every(Number.isFinite),'Finite source application pose required');}
  exactKeys(a.game,['threeCushion','cueIds','redIds','scores','activeCue','pending','lastResult']);
  exactKeys(a.game.pending,['cueId','reds','foul','threeCushion','cushions','goalCushions']);
  for(const e of [...c.modeCreationJournal,...c.strikeCreationJournal])exactKeys(e,['order','phase','target','method','args','nativeStepsBefore','result','nativeStepsAfter']);
  equal(c.strikeCreationJournal.at(-1)?.order+1,c.apiJournalLength,'Creation journal must end at the captured initial boundary');
  equal(a.time,0);equal(a.steps,0);equal(a.shots,1);equal(a.dt,1/960);equal(a.strokeSubsteps,64);
  equalData(a.params,PARAMS,'Only original default material/cue parameters are currently admitted');
  equal(a.controller.gameMode,'four');equalData(a.controller.settings,SUPPORTED_SETTINGS,'Only original default first-strike settings are currently admitted');
  equal(a.registry.objects.length,4);equal(a.registry.statics.length,16);
  const objects=a.registry.objects,statics=a.registry.statics;
  const ids=objects.map(o=>o.id);requireThat(new Set(ids).size===4&&ids.every(Number.isSafeInteger),'Distinct explicit application object IDs required');
  equal(a.controller.selectedId,ids[0]);equal(a.cue.selectedId,ids[0]);
  const bodies=[...objects,...statics].map(o=>o.body),colliders=[...objects.flatMap(o=>[o.collider,o.pairCollider]),...statics.map(o=>o.collider)];
  [...bodies,...colliders,a.cue.shaft,a.cue.head,a.cue.guide,a.cue.shaftCollider,a.cue.tipCollider,a.cue.neckCollider,a.cue.flex,a.cue.prismatic].forEach(handle);
  equal(new Set(bodies.map(key)).size,20);equal(new Set(colliders.map(key)).size,24);
  objects.forEach((o,i)=>{exactKeys(o,['index','id','label','kind','shape','radius','mass','body','collider','pairCollider']);equal(o.index,i);equal(o.mass,.210);equal(o.radius,.03075);equal(o.kind,'ball');equal(o.shape,'sphere');});
  statics.forEach((o,i)=>{exactKeys(o,['index','label','kind','body','collider']);equal(o.index,i);});equal(statics.filter(o=>o.kind==='cloth').length,1);equal(statics.filter(o=>o.kind==='cushion').length,4);
  const axis=['x','y','z'].map(k=>a.cue.pose.direction[k]);requireThat(axis.every(Number.isFinite)&&Math.abs(axis.reduce((sum,x)=>sum+x*x,0)-1)<1e-10,'Finite source unit cue axis required');
  equal(a.cue.started,0);equal(a.cue.contacted,false);equalData(a.cue.contacts,[]);equalData(a.cue.obstructions,[]);
  equalData(a.cue.stats,{firstContact:null,lastContact:null,peakNormalForce:0,maxCompression:0,normalImpulse:0,contactEpisodes:0});
  equal(a.events.length,1);equal(a.events[0].kind,'stroke');equal(a.events[0].time,0);
  equalData(a.game.cueIds,ids.slice(0,2));equalData(a.game.redIds,ids.slice(2));equal(a.game.activeCue,ids[0]);
  equal(a.game.pending.cueId,ids[0]);equalData(a.game.pending.reds,[]);equal(a.game.pending.foul,false);equal(a.game.pending.cushions,0);equal(a.game.pending.goalCushions,null);
  equal(a.game.pending.threeCushion,a.game.threeCushion);requireThat(typeof a.game.threeCushion==='boolean');
  equalData(Object.keys(a.game.scores).sort(),ids.slice(0,2).map(String).sort());Object.values(a.game.scores).forEach(x=>equal(x,0));
}
function validateBindings(row) {
  const a=row.application,byBody=new Map(row.bodies.map(b=>[key(b.handle),b])),byCollider=new Map(row.colliders.map(c=>[key(c.handle),c]));
  equalData(row.state.gravity,[0,f(-a.params.gravity),0],'Native gravity must match the supported original application parameters');
  for(const o of [...a.registry.objects,...a.registry.statics]) {
    const b=byBody.get(key(o.body));requireThat(b,'Registry body must exist with its exact native generation');
    const attached=o.kind==='ball'?[o.collider,o.pairCollider]:[o.collider];
    equalData(b.colliders,attached,'Source registry must retain all native attachments in their original order');
    for(const h of attached)requireThat(same(byCollider.get(key(h))?.parent?.handle,o.body),'Registry collider parent mismatch');
    equal(b.body_type,o.kind==='ball'?'Dynamic':'Fixed');equal(b.enabled,true);
    if(o.kind==='ball'){
      equal(b.activation.sleeping,false);equal(b.ccd.ccd_enabled,true);
      const primary=byCollider.get(key(o.collider)),pair=byCollider.get(key(o.pairCollider));
      for(const c of [primary,pair]){equal(c.shape.variant,'Ball');equal(c.shape.value.radius,f(o.radius));equal(c.flags.enabled,'Enabled');equal(c.coll_type,'Solid');equal(c.contact_skin,0);equalData(c.parent.pos_wrt_parent,{translation:[0,0,0],rotation:[0,0,0,1],padding:0});}
      equalData(primary.flags.collision_groups,{memberships:1,filter:6,test_mode:'And'});equalData(pair.flags.collision_groups,{memberships:8,filter:8,test_mode:'And'});
      equal(primary.mprops.variant,'Mass');equal(primary.mprops.value,f(o.mass));equal(pair.mprops.variant,'Mass');equal(pair.mprops.value,0);
    }
  }
  for(const h of [a.cue.shaft,a.cue.head]){const b=byBody.get(key(h));requireThat(b,'Actual native cue body required');equalData(b.vels.linvel,['x','y','z'].map(k=>f(a.cue.pose.direction[k]*a.controller.settings.speed)),'Application cue axis must agree with the original native velocity');equalData(b.vels.angvel,[0,0,0]);}
  const floor=a.registry.statics.find(o=>o.kind==='cloth');equal(row.contactPairs.length,3,'Only original three retained floor caches are supported');
  for(const o of a.registry.objects.slice(0,3))requireThat(row.contactPairs.some(p=>same(p.collider1,floor.collider)&&same(p.collider2,o.collider)),'Every original floor cache must be preserved');
  requireThat(row.contactPairs.every(p=>p.contacts.variant==='Rigid'&&p.contacts.value.manifolds.length===1&&p.contacts.value.manifolds[0].points.length===1&&p.contacts.value.manifolds[0].data.solver_contacts.length===1),'No native manifold, point or solver array can be discarded');
}

// The public pure projector owns copies before its first await. It consumes
// real decoder output plus native bytes and explicit source application state,
// never an already-computed seed or a post-shot native state.
export async function projectInitialFourBall(input) {
  assertOwnedInputData(input);
  equalData(Object.keys(input).sort(),INPUT_KEYS,'Only snapshot, decoded tree and initial application capture are accepted');
  requireThat(input.snapshot instanceof Uint8Array&&input.snapshot.length>0&&input.snapshot.length<=D.MAX_BYTES,'Bounded native snapshot required');
  const owned=copy(input);assertOwnedInputData(owned);
  const {snapshot,decoded:d,capture:c}=owned;
  validateCapture(c);canonicalizeCaptureHandles(c);await verifyDecoded(d,snapshot);
  for(const n of D.walk(d.state))if(n.kind==='float')requireThat(Number.isFinite(D.floatValue(n)),'Finite native initial state required');
  const state=plain(d.state),arena=name=>F(F(F(d.state,name),name),'items').items.flatMap((entry,index)=>entry.variant==='Occupied'?[{handle:{index,generation:Number(F(entry,'generation').value)},...plain(F(entry,'value'))}]:[]);
  const proxies=[];for(const n of state.broad_phase.tree.nodes)for(const child of[n.left,n.right])if((child.data&0x3fffffff)===1)proxies.push({index:child.children,min:copy(child.mins),max:copy(child.maxs)});
  const row={boundary:c.boundary,candidateInput:c.candidateInput,nativeSteps:c.nativeSteps,apiJournalLength:c.apiJournalLength,application:c.application,snapshot,sourceRevision:d.sourceRevision,engineSha256:d.engineSha256,snapshotSha256:d.inputSha256,snapshotBytes:d.byteLength,verification:copy(d.verification),typedState:d.state,state,bodies:arena('bodies'),colliders:arena('colliders'),proxies,contactPairs:D.findStructs(F(d.state,'narrow_phase'),'ContactPair').map(plain),modeCreationJournalSha256:await journalDigest(c.modeCreationJournal),strikeCreationJournalSha256:await journalDigest(c.strikeCreationJournal)};
  validateBindings(row);
  return worldSeed({strikeCreated:row,modeCreationJournal:c.modeCreationJournal,strikeCreationJournal:c.strikeCreationJournal});
}

// Convenience composition only. Decoder creation and build-pinned WASM/engine
// provenance stay with the application; this never loads or steps an engine.
export async function importInitialFourBall(decoder,input) {
  assertOwnedInputData(input);
  equalData(Object.keys(input).sort(),['capture','snapshot']);
  requireThat(typeof decoder?.decodeSnapshot==='function','An initialized read-only snapshot decoder is required');
  requireThat(input.snapshot instanceof Uint8Array&&input.snapshot.length>0&&input.snapshot.length<=D.MAX_BYTES,'Bounded native snapshot required');
  const owned=copy(input);assertOwnedInputData(owned);validateCapture(owned.capture);
  const decoded=await decoder.decodeSnapshot(owned.snapshot);
  return projectInitialFourBall({...owned,decoded});
}
