import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_MODEL, CANONICAL_DEFAULT_PARAMETERS, CANONICAL_PROFILES, CANONICAL_CLOCK_MAX, CANONICAL_BUDGET_SEMANTICS,
  createCanonicalShotClock, validateCanonicalShotClock, inspectCanonicalPhaseBudget,
  encodeCanonicalScene, validateCanonicalScene, validateCanonicalRequest, validateCanonicalCandidate, canonicalSlotForId, canonicalIdForSlot,
  createCanonicalRequest, createCanonicalCandidate, canonicalResultIdentity, createCanonicalBatchEnvelope,
  cloneCanonicalWords, createCanonicalSceneTransfer, readCanonicalSceneTransfer,
  createCanonicalEpochGate, decodeCanonicalResult, CANONICAL_SCORE_UNAVAILABLE,
  assertCanonicalBackendCompatibility, createSelectedShotTraceRequest,
  executeCanonicalBatch, hydrateSelectedShotTrace, exportCanonicalCheckpoint, restoreCanonicalCheckpoint,
} from '../src/direct-candidate/canonical-engine-contract.mjs';
const v = (x = 0, y = 0, z = 0) => ({x, y, z});
const rot = () => ({x: 0, y: 0, z: 0, w: 1});
function snapshot(n = 4) {
  const vertices = [0, 0, 0, .1, 0, 0, 0, .1, 0, 0, 0, .1], indices = [0, 1, 2, 0, 1, 3, 1, 2, 3, 0, 2, 3];
  return {params: {...CANONICAL_DEFAULT_PARAMETERS}, dt: 1 / 960, strokeSubsteps: 64, revision: 1,
    world: new Uint8Array([10, 20, 30]),
    objects: Array.from({length: n}, (_, i) => ({id: [50, 8, 300, 19][i] ?? 400 + i, shape: 'sphere', kind: 'ball', mass: .21, radius: .03075, pos: v(-.8 + i * .3, .03075, 0), v: v(), w: v(), rot: rot(), color: '#abc', label: 'ball ' + i})),
    statics: [{shape: 'box', kind: 'cloth', pos: v(0, -.05, 0), half: v(1.42, .05, .71), v: v(), w: v(), rot: rot()},
      ...Array.from({length: 4}, (_, i) => ({shape: 'convex', kind: 'cushion', pos: v(i, 0, 0), rot: rot(), v: v(), w: v(), vertices: [...vertices], indices: [...indices]})),
      {shape: 'box', kind: 'floor', pos: v(0, -.88, 0), half: v(5, .1, 4), v: v(), w: v(), rot: rot()}],
  };
}
const manifest = s => ({objectIds: s.objects.map(o => o.id), staticCount: s.statics.length});
const encode = s => encodeCanonicalScene(s, manifest(s));
const rules = n => ({game: n, firstId: 8, secondId: 300, opponentId: n === 4 ? 19 : null, threeCushion: false, search: false, method: 'carom', minCushions: 0, allowKiss: true, kissFacts: false, conditionOnly: false});
function request(scene = encode(snapshot()).scene, overrides = {}) {
  return createCanonicalRequest({scene, epoch: 1, requestId: 123, selectedId: 50, purpose: 'manual', rules: rules(scene.slotToId.length), executionProfile: 'canonical-local-v1', budget: {maximumEvents: 1024, maximumTicks: 2 ** 26, maximumWorkItems: 1000000}, ...overrides});
}
const settings = overrides => ({angle: 30.1234567, elevation: 8, speed: 2, tipX: .1, tipY: .1, ...overrides});
const candidate = (r = request(), overrides = {}) => createCanonicalCandidate(r, 91, settings(overrides));
function decode(packet, r, c, options = {}) {
  return decodeCanonicalResult(Uint32Array.from(packet), {request: r, candidate: c, batchEnvelope: createCanonicalBatchEnvelope(r, [c]), ...options});
}
const codes = a => a.reasons.map(x => x.code);
const restEvidence = {termination: 'MODEL_REST', rosterMask: 15, restMask: 15, unresolvedEvent: false};
const pendingEvidence = {termination: 'INCOMPLETE', rosterMask: 15, restMask: 0, unresolvedEvent: false};
const unsupportedEvidence = {...pendingEvidence, termination: 'UNSUPPORTED'};
const conditionEvidence = {...pendingEvidence, termination: 'CONDITION_FAILURE'};

