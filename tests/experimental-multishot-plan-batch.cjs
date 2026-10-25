'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), {pathToFileURL} = require('node:url');
const ROOT = path.resolve(process.env.BATCH_RUNTIME_ROOT ?? path.join(__dirname, '..'));
const Runtime = require(path.join(ROOT, 'src/experimental-stage-runtime')), Graph = require(path.join(ROOT, 'src/experimental-arithmetic-graph'));
const {createFakeDevice, until} = require('./plan-batch-fake-device.cjs'), {observeBatchDispatches} = require('./webgpu-batch-observation.cjs');
const PLAN = {inputFloats: 2, nodes: [{kind: 'add', args: [0, 1]}, {kind: 'mul', args: [0, 1]}, {kind: 'negate', args: [0]}], outputs: [2, 3, 4]};
const expected = (input, plan = PLAN) => Float32Array.from(Array.from({length: input.length / plan.inputFloats}, (_, row) => [...Graph.execute(input.slice(row * plan.inputFloats, (row + 1) * plan.inputFloats), plan), 1]).flat());
const bits = array => new Uint32Array(array.buffer, array.byteOffset, array.length);
async function handle(scope, ownerId, plan = PLAN, maxRows = 8) {return Runtime.createResidentGraph(scope.createDevice(ownerId), plan, {maxRows});}
async function settle(scope, requests) {await scope.flush(); return Promise.all(requests);}

test('two independently owned requests use one exact-plan dispatch with copied inputs and detached outputs', async () => {
  const fake = createFakeDevice(), observed = observeBatchDispatches(fake.device, {captureInputs: true}), scope = Runtime.createPlanBatchScope(fake.device, {maxRows: 8});
  const plan = structuredClone(PLAN), a = await handle(scope, 'shot-a', plan), b = await handle(scope, 'shot-b');
  plan.nodes[0].kind = 'sub'; plan.outputs.reverse();
  const backing = Float32Array.of(999, 2, 3, 999), inputA = backing.subarray(1, 3), inputB = Float32Array.of(7, 4), savedA = inputA.slice(), savedB = inputB.slice();
  const pa = a.run(inputA), pb = b.run(inputB); backing[1] = -999; inputB.fill(999);
  const [ra, rb] = await settle(scope, [pa, pb]);
  assert.deepEqual(bits(ra), bits(expected(savedA))); assert.deepEqual(bits(rb), bits(expected(savedB)));
  assert.notEqual(ra.buffer, rb.buffer); ra.fill(77); assert.deepEqual(bits(rb), bits(expected(savedB)));
  const proof = observed.snapshot(); assert.equal(proof.dispatches, 1); assert.equal(proof.queueSubmits, 1); assert.equal(proof.maxRows, 2); assert.deepEqual(proof.samples[0].input, [2, 3, 7, 4]);
  const stats = scope.snapshot(); assert.equal(stats.multiOwnerDispatches, 1); assert.equal(stats.maxDispatchOwners, 2); assert.equal(stats.maxDispatchRequests, 2);
  a.dispose(); b.dispose(); await scope.flush(); scope.dispose(); fake.assertReleased(); observed.restore();
});

test('different instruction bytes, input strides, output indices, and signed-zero constants never share a plan dispatch', async () => {
  const fake = createFakeDevice(), scope = Runtime.createPlanBatchScope(fake.device, {maxRows: 16});
  const plans = [PLAN, {...structuredClone(PLAN), outputs: [4, 3, 2]}, {...structuredClone(PLAN), nodes: [{kind: 'sub', args: [0, 1]}, ...PLAN.nodes.slice(1)]}, {inputFloats: 3, nodes: [{kind: 'add', args: [0, 1]}], outputs: [3]}, {inputFloats: 2, nodes: [{kind: 'const', args: [0]}], outputs: [2]}, {inputFloats: 2, nodes: [{kind: 'const', args: [-0]}], outputs: [2]}];
  const handles = []; for (let i = 0; i < plans.length; i++) handles.push(await handle(scope, 'variant-' + i, plans[i]));
  const inputs = plans.map(plan => plan.inputFloats === 3 ? Float32Array.of(5, 2, 100) : Float32Array.of(5, 2));
  const results = await settle(scope, handles.map((stage, i) => stage.run(inputs[i])));
  results.forEach((result, i) => assert.deepEqual(bits(result), bits(expected(inputs[i], plans[i]))));
  assert.equal(fake.calls.dispatches, plans.length); assert.equal(scope.snapshot().maxDispatchRequests, 1);
  handles.forEach(stage => stage.dispose()); scope.dispose(); fake.assertReleased();
});

