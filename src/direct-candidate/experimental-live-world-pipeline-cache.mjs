import {canonicalPreparationAbort} from './canonical-page-preparation.mjs';
/** Factory-owned immutable compilation reuse only. Never retains a request,
 * buffer, bind group, engine or cancellation signal. Successful native pipelines
 * retain their original layouts; no separately-created layout is substituted.
 * Hits skip native allocation/preflight (including its error-scope observations).
 */
const devices = new WeakMap();
const checkedShaders = new WeakMap();
const MAX_COMPLETED = 128;
// Per native preparation await, not a total search/runtime deadline. A minute
// permits slow cold compilers while bounding a missing browser callback. Tests
// and owned callers may provide a shorter positive deadline explicitly.
export const LIVE_WORLD_PREPARATION_TIMEOUT_MS = 60_000;
// Exact-source JS key budget only; not a bound on opaque GPU/driver memory.
const MAX_KEY_BYTES = 32 * 1024 * 1024;
const abort = signal => { if (signal?.aborted) throw canonicalPreparationAbort(signal); };
// Exact JSON data only: reject values that JSON would silently omit or coerce.
function snapshot(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return value;
  if (Array.isArray(value)) {
    if (Reflect.ownKeys(value).length !== value.length + 1) throw TypeError('Dense layout data required');
    return Array.from({length: value.length}, (_, i) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw TypeError('Dense plain layout data required');
      return snapshot(descriptor.value);
    });
  }
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw TypeError('Plain layout data required');
      Object.defineProperty(out, key, {value: snapshot(descriptor.value), enumerable: true});
    }
    return out;
  }
  throw TypeError('Exact layout data required');
}
function stateFor(device) {
  let state = devices.get(device);
  if (state) return state;
  if (typeof device?.lost?.then !== 'function') throw TypeError('Device loss promise required');
  state = {completed: new Map(), keyBytes: 0, pending: new Set(), lost: null, quarantined: null};
  devices.set(device, state);
  const lose = info => {
    if (state.lost) return;
    state.lost = new Error('Live pipeline cache device lost: ' + (info?.message ?? 'unknown'));
    state.lost.deviceLoss = Object.freeze({reason: info?.reason ?? 'unknown', message: info?.message ?? 'unknown'});
    state.completed.clear(); state.keyBytes = 0;
    for (const reject of state.pending) reject(state.lost);
    state.pending.clear();
  };
  Promise.resolve(device.lost).then(lose, lose);
  return state;
}
function alive(state) { if (state.quarantined) throw state.quarantined; if (state.lost) throw state.lost; }
function pending(state, work, context, signal, timeoutMs = LIVE_WORLD_PREPARATION_TIMEOUT_MS) {
  // Observe already-started native work even when this device was quarantined.
  const promise = Promise.resolve(work); promise.catch(() => {});
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) throw RangeError('Positive bounded preparation timeout required');
  alive(state);
  const annotate = error => {
    if (!context || error?.name === 'AbortError') return error;
    const diagnostic = Object.freeze({...context, elapsedMs: Math.max(0, Date.now() - context.startedAt), ...(error?.deviceLoss ? {deviceLoss: error.deviceLoss} : {})});
    const result = new Error((error?.message ?? String(error)) + ` [${context.label ?? 'unnamed'} · ${context.stage} · ${diagnostic.elapsedMs} ms${error?.deviceLoss ? ' · reason=' + error.deviceLoss.reason : ''}]`, {cause: error});
    result.name = error?.name ?? 'Error'; result.gpuPreparation = diagnostic;
    if (error?.code) result.code = error.code;
    if (error?.deviceLoss) result.deviceLoss = error.deviceLoss;
    return result;
  };
  return new Promise((resolve, reject) => {
    let done = false, timer;
    const finish = (fn, value) => {
      if (done) return;
      done = true; clearTimeout(timer); state.pending.delete(fail);
      signal?.removeEventListener('abort', stop); fn(value);
    };
    const fail = error => finish(reject, annotate(error));
    const stop = () => fail(canonicalPreparationAbort(signal));
    state.pending.add(fail);
    signal?.addEventListener('abort', stop, {once:true});
    if (signal?.aborted) stop();
    if (!done) timer = setTimeout(() => {
      const error = new Error(`GPU 준비 응답이 ${timeoutMs} ms 동안 없어 중단했습니다. 페이지를 새로고침해 GPU 장치를 다시 준비하세요.`);
      error.name = 'GPUPreparationTimeoutError'; error.code = 'GPU_PREPARATION_TIMEOUT';
      // Native compilation is not cancellable. Never reuse this uncertain
      // device or admit its late success as a cache hit. No GPU drain is timed.
      state.quarantined ??= error; state.completed.clear(); state.keyBytes = 0;
      for (const rejectPending of [...state.pending]) rejectPending(state.quarantined);
    }, timeoutMs);
    promise.then(value => {
      if (done) return;
      try { alive(state); } catch (error) { fail(error); return; }
      finish(resolve, value);
    }, fail);
  });
}
/** Reject new work on a device with uncertain timed-out native preparation. */
export function assertLiveWorldPreparationUsable(device) { alive(stateFor(device)); }
/** Preparation only: never use for submitted work, mapping or resource drains. */
export async function awaitLiveWorldPreparation(device, work, {signal, timeoutMs = LIVE_WORLD_PREPARATION_TIMEOUT_MS, ...context} = {}) {
  return pending(stateFor(device), work, {startedAt: Date.now(), ...context}, signal, timeoutMs);
}
/** Opaque same-device/source receipt; callers cannot supply native modules. */
export async function prepareLiveWorldShader(device, {code, label, signal, preparationTimeoutMs = LIVE_WORLD_PREPARATION_TIMEOUT_MS} = {}) {
  abort(signal);
  if (typeof code !== 'string') throw TypeError('Exact shader source required');
  const state = stateFor(device); alive(state);
  const module = device.createShaderModule({code, ...(label === undefined ? {} : {label})});
  const info = await pending(state, module.getCompilationInfo(), {stage: 'shader-info', label, entryPoint: 'main', shaderBytes: new TextEncoder().encode(code).byteLength, startedAt: Date.now()},signal,preparationTimeoutMs);
  if (info.messages.some(x => x.type === 'error')) throw Error(info.messages.map(x => x.message).join('\n'));
  abort(signal); alive(state);
  const receipt = Object.freeze({}); checkedShaders.set(receipt, {device, code, module}); return receipt;
}
export async function compileLiveWorldPipeline(device, {code, layout = 'auto', entryPoint = 'main', label, preflight = true, signal, preflightShader, preparationTimeoutMs = LIVE_WORLD_PREPARATION_TIMEOUT_MS} = {}) {
  abort(signal);
  if (typeof code !== 'string' || typeof entryPoint !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(entryPoint) || typeof preflight !== 'boolean') throw TypeError('Exact shader source and preflight required');
  const checked = preflightShader === undefined ? null : checkedShaders.get(preflightShader);
  if (preflightShader !== undefined && (!checked || checked.device !== device || checked.code !== code || !preflight)) throw TypeError('Owned same-device exact-source preflight receipt required');
  const ownedLayout = snapshot(layout), key = JSON.stringify([code, ownedLayout, preflight, entryPoint]), state = stateFor(device);
  alive(state);
  const cached = state.completed.get(key);
  if (cached) {
    state.completed.delete(key); state.completed.set(key, cached);
    return cached.pipeline;
  }
  // Pending calls stay independent: cancellation cannot poison another caller.
  const context = {label, entryPoint, shaderBytes: new TextEncoder().encode(code).byteLength, startedAt: Date.now()};
  const module = checked?.module ?? device.createShaderModule({code, ...(label === undefined ? {} : {label})});
  if (preflight && !checked) {
    const info = await pending(state, module.getCompilationInfo(), {...context, stage: 'shader-info'},signal,preparationTimeoutMs);
    if (info.messages.some(x => x.type === 'error')) throw Error(info.messages.map(x => x.message).join('\n'));
  }
  abort(signal); alive(state);
  const nativeLayout = ownedLayout === 'auto' ? 'auto' : device.createPipelineLayout({bindGroupLayouts: ownedLayout.bindGroupLayouts.map(x => device.createBindGroupLayout(x))});
  const pipeline = await pending(state, device.createComputePipelineAsync({layout: nativeLayout, compute: {module, entryPoint}}), {...context, stage: 'pipeline-create'},signal,preparationTimeoutMs);
  alive(state); abort(signal);
  // UTF-16 upper bound for retained exact-source key storage; oversized sources
  // still compile normally but do not evict the entire useful cache.
  const bytes = key.length * 2;
  if (bytes <= MAX_KEY_BYTES) {
    const previous = state.completed.get(key);
    if (previous) state.keyBytes -= previous.bytes;
    state.completed.delete(key);
    state.completed.set(key, {pipeline, bytes}); state.keyBytes += bytes;
    while (state.completed.size > MAX_COMPLETED || state.keyBytes > MAX_KEY_BYTES) {
      const oldest = state.completed.keys().next().value;
      state.keyBytes -= state.completed.get(oldest).bytes; state.completed.delete(oldest);
    }
  }
  return pipeline;
}