test('whole 3/4 roster and all source physical settings are immutable and retained', () => {
  for (const n of [3, 4]) {
    const s = snapshot(n), admission = encode(s), scene = admission.scene;
    assert.equal(admission.admitted, true, JSON.stringify(admission.reasons));
    assert.equal(scene.physical.bodies.length, n);
    assert.equal(scene.physical.statics.length, s.statics.length);
    assert.deepEqual(scene.physical.parameters, CANONICAL_DEFAULT_PARAMETERS);
    assert.deepEqual(scene.physical.sourceSettings, {dt: s.dt, strokeSubsteps: s.strokeSubsteps});
    assert.equal(Object.isFrozen(scene.physical.bodies[0].pos), true);
    const original = scene.sceneId;
    s.objects[1].pos.x += .2; s.params.ballFriction = .6; s.statics[1].vertices[0] = 3;
    assert.equal(scene.sceneId, original);
    assert.equal(scene.physical.parameters.ballFriction, .04);
    assert.throws(() => { scene.physical.bodies[0].pos.x = 5; }, TypeError);
    assert.equal(request(scene).modelId, CANONICAL_MODEL.id);
  }
  assert.equal(CANONICAL_MODEL.productionEnabled, false);
  assert.equal(CANONICAL_MODEL.executionImplementedByThisModule, false);
  assert.equal(CANONICAL_PROFILES['canonical-local-v1'].modelId, CANONICAL_MODEL.id);
});

test('complete roster rejects extras, 12-body UI scene, missing records, duplicate IDs, and boxes without truncation', () => {
  for (const n of [2, 5, 12]) {
    const a = encode(snapshot(n));
    assert.equal(a.admitted, false);
    assert.equal(a.scene.physical.bodies.length, n);
    assert.ok(codes(a).includes('BODY_COUNT_UNSUPPORTED'));
  }
  const s = snapshot(), m = manifest(s); s.objects.pop();
  const a = encodeCanonicalScene(s, m);
  assert.ok(codes(a).includes('INCOMPLETE_ROSTER'));
  assert.ok(codes(encodeCanonicalScene(snapshot())).includes('INCOMPLETE_ROSTER'));
  const duplicate = snapshot(); duplicate.objects[2].id = duplicate.objects[0].id;
  assert.ok(codes(encode(duplicate)).includes('INVALID_OBJECT_IDS'));
  const box = snapshot(); Object.assign(box.objects[0], {shape: 'box', half: v(.045, .045, .045), rot: {x: 0, y: .5, z: 0, w: Math.sqrt(.75)}});
  const b = encode(box);
  assert.equal(b.admitted, false); assert.ok(codes(b).includes('SHAPE_UNSUPPORTED'));
  assert.deepEqual(b.scene.physical.bodies.find(x => x.id === 50).rotation, box.objects[0].rot);
  assert.throws(() => request(b.scene), /admitted/);
});

test('every changed material, source timestep, and source stroke substeps is explicit unsupported', () => {
  const baseline = encode(snapshot()).scene.sceneId;
  for (const key of Object.keys(CANONICAL_DEFAULT_PARAMETERS)) {
    const s = snapshot(); s.params[key] *= .95;
    const a = encode(s); assert.equal(a.admitted, false); assert.ok(a.reasons.some(x => x.path === 'params.' + key));
    assert.equal(a.scene.physical.parameters[key], s.params[key]); assert.notEqual(a.scene.sceneId, baseline);
  }
  for (const [key, value] of [['dt', 1 / 480], ['strokeSubsteps', 128]]) {
    const s = snapshot(); s[key] = value; const a = encode(s);
    assert.equal(a.admitted, false); assert.equal(a.scene.physical.sourceSettings[key], value); assert.notEqual(a.scene.sceneId, baseline);
  }
  const extra = snapshot(); extra.params.unrecognizedStiffness = 2;
  assert.ok(codes(encode(extra)).includes('UNKNOWN_PARAMETER'));
  const unknown = snapshot(); unknown.objects[0].inertia = v(1, 2, 3);
  const ua = encode(unknown); assert.ok(codes(ua).includes('UNKNOWN_BODY_FIELD'));
  assert.deepEqual(ua.scene.physical.bodies.find(x => x.id === 50).unsupportedFields.inertia, v(1, 2, 3));
  assert.deepEqual(validateCanonicalScene(structuredClone(ua.scene)), ua.scene);
});