test('bounded queues, row capacity, duplicate owners, and overlapping handles reject without cross-owner mutation', async () => {
  const fake = createFakeDevice(), scope = Runtime.createPlanBatchScope(fake.device, {maxRows: 4, maxOwners: 2, maxQueuedRequests: 1}), a = await handle(scope, 'a', PLAN, 4), b = await handle(scope, 'b', PLAN, 4);
  assert.throws(() => scope.createDevice('a')); assert.throws(() => scope.createDevice('c'));
  const input = Float32Array.of(2, 3), first = a.run(input), overlap = a.run(input), full = b.run(input);
  await assert.rejects(overlap, /busy|pending|overlap/i); await assert.rejects(full, /queue|bound|capacity|limit/i);
  assert.deepEqual(await first, expected(input)); await scope.flush();
  await assert.rejects(a.run(new Float32Array(10)), /bounded|rows|capacity|limit/i);
  const saved = await b.run(Float32Array.of(4, 3)); assert.deepEqual(saved, expected(Float32Array.of(4, 3)));
  a.dispose(); b.dispose(); await scope.flush(); scope.dispose(); fake.assertReleased();
  const other = createFakeDevice(), bounded = Runtime.createPlanBatchScope(other.device, {maxRows: 4}), x = await handle(bounded, 'x', PLAN, 4), y = await handle(bounded, 'y', PLAN, 4);
  const three = Float32Array.of(1, 2, 3, 4, 5, 6), result = await settle(bounded, [x.run(three), y.run(three)]);
  result.forEach(value => assert.deepEqual(value, expected(three))); assert.equal(other.calls.dispatches, 2); assert.ok(other.calls.rows.every(rows => rows <= 4));
  x.dispose(); y.dispose(); bounded.dispose(); other.assertReleased();
});

test('queued and in-flight cancellation preserves another owner and drains shared native work before reuse', async () => {
  const fake = createFakeDevice(), scope = Runtime.createPlanBatchScope(fake.device), a = await handle(scope, 'cancel'), b = await handle(scope, 'survive');
  const input = Float32Array.of(2, 3), before = new AbortController(); before.abort();
  await assert.rejects(a.run(input, {signal: before.signal}), {name: 'AbortError'}); assert.equal(fake.calls.dispatches, 0);
  const queued = new AbortController(), pa = a.run(input, {signal: queued.signal}), pb = b.run(Float32Array.of(7, 4)); queued.abort();
  await assert.rejects(pa, {name: 'AbortError'}); assert.deepEqual(await pb, expected(Float32Array.of(7, 4))); await scope.flush();
  fake.control.holdMaps = true;
  const active = new AbortController(), pendingA = a.run(input, {signal: active.signal}), pendingB = b.run(Float32Array.of(9, 4));
  const settled = Promise.allSettled([pendingA, pendingB]); await until(() => fake.calls.rows.at(-1) === 2); active.abort();
  assert.throws(() => scope.dispose(), /busy|pending|active/i); await assert.rejects(b.run(input), /busy|pending|overlap/i);
  fake.flushMaps(); const results = await settled; await scope.flush();
  assert.equal(results[0].status, 'rejected'); assert.equal(results[0].reason.name, 'AbortError'); assert.equal(results[1].status, 'fulfilled'); assert.deepEqual(results[1].value, expected(Float32Array.of(9, 4)));
  fake.control.holdMaps = false; assert.deepEqual(await a.run(input), expected(input));
  a.dispose(); b.dispose(); await scope.flush(); scope.dispose(); fake.assertReleased();
});

test('device loss invalidates all sharing owners without affecting an independent device scope', async () => {
  const fake = createFakeDevice(), safe = createFakeDevice(), scope = Runtime.createPlanBatchScope(fake.device), other = Runtime.createPlanBatchScope(safe.device);
  const a = await handle(scope, 'a'), b = await handle(scope, 'b'), c = await handle(other, 'a'), input = Float32Array.of(2, 3);
  fake.control.holdMaps = true; const pending = Promise.allSettled([a.run(input), b.run(input)]); await until(() => fake.calls.dispatches === 1); fake.lose();
  const results = await pending; results.forEach(result => {assert.equal(result.status, 'rejected'); assert.match(result.reason.message, /device lost/i);});
  await assert.rejects(a.run(input), /device lost/i); assert.deepEqual(await c.run(input), expected(input));
  await scope.flush().catch(error => assert.match(error.message, /device lost/i)); fake.flushMaps();
  a.dispose(); b.dispose(); scope.dispose(); c.dispose(); await other.flush(); other.dispose(); fake.assertReleased(); safe.assertReleased();
});

