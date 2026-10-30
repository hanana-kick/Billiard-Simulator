import {WASM_GPU_COMMAND_CAPACITY,assertWasmGpuSchedulerLimits,WASM_GPU_MAX_CHUNK} from './scheduler-limits.mjs';
/** Private stage-one WASM command scheduler. GPU physics remains existing WGSL.
 * No fetch, CPU physics, or runtime dependency. Each instance owns one schedule.
 * Cancellation cannot retract work already submitted to a GPU queue.
 */
const STATES = ['empty', 'ready', 'running', 'complete', 'cancelled', 'lost', 'disposed'];
const uint = (value, name, maximum = 0xffffffff) => {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new RangeError(`${name} must be an integer in 1..${maximum}`);
  return value;
};
export async function instantiateWasmGpuRuntime({ moduleBytes, bridge } = {}) {
  if (!(moduleBytes instanceof ArrayBuffer) && !ArrayBuffer.isView(moduleBytes)) throw new TypeError('Explicit bundled moduleBytes are required');
  uint(bridge?.commandCount, 'bridge.commandCount', WASM_GPU_COMMAND_CAPACITY);
  for (const method of ['encodeChunk', 'cancel', 'lose']) if (typeof bridge[method] !== 'function') throw new TypeError(`bridge.${method} is required`);
  const commandCount = bridge.commandCount;
  let exports, pending = null, stepping = false;
  const imports = { bridge: { submit(pointer, count, generation) {
    if (pending || !exports || count < 1 || count > WASM_GPU_MAX_CHUNK) return -1;
    pending = { handles: new Uint32Array(exports.memory.buffer, pointer, count).slice(), generation: generation >>> 0 };
    return 0;
  } } };
  const { instance } = await WebAssembly.instantiate(moduleBytes, imports);
  exports = assertWasmGpuSchedulerLimits(instance.exports);
  if (exports.configure(commandCount) !== 0) throw new Error('Unsupported WASM scheduler ABI');
  const check = (value, operation) => { if (value < 0) throw new Error(`WASM scheduler ${operation} rejected (${value}; ${STATES[exports.state()]})`); return value; };
  const status = () => Object.freeze({ state: STATES[exports.state()], generation: exports.generation() >>> 0, cursor: exports.cursor() >>> 0, repeatsLeft: exports.repeats_left() >>> 0, commandCount: exports.stream_len() >>> 0, inFlight: stepping });
  const loseBridge = reason => {
    if (exports.state() !== 6) exports.lose();
    bridge.lose(reason);
  };
  const invoke = (name, ...args) => {
    try { return exports[name](...args); } catch (error) {
      // An unexpected trap leaves submission ambiguous: never allow retry.
      loseBridge(error);
      throw error;
    }
  };
  const idle = () => { if (stepping) throw new Error('WASM scheduler chunk in flight'); };
  return Object.freeze({
    status,
    load(handles) {
      idle();
      if (!Array.isArray(handles) && !(handles instanceof Uint32Array)) throw new TypeError('command handles must be an array or Uint32Array');
      uint(handles.length, 'command stream length', exports.capacity());
      // Validate before coercion into WASM memory: fractions/NaN/negative IDs must not wrap.
      for (const handle of handles) uint(handle, 'command handle', commandCount);
      new Uint32Array(exports.memory.buffer, exports.input_ptr(), handles.length).set(handles);
      check(exports.load(handles.length), 'load');
      return status();
    },
    start({ repeat = 1 } = {}) { idle(); uint(repeat, 'repeat'); check(exports.start(repeat), 'start'); return status(); },
    async step(maxCommands = 256) {
      idle(); uint(maxCommands, 'maxCommands', exports.max_chunk()); stepping = true;
      try {
        const count = check(invoke('step', maxCommands), 'step');
        const chunk = pending; pending = null;
        if (!chunk) { const error = new Error('WASM scheduler failed to emit a chunk'); loseBridge(error); throw error; }
        try {
          const result = await bridge.encodeChunk(chunk.handles, chunk.generation);
          if (result === false) throw new Error('GPU bridge rejected chunk');
        } catch (error) {
          const cancelled = exports.state() === 4;
          invoke('commit', 0);
          if (!cancelled) loseBridge(error);
          throw error;
        }
        check(invoke('commit', 1), 'commit');
        return { submittedCommands: count, ...status(), inFlight: false };
      } finally { pending = null; stepping = false; }
    },
    cancel() {
      check(exports.cancel(), 'cancel');
      try { bridge.cancel(exports.generation() >>> 0); } catch (error) { loseBridge(error); throw error; }
      return status();
    },
    lose(reason = 'WASM scheduler lost') { check(exports.lose(), 'lose'); bridge.lose(reason); return status(); },
    dispose() {
      check(exports.dispose(), 'dispose');
      // Stop not-yet-submitted work synchronously; owner still awaits bridge.drain/dispose.
      try { bridge.cancel(exports.generation() >>> 0); } finally { bridge.lose('WASM scheduler disposed'); }
      return status();
    },
  });
}