test('IDs map to stable slots across roster permutation and large noncontiguous IDs', () => {
  const a = snapshot(), b = structuredClone(a); b.objects.reverse(); b.statics.reverse();
  const sa = encode(a).scene, sb = encode(b).scene;
  assert.equal(sa.sceneId, sb.sceneId);
  assert.deepEqual(sa.slotToId, [8, 19, 50, 300]);
  for (let i = 0; i < 4; i++) assert.equal(canonicalSlotForId(sa, canonicalIdForSlot(sa, i)), i);
  const ra = request(sa), rb = request(sb);
  assert.equal(ra.requestKey, rb.requestKey); assert.equal(ra.cueSlot, 2);
  assert.deepEqual(ra.ruleWords.slice(0, 4), [4, 0, 3, 1]);
  assert.throws(() => canonicalSlotForId(sa, 0), /absent/);
  assert.throws(() => canonicalIdForSlot(sa, 4), /absent/);
  assert.throws(() => request(sa, {rules: {...rules(4), opponentId: 300}}), /Distinct/);
});

test('sphere visual quaternion, labels and colors do not affect physical scene identity', () => {
  const a = snapshot(), b = structuredClone(a);
  b.objects[0].rot = {x: .2, y: .3, z: .4, w: Math.sqrt(.71)}; b.objects[0].label = 'new'; b.objects[0].color = '#fff';
  const sa = encode(a).scene, sb = encode(b).scene;
  assert.equal(sa.sceneId, sb.sceneId); assert.notDeepEqual(sa.presentation, sb.presentation);
  assert.equal(request(sa).requestKey, request(sb).requestKey);
  const height = snapshot(); height.objects[0].pos.y = .5;
  const sh = encode(height).scene;
  assert.equal(sh.physical.bodies.find(x => x.id === 50).pos.y, .5);
  assert.notEqual(sh.sceneId, sa.sceneId);
  assert.match(candidate(request(sh)).requiredProducerAdmission.join(';'), /height.*no snap/);
});

test('raw candidates preserve settings and reject UI range outside current raw capability rather than clamp', () => {
  const r = request(), a = candidate(r), b = candidate(r, {angle: 30.1234568});
  assert.equal(a.settings.angle, 30.1234567); assert.equal(a.admitted, true); assert.notEqual(a.candidateKey, b.candidateKey);
  for (const s of [{speed: .25}, {speed: 5}, {tipX: .92, tipY: 0}, {elevation: 86}, {angle: 3601}]) {
    const c = candidate(r, s); assert.equal(c.admitted, false); assert.ok(c.reasons.length);
    for (const [key, value] of Object.entries(s)) assert.equal(c.settings[key], value);
  }
  assert.throws(() => createCanonicalCandidate(r, 91, {...settings(), mass: .2}), /five/);
  const moving = snapshot(); moving.objects[3].v.z = .01;
  assert.equal(candidate(request(encode(moving).scene)).admitted, false);
  assert.notEqual(candidate(request(r.scene, {rules: {...rules(4), threeCushion: true}})).candidateKey, a.candidateKey);
  assert.notEqual(candidate(request(r.scene, {executionProfile: 'strict-carried-v1'})).candidateKey, a.candidateKey);
  assert.notEqual(candidate(request(r.scene, {budget: {...r.budget, maximumEvents: 1}})).candidateKey, a.candidateKey);
});