test('plan, handle, input-byte, row, and resident-growth bounds are enforced without leaking generations', async () => {
  for (const options of [{maxPlans: 1}, {maxHandles: 1}]) {
    const fake = createFakeDevice(), scope = Runtime.createPlanBatchScope(fake.device, options), a = await handle(scope, 'a');
    await assert.rejects(handle(scope, 'b', {...structuredClone(PLAN), outputs: [4]}), /limit|budget/i);
    a.dispose(); await scope.flush(); scope.dispose(); fake.assertReleased();
  }
  for (const options of [{maxQueuedBytes: 4}, {maxQueuedRows: 1}]) {
    const fake = createFakeDevice(), scope = Runtime.createPlanBatchScope(fake.device, options), a = await handle(scope, 'a');
    await assert.rejects(a.run(Float32Array.of(1, 2, 3, 4)), /budget|rows|limit/i); assert.equal(fake.calls.dispatches, 0);
    a.dispose(); await scope.flush(); scope.dispose(); fake.assertReleased();
  }
  const fake = createFakeDevice(), scope = Runtime.createPlanBatchScope(fake.device, {maxBytes: 600, maxRows: 8}), a = await handle(scope, 'a');
  const four = Float32Array.of(1, 2, 3, 4, 5, 6, 7, 8); assert.deepEqual(await a.run(four), expected(four)); await scope.flush();
  const prior = scope.snapshot().residentBytes; assert.ok(prior <= 600);
  await assert.rejects(a.run(new Float32Array(16).fill(1)), /resident byte budget/i); await scope.flush();
  assert.equal(scope.snapshot().residentBytes, prior, 'Rejected growth retains its prior valid generation');
  assert.deepEqual(await a.run(Float32Array.of(2, 3)), expected(Float32Array.of(2, 3))); a.dispose(); await scope.flush(); scope.dispose(); fake.assertReleased();
});

test('owner-wide cancellation drains active shared work and permanently stops only that owner', async () => {
  const fake = createFakeDevice(), scope = Runtime.createPlanBatchScope(fake.device), a = await handle(scope, 'cancelled-owner'), b = await handle(scope, 'live-owner');
  fake.control.holdMaps = true; const input = Float32Array.of(3, 4), results = Promise.allSettled([a.run(input), b.run(input)]);
  await until(() => fake.calls.dispatches === 1); const cancelled = scope.cancelOwner('cancelled-owner', 'explicit owner cancellation');
  assert.equal(a.snapshot().busy, true); assert.equal(b.snapshot().busy, true); fake.flushMaps(); await cancelled;
  const settled = await results; assert.equal(settled[0].status, 'rejected'); assert.equal(settled[0].reason.name, 'AbortError'); assert.equal(settled[1].status, 'fulfilled'); assert.deepEqual(settled[1].value, expected(input));
  await assert.rejects(a.run(input), {name: 'AbortError'}); fake.control.holdMaps = false; assert.deepEqual(await b.run(input), expected(input));
  a.dispose(); b.dispose(); await scope.flush(); scope.dispose(); fake.assertReleased();
});

test('an invalid arithmetic row cannot poison a valid independent owner or trigger CPU fallback', async () => {
  const fake = createFakeDevice(), scope = Runtime.createPlanBatchScope(fake.device), division = {inputFloats: 2, nodes: [{kind: 'div', args: [0, 1]}], outputs: [2]};
  const a = await handle(scope, 'invalid-row', division), b = await handle(scope, 'valid-row', division);
  const pending = Promise.allSettled([a.run(Float32Array.of(4, 0)), b.run(Float32Array.of(8, 2))]); await scope.flush(); const results = await pending;
  assert.equal(results[0].status, 'rejected'); assert.match(results[0].reason.message, /Incomplete/);
  assert.equal(results[1].status, 'fulfilled'); assert.deepEqual(results[1].value, Float32Array.of(4, 1));
  assert.equal(fake.calls.dispatches, 3, 'One shared dispatch plus at most one real retry per original request');
  assert.equal(scope.snapshot().rowFailureIsolationGroups, 1); assert.equal(scope.snapshot().rowFailureRetryDispatches, 2);
  a.dispose(); b.dispose(); scope.dispose(); fake.assertReleased();
});

test('explicit owner frontiers batch callbacks from different tasks without mixing subsequent requests', async () => {
  const fake = createFakeDevice(), scope = Runtime.createPlanBatchScope(fake.device), a = await handle(scope, 'a'), b = await handle(scope, 'b');
  scope.beginRound(['a', 'b']);
  const worker = async (stage, id, delayed) => {
    try {for (let i = 0; i < 3; i++) {
      if (delayed) await new Promise(resolve => setImmediate(resolve));
      const input = Float32Array.of(i + (delayed ? 10 : 1), 2); assert.deepEqual(await stage.run(input), expected(input));
    }} finally {scope.endRoundOwner(id);}
  };
  await Promise.all([worker(a, 'a', false), worker(b, 'b', true)]); await scope.finishRound();
  assert.equal(fake.calls.dispatches, 3); assert.deepEqual(fake.calls.rows, [2, 2, 2]);
  const stats = scope.snapshot(); assert.equal(stats.frontiers, 3); assert.equal(stats.roundsStarted, 1); assert.equal(stats.roundsCompleted, 1); assert.equal(stats.multiOwnerDispatches, 3);
  for (const receipt of stats.recentDispatches) {assert.deepEqual(new Set(receipt.ownerIds), new Set(['a', 'b'])); assert.equal(receipt.requestCount, 2);}
  a.dispose(); b.dispose(); scope.dispose(); fake.assertReleased();
});

