/* SPDX-License-Identifier: Apache-2.0
 * Rapier b716d375efc0201003f0cd9ef7168eee0b62c177 / Parry 0.31.1.
 * Bounded first fourth-ball cloth cache creation. See vendor/RAPIER-LICENSE.txt.
 * No native runtime, future-state input, global graph commit, or full-shot claim.
 */
(function(G) {'use strict';
const common = typeof module !== 'undefined' && module.exports;
const A = common ? require('./experimental-arithmetic-graph') : G.LabArithmeticGraphExperimental;
const R = common ? require('./experimental-stage-runtime') : G.LabStageRuntimeExperimental;
const Broad = common ? require('./experimental-cue-broad-phase') : G.LabCueBroadPhaseExperimental;
const L = common ? require('./experimental-world-lifecycle') : G.LabWorldLifecycleExperimental;
const C = common ? require('./experimental-world-stepper') : G.LabWorldStepperExperimental;
const f = Math.fround, copy = x => structuredClone(x), U = 0xffffffff;
const SOURCE = 'b716d375efc0201003f0cd9ef7168eee0b62c177', brands = new WeakMap(), receipts = new WeakMap();
const need = (p, m) => { if (!p) throw RangeError(m); }, exact = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const vector = (a, n) => Array.isArray(a) && a.length === n && a.every(x => Number.isFinite(x) && x === f(x));
const CAPABILITY = Object.freeze({wholeWorld: false, firstHOnly: true, initialSnapshotOnly: true,
  ownFreshAabb: true, ownGeometryCacheBirth: true, numericalPhaseOnly: true,
  activationOwned: false, globalGraphOwned: false, collisionManagerComplete: false, fullShotParity: false,
  liveJournalBinding: true, preparedLifecycleHandover: true});
// Loaded lazily because the real Journal consumer may import this adapter.
// An injected look-alike API cannot mint or validate a graph binding.
const journal = () => common ? require('./experimental-contact-graph-journal') : G.LabContactGraphJournalExperimental;
function validate(input) {
  const s = copy(input);
  need(s.kind === 'original-fourth-ball-first-cloth-birth' && s.boundary === 'strikeCreated' && s.sourceRevision === SOURCE,
    'Only original strikeCreated may initialize fourth cloth birth');
  need(Object.keys(s).sort().join(',') === ['kind', 'boundary', 'sourceRevision', 'initialSnapshotSha256',
    'constructorNativeSettlingSteps', 'additionalApplicationSettlingSteps', 'body', 'ball', 'passive', 'floor',
    'floorProxy', 'gravity', 'parameters', 'application', 'initialAbsence'].sort().join(','), 'No future-state or cache input permitted');
  need(/^[a-f0-9]{64}$/.test(s.initialSnapshotSha256) && s.constructorNativeSettlingSteps === 72 && s.additionalApplicationSettlingSteps === 0,
    'Explicit unprepared original source identity required');
  const b = s.body, p = s.parameters;
  need(exact(b.handle, {index: 19, generation: 0}) && b.body_type === 'Dynamic' && b.changes === 255 && b.enabled === true,
    'Original fresh fourth body required');
  need(Object.values(b.ids).length === 4 && Object.values(b.ids).every(v => v === U) && b.mprops.max_extent === 0,
    'Fresh source IDs and zero deferred extent must not be reseeded');
  need(exact(s.initialAbsence, {proxy: true, pair: true, point: true, recycleState: true}), 'Fourth cloth cache must be absent initially');
  need(exact(b.colliders, [{index: 22, generation: 0}, {index: 23, generation: 0}]), 'Exact primary/passive source channels required');
  need(exact(b.vels, {linvel: [0, 0, 0], angvel: [0, 0, 0]}) && b.activation.sleeping === false,
    'Only original stationary awake fourth birth is admitted');
  need(b.activation.time_since_can_sleep === 0 && b.activation.time_until_sleep === f(.5), 'Original fresh activation state required');
  need(b.ccd.ccd_enabled === true && b.ccd.ccd_active === false && b.ccd.soft_ccd_prediction === 0 && b.ccd.allow_fast_rotation === false,
    'Preserve original enabled CCD descriptors');
  need(b.mprops.flags === 0 && exact(b.mprops.local_mprops.local_com, [0, 0, 0]) && b.additional_solver_iterations === 0 && b.additional_pgs_iterations === 0,
    'Unmodified unlocked source sphere required');
  need(vector(b.pos.position.translation, 3) && exact(b.pos.position.rotation, [0, 0, 0, 1]) && exact(b.pos.position, b.pos.next_position),
    'Original identity-pose fourth creation boundary required');
  for (const [c, index] of [[s.ball, 22], [s.passive, 23], [s.floor, 0]]) {
    need(exact(c.handle, {index, generation: 0}) && c.coll_type === 'Solid' && c.contact_skin === 0 && c.flags.active_hooks === 0 &&
      c.flags.enabled === 'Enabled' && c.flags.active_collision_types === 15, 'Original supported collider descriptor required');
    need(exact(c.parent.pos_wrt_parent.translation, [0, 0, 0]) && exact(c.parent.pos_wrt_parent.rotation, [0, 0, 0, 1]) &&
      exact(c.pos.rotation, [0, 0, 0, 1]), 'Identity source collider-local transforms required');
    need(c.material.friction_combine_rule === 'Multiply' && c.material.restitution_combine_rule === 'Multiply', 'Original material multiply rules required');
    if (index) need(c.shape.variant === 'Ball' && c.shape.value.radius === s.ball.shape.value.radius && c.changes === 1023 &&
      exact(c.parent.handle, b.handle) && exact(c.pos, b.pos.position), 'Unpropagated original fourth sphere attachments required');
  }
  need(s.ball.mprops.variant === 'Mass' && s.ball.mprops.value === f(.21) && s.passive.mprops.variant === 'Mass' && s.passive.mprops.value === 0 &&
    b.mprops.local_mprops.inv_mass === f(1 / f(.21)) && b.ccd.ccd_thickness === s.ball.shape.value.radius, 'Retain exact eager source mass, not invented zero mass');
  need(s.floor.shape.variant === 'Cuboid' && exact(s.floor.parent.handle, {index: 0, generation: 0}) && s.floor.changes === 0 &&
    vector(s.floorProxy.min, 3) && vector(s.floorProxy.max, 3), 'Genuine existing fixed cloth proxy required');
  need(exact(s.ball.flags.collision_groups, {memberships: 1, filter: 6, test_mode: 'And'}) &&
    exact(s.passive.flags.collision_groups, {memberships: 8, filter: 8, test_mode: 'And'}) &&
    exact(s.floor.flags.collision_groups, {memberships: 2, filter: 21, test_mode: 'And'}), 'Original dual collider channel contract required');
  need(p.dt === f(1 / 960) && p.max_ccd_substeps === 4 && p.contact_recycling === true && p.friction_model === 'Simplified' &&
    s.application.dt === 1 / 960 && s.application.strokeSubsteps === 64 && vector(s.gravity, 3), 'Original first-h application and solver parameters required');
  need(p.num_solver_iterations === 12 && p.num_internal_pgs_iterations === 4 && p.num_internal_stabilization_iterations === 1 &&
    p.length_unit === f(.0615) && p.normalized_prediction_distance === f(.001) && p.normalized_contact_recycle_distance === f(.05),
    'Original bounded solver plan and prediction lengths required');
  return s;
}
function preparationPlan() {
  const inputFloats = 13, nodes = [], op = (kind, ...args) => { nodes.push({kind, args}); return inputFloats + nodes.length - 1; };
  const c = x => op('const', f(x)), mul = (a, b) => op('mul', a, b), add = (a, b) => op('add', a, b);
  return {inputFloats, nodes, outputs: [op('sqrt', add(add(mul(0, 0), mul(1, 1)), mul(2, 2))),
    mul(3, 4), mul(3, 5), mul(6, 7), mul(8, 9), ...[10, 11, 12].map(x => op('div', c(1), x))]};
}
const PREP = preparationPlan();
async function evaluator(device, plan) {
  if (!device) return {run: async input => Array.from(A.execute(Float32Array.from(input), plan)), dispose() {}};
  const module = device.createShaderModule({code: R.shaderForInputFloats(plan.inputFloats)}), info = await module.getCompilationInfo();
  need(!info.messages.some(x => x.type === 'error'), 'Fourth cloth WGSL compilation failed');
  const pipeline = await device.createComputePipelineAsync({layout: 'auto', compute: {module, entryPoint: 'main'}}), owned = [];
  const make = (size, usage) => { const b = device.createBuffer({size, usage}); owned.push(b); return b; };
  const program = A.encode(plan), indices = Uint32Array.from(plan.outputs), pb = make(program.byteLength, 136), ib = make(indices.byteLength, 136);
  device.queue.writeBuffer(pb, 0, program); device.queue.writeBuffer(ib, 0, indices);
  return {async run(input) {
    const a = Float32Array.from(input), temporary = [], make = (size, usage) => { const b = device.createBuffer({size, usage}); temporary.push(b); return b; };
    need(a.length === plan.inputFloats, 'Exact numerical component stride required');
    try {
      const size = (plan.outputs.length + 1) * 4, source = make(a.byteLength, 136), scratch = make((plan.inputFloats + plan.nodes.length) * 4, 128), out = make(size, 132), read = make(size, 9);
      device.queue.writeBuffer(source, 0, a);
      const group = device.createBindGroup({layout: pipeline.getBindGroupLayout(0), entries: [source, pb, scratch, ib, out].map((buffer, binding) => ({binding, resource: {buffer}}))});
      const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(1); pass.end();
      encoder.copyBufferToBuffer(out, 0, read, 0, size); device.queue.submit([encoder.finish()]); await read.mapAsync(1);
      const raw = new Float32Array(read.getMappedRange().slice(0)); read.unmap();
      need(raw.at(-1) === 1 && raw.every(Number.isFinite), 'Incomplete fourth cloth actual WGSL'); return Array.from(raw.slice(0, -1));
    } finally { temporary.forEach(b => b.destroy()); }
  }, dispose() { owned.forEach(b => b.destroy()); }};
}
function boundsInput(s) {
  // Original new BVH leaves use prediction/2, not a made-up previous fat box or
  // the 0.04 length-unit enlargement for an existing leaf escaping its fat box.
  const a = new Array(24).fill(0); a.splice(0, 3, ...s.body.pos.position.translation); a.splice(3, 4, ...s.body.pos.position.rotation);
  a[10] = s.ball.shape.value.radius; a[20] = s.parameters.length_unit; a[21] = s.parameters.normalized_prediction_distance; return a;
}
function numericalConfiguration(s, bounds, prep) {
  const b = s.body, p = s.parameters, ii = b.mprops.effective_world_inv_inertia, lm = b.mprops.local_mprops, zero = () => [0, 0, 0];
  return {kind: 'sphere-floor-lifecycle', phase: 'post-outer-step', bodyCount: 2, dynamicBodyCount: 1, colliderCount: 2, contactCount: 1, jointCount: 0,
    canSleep: true, sleeping: false, ccdEnabled: true, ccdMode: 'source-inactive-only', maxCcdSubsteps: p.max_ccd_substeps, lockedAxes: 0,
    frictionModel: p.friction_model, localComZero: true, floorIdentityRotation: true, zeroContactSkins: true, noHooks: true, noPendingShapeChanges: true,
    colliderLocalIdentity: true, softCcdPredictionZero: true, colliderOrder: 'floor-then-sphere', adaptiveChangeDetectionMargin: false,
    linear: copy(b.vels.linvel), angular: copy(b.vels.angvel), translation: copy(b.pos.position.translation), rotation: copy(b.pos.position.rotation),
    invMass: copy(b.mprops.effective_inv_mass), invInertia: ['m11', 'm12', 'm13', 'm12', 'm22', 'm23', 'm13', 'm23', 'm33'].map(k => ii[k]),
    principalInertia: prep.slice(5, 8), invPrincipalInertia: copy(lm.inv_principal_inertia), principalFrame: copy(lm.principal_inertia_local_frame),
    force: copy(b.forces.force), gravity: copy(s.gravity), userForce: copy(b.forces.user_force), userTorque: copy(b.forces.user_torque),
    gravityScale: b.forces.gravity_scale, gyroscopic: b.forces.gyroscopic_forces_enabled, allowFastRotation: b.ccd.allow_fast_rotation,
    linearDamping: b.damping.linear_damping, angularDamping: b.damping.angular_damping,
    radius: s.ball.shape.value.radius, floorTranslation: copy(s.floor.pos.translation), floorHalfExtents: copy(s.floor.shape.value.half_extents),
    dt: f(s.application.dt / s.application.strokeSubsteps), lengthUnit: p.length_unit, normalizedMaxLinearVelocity: p.normalized_max_linear_velocity,
    substeps: p.num_solver_iterations, pgsIterations: p.num_internal_pgs_iterations, stabilizationIterations: p.num_internal_stabilization_iterations,
    dynamicFrequency: p.contact_softness.natural_frequency, dynamicDamping: p.contact_softness.damping_ratio,
    staticFrequency: p.static_contact_softness.natural_frequency, staticDamping: p.static_contact_softness.damping_ratio,
    warmstartCoefficient: p.warmstart_coefficient, normalizedMaxCorrectiveVelocity: p.normalized_max_corrective_velocity,
    normalizedPredictionDistance: p.normalized_prediction_distance, frictionInBiasPass: p.friction_in_bias_pass,
    topology: {pairPresent: false, pointPresent: false, active: false, recycleValid: false,
      floorMin: copy(s.floorProxy.min), floorMax: copy(s.floorProxy.max), ballMin: bounds.slice(0, 3), ballMax: bounds.slice(3, 6)},
    normal: [0, 1, 0], friction: prep[3], restitution: prep[4], contactRecycleDistance: prep[2], maxExtent: prep[0], maxDrift: Math.min(prep[1], prep[2]),
    // These are the source empty-point defaults, not a native future cache.
    anchor1: zero(), anchor2: zero(), dp1: zero(), dp2: zero(), localP1: zero(), localP2: zero(), localN2: zero(),
    warmWorld: zero(), warmTangent: [0, 0], tangentImpulse: [0, 0], warmImpulse: 0, impulse: 0, contactDistance: 0,
    recycleTranslation: zero(), recycleRotation: [0, 0, 0, 1], tangentVelocity: zero(), contactId: 0};
}
function decodeNumerical(raw, plan) {
  const out = {}; for (const [k, {offset, length}] of Object.entries(plan.outputLayout)) {
    const canonical = ['impulse', 'warmImpulse', 'warmWorld', 'warmTangent'].includes(k);
    const values = raw.slice(offset, offset + length).map(x => canonical && x === 0 ? 0 : x); out[k] = length === 1 ? values[0] : values;
  } return out;
}
function readReceipt(receipt) {
  const r = receipts.get(receipt); need(r && r.transaction.status === 'pending' && !r.origin.disposed, 'Live original fourth cloth birth receipt required');
  if (r.binding) checkGraphBinding(r.binding, r.origin.backend); return copy(r.view);
}
function assertReceipt(receipt, stage, backend, phase) {
  const r = receipts.get(receipt), b = brands.get(stage);
  need(r && b && r.origin === b && b.backend === backend && r.transaction === b.pending?.transaction &&
    (!phase || r.view.phase === phase), 'Exact current origin-bound fourth cloth birth receipt required'); return readReceipt(receipt);
}
function checkGraphBinding(binding, backend) {
  const J = journal(); J.assertTransaction(binding.transaction, binding.projection, backend);
  return checkGraphIdentity(J.viewReceipt(binding.transaction, backend), binding);
}
function checkGraphIdentity(v, binding) {
  const e = v.after.edges[binding.edgeId];
  need(v.fromSequence === 0 && v.toSequence === 1 && v.after.lifetimes[binding.edgeId] === binding.lifetime &&
    exact(e?.collider1, binding.clothCollider) && exact(e?.collider2, binding.primary) &&
    exact(e?.body1, {index: 0, generation: 0}) && exact(e?.body2, binding.body), 'Exact live first fourth-cloth graph edge and lifetime required');
  return v;
}
function checkCommittedGraphBinding(binding, backend) {
  const J = journal(), v = checkGraphIdentity(J.viewReceipt(binding.transaction, backend), binding);
  need(v.status === 'committed' && v.phase === 'complete', 'Exact already-committed source graph transaction required');
  // Reprojection uses Journal's own same-origin/current-head checks. A later
  // pending or committed transaction cannot silently replace this first h.
  const next = J.projectReceipts([binding.transaction], binding.projection, backend);
  J.assertProjectionHead(next.projection, backend); return v;
}
function assertBoundGeometryReceipt(receipt, transaction, backend) {
  const r = receipts.get(receipt);
  need(r && r.origin.backend === backend && r.view.phase === 'geometry-bound' && r.binding?.transaction === transaction &&
    r.transaction === r.origin.pending?.transaction && r.origin.pending.geometryBound === receipt,
    'Exact source-generated fourth cloth receipt bound to this graph transaction required');
  return readReceipt(receipt);
}
async function create(input, device) {
  const seed = validate(input), backend = device ? 'webgpu' : 'cpu-reference', owned = [];
  const p = seed.parameters, plan = C.buildPlan(p.num_solver_iterations, p.num_internal_pgs_iterations, p.num_internal_stabilization_iterations);
  let boundsMath, prepMath, numericalMath, lifecycle = null;
  try { boundsMath = await evaluator(device, Broad.PLANS.bounds); owned.push(boundsMath); prepMath = await evaluator(device, PREP); owned.push(prepMath);
    numericalMath = await evaluator(device, plan); owned.push(numericalMath); } catch (error) { owned.forEach(x => x.dispose()); throw error; }
  const brand = {backend, pending: null, disposed: false}, owner = Object.freeze({});
  let busy = false, lease = null, committed = false, committedState = null, ownedInitial = null, continuationAvailable = false;
  const access = (token, count) => need(lease ? token === lease && count === 1 : count === 0, 'Only claimed owner token allowed; external state injection prohibited');
  const makeReceipt = (phase, state, metadata, binding = null) => {
    const r = Object.freeze({kind: 'original-fourth-cloth-birth-receipt'});
    receipts.set(r, {origin: brand, transaction: brand.pending.transaction, binding, view: {phase, backend, initialSnapshotSha256: seed.initialSnapshotSha256,
      body: copy(seed.body.handle), primary: copy(seed.ball.handle), passive: copy(seed.passive.handle), clothCollider: copy(seed.floor.handle),
      scope: binding ? 'live-graph-bound-first-cloth-numerical-phase' : 'independent-initial-only-cloth-numerical-component',
      globalTransactionBound: !!binding, activationOwned: false, postCollisionManagerComplete: false,
      ...(binding ? {graph: {fromSequence: 0, edgeId: binding.edgeId, lifetime: binding.lifetime}} : {}),
      state: copy(state), metadata: copy(metadata)}}); return r;
  };
  const api = {capability: CAPABILITY, backend,
    initialState() { need(ownedInitial && !brand.disposed, 'Own geometry preparation must compute initial bounds first'); return copy(ownedInitial); },
    snapshot() { need(committedState && !brand.disposed, 'Committed own first-h numerical state required'); return copy(committedState); },
    claim(token) { need(token && typeof token === 'object' && !lease && !busy && !brand.pending && !brand.disposed && !committed, 'Idle first-birth owner required'); lease = token; },
    release(token) { need(lease === token && lease && !busy && !brand.pending, 'Idle claimed first-birth owner required'); lease = null; },
    async prepare(...args) {
      access(args[0], args.length); need(!busy && !brand.disposed && !brand.pending && !committed, 'First cloth birth prepare unavailable'); busy = true;
      try {
        const bounds = await boundsMath.run(boundsInput(seed)), lm = seed.body.mprops.local_mprops;
        const prep = await prepMath.run([...seed.floor.shape.value.half_extents, p.length_unit, p.normalized_prediction_distance,
          p.normalized_contact_recycle_distance, seed.ball.material.friction, seed.floor.material.friction,
          seed.ball.material.restitution, seed.floor.material.restitution, ...lm.inv_principal_inertia]);
        const initial = numericalConfiguration(seed, bounds, prep); ownedInitial = copy(initial);
        lifecycle = device ? await L.createGpuPreparedContactStage(device, initial) : L.createReferencePreparedContactStage(initial); lifecycle.claim(owner);
        const out = await lifecycle.prepare(initial, owner);
        need(out.state.topology.active && out.state.topology.pointPresent && out.metadata.geometryRefreshed && out.metadata.oldPair === false &&
          exact(out.metadata.broadPhaseEvents, ['AddPair']), 'Original own first cloth geometry birth required');
        brand.pending = {transaction: {status: 'pending'}, phase: 'geometry', state: out.state, metadata: out.metadata,
          geometry: null, numerical: null, binding: null, geometryBound: null};
        brand.pending.geometry = makeReceipt('geometry', out.state, out.metadata); return brand.pending.geometry;
      } catch (error) { if (lifecycle) { lifecycle.abort(owner); lifecycle.release(owner); lifecycle.dispose(); lifecycle = null; } throw error; }
      finally { busy = false; }
    },
    bindGeometry(binding, ...args) {
      access(args[0], args.length); need(!busy && !brand.disposed && brand.pending?.phase === 'geometry' && !brand.pending.binding,
        'Unbound own initial geometry required');
      need(binding && Object.keys(binding).sort().join(',') === 'projection,transaction', 'Only exact source graph identities may bind geometry');
      const J = journal(); J.assertTransaction(binding.transaction, binding.projection, backend);
      need(J.captureTransaction(binding.projection, backend) === binding.transaction, 'Current live source broad transaction required');
      const v = J.viewReceipt(binding.transaction, backend), birth = v.initialFourBallBirth, s = brand.pending.state;
      need(v.phase === 'broad' && birth && v.initialSnapshotSha256 === seed.initialSnapshotSha256 &&
        exact(birth.body, seed.body.handle) && exact(birth.primary, seed.ball.handle) && exact(birth.pair, seed.passive.handle) &&
        exact(birth.clothCollider, seed.floor.handle), 'Source first-birth snapshot and handle identity required');
      const matches = v.after.edges.map((e,edgeId)=>({e,edgeId})).filter(({e})=>exact(e.collider1,seed.floor.handle)&&exact(e.collider2,seed.ball.handle)&&exact(e.body2,seed.body.handle));
      need(matches.length===1, 'Unique source-ordered fourth-cloth birth edge required');
      const edgeId=matches[0].edgeId,lifetime=v.after.lifetimes[edgeId];
      need(Number.isInteger(lifetime)&&lifetime>0, 'Owned source birth lifetime required');
      const b = {projection: binding.projection, transaction: binding.transaction, edgeId, lifetime,
        body: copy(seed.body.handle), primary: copy(seed.ball.handle), clothCollider: copy(seed.floor.handle)};
      checkGraphBinding(b, backend);
      need(v.after.edges[b.edgeId].active === false && exact(v.after.proxies[3], {min: s.topology.ballMin, max: s.topology.ballMax}),
        'Inactive exact source graph allocation and own computed fresh bounds required');
      brand.pending.binding = b; brand.pending.phase = 'geometry-bound';
      brand.pending.geometryBound = makeReceipt('geometry-bound', s, brand.pending.metadata, b); return brand.pending.geometryBound;
    },
    async solvePrepared(admission, ...args) {
      access(args[0], args.length); need(!busy && !brand.disposed && brand.pending?.phase === 'geometry-bound',
        'Live graph-bound geometry is required before admitted source solve');
      const v = checkGraphBinding(brand.pending.binding, backend);
      need(v.phase === 'narrow' && v.after.edges[brand.pending.binding.edgeId].active === true, 'Actual source geometry/link transition must precede activation and solve');
      busy = true;
      try {
        const out = await lifecycle.solvePrepared(admission, owner);
        brand.pending.state = out.state; brand.pending.phase = 'solved-global-numerical';
        brand.pending.numerical = makeReceipt('solved-global-numerical', out.state, {...out.metadata,
          sourceActivationAdmissionClaimed: true, sourceCcdAdmissionClaimed: true, admissionOwnedBy: 'common-world-owner'}, brand.pending.binding);
        return brand.pending.numerical;
      } finally { busy = false; }
    },
    async solveNumericalComponent(...args) {
      access(args[0], args.length); need(!busy && !brand.disposed && brand.pending?.phase === 'geometry', 'Genuine own pending geometry required'); busy = true;
      try {
        const s = copy(brand.pending.state), configuration = {...s, kind: 'sphere-fixed-floor-continuous', recycleValid: s.topology.recycleValid};
        C.validateConfiguration(configuration);
        // Evaluate the shared source solver plan directly: this is explicitly a
        // numerical component, NOT a fabricated source-observed awake/CCD phase.
        // No canSleep/CCD descriptor is disabled and no native state is supplied.
        const result = decodeNumerical(await numericalMath.run(C.pack(configuration)), plan);
        need(result.supported === 1, 'Own first-birth geometry must support source numerical solver');
        for (const k of Object.keys(result)) if (k in s) s[k] = copy(result[k]); s.force = copy(result.force);
        brand.pending.phase = 'numerical-component'; brand.pending.state = s;
        brand.pending.numerical = makeReceipt('numerical-component', s, {...brand.pending.metadata, solverKind: 'contact',
          sourceActivationAdmissionClaimed: false, sourceCcdAdmissionClaimed: false}); return brand.pending.numerical;
      } finally { busy = false; }
    },
    assertPrepared(...args) {
      access(args[0], args.length); need(!busy && ['numerical-component', 'solved-global-numerical'].includes(brand.pending?.phase), 'Completed numerical component required');
      if (brand.pending.binding) { checkGraphBinding(brand.pending.binding, backend); lifecycle.assertPrepared(owner); }
      brand.pending.precommitAsserted = true;
    },
    commit(...args) {
      access(args[0], args.length); need(!busy && ['numerical-component', 'solved-global-numerical'].includes(brand.pending?.phase), 'Completed numerical component required');
      const actual = brand.pending.phase === 'solved-global-numerical';
      if (actual) {
        const v = journal().viewReceipt(brand.pending.binding.transaction, backend);
        if (v.status === 'committed') {
          need(brand.pending.precommitAsserted === true, 'Private live precommit assertion required before Journal-first commit');
          checkCommittedGraphBinding(brand.pending.binding, backend); lifecycle.assertPrepared(owner);
        } else api.assertPrepared(...args);
      } else api.assertPrepared(...args);
      committedState = copy(brand.pending.state); if (actual) lifecycle.commit(owner); else lifecycle.abort(owner);
      brand.pending.transaction.status = 'committed'; brand.pending = null; committed = true;
      if (actual) continuationAvailable = true; else { lifecycle.release(owner); lifecycle.dispose(); lifecycle = null; }
    },
    takeContinuation(token) {
      need(lease && token === lease && !busy && !brand.disposed && committed && continuationAvailable && lifecycle,
        'Claimed owner and committed actual lifecycle are required for continuation handover');
      lifecycle.release(owner); lifecycle.claim(token); const result = lifecycle; lifecycle = null; continuationAvailable = false; return result;
    },
    abort(...args) { access(args[0], args.length); need(!busy, 'Cannot abort active cloth GPU submission'); if (brand.pending) brand.pending.transaction.status = 'aborted'; brand.pending = null;
      if (lifecycle) { lifecycle.abort(owner); lifecycle.release(owner); lifecycle.dispose(); lifecycle = null; } },
    dispose() { need(!lease && !busy, 'Release fourth cloth owner before disposal'); if (brand.disposed) return; api.abort(); brand.disposed = true; owned.forEach(x => x.dispose()); brands.delete(api); }
  }; brands.set(api, brand); return Object.freeze(api);
}
const api = Object.freeze({CAPABILITY, validate, createReferenceStage: input => create(input, null), createGpuStage: (device, input) => create(input, device),
  readReceipt, assertReceipt, assertBoundGeometryReceipt, isReceipt: receipt => receipts.has(receipt), isStage: (stage, backend) => brands.get(stage)?.backend === backend});
G.LabFourBallClothBirthExperimental = api; if (common) module.exports = api;
})(globalThis);