test('one-time transfer owns a complete copy; transfer never detaches source scene or caller words', () => {
  const scene = encode(snapshot()).scene, payload = createCanonicalSceneTransfer(scene);
  const clone = structuredClone(payload);
  clone.bytes[0] = 0;
  assert.notEqual(clone.bytes[0], payload.bytes[0]);
  const received = structuredClone(payload, {transfer: payload.transfer});
  assert.equal(payload.bytes.byteLength, 0); assert.ok(received.bytes.byteLength > 0);
  const restored = readCanonicalSceneTransfer(received, scene.sceneId);
  assert.deepEqual(restored, scene); assert.equal(Object.isFrozen(restored.physical.parameters), true);
  assert.equal(scene.physical.bodies.length, 4);
  assert.throws(() => readCanonicalSceneTransfer(payload, scene.sceneId), /attached/);
  assert.throws(() => readCanonicalSceneTransfer(received, 'wrong'), /identity/);
  const input = new Uint32Array([9, 10, 11, 12]), view = input.subarray(1, 3), owned = cloneCanonicalWords(view);
  assert.deepEqual(owned, new Uint32Array([10, 11])); assert.equal(owned.byteOffset, 0);
  const moved = structuredClone(owned, {transfer: [owned.buffer]}); assert.deepEqual(moved, view); assert.equal(input.byteLength, 16);
  assert.throws(() => cloneCanonicalWords(owned), /attached/);
  if (typeof SharedArrayBuffer !== 'undefined') assert.throws(() => cloneCanonicalWords(new Uint32Array(new SharedArrayBuffer(8))), /non-shared/);
});

test('epoch gate rejects changed candidate parameters, request/profile/scene identity, cancellation, and late completion', () => {
  const gate = createCanonicalEpochGate(), first = gate.begin(), r = request(undefined, {epoch: first.epoch}), c = candidate(r);
  gate.bind(r); const id = gate.register(c); assert.equal(gate.validate(id).ok, true);
  assert.equal(gate.validate({...id, sceneId: 'different'}).reason, 'STALE_CANDIDATE');
  assert.equal(gate.validate({...id, requestKey: 'different'}).reason, 'STALE_REQUEST');
  assert.equal(gate.validate({...id, profileId: 'strict-carried-v1'}).reason, 'STALE_CANDIDATE');
  assert.throws(() => gate.register(candidate(r, {speed: 3})), error => error.code === 'CANDIDATE_ID_REUSE');
  gate.cancel('user edit'); assert.equal(first.signal.aborted, true); assert.equal(gate.validate(id).reason, 'CANCELLED');
  assert.throws(() => gate.assertCurrent(id), error => error.code === 'CANCELLED');
  const next = gate.begin(); assert.equal(next.epoch, first.epoch + 1); assert.equal(gate.validate(id).reason, 'STALE_EPOCH');
  assert.throws(() => gate.bind(r), error => error.code === 'STALE_EPOCH');
  const nr = request(r.scene, {epoch: next.epoch}), nc = candidate(nr); gate.bind(nr); gate.register(nc);
  assert.throws(() => gate.bind(request(r.scene, {epoch: next.epoch, purpose: 'forecast'})), error => error.code === 'EPOCH_REUSE');
  assert.throws(() => decode([91, 1, 0, 1], r, c, {gate, evidence: restEvidence}), error => error.code === 'STALE_EPOCH');
});

test('compact PASS/gameplay FAIL requires complete admitted model REST, not optional physical certificate', () => {
  const r = request(), c = candidate(r);
  const pass = decode([91, 1, 0, 1], r, c, {evidence: restEvidence, diagnostics: {physicalRestCertified: false, globalReceiptCertified: false, globalBudgetWithin: false}});
  assert.equal(pass.status, 'PASS'); assert.equal(pass.modelRest, true); assert.equal(pass.gameplayApplicable, true);
  assert.equal(pass.diagnostics.physicalRestCertified, false);
  const foul = decode([91, 2, 1, 0xffffffff], r, c, {evidence: restEvidence});
  assert.equal(foul.score, -1); assert.equal(foul.gameplayApplicable, true);
  const incomplete = decode([91, 3, 3, CANONICAL_SCORE_UNAVAILABLE], r, c, {evidence: {...pendingEvidence, restMask: 3}});
  assert.equal(incomplete.score, null); assert.equal(incomplete.gameplayApplicable, false);
  const unsupported = decode([91, 4, 4, CANONICAL_SCORE_UNAVAILABLE], r, c, {evidence: unsupportedEvidence});
  assert.equal(unsupported.status, 'UNSUPPORTED');
  assert.throws(() => decode([91, 1, 0, 1], r, c), /evidence/);
  for (const e of [{...restEvidence, rosterMask: 7, restMask: 7}, {...restEvidence, restMask: 7}, {...restEvidence, unresolvedEvent: true}]) assert.throws(() => decode([91, 1, 0, 1], r, c, {evidence: e}));
  for (const packet of [[91, 1, 3, 1], [91, 2, 0, 0], [91, 3, 3, CANONICAL_SCORE_UNAVAILABLE], [91, 2, 1, CANONICAL_SCORE_UNAVAILABLE], [91, 1, 0, 0xffffffff]]) assert.throws(() => decode(packet, r, c, {evidence: restEvidence}));
  assert.throws(() => decode([91, 3, 3, 0xffffffff], r, c, {evidence: pendingEvidence}), /Score/);
  assert.throws(() => decode([91, 3, 0, CANONICAL_SCORE_UNAVAILABLE], r, c, {evidence: pendingEvidence}), /INCOMPLETE/);
  assert.throws(() => decode([91, 1, 0, 1], r, c, {evidence: restEvidence, batchEnvelope: {...createCanonicalBatchEnvelope(r, [c]), identity: {...createCanonicalBatchEnvelope(r, [c]).identity, sceneId: 'wrong'}}}), error => error.code === 'IDENTITY_MISMATCH');
});

