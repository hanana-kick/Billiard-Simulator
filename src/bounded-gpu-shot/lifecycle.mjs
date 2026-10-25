// SPDX-License-Identifier: Apache-2.0
// Internal scheduling/ownership only. Not a physics backend or admission API.
export function freezeOwned(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  // ECMAScript cannot freeze a nonempty typed view. Such buffers stay private.
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  for (const child of Object.values(value)) freezeOwned(child, seen);
  return Object.freeze(value);
}
function rejectSharedMemory(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  const buffer = ArrayBuffer.isView(value) ? value.buffer : value;
  if (Object.prototype.toString.call(buffer) === '[object SharedArrayBuffer]')
    throw new TypeError('SharedArrayBuffer inputs are not owned initial capture memory');
  if (value instanceof Map) {
    for (const [key, child] of value) { rejectSharedMemory(key, seen); rejectSharedMemory(child, seen); }
  } else if (value instanceof Set) {
    for (const child of value) rejectSharedMemory(child, seen);
  } else if (!ArrayBuffer.isView(value) && !(value instanceof ArrayBuffer)) {
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
      throw new TypeError('Initial capture requires plain data, not hidden host-object memory');
    for (const child of Object.values(value)) rejectSharedMemory(child, seen);
  }
}
const detached = value => freezeOwned(structuredClone(value));
export const DEFAULT_BUDGET = Object.freeze({maxSteps: 256, maxWallMs: 1000});
export function budgetOf(value = DEFAULT_BUDGET) {
  if (!value || Object.keys(value).some(k => !['maxSteps', 'maxWallMs'].includes(k)))
    throw new TypeError('Budget accepts only maxSteps and maxWallMs');
  const b = {...DEFAULT_BUDGET, ...value};
  if (!Number.isSafeInteger(b.maxSteps) || b.maxSteps < 1 || b.maxSteps > 4096 ||
      !Number.isFinite(b.maxWallMs) || b.maxWallMs <= 0 || b.maxWallMs > 30000)
    throw new RangeError('Each slice permits 1..4096 actual h and 0..30000 wall milliseconds');
  return Object.freeze(b);
}
const errorView = e => ({name: String(e?.name ?? 'Error'), message: String(e?.message ?? e),
  ...(e?.cleanupError !== undefined ? {cleanupError: {
    name: String(e.cleanupError?.name ?? 'Error'), message: String(e.cleanupError?.message ?? e.cleanupError)}} : {})});
const terminal = status => !['queued', 'running', 'budget-suspended'].includes(status);
const physicalRest = s => s?.shotComplete === true && s.cue?.present === false &&
  s.balls?.length === 4 && s.balls.every(b => b.state.sleeping === true) &&
  s.scene?.manager?.awake_island === null && s.scoreResult != null;

