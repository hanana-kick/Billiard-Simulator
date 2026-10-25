'use strict';
const {test, before} = require('node:test'), assert = require('node:assert/strict');
const F = require('./four-ball-created-fixture.cjs'), E = require('./four-ball-broad-graph-seed.cjs');
const S = require('./four-ball-cloth-birth-seed.cjs'), B = require('../src/experimental-four-ball-cloth-birth');
const C = require('../src/experimental-cue-broad-phase'), J = require('../src/experimental-contact-graph-journal');
const Sleep = require('../src/experimental-sleep-activation'), CCD = require('../src/experimental-ccd-inactive');
const L = require('../src/experimental-world-lifecycle');
const copy = x => structuredClone(x); let seed, graphSeeds;
before(() => {
  const {record, manifest} = F.loadArtifact(process.env.FOUR_BALL_CREATION_V8);
  assert.equal(manifest.sha256, 'b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187');
  const strikeCreated = record.boundaries.strikeCreated;
  seed = S.exportInitialSeed({strikeCreated});
  graphSeeds = E.exportInitialSeeds({strikeCreated, modeCreationJournal: record.modeCreationJournal, strikeCreationJournal: record.strikeCreationJournal});
});
async function setup() {
  const token = {}, broad = await C.createInitialFourBallReferenceStage(graphSeeds.broadSeed),
    graph = J.createReferenceStageWithInitialFourBallCue(graphSeeds.graphSeed, broad), cloth = await B.createReferenceStage(seed);
  broad.claim(token); graph.claim(token); cloth.claim(token);
  const projection = graph.createProjection(token), geometry = await cloth.prepare(token),
    pre = await broad.prepare(copy(graphSeeds.own), token), transaction = (await graph.prepare(graphSeeds.own.balls.map(b => ({body: copy(b.body), translation: copy(b.translation)})), token, pre)).receipt;
  return {token, broad, graph, cloth, projection, transaction, geometry,
    close() { cloth.abort(token); graph.abort(token); broad.abort(token); cloth.release(token); graph.release(token); broad.release(token);
      cloth.dispose(); graph.dispose(); broad.dispose(); }};
}
test('exact live graph transaction binds actual own geometry, never labels or native cache injection', async () => {
  const a = await setup(), b = await setup();
  try {
    assert.equal(a.cloth.initialState().topology.pairPresent, false);
    assert.equal(B.readReceipt(a.geometry).state.topology.active, true);
    assert.throws(() => a.cloth.snapshot(), /Committed/);
    assert.throws(() => a.cloth.bindGeometry({projection: copy(a.projection), transaction: a.transaction}, a.token), /origin-bound/);
    assert.throws(() => a.cloth.bindGeometry({projection: a.projection, transaction: copy(a.transaction)}, a.token), /transaction/);
    assert.throws(() => a.cloth.bindGeometry({projection: a.projection, transaction: b.transaction}, a.token), /transaction/);
    assert.throws(() => a.cloth.bindGeometry({projection: a.projection, transaction: a.transaction, expectedNativeCache: {}}, a.token), /Only exact/);
    const bound = a.cloth.bindGeometry({projection: a.projection, transaction: a.transaction}, a.token);
    const view = B.assertBoundGeometryReceipt(bound, a.transaction, 'cpu-reference');
    assert.equal(view.globalTransactionBound, true); assert.deepEqual(view.graph, {fromSequence: 0, edgeId: 5, lifetime: 6});
    assert.equal(view.activationOwned, false); assert.equal(view.postCollisionManagerComplete, false);
    assert.equal(B.readReceipt(a.geometry).globalTransactionBound, false, 'The earlier standalone receipt is not retroactively promoted');
    assert.throws(() => B.assertBoundGeometryReceipt(copy(bound), a.transaction, 'cpu-reference'), /source-generated/);
    assert.throws(() => B.assertBoundGeometryReceipt(bound, b.transaction, 'cpu-reference'), /source-generated/);
    assert.throws(() => B.assertBoundGeometryReceipt(bound, a.transaction, 'webgpu'), /source-generated/);
    assert.throws(() => a.cloth.bindGeometry({projection: a.projection, transaction: a.transaction}, a.token), /Unbound/);
    await assert.rejects(() => a.cloth.solveNumericalComponent(a.token), /geometry/);
    await assert.rejects(() => a.cloth.solvePrepared({activation: {sleeping: false}, activationPhase: 'source-observed-awake', ccdPhase: 'source-prediction-inactive'}, a.token), /transition/);
    assert.throws(() => a.cloth.takeContinuation(a.token), /committed actual/);
    assert.throws(() => a.cloth.assertPrepared(a.token), /Completed/);
    assert.throws(() => J.assertFourthClothBirthOwned(a.projection, 'cpu-reference'), /not owned/,
      'Binding alone never changes Journal or source manager ownership');
    a.graph.abort(a.token);
    assert.throws(() => B.readReceipt(bound), /transaction/);
    assert.throws(() => B.assertBoundGeometryReceipt(bound, a.transaction, 'cpu-reference'), /transaction/);
  } finally { a.close(); b.close(); }
});
test('own abort invalidates graph-bound proof even while the source graph transaction is still live', async () => {
  const x = await setup();
  try {
    const r = x.cloth.bindGeometry({projection: x.projection, transaction: x.transaction}, x.token);
    x.cloth.abort(x.token); assert.throws(() => B.readReceipt(r), /Live/);
    assert.throws(() => B.assertBoundGeometryReceipt(r, x.transaction, 'cpu-reference'), /source-generated/);
    const retry = await x.cloth.prepare(x.token), next = x.cloth.bindGeometry({projection: x.projection, transaction: x.transaction}, x.token);
    assert.notEqual(next, r); assert.equal(B.readReceipt(retry).globalTransactionBound, false);
    assert.equal(B.assertBoundGeometryReceipt(next, x.transaction, 'cpu-reference').graph.lifetime, 6);
  } finally { x.close(); }
});
test('actual local energy and CCD arithmetic admit lifecycle commit and transfer, without claiming a global scene solve', async () => {
  const x = await setup(); let continuation;
  try {
    const r = x.cloth.bindGeometry({projection: x.projection, transaction: x.transaction}, x.token), s = B.readReceipt(r).state;
    x.graph.acceptInitialClothBirth(r, x.token);
    x.graph.narrowTransitions([{collider1: copy(seed.floor.handle), collider2: copy(seed.ball.handle), active: true}], x.token);
    const updated = Sleep.updateReference({bodyType: 'dynamic', operation: 'update-energy', activation: copy(seed.body.activation),
      body: {translation: s.translation, rotation: s.rotation, linear: s.linear, angular: s.angular}, maxExtent: s.radius, lengthUnit: s.lengthUnit, dt: s.dt});
    assert.equal(updated.diagnostics.eligible, false); assert.equal(updated.activation.sleeping, false);
    const activation = {...copy(seed.body.activation), ...updated.activation,
      sleep_prev_pose: {...copy(seed.body.activation.sleep_prev_pose), ...updated.activation.sleep_prev_pose}};
    const check = CCD.preReference({kind: 'dynamic-body-ccd-check', bodyType: 'dynamic', ccdEnabled: true, maxCcdSubsteps: 4,
      sleeping: false, softFrame: false, softCcdPrediction: 0, linear: s.linear, angular: s.angular,
      translation: s.translation, rotation: s.rotation, force: seed.body.forces.force, torque: seed.body.forces.torque,
      invMass: s.invMass, invInertia: s.invInertia, localCom: [0, 0, 0], maxExtent: s.radius,
      ccdThickness: seed.body.ccd.ccd_thickness, dt: s.dt});
    assert.equal(check.admitted, true);
    const solved = await x.cloth.solvePrepared({activation, activationPhase: 'source-observed-awake', ccdPhase: 'source-prediction-inactive'}, x.token);
    const state = B.readReceipt(solved).state;
    assert.equal(state.linear[1], -0.0001596679794602096);
    assert.deepEqual(state.activation, activation); assert.equal(state.impulse, 0);
    const poses = graphSeeds.own.balls.map(b => ({body: copy(b.body), translation: copy(b.translation)}));
    const post = await x.broad.postSolve(copy(graphSeeds.own), x.token); await x.graph.postSolve(poses, x.token, post);
    x.cloth.assertPrepared(x.token); x.graph.assertPrepared(x.token); x.broad.assertPrepared(x.token);
    x.graph.commit(x.token);
    assert.throws(() => B.readReceipt(r), /transaction/, 'Consumed graph cannot reauthorize a geometry result');
    x.cloth.commit(x.token); x.broad.commit(x.token);
    assert.deepEqual(x.cloth.snapshot(), state);
    continuation = x.cloth.takeContinuation(x.token); assert.ok(L.isPreparedContactStage(continuation, 'cpu-reference'));
    assert.throws(() => x.cloth.takeContinuation(x.token), /committed actual/);
    // The same stage, same cache and transferred lease are genuinely usable.
    const next = await continuation.prepare(state, x.token);
    assert.equal(next.metadata.oldPair, true); assert.equal(next.metadata.oldActive, true);
    assert.deepEqual(next.metadata.broadPhaseEvents, []); assert.deepEqual(next.metadata.contactEvents, []);
    continuation.abort(x.token);
  } finally {
    if (continuation) { continuation.abort(x.token); continuation.release(x.token); continuation.dispose(); }
    x.close();
  }
});
