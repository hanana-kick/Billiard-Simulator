// Assertion-only helpers copied unchanged from live-registered-world-replay.mjs.
// The benchmark calls these only AFTER its replay measurement has stopped.
import nativeAssert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import crypto from 'node:crypto';
import Module, {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
function brief(value) {
  if (typeof value === 'string') return JSON.stringify(value.length > 140 ? value.slice(0, 140) + '…' : value);
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
  if (value === null || typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return 'Array(length=' + value.length + ')';
  if (ArrayBuffer.isView(value)) return value.constructor.name + '(bytes=' + value.byteLength + ')';
  return (value.constructor?.name ?? 'Object') + '{' + Object.keys(value).slice(0, 8).join(',') + (Object.keys(value).length > 8 ? ',…' : '') + '}';
}
function firstMismatch(actual, expected, at = '$', seen = new WeakMap()) {
  if (isDeepStrictEqual(actual, expected)) return null;
  const mismatch = () => ({path: at, actual: brief(actual), expected: brief(expected)});
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return mismatch();
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return {...mismatch(), path: at + '.[[Prototype]]'};
  const prior = seen.get(actual) ?? new WeakSet(); if (prior.has(expected)) return mismatch(); prior.add(expected); seen.set(actual, prior);
  if (Array.isArray(actual) && actual.length !== expected.length) return {path: at + '.length', actual: String(actual.length), expected: String(expected.length)};
  const keys = x => Reflect.ownKeys(x).filter(k => Object.prototype.propertyIsEnumerable.call(x, k));
  const aa = keys(actual), bb = keys(expected);
  const child = k => at + (Array.isArray(actual) && /^\d+$/.test(String(k)) ? '[' + String(k) + ']' : '.' + String(k));
  for (const k of aa) if (!Object.prototype.propertyIsEnumerable.call(expected, k)) return {path: child(k), actual: brief(actual[k]), expected: '<missing>'};
  for (const k of bb) if (!Object.prototype.propertyIsEnumerable.call(actual, k)) return {path: child(k), actual: '<missing>', expected: brief(expected[k])};
  for (const k of aa) if (!isDeepStrictEqual(actual[k], expected[k])) return firstMismatch(actual[k], expected[k], child(k), seen);
  return mismatch(); // Opaque native types still fail the exact root comparison.
}
function compactDeepEqual(actual, expected, message = 'Exact deep equality') {
  if (isDeepStrictEqual(actual, expected)) return;
  const difference = firstMismatch(actual, expected);
  nativeAssert.fail(String(message) + '; first mismatch at ' + difference.path + ': actual ' + difference.actual + ', expected ' + difference.expected);
}
const assert = Object.assign((...args) => nativeAssert(...args), nativeAssert, {deepEqual: compactDeepEqual, deepStrictEqual: compactDeepEqual});


const require = createRequire(import.meta.url), copy = x => structuredClone(x);
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const same = (a, b) => a?.index === b?.index && a?.generation === b?.generation;
const key = h => h.index + ':' + h.generation;
const SCHEMA = 'original-controller-live-registered-continuous-reference-v1';
let ROOT, EVIDENCE;
const PINNED = Object.freeze({
  placed: {capture: '4aee6c0395cbdf35f876a125c141bbbf02e0319928762ee82b193e43cdf74403', reference: '2f81d4855d850bba3d807f79df246ffbc43a84dfa8fd3ebd1333bd14a3ab5a50'},
  settled: {capture: '11f41cd9c11ff47911f14afc084b27f32a15fc69db1f26d7970eb864f35f2262', reference: 'cb4eb621a96cc6d06f355a647ddd63eda2c3997d7d527e40a219d58c6187a05a'},
  awake: {capture: '789955f1ecdd79cb4b39af2c8ab5ba578d6b7e3b49d9882845cb9a57ea57d0d6', reference: '699ede31cb19809b0487f3f85d3665e465f3721cc7cf12c316cbb2d48d7fd53c'},
});
const TOLERANCES = Object.freeze({ballPose: 1e-6, ballVelocityAndInertia: 3e-6, cueMotion: 3e-6, cueInertiaNormalized: 3e-6, eventPosition: 1e-6, cacheAndProxy: 2e-6});
let D, Importer, decoder, Native, Graph, CueCloth, provenance;
const loadedSources = new Map();
const freezeSource = file => { const source = fs.readFileSync(file, 'utf8'); loadedSources.set(file, hash(source)); return source; };
const noNative = () => {
  assert.equal(typeof globalThis.RAPIER, 'undefined', 'Native runtime is never initialized');
  assert.equal(typeof globalThis.PhysicsLab, 'undefined', 'Original engine controller is not a candidate runtime');
  assert.equal(Object.keys(require.cache).some(p => /[/\\](?:vendor[/\\]rapier\.(?:cjs|js)|@dimforge[/\\]rapier)/.test(p)), false, 'No native Rapier module loaded');
};

// Reuse unchanged assertion helpers without importing their native fixture
// dependencies. No initializer/exporter is called: only graphView/compare/cache.
// An accidental attempt to access the native fixture fails immediately.
function assertionModule(relative, replacements = {}) {
  const file = path.resolve(ROOT, relative), m = new Module(file);
  m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  m.require = id => {
    if (Object.hasOwn(replacements, id)) return replacements[id];
    assert.equal(id, 'node:assert/strict', 'Assertion helper may not load a runtime/fixture: ' + id);
    return assert;
  };
  m._compile(freezeSource(file), file); return m.exports;
}
function nativeValue(n) {
  switch (n.kind) {
    case 'float': return D.floatValue(n);
    case 'integer': { const x = Number(n.value); return Number.isSafeInteger(x) ? x : BigInt(n.value); }
    case 'bool': return n.value;
    case 'none': case 'unit': case 'unit_struct': return null;
    case 'some': case 'newtype_struct': return nativeValue(n.value);
    case 'newtype_variant': return {variant: n.variant, value: nativeValue(n.value)};
    case 'unit_variant': return n.variant;
    default:
      if (n.fields) return Object.fromEntries(n.fields.map(([k, v]) => [k, nativeValue(v)]));
      if (n.items) return n.items.map(nativeValue);
      if (n.entries) return n.entries.map(([k, v]) => [nativeValue(k), nativeValue(v)]);
      if ('value' in n) return n.value;
      throw Error('Unrecognized read-only decoder node: ' + n.kind);
  }
}
const arena = a => a.items.flatMap((slot, index) => slot && typeof slot === 'object' && Object.hasOwn(slot, 'generation') ? [{handle: {index, generation: slot.generation}, ...slot.value}] : []);

function pendingOuterIncrement(point) {
  const postHCallbacks = new Map([
    ['expected-only-source-firstH.postApplication', 'first-h'],
    ['expected-only-source-cueWithdrawal.firstSubsequentH', 'first-h-after-withdrawal'],
  ]);
  const reason = postHCallbacks.get(point.row.boundary);
  if (!reason) return 0;
  assert.deepEqual(point.reasons, [reason], 'Exact original post-angularPatch callback boundary');
  assert.ok(point.hCount > 0);
  return point.outerSubstep === 0 ? 1 : 0;
}
function loadEvidence(name) {
  const rawBytes = fs.readFileSync(path.join(EVIDENCE, 'capture.' + name + '.v8'));
  const referenceBytes = fs.readFileSync(path.join(EVIDENCE, 'reference.' + name + '.v8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'reference.' + name + '.v8.json'), 'utf8'));
  assert.equal(hash(rawBytes), PINNED[name].capture, 'Pinned original raw source: ' + name);
  assert.equal(hash(referenceBytes), PINNED[name].reference, 'Pinned continuous native reference: ' + name);
  assert.equal(manifest.sha256, PINNED[name].reference); assert.equal(manifest.bytes, referenceBytes.length);
  const raw = v8.deserialize(rawBytes), record = v8.deserialize(referenceBytes);
  assert.deepEqual(Object.keys(raw).sort(), ['capture', 'preStrikeSnapshot', 'snapshot']);
  for (const artifact of [manifest, record]) {
    assert.equal(artifact.schema, SCHEMA); assert.equal(artifact.origin, name);
    assert.equal(artifact.candidateStateUsed, false); assert.equal(artifact.nativeRestoreUsed, false);
    assert.equal(artifact.originalSourceContinuous, true); assert.equal(artifact.status, 'native-rest-complete');
    assert.equal(artifact.initialRawCaptureSha256, PINNED[name].capture);
    assert.equal(artifact.initialSnapshotSha256, hash(raw.snapshot));
  }
  assert.equal(record.forkEquivalenceChecked, true);
  assert.equal(raw.capture.nativeRestoreUsed, true, 'Initial input truthfully records a native fork; continuous oracle does not restore');
  assert.equal(raw.capture.boundary, 'liveRegisteredStrikeCreated');
  assert.equal(record.frames.length, record.hCount); assert.equal(manifest.hCount, record.hCount);
  assert.equal(manifest.outerSteps, record.outerSteps); assert.equal(manifest.checkpoints, record.checkpoints.length);
  assert.equal(record.firstRestOuter, record.outerSteps); assert.equal(record.comparison.fullRest, true);
  assert.deepEqual(manifest.score, record.score); assert.deepEqual(record.comparison.game, record.finalGame);
  assert.equal(record.score.nextCue, record.finalGame.activeCue); assert.equal(record.comparison.nextCue, record.score.nextCue);
  assert.notEqual(record.frames.at(-1).game.pending, null, 'Last original post-h sample is before controller finish');
  assert.equal(record.finalGame.pending, null);
  for (const [file, digest] of Object.entries(manifest.sources)) assert.equal(hash(fs.readFileSync(path.join(ROOT, file))), digest, 'Exact independent native producer source: ' + file);
  const initial = record.checkpoints.filter(p => p.reasons.includes('strike-created'));
  assert.equal(initial.length, 1); assert.equal(initial[0].hCount, 0);
  assert.deepEqual(initial[0].row.snapshot, raw.snapshot, 'Continuous original and source fork created bytes agree');
  assert.deepEqual(initial[0].row.application, raw.capture.application, 'Exact created application identity');
  let time = raw.capture.application.time;
  for (let i = 0; i < record.frames.length; i++) {
    const frame = record.frames[i]; assert.equal(frame.hCount, i + 1); time += frame.h; assert.equal(frame.time, time, 'Exact original per-h clock');
    assert.deepEqual(frame.balls.map(b => b.id), raw.capture.application.registry.objects.map(b => b.id));
  }
  for (const point of record.checkpoints) {
    assert.equal(point.row.candidateInput, false); assert.ok(point.row.snapshot instanceof Uint8Array);
    assert.equal(point.row.application.steps, raw.capture.application.steps + point.outerStep - pendingOuterIncrement(point), 'Exact raw application counter at its original callback/outer-return phase');
    assert.equal(point.row.application.time, point.hCount ? record.frames[point.hCount - 1].time : raw.capture.application.time);
  }
  return {name, raw, record, manifest};
}

function close(actual, expected, tolerance, label, stats) {
  if (Array.isArray(expected)) { assert.equal(actual?.length, expected.length, label); expected.forEach((v, i) => close(actual[i], v, tolerance, label + '[' + i + ']', stats)); return; }
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), label + ' finite');
  const delta = Math.abs(actual - expected); stats.maxAbsolute = Math.max(stats.maxAbsolute, delta);
  assert.ok(delta <= tolerance, label + ': ' + actual + ' != ' + expected + ' (' + delta + ' > ' + tolerance + ')');
}
const inertia9 = a => { assert.equal(a.length, 6, 'Owned cue symmetric inertia representation'); return [a[0], a[1], a[2], a[1], a[3], a[4], a[2], a[4], a[5]]; };
function compareFrame(out, expected, seed, record, stats) {
  const label = 'h' + expected.hCount;
  assert.equal(out.frame, expected.hCount); assert.equal(out.time, expected.time); assert.equal(out.lastStep.h, expected.h);
  assert.equal(out.outerStep, expected.outerStep); assert.equal(out.outerSubstep, expected.outerSubstep);
  assert.equal(out.sourceApplicationSteps, seed.sourceApplicationSteps + expected.outerStep);
  assert.deepEqual(out.origin.sourceOrigin, seed.sourceOrigin, 'Source time/step/shot/revision/native-frame provenance remains exact');
  assert.equal(out.cue.present, expected.cuePresent); assert.equal(out.contactGraph.liveColliders.length, out.cue.present ? 27 : 24);
  for (let i = 0; i < 4; i++) {
    assert.equal(out.balls[i].id, expected.balls[i].id);
    for (const field of ['translation', 'rotation', 'linear', 'angular', 'invInertia']) close(out.balls[i].state[field], expected.balls[i][field], ['translation', 'rotation'].includes(field) ? TOLERANCES.ballPose : TOLERANCES.ballVelocityAndInertia, label + '.ball' + i + '.' + field, stats);
    assert.equal(out.balls[i].state.sleeping, expected.balls[i].sleeping, label + ' exact ball sleep');
  }
  if (expected.cue) for (const role of ['shaft', 'head']) {
    const actual = out.cue.cue[role], source = expected.cue[role];
    for (const field of ['translation', 'rotation', 'linear', 'angular']) close(actual[field], source[field], TOLERANCES.cueMotion, label + '.' + role + '.' + field, stats);
    const expanded = inertia9(actual.invInertia), scale = Math.max(1, ...source.invInertia.map(Math.abs));
    expanded.forEach((value, i) => { const delta = Math.abs(value - source.invInertia[i]); stats.maxCueInertiaAbsolute = Math.max(stats.maxCueInertiaAbsolute, delta); stats.maxCueInertiaNormalized = Math.max(stats.maxCueInertiaNormalized, delta / scale); });
    close(expanded, source.invInertia, TOLERANCES.cueInertiaNormalized * scale, label + '.' + role + '.invInertia', stats);
    const body = out.scene.bodies.find(b => same(b.handle, seed.cueInitial.sourceCreation.roles[role]));
    assert.ok(body); assert.equal(body.activation.sleeping, source.sleeping, label + ' exact cue sleep');
  }
  const contacts = expected.events.filter(e => e.kind === 'contact' || e.kind === 'cue-obstruction');
  assert.equal(out.contactEvents.length, contacts.length, label + ' every application contact event');
  for (let i = 0; i < contacts.length; i++) {
    const {position: a, ...identity} = out.contactEvents[i], {position: b, ...source} = contacts[i];
    assert.deepEqual(identity, source, label + '.event' + i + ' complete non-position data');
    if (b) { assert.ok(a); close([a.x, a.y, a.z], [b.x, b.y, b.z], TOLERANCES.eventPosition, label + '.event' + i + '.position', stats); } else assert.equal(a, undefined);
  }
  const final = out.frame === record.frames.length;
  assert.deepEqual(out.game, final ? record.finalGame : expected.game, label + ' exact pending/final game');
  assert.equal(out.shotComplete, final, 'No premature/late controller completion');
  if (final) { assert.deepEqual(out.scoreResult, record.score); assert.equal(out.game.activeCue, record.score.nextCue); }
  else assert.equal(out.scoreResult, undefined, 'No premature score or next-cue decision');
}

async function decodeExpected(point) {
  assert.equal(point.row.candidateInput, false);
  const decoded = await decoder.decodeSnapshot(point.row.snapshot);
  assert.equal(decoded.inputSha256, hash(point.row.snapshot));
  const state = nativeValue(decoded.state), bodies = arena(state.bodies.bodies), colliders = arena(state.colliders.colliders), proxies = [];
  for (const node of state.broad_phase.tree.nodes) for (const child of [node.left, node.right]) if ((child.data & 0x3fffffff) === 1) proxies.push({index: child.children, min: copy(child.mins), max: copy(child.maxs)});
  // Normalized assertion label, never a runtime-created boundary or seed.
  return {...point.row, originalBoundary: point.row.boundary, boundary: 'expected-only-h' + point.hCount + '-postApplication', hCount: point.hCount, sourceRevision: decoded.sourceRevision, snapshotSha256: decoded.inputSha256, state, bodies, colliders, proxies, contactPairs: state.narrow_phase.contact_graph.graph.edges.map(e => e.weight), queues: {modifiedBodies: state.bodies.modified_bodies[0]}};
}
function sourceSolverRoster(row) {
  const s = row.state, np = s.narrow_phase;
  const awake = s.islands.awake_island === null ? [] : s.islands.islands.v[s.islands.awake_island].bodies;
  return {
    edges: Graph.graphView(row).edges,
    pairs: np.contact_graph.graph.edges.map(({weight: p}, i) => {
      assert.equal(p.contacts.variant, 'Rigid'); const c = p.contacts.value;
      return {hint: np.pair_solver_hints[i], solverColor: c.solver_color, solverColorBodies: copy(c.solver_color_bodies), manifolds: c.manifolds.map(m => ({activeContactCount: m.data.solver_contacts.length, solverFlags: m.data.solver_flags, solverColor: m.data.solver_color, solverBodyIds: copy(m.data.solver_body_ids), graphPos: m.data.graph_pos}))};
    }),
    bodySolverColorMasks: np.body_solver_color_masks.map(x => { if (typeof x === 'number') assert.ok(Number.isSafeInteger(x)); return BigInt(x).toString(); }),
    buckets: copy(np.solver_contact_graph.buckets), solverGraphValid: np.solver_graph_valid, solverGraphEpoch: np.solver_graph_epoch, solverGraphMultibodyEpoch: np.solver_graph_mb_epoch,
    activeSetEpoch: s.islands.active_set_epoch, multibodyTopologyEpoch: s.multibody_joints.topology_epoch,
    awakeBodies: awake.map(body => ({body: copy(body), activeSetId: row.bodies.find(b => same(b.handle, body)).ids.active_set_id})),
  };
}
// Complete separated sphere/cylinder and convex/cylinder caches, resolved by
// actual source generations rather than the legacy helpers' fixed ball16/neck24.
function compareEmptyCueCaches(out, row, stats) {
  const colliders = new Map(row.colliders.map(c => [key(c.handle), c]));
  for (const [shape, field] of [['Ball', 'emptyCuePairs'], ['ConvexPolyhedron', 'emptyCueConvexPairs']]) {
    const expected = row.contactPairs.filter(p => colliders.get(key(p.collider1)).shape.variant === shape && colliders.get(key(p.collider2)).shape.variant === 'Cylinder');
    const actual = out[field] ?? [];
    assert.equal(actual.length, expected.length, 'All native ' + field + ' births/removals');
    assert.equal(new Set(actual.map(p => key(p.collider1) + '/' + key(p.collider2))).size, actual.length);
    for (const pair of expected) {
      assert.equal(pair.contacts.variant, 'Rigid');
      const rigid = pair.contacts.value, got = actual.find(p => same(p.collider1, pair.collider1) && same(p.collider2, pair.collider2));
      assert.ok(got, 'Exact generation-bearing empty cue cache');
      assert.deepEqual(got.body1, colliders.get(key(pair.collider1)).parent.handle); assert.deepEqual(got.body2, colliders.get(key(pair.collider2)).parent.handle);
      assert.deepEqual(Object.keys(got).filter(k => !['collider1', 'collider2', 'body1', 'body2', 'cache'].includes(k)).sort(), Object.keys(rigid).sort(), 'Complete native rigid cache layout');
      for (const name of ['solver_clusters', 'solver_color', 'solver_color_bodies', 'workspace']) assert.deepEqual(got[name], rigid[name]);
      assert.equal(rigid.manifolds.length, 1); assert.equal(got.manifolds.length, 1);
      const a = got.manifolds[0], b = rigid.manifolds[0]; assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
      assert.deepEqual(b.points, []); assert.deepEqual(b.data.solver_contacts, []);
      for (const name of ['points', 'subshape1', 'subshape2', 'subshape_poses']) assert.deepEqual(a[name], b[name]);
      for (const name of ['local_n1', 'local_n2']) close(a[name], b[name], TOLERANCES.cacheAndProxy, field + '.' + name, stats);
      assert.deepEqual(Object.keys(a.data).sort(), Object.keys(b.data).sort());
      for (const name of Object.keys(b.data)) {
        if (['normal', 'friction', 'restitution'].includes(name)) close(a.data[name], b.data[name], TOLERANCES.cacheAndProxy, field + '.data.' + name, stats);
        else assert.deepEqual(a.data[name], b.data[name], field + '.data.' + name);
      }
      const ar = got.recycle_state, br = rigid.recycle_state; assert.ok(ar && br);
      assert.deepEqual(Object.keys(ar).sort(), Object.keys(br).sort()); assert.deepEqual(Object.keys(ar.pos12).sort(), Object.keys(br.pos12).sort());
      assert.equal(ar.pos12.padding, br.pos12.padding);
      for (const name of ['translation', 'rotation']) close(ar.pos12[name], br.pos12[name], TOLERANCES.cacheAndProxy, field + '.pos12.' + name, stats);
      for (const name of ['rot1', 'rot2', 'max_extent', 'max_drift']) close(ar[name], br[name], TOLERANCES.cacheAndProxy, field + '.' + name, stats);
      const cache = {recycleTranslation: br.pos12.translation, recycleRelativeRotation: br.pos12.rotation, recycleRotation1: br.rot1, recycleRotation2: br.rot2, maxExtent: br.max_extent, maxDrift: br.max_drift};
      if (shape === 'ConvexPolyhedron') Object.assign(cache, {localNormal1: b.local_n1, localNormal2: b.local_n2, worldNormal: b.data.normal});
      for (const [name, value] of Object.entries(cache)) close(got.cache[name], value, TOLERANCES.cacheAndProxy, field + '.numericCache.' + name, stats);
      if (shape === 'Ball') { const ball = colliders.get(key(pair.collider1)), cylinder = colliders.get(key(pair.collider2)); assert.deepEqual(got.cache.shapeDimensions, [ball.shape.value.radius, cylinder.shape.value.radius, cylinder.shape.value.half_height]); }
    }
  }
}
function compareOwnedBvh(out, row, stats) {
  const actual = out.ownedBvh, expected = row.state.broad_phase;
  assert.equal(actual.deferred_optimize_pending, false, 'Native completed post-h BVH has joined deferred optimization');
  for (const name of Object.keys(actual).filter(k => !['tree', 'deferred_optimize_pending'].includes(k))) assert.deepEqual(actual[name], expected[name], 'Complete owned BVH metadata ' + name);
  const a = actual.tree, b = expected.tree;
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), 'Complete owned native BVH tree layout');
  for (const name of Object.keys(a).filter(k => k !== 'nodes')) assert.deepEqual(a[name], b[name], 'Exact BVH topology ' + name);
  assert.equal(a.nodes.length, b.nodes.length);
  for (let i = 0; i < b.nodes.length; i++) for (const side of ['left', 'right']) {
    const node = a.nodes[i][side], source = b.nodes[i][side]; assert.deepEqual(Object.keys(node).sort(), Object.keys(source).sort());
    for (const name of Object.keys(source)) {
      if (['mins', 'maxs'].includes(name)) close(node[name], source[name], TOLERANCES.cacheAndProxy, 'BVH' + i + '.' + side + '.' + name, stats);
      else assert.deepEqual(node[name], source[name], 'Exact BVH packed node ' + i + '.' + side + '.' + name);
    }
  }
}
async function compareCheckpoint(out, point, frame, seed, record, stats) {
  assert.equal(out.frame, point.hCount); assert.equal(out.outerStep, point.outerStep); assert.equal(out.outerSubstep, point.outerSubstep);
  const row = await decodeExpected(point), final = out.frame === record.frames.length;
  // Native full-rest checkpoint is before finish; physics/manager bytes are the
  // same. Only the application game comparison uses the final controller game.
  const application = {...frame, game: final ? record.finalGame : frame.game};
  const result = Native.compare(out, seed, {h: out.frame, initialSnapshotSha256: seed.initialSnapshotSha256, row, application, balls: frame.balls}, stats.internalPasses);
  for (let i = 0; i < 4; i++) {
    const ball = seed.balls[i], pair = row.contactPairs.find(p => same(p.collider1, seed.pairSeed.floorCollider) && same(p.collider2, ball.collider));
    assert.ok(pair); const wanted = Native.cache(pair), actual = out.balls[i].state;
    for (const field of ['solverColor', 'feature1', 'feature2']) if (field in wanted) assert.equal(actual[field], wanted[field], 'Complete cloth ' + i + '.' + field);
    if ('localN1' in wanted) close(actual.localN1, wanted.localN1, TOLERANCES.cacheAndProxy, 'Cloth ' + i + '.localN1', stats);
  }
  const roster = sourceSolverRoster(row);
  assert.equal(out.solverContactRoster.initialSnapshotSha256, seed.initialSnapshotSha256);
  assert.equal(out.solverContactRoster.sequence, out.contactGraph.sequence); assert.equal(out.solverContactRoster.revision, out.contactGraph.revision);
  for (const [field, value] of Object.entries(roster)) assert.deepEqual(out.solverContactRoster[field], value, 'Complete native solver roster ' + field);
  compareEmptyCueCaches(out, row, stats);
  compareOwnedBvh(out, row, stats);
  const cloth = CueCloth.project(row, seed);
  const clothResult = CueCloth.compare(out.cueCloth, cloth, {tolerance: TOLERANCES.cacheAndProxy, label: 'h' + out.frame + '.cueCloth', stats});
  if (out.frame === 1) {
    for (const field of ['parents', 'leaf_node_indices', 'free_wide_nodes', 'optimization']) assert.deepEqual(out.cueBroad.initialTree[field], row.state.broad_phase.tree[field], 'Actual first-h registered24+cue3 topology ' + field);
    assert.deepEqual(out.cueBroad.pendingUpdated, row.state.broad_phase.pending_set_aabb, 'Exact first-h modified-leaf order');
  }
  assert.equal(row.state.broad_phase.frame_index, seed.sourceOrigin.createdClock.nativeFrameIndex + stats.internalPasses, 'Exact native broad-phase source clock');
  assert.equal(row.application.steps + pendingOuterIncrement(point), out.sourceApplicationSteps, 'Exact original callback counter plus only the proven pending outer increment');
  stats.maxAbsolute = Math.max(stats.maxAbsolute, result.maxAbsoluteError, clothResult.maxAbsoluteError);
  stats.checkpoints.push({h: out.frame, boundary: point.row.boundary, snapshotSha256: row.snapshotSha256, nativeApplicationSteps: row.application.steps, ownerApplicationSteps: out.sourceApplicationSteps, pendingOriginalOuterIncrement: pendingOuterIncrement(point), fullManager: true, completeDenseGraph: true, fullSolverRoster: true, clothBallPairCushionCaches: true, cueClothCache: true, emptyCueCaches: true, completeOwnedBvh: true, allFatProxies: true, omittedUnrepresentedFields: []});
}


