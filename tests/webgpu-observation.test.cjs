'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const {observeWebGpu} = require('./webgpu-observation.cjs');
test('API observations preserve handles, receivers, args and original promises', async () => {
  const values = [], promise = Promise.resolve(), pass = {dispatchWorkgroups(...x) {assert.equal(this, pass); values.push(x);}}, encoder = {beginComputePass() {return pass;}, copyBufferToBuffer() {}}, queue = {writeBuffer() {}, submit() {}}, made = [];
  const device = {queue, createBuffer(descriptor) {const buffer = {destroy() {}, mapAsync() {return promise;}, getMappedRange() {return new ArrayBuffer(16);}, unmap() {}}; made.push(buffer); return buffer;}, createCommandEncoder() {return encoder;}};
  const oldCreate = device.createBuffer, oldDispatch = pass.dispatchWorkgroups, seen = observeWebGpu(device);
  const source = device.createBuffer({size: 32, usage: 128}), read = device.createBuffer({size: 16, usage: 9});
  assert.equal(source, made[0]); assert.equal(read, made[1]);
  seen.phase('steady'); queue.writeBuffer(source, 0, new Uint32Array(8), 2, 3);
  const e = device.createCommandEncoder(), p = e.beginComputePass(); assert.equal(e, encoder); assert.equal(p, pass); p.dispatchWorkgroups(2, 3);
  e.copyBufferToBuffer(source, 0, read, 0, 16); queue.submit([{}]); assert.equal(read.mapAsync(1), promise); await promise; read.getMappedRange(); read.unmap(); source.destroy(); source.destroy();
  const m = seen.snapshot(); assert.equal(m.phases.construction.buffersCreated, 2); assert.equal(m.phases.steady.buffersDestroyed, 1); assert.equal(m.buffers.liveRequestedBytes, 16); assert.equal(m.phases.steady.writeBufferBytes, 12); assert.equal(m.phases.steady.readbackCopyBytes, 16); assert.equal(m.phases.steady.mapReadBytes, 16); assert.equal(m.phases.steady.dispatchWorkgroups, 6); assert.equal(m.phases.steady.mapAsyncResolved, 1); assert.deepEqual(values, [[2, 3]]);
  read.destroy(); assert.equal(seen.snapshot().buffers.liveCount, 0); seen.restore(); assert.equal(device.createBuffer, oldCreate); assert.notEqual(pass.dispatchWorkgroups, oldDispatch); // Ephemeral handles are not retained solely for restoration.
});
test('cannot hide pending mapAsync by switching phase', async () => {
  let resolve; const promise = new Promise(r => {resolve = r;}); const device = {queue: {}, createBuffer() {return {mapAsync() {return promise;}, destroy() {}};}};
  const seen = observeWebGpu(device), b = device.createBuffer({size: 8, usage: 9}); b.mapAsync(1); assert.throws(() => seen.phase('steady'), /pending/); resolve(); await promise; seen.phase('steady'); seen.restore();
});
test('clear logical ranges and rejected maps are observed without swallowing runtime errors', async () => {
  const failure = Error('device loss'), promise = Promise.reject(failure), clears = [];
  // The test itself observes the rejection immediately as a real caller would.
  promise.catch(() => {});
  const encoder = {clearBuffer(...args) {clears.push(args);}}, device = {queue: {}, createBuffer() {return {mapAsync() {return promise;}, destroy() {}};}, createCommandEncoder() {return encoder;}};
  const seen = observeWebGpu(device), buffer = device.createBuffer({size: 64, usage: 9});
  device.createCommandEncoder().clearBuffer(buffer, 8, 16);
  assert.equal(buffer.mapAsync(1, 8, 16), promise); await assert.rejects(promise, error => error === failure);
  const m = seen.snapshot().phases.construction; assert.equal(m.clearBufferBytes, 16); assert.equal(m.mapReadBytes, 16); assert.equal(m.mapAsyncRejected, 1); assert.equal(clears[0][0], buffer);
  seen.phase('after'); seen.restore();
});
