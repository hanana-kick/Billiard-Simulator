'use strict';
// Expected-only storage adapter. Original captures and their provenance remain
// untouched. Preparation uses the original loaders and runs assertion-equivalence
// checks in a separate process; replay never deserializes a complete native tree.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const v8 = require('node:v8');
const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'assertion-equivalent-full-shot-reference-v1';
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const own = (value, keys) => Object.fromEntries(keys.filter(k => Object.hasOwn(value, k)).map(k => [k, value[k]]));
const BODY_ACTIVATION = ['normalized_linear_threshold', 'angular_threshold', 'time_until_sleep', 'time_since_can_sleep', 'sleeping', 'sleep_prev_pose'];
function body(b, withHandle) {
  const result = own(b, withHandle ? ['handle', 'ids', 'changes', 'body_type'] : ['ids', 'changes']);
  if (!withHandle || b.body_type === 'Dynamic') {
    result.activation = own(b.activation, BODY_ACTIVATION);
    result.activation.sleep_prev_pose = own(b.activation.sleep_prev_pose, ['translation', 'rotation']);
  }
  return result;
}
function contact(pair) {
  const result = own(pair, ['collider1', 'collider2']);
  if (pair.contacts.variant !== 'Rigid') {
    result.contacts = {variant: pair.contacts.variant};
    return result;
  }
  const r = pair.contacts.value;
  result.contacts = {variant: pair.contacts.variant, value: {
    solver_color: r.solver_color,
    recycle_state: r.recycle_state && {pos12: own(r.recycle_state.pos12, ['translation', 'rotation']),
      max_extent: r.recycle_state.max_extent, max_drift: r.recycle_state.max_drift},
    manifolds: r.manifolds.map(m => ({local_n2: m.local_n2,
      points: m.points.map(p => ({local_p1: p.local_p1, local_p2: p.local_p2, dist: p.dist,
        data: own(p.data, ['solver_dp1', 'solver_dp2', 'impulse', 'warmstart_impulse', 'tangent_impulse', 'warmstart_tangent_impulse', 'warmstart_tangent_world'])})),
      data: {normal: m.data.normal, solver_contacts: m.data.solver_contacts.map(s => own(s, ['anchor1', 'anchor2', 'contact_id']))}}))
  }};
  return result;
}
function fourBallRow(row) {
  const graph = row.state.narrow_phase.contact_graph.graph;
  return {
    state: {islands: row.state.islands, narrow_phase: {contact_graph: {graph: {
      nodes: graph.nodes.map(n => own(n, ['weight', 'next'])),
      edges: graph.edges.map(e => ({next: e.next, weight: contact(e.weight)}))
    }}}},
    queues: {modifiedBodies: row.queues.modifiedBodies},
    bodies: row.bodies.map(b => body(b, true)),
    colliders: row.colliders.map(c => ({handle: c.handle, parent: {handle: c.parent.handle}})),
    proxies: row.proxies.map(p => own(p, ['index', 'min', 'max'])),
    contactPairs: row.contactPairs.map(contact)
  };
}
function projectFourBall(original) {
  return {...own(original, ['initialSnapshotSha256', 'frames', 'events', 'status', 'score', 'firstRestOuter']),
    checkpoints: original.checkpoints.map(c => ({step: c.step, reasons: c.reasons, row: fourBallRow(c.row)}))};
}
function inspectYawCheckpoint(row, record) {
  const F = require('./three-ball-yaw-fixture.cjs').F;
  const d = F.decode({post: row.raw}, 'post');
  // These are the exact original before-hook helpers, not new contact math.
  return {...row, balls: F.flatBalls({...record, post: row.raw}, 'post', d, 1 / 960),
    pair: require('./three-ball-pair-oracle.cjs').pairCache(d, record.objects),
    expectedGraph: require('./three-ball-contact-assertions.cjs').inspect(row.raw, d),
    cushions: require('./three-ball-cushion-assertions.cjs').inspect(record, d)};
}
function yawCheckpoint(row, record) {
  const inspected = inspectYawCheckpoint(row, record), raw = row.raw;
  return {...inspected, raw: {islands: raw.islands, modifiedBodies: raw.modifiedBodies,
    bodies: Object.fromEntries(Object.entries(raw.bodies).map(([role, b]) => [role, body(b, false)])),
    jointState: {joint_graph: {graph: {edges: raw.jointState.joint_graph.graph.edges.map(e => ({weight: {
      impulses: e.weight.impulses, data: {limits: e.weight.data.limits.map(l => ({impulse: l.impulse}))}
    }}))}}}}};
}
function projectYaw(original) {
  return {...own(original, ['record', 'frames', 'events', 'status', 'score', 'firstRestOuter']),
    checkpoints: original.checkpoints.map(row => yawCheckpoint(row, original.record))};
}
function sourceHashes(kind) {
  const common = ['tests/full-shot-reference-fixture.cjs', 'tests/full-shot-reference-equivalence.cjs',
    'tools/prepare-full-shot-reference.cjs', 'tools/measure-full-shot-reference.cjs',
    'tests/full-shot-reference-memory.cjs', 'tests/native-gpu-test-owner.cjs'];
  const extra = kind === 'four-ball' ? ['tests/experimental-four-ball-full-shot.cjs',
    'tests/four-ball-broad-graph-seed.cjs'] : ['tests/experimental-three-ball-yaw-full-shot.cjs',
    'tests/three-ball-contact-assertions.cjs', 'tests/three-ball-cushion-assertions.cjs',
    'tests/three-ball-pair-oracle.cjs', 'tests/three-ball-scene-fixture.cjs'];
  return Object.fromEntries([...common, ...extra].map(file => [file, hash(fs.readFileSync(path.join(ROOT, file)))]));
}
// Bounded-size reads prevent retaining the 138 MiB input Buffer in replay too.
function hashFile(file) {
  const digest = crypto.createHash('sha256'), fd = fs.openSync(file, 'r'), chunk = Buffer.allocUnsafe(1024 * 1024);
  let bytes = 0;
  try { for (;;) { const n = fs.readSync(fd, chunk, 0, chunk.length, null); if (!n) break; digest.update(chunk.subarray(0, n)); bytes += n; } }
  finally { fs.closeSync(fd); }
  return {sha256: digest.digest('hex'), bytes};
}
function originalIdentity(kind, initialPath) {
  return kind === 'four-ball' ? require('./four-ball-world-oracle.cjs').identity(initialPath)
    : require('./three-ball-yaw-full-shot-oracle.cjs').sourceIdentity(initialPath);
}
function validateOriginal(kind, file, initialPath) {
  for (const f of [file, initialPath]) assert.ok(f && path.isAbsolute(f), 'Explicit existing original and initial artifact paths required');
  const manifestBytes = fs.readFileSync(file + '.json'), original = JSON.parse(manifestBytes);
  assert.deepEqual(original.identity, originalIdentity(kind, initialPath), 'Unmodified original capture/source identity');
  const source = hashFile(file);
  assert.equal(source.sha256, original.sha256, 'Entire original artifact hash');
  assert.equal(source.bytes, original.bytes, 'Entire original artifact length');
  return {...source, manifestSha256: hash(manifestBytes), identity: original.identity};
}
function memory(label) {
  return {label, ...process.memoryUsage(), maxRssBytes: process.resourceUsage().maxRSS * 1024};
}
function loadPrepared(kind, file, originalPath, initialPath) {
  assert.ok(file && path.isAbsolute(file), 'Explicit prepared ' + kind + ' reference required; run tools/prepare-full-shot-reference.cjs first');
  const manifest = JSON.parse(fs.readFileSync(file + '.json', 'utf8'));
  assert.equal(manifest.schema, SCHEMA); assert.equal(manifest.kind, kind);
  assert.deepEqual(manifest.sourceHashes, sourceHashes(kind), 'Prepared-reference sources frozen');
  assert.deepEqual(manifest.original, validateOriginal(kind, originalPath, initialPath), 'Prepared reference belongs to this exact verified original');
  assert.equal(manifest.equivalence.originalAssertionSha256, manifest.equivalence.projectedAssertionSha256);
  assert.ok(manifest.equivalence.assertions > 0, 'Original/projected assertion transcript required');
  const bytes = fs.readFileSync(file);
  assert.equal(hash(bytes), manifest.sha256); assert.equal(bytes.length, manifest.bytes);
  const projected = v8.deserialize(bytes);
  assert.equal(projected.frames.length, manifest.frames); assert.equal(projected.checkpoints.length, manifest.checkpoints);
  assert.equal(projected.status, manifest.status); assert.equal(projected.firstRestOuter, manifest.firstRestOuter);
  assert.deepEqual(projected.score, manifest.score);
  console.error(JSON.stringify({referenceMemory: kind, preparedBytes: bytes.length, originalBytes: manifest.original.bytes,
    frames: projected.frames.length, checkpoints: projected.checkpoints.length, memory: memory('prepared-reference-loaded')}));
  return projected;
}
module.exports = {SCHEMA, hash, hashFile, memory, sourceHashes, validateOriginal, projectFourBall, projectYaw,
  inspectYawCheckpoint, fourBallRow, loadPrepared};
