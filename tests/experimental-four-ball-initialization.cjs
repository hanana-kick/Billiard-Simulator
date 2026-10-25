'use strict';
// Independent native mass/pose preparation reference only. Restore the original
// strikeCreated bytes, recompute unchanged attachments, propagate poses, and
// never step that world. Actual first-h snapshots remain expected-only evidence.
const {test, before} = require('node:test'), assert = require('node:assert/strict');
const C = require('./four-ball-created-fixture.cjs'), E = require('./four-ball-initialization-seed.cjs');
const I = require('../src/experimental-cue-initialization');
let record, seed, reference;
const same = (a, b) => a.index === b.index && a.generation === b.generation;
function handle(h) {
  const d = new DataView(new ArrayBuffer(8)); d.setUint32(0, h.index, true); d.setUint32(4, h.generation, true);
  return d.getFloat64(0, true);
}
before(async () => {
  ({record} = C.loadArtifact(process.env.FOUR_BALL_CREATION_V8));
  const created = record.boundaries.strikeCreated;
  seed = E.exportInitialSeed({strikeCreated: created,
    modeCreationJournal: record.modeCreationJournal, strikeCreationJournal: record.strikeCreationJournal});
  await C.R.init(); const world = C.R.World.restoreSnapshot(created.snapshot);
  try {
    for (const input of seed.numericInputs)
      world.getRigidBody(handle(seed.userChanges.roles[input.role])).recomputeMassPropertiesFromColliders();
    world.propagateModifiedBodyPositionsToColliders();
    reference = C.decodeBoundary({boundary: 'independent-unchanged-mass-and-position-api-reference',
      nativeSteps: 72, snapshot: world.takeSnapshot(), application: created.application});
  } finally { world.free(); }
});
function compare(output, input) {
  const body = reference.bodies.find(b => same(b.handle, seed.userChanges.roles[input.role])), m = body.mprops;
  const quantities = [['worldCom', m.world_com, 3e-6], ['invMass', m.effective_inv_mass, 2e-6],
    ['invInertia', ['m11', 'm12', 'm13', 'm22', 'm23', 'm33'].map(k => m.effective_world_inv_inertia[k]), 3e-6],
    ['maxExtent', m.max_extent, 2e-6], ['ccdThickness', body.ccd.ccd_thickness, 2e-6]];
  for (const [key, expected, tolerance] of quantities) {
    const actual = Array.isArray(expected) ? output[key] : [output[key]], target = Array.isArray(expected) ? expected : [expected];
    for (let index = 0; index < target.length; index++)
      assert.ok(Math.abs(actual[index] - target[index]) <= tolerance,
        input.role + '.' + key + '[' + index + '] ' + actual[index] + ' vs ' + target[index]);
  }
  body.colliders.forEach((h, index) => {
    const collider = reference.colliders.find(c => same(c.handle, h));
    for (const key of ['translation', 'rotation']) for (let i = 0; i < collider.pos[key].length; i++)
      assert.ok(Math.abs(output.colliders[index][key][i] - collider.pos[key][i]) <= 3e-6);
  });
  assert.deepEqual(m.local_mprops, seed.userChanges.created.bodies[input.role].mprops.local_mprops,
    'Independent native repeat-fold retains the original eager local mass exactly');
}
test('four original created bodies match independent unchanged native mass/propagation APIs', () => {
  seed.numericInputs.forEach(input => compare(I.initializeReference(input), input));
  assert.equal(reference.nativeSteps, 72);
  assert.equal(reference.summary.bvhLeaves, 22, 'Mass/pose preparation never inserts missing proxies');
  assert.equal(reference.summary.contactPairs, 3, 'Mass/pose preparation never invents fourth cloth contact');
});
test('original first-h mass identity and deferred extent/IDs are expected-only comparisons', () => {
  const actual = I.initializeFourBallUserChanges(seed.userChanges,
    Object.fromEntries(seed.numericInputs.map(input => [input.role, I.initializeReference(input)])));
  const post = record.boundaries['firstH.postWorld'];
  for (const role of ['freshBall', 'shaft', 'head', 'guide']) {
    const body = actual.bodies.find(b => b.role === role), expected = post.bodies.find(b => same(b.handle, body.handle));
    assert.deepEqual(body.ids, expected.ids); assert.equal(body.maxExtent, expected.mprops.max_extent);
    assert.deepEqual(body.raw.mprops.local_mprops, expected.mprops.local_mprops);
  }
  assert.notDeepEqual(actual.manager, post.state.islands, 'Incomplete collision/energy manager is explicitly not full first-h parity');
  assert.equal(actual.pendingCollisionWork.postCollisionManagerComplete, false);
});
test('actual WGSL initializes all four source-created bodies from the unchanged 40-float plan', {timeout: 30000}, async t => {
  if (process.env.REQUIRE_WEBGPU !== '1') return t.skip('REQUIRE_WEBGPU=1');
  const {pathToFileURL} = require('node:url'), {create, globals} = await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);
  Object.assign(globalThis, globals);
  const gpu = create(['backend=vulkan']), adapter = await gpu.requestAdapter(), device = await adapter.requestDevice();
  let stage;
  try {
    stage = await I.createGpuInitializer(device);
    const results = await stage.initializeBatch(seed.numericInputs);
    results.forEach((result, index) => {
      compare(result, seed.numericInputs[index]);
      assert.deepEqual({...result, backend: 'cpu-reference'}, I.initializeReference(seed.numericInputs[index]));
    });
    const manager = I.initializeFourBallUserChanges(seed.userChanges,
      Object.fromEntries(results.map((result, i) => [seed.numericInputs[i].role, result])));
    assert.deepEqual(manager.bodies.find(b => b.role === 'freshBall').ids,
      {active_island_id: 0, active_set_id: 3, island_id: 3, island_index: 0});
    assert.equal(manager.pendingCollisionWork.postCollisionManagerComplete, false);
    await assert.rejects(stage.initializeBatch([...seed.numericInputs, seed.numericInputs[0]]), /Bounded/);
    await assert.rejects(stage.initializeBatch([...seed.numericInputs].reverse()), /Four-body batch/);
    const [single] = await stage.initializeBatch([seed.numericInputs[0]]); compare(single, seed.numericInputs[0]);
  } finally { stage?.dispose(); device.destroy(); }
});
