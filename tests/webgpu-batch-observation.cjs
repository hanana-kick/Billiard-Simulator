'use strict';
// Observe the actual native dispatch's shader stride and logical bind ranges.
// This does not substitute a device, pipeline, buffer, command, or promise.
// Counts alone cannot prove independent request ownership; scheduler acceptance
// tests must additionally tie these rows to separately submitted requests.
const {createHash} = require('node:crypto');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function observeBatchDispatches(device, {maxSamples = 32, captureInputs = false} = {}) {
  const modules = new WeakMap(), pipelines = new WeakMap(), groups = new WeakMap(), writes = new WeakMap();
  const restores = [], samples = [], recent = [], rowsHistogram = {}, plans = new Set();
  let dispatches = 0, arithmeticDispatches = 0, multiRowDispatches = 0, maxRows = 0, queueSubmits = 0;
  function wrap(object, name, invoke, retain = false) {
    const fn = object[name]; if (typeof fn !== 'function') return;
    const own = Object.getOwnPropertyDescriptor(object, name);
    Object.defineProperty(object, name, {configurable: true, writable: true, value: function (...args) { return invoke(fn, this, args); }});
    if (retain) restores.push(() => own ? Object.defineProperty(object, name, own) : delete object[name]);
  }
  wrap(device, 'createShaderModule', (fn, self, args) => {
    const result = Reflect.apply(fn, self, args), code = args[0].code;
    const stride = /let count=arrayLength\(&inputs\)\/(\d+)u;/.exec(code);
    if (stride) modules.set(result, {inputFloats: Number(stride[1]), shaderSha256: hash(code), label: args[0].label ?? null});
    return result;
  }, true);
  for (const name of ['createComputePipeline', 'createComputePipelineAsync']) wrap(device, name, (fn, self, args) => {
    const result = Reflect.apply(fn, self, args), info = modules.get(args[0].compute.module);
    const remember = pipeline => { if (info) pipelines.set(pipeline, info); };
    if (result?.then) result.then(remember, () => {}); else remember(result);
    return result;
  }, true);
  wrap(device, 'createBindGroup', (fn, self, args) => {
    const result = Reflect.apply(fn, self, args);
    groups.set(result, new Map(args[0].entries.map(entry => [entry.binding, {...entry.resource, ...(entry.resource.buffer ? {size: entry.resource.size ?? entry.resource.buffer.size - (entry.resource.offset ?? 0)} : {})}])));
    return result;
  }, true);
  wrap(device.queue, 'writeBuffer', (fn, self, args) => {
    const result = Reflect.apply(fn, self, args), [buffer, offset, input, dataOffset = 0, dataSize] = args;
    const view = ArrayBuffer.isView(input), unit = view && !(input instanceof DataView) ? input.BYTES_PER_ELEMENT : 1;
    const storage = view ? input.buffer : input, start = (view ? input.byteOffset : 0) + dataOffset * unit;
    const length = dataSize === undefined ? input.byteLength - dataOffset * unit : dataSize * unit;
    const bytes = new Uint8Array(storage, start, length);
    // Real runtime uploads are complete logical writes at offset zero. A future
    // partial-write implementation must be handled explicitly, not guessed.
    writes.set(buffer, {offset, bytes: length, sha256: hash(bytes), input: captureInputs ? bytes.slice() : null});
    return result;
  }, true);
  wrap(device.queue, 'submit', (fn, self, args) => {const result = Reflect.apply(fn, self, args); queueSubmits++; return result;}, true);
  wrap(device, 'createCommandEncoder', (fn, self, args) => {
    const encoder = Reflect.apply(fn, self, args);
    wrap(encoder, 'beginComputePass', (fn, self, args) => {
      const pass = Reflect.apply(fn, self, args); let pipeline, group;
      wrap(pass, 'setPipeline', (fn, self, args) => {const result = Reflect.apply(fn, self, args); pipeline = args[0]; return result;});
      wrap(pass, 'setBindGroup', (fn, self, args) => {const result = Reflect.apply(fn, self, args); if (args[0] === 0) group = args[1]; return result;});
      wrap(pass, 'dispatchWorkgroups', (fn, self, args) => {
        const result = Reflect.apply(fn, self, args); dispatches++;
        const plan = pipelines.get(pipeline), bindings = groups.get(group);
        if (plan && bindings) {
          const source = bindings.get(0), program = bindings.get(1), indices = bindings.get(3), output = bindings.get(4);
          const rows = source.size / (plan.inputFloats * 4), inputWrite = writes.get(source.buffer);
          const programWrite = writes.get(program.buffer), indexWrite = writes.get(indices.buffer);
          const exact = Number.isSafeInteger(rows) && rows > 0 && inputWrite?.offset === 0 && inputWrite.bytes === source.size && programWrite?.bytes === program.size && indexWrite?.bytes === indices.size;
          if (!exact) throw Error('Cannot prove native arithmetic logical row layout from observed bindings/uploads: ' + JSON.stringify({rows, width: plan.inputFloats, sourceSize: source.size, inputBytes: inputWrite?.bytes, inputOffset: inputWrite?.offset, programSize: program.size, programBytes: programWrite?.bytes, indexSize: indices.size, indexBytes: indexWrite?.bytes}));
          const planSha256 = hash(plan.shaderSha256 + ':' + programWrite.sha256 + ':' + indexWrite.sha256);
          arithmeticDispatches++; if (rows > 1) multiRowDispatches++; maxRows = Math.max(maxRows, rows);
          rowsHistogram[rows] = (rowsHistogram[rows] ?? 0) + 1; plans.add(planSha256);
          const record = {planSha256, label: plan.label, inputFloats: plan.inputFloats, nodeCount: program.size / 16, outputFloats: indices.size / 4, rows, workgroups: args[0], inputBytes: source.size, outputBytes: output.size, inputSha256: inputWrite.sha256,
            ...(captureInputs ? {input: Array.from(new Float32Array(inputWrite.input.buffer, inputWrite.input.byteOffset, inputWrite.input.byteLength / 4))} : {})};
          if (samples.length < maxSamples) samples.push(record);
          recent.push(record); if (recent.length > 512) recent.shift();
        }
        return result;
      });
      return pass;
    });
    return encoder;
  }, true);
  return {
    snapshot() {return structuredClone({dispatches, arithmeticDispatches, multiRowDispatches, maxRows, queueSubmits, rowsHistogram, exactPlanCount: plans.size, samples, semantics: 'Actual native arithmetic shader stride, program/output identity, logical binding row count, and API dispatches. Not GPU timestamps or hardware acceleration evidence.'});},
    takeRecent() {return structuredClone(recent.splice(0));},
    restore() {while (restores.length) restores.pop()();},
  };
}
module.exports = {observeBatchDispatches};