test('early condition FAIL is search-only, never a gameplay score/REST or fabricated miss on exhaustion', () => {
  const r = request(undefined, {purpose: 'search', rules: {...rules(4), conditionOnly: true, search: true}}), c = candidate(r);
  const fail = decode([91, 2, 7, CANONICAL_SCORE_UNAVAILABLE], r, c, {evidence: conditionEvidence});
  assert.equal(fail.status, 'FAIL'); assert.equal(fail.conditionOnly, true); assert.equal(fail.modelRest, false); assert.equal(fail.gameplayApplicable, false); assert.equal(fail.score, null);
  const legacy = decode([91, 5, 7, CANONICAL_SCORE_UNAVAILABLE], r, c, {evidence: conditionEvidence});
  assert.deepEqual(legacy, fail, 'legacy finalizer status 5 normalizes to semantic condition-only FAIL');
  for (const packet of [[91, 2, 7, 0xffffffff], [91, 1, 7, CANONICAL_SCORE_UNAVAILABLE], [91, 2, 3, CANONICAL_SCORE_UNAVAILABLE]]) assert.throws(() => decode(packet, r, c, {evidence: conditionEvidence}));
  assert.throws(() => decode([91, 2, 7, CANONICAL_SCORE_UNAVAILABLE], r, c, {evidence: {...conditionEvidence, unresolvedEvent: true}}));
  const ordinary = request(); assert.throws(() => decode([91, 2, 7, CANONICAL_SCORE_UNAVAILABLE], ordinary, candidate(ordinary), {evidence: conditionEvidence}));
  const cancelled = decode([91, 3, 8, CANONICAL_SCORE_UNAVAILABLE], r, c, {evidence: pendingEvidence});
  assert.equal(cancelled.status, 'INCOMPLETE'); assert.equal(cancelled.reason, 'CANCELLED');
});

test('unadmitted raw settings remain UNSUPPORTED even if a producer supplies a passing packet', () => {
  const r = request(), c = candidate(r, {speed: .25});
  assert.throws(() => decode([91, 1, 0, 1], r, c, {evidence: restEvidence}), /Unadmitted/);
  assert.equal(decode([91, 4, 4, CANONICAL_SCORE_UNAVAILABLE], r, c, {evidence: unsupportedEvidence}).status, 'UNSUPPORTED');
});

test('one shared batch envelope carries exact identities for multiple compact rows', () => {
  const r = request(), a = candidate(r), b = createCanonicalCandidate(r, 92, settings({angle: -20})), batchEnvelope = createCanonicalBatchEnvelope(r, [a, b]);
  assert.equal(batchEnvelope.candidates.length, 2); assert.equal(batchEnvelope.identity.sceneId, r.sceneId);
  assert.equal(Object.hasOwn(batchEnvelope.candidates[0], 'sceneId'), false);
  assert.equal(decode([92, 1, 0, 1], r, b, {batchEnvelope, evidence: restEvidence}).candidateId, 92);
  assert.throws(() => createCanonicalBatchEnvelope(r, [a, a]), /distinct/);
  assert.throws(() => decode([91, 1, 0, 1], r, a, {batchEnvelope: createCanonicalBatchEnvelope(r, [b]), evidence: restEvidence}), error => error.code === 'IDENTITY_MISMATCH');
});

