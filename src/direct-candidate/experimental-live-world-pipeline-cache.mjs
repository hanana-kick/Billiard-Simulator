/** Factory-owned immutable compilation reuse only. Never retains a request,
 * buffer, bind group, engine or cancellation signal. Successful native pipelines
 * retain their original layouts; no separately-created layout is substituted.
 * Hits skip native allocation/preflight (including its error-scope observations).
 */
const devices = new WeakMap();
const checkedShaders = new WeakMap();
const MAX_COMPLETED = 128;
// Exact-source JS key budget only; not a bound on opaque GPU/driver memory.
const MAX_KEY_BYTES = 32 * 1024 * 1024;
const abort = signal => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };
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
  state = {completed: new Map(), keyBytes: 0, pending: new Set(), lost: null};
  devices.set(device, state);
  const lose = info => {
    if (state.lost) return;
    state.lost = new Error('Live pipeline cache device lost: ' + (info?.message ?? 'unknown'));
    state.completed.clear(); state.keyBytes = 0;
    for (const reject of state.pending) reject(state.lost);
    state.pending.clear();
  };
  Promise.resolve(device.lost).then(lose, lose);
  return state;
}
function alive(state) { if (state.lost) throw state.lost; }
function pending(state, work) {
  alive(state);
  return new Promise((resolve, reject) => {
    state.pending.add(reject);
    Promise.resolve(work).then(value => {
      state.pending.delete(reject);
      if (state.lost) reject(state.lost); else resolve(value);
    }, error => { state.pending.delete(reject); reject(error); });
  });
}
/** Opaque same-device/source receipt; callers cannot supply native modules. */
export async function prepareLiveWorldShader(device, {code, label, signal} = {}) {
  abort(signal);
  if (typeof code !== 'string') throw TypeError('Exact shader source required');
  const state = stateFor(device); alive(state);
  const module = device.createShaderModule({code, ...(label === undefined ? {} : {label})});
  const info = await pending(state, module.getCompilationInfo());
  if (info.messages.some(x => x.type === 'error')) throw Error(info.messages.map(x => x.message).join('\n'));
  abort(signal); alive(state);
  const receipt = Object.freeze({}); checkedShaders.set(receipt, {device, code, module}); return receipt;
}
export async function compileLiveWorldPipeline(device, {code, layout = 'auto', entryPoint = 'main', label, preflight = true, signal, preflightShader} = {}) {
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
  const module = checked?.module ?? device.createShaderModule({code, ...(label === undefined ? {} : {label})});
  if (preflight && !checked) {
    const info = await pending(state, module.getCompilationInfo());
    if (info.messages.some(x => x.type === 'error')) throw Error(info.messages.map(x => x.message).join('\n'));
  }
  abort(signal); alive(state);
  const nativeLayout = ownedLayout === 'auto' ? 'auto' : device.createPipelineLayout({bindGroupLayouts: ownedLayout.bindGroupLayouts.map(x => device.createBindGroupLayout(x))});
  const pipeline = await pending(state, device.createComputePipelineAsync({layout: nativeLayout, compute: {module, entryPoint}}));
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
