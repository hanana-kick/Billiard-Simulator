'use strict';
// SPDX-License-Identifier: Apache-2.0
// LIGHT contracts only: no native initialization/steps, decoder, GPU, or artifacts.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Load the real pure adapter functions with native/numerical dependencies
// inaccessible. A clean worktree need not contain an ignored vendor binary.
// This does not validate any successful numerical export or runtime factory.
const unavailable = new Proxy({}, {get(_target, name) {throw Error('Heavy execution forbidden in light contract: ' + String(name));}});
function loadSource(name, dependencies) {
  const filename = path.join(__dirname, name), module = {exports: {}};
  const localRequire = name => {
    if (name.startsWith('node:')) return require(name);
    assert.ok(Object.hasOwn(dependencies, name), 'Unapproved light-test dependency ' + name);
    return dependencies[name];
  };
  new Function('require', 'module', 'exports', '__filename', '__dirname', fs.readFileSync(filename, 'utf8'))(localRequire, module, module.exports, filename, __dirname);
  return module.exports;
}
const previousRapier = Object.getOwnPropertyDescriptor(globalThis, 'RAPIER');
const Original = loadSource('four-ball-created-fixture.cjs', {
  '../vendor/rapier.cjs': unavailable, '../tools/rapier-snapshot-decoder': require('../tools/rapier-snapshot-decoder'),
  '../src/math.js': unavailable, '../src/render-cadence.js': unavailable, '../src/physics.js': unavailable,
  '../src/game-rules.js': unavailable, '../src/controller.js': unavailable
});
if (previousRapier) Object.defineProperty(globalThis, 'RAPIER', previousRapier); else delete globalThis.RAPIER;
const Init = loadSource('goal-four-initialization-seed.cjs', {'./four-ball-created-fixture.cjs': Original, '../src/experimental-cue-initialization': unavailable});
const InitialContacts = require('./goal-four-initial-contact-import.cjs');
const Broad = loadSource('goal-four-broad-graph-seed.cjs', {'./four-ball-created-fixture.cjs': Original, './goal-four-initialization-seed.cjs': Init, './goal-four-initial-contact-import.cjs': InitialContacts});
const World = loadSource('goal-four-world-seed.cjs', {'./four-ball-created-fixture.cjs': Original, './goal-four-initial-contact-import.cjs': InitialContacts,
  './three-ball-scene-fixture.cjs': unavailable, './goal-four-initialization-seed.cjs': Init,
  './goal-four-broad-graph-seed.cjs': Broad, '../src/experimental-cue-joint-snapshot': unavailable,
  '../src/experimental-cue-convex-topology': unavailable});
const copy = value => structuredClone(value);
const source = name => fs.readFileSync(require.resolve('./goal-four-' + name + '-seed.cjs'), 'utf8');
const initialization = source('initialization'), broad = source('broad-graph'), world = source('world');

function prefix() {
  return {goalStrikeCreated: {boundary: 'goalStrikeCreated', candidateInput: true,
    sourceRevision: Original.D.SOURCE_REVISION, engineSha256: Original.D.ENGINE_SHA256,
    hCount: 0, outerStep: 0, outerSubstep: 0, nativeSteps: 556,
    application: {steps: 484, time: .5, shots: 1,
      controller: {gameMode: 'four', selectedId: 1, settings: copy(Original.SETTINGS)},
      cue: {selectedId: 1, started: .5, contacted: false, contacts: [], obstructions: []},
      game: {pending: {cueId: 1, foul: false, reds: []}}}}, strikeCreationJournal: []};
}