test('CPU fallback preserves canonical model/profile; selected trace/checkpoints are explicit unimplemented interfaces', () => {
  const r = request(), c = candidate(r);
  for (const backend of ['cpu', 'webgpu']) assert.equal(assertCanonicalBackendCompatibility(r, {backend, modelId: r.modelId, profileId: r.profileId, contractVersion: 1}), true);
  for (const bad of [{backend: 'rapier'}, {backend: 'cpu', modelId: 'rapier'}, {backend: 'cpu', profileId: 'strict-carried-v1'}]) assert.throws(() => assertCanonicalBackendCompatibility(r, {backend: 'cpu', modelId: r.modelId, profileId: r.profileId, contractVersion: 1, ...bad}), error => error.code === 'BACKEND_MODEL_MISMATCH');
  const trace = createSelectedShotTraceRequest(c, {sampleEveryTicks: 100, maximumFrames: 500, checkpoints: true});
  assert.deepEqual(trace.identity, canonicalResultIdentity(c)); assert.equal(trace.requirements.implemented, false);
  assert.match(trace.requirements.checkpoint.join(';'), /rule\/contact-episode/);
  for (const fn of [executeCanonicalBatch, hydrateSelectedShotTrace, exportCanonicalCheckpoint, restoreCanonicalCheckpoint]) assert.throws(() => fn(r), error => error.name === 'CanonicalInterfaceNotImplementedError' && error.code === 'NOT_IMPLEMENTED');
});

// This source snapshot is serialization evidence only, never a trajectory oracle.
test('actual default PhysicsLab snapshot admits every real default field and static without omission', async () => {
  const {createRequire} = await import('node:module'); const require = createRequire(import.meta.url);
  const RAPIER = require('../vendor/rapier.cjs'); await RAPIER.init(); require('../src/math.js'); require('../src/physics.js');
  const lab = new globalThis.PhysicsLab(RAPIER);
  try {
    const source = lab.snapshot({trails: false}), admission = encodeCanonicalScene(source, {objectIds: lab.objects.map(o => o.id), staticCount: lab.statics.length});
    assert.equal(admission.admitted, true, JSON.stringify(admission.reasons));
    assert.equal(admission.scene.physical.bodies.length, lab.objects.length);
    assert.equal(admission.scene.physical.statics.length, lab.statics.length);
    assert.deepEqual(admission.scene.physical.parameters, lab.params);
    assert.deepEqual(CANONICAL_DEFAULT_PARAMETERS, globalThis.LabDefaults);
    for (const body of source.objects) assert.deepEqual(admission.scene.physical.bodies.find(x => x.id === body.id).pos, body.pos);
    assert.equal(admission.scene.physical.statics.filter(x => x.kind === 'cushion').length, 4);
    assert.equal(admission.scene.physical.statics.filter(x => x.kind === 'wood').length, source.statics.filter(x => x.kind === 'wood').length);
  } finally {lab.dispose();}
});


test('structured-clone validation rejects altered scene admission, mapping, request identity, and candidate settings', () => {
  const scene = encode(snapshot()).scene, r = request(scene), c = candidate(r);
  assert.deepEqual(validateCanonicalScene(structuredClone(scene)), scene);
  assert.deepEqual(validateCanonicalRequest(structuredClone(r)), r);
  assert.deepEqual(validateCanonicalCandidate(structuredClone(r), structuredClone(c)), c);
  const map = structuredClone(scene); map.idToSlot[50] = 0;
  assert.throws(() => validateCanonicalScene(map), /mismatch/);
  const geometry = structuredClone(scene); geometry.physical.statics[0].pos.x += .1;
  assert.throws(() => validateCanonicalScene(geometry), /mismatch/);
  const badSource = snapshot(); badSource.params.tipFriction = .2;
  const forged = structuredClone(encode(badSource).scene); forged.admitted = true;
  assert.throws(() => validateCanonicalScene(forged), /mismatch/);
  assert.throws(() => request(forged), /mismatch/);
  const wrong = structuredClone(r); wrong.budget.maximumEvents++;
  assert.throws(() => validateCanonicalRequest(wrong), error => error.code === 'REQUEST_IDENTITY_MISMATCH');
  const changed = structuredClone(c); changed.settings.speed = 3;
  assert.throws(() => validateCanonicalCandidate(r, changed), error => error.code === 'CANDIDATE_IDENTITY_MISMATCH');
  const unsafe = structuredClone(candidate(r, {speed: .25})); unsafe.admitted = true;
  assert.throws(() => validateCanonicalCandidate(r, unsafe), error => error.code === 'CANDIDATE_IDENTITY_MISMATCH');
});