export async function prepareValidation(root, evidence) {
  ROOT = root; EVIDENCE = evidence; noNative();
  D = await import(pathToFileURL(path.join(ROOT, 'tools/rapier-snapshot-decoder/browser.mjs')).href);
  Importer = await import(pathToFileURL(path.join(ROOT, 'src/browser-initial-import/live-registered-four-ball.mjs')).href);
  const provenanceFile = process.env.RAPIER_WASM_PROVENANCE ?? path.join(ROOT, '../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json');
  provenance = JSON.parse(fs.readFileSync(provenanceFile, 'utf8'));
  const engineBytes = new Uint8Array(fs.readFileSync(path.join(ROOT, 'vendor/rapier.cjs')));
  const wasmBytes = new Uint8Array(fs.readFileSync(provenance.wasmPath));
  assert.equal(hash(engineBytes), provenance.engineSha256); assert.equal(hash(wasmBytes), provenance.wasmSha256);
  decoder = await D.createSnapshotDecoder({engineVersion: '0.21.0', engineBytes, wasmBytes, provenance, expectedWasmSha256: provenance.wasmSha256});
  const forbiddenFixture = new Proxy(Object.freeze({}), {get() { throw Error('Assertion-only graph may not access native fixture'); }});
  Graph = assertionModule('tests/four-ball-broad-graph-seed.cjs', {'./four-ball-created-fixture.cjs': forbiddenFixture});
  Native = assertionModule('tests/four-ball-active-ccd-native-compare.cjs', {'./four-ball-broad-graph-seed.cjs': Object.freeze({graphView: Graph.graphView})});
  CueCloth = assertionModule('tests/cue-cloth-cache-native-compare.cjs');
  return {wasmSha256: provenance.wasmSha256, engineSha256: provenance.engineSha256};
}
export async function importInitial(name) {
  const rawBytes = fs.readFileSync(path.join(EVIDENCE, 'capture.' + name + '.v8'));
  assert.equal(hash(rawBytes), PINNED[name].capture, 'Pinned original capture');
  const raw = v8.deserialize(rawBytes), before = copy(raw);
  assert.deepEqual(Object.keys(raw).sort(), ['capture', 'preStrikeSnapshot', 'snapshot']);
  const seed = await Importer.importLiveRegisteredFourBall(decoder, raw);
  assert.deepEqual(raw, before, 'Importer cannot change original source');
  assert.equal(seed.initialSnapshotSha256, hash(raw.snapshot));
  noNative(); return seed;
}
export async function validateOutput(name, seed, out, internalPasses, scope) {
  const fixture = loadEvidence(name), {record} = fixture;
  assert.ok(out.frame > 0 && out.frame <= record.frames.length);
  const frame = record.frames[out.frame - 1];
  const stats = {internalPasses, maxAbsolute: 0, maxCueInertiaAbsolute: 0, maxCueInertiaNormalized: 0, checkpoints: []};
  compareFrame(out, frame, seed, record, stats);
  const points = record.checkpoints.filter(p => p.hCount === out.frame && !p.reasons.includes('cue-withdrawal'));
  for (const point of points) await compareCheckpoint(out, point, frame, seed, record, stats);
  const fullShot = out.frame === record.frames.length;
  if (scope === 'full') {
    assert.equal(fullShot, true, 'Full measured replay reaches independent original rest, never an early finish');
    assert.ok(points.some(p => p.reasons.includes('controller-finished')), 'Final original complete raw-state checkpoint');
    assert.equal(out.scene.manager.awake_island, null); assert.ok(out.balls.every(b => b.state.sleeping));
    assert.deepEqual(out.game, record.finalGame); assert.deepEqual(out.scoreResult, record.score);
  }
  noNative();
  return {status: fullShot ? 'native-full-rest-matched' : 'verified-final-prefix-frame', fullShot, h: out.frame, expectedFullH: record.frames.length, finalRawCheckpointCount: points.length, referenceSha256: PINNED[name].reference, captureSha256: PINNED[name].capture, tolerances: TOLERANCES, ...stats};
}
// Additive assertion-only exports for the multi-world replay harness. The
// original comparator bodies, phase handling, and tolerances stay unchanged.
export {noNative, PINNED, loadEvidence, compareFrame, compareCheckpoint, compactDeepEqual};
