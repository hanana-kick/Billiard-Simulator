'use strict';
// Pass-through API observations. Actual native objects, original receivers,
// arguments, results and promises are retained; no proxy is passed to WebGPU.
const {performance} = require('node:perf_hooks');
function observeWebGpu(device) {
  let phase = 'construction';
  const phases = {}, restore = [], buffers = new WeakMap(), patched = new WeakSet();
  let liveBuffers = 0, liveBytes = 0, peakBuffers = 0, peakBytes = 0;
  const row = name => phases[name] ??= {buffersCreated: 0, bufferBytesCreated: 0, buffersDestroyed: 0, bufferBytesDestroyed: 0, createBindGroup: 0, createShaderModule: 0, createComputePipeline: 0, createCommandEncoder: 0, computePasses: 0, dispatches: 0, dispatchWorkgroups: 0, indirectDispatches: 0, queueSubmits: 0, submittedCommandBuffers: 0, writeBufferCalls: 0, writeBufferBytes: 0, clearBufferCalls: 0, clearBufferBytes: 0, copyBufferCalls: 0, copyBufferBytes: 0, readbackCopies: 0, readbackCopyBytes: 0, mapAsyncCalls: 0, mapReadCalls: 0, mapReadBytes: 0, mapAsyncResolved: 0, mapAsyncRejected: 0, mapAsyncWaitSumMs: 0, mapAsyncOutstandingUnionMs: 0, getMappedRangeCalls: 0, getMappedRangeBytes: 0, unmapCalls: 0, apiSynchronousWallMs: 0};
  // Only device/queue methods are retained for restoration. Buffer/encoder/pass
  // observation closures are owned by their native object, not this observer.
  // WeakMap/WeakSet metadata cannot retain a destroyed GPUBuffer.
  const pending = new Map();
  function wrap(object, name, call, retained = false) {
    const original = object[name]; if (typeof original !== 'function') return;
    const own = Object.getOwnPropertyDescriptor(object, name);
    Object.defineProperty(object, name, {configurable: true, writable: true, value: function (...args) {
      const metric = row(phase), start = performance.now();
      try { return call(original, this, args, metric, phase); }
      finally { metric.apiSynchronousWallMs += performance.now() - start; }
    }});
    if (retained) restore.push(() => own ? Object.defineProperty(object, name, own) : delete object[name]);
  }
  function watchBuffer(buffer, descriptor) {
    if (patched.has(buffer)) return buffer; patched.add(buffer);
    const size = Number(descriptor.size), info = {size, usage: descriptor.usage, destroyed: false}; buffers.set(buffer, info);
    liveBuffers++; liveBytes += size; peakBuffers = Math.max(peakBuffers, liveBuffers); peakBytes = Math.max(peakBytes, liveBytes);
    wrap(buffer, 'destroy', (fn, self, args, m) => { const result = Reflect.apply(fn, self, args); if (!info.destroyed) {info.destroyed = true; liveBuffers--; liveBytes -= size; m.buffersDestroyed++; m.bufferBytesDestroyed += size;} return result; });
    wrap(buffer, 'mapAsync', (fn, self, args, m, p) => {
      const start = performance.now(), result = Reflect.apply(fn, self, args), bytes = args[2] ?? size - (args[1] ?? 0);
      m.mapAsyncCalls++; if (args[0] & 1) {m.mapReadCalls++; m.mapReadBytes += bytes;}
      const state = pending.get(p) ?? {count: 0, start: 0}; if (!state.count++) state.start = start; pending.set(p, state);
      const finish = success => {const end = performance.now(); m[success ? 'mapAsyncResolved' : 'mapAsyncRejected']++; m.mapAsyncWaitSumMs += end - start; if (!--state.count) m.mapAsyncOutstandingUnionMs += end - state.start;};
      // Attach an observer without substituting the returned native promise.
      result.then(() => finish(true), () => finish(false)); return result;
    });
    wrap(buffer, 'getMappedRange', (fn, self, args, m) => {const result = Reflect.apply(fn, self, args); m.getMappedRangeCalls++; m.getMappedRangeBytes += result.byteLength; return result;});
    wrap(buffer, 'unmap', (fn, self, args, m) => {const result = Reflect.apply(fn, self, args); m.unmapCalls++; return result;});
    return buffer;
  }
  wrap(device, 'createBuffer', (fn, self, args, m) => {const result = Reflect.apply(fn, self, args); m.buffersCreated++; m.bufferBytesCreated += Number(args[0].size); return watchBuffer(result, args[0]);}, true);
  for (const [method, field] of [['createBindGroup', 'createBindGroup'], ['createShaderModule', 'createShaderModule'], ['createComputePipeline', 'createComputePipeline'], ['createComputePipelineAsync', 'createComputePipeline']]) wrap(device, method, (fn, self, args, m) => {const result = Reflect.apply(fn, self, args); m[field]++; return result;}, true);
  wrap(device.queue, 'writeBuffer', (fn, self, args, m) => {
    const result = Reflect.apply(fn, self, args), data = args[2], unit = ArrayBuffer.isView(data) && !(data instanceof DataView) ? data.BYTES_PER_ELEMENT : 1;
    m.writeBufferCalls++; m.writeBufferBytes += args[4] === undefined ? data.byteLength - (args[3] ?? 0) * unit : args[4] * unit; return result;
  }, true);
  wrap(device.queue, 'submit', (fn, self, args, m) => {const result = Reflect.apply(fn, self, args); m.queueSubmits++; m.submittedCommandBuffers += args[0].length; return result;}, true);
  wrap(device, 'createCommandEncoder', (fn, self, args, m) => {
    const encoder = Reflect.apply(fn, self, args); m.createCommandEncoder++;
    wrap(encoder, 'clearBuffer', (fn, self, args, m) => {const result = Reflect.apply(fn, self, args); m.clearBufferCalls++; m.clearBufferBytes += args[2] ?? (buffers.get(args[0])?.size ?? 0) - (args[1] ?? 0); return result;});
    wrap(encoder, 'copyBufferToBuffer', (fn, self, args, m) => {const result = Reflect.apply(fn, self, args); m.copyBufferCalls++; m.copyBufferBytes += args[4]; if ((buffers.get(args[2])?.usage ?? 0) & 1) {m.readbackCopies++; m.readbackCopyBytes += args[4];} return result;});
    wrap(encoder, 'beginComputePass', (fn, self, args, m) => {
      const pass = Reflect.apply(fn, self, args); m.computePasses++;
      wrap(pass, 'dispatchWorkgroups', (fn, self, args, m) => {const result = Reflect.apply(fn, self, args); m.dispatches++; m.dispatchWorkgroups += args[0] * (args[1] ?? 1) * (args[2] ?? 1); return result;});
      wrap(pass, 'dispatchWorkgroupsIndirect', (fn, self, args, m) => {const result = Reflect.apply(fn, self, args); m.dispatches++; m.indirectDispatches++; return result;});
      return pass;
    }); return encoder;
  }, true);
  return {
    phase(name) {if ([...pending.values()].some(x => x.count)) throw Error('Cannot change observation phase with pending mappings'); phase = name; row(name);},
    snapshot() {return structuredClone({phases, buffers: {liveCount: liveBuffers, liveRequestedBytes: liveBytes, peakLiveCount: peakBuffers, peakLiveRequestedBytes: peakBytes}, semantics: 'Logical GPUBuffer requested bytes, not driver allocation or VRAM. API-call wall and mapAsync outstanding wall are not GPU timestamps or isolated JavaScript CPU.'});},
    restore() {while (restore.length) restore.pop()();},
  };
}
module.exports = {observeWebGpu};