test('existing four-word finalizer keeps known gameplay separate from unavailable search/gameplay verdict', async () => {
  const {finalizeCandidateCPU} = await import('../src/direct-candidate/deterministic-candidate-finalizer.mjs');
  const r = request(undefined, {purpose: 'search', rules: {...rules(4), search: true}}), c = candidate(r), config = Uint32Array.from(r.ruleWords);
  const rule = new Uint32Array(32); rule[13] = 1; rule[18] = 1; rule[19] = 4;
  const unsupportedSearch = finalizeCandidateCPU(c.candidateId, 3, rule, config);
  assert.deepEqual(Array.from(unsupportedSearch), [91, 4, 5, 1]);
  const searchResult = decodeCanonicalResult(unsupportedSearch, {request: r, candidate: c, batchEnvelope: createCanonicalBatchEnvelope(r, [c]), evidence: restEvidence});
  assert.equal(searchResult.status, 'UNSUPPORTED'); assert.equal(searchResult.reason, 'UNSUPPORTED_SEARCH'); assert.equal(searchResult.score, 1); assert.equal(searchResult.gameplayApplicable, true);
  rule[19] = 3;
  const incompleteSearch = finalizeCandidateCPU(c.candidateId, 3, rule, config);
  assert.deepEqual(Array.from(incompleteSearch), [91, 3, 3, 1]);
  const incomplete = decodeCanonicalResult(incompleteSearch, {request: r, candidate: c, batchEnvelope: createCanonicalBatchEnvelope(r, [c]), evidence: restEvidence});
  assert.equal(incomplete.status, 'INCOMPLETE'); assert.equal(incomplete.modelRest, true); assert.equal(incomplete.gameplayApplicable, true); assert.equal(incomplete.score, 1);
  rule[18] = 0;
  const unsupportedGameplay = finalizeCandidateCPU(c.candidateId, 3, rule, config);
  assert.deepEqual(Array.from(unsupportedGameplay), [91, 4, 6, CANONICAL_SCORE_UNAVAILABLE]);
  const unknown = decodeCanonicalResult(unsupportedGameplay, {request: r, candidate: c, batchEnvelope: createCanonicalBatchEnvelope(r, [c]), evidence: restEvidence});
  assert.equal(unknown.modelRest, true); assert.equal(unknown.gameplayApplicable, false); assert.equal(unknown.score, null);
  assert.throws(() => decode([91, 4, 4, 1], r, c, {evidence: restEvidence}), /MODEL_REST|Unsupported/);
});


