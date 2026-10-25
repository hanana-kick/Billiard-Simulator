'use strict';
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const v8 = require('node:v8');
const crypto = require('node:crypto');
const Module = require('node:module');
const {pathToFileURL} = require('node:url');
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const loaded = new Map([[__filename,hash(fs.readFileSync(__filename))]]), compile = Module.prototype._compile;
const selectedBackend=process.env.CUE_INPUT_BACKEND??(process.env.CUE_INPUT_CPU_ONLY==='1'?'cpu':'both');
assert.ok(['cpu','gpu','both'].includes(selectedBackend),'Explicit cpu/gpu/both backend selection');
Module.prototype._compile = function (code, file) {
  if (/\/(src\/(experimental-|physics|math|game-rules)|tests\/.*(?:fixture|oracle|seeds?|assertions)\.cjs|vendor\/rapier\.cjs|tools\/rapier-snapshot-decoder)/.test(file)) loaded.set(file, hash(code));
  return compile.call(this, code, file);
};
require('../src/game-rules');
const Full = require('./cue-source-input-full-shot-oracle.cjs');
const Inputs = require('./cue-source-input-fixture.cjs');
const F = Inputs.F;
const HullSeed=require('./cue-source-input-hull-seed.cjs'),ConvexAssert=require('./cue-empty-convex-cache-assertions.cjs');
const EmptyAssert = require('./cue-empty-cache-assertions.cjs');
const GraphAssert = require('./three-ball-contact-assertions.cjs');
const CushionAssert = require('./three-ball-cushion-assertions.cjs');
const PairOracle = require('./three-ball-pair-oracle.cjs');
const World = require('../src/experimental-three-ball-world');
let replay, seed, checkpoints, cpuResult, gpuResult;
before(() => {
  replay = Full.loadArtifact(process.env.CUE_INPUT_FULL_REPLAY, process.env.CUE_INPUT_REPLAY);
  seed = HullSeed.exportSeed(replay.record,replay.spec);
  assert.ok(!('post' in seed) && !('expected' in seed));
  assert.ok(!('post' in seed.cueInitial.sourceCreation));
  checkpoints = new Map(replay.checkpoints.filter(row => row.step > 0).map(row => [row.step, row]));
});
loaded.set(require.resolve('./native-gpu-test-owner.cjs'), hash(fs.readFileSync(require.resolve('./native-gpu-test-owner.cjs'))));
after(() => {
  for (const [file, h] of loaded) assert.equal(hash(fs.readFileSync(file)), h, 'Loaded source unchanged: ' + file);
  console.log(JSON.stringify({sourceHashCheckCompleted:true,sourceHashes: Object.fromEntries([...loaded].map(([p, h]) => [p.split('/').slice(-2).join('/'), h]))}));
  Module.prototype._compile = compile;
});
function close(a, b, tol, label, stats) {
  if (Array.isArray(b)) {
    assert.ok(Array.isArray(a), label); assert.equal(a.length, b.length, label);
    b.forEach((x, i) => close(a[i], x, tol, label + '[' + i + ']', stats));
  } else {
    const error = Math.abs(a - b); stats.maxAbsolute = Math.max(stats.maxAbsolute, error);
    assert.ok(Number.isFinite(a) && error <= tol, label + ': ' + a + ' versus ' + b + ' (' + error + ')');
  }
}
function compareCheckpoint(out, want, stats) {
  // Project later source state only after the candidate reaches this assertion.
  // A source state outside the supported domain cannot hide the first rejection.
  if(!want.expectedGraph){const d=F.decode({post:want.raw},'post');want={...want,
    balls:F.flatBalls({...replay.record,post:want.raw},'post',d,1/960),
    pairs:[[0,1],[0,2],[1,2]].map(indices=>({key:indices.join(''),cache:PairOracle.pairCache(d,indices.map(i=>replay.record.objects[i]))})),
    expectedGraph:GraphAssert.inspect(want.raw,d),expectedEmpty:EmptyAssert.inspect(want.raw,d),expectedConvex:ConvexAssert.inspect(want.raw,d),
    cushions:CushionAssert.inspect(replay.record,d)};}
  stats.maxAbsolute=Math.max(stats.maxAbsolute,EmptyAssert.compare(out,want.expectedEmpty),ConvexAssert.compare(out,want.expectedConvex));
  GraphAssert.compare(out, want.expectedGraph, seed, close, stats);
  assert.deepEqual(out.scene.manager, want.raw.islands, 'Entire source manager at outer ' + want.step);
  assert.deepEqual(out.scene.modifiedBodies, want.raw.modifiedBodies, 'Source modified queue');
  for (const [role, body] of Object.entries(want.raw.bodies)) {
    const own = out.scene.bodies.find(x => F.same(x.handle, replay.record.roles[role]));
    assert.ok(own); assert.deepEqual(own.ids, body.ids, role + '.ids');
    assert.equal(own.changes, body.changes, role + '.changes');
    for (const k of ['normalized_linear_threshold', 'angular_threshold', 'time_until_sleep', 'time_since_can_sleep', 'sleeping'])
      assert.equal(own.activation[k], body.activation[k], role + '.' + k);
    for (const k of ['translation', 'rotation']) close(own.activation.sleep_prev_pose[k], body.activation.sleep_prev_pose[k], 2e-6, role + '.history', stats);
  }
  for (let i = 0; i < 3; i++) {
    const a = out.balls[i].state, b = want.balls[i].state;
    for (const k of ['invInertia', 'force']) close(a[k], b[k], 3e-6, 'ball' + i + '.' + k, stats);
    for (const k of ['anchor1', 'anchor2', 'dp1', 'dp2', 'warmWorld', 'warmTangent', 'tangentImpulse', 'localP1', 'localP2', 'localN2', 'recycleTranslation', 'recycleRotation', 'impulse', 'warmImpulse', 'contactDistance'])
      if (k in b) close(a[k], b[k], 2e-6, 'cache' + i + '.' + k, stats);
    assert.deepEqual(a.topology, b.topology);
    for (let j = 0; j < 4; j++) for (const [k, value] of Object.entries(want.cushions[i][j])) {
      if (['solverBodyIds', 'graphPos', 'tangentVelocity', 'recycleRelativeRotation', 'recycleRotation1', 'recycleRotation2'].includes(k)) continue;
      const actual = out.cushions[i][j][k];
      if (['pairPresent', 'pointPresent', 'active', 'recycleValid', 'solverColor', 'feature1', 'feature2', 'contactId'].includes(k))
        assert.equal(actual, value, 'cushion' + i + ':' + j + '.' + k);
      else close(actual, value, 2e-6, 'cushion' + i + ':' + j + '.' + k, stats);
    }
  }
  for (const binding of want.pairs) {
    const actual=out.pairs.find(x=>x.key===binding.key);assert.ok(actual,'Every original dynamic pair binding');
    for(const[k,value]of Object.entries(binding.cache)){
      if(['pairPresent','pointPresent','active','recycleValid','contactId'].includes(k))assert.equal(actual.pair[k],value,'pair'+binding.key+'.'+k);
      else close(actual.pair[k],value,2e-6,'pair'+binding.key+'.'+k,stats);
    }
  }

  if (out.cue.present) {
    const joints = want.raw.jointState.joint_graph.graph.edges.map(e => e.weight);
    assert.equal(joints.length, 2);
    for (let i = 0; i < 2; i++) {
      close(out.cue.cue.joints[i].impulses, joints[i].impulses, 2e-6, 'cue.joint' + i + '.impulses', stats);
      close(out.cue.cue.joints[i].limitImpulses, joints[i].data.limits.map(x => x.impulse), 2e-6, 'cue.joint' + i + '.limits', stats);
    }
  }
  stats.checkpoints++;
}
function compareContact(a, b, label, stats) {
  for (const k of ['kind', 'key', 'label', 'time']) assert.equal(a[k] ?? null, b[k] ?? null, label + '.' + k);
  for (const side of ['a', 'b']) assert.deepEqual(a[side] ?? null, b[side] ?? null, label + '.' + side);
  close([a.position.x, a.position.y, a.position.z], [b.position.x, b.position.y, b.position.z], 1e-6, label + '.position', stats);
}
const unsupported = /unsupported|requires a larger coupled|dynamic pair handoff required|CCD|Owned cloth bucket order changed|needs source awake continuous cloth|requires retained floor pairs|Selected pair needs active awake cloth/i;
async function run(device) {
  const backend = device ? 'actual-webgpu' : 'cpu-reference';
  // The sole construction input is exported from record.created. The reference
  // frames/checkpoints below are used only after own.step() for assertions.
  console.log(JSON.stringify({runStart:true,backend,pid:process.pid,memory:process.memoryUsage(),sourceHashesStart:Object.fromEntries([...loaded].map(([p,h])=>[p.split('/').slice(-2).join('/'),h]))}));
  const own = device ? await World.createGpuStepper(device, seed) : await World.createReferenceStepper(seed);
  const game = new ThreeBallGame(); assert.equal(game.begin(seed.balls[0].id), true);
  const contacts = replay.events.filter(e => e.kind === 'contact');
  const stats = {maxAbsolute: 0, outerCompared: 0, checkpoints: 0, eventsCompared: 0};
  let scoreCursor = 0, score = null, firstRestOuter = null, beforeStep = own.snapshot(), lastGood = {h: 0, outer: 0, substep: 0};
  try {
    while (own.snapshot().outerStep < replay.frames.length) {
      beforeStep = own.snapshot();
      const out = await own.step();
      assert.equal(out.contactGraph.sequence, out.frame);
      assert.equal(out.contactGraph.liveColliders.length, out.cue.present ? 25 : 22);
      for (; scoreCursor < out.contactEvents.length; scoreCursor++) {
        assert.ok(contacts[scoreCursor], 'No invented application contact');
        compareContact(out.contactEvents[scoreCursor], contacts[scoreCursor], 'event' + scoreCursor, stats);
        game.contact(out.contactEvents[scoreCursor]); stats.eventsCompared++;
      }
      if (out.outerSubstep === 0) {
        const want = replay.frames[out.outerStep - 1];
        assert.equal(out.frame, want.hCount); assert.equal(out.time, want.time);
        assert.equal(out.cue.present, want.cuePresent); assert.equal(out.contactEvents.length, want.contactEventCount);
        for (let i = 0; i < 3; i++) {
          const a = out.balls[i].state, b = want.bodies[i];
          assert.equal(out.balls[i].id, b.id);
          for (const k of ['translation', 'rotation', 'linear', 'angular', 'invInertia'])
            close(a[k], b[k], ['translation', 'rotation'].includes(k) ? 1e-6 : 3e-6, 'outer' + out.outerStep + '.ball' + i + '.' + k, stats);
          assert.equal(a.sleeping, b.sleeping, 'Exact sleep flag');
        }
        if (firstRestOuter === null && !out.cue.present && out.balls.every(b => b.state.sleeping)) {
          firstRestOuter = out.outerStep; score = game.finish();
        }
        assert.deepEqual(game.snapshot(), want.scoring, 'Exact pending/final scoring and turn at every outer');
        if (checkpoints.has(out.outerStep)) compareCheckpoint(out, checkpoints.get(out.outerStep), stats);
        stats.outerCompared++;
        if(out.outerStep%512===0)console.log(JSON.stringify({progress:true,backend,pid:process.pid,outer:out.outerStep,h:out.frame,maxAbsolute:stats.maxAbsolute,memory:process.memoryUsage()}));
      }
      lastGood = {h: out.frame, outer: out.outerStep, substep: out.outerSubstep};
    }
    assert.equal(replay.status, 'native-rest-complete', 'Fixed horizon is incomplete, not a parity success');
    assert.equal(firstRestOuter, replay.firstRestOuter); assert.deepEqual(score, replay.score);
    assert.equal(own.snapshot().cue.present, false); assert.ok(own.snapshot().balls.every(b => b.state.sleeping));
    assert.equal(own.snapshot().scene.manager.awake_island, null);
    const result = {scope: 'source-validated-input-full25-to22-through-physical-rest', backend,
      status: 'rest-complete', fullShot: true, input:replay.spec, recordedOuterSteps:replay.frames.length, horizonOuterSteps: Full.HORIZON, firstRestOuter, score, ...stats};
    console.log(JSON.stringify(result)); return result;
  } catch (error) {
    const status = error instanceof RangeError && unsupported.test(error.message) ? 'unsupported-boundary' : 'comparison-failed';
    if(status==='unsupported-boundary')assert.deepEqual(own.snapshot(),beforeStep,'Unsupported source h must roll back all exposed ownership');
    const boundary = {lastGood, attemptedH: beforeStep.frame + 1, attemptedOuter: beforeStep.outerStep + 1,
      attemptedSubstep: beforeStep.outerSubstep + 1, error: error.message};
    const prefix = (process.env.CUE_INPUT_FULL_FAILURE_PREFIX ?? '/tmp/billiard-source-input-full-shot') + '-' + (device ? 'gpu' : 'cpu');
    const nativeOuter = Math.min(replay.frames.length, beforeStep.outerStep + 1);
    const nearest = replay.checkpoints.filter(row => Math.abs(row.step - nativeOuter) <= 1);
    const evidence = {status, boundary, stats, own: own.snapshot(), nativeFrame: replay.frames[nativeOuter - 1],
      nativeCheckpoints: nearest, nativeSource: {artifact: process.env.CUE_INPUT_FULL_REPLAY,
        initialSnapshotSha256: replay.record.created.snapshotSha256}, seedSource: 'record.created only'};
    const bytes = v8.serialize(evidence); fs.writeFileSync(prefix + '-boundary.v8', bytes);
    const result = {scope: 'source-validated-input-full25-to22-through-physical-rest', backend,
      status, fullShot: false, horizonOuterSteps: Full.HORIZON, nativeFirstRestOuter: replay.firstRestOuter,
      nativeScore: replay.score, boundary, ...stats, artifact: prefix + '-boundary.v8', artifactSha256: hash(bytes)};
    fs.writeFileSync(prefix + '-boundary.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result)); return result;
  } finally { own.dispose(); }
}
test('source input CPU owns original created world through native rest and fixed horizon', {timeout: 1200000}, async t => {
  if(selectedBackend==='gpu'){t.skip('Explicit fresh-process GPU/native gate; independent CPU result required for combined parity');return;}
  cpuResult = await run();
  assert.equal(cpuResult.status, 'rest-complete', JSON.stringify(cpuResult));
});
test('source input actual WGSL owns the same continuous native shot or preserves the identical first unsupported boundary', {timeout: 1200000}, async t => {
  if(selectedBackend==='both')assert.ok(cpuResult, 'CPU/native prerequisite result required');
  if(selectedBackend==='cpu'){t.skip('Explicit CPU-only diagnostic, not CPU/GPU parity');return;}
  if (cpuResult?.status === 'comparison-failed') { t.skip('CPU/native mismatch must be resolved before spending the GPU gate'); return; }
  assert.equal(process.env.REQUIRE_WEBGPU, '1', 'Actual WGSL is mandatory for full-shot parity');
  assert.ok(process.env.GPU_NATIVE_MODULE);
  const {create, globals} = await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);
  Object.assign(globalThis, globals);
  const gpu = create(['backend=vulkan']), adapter = await gpu.requestAdapter(); assert.ok(adapter);
  const device = await adapter.requestDevice();
  const release = require('./native-gpu-test-owner.cjs').retain(gpu, adapter, device, 'cue-input-full-shot');
  try { gpuResult = await run(device); } finally { release(); }
  if (cpuResult?.status === 'unsupported-boundary') {
    assert.equal(gpuResult.status, cpuResult.status); assert.deepEqual(gpuResult.boundary, cpuResult.boundary,
      'Both backends must preserve the exact first unsupported boundary without advancing or reseeding');
  }
  assert.equal(gpuResult.status, 'rest-complete', JSON.stringify(gpuResult));
});
