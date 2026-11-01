// SPDX-License-Identifier: Apache-2.0
// Bounds and ownership only. This module does not admit a physical source seed.
import {assertPlainOwnedData, copyCurrentSourceWorkerInput, exactKeys, errorData} from './four-ball-worker-protocol.mjs';
export const EVALUATION_LIMITS = Object.freeze({maxShots: 16, maxInputBytes: 64 * 1024 * 1024,
  maxShotH: 65536, maxTotalH: 262144});
export function evaluationLimits(value = {}) {
  exactKeys(value, Object.keys(EVALUATION_LIMITS), 'Evaluation limits accept maxShots, maxInputBytes, maxShotH and maxTotalH only');
  const limits = {...EVALUATION_LIMITS, ...value};
  for (const [name, limit] of Object.entries(limits)) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > EVALUATION_LIMITS[name])
      throw new RangeError(name + ' must be 1..' + EVALUATION_LIMITS[name]);
  }
  return Object.freeze(limits);
}
const typedBuffer = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'buffer').get;
const dataBuffer = Object.getOwnPropertyDescriptor(DataView.prototype, 'buffer').get;
const byteLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
// A conservative data-accounting bound, not a claim about engine RSS. Count
// complete backing stores, not just view windows, before structuredClone.
function accountData(root, max) {
  const pending = [root], seen = new WeakSet(); let bytes = 0, nodes = 0;
  function add(n) { bytes += n; if (bytes > max) throw new RangeError('Evaluation inputs exceed maxInputBytes'); }
  while (pending.length) {
    if (++nodes > 100000 || pending.length > 100000) throw new RangeError('Evaluation input exceeds bounded node count');
    const value = pending.pop();
    if (typeof value === 'string') {add(value.length * 2 + 16); continue;}
    if (typeof value === 'bigint') {add(value.toString().length * 2 + 16); continue;}
    if (!value || typeof value !== 'object') {add(8); continue;}
    if (seen.has(value)) continue; seen.add(value); add(64);
    if (ArrayBuffer.isView(value)) {
      let buffer; try {buffer = Reflect.apply(typedBuffer, value, []);} catch {buffer = Reflect.apply(dataBuffer, value, []);}
      pending.push(buffer); continue;
    }
    if (value instanceof ArrayBuffer) {add(Reflect.apply(byteLength, value, [])); continue;}
    for (const key of Reflect.ownKeys(value)) {
      add(key.length * 2 + 32);
      pending.push(Object.getOwnPropertyDescriptor(value, key).value);
      if (pending.length > 100000) throw new RangeError('Evaluation input exceeds bounded node count');
    }
  }
  return bytes;
}
export function copyEvaluationInputs(shots, limits) {
  if (!Array.isArray(shots) || shots.length < 1 || shots.length > limits.maxShots)
    throw new RangeError('Evaluation requires 1..' + limits.maxShots + ' shots');
  // Reject getters, shared aliases and host objects before any copy or old-owner
  // cancellation. Metadata access must not execute caller code.
  assertPlainOwnedData(shots);
  // Each shot is cloned independently below. Reused ordinary buffers or
  // metadata across entries therefore consume their full per-entry footprint,
  // not the single shared identity counted by one whole-list traversal.
  let inputBytes = 64 + shots.length * 8;
  const ids = new Set();
  for (const shot of shots) inputBytes += accountData(shot, limits.maxInputBytes - inputBytes);
  for (const shot of shots) {
    exactKeys(shot, ['id', 'snapshot', 'preStrikeSnapshot', 'capture'], 'Each evaluation input accepts id, raw snapshot and capture only');
    if (typeof shot.id !== 'string' || !shot.id || shot.id.length > 128 || ids.has(shot.id))
      throw new TypeError('Unique nonempty shot IDs of at most 128 characters required');
    ids.add(shot.id);
  }
  const entries = shots.map((shot, index) => {
    try {return {id: shot.id, index, input: copyCurrentSourceWorkerInput({snapshot: shot.snapshot, capture: shot.capture,
      ...(Object.hasOwn(shot, 'preStrikeSnapshot') ? {preStrikeSnapshot: shot.preStrikeSnapshot} : {})})};}
    catch (error) {return {id: shot.id, index, input: null, rejected: errorData(error)};}
  });
  return {entries, inputBytes};
}