test('total Q20 shot duration includes raw strike and retains its original clock across phase handoffs', () => {
  const base = request(), r = request(base.scene, {budget: {...base.budget, maximumTicks: 100}}), clock = createCanonicalShotClock(r, 1000);
  assert.equal(CANONICAL_BUDGET_SEMANTICS.timeScale, 2 ** 20);
  assert.match(CANONICAL_BUDGET_SEMANTICS.maximumTicks, /INCLUDING raw strike/);
  assert.equal(clock.startingTick, 1000); assert.equal(clock.deadlineTick, 1100); assert.equal(clock.maximumTicks, 100);
  assert.equal(Object.isFrozen(clock), true); assert.deepEqual(validateCanonicalShotClock(r, structuredClone(clock)), clock);
  const raw = inspectCanonicalPhaseBudget(r, clock, 1000, 16);
  assert.deepEqual(raw, {scope: 'resource-admission-only', canAdvance: true, elapsedTicks: 0, remainingTicks: 100, nextTick: 1016, reason: null});
  const afterStrike = inspectCanonicalPhaseBudget(r, clock, 1048, 32);
  assert.equal(afterStrike.elapsedTicks, 48); assert.equal(afterStrike.remainingTicks, 52); assert.equal(afterStrike.nextTick, 1080);
  const boundary = inspectCanonicalPhaseBudget(r, clock, 1080, 20); assert.equal(boundary.canAdvance, true); assert.equal(boundary.nextTick, 1100);
  const blocked = inspectCanonicalPhaseBudget(r, clock, 1090, 16);
  assert.equal(blocked.canAdvance, false); assert.equal(blocked.reason, 'TIME_HORIZON'); assert.equal(blocked.remainingTicks, 10); assert.equal(blocked.nextTick, null);
  assert.equal(Object.hasOwn(blocked, 'modelRest'), false); assert.equal(Object.hasOwn(blocked, 'score'), false); assert.equal(Object.hasOwn(blocked, 'completed'), false);
  assert.equal(inspectCanonicalPhaseBudget(r, clock, 1100, 1).canAdvance, false);
  assert.throws(() => inspectCanonicalPhaseBudget(r, clock, 1101, 1), error => error.code === 'CLOCK_BUDGET_EXCEEDED');
  assert.throws(() => inspectCanonicalPhaseBudget(r, clock, 999, 1), error => error.code === 'CLOCK_BUDGET_EXCEEDED');
  assert.throws(() => inspectCanonicalPhaseBudget(r, clock, 1048, 0), /positive/);
  assert.throws(() => validateCanonicalShotClock(r, {...clock, startingTick: 1048, deadlineTick: 1148}), error => error.code === 'CLOCK_IDENTITY_MISMATCH');
  const edited = request(r.scene, {budget: {...r.budget, maximumTicks: 101}});
  assert.throws(() => validateCanonicalShotClock(edited, clock), error => error.code === 'CLOCK_IDENTITY_MISMATCH');
  assert.equal(r.budget.maximumWorkItems, base.budget.maximumWorkItems); assert.equal(r.budget.maximumEvents, base.budget.maximumEvents);
});

test('declared absolute clock overflow rejects before execution; per-shot clock is independent of UI time', () => {
  const base = request(), r = request(base.scene, {budget: {...base.budget, maximumTicks: 16}});
  assert.equal(createCanonicalShotClock(r, CANONICAL_CLOCK_MAX - 16).deadlineTick, CANONICAL_CLOCK_MAX);
  for (const start of [CANONICAL_CLOCK_MAX - 15, CANONICAL_CLOCK_MAX, 0xffffffff, -1, 0.5]) assert.throws(() => createCanonicalShotClock(r, start), error => error.code === 'CLOCK_OVERFLOW');
  const relative = createCanonicalShotClock(r, 0); assert.equal(relative.deadlineTick, 16);
  const short = request(r.scene, {budget: {...r.budget, maximumTicks: 15}}), clock = createCanonicalShotClock(short, 0);
  assert.equal(inspectCanonicalPhaseBudget(short, clock, 0, 16).canAdvance, false, 'zero raw steps fit: checkpoint/incomplete rather than running an over-budget step');
  const huge = request(r.scene, {budget: {...r.budget, maximumTicks: 0xffffffff}});
  assert.throws(() => createCanonicalShotClock(huge, 0), error => error.code === 'CLOCK_OVERFLOW');
});

test('static appearance follows canonical sorting and transport without entering physical identity',()=>{
 const s=snapshot();s.statics.forEach((o,i)=>{o.color='#12345'+i;o.label='surface '+i;});
 const a=encode(s).scene;
 a.physical.statics.forEach((o,i)=>{const original=s.statics.find(x=>x.kind===o.kind&&JSON.stringify(x.pos)===JSON.stringify(o.pos));assert.deepEqual(a.staticPresentation[i],{color:original.color,label:original.label});});
 const reordered=structuredClone(s);reordered.statics.reverse();assert.deepEqual(encode(reordered).scene.staticPresentation,a.staticPresentation);
 const changed=structuredClone(s);changed.statics.forEach(o=>{o.color='#ffffff';o.label='new label';});assert.equal(encode(changed).scene.sceneId,a.sceneId);
 assert.deepEqual(validateCanonicalScene(structuredClone(a)).staticPresentation,a.staticPresentation);
 assert.deepEqual(readCanonicalSceneTransfer(createCanonicalSceneTransfer(a),a.sceneId).staticPresentation,a.staticPresentation);
 assert.ok(Object.isFrozen(a.staticPresentation[0]));s.statics[0].color='#000000';assert.notEqual(a.staticPresentation.find(x=>x.label==='surface 0').color,s.statics[0].color);
});