test('cancelled or ended frontier owners cannot leave a surviving request permanently waiting', async () => {
  const fake = createFakeDevice(), scope = Runtime.createPlanBatchScope(fake.device), a = await handle(scope, 'a'), b = await handle(scope, 'b');
  scope.beginRound(['a', 'b']); const input = Float32Array.of(4, 5), pending = a.run(input);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(fake.calls.dispatches, 0, 'First owner waits for a real frontier, not a timer');
  const stopped = scope.cancelOwner('b', 'cancel before frontier arrival'); assert.deepEqual(await pending, expected(input)); scope.endRoundOwner('a'); await stopped; await scope.finishRound();
  assert.equal(fake.calls.dispatches, 1); assert.equal(scope.snapshot().maxDispatchOwners, 1);
  await assert.rejects(b.run(input), {name: 'AbortError'}); a.dispose(); b.dispose(); scope.dispose(); fake.assertReleased();
});

test('actual native WGSL executes two distinct owned inputs in one dispatch and matches sequential GPU bits', {skip: !process.env.GPU_NATIVE_MODULE && process.env.REQUIRE_WEBGPU !== '1', timeout: 120000}, async t => {
  assert.equal(process.env.REQUIRE_WEBGPU, '1'); assert.ok(process.env.GPU_NATIVE_MODULE);
  const {create, globals} = await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href); Object.assign(globalThis, globals);
  const gpu = create(['backend=vulkan']), adapter = await gpu.requestAdapter(); assert.ok(adapter, 'Actual adapter required; no CPU substitution');
  const device = await adapter.requestDevice(), release = require('./native-gpu-test-owner.cjs').retain(gpu, adapter, device, 'independent multi-shot arithmetic');
  const observation = observeBatchDispatches(device, {captureInputs: true}), scope = Runtime.createPlanBatchScope(device, {maxRows: 64}); let a, b, sequential;
  try {
    a = await handle(scope, 'placed-independent'), b = await handle(scope, 'settled-independent');
    const inputA = Float32Array.of(2, 3), inputB = Float32Array.of(7, 4), [actualA, actualB] = await settle(scope, [a.run(inputA), b.run(inputB)]);
    const proof = observation.snapshot(); assert.equal(proof.dispatches, 1); assert.equal(proof.queueSubmits, 1); assert.equal(proof.maxRows, 2); assert.deepEqual(proof.samples[0].input, [2, 3, 7, 4]);
    assert.equal(scope.snapshot().multiOwnerDispatches, 1); assert.equal(scope.snapshot().maxDispatchOwners, 2);
    sequential = await Runtime.createResidentGraph(device, PLAN, {maxRows: 64});
    assert.deepEqual(bits(actualA), bits(await sequential.run(inputA))); assert.deepEqual(bits(actualB), bits(await sequential.run(inputB)));
    assert.deepEqual(actualA, expected(inputA)); assert.deepEqual(actualB, expected(inputB));
    const originalA = actualA.slice(); actualB.fill(999); assert.deepEqual(actualA, originalA);
    const variants = structuredClone(PLAN); variants.outputs.reverse(); const other = await handle(scope, 'different-exact-plan', variants);
    const start = observation.snapshot().dispatches, [same, different] = await settle(scope, [a.run(inputA), other.run(inputB)]);
    assert.equal(observation.snapshot().dispatches - start, 2); assert.deepEqual(same, expected(inputA)); assert.deepEqual(different, expected(inputB, variants)); other.dispose();
    t.diagnostic(JSON.stringify({schema: 'native-multishot-arithmetic-proof-v1', adapter: Object.fromEntries(['vendor', 'architecture', 'device', 'description', 'isFallbackAdapter'].map(key => [key, adapter.info?.[key] ?? null])), actualNativeDispatch: proof, scope: scope.snapshot(), sequentialGpuBitwiseEqual: true, cpuExact: true, hardwareAccelerationClaim: false}));
  } finally {sequential?.dispose(); a?.dispose(); b?.dispose(); scope.dispose(); observation.restore(); release();}
});
