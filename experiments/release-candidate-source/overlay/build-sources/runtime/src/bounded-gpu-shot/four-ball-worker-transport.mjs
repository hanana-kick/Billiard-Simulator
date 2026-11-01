// SPDX-License-Identifier: Apache-2.0
// Internal transport seam for tests. It cannot initialize a world or decode a seed.
import {PROTOCOL, budgetOf, copyWorkerInput, copyView, deferred, emptyView, exactKeys, isTerminal, errorData} from './four-ball-worker-protocol.mjs';
export function createWorkerClientTransport(worker, {onProgress, copyInput = copyWorkerInput} = {}) {
  const sessionId = globalThis.crypto.randomUUID(), ready = deferred(), lost = deferred();
  let requestSequence = 0, operationSequence = 0, active = null, availability = 'opening', closed = false;
  let disposePromise, dead = false;
  const requests = new Map(), operations = new Map();
  const removeListeners = () => {worker.removeEventListener('message', receive); worker.removeEventListener('error', transportError); worker.removeEventListener('messageerror', transportError);};
  function fail(error) {
    if (dead) return; dead = true; availability = 'failed'; closed = true;
    const failure = copyView({status: 'failed', reason: 'worker-transport-failed', error: errorData(error), cleanupVerified: false});
    ready.resolve(failure); lost.resolve({reason: 'transport-failed', error: failure.error});
    for (const op of operations.values()) {
      apply(op, {...op.view, status: 'failed', phase: 'finished', completed: false,
        reason: failure.reason, error: failure.error, scoring: {...op.view.scoring, result: null}}, op.revision + 1);
      op.finished.resolve(op.view); op.first.resolve(op.view); op.signal?.removeEventListener('abort', op.onAbort);
    }
    operations.clear();
    for (const request of requests.values()) request.resolve(failure);
    requests.clear(); removeListeners(); worker.terminate();
  }
  function transportError(event) {fail(event.error ?? new Error(event.message ?? 'Worker message could not be delivered'));}
  function send(type, fields = {}, op = null) {
    const requestId = ++requestSequence, result = deferred();
    if (dead) {result.resolve({status: 'failed', reason: 'worker-transport-failed', cleanupVerified: false}); return result.promise;}
    requests.set(requestId, {...result, op});
    try {worker.postMessage({protocol: PROTOCOL, sessionId, requestId, type, ...fields});}
    catch (error) {fail(error);}
    return result.promise;
  }
  function release(op) {
    operations.delete(op.id); op.signal?.removeEventListener('abort', op.onAbort);
    // FIFO release acknowledges the terminal receipt, so already-sent cancel /
    // snapshot requests retain their worker-side operation until they arrive.
    void send('release', {operationId: op.id});
  }
  function apply(op, value, revision) {
    if (!value || value.operationId !== op.id || revision <= op.revision || isTerminal(op.view.status)) return;
    op.revision = revision; op.view = copyView(value);
    if (onProgress) {try {onProgress(copyView(op.view));} catch {/* Observers cannot poison transport or physics. */}}
    if (isTerminal(op.view.status)) {op.finished.resolve(copyView(op.view)); release(op);}
  }
  function receive(event) {
    const message = event.data;
    if (!message || message.protocol !== PROTOCOL || message.sessionId !== sessionId) return;
    if (message.type === 'device-lost') {
      availability = 'device-lost'; lost.resolve(copyView(message.info)); return;
    }
    if (message.type === 'progress') {
      const op = operations.get(message.operationId);
      if (op) apply(op, message.view, message.revision);
      return;
    }
    if (message.type !== 'reply') return;
    const request = requests.get(message.requestId);
    if (!request) return; requests.delete(message.requestId);
    if (message.view && request.op) apply(request.op, message.view, message.revision);
    request.resolve(message.view ? copyView(message.view) : copyView(message.result));
  }
  worker.addEventListener('message', receive); worker.addEventListener('error', transportError); worker.addEventListener('messageerror', transportError);
  void send('open').then(result => {
    if (!closed && availability === 'opening') availability = result.status;
    ready.resolve(availability === 'device-lost' ? copyView({...result, status: 'device-lost', reason: 'worker-device-lost-before-ready'}) : result);
  });
  return Object.freeze({
    ready: ready.promise, deviceLost: lost.promise,
    snapshot: () => active ? copyView(active.view) : null,
    start(input, options = {}) {
      if (closed) throw new Error('Worker client is disposed');
      if (availability !== 'ready') throw new Error('Await ready status before starting a worker shot: ' + availability);
      exactKeys(options, ['budget', 'signal'], 'Start accepts budget and signal only');
      const budget = budgetOf(options.budget), signal = options.signal;
      if (signal != null && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function'))
        throw new TypeError('AbortSignal required');
      // Copy and validate before replacing the active view or posting anything.
      const owned = copyInput(input), id = ++operationSequence;
      const op = {id, revision: 0, view: emptyView(id), first: deferred(), finished: deferred(), pending: true, signal};
      operations.set(id, op); active = op;
      op.onAbort = () => {void cancel();};
      const initial = send('start', {operationId: id, input: owned, budget, aborted: signal?.aborted === true}, op);
      initial.then(result => {op.pending = false; op.first.resolve(result);});
      function cancel() {
        if (isTerminal(op.view.status)) return Promise.resolve(copyView(op.view));
        return op.cancelling ??= send('cancel', {operationId: id}, op);
      }
      signal?.addEventListener('abort', op.onAbort, {once: true});
      if (signal?.aborted) void cancel();
      return Object.freeze({id, result: op.first.promise, finished: op.finished.promise,
        snapshot: () => copyView(op.view), cancel,
        async progress() {
          if (isTerminal(op.view.status)) return copyView(op.view);
          return send('snapshot', {operationId: id}, op);
        },
        resume(options = {}) {
          exactKeys(options, ['budget'], 'Resume accepts only budget');
          const budget = budgetOf(options.budget);
          if (closed || availability !== 'ready' || op !== active || op.pending || op.cancelling || op.view.status !== 'budget-suspended')
            throw new Error('Only the active idle budget-suspended operation can resume');
          op.pending = true;
          return send('resume', {operationId: id, budget}, op).finally(() => {op.pending = false;});
        }});
    },
    dispose() {
      if (disposePromise) return disposePromise; closed = true;
      disposePromise = send('dispose').then(result => {
        removeListeners(); if (!dead) worker.terminate();
        for (const pending of requests.values()) pending.resolve({status: 'disposed'});
        requests.clear();
        if (!dead) {dead = true; availability = 'disposed';}
        return result;
      });
      return disposePromise;
    }
  });
}
