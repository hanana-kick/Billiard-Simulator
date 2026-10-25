'use strict';
// Independent original-controller oracle. Expected first-h state is never a seed.
// All observed methods receive the original receiver and argument references.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const R = require('../vendor/rapier.cjs');
const D = require('../tools/rapier-snapshot-decoder');
globalThis.RAPIER = R;
require('../src/math.js');
require('../src/render-cadence.js');
require('../src/physics.js');
require('../src/game-rules.js');
require('../src/controller.js');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'original-controller-four-ball-created-first-h-v1';
const BASE_REVISION = '827dc2969bc6a8880d6d3f462f9afd821cd10e32';
const SETTINGS = Object.freeze({angle: 0, elevation: 8, tipX: 0, tipY: 0, speed: 2});
const BOUNDARIES = Object.freeze(['constructor', 'modeCreated', 'strikeCreated',
  'firstH.preWorld', 'firstH.postWorld', 'firstH.postApplication']);
const SOURCES = Object.freeze(['tests/four-ball-created-fixture.cjs',
  'src/controller.js', 'src/physics.js', 'src/math.js', 'src/render-cadence.js',
  'src/game-rules.js', 'vendor/rapier.cjs', 'tools/rapier-snapshot-decoder/index.cjs']);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const copy = value => structuredClone(value);