// Dependencies here exist only to test lifecycle/scheduling without claiming GPU
// compute. The public service supplies fixed importer + actual GPU world methods.
export function createExclusiveShotRunner({initialize, now, yieldControl, renderingBusy,
  deviceLost, classify = (e, phase) => e instanceof RangeError && phase !== 'yielding' ? 'unsupported' : 'failed'}) {
  let tail = Promise.resolve(), active = null, sequence = 0, closed = false, loss = null;
  const operations = new Set();
  const enqueue = task => { const result = tail.then(task); tail = result.catch(() => {}); return result; };
  function view(op) {
    const state = op.last;
    return detached({operationId: op.id, status: op.status, phase: op.phase,
      reason: op.reason, error: op.error, completed: op.status === 'complete',
      progress: {committedH: state?.frame ?? 0, outerStep: state?.outerStep ?? 0,
        outerSubstep: state?.outerSubstep ?? 0, seconds: state?.time ?? 0},
      state, events: state?.contactEvents ?? [],
      ...(op.sourceEvidence ? {sourceEvidence: op.sourceEvidence} : {}),
      scoring: {game: state?.game ?? null, result: op.status === 'complete' ? state.scoreResult : null},
      resources: op.resourceStats ? op.resourceStats() : op.resources,
      budget: op.lastBudget, slice: op.slice});
  }
  const stop = op => loss ? {status: 'device-lost', reason: loss.message} :
    op.cancelReason ? {status: 'cancelled', reason: op.cancelReason} :
      op !== active || closed ? {status: 'cancelled', reason: 'superseded'} : null;
  function observe(op, committed) {
    if (!op.world) return;
    // Existing GPU/reference owners return a detached full public snapshot from
    // step(). Copy/freeze it before retaining it instead of requesting a second
    // full world snapshot. Only legacy void (undefined) steps use the fallback.
    if (committed !== undefined && (!committed || typeof committed !== 'object' ||
        Array.isArray(committed) || !Number.isSafeInteger(committed.frame) || committed.frame < 0))
      throw new TypeError('World step must return its full committed snapshot or undefined');
    op.last = detached(committed === undefined ? op.world.snapshot() : committed);
  }
  async function finish(op, status, reason = null, error = null) {
    op.status = status; op.reason = reason; op.error = error;
    if (terminal(status)) {
      op.phase = 'finished';
      if (op.world) {
        try { observe(op); } catch (e) { op.error ??= errorView(e); }
      }
      try { await op.release?.(); } catch (e) {
        op.error ??= errorView(e);
        if (status === 'complete') { op.status = 'failed'; op.reason = 'resource-cleanup-failed'; }
      }
      op.resources = op.resourceStats?.() ?? op.resources; op.resourceStats = null;
      op.world = null; op.release = null; op.input = null;
      op.signal?.removeEventListener('abort', op.onAbort);
      operations.delete(op);
      const out = view(op); op.resolveFinished(out); return out;
    }
    return view(op);
  }
  async function execute(op, budget) {
    if (terminal(op.status)) return view(op);
    op.status = 'running'; op.reason = null; op.lastBudget = budget;
    const begin = now(), initialFrame = op.last?.frame ?? 0;
    op.slice = {committedH: 0, wallMs: 0, limit: null};
    const measure = () => { op.slice.committedH = (op.last?.frame ?? 0) - initialFrame;
      op.slice.wallMs = Math.max(0, now() - begin); };
    const interruption = async () => { const why = stop(op); return why && finish(op, why.status, why.reason); };
    try {
      let ended = await interruption(); if (ended) return ended;
      if (!op.world) {
        // Do not start GPU construction while a shared renderer has the queue.
        // The same wall budget can suspend before initialization, retaining input.
        while (true) {
          measure();
          if (op.slice.wallMs >= budget.maxWallMs) {
            op.slice.limit = 'maxWallMs'; op.phase = 'suspended';
            return finish(op, 'budget-suspended', 'maxWallMs');
          }
          op.phase = 'yielding'; await yieldControl();
          ended = await interruption(); if (ended) return ended;
          measure();
          if (op.slice.wallMs >= budget.maxWallMs || renderingBusy()) continue;
          break;
        }
        op.phase = 'initializing';
        // initialize must check this before/after each awaited import/device call.
        const check = () => { const why = stop(op); if (why) throw Object.assign(new Error(why.reason), {interruption: why}); };
        const own = await initialize(op.input, check);
        op.sourceEvidence = own.sourceEvidence ? detached(own.sourceEvidence) : null;
        op.world = own.world; op.release = own.release; op.resourceStats = own.resourceStats ?? null; op.input = null;
        observe(op); measure();
        ended = await interruption(); if (ended) return ended;
      }
      while (true) {
        ended = await interruption(); if (ended) return ended;
        if (op.last?.shotComplete) {
          if (!physicalRest(op.last)) throw new Error('World completion lacked original physical-rest evidence');
          measure(); return finish(op, 'complete', 'world-physical-rest');
        }
        measure();
        if (op.slice.committedH >= budget.maxSteps || op.slice.wallMs >= budget.maxWallMs) {
          op.slice.limit = op.slice.committedH >= budget.maxSteps ? 'maxSteps' : 'maxWallMs';
          op.phase = 'suspended'; return finish(op, 'budget-suspended', op.slice.limit);
        }
        // Every h yields a task turn before another submission. A renderer can
        // retain the shared queue; wall budget still advances while it is busy.
        op.phase = 'yielding';
        await yieldControl();
        ended = await interruption(); if (ended) return ended;
        measure();
        if (op.slice.wallMs >= budget.maxWallMs) continue;
        if (renderingBusy()) continue;
        op.phase = 'stepping';
        // One atomic existing world h, no external dt, pose or state injection.
        const committed = await op.world.step();
        observe(op, committed); measure();
        ended = await interruption(); if (ended) return ended;
      }
    } catch (e) {
      if (e?.resourceCounts) op.resources = detached(e.resourceCounts);
      if (!op.last && e?.lastCommittedState) op.last = detached(e?.lastCommittedState);
      measure();
      const why = stop(op) ?? e?.interruption;
      return finish(op, why?.status ?? classify(e, op.phase), why?.reason ?? 'operation-failed', errorView(e));
    }
  }
  function schedule(op, budget) {
    if (op.pending) throw new Error('Operation already has a slice in flight');
    const task = enqueue(async () => {
      let out = await execute(op, budget);
      // A cancellation can arrive after execute marks suspension but before
      // its promise resolves. Recheck without releasing the serial queue.
      const why = stop(op);
      if (!terminal(op.status) && why) out = await finish(op, why.status, why.reason);
      return out;
    });
    const result = task.finally(() => { if (op.pending === result) op.pending = null; });
    op.pending = result; return result;
  }
  function cancel(op, reason = 'cancelled-by-caller') {
    if (terminal(op.status)) return op.finished;
    op.cancelReason ??= reason;
    // Always append a cleanup barrier, even when the current slice is resolving.
    // start() queues this barrier BEFORE a replacement initializer. Multiple
    // abort/loss/supersession paths coalesce; a terminal owner is released once.
    op.cancelPending ??= enqueue(async () => {
      if (terminal(op.status)) return view(op);
      const why = stop(op);
      return finish(op, why?.status ?? 'cancelled', why?.reason ?? op.cancelReason);
    });
    return op.cancelPending;
  }
  Promise.resolve(deviceLost).then(info => {
    loss = {message: String(info?.message || info?.reason || 'GPU device lost')};
    for (const op of operations) cancel(op, 'device-lost');
  }, e => {
    loss = {message: String(e?.message ?? 'GPU device loss notification failed')};
    for (const op of operations) cancel(op, 'device-lost');
  });
  return Object.freeze({
    start(input, options = {}) {
      if (!options || Object.keys(options).some(k => !['signal', 'budget'].includes(k)))
        throw new TypeError('Start accepts signal and budget only');
      const {signal, budget} = options;
      if (closed) throw new Error('Shot service is disposed');
      const limits = budgetOf(budget);
      if (signal != null && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function' ||
          typeof signal.removeEventListener !== 'function')) throw new TypeError('AbortSignal required');
      // Copy before ANY await and before cancelling the previous owner.
      const owned = structuredClone(input);
      rejectSharedMemory(owned);
      freezeOwned(owned);
      if (active && !terminal(active.status)) cancel(active, 'superseded');
      let resolveFinished;
      const finished = new Promise(resolve => { resolveFinished = resolve; });
      const op = {id: ++sequence, input: owned, signal, status: 'queued', phase: 'queued',
        reason: null, error: null, last: null, lastBudget: limits, slice: null, world: null,
        release: null, resourceStats: null, resources: null, pending: null, cancelPending: null, cancelReason: null, resolveFinished, finished};
      op.onAbort = () => { cancel(op, 'aborted'); };
      signal?.addEventListener('abort', op.onAbort, {once: true});
      if (signal?.aborted) op.cancelReason = 'aborted';
      active = op; operations.add(op);
      const result = schedule(op, limits);
      return Object.freeze({id: op.id, result, finished,
        snapshot: () => view(op), cancel: () => cancel(op),
        resume(options = {}) {
          if (Object.keys(options).some(k => k !== 'budget')) throw new TypeError('Resume accepts only a new budget');
          if (op.status !== 'budget-suspended' || op.pending || stop(op)) throw new Error('Only an idle budget-suspended operation can resume');
          return schedule(op, budgetOf(options.budget));
        }});
    },
    snapshot: () => active ? view(active) : null,
    async dispose() {
      closed = true;
      for (const op of operations) cancel(op, 'service-disposed');
      await tail;
    }
  });
}
