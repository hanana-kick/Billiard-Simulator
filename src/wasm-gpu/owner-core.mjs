import {subscribeDeviceLoss} from './device-loss-subscriptions.mjs';
/** Private shared lifecycle: one WASM schedule, terminal loss, cancel/drain/dispose. */
import {instantiateWasmGpuRuntime} from './runtime.mjs';
const abortError = reason => { const error = new Error(String(reason ?? 'WASM GPU run cancelled')); error.name = 'AbortError'; return error; };
export async function prepareWasmGpuOwner({moduleBytes, device, bridge, chunkSize, metadata = {}, snapshotRun, signal}) {
  let runtime;
  try {
    if (signal?.aborted) throw abortError(signal.reason);
    runtime = await instantiateWasmGpuRuntime({moduleBytes, bridge});
    if (signal?.aborted) throw abortError(signal.reason);
    runtime.load(Uint32Array.from({length: bridge.commandCount}, (_, i) => i + 1));
  } catch (error) { runtime?.dispose(); await bridge.dispose(); throw error; }
  let active = null, terminal = null, disposal = null, disposed = false;
  const checkAlive = () => { if (disposed || disposal) throw new Error('WASM GPU engine disposed'); if (terminal) throw terminal; };
  const status = () => Object.freeze({experimental: true, productionEnabled: false, requiresExclusiveDevice: true, ...metadata, state: disposed ? 'disposed' : disposal ? 'disposing' : terminal ? 'lost' : active ? (active.cancelled ? 'cancelling' : 'running') : 'ready', generation: runtime.status().generation, scheduler: runtime.status()});
  const cancel = reason => {
    if (!active || active.cancelled) return false;
    active.cancelled = abortError(reason);
    // The scheduler may already be complete while bridge.finish is awaiting GPU.
    if (runtime.status().state === 'running') runtime.cancel();
    else bridge.cancel(active.generation);
    return true;
  };
  const lose = reason => {
    if (disposed) return;
    terminal = reason instanceof Error ? reason : new Error(String(reason));
    if (runtime.status().state !== 'disposed') runtime.lose(terminal);
  };
  const unsubscribeLoss=subscribeDeviceLoss(device,info=>lose(info instanceof Error?info:new Error(`GPU device lost: ${info?.message ?? 'unknown'}`)));
  const guard = token => {
    if (active !== token) throw new Error('Stale WASM GPU run');
    if (terminal) throw terminal;
    if (token.cancelled) { bridge.cancel(token.generation); throw token.cancelled; }
    if (disposal || disposed) throw abortError('WASM GPU engine disposed');
  };
  function run(input = {}) {
    const {signal, onProgress, onExecutionPhase} = input;
    try {
      checkAlive();
      if (active) throw new Error('WASM GPU engine run already active');
      if (signal && (typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function')) throw new TypeError('AbortSignal required');
      if (signal?.aborted) throw abortError(signal.reason);
      if (onProgress !== undefined && typeof onProgress !== 'function') throw new TypeError('onProgress must be a function');
      if (onExecutionPhase !== undefined && typeof onExecutionPhase !== 'function') throw new TypeError('onExecutionPhase must be a function');
      const {begin, release = () => {}} = snapshotRun(input);
      const token = {generation: runtime.start().generation, cancelled: null, promise: null, began: globalThis.performance?.now()??Date.now()};
      active = token;
      const onAbort = () => cancel(signal.reason);
      token.promise = (async () => {
        let result, failure, phase = 'begin', submittedCommands = 0, chunkIndex = 0;
        const began = token.began;
        const detail = executionStage => Object.freeze({executionStage, generation: token.generation,
          chunkIndex, chunkCount: Math.ceil(bridge.commandCount / chunkSize), submittedCommands,
          totalCommands: bridge.commandCount, runElapsedMs: (globalThis.performance?.now() ?? Date.now()) - began});
        // Public observers execute only at owner boundaries, never inside bridge
        // submit/fence cleanup. Observer failures cancel and drain, not poison GPU.
        const report = executionStage => {
          guard(token); phase = 'progress';
          const result = onExecutionPhase?.(detail(executionStage));
          if (result && typeof result.then === 'function') {
            Promise.resolve(result).catch(() => {});
            throw new TypeError('Synchronous execution phase callback required');
          }
          guard(token);
        };
        try {
          signal?.addEventListener('abort', onAbort, {once: true});
          if (signal?.aborted) onAbort();
          guard(token);
          report('upload'); phase = 'begin';
          await bridge.beginRun({generation: token.generation, ...begin});
          guard(token);
          while (runtime.status().state === 'running') {
            chunkIndex++; report('chunk-encode-or-wait'); phase = 'step';
            const chunk = await runtime.step(chunkSize); submittedCommands += chunk.submittedCommands;
            guard(token);
            if (onProgress) {
              phase = 'progress';
              await onProgress(detail('chunk-submitted'));
              guard(token);
            }
          }
          report('finish-fence-and-readback'); phase = 'finish'; result = await bridge.finish(token.generation); guard(token);
        } catch (error) {
          failure = token.cancelled || error;
          if (token.cancelled || phase === 'progress') {
            if (runtime.status().state === 'running') runtime.cancel();
            else bridge.cancel(token.generation);
          } else lose(error);
        } finally {
          // Always settle real GPU fences before releasing or allowing arena reuse.
          try { await bridge.drain(); } catch (error) { failure ??= error; lose(error); }
          try { await release(); } catch (error) { failure ??= error; lose(error); }
          try { signal?.removeEventListener('abort', onAbort); } catch (error) { failure ??= error; }
          // Cancellation/loss/disposal can arrive during async lease cleanup too.
          failure ??= terminal || token.cancelled || ((disposal || disposed) ? abortError('WASM GPU engine disposed') : null);
          if (active === token) active = null;
        }
        if (failure) throw failure;
        return Object.freeze({generation: token.generation, result});
      })();
      return token.promise;
    } catch (error) { return Promise.reject(error); }
  }
  function dispose() {
    if (disposal) return disposal;
    // Reserve disposal before any await; a run cannot enter during cleanup.
    cancel('WASM GPU engine disposed');
    const pending = active?.promise;
    disposal = (async () => {
      try {
        if (pending) await pending.catch(() => {});
        runtime.dispose();
        await bridge.dispose();
      } finally { disposed = true; unsubscribeLoss(); }
    })();
    return disposal;
  }
  return Object.freeze({run, cancel, dispose, status, diagnostics:()=>{let d=bridge.diagnostics?.();if(active&&d?.generation!==active.generation)d={generation:active.generation,nativeStage:'owner-before-upload',submittedCommands:0,confirmedCommands:0,submittedFences:0,fulfilledFences:0,resultCopySubmitted:false};return d?Object.freeze({...d,runGeneration:d.generation,...(active?{runElapsedMs:Math.max(0,(globalThis.performance?.now()??Date.now())-active.began)}:{})}):null;}, experimental: true, productionEnabled: false, requiresExclusiveDevice: true, ...metadata});
}