const same = (a, b) => a?.index === b?.index && a?.generation === b?.generation;
const JOURNAL_ENCODING = 'tagged-sorted-json-f64-bits-v1';
function journalDigest(journal) {
  // V8 serialization is exact storage, not a canonical content encoding. In
  // particular, internal string representations can change upon reload.
  function canonical(value) {
    if (value === null) return ['null'];
    if (typeof value === 'number') { const b = Buffer.alloc(8); b.writeDoubleBE(value); return ['f64', b.toString('hex')]; }
    if (typeof value === 'undefined') return ['undefined'];
    if (typeof value === 'bigint') return ['bigint', value.toString()];
    if (typeof value === 'string' || typeof value === 'boolean') return [typeof value, value];
    if (Array.isArray(value)) return ['array', value.map(canonical)];
    assert.equal(typeof value, 'object', 'Journal values are explicit data, never functions');
    return ['object', Object.keys(value).sort().map(key => [key, canonical(value[key])])];
  }
  return hash(JSON.stringify([JOURNAL_ENCODING, canonical(journal)]));
}
function parts(handle) {
  const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, handle, true);
  return {index: bytes.getUint32(0, true), generation: bytes.getUint32(4, true)};
}
function plain(node) {
  if (!node) return null;
  switch (node.kind) {
    case 'float': return D.floatValue(node);
    case 'integer': {
      const number = Number(node.value);
      // Full native state includes u128 solver-color masks (not safe JS numbers).
      // Preserve them exactly instead of narrowing, rounding, or dropping fields.
      return Number.isSafeInteger(number) ? number : BigInt(node.value);
    }
    case 'bool': return node.value;
    case 'none': case 'unit': case 'unit_struct': return null;
    case 'some': case 'newtype_struct': return plain(node.value);
    case 'newtype_variant': return {variant: node.variant, value: plain(node.value)};
    case 'unit_variant': return node.variant;
    default:
      if (node.fields) return Object.fromEntries(node.fields.map(([key, value]) => [key, plain(value)]));
      if (node.items) return node.items.map(plain);
      if (node.entries) return node.entries.map(([key, value]) => [plain(key), plain(value)]);
      if ('value' in node) return node.value;
      throw Error('Unsupported exact native tree node ' + node.kind);
  }
}
// The before/after observers cannot replace the receiver, argument array, or result.
// Restoring removes an instance shadow when the observed method was inherited.
function observeMethod(object, method, {before, after} = {}) {
  const own = Object.getOwnPropertyDescriptor(object, method), original = object[method];
  assert.equal(typeof original, 'function', 'Observed source method exists: ' + method);
  Object.defineProperty(object, method, {...(own || {configurable: true, enumerable: false, writable: true}),
    value: function(...args) {
      const token = before?.(this, args);
      const result = Reflect.apply(original, this, args);
      after?.(this, args, result, token);
      return result;
    }});
  return () => { if (own) Object.defineProperty(object, method, own); else delete object[method]; };
}
function sourceIdentity() {
  const binary = process.env.RAPIER_SNAPSHOT_DECODER;
  assert.ok(binary && path.isAbsolute(binary), 'Explicit absolute admitted native decoder required');
  return {schema: SCHEMA, baseRevision: BASE_REVISION,
    node: process.version, v8: process.versions.v8,
    sourceRevision: D.SOURCE_REVISION, engineVersion: D.ENGINE_VERSION, engineSha256: D.ENGINE_SHA256,
    decoderBinarySha256: hash(fs.readFileSync(binary)),
    captureFunctionSha256: hash(captureOriginalController.toString()),
    sources: Object.fromEntries(SOURCES.map(file => [file, hash(fs.readFileSync(path.join(ROOT, file)))]))};
}
function objectRegistry(lab) {
  return {staticCount: lab.statics.length,
    objects: lab.objects.map((o, index) => ({index, id: o.id, label: o.label, kind: o.kind,
      shape: o.shape, radius: o.radius, mass: o.mass, body: parts(o.body.handle),
      collider: parts(o.collider.handle), pairCollider: parts(o.pairCollider.handle)})),
    statics: lab.statics.map((o, index) => ({index, label: o.label, kind: o.kind,
      body: parts(o.body.handle), collider: parts(o.collider.handle)}))};
}
function applicationState(c) {
  const lab = c.lab, cue = lab.cue;
  return {time: lab.time, steps: lab.steps, shots: lab.shots, revision: lab.revision,
    dt: lab.dt, strokeSubsteps: lab.strokeSubsteps, nextId: lab.nextId, params: copy(lab.params),
    events: copy(lab.events), registry: objectRegistry(lab),
    controller: {gameMode: c.state.gameMode, selectedId: c.state.selectedId,
      paused: c.state.paused, settings: copy(c.state.settings), undoCount: c.undoStack.length,
      redoCount: c.redoStack.length}, game: c.game?.snapshot() || null,
    cue: cue ? {shaft: parts(cue.body.handle), head: parts(cue.head.handle), guide: parts(cue.guide.handle),
      shaftCollider: parts(cue.shaft.handle), tipCollider: parts(cue.tip.handle), neckCollider: parts(cue.neck.handle),
      flex: parts(cue.flex.handle), prismatic: parts(cue.joint.handle), selectedId: cue.selectedId,
      pose: copy(cue.pose), started: cue.started, contacted: cue.contacted,
      contacts: copy([...cue.contacts]), obstructions: copy([...cue.obstructions]), stats: copy(cue.stats)} : null};
}
function captureOriginalController({journal = true} = {}) {
  const restores = [], apiJournal = [], boundaries = {}, references = new WeakMap();
  const done = Symbol('after original first-h angularPatchResistance');
  let c, lab, phase = 'constructor', nativeSteps = 0;
  const reference = (value, kind) => {
    references.set(value, {kind, ...(typeof value.handle === 'number' ? {handle: parts(value.handle)} : {})});
    return value;
  };
  const argument = value => {
    if (value === null || typeof value !== 'object') {
      if (typeof value === 'function') return {kind: 'original-callback', sourceSha256: hash(value.toString())};
      return value;
    }
    if (references.has(value)) return copy(references.get(value));
    if (ArrayBuffer.isView(value)) return {kind: value.constructor.name, values: Array.from(value)};
    if (Array.isArray(value)) return value.map(argument);
    const fields = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      assert.ok('value' in descriptor, 'Descriptor journal never invokes an accessor');
      fields[key] = argument(descriptor.value);
    }
    return {kind: 'descriptor', className: value.constructor?.name || null, fields};
  };
  const checkpoint = name => {
    assert.ok(!Object.hasOwn(boundaries, name), 'One original state per declared boundary');
    boundaries[name] = {boundary: name, candidateInput: name === 'strikeCreated',
      nativeSteps, snapshot: lab.world.takeSnapshot(), application: applicationState(c),
      ...(journal ? {apiJournalLength: apiJournal.length} : {})};
  };
  const observeApi = (object, method, createdKind) => {
    restores.push(observeMethod(object, method, {
      before(receiver, args) {
        const row = {order: apiJournal.length, phase, target: copy(references.get(receiver) || {kind: 'World'}),
          method, args: args.map(argument), nativeStepsBefore: nativeSteps};
        apiJournal.push(row); return row;
      },
      after(receiver, args, result, row) {
        if (createdKind) reference(result, createdKind);
        row.result = argument(result); row.nativeStepsAfter = nativeSteps;
        if (createdKind === 'RigidBody') {
          for (const name of ['setLinvel', 'setAngvel', 'setTranslation', 'setRotation', 'wakeUp', 'sleep',
            'applyImpulse', 'applyImpulseAtPoint', 'applyTorqueImpulse', 'resetForces', 'resetTorques',
            'recomputeMassPropertiesFromColliders']) observeApi(result, name);
        }
        if (createdKind === 'ImpulseJoint') for (const name of ['setContactsEnabled', 'setLimits']) {
          if (typeof result[name] === 'function') observeApi(result, name);
        }
      }
    }));
  };
  try {
    if (journal) {
      for (const [method, kind] of [['createRigidBody', 'RigidBody'], ['createCollider', 'Collider'],
        ['createImpulseJoint', 'ImpulseJoint']]) observeApi(R.World.prototype, method, kind);
      for (const name of ['propagateModifiedBodyPositionsToColliders', 'removeRigidBody']) observeApi(R.World.prototype, name);
    }
    restores.push(observeMethod(R.World.prototype, 'step', {
      before(receiver, args) {
        if (lab) {
          assert.equal(receiver, lab.world); assert.equal(nativeSteps, 72, 'Only one post-creation native h');
          assert.equal(args.length, 1); assert.equal(args[0], lab.queue, 'Original event queue argument');
          checkpoint('firstH.preWorld'); phase = 'firstH.world';
        } else assert.equal(args.length, 0, 'Original constructor steps omit the event queue');
        if (journal) {
          const row = {order: apiJournal.length, phase, target: {kind: 'World'}, method: 'step',
            args: args.map(argument), nativeStepsBefore: nativeSteps}; apiJournal.push(row); return row;
        }
      },
      after(receiver, args, result, row) {
        nativeSteps++;
        if (row) { row.result = argument(result); row.nativeStepsAfter = nativeSteps; }
        if (lab) { checkpoint('firstH.postWorld'); phase = 'firstH.postApplication'; }
      }
    }));
    // Exact application harness from tests/four-ball-integration.cjs; no substitute layout.
    c = new LabController(); c.lab = new PhysicsLab(R); lab = c.lab;
    reference(lab.world, 'World'); reference(lab.queue, 'EventQueue');
    assert.equal(nativeSteps, 72); assert.equal(lab.objects.length, 3); assert.equal(lab.statics.length, 16);
    checkpoint('constructor');
    phase = 'modeCreation'; c.state.gameMode = 'four'; c.setupGame(); checkpoint('modeCreated');
    assert.equal(nativeSteps, 72); assert.equal(lab.objects.length, 4);
    assert.deepEqual(c.state.settings, SETTINGS); assert.equal(c.state.selectedId, 1);
    phase = 'strikeCreation'; assert.equal(c.fire(), true); checkpoint('strikeCreated');
    assert.equal(nativeSteps, 72); assert.equal(lab.time, 0); assert.equal(lab.steps, 0);
    if (journal) observeApi(lab.queue, 'drainCollisionEvents');
    restores.push(observeMethod(lab, 'angularPatchResistance', {
      after(receiver, args) {
        assert.equal(receiver, lab); assert.deepEqual(args, [lab.dt / lab.strokeSubsteps]);
        checkpoint('firstH.postApplication'); throw done;
      }
    }));
    phase = 'firstH.preApplication';
    try { lab.step(); } catch (error) { if (error !== done) throw error; }
    assert.deepEqual(Object.keys(boundaries), BOUNDARIES); assert.equal(nativeSteps, 73);
    const sceneRegistry = objectRegistry(lab), roles = {ball: sceneRegistry.objects[0].body,
      otherBall1: sceneRegistry.objects[1].body, otherBall2: sceneRegistry.objects[2].body,
      otherBall3: sceneRegistry.objects[3].body, floor: sceneRegistry.statics.find(s => s.kind === 'cloth').body,
      shaft: parts(lab.cue.body.handle), head: parts(lab.cue.head.handle), guide: parts(lab.cue.guide.handle)};
    return {schema: SCHEMA, fixtureScope: 'original-controller-four-ball-setupGame-fire',
      constructorNativeSettlingSteps: 72, additionalApplicationSettlingSteps: 0,
      selectedIndex: 0, settings: copy(SETTINGS), initialBoundary: 'strikeCreated',
      expectedOnlyBoundaries: ['constructor', 'modeCreated', ...BOUNDARIES.slice(3)],
      applicationH: lab.dt / lab.strokeSubsteps, nativeSteps, roles, sceneRegistry, boundaries, apiJournal};
  } finally {
    while (restores.length) restores.pop()();
    if (c) { clearTimeout(c.noticeTimer); clearTimeout(c.predictionTimer); }
    lab?.dispose();
  }
}
function decodeBoundary(row) {
  const decoded = D.decodeSnapshot(row.snapshot, {binary: process.env.RAPIER_SNAPSHOT_DECODER, engineVersion: '0.21.0'});
  const state = plain(decoded.state);
  // Arena Occupied is a struct variant in the admitted serde tree. Use typed
  // fields rather than relying on the convenience enum projection above.
  const arena = field => D.field(D.field(D.field(decoded.state, field), field), 'items').items;
  const occupied = field => arena(field).flatMap((entry, index) => entry.variant === 'Occupied'
    ? [{handle: {index, generation: Number(D.field(entry, 'generation').value)}, ...plain(D.field(entry, 'value'))}] : []);
  const allBodies = occupied('bodies'), colliders = occupied('colliders');
  const broad = state.broad_phase, proxies = [];
  for (const node of broad.tree.nodes) for (const side of ['left', 'right']) {
    const child = node[side]; if ((child.data & 0x3fffffff) === 1) proxies.push({index: child.children, min: child.mins, max: child.maxs});
  }
  const contactPairs = D.findStructs(D.field(decoded.state, 'narrow_phase'), 'ContactPair').map(plain);
  const joints = D.findStructs(D.field(decoded.state, 'impulse_joints'), 'ImpulseJoint').map(plain);
  return {...row, sourceRevision: decoded.sourceRevision, engineSha256: decoded.engineSha256,
    snapshotSha256: hash(row.snapshot), snapshotBytes: row.snapshot.length,
    verification: copy(decoded.verification), typedState: decoded.state, state, bodies: allBodies, colliders, joints, proxies, contactPairs,
    queues: {modifiedBodies: state.bodies.modified_bodies[0], modifiedColliders: state.colliders.modified_colliders[0],
      removedColliders: state.colliders.removed_colliders},
    summary: {bodies: allBodies.length, dynamicBodies: allBodies.filter(b => b.body_type === 'Dynamic').length,
      fixedBodies: allBodies.filter(b => b.body_type === 'Fixed').length, colliders: colliders.length,
      joints: joints.length, bvhLeaves: proxies.length, contactPairs: contactPairs.length}};
}
function clothPairs(row) {
  const floor = row.application.registry.statics.find(s => s.kind === 'cloth').collider;
  return row.contactPairs.filter(pair => same(pair.collider1, floor) || same(pair.collider2, floor));
}
function verifyRecord(record) {
  assert.equal(record.schema, SCHEMA); assert.equal(record.fixtureScope, 'original-controller-four-ball-setupGame-fire');
  assert.equal(record.initialBoundary, 'strikeCreated'); assert.equal(record.constructorNativeSettlingSteps, 72);
  assert.equal(record.additionalApplicationSettlingSteps, 0); assert.deepEqual(record.settings, SETTINGS);
  assert.deepEqual(Object.keys(record.boundaries), BOUNDARIES); assert.equal(record.applicationH, 1 / 61440);
  for (const name of BOUNDARIES) {
    const row = record.boundaries[name]; assert.equal(row.boundary, name);
    assert.equal(row.candidateInput, name === 'strikeCreated');
    assert.equal(hash(row.snapshot), row.snapshotSha256); assert.equal(row.snapshot.length, row.snapshotBytes);
    assert.deepEqual(D.encodeLosslessTree(row.typedState), Buffer.from(row.snapshot), 'Authoritative full typed source tree exactly re-encodes at ' + name);
    assert.equal(row.sourceRevision, D.SOURCE_REVISION); assert.equal(row.engineSha256, D.ENGINE_SHA256);
    assert.equal(row.verification.nativeBincodeByteIdentical, true);
    assert.equal(row.verification.javascriptTypedReencodeByteIdentical, true);
    assert.equal(row.application.steps, 0, 'Only a bounded first-h probe, never a completed outer step');
    assert.equal(row.application.registry.staticCount, 16); assert.deepEqual(row.queues.removedColliders, []);
  }
  const initial = record.boundaries.constructor, mode = record.boundaries.modeCreated,
    strike = record.boundaries.strikeCreated, pre = record.boundaries['firstH.preWorld'],
    post = record.boundaries['firstH.postWorld'], applied = record.boundaries['firstH.postApplication'];
  assert.deepEqual(initial.summary, {bodies: 19, dynamicBodies: 3, fixedBodies: 16, colliders: 22, joints: 0, bvhLeaves: 22, contactPairs: 3});
  assert.deepEqual(mode.summary, {bodies: 20, dynamicBodies: 4, fixedBodies: 16, colliders: 24, joints: 0, bvhLeaves: 22, contactPairs: 3});
  for (const row of [strike, pre]) assert.deepEqual(row.summary,
    {bodies: 23, dynamicBodies: 6, fixedBodies: 17, colliders: 27, joints: 2, bvhLeaves: 22, contactPairs: 3});
  for (const row of [initial, mode, strike, pre]) { assert.equal(row.nativeSteps, 72); assert.equal(clothPairs(row).length, 3); }
  for (const row of [post, applied]) {
    assert.equal(row.nativeSteps, 73); assert.equal(row.summary.bodies, 23); assert.equal(row.summary.colliders, 27);
    assert.equal(row.summary.bvhLeaves, 27); assert.equal(row.summary.joints, 2); assert.equal(clothPairs(row).length, 4);
  }
  assert.equal(pre.application.time, 0); assert.equal(post.application.time, 0);
  assert.equal(applied.application.time, record.applicationH);
  assert.equal(strike.state.integration_parameters.dt, Math.fround(1 / 960));
  assert.equal(pre.state.integration_parameters.dt, Math.fround(record.applicationH));
  const objects = strike.application.registry.objects, fourth = objects[3], cue = strike.application.cue;
  const findBody = (row, handle) => row.bodies.find(body => same(body.handle, handle));
  const fourthMode = findBody(mode, fourth.body), fourthCreated = findBody(strike, fourth.body), fourthPost = findBody(post, fourth.body);
  assert.deepEqual(fourthMode.pos.position.translation, [.64, .0308, .30].map(Math.fround));
  assert.deepEqual(fourthCreated.pos, fourthMode.pos);
  // Original attach_collider eagerly folds local/world mass and CCD thickness.
  // First-h user changes recompute the same unchanged attachments; they do not
  // start from an invented zero current mass. Max extent and IDs are deferred.
  assert.ok(fourthMode.mprops.local_mprops.inv_mass > 0, 'Source attachment already contributes fourth-ball mass');
  assert.deepEqual(fourthCreated.mprops.local_mprops, fourthMode.mprops.local_mprops);
  assert.deepEqual(fourthPost.mprops.local_mprops, fourthCreated.mprops.local_mprops, 'Unchanged source attachment mass identity');
  assert.equal(fourthCreated.ccd.ccd_thickness, Math.fround(fourth.radius));
  assert.equal(fourthPost.ccd.ccd_thickness, fourthCreated.ccd.ccd_thickness);
  assert.ok(Object.values(fourthCreated.ids).every(value => value === 0xffffffff), 'Fresh unregistered source fourth body');
  assert.notEqual(fourthPost.ids.active_set_id, 0xffffffff, 'First native h registers fourth body');
  assert.equal(fourthCreated.mprops.max_extent, 0); assert.ok(fourthPost.mprops.max_extent > 0);
  assert.equal(strike.proxies.some(p => p.index === fourth.collider.index || p.index === fourth.pairCollider.index), false);
  assert.equal(clothPairs(strike).some(p => same(p.collider1, fourth.collider) || same(p.collider2, fourth.collider)), false);
  assert.deepEqual(mode.queues.modifiedColliders, [fourth.collider, fourth.pairCollider]);
  assert.deepEqual(strike.queues.modifiedColliders, [fourth.collider, fourth.pairCollider,
    cue.shaftCollider, cue.tipCollider, cue.neckCollider], 'Exact five fresh insertion order');
  assert.deepEqual(pre.queues.modifiedColliders, strike.queues.modifiedColliders);
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(findBody(mode, objects[i].body).pos, findBody(initial, objects[i].body).pos);
    assert.deepEqual(findBody(strike, objects[i].body).pos, findBody(initial, objects[i].body).pos);
  }
  const creationMethods = new Set(['createRigidBody', 'createCollider', 'createImpulseJoint', 'setLinvel', 'setLimits', 'setContactsEnabled']);
  record.modeCreationJournal = record.apiJournal.filter(row => row.phase === 'modeCreation' && creationMethods.has(row.method));
  record.strikeCreationJournal = record.apiJournal.filter(row => row.phase === 'strikeCreation' && creationMethods.has(row.method));
  assert.deepEqual(record.modeCreationJournal.map(row => row.method), ['createRigidBody', 'createCollider', 'createCollider']);
  assert.deepEqual(record.strikeCreationJournal.map(row => row.method), ['createRigidBody', 'createCollider',
    'createRigidBody', 'createCollider', 'createCollider', 'createImpulseJoint', 'setContactsEnabled',
    'createRigidBody', 'createImpulseJoint', 'setLimits', 'setContactsEnabled', 'setLinvel', 'setLinvel']);
  assert.equal(record.apiJournal.filter(row => row.method === 'step' && row.phase === 'constructor').length, 72);
  assert.equal(record.apiJournal.filter(row => row.method === 'step' && row.phase !== 'constructor').length, 1);
  return record;
}
async function captureArtifact(file) {
  assert.ok(file && path.isAbsolute(file), 'Explicit absolute isolated artifact path required');
  assert.ok(!fs.existsSync(file) && !fs.existsSync(file + '.json'), 'Never overwrite frozen oracle artifacts');
  const identity = sourceIdentity(); assert.equal(identity.sources['vendor/rapier.cjs'], D.ENGINE_SHA256);
  await R.init(); assert.equal(R.version(), '0.21.0');
  const record = captureOriginalController(), independent = captureOriginalController({journal: false});
  for (const name of BOUNDARIES) {
    assert.deepEqual(record.boundaries[name].snapshot, independent.boundaries[name].snapshot, 'Journal is read-only at ' + name);
    assert.deepEqual(record.boundaries[name].application, independent.boundaries[name].application, 'Original application observer parity at ' + name);
  }
  for (const name of BOUNDARIES) record.boundaries[name] = decodeBoundary(record.boundaries[name]);
  record.observerAgreement = {independentRecreations: 2, byteIdenticalBoundaries: BOUNDARIES.slice(), exactApplicationObservables: true};
  verifyRecord(record); assert.deepEqual(sourceIdentity(), identity, 'Frozen source/engine/decoder identity throughout capture');
  const captureRevision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim();
  const bytes = v8.serialize(record), manifest = {identity, captureRevision, sha256: hash(bytes), bytes: bytes.length,
    initialBoundary: 'strikeCreated', initialSnapshotSha256: record.boundaries.strikeCreated.snapshotSha256,
    scope: 'original-controller-mode-creation-and-first-native-h-only; not GPU/CPU or whole-shot parity',
    boundarySnapshots: Object.fromEntries(BOUNDARIES.map(name => [name, record.boundaries[name].snapshotSha256])),
    boundarySummaries: Object.fromEntries(BOUNDARIES.map(name => [name, record.boundaries[name].summary])),
    apiJournalEncoding: JOURNAL_ENCODING, apiJournalSha256: journalDigest(record.apiJournal), observerAgreement: record.observerAgreement,
    sourceRuntimeChanged: false, candidateStateUsed: false, nativeFirstHReseeding: false};
  fs.writeFileSync(file, bytes, {flag: 'wx'});
  fs.writeFileSync(file + '.json', JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
  return manifest;
}
function loadArtifact(file) {
  assert.ok(file && path.isAbsolute(file), 'Explicit existing absolute oracle path required; capture is never implicit');
  const bytes = fs.readFileSync(file), manifest = JSON.parse(fs.readFileSync(file + '.json', 'utf8'));
  assert.deepEqual(manifest.identity, sourceIdentity(), 'Exact original application and decoder provenance');
  assert.match(manifest.captureRevision, /^[a-f0-9]{40}$/, 'Frozen capture commit retained separately from source-byte admission');
  assert.equal(hash(bytes), manifest.sha256); assert.equal(bytes.length, manifest.bytes);
  const record = verifyRecord(v8.deserialize(bytes));
  assert.equal(manifest.apiJournalEncoding, JOURNAL_ENCODING);
  assert.equal(journalDigest(record.apiJournal), manifest.apiJournalSha256);
  assert.equal(record.boundaries.strikeCreated.snapshotSha256, manifest.initialSnapshotSha256);
  for (const name of BOUNDARIES) assert.equal(record.boundaries[name].snapshotSha256, manifest.boundarySnapshots[name]);
  return {record, manifest};
}
module.exports = {R, D, SCHEMA, SETTINGS, BOUNDARIES, SOURCES, JOURNAL_ENCODING, journalDigest, hash, parts, plain,
  observeMethod, sourceIdentity, captureOriginalController, decodeBoundary, clothPairs, verifyRecord, captureArtifact, loadArtifact};
if (require.main === module) captureArtifact(process.argv[2]).then(manifest => console.log(JSON.stringify(manifest, null, 2)))
  .catch(error => { console.error(error.stack); process.exitCode = 1; });
