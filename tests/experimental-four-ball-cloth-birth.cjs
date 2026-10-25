'use strict';
const {test, before} = require('node:test'), assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const F = require('./four-ball-created-fixture.cjs'), S = require('./four-ball-cloth-birth-seed.cjs');
const B = require('../src/experimental-four-ball-cloth-birth');
const expectedArtifact = 'b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187';
let record, seed, oracle, manifest;
before(() => {
  assert.ok(process.env.FOUR_BALL_CREATION_V8, 'Explicit frozen original-controller artifact required');
  ({record, manifest} = F.loadArtifact(process.env.FOUR_BALL_CREATION_V8));
  assert.equal(manifest.sha256, expectedArtifact);
  // This exact one-property input is all the candidate exporter can see.
  seed = S.exportInitialSeed({strikeCreated: record.boundaries.strikeCreated});
  oracle = S.expectedPostWorld(record.boundaries['firstH.postWorld']);
});
function exactFloats(actual, expected, path = '') {
  if (typeof expected === 'number') {
    assert.equal(typeof actual, 'number', path);
    // Signed zero carries no distinct cache impulse; all nonzero f32 values
    // must match exactly, with no relative tolerance hiding source divergence.
    assert.ok(actual === expected, `${path}: ${actual} !== ${expected}`);
  } else if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), path); assert.equal(actual.length, expected.length, path);
    expected.forEach((x, i) => exactFloats(actual[i], x, `${path}[${i}]`));
  } else for (const [k, value] of Object.entries(expected)) exactFloats(actual[k], value, `${path}.${k}`);
}
function checkGeometry(view) {
  assert.equal(view.phase, 'geometry'); assert.equal(view.globalTransactionBound, false);
  assert.equal(view.activationOwned, false); assert.equal(view.postCollisionManagerComplete, false);
  assert.equal(view.initialSnapshotSha256, record.boundaries.strikeCreated.snapshotSha256);
  assert.deepEqual(view.body, {index: 19, generation: 0}); assert.deepEqual(view.primary, {index: 22, generation: 0});
  assert.deepEqual(view.clothCollider, {index: 0, generation: 0});
  assert.deepEqual(view.metadata.broadPhaseEvents, ['AddPair']); assert.deepEqual(view.metadata.contactEvents, [{started: true}]);
  assert.equal(view.metadata.oldPair, false); assert.equal(view.metadata.oldActive, false); assert.equal(view.metadata.geometryRefreshed, true);
  const s = view.state; assert.equal(s.topology.pairPresent, true); assert.equal(s.topology.pointPresent, true);
  assert.equal(s.topology.active, true); assert.equal(s.topology.recycleValid, true);
  exactFloats(s, oracle.cache, 'first geometry cache');
  exactFloats({min: s.topology.ballMin, max: s.topology.ballMax}, oracle.proxy, 'own created proxy');
  assert.equal(s.canSleep, true); assert.equal(s.ccdEnabled, true); assert.equal(s.maxCcdSubsteps, 4);
  assert.equal(s.activationPhase, undefined, 'No fabricated common-manager activation admission');
  assert.equal(s.ccdPhase, undefined, 'No fabricated common-manager CCD admission');
  return s;
}
async function run(factory, t) {
  const stage = await factory(seed); let geometry, numerical;
  try {
    geometry = await stage.prepare(); const prepared = checkGeometry(B.assertReceipt(geometry, stage, stage.backend, 'geometry'));
    assert.deepEqual(prepared.linear, [0, 0, 0]);
    numerical = await stage.solveNumericalComponent(); const out = B.assertReceipt(numerical, stage, stage.backend, 'numerical-component');
    exactFloats(out.state, oracle.cache, 'first numerical cache'); exactFloats(out.state, oracle.body, 'first numerical body');
    assert.equal(out.state.impulse, 0); assert.equal(out.state.warmImpulse, 0);
    assert.equal(out.metadata.sourceActivationAdmissionClaimed, false); assert.equal(out.metadata.sourceCcdAdmissionClaimed, false);
    assert.equal(out.globalTransactionBound, false); assert.equal(out.postCollisionManagerComplete, false);
    // Read views are copies. Mutating a label/cache never changes private state.
    out.state.impulse = 999; out.globalTransactionBound = true;
    assert.equal(B.readReceipt(numerical).state.impulse, 0); assert.equal(B.readReceipt(numerical).globalTransactionBound, false);
    stage.commit(); assert.throws(() => B.readReceipt(geometry), /Live/); assert.throws(() => B.readReceipt(numerical), /Live/);
    await assert.rejects(() => stage.prepare(), /unavailable/);
    t.diagnostic(JSON.stringify({backend: stage.backend, artifactSha256: manifest.sha256, initialSnapshotSha256: seed.initialSnapshotSha256,
      oracleBoundary: 'firstH.postWorld', geometryCacheExactF32: true, numericalStateExactF32: true,
      newProxyExactF32: true, nativeFutureStateSeeding: false, nativeRuntimeCalls: 0, globalGraphActivationOwned: false,
      wholeShotParity: false, scope: 'one original fourth-ball initial cloth birth and numerical component'}));
  } finally { stage.dispose(); }
}
test('initial-only export refuses oracle state, replay cache, and mutated source projections', () => {
  assert.throws(() => S.exportInitialSeed({strikeCreated: record.boundaries['firstH.postWorld']}));
  assert.throws(() => S.exportInitialSeed({strikeCreated: record.boundaries.strikeCreated, postWorld: record.boundaries['firstH.postWorld']}));
  const badRow = structuredClone(record.boundaries.strikeCreated); badRow.bodies.find(b => b.handle.index === 19).vels.linvel[1] = Math.fround(-.001);
  assert.throws(() => S.exportInitialSeed({strikeCreated: badRow}), /deep-equal/);
  for (const edit of [x => x.boundary = 'firstH.postWorld', x => x.body.mprops.max_extent = x.ball.shape.value.radius,
    x => x.body.ids.active_set_id = 3, x => x.body.mprops.local_mprops.inv_mass = 0,
    x => x.initialAbsence.pair = false, x => x.nativePostWorld = {}, x => x.body.ccd.ccd_enabled = false,
    x => x.ball.flags.collision_groups.filter = 0, x => x.body.vels.linvel[1] = Math.fround(-.001),
    x => x.parameters.num_solver_iterations = 1e9, x => x.parameters.normalized_prediction_distance = Math.fround(.01)]) {
    const bad = structuredClone(seed); edit(bad); assert.throws(() => B.validate(bad));
  }
  assert.equal(B.CAPABILITY.wholeWorld, false); assert.equal(B.CAPABILITY.collisionManagerComplete, false);
});
test('cache receipts enforce source origin, exact owner, stale abort, and no external state input', async () => {
  const a = await B.createReferenceStage(seed), b = await B.createReferenceStage(seed), token = {};
  try {
    await assert.rejects(() => a.prepare({translation: [0, 0, 0]}), /injection/);
    await assert.rejects(() => a.solveNumericalComponent(), /geometry/);
    const first = await a.prepare();
    assert.throws(() => B.readReceipt(structuredClone(first)), /Live/);
    assert.throws(() => B.assertReceipt(first, b, 'cpu-reference'), /origin-bound/);
    assert.throws(() => B.assertReceipt(first, a, 'webgpu'), /origin-bound/);
    assert.throws(() => B.assertReceipt(first, a, 'cpu-reference', 'numerical-component'), /origin-bound/);
    a.abort(); assert.throws(() => B.readReceipt(first), /Live/);
    a.claim(token); await assert.rejects(() => a.prepare(), /owner token/); await assert.rejects(() => a.prepare({}), /owner token/);
    const retry = await a.prepare(token); assert.notEqual(retry, first); checkGeometry(B.readReceipt(retry));
    assert.throws(() => B.assertReceipt(first, a, 'cpu-reference'), /origin-bound/);
    a.abort(token); a.release(token);
  } finally { a.dispose(); b.dispose(); }
});
test('source shared arithmetic creates original fourth cloth cache and first-h state without oracle seeding', {timeout: 120000}, async t => run(B.createReferenceStage, t));
test('actual WGSL computes fresh bounds, cloth geometry and first-h component state', {timeout: 120000}, async t => {
  if (process.env.REQUIRE_WEBGPU !== '1') return t.skip('REQUIRE_WEBGPU=1 is required for actual GPU acceptance');
  assert.ok(process.env.GPU_NATIVE_MODULE);
  const {create, globals} = await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href); Object.assign(globalThis, globals);
  const gpu = create(['backend=vulkan']), adapter = await gpu.requestAdapter(); assert.ok(adapter);
  const device = await adapter.requestDevice();
  try { await run(s => B.createGpuStage(device, s), t); } finally { device.destroy(); }
});
