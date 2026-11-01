// SPDX-License-Identifier: Apache-2.0
// Internal protocol/lifetime owner. Production entry supplies only the fixed GPU bootstrap.
import {PROTOCOL, budgetOf, copyWorkerInput, emptyView, errorData, isTerminal} from './four-ball-worker-protocol.mjs';
export function installWorkerHost(port, initialize, {copyInput = copyWorkerInput} = {}) {
  let sessionId = null, requestSequence = 0, operationSequence = 0, initialization;
  let owner = null, availability = 'opening', closed = false, disposal;
  const operations = new Map();
  const post = value => port.postMessage({protocol: PROTOCOL, sessionId, ...value});
  function view(record) {return {...record.operation.snapshot(), operationId: record.id};}
  function stamp(record) {return {operationId: record.id, view: view(record), revision: ++record.revision};}
  const reply = (message, result) => post({type: 'reply', requestId: message.requestId, result});
  const replyView = (message, record) => post({type: 'reply', requestId: message.requestId, ...stamp(record)});
  function ready() {
    return initialization ??= Promise.resolve().then(initialize).then(value => {
      owner = value;
      availability = value.service ? 'ready' : value.status;
      if (value.deviceLost) Promise.resolve(value.deviceLost).then(info => {
        if (closed) return; availability = 'device-lost'; post({type: 'device-lost', info: {reason: String(info?.reason ?? 'unknown'), message: String(info?.message ?? 'GPU device lost')}});
      }, error => {
        if (closed) return; availability = 'device-lost'; post({type: 'device-lost', info: {reason: 'notification-failed', message: errorData(error).message}});
      });
      return {status: availability, capability: value.capability ?? value.service?.capability ?? null, reason: value.reason ?? null};
    }, error => {
      availability = 'failed'; return {status: 'failed', reason: 'worker-initialization-failed', error: errorData(error)};
    });
  }
  async function dispose() {
    closed = true;
    return disposal ??= (async () => {
      await ready();
      // Never terminate or destroy the worker-owned device before the current
      // service constructor / atomic h and all cancelled owners have drained.
      await owner?.service?.dispose();
      await owner?.dispose?.();
      availability = 'disposed'; return {status: 'disposed', drained: true};
    })();
  }
  async function handle(message) {
    if (message.type === 'open') {reply(message, await ready()); return;}
    if (message.type === 'dispose') {reply(message, await dispose()); return;}
    if (message.type === 'release') {
      const record = operations.get(message.operationId);
      if (record && isTerminal(record.operation.snapshot().status)) operations.delete(record.id);
      reply(message, {status: 'released'}); return;
    }
    if (closed) throw new Error('Worker host is disposed');
    if (message.type === 'start') {
      if (availability !== 'ready') throw new Error('Worker GPU service is not ready: ' + availability);
      if (!Number.isSafeInteger(message.operationId) || message.operationId <= operationSequence) throw new Error('Stale operation ID');
      const input = copyInput(message.input), budget = budgetOf(message.budget);
      const abort = new AbortController(); if (message.aborted) abort.abort();
      const operation = owner.service.start(input, {budget, signal: abort.signal});
      operationSequence = message.operationId;
      const record = {id: message.operationId, operation, revision: 0};
      operations.set(record.id, record); post({type: 'progress', ...stamp(record)});
      operation.finished.then(() => post({type: 'progress', ...stamp(record)}));
      await operation.result; replyView(message, record); return;
    }
    const record = operations.get(message.operationId);
    if (!record) throw new Error('Unknown or released operation ID');
    if (message.type === 'snapshot') {replyView(message, record); return;}
    if (message.type === 'cancel') {await record.operation.cancel(); replyView(message, record); return;}
    if (message.type === 'resume') {
      await record.operation.resume({budget: budgetOf(message.budget)}); replyView(message, record); return;
    }
    throw new TypeError('Unknown worker command');
  }
  function receive(event) {
    const message = event.data;
    if (!message || message.protocol !== PROTOCOL || typeof message.sessionId !== 'string' || !Number.isSafeInteger(message.requestId) || message.requestId < 1) return;
    if (sessionId === null) {if (message.type !== 'open') return; sessionId = message.sessionId;}
    if (message.sessionId !== sessionId || message.requestId <= requestSequence) return;
    requestSequence = message.requestId;
    void handle(message).catch(error => {
      if (message.type === 'start' && Number.isSafeInteger(message.operationId)) {
        post({type: 'reply', requestId: message.requestId, operationId: message.operationId, revision: 1,
          view: emptyView(message.operationId, 'failed', 'worker-start-rejected', errorData(error))});
      } else reply(message, {status: 'failed', reason: 'worker-command-rejected', error: errorData(error),
        ...(message.type === 'dispose' ? {drained: false} : {})});
    });
  }
  port.addEventListener('message', receive);
  return Object.freeze({dispose, removeListener: () => port.removeEventListener('message', receive)});
}
