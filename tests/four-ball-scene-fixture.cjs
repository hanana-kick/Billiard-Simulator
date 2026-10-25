'use strict';
// Source-only phase capture. Native prepared inputs are explicitly component
// test inputs, never first-h future states for an initial-only candidate world.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), v8 = require('node:v8');
const {execFileSync} = require('node:child_process');
const C = require('./four-ball-created-fixture.cjs');
const copy = x => structuredClone(x), same = (a, b) => a.index === b.index && a.generation === b.generation;
function bodyList(typed) {
    const arena = C.D.field(C.D.field(C.D.field(typed, 'bodies'), 'bodies'), 'items');
    return arena.items.flatMap((entry, index) => entry.variant === 'Occupied'
        ? [{handle: {index, generation: Number(C.D.field(entry, 'generation').value)}, ...C.plain(C.D.field(entry, 'value'))}] : []);
}
function boundary(typed) {
    return {...C.plain(typed), bodies: bodyList(typed),
        modifiedBodies: C.plain(C.D.field(C.D.field(typed, 'bodies'), 'modified_bodies'))[0],
        joints: C.D.findStructs(C.D.field(typed, 'impulse_joints'), 'ImpulseJoint').map(C.plain)};
}
function context(raw, roles, phase = 'source-collision-and-connectivity-complete-pre-energy') {
    return {kind: 'source-scene-activation', phase, noOtherPendingChanges: true,
        roles: copy(roles), manager: copy(raw.islands), modifiedBodies: copy(raw.modifiedBodies), consumedModifiedBodies: [],
        bodies: raw.bodies.map(b => ({handle: copy(b.handle), type: b.body_type, enabled: b.enabled, changes: b.changes,
            ids: copy(b.ids), activation: copy(b.activation), maxExtent: b.mprops.max_extent,
            jointAdjacency: raw.joints.filter(j => same(j.body1, b.handle) || same(j.body2, b.handle)).map(j => copy(j.handle))}))};
}
function physical(raw) {
    return raw.bodies.filter(b => b.body_type === 'Dynamic' && !b.activation.sleeping).map(b => ({handle: copy(b.handle),
        translation: copy(b.pos.position.translation), rotation: copy(b.pos.position.rotation), linear: copy(b.vels.linvel), angular: copy(b.vels.angvel),
        userForce: copy(b.forces.user_force), userTorque: copy(b.forces.user_torque), gravity: copy(raw.gravity),
        gravityScale: b.forces.gravity_scale, invMass: copy(b.mprops.effective_inv_mass)}));
}
function probe(snapshot, journal = []) {
    const binary = process.env.FOUR_BALL_SCENE_PROBE;
    assert.ok(binary && path.isAbsolute(binary), 'Explicit isolated scene source probe binary required');
    const output = JSON.parse(execFileSync(binary, journal.length ? [JSON.stringify(journal)] : [], {input: snapshot, maxBuffer: 64 * 1024 * 1024, timeout: 30000}));
    assert.equal(output.schema, 'original-four-ball-scene-source-boundary-v1');
    assert.equal(output.inputSha256, C.hash(snapshot)); assert.equal(output.sourceRevision, C.D.SOURCE_REVISION);
    assert.equal(output.instrumentedAndIndependentPostBytesEqual, true); assert.equal(output.originalWasmOracle, false);
    const rows = output.boundaries.map(boundary);
    assert.deepEqual(rows.map(r => r.phase), ['pre-energy', 'post-activation']);
    return {...output, rows};
}
function identities(record) {
    const binary = process.env.FOUR_BALL_SCENE_PROBE;
    const proofPath = path.resolve(path.dirname(binary), '../scene-probe-provenance.json');
    const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    assert.equal(proof.binarySha256, C.hash(fs.readFileSync(binary)));
    for (const [file, field] of [['capture.rs', 'captureSha256'], ['main.rs', 'hostSha256'], ['restore-journal.rs', 'restorationSha256']])
        assert.equal(C.hash(fs.readFileSync(path.join(__dirname, 'four-ball-scene-probe', file))), proof.instrumentation[field], 'Frozen native probe source: ' + file);
    return {probeProvenanceSha256: C.hash(fs.readFileSync(proofPath)), inputSha256: record.boundaries['firstH.preWorld'].snapshotSha256,
        creationArtifactSha256: C.hash(fs.readFileSync(process.env.FOUR_BALL_CREATION_V8)),
        nativeProbeSha256: C.hash(fs.readFileSync(binary)),
        fixtures: Object.fromEntries(['four-ball-scene-fixture.cjs', 'four-ball-created-fixture.cjs'].map(file => [file, C.hash(fs.readFileSync(path.join(__dirname, file)))]))};
}
function capture(file) {
    assert.ok(path.isAbsolute(file) && !fs.existsSync(file) && !fs.existsSync(file + '.json'), 'New isolated artifact required');
    const {record} = C.loadArtifact(process.env.FOUR_BALL_CREATION_V8), identity = identities(record);
    const journal = record.strikeCreationJournal.filter(row => ['createImpulseJoint', 'setContactsEnabled', 'setLimits'].includes(row.method));
    const observed = probe(record.boundaries['firstH.preWorld'].snapshot, journal);
    assert.equal(observed.sourceJointJournalReplayed, true); assert.equal(observed.serializedInitialStatePreserved, true);
    assert.deepEqual(observed.sourceJointJournal, JSON.parse(JSON.stringify(journal)), 'JSON transport omits only void setter result properties; all source arguments retained');
    const snapshotOnlyControl = probe(record.boundaries['firstH.preWorld'].snapshot);
    const data = {identity, roles: record.roles, observed, snapshotOnlyControl};
    const bytes = v8.serialize(data), manifest = {identity, sha256: C.hash(bytes), bytes: bytes.length,
        scope: observed.scope, instrumentedAndIndependentPostBytesEqual: true};
    fs.writeFileSync(file, bytes, {flag: 'wx'}); fs.writeFileSync(file + '.json', JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
    return manifest;
}
function load(file) {
    const {record} = C.loadArtifact(process.env.FOUR_BALL_CREATION_V8), bytes = fs.readFileSync(file), manifest = JSON.parse(fs.readFileSync(file + '.json', 'utf8'));
    assert.equal(C.hash(bytes), manifest.sha256); assert.equal(bytes.length, manifest.bytes);
    assert.deepEqual(manifest.identity, identities(record));
    const data = v8.deserialize(bytes); assert.deepEqual(data.identity, manifest.identity);
    return {...data, original: record, manifest};
}
module.exports = {C, same, copy, bodyList, boundary, context, physical, probe, capture, load};
if (require.main === module) console.log(JSON.stringify(capture(process.argv[2]), null, 2));
