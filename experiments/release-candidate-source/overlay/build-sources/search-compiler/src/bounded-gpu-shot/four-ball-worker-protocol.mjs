// SPDX-License-Identifier: Apache-2.0
// Transport data only. This module never imports the decoder, hull authority or world.
import {budgetOf, freezeOwned} from './lifecycle.mjs';
export {budgetOf};
export const PROTOCOL = 'experimental-bounded-four-ball-worker-v1';
export const isTerminal = status => ['complete', 'unsupported', 'cancelled', 'device-lost', 'failed'].includes(status);
export const errorData = error => ({name: String(error?.name ?? 'Error'), message: String(error?.message ?? error)});
export const copyView = value => freezeOwned(structuredClone(value));
export const deferred = () => {let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve};};
export function exactKeys(value, keys, label) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      Reflect.ownKeys(value).some(k => typeof k !== 'string' || !keys.includes(k)))
    throw new TypeError(label);
}
// Inspect data descriptors BEFORE cloning. structuredClone otherwise invokes
// getters and preserves SharedArrayBuffer aliases hidden in a view/host object.
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'byteLength').get;
const dataViewBuffer = Object.getOwnPropertyDescriptor(DataView.prototype, 'buffer').get;
const sharedLength = typeof SharedArrayBuffer === 'function' ? Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, 'byteLength').get : null;
function isShared(value) {
  if (!sharedLength) return false;
  try { Reflect.apply(sharedLength, value, []); return true; } catch { return false; }
}
function viewBuffer(value) {
  try { return Reflect.apply(typedBuffer, value, []); } catch { return Reflect.apply(dataViewBuffer, value, []); }
}
export function assertPlainOwnedData(root) {
  const pending = [[root, 0]], seen = new WeakSet(); let nodes = 0;
  while (pending.length) {
    const [value, depth] = pending.pop();
    if (++nodes > 2000000 || depth > 128) throw new RangeError('Worker capture exceeds bounded data limits');
    if (typeof value === 'function' || typeof value === 'symbol') throw new TypeError('Worker capture requires plain data');
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    const buffer = ArrayBuffer.isView(value) ? viewBuffer(value) : value;
    if (isShared(buffer))
      throw new TypeError('SharedArrayBuffer is not owned worker input');
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) continue;
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null)
      throw new TypeError('Worker capture rejects host objects and hidden storage');
    for (const key of Reflect.ownKeys(value)) {
      const desc = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !Object.hasOwn(desc, 'value')) throw new TypeError('Worker capture rejects accessors and symbols');
      pending.push([desc.value, depth + 1]);
    }
  }
}
export function copyWorkerInput(input) { return copyRawInput(input, false); }
export function copyCurrentSourceWorkerInput(input) { return copyRawInput(input, true); }
function copyRawInput(input, currentSource) {
  assertPlainOwnedData(input);
  const live = currentSource && input?.capture?.boundary === 'liveRegisteredStrikeCreated';
  exactKeys(input, live ? ['snapshot', 'preStrikeSnapshot', 'capture'] : ['snapshot', 'capture'], 'Worker start accepts only raw snapshot bytes and capture');
  if (!(input.snapshot instanceof Uint8Array) || !Reflect.apply(typedLength, input.snapshot, []) || Reflect.apply(typedLength, input.snapshot, []) > 32 * 1024 * 1024)
    throw new TypeError('Worker snapshot requires 1..33554432 Uint8Array bytes');
  if (live && (!(input.preStrikeSnapshot instanceof Uint8Array) || !Reflect.apply(typedLength, input.preStrikeSnapshot, []) || Reflect.apply(typedLength, input.preStrikeSnapshot, []) > 32 * 1024 * 1024))
    throw new TypeError('Pre-strike snapshot requires 1..33554432 Uint8Array bytes');
  if (live) {
    exactKeys(input.capture, ['boundary', 'candidateInput', 'apiJournalLength', 'application',
      'strikeCreationJournal', 'nativeRestoreUsed', 'preStrikeApplication', 'readiness'], 'Raw live fork capture required, never a projected seed');
    if (input.capture.candidateInput !== true || input.capture.nativeRestoreUsed !== true)
      throw new RangeError('Live source fork capture must preserve its native restore provenance');
    const owned = structuredClone(input); assertPlainOwnedData(owned); return owned;
  }
  const configured = currentSource && ['goalStrikeCreated', 'secondStrikeCreated'].includes(input.capture?.boundary);
  exactKeys(input.capture, ['boundary', 'candidateInput', 'nativeSteps', 'apiJournalLength',
    ...(configured ? [] : ['modeCreationJournal']), 'strikeCreationJournal', 'application'], 'Worker input must be the raw initial capture, never a projected seed');
  if ((!configured && input.capture.boundary !== 'strikeCreated') || input.capture.candidateInput !== true)
    throw new RangeError('Only the original initial strike capture is supported');
  const owned = structuredClone(input);
  assertPlainOwnedData(owned);
  return owned;
}
export function emptyView(id, status = 'queued', reason = null, error = null) {
  return copyView({operationId: id, status, phase: status === 'queued' ? 'queued' : 'finished', reason, error,
    completed: false, progress: {committedH: 0, outerStep: 0, outerSubstep: 0, seconds: 0},
    state: null, events: [], scoring: {game: null, result: null}, resources: null, budget: null, slice: null});
}
