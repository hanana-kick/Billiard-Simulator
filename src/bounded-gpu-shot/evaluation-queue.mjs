// SPDX-License-Identifier: Apache-2.0
// Internal orchestration seam. Tests may supply lifecycle doubles; public
// factories bind only the real WebGPU service/worker, never a caller backend.
import {budgetOf, copyView, deferred, errorData, exactKeys, isTerminal} from './four-ball-worker-protocol.mjs';
import {copyEvaluationInputs, evaluationLimits, EVALUATION_LIMITS} from './evaluation-input.mjs';
export const EVALUATION_CAPABILITY = Object.freeze({
  kind: 'experimental-bounded-current-source-four-ball-evaluation', backend: 'webgpu',
  execution: 'serial-bounded-evaluation', parallelShotBatch: false, cpuFallback: false,
  wholeWorld: false, arbitraryShots: false, limits: EVALUATION_LIMITS,
  certification: 'no-reference-comparison-in-this-evaluation'
});
const done = status => !['queued', 'running', 'budget-suspended'].includes(status);
const smallError = error => error == null ? null : {name: String(error.name ?? 'Error').slice(0, 128),
  message: String(error.message ?? error).slice(0, 2048)};
function row(entry, status = 'queued', reason = null) {
  return {id: entry.id, index: entry.index, backend: 'webgpu', execution: 'serial-bounded-evaluation',
    status, reason, completed: false, source: {validated: false},
    certification: {status: 'not-certified', reason: 'no-reference-comparison-in-this-evaluation'},
    progress: {committedH: 0, outerStep: 0, outerSubstep: 0, seconds: 0},
    score: null, obstruction: {status: 'unknown', count: 0},
    recommendation: {valid: false, reason: 'not-complete'}, resources: null, error: null};
}
function summarize(entry, value) {
  const out = row(entry, value.status, value.reason);
  out.resources = value.resources ? Object.fromEntries(['buffersCreated', 'buffersDestroyed', 'buffersCollected',
    'trackedBuffers', 'peakTrackedBuffers'].map(key => [key, value.resources[key]])) : null;
  out.error = smallError(value.error); out.completed = value.status === 'complete';
  out.progress = {...value.progress};
  out.source = value.sourceEvidence ? {...value.sourceEvidence} : {validated: false};
  out.score = out.completed ? value.scoring?.result ?? null : null;
  const obstructions = value.state?.cueObstructions;
  out.obstruction = {status: Array.isArray(obstructions) && obstructions.length ? 'observed' :
    out.completed && Array.isArray(obstructions) ? 'clear-through-rest' : 'unknown', count: obstructions?.length ?? 0};
  const reason = out.obstruction.status === 'observed' ? 'cue-obstructed' : !out.completed ? 'not-complete' :
    !out.source.validated ? 'source-not-validated' : out.obstruction.status !== 'clear-through-rest' ? 'obstruction-not-established' :
      !(out.score?.delta > 0) ? 'no-positive-score' : null;
  out.recommendation = {valid: reason === null, reason};
  return out;
}
export function createEvaluationQueue(client, {onProgress, now = () => performance.now()} = {}) {
  let sequence = 0, active = null, availability = 'opening', closed = false, loss = null, disposal;
  const operations = new Set(), jobs = [], drainWaiters = []; let pumping = false;
  // Unlike an unbounded Promise tail, queued superseded requests can be removed
  // before an in-flight h drains. Retain one draining owner and one latest list.
  async function pump() {
    if (pumping) return; pumping = true; await Promise.resolve();
    while (jobs.length) {
      const job = jobs.shift();
      try {job.resolve(await job.action());} catch (error) {job.reject(error);}
    }
    pumping = false; for (const resolve of drainWaiters.splice(0)) resolve();
  }
  function enqueue(action, owner = null) {
    let resolve, reject; const result = new Promise((yes, no) => {resolve = yes; reject = no;});
    jobs.push({action, owner, resolve, reject}); void pump(); return result;
  }
  const drained = () => !pumping && !jobs.length ? Promise.resolve() : new Promise(resolve => drainWaiters.push(resolve));
  function dropQueued(owner, result) {
    for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].owner === owner) {
      const [job] = jobs.splice(i, 1); Promise.resolve(result).then(job.resolve, job.reject);
    }
  }
  const ready = Promise.resolve(client.ready).then(result => {
    if (!loss) availability = result.status;
    return copyView({...result, ...(loss ? {status: 'device-lost', reason: loss} : {}), evaluation: EVALUATION_CAPABILITY});
  }, error => {availability = 'failed'; return copyView({status: 'failed', reason: 'evaluation-initialization-failed', error: errorData(error), evaluation: EVALUATION_CAPABILITY});});
  const lost = client.deviceLost ?? new Promise(() => {});
  Promise.resolve(lost).then(info => {
    loss = String(info?.message ?? info?.reason ?? 'GPU device lost'); availability = 'device-lost';
    for (const op of operations) cancel(op, 'device-lost');
  }, error => {
    loss = String(error?.message ?? 'GPU device loss notification failed'); availability = 'device-lost';
    for (const op of operations) cancel(op, 'device-lost');
  });
  function view(op) {
    return copyView({operationId: op.id, status: op.status, reason: op.reason,
      backend: 'webgpu', execution: 'serial-bounded-evaluation', cpuFallback: false,
      completed: op.status === 'complete', allShotsComplete: op.rows.every(x => x.completed),
      progress: {total: op.rows.length, processed: op.rows.filter(x => done(x.status)).length,
        completed: op.rows.filter(x => x.completed).length, committedH: op.totalH, currentIndex: op.current ? op.index : null},
      limits: op.limits, inputBytes: op.inputBytes, budget: op.budget, slice: op.slice, shots: op.rows});
  }
  function notify(op) {
    // Late old-owner drain still settles its own handle, but never emits a
    // progress event that can overwrite the latest request's presentation.
    if (op === active && onProgress) {try {onProgress(view(op));} catch {}}
  }
  const interruption = op => loss ? {status: 'device-lost', reason: loss} : op.cancelReason || op !== active || closed ?
    {status: 'cancelled', reason: op.cancelReason ?? (closed ? 'service-disposed' : 'superseded')} : null;
  async function finish(op, status, reason = null) {
    if (done(op.status)) return view(op);
    if (op.current) {
      const last = await op.current.cancel();
      op.totalH += Math.max(0, (last.progress?.committedH ?? 0) - op.rows[op.index].progress.committedH);
      op.rows[op.index] = summarize(op.entries[op.index], last); op.current = null;
    }
    op.status = status; op.reason = reason;
    for (let i = 0; i < op.rows.length; i++) {
      if (!done(op.rows[i].status)) op.rows[i] = {...op.rows[i], status: 'not-run', reason};
      op.entries[i].input = null;
    }
    op.signal?.removeEventListener('abort', op.onAbort); operations.delete(op);
    const result = view(op); op.finished.resolve(result); notify(op); return result;
  }
  async function execute(op, budget) {
    if (done(op.status)) return view(op);
    op.status = 'running'; op.reason = null; op.budget = budget;
    const begin = now(), startH = op.totalH;
    op.slice = {committedH: 0, wallMs: 0, limit: null};
    const measure = () => {op.slice.committedH = op.totalH - startH; op.slice.wallMs = Math.max(0, now() - begin);};
    const suspend = reason => {measure(); op.status = 'budget-suspended'; op.reason = reason; op.slice.limit = reason; notify(op); return view(op);};
    try {
      while (true) {
        const stop = interruption(op); if (stop) {measure(); return finish(op, stop.status, stop.reason);}
        if (op.index === op.entries.length) {measure(); return finish(op, 'complete', 'all-inputs-processed');}
        measure();
        if (op.totalH >= op.limits.maxTotalH) return finish(op, 'limit-reached', 'maxTotalH');
        if (op.slice.committedH >= budget.maxSteps || op.slice.wallMs >= budget.maxWallMs)
          return suspend(op.slice.committedH >= budget.maxSteps ? 'maxSteps' : 'maxWallMs');
        const entry = op.entries[op.index];
        if (entry.rejected) {
          op.rows[op.index] = {...row(entry, 'unsupported', 'capture-envelope-unsupported'), error: smallError(entry.rejected)};
          op.index++; notify(op); continue;
        }
        const previousH = op.rows[op.index].progress.committedH;
        const remaining = {maxSteps: Math.min(budget.maxSteps - op.slice.committedH,
          op.limits.maxShotH - previousH, op.limits.maxTotalH - op.totalH),
          maxWallMs: Math.min(30000, Math.max(0.001, budget.maxWallMs - op.slice.wallMs))};
        let value;
        if (!op.current) {
          op.current = client.start(entry.input, {budget: remaining});
          // The child synchronously owns its input. Never retain a second raw
          // copy while the live world is suspended between slices.
          entry.input = null; value = await op.current.result;
        } else value = await op.current.resume({budget: remaining});
        op.totalH += Math.max(0, (value.progress?.committedH ?? 0) - previousH);
        op.rows[op.index] = summarize(entry, value); measure();
        const stopAfter = interruption(op); if (stopAfter) return finish(op, stopAfter.status, stopAfter.reason);
        if (isTerminal(value.status)) {
          op.current = null; op.index++; notify(op);
          if (value.status === 'device-lost') return finish(op, 'device-lost', value.reason);
          continue;
        }
        if (value.status !== 'budget-suspended') throw new Error('Shot returned a non-slice status: ' + value.status);
        if (value.progress.committedH >= op.limits.maxShotH || op.totalH >= op.limits.maxTotalH) {
          const reason = op.totalH >= op.limits.maxTotalH ? 'maxTotalH' : 'maxShotH';
          const drained = await op.current.cancel(); op.current = null;
          op.rows[op.index] = {...summarize(entry, drained), status: 'limit-reached', reason}; op.index++; notify(op);
          if (reason === 'maxTotalH') return finish(op, 'limit-reached', reason);
          continue;
        }
        return suspend(value.reason ?? 'shot-slice-budget');
      }
    } catch (error) {
      if (op.index < op.entries.length) op.rows[op.index] = {...op.rows[op.index], error: smallError(error)};
      measure(); const stop = interruption(op); return finish(op, stop?.status ?? 'failed', stop?.reason ?? 'evaluation-operation-failed');
    }
  }
  function schedule(op, budget) {
    if (op.pending) throw new Error('Evaluation already has a slice in flight');
    const result = enqueue(async () => {
      const out = await execute(op, budget), stop = interruption(op);
      return !done(op.status) && stop ? finish(op, stop.status, stop.reason) : out;
    }, op).finally(() => {if (op.pending === result) op.pending = null;});
    op.pending = result; return result;
  }
  function cancel(op, reason = 'cancelled-by-caller') {
    if (done(op.status)) return op.finished.promise;
    op.cancelReason ??= reason;
    // Unstarted list entries have no live owner. Release them immediately even
    // when an unrelated old h is still draining behind the worker boundary.
    for (const entry of op.entries) entry.input = null;
    if (op.status === 'queued' && !op.current) {
      const stop = interruption(op);
      const result = finish(op, stop?.status ?? 'cancelled', stop?.reason ?? reason);
      dropQueued(op, result); return op.cancelling ??= result;
    }
    // Signal the actual atomic-h owner immediately, but let its drain precede
    // aggregate terminal status and the next request's initializer.
    if (op.current) void op.current.cancel().catch(() => {});
    return op.cancelling ??= enqueue(() => {
      const stop = interruption(op); return finish(op, stop?.status ?? 'cancelled', stop?.reason ?? reason);
    });
  }
  return Object.freeze({ready, deviceLost: lost, capability: EVALUATION_CAPABILITY,
    snapshot: () => active ? view(active) : null,
    start(shots, options = {}) {
      if (closed) throw new Error('Evaluation service is disposed');
      if (availability !== 'ready') throw new Error('GPU evaluation unavailable: ' + availability + '; no CPU fallback');
      exactKeys(options, ['budget', 'limits', 'signal'], 'Evaluation start accepts budget, limits and signal only');
      const budget = budgetOf(options.budget), limits = evaluationLimits(options.limits), signal = options.signal;
      if (signal != null && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function'))
        throw new TypeError('AbortSignal required');
      const owned = copyEvaluationInputs(shots, limits);
      if (active && !done(active.status)) cancel(active, 'superseded');
      const op = {id: ++sequence, ...owned, limits, budget, signal, rows: owned.entries.map(entry => row(entry)),
        index: 0, totalH: 0, current: null, pending: null, cancelling: null, cancelReason: null,
        status: 'queued', reason: null, slice: null, finished: deferred()};
      op.onAbort = () => {void cancel(op, 'aborted');};
      signal?.addEventListener('abort', op.onAbort, {once: true}); if (signal?.aborted) op.cancelReason = 'aborted';
      active = op; operations.add(op);
      const result = schedule(op, budget); notify(op);
      return Object.freeze({id: op.id, result, finished: op.finished.promise,
        snapshot: () => view(op), cancel: () => cancel(op),
        resume(options = {}) {
          exactKeys(options, ['budget'], 'Evaluation resume accepts budget only');
          const budget = budgetOf(options.budget);
          if (op !== active || op.status !== 'budget-suspended' || op.pending || interruption(op))
            throw new Error('Only the latest idle budget-suspended evaluation can resume');
          return schedule(op, budget);
        }});
    },
    dispose() {
      if (disposal) return disposal; closed = true;
      for (const op of operations) cancel(op, 'service-disposed');
      return disposal = (async () => {await drained(); return client.dispose();})();
    }
  });
}
