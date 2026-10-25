'use strict';
// Deterministic host ownership/failure model only. This is explicitly NOT
// evidence of native GPU execution; the separate native tests require Dawn.
const assert = require('node:assert/strict');
const Graph = require('../src/experimental-arithmetic-graph');
function deferred() {let resolve, reject; const promise = new Promise((a, b) => {resolve = a; reject = b;}); return {promise, resolve, reject};}
function createFakeDevice() {
  const loss = deferred(), buffers = [], pending = [], control = {holdMaps: false}, calls = {dispatches: 0, submits: 0, scopes: 0, rows: []};
  class Buffer {
    constructor(descriptor) {Object.assign(this, descriptor); this.bytes = new ArrayBuffer(descriptor.size); this.destroyed = false; this.destroyCalls = 0; this.mapState = 'unmapped';}
    mapAsync() {
      assert.equal(this.destroyed, false); const map = deferred(); this.pending = map; this.mapState = 'pending';
      const finish = () => {if (this.destroyed) map.reject(Error('Buffer destroyed')); else {this.mapState = 'mapped'; map.resolve();}};
      if (control.holdMaps) pending.push(finish); else finish(); return map.promise;
    }
    getMappedRange(offset = 0, size = this.size) {assert.equal(this.mapState, 'mapped'); return this.bytes.slice(offset, offset + size);}
    unmap() {this.mapState = 'unmapped'; this.pending?.reject(Error('Mapping unmapped')); this.pending = null;}
    destroy() {this.destroyed = true; this.destroyCalls++; this.unmap();}
  }
  const device = {
    lost: loss.promise, limits: {maxStorageBufferBindingSize: 1 << 24, maxBufferSize: 1 << 24},
    createShaderModule({code}) {return {code, async getCompilationInfo() {return {messages: []};}};},
    async createComputePipelineAsync({compute}) {return {module: compute.module, getBindGroupLayout() {return {};}};},
    createBuffer(descriptor) {const buffer = new Buffer(descriptor); buffers.push(buffer); return buffer;},
    createBindGroup(descriptor) {for (const entry of descriptor.entries) assert.ok(entry.resource.size > 0 && entry.resource.size <= entry.resource.buffer.size); return descriptor;},
    pushErrorScope() {calls.scopes++;},
    popErrorScope() {assert.ok(calls.scopes > 0); calls.scopes--; return Promise.resolve(null);},
    queue: {
      writeBuffer(buffer, offset, value) {assert.equal(buffer.destroyed, false); new Uint8Array(buffer.bytes, offset, value.byteLength).set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));},
      submit(commands) {calls.submits++; for (const command of commands) for (const run of command) run();},
    },
    createCommandEncoder() {
      const commands = [];
      return {
        clearBuffer(buffer, offset, size) {commands.push(() => new Uint8Array(buffer.bytes, offset, size).fill(0));},
        beginComputePass() {
          let pipeline, group, workgroups;
          return {
            setPipeline(value) {pipeline = value;}, setBindGroup(index, value) {assert.equal(index, 0); group = value;}, dispatchWorkgroups(value) {workgroups = value;},
            end() {commands.push(() => {
              const resources = group.entries.map(entry => entry.resource), width = Number(/let count=arrayLength\(&inputs\)\/(\d+)u;/.exec(pipeline.module.code)[1]);
              const input = new Float32Array(resources[0].buffer.bytes, 0, resources[0].size / 4), program = new Uint32Array(resources[1].buffer.bytes, 0, resources[1].size / 4);
              const indices = new Uint32Array(resources[3].buffer.bytes, 0, resources[3].size / 4), output = new Float32Array(resources[4].buffer.bytes, 0, resources[4].size / 4), nodes = [];
              for (let i = 0; i < program.length; i += 4) {const op = Graph.OPERATIONS[program[i]]; nodes.push({kind: op.name, args: op.name === 'const' ? [new Float32Array(Uint32Array.of(program[i + 1]).buffer)[0]] : Array.from(program.slice(i + 1, i + 1 + op.arity))});}
              const plan = {inputFloats: width, nodes, outputs: Array.from(indices)}, rows = input.length / width, stride = indices.length + 1;
              assert.equal(workgroups, Math.ceil(rows / 32)); assert.equal(resources[2].size, rows * (width + nodes.length) * 4); assert.equal(output.length, rows * stride);
              calls.dispatches++; calls.rows.push(rows);
              for (let row = 0; row < rows; row++) {try {output.set(Graph.execute(input.slice(row * width, (row + 1) * width), plan), row * stride); output[row * stride + indices.length] = 1;} catch {output[row * stride + indices.length] = 0;}}
            });},
          };
        },
        copyBufferToBuffer(source, start, destination, offset, size) {commands.push(() => new Uint8Array(destination.bytes, offset, size).set(new Uint8Array(source.bytes, start, size)));},
        finish() {return commands;},
      };
    },
  };
  return {device, buffers, calls, control, flushMaps() {pending.splice(0).forEach(finish => finish());}, lose() {loss.resolve({reason: 'destroyed', message: 'independent test device loss'});},
    assertReleased() {assert.equal(calls.scopes, 0); assert.ok(buffers.every(buffer => buffer.destroyed && buffer.destroyCalls === 1), 'Every actual owned buffer is destroyed exactly once');}};
}
async function until(predicate) {for (let i = 0; i < 50; i++) {if (predicate()) return; await new Promise(resolve => setImmediate(resolve));} assert.fail('Expected bounded asynchronous transition did not occur');}
module.exports = {createFakeDevice, until};
