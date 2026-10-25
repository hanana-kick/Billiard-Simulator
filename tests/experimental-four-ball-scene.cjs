'use strict';
// Prepared source-boundary coverage, not initial-only/full-world parity.
const {test, before, after} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), {pathToFileURL} = require('node:url');
const F = require('./four-ball-scene-fixture.cjs'), Scene = require('../src/experimental-scene-activation');
let fixture, initial, expected, scalar;
const hashes = new Map(['../src/experimental-scene-activation', '../src/experimental-sleep-activation', '../src/experimental-arithmetic-graph', '../src/experimental-stage-runtime']
    .map(name => { const file = require.resolve(name); return [file, F.C.hash(fs.readFileSync(file))]; }));
before(() => {
    assert.ok(process.env.FOUR_BALL_SCENE_V8, 'Explicit genuine native pre-energy capture required');
    fixture = F.load(process.env.FOUR_BALL_SCENE_V8);
    [initial, expected] = fixture.observed.rows;
});
after(() => { for (const [file, hash] of hashes) assert.equal(F.C.hash(fs.readFileSync(file)), hash, 'Frozen tested numerical source: ' + file); });
function compare(actual, raw) {
    assert.deepEqual(actual.manager, raw.islands, 'Every serialized source manager field');
    assert.deepEqual(actual.modifiedBodies, raw.modifiedBodies, 'Exact native mutation queue');
    for (const b of raw.bodies) {
        const a = actual.bodies.find(x => F.same(x.handle, b.handle)); assert.ok(a, 'Complete native registry');
        assert.deepEqual(a.ids, b.ids); assert.equal(a.changes, b.changes); assert.equal(a.type, b.body_type);
        assert.deepEqual(a.activation, b.activation, 'Exact f32 activation for body ' + b.handle.index);
    }
}
async function run(device) {
    const input = F.context(initial, fixture.roles), physical = F.physical(initial);
    const stage = device ? await Scene.createGpuStage(device, input) : Scene.createReferenceStage(input), token = {};
    stage.claim(token);
    try {
        stage.beginFrame({apiCalls: [], removedBodies: []}, token);
        const out = await stage.observe(physical, {dt: initial.integration_parameters.dt, lengthUnit: initial.integration_parameters.length_unit}, [], token);
        compare(out.context, expected);
        for (const row of out.bodies) {
            const b = expected.bodies.find(b => F.same(b.handle, row.handle));
            assert.deepEqual(row.force, b.forces.force, 'Native effective force body ' + b.handle.index);
            assert.deepEqual(row.torque, b.forces.torque, 'Native effective torque body ' + b.handle.index);
        }
        stage.postApplication([], token); stage.commit(token); Scene.validate(stage.snapshot());
        console.log(JSON.stringify({scope: fixture.observed.scope, backend: device ? 'actual-webgpu' : 'cpu-reference',
            dynamicBodies: out.bodies.length, sourceInputBoundary: 'genuine-source-post-connectivity-pre-energy',
            readOnlyProbe: fixture.observed.instrumentedAndIndependentPostBytesEqual,
            activeSetEpoch: out.context.manager.active_set_epoch, sleepScanStamp: out.context.manager.persistent.sleep_scan_stamp}));
        return out;
    } finally { stage.abort(token); stage.release(token); stage.dispose(); }
}
test('genuine N4 native source boundaries retain exact original six-dynamic and fixed-guide structure', () => {
    assert.equal(initial.bodies.length, 23); assert.equal(initial.bodies.filter(b => b.body_type === 'Dynamic').length, 6);
    assert.equal(initial.phase, 'pre-energy'); assert.equal(expected.phase, 'post-activation');
    assert.equal(initial.islands.persistent.sleep_scan_stamp, 72); assert.equal(expected.islands.persistent.sleep_scan_stamp, 73);
    const p = initial.islands.persistent;
    assert.deepEqual(p.islands.v.filter(Boolean).map(c => c.bodies.map(h => h.index)), [[16], [17], [18], [19], [20, 21]]);
    assert.deepEqual(p.islands.v.slice(0, 4).map(c => c.contact_links.map(l => l.edge_id)), [[0], [2], [1], [5]], 'Native unsorted cloth edge registration');
    assert.deepEqual(p.islands.v[4].joint_links.map(l => [l.key.value.index, l.body1.index, l.body2.index]), [[0, 20, 21], [1, 22, 20]]);
    assert.deepEqual(p.free_islands, [5]); assert.deepEqual(p.removal_journal, []);
    assert.deepEqual(expected.islands, fixture.original.boundaries['firstH.postWorld'].state.islands, 'Native source phase manager matches original continuous WASM first h');
    for (const b of expected.bodies) {
        const original = fixture.original.boundaries['firstH.postWorld'].bodies.find(x => F.same(x.handle, b.handle));
        assert.deepEqual(b.activation, original.activation, 'Source activation exactly equals continuous original WASM');
        assert.deepEqual(b.forces.force, original.forces.force); assert.deepEqual(b.forces.torque, original.forces.torque);
    }
    assert.equal(fixture.observed.sourceJointJournalReplayed, true);
    assert.equal(fixture.observed.serializedInitialStatePreserved, true);
    assert.equal(fixture.observed.serializedInitialQueueOrderPreserved, true);
    assert.equal(fixture.snapshotOnlyControl.sourceJointJournalReplayed, false);
    assert.equal(fixture.snapshotOnlyControl.rows[1].islands.persistent.islands.v[4].constraint_remove_count, 1);
    assert.equal(expected.islands.persistent.islands.v[4].constraint_remove_count, 2);
    assert.notDeepEqual(fixture.snapshotOnlyControl.rows[1].islands, expected.islands, 'Snapshot-only restore omits source pending joint events and is not continuous-original proof');
    const input = F.context(initial, fixture.roles); delete input.roles; input.bodies.forEach(b => delete b.role);
    assert.doesNotThrow(() => Scene.validate(input), 'Admission uses registry/joint structure, not role labels');
});
test('prepared six-body reference force and energy agree exactly with the true source activation boundary', async () => { scalar = await run(); });
test('prepared six-body actual WGSL force and energy match source and scalar outputs', {timeout: 30000}, async t => {
    if (process.env.REQUIRE_WEBGPU !== '1') return t.skip('REQUIRE_WEBGPU=1 required');
    assert.ok(scalar, 'Scalar/native source prerequisite');
    const {create, globals} = await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href); Object.assign(globalThis, globals);
    const gpu = create(['backend=vulkan']), adapter = await gpu.requestAdapter(), device = await adapter.requestDevice();
    try { const output = await run(device); assert.deepEqual(output.bodies, scalar.bodies);
        assert.deepEqual(output.context, scalar.context);
    } finally { device.destroy(); }
});