test('placement origin has distinct factories, kinds, phase and layout contract', () => {
  assert.match(initialization, /originalPlacedGoalFourBallCreation:true/);
  assert.match(initialization, /original-placed-goal-four-ball-initialization-component-seed/);
  assert.match(initialization, /journal\(strikeCreationJournal,CUE_METHODS,'goalStrikeCreation',row\)/);
  assert.match(broad, /source-created-placed-goal-four-ball-cue-broad-phase/);
  assert.match(broad, /original-placed-goal-four-created-before-first-h/);
  assert.match(broad, /original-placed-goal-four-ball-cue-contact-graph/);
  assert.match(world, /original-placed-goal-four-ball-created-world/);
  assert.match(world, /original-placed-goal-four-ball-two-body-contact-phase/);
  assert.match(world, /original-controller-placed-goal-four-ball-layout/);
  for (const text of [initialization, broad, world]) {
    assert.doesNotMatch(text, /secondStrikeCreated|secondStrikeCreation|originalSettledFourBallCreation/);
    assert.doesNotMatch(text, /require\(['"]\.\/settled-four-|initializeSettledFourBall|validateSettledFourBall/);
    assert.doesNotMatch(text, /\.restoreSnapshot\(|\.decodeSnapshot\(|\.step\(|\.init\(|createGpu|new PhysicsLab|new LabController/);
  }
});

test('all exporters reject every extra input and earlier/later boundary before projecting', () => {
  for (const fn of [Init.exportInitialSeed, Broad.exportInitialSeeds, World.exportInitialSeed]) {
    assert.throws(() => fn({secondStrikeCreated: {}, strikeCreationJournal: []}), {code: 'ERR_ASSERTION'});
    assert.throws(() => fn({...prefix(), expected: {}}), {code: 'ERR_ASSERTION'});
    for (const boundary of ['beforeStrike', 'strikeCreated', 'secondStrikeCreated', 'firstH.preWorld', 'firstH.postWorld', 'firstH.postApplication', 'physicalRest']) {
      const input = prefix(); input.goalStrikeCreated.boundary = boundary;
      assert.throws(() => fn(input), {code: 'ERR_ASSERTION'});
    }
  }
});

test('goal first-shot clock, selected identity and defaults cannot masquerade as second turn', () => {
  const mutations = [
    row => { row.candidateInput = false; }, row => { row.hCount = 1; },
    row => { row.outerStep = 1; }, row => { row.outerSubstep = 1; },
    row => { row.nativeSteps++; }, row => { row.application.steps = 0; },
    row => { row.application.time = 0; }, row => { row.application.time = Infinity; },
    row => { row.application.shots = 2; }, row => { row.application.controller.selectedId = 2; },
    row => { row.application.cue.selectedId = 2; }, row => { row.application.cue.started = 0; },
    row => { row.application.cue.contacted = true; }, row => { row.application.cue.contacts = [2]; },
    row => { row.application.game.pending.cueId = 2; }, row => { row.application.game.pending.reds = [3]; },
    row => { row.application.controller.settings.angle = 90; }
  ];
  for (const mutate of mutations) {
    const input = prefix(); mutate(input.goalStrikeCreated);
    assert.throws(() => Init.exportInitialSeed(input), {code: 'ERR_ASSERTION'});
  }
});

test('exact initial arenas, generations, queues, proxies and caches remain source-owned', () => {
  assert.match(initialization, /D\.encodeLosslessTree\(row\.typedState\)/);
  assert.match(initialization, /nativeBincodeByteIdentical/);
  assert.match(initialization, /javascriptTypedReencodeByteIdentical/);
  assert.match(initialization, /activation\.sleeping,true/);
  assert.match(initialization, /Object\.values\(b\.ids\)\.every\(x=>x!==0xffffffff\)/);
  assert.match(initialization, /registry\.objects\.indexOf\(selected\), 0/);
  assert.match(broad, /assert\.deepEqual\(row\.state,state\)/);
  assert.match(broad, /assert\.deepEqual\(row\.bodies,nativeBodies\)/);
  assert.match(broad, /assert\.deepEqual\(row\.colliders,nativeColliders\)/);
  assert.match(broad, /assert\.deepEqual\(row\.proxies,projectedProxies/);
  assert.match(broad, /assert\.deepEqual\(row\.contactPairs,pairs/);
  assert.match(broad, /InitialContacts\.exportInitialContacts\(row\)/);
  assert.match(broad, /assert\.deepEqual\(graphSeed\.edges,initialContactOrigin\.edges/);
  assert.match(world, /cache:retained\?copy\(retained\.cache\)/);
  assert.match(broad, /Every original pair-channel edge needs its retained dynamic cache owner/);
  assert.match(world, /\[\[0,1\],\[0,2\],\[0,3\],\[1,2\],\[1,3\],\[2,3\]\]/);
  assert.match(world, /InitialContacts\.projectPairOrigin\(initialContactOrigin,broad\.graphSeed,objects,indices\)/);
  const contactImport = fs.readFileSync(require.resolve('./goal-four-initial-contact-import.cjs'), 'utf8');
  assert.match(contactImport, /Every retained pair requires its exact original cache/);
  assert.match(contactImport, /pair: retained \? copy\(retained\.cache\) :/);
  assert.match(contactImport, /\{pairPresent: 0, pointPresent: 0, active: 0, recycleValid: 0\}/);
  assert.match(world, /sourceApplicationSteps:app.steps,sourceApplicationTime:app.time/);
});

test('graph view resolves complete generation-bearing identities, not index aliases', () => {
  const floor = {index: 0, generation: 4}, ball = {index: 16, generation: 2};
  const floorBody = {index: 0, generation: 5}, ballBody = {index: 16, generation: 3};
  const row = {colliders: [
    {handle: floor, parent: {handle: floorBody}}, {handle: ball, parent: {handle: ballBody}},
    {handle: {index: 16, generation: 9}, parent: {handle: {index: 99, generation: 9}}}
  ], state: {narrow_phase: {contact_graph: {graph: {
    nodes: [{weight: floor, next: [0, 0xffffffff]}, {weight: ball, next: [0xffffffff, 0]}],
    edges: [{node: [0, 1], next: [0xffffffff, 0xffffffff], prev: [0xffffffff, 0xffffffff], weight: {
      collider1: floor, collider2: ball, contacts: {variant: 'Rigid', value: {manifolds: []}}
    }}]}}}}};
  const view = Broad.graphView(row);
  assert.deepEqual(view.edges[0], {collider1: floor, collider2: ball, body1: floorBody, body2: ballBody, active: false});
  assert.deepEqual(view.adjacency, [
    {collider: floor, outgoing: [0], incoming: []}, {collider: ball, outgoing: [], incoming: [0]},
    {collider: {index: 16, generation: 9}, outgoing: [], incoming: []}
  ]);
  for (const mutate of [r => r.colliders.splice(1, 1),
    r => r.state.narrow_phase.contact_graph.graph.nodes[1].weight.generation = 9,
    r => r.state.narrow_phase.contact_graph.graph.nodes[1].next[1] = 0xffffffff,
    r => r.state.narrow_phase.contact_graph.graph.edges[0].prev[1] = 0,
    r => r.state.narrow_phase.contact_graph.graph.edges[0].node.reverse()]) {
    const corrupted = copy(row); mutate(corrupted);
    assert.throws(() => Broad.graphView(corrupted), 'Never alias another generation or drop native adjacency');
  }
});

function metadataFixture() {
  // Synthetic only to exercise metadata validation. Never a numerical seed.
  const objects = [1, 2, 3, 4].map((id, index) => ({id, body: {index: 16 + index, generation: 2}}));
  const snapshotSha256 = 'a'.repeat(64), journal = [], placements = [];
  const sample = translation => ({translation, rotation: [0, 0, 0, 1], linear: [0, 0, 0], angular: [0, 0, 0], invInertia: Array(9).fill(0), sleeping: false});
  const descriptor = fields => ({kind: 'descriptor', className: 'Object', fields});
  for (const o of objects) {
    const position = {x: o.id / 10, y: .03, z: -.1};
    placements.push({id: o.id, method: 'LabController.move', accepted: true, position,
      before: sample([0, 0, 0]), after: sample(Object.values(position).map(Math.fround))});
    const push = (method, args, target = {kind: 'RigidBody', handle: o.body}) => journal.push({
      order: 100 + journal.length, phase: 'placement', method, args, target,
      nativeStepsBefore: 72, nativeStepsAfter: 72, result: undefined});
    push('propagateModifiedBodyPositionsToColliders', [], {kind: 'World'});
    push('setTranslation', [descriptor(position), true]);
    push('setLinvel', [descriptor({x: 0, y: 0, z: 0}), true]);
    push('setAngvel', [descriptor({x: 0, y: 0, z: 0}), true]);
    push('resetForces', [true]); push('resetTorques', [true]);
    push('propagateModifiedBodyPositionsToColliders', [], {kind: 'World'});
    push('propagateModifiedBodyPositionsToColliders', [], {kind: 'World'});
  }
  const row = {snapshotSha256, apiJournalLength: 141, application: {registry: {objects}}};
  const record = {schema: 'original-controller-four-ball-placed-goal-holdout-v1', initialBoundary: 'goalStrikeCreated',
    candidateStateUsed: false, nativeRestoreUsed: false, boundaries: {goalStrikeCreated: row}, placements, apiJournal: journal};
  return {row, record};
}

test('placement provenance accepts the distinct verified cushion artifact without relabeling its source', () => {
  const {record} = metadataFixture();
  record.schema = 'original-controller-four-ball-cushion-holdout-v1';
  assert.equal(World.placementProvenanceFromRecord(record).boundary, 'goalStrikeCreated');
  assert.equal(record.schema, 'original-controller-four-ball-cushion-holdout-v1');
  record.schema = 'unknown-source';
  assert.throws(() => World.placementProvenanceFromRecord(record), /Verified original placement/);
});

test('optional placement metadata copies observed moves and journals, never desired coordinates or outputs', () => {
  const {row, record} = metadataFixture();
  for (const key of ['input', 'frames', 'score', 'outcome', 'checkpoints']) Object.defineProperty(record, key, {get() {throw Error('Forbidden provenance source ' + key);}});
  Object.defineProperty(record.boundaries, 'firstH.postApplication', {get() {throw Error('Future state must not be read');}});
  const value = World.placementProvenanceFromRecord(record);
  assert.equal(value.numericalInput, false); assert.equal(value.initialSnapshotSha256, row.snapshotSha256);
  assert.equal(value.placementApiJournalSha256, Original.journalDigest(record.apiJournal));
  assert.deepEqual(value.placements, record.placements); assert.notEqual(value.placements, record.placements);
  assert.deepEqual(World.validatePlacementProvenance(value, row), value);
  const mutations = [
    v => {v.numericalInput = true;}, v => {v.initialSnapshotSha256 = 'b'.repeat(64);},
    v => {v.placements[0].accepted = false;}, v => {v.placements[0].position.x = 1;},
    v => {v.placementApiJournal[0].nativeStepsAfter++;}, v => {v.placementApiJournalSha256 = 'c'.repeat(64);},
    v => {v.expected = {};}, v => {v.placementApiJournal.pop();}
  ];
  for (const mutate of mutations) {const bad = copy(value); mutate(bad); assert.throws(() => World.validatePlacementProvenance(bad, row), {code: 'ERR_ASSERTION'});}
  assert.match(world, /placementProvenanceIncluded:placementProvenance!==undefined/);
});
