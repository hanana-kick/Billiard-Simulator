// SPDX-License-Identifier: Apache-2.0
// Transport only. No source-world construction, physics, or candidate proposal.
export const VERSION = 1;
export const PARAMETER_KEYS = Object.freeze(['angle', 'elevation', 'speed', 'tipX', 'tipY']);
export const INPUT_WORDS = 16;
export const RESULT_WORDS = 4;
export const UNSET = 0xffffffff;
export const STATUS = Object.freeze({PENDING: 0, RUNNING: 1, PASS: 2, MISS: 3,
  UNSUPPORTED: 4, INCOMPLETE: 5, CANCELLED: 6, FAILED: 7, REJECTED: 8});
export const REASON = Object.freeze({NONE: 0, NONFINITE_INPUT: 1, SOURCE_INPUT_RANGE: 2,
  CUE_BLOCKED: 3, CAPACITY: 4, NUMERIC: 5, PHYSICS_SCOPE: 6, HORIZON: 7,
  CANCELLED: 8, DEVICE_LOST: 9, STALE_SOURCE: 10, INCOMPLETE_COMMIT: 11,
  CUE_CONTINUATION_PROFILE: 12});
const names = Object.fromEntries(Object.entries(STATUS).map(([name, code]) => [code, name.toLowerCase()]));
const uint = x => Number.isInteger(x) && x >= 0 && x < UNSET;
const ownData = (value, keys, label) => {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length || keys.some(k => !descriptors[k] || !('value' in descriptors[k])))
    throw new TypeError(label + ' requires exactly ' + keys.join(', '));
};

/** Preserve the five Number bit patterns; numerical admission belongs to GPU.
 * A wave may contain arbitrary solver probes or an explicitly chosen grid.
 * This API deliberately does not quantize, wrap, clamp, project, or propose them.
 */
export function packCandidates(rows, {selectedIndex, ruleId = 0, maxCandidates = 4096} = {}) {
  if (!Array.isArray(rows) || !rows.length || !Number.isInteger(maxCandidates) || maxCandidates < 1 || rows.length > maxCandidates)
    throw new RangeError('Nonempty bounded candidate rows required');
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3 || !uint(ruleId))
    throw new RangeError('Original four-ball selection and unsigned rule ID required');
  const bytes = new ArrayBuffer(rows.length * INPUT_WORDS * 4), view = new DataView(bytes), seen = new Set();
  rows.forEach((row, index) => {
    ownData(row, ['id', 'settings'], 'Candidate');
    if (!uint(row.id) || seen.has(row.id)) throw new RangeError('Distinct unsigned candidate IDs required');
    seen.add(row.id); ownData(row.settings, PARAMETER_KEYS, 'Settings');
    const base = index * INPUT_WORDS * 4;
    view.setUint32(base, row.id, true);
    PARAMETER_KEYS.forEach((key, axis) => {
      if (typeof row.settings[key] !== 'number') throw new TypeError('Number-valued ' + key + ' required');
      view.setFloat64(base + 8 + axis * 8, row.settings[key], true);
    });
    view.setUint32(base + 48, selectedIndex, true); view.setUint32(base + 52, ruleId, true);
  });
  return new Uint32Array(bytes);
}

export function unpackCandidates(words) {
  if (!(words instanceof Uint32Array) || words.buffer instanceof SharedArrayBuffer || words.length % INPUT_WORDS)
    throw new TypeError('Whole owned candidate records required');
  const view = new DataView(words.buffer, words.byteOffset, words.byteLength), result = [];
  for (let i = 0; i < words.length / INPUT_WORDS; i++) {
    const base = i * INPUT_WORDS * 4;
    result.push({id: view.getUint32(base, true), settings: Object.fromEntries(PARAMETER_KEYS.map((key, axis) =>
      [key, view.getFloat64(base + 8 + axis * 8, true)])), selectedIndex: view.getUint32(base + 48, true), ruleId: view.getUint32(base + 52, true)});
  }
  return result;
}

export function initialResults(input) {
  if (!(input instanceof Uint32Array) || input.length % INPUT_WORDS) throw new TypeError('Packed candidate records required');
  const out = new Uint32Array(input.length / INPUT_WORDS * RESULT_WORDS);
  for (let i = 0; i < out.length / RESULT_WORDS; i++) out.set([input[i * INPUT_WORDS], STATUS.PENDING, UNSET, REASON.NONE], i * RESULT_WORDS);
  return out;
}

/** Never collapse unsupported/incomplete/cancelled into an evaluated miss. */
export function decodeResults(words, expectedIds, {allowPending = false} = {}) {
  if (!(words instanceof Uint32Array) || words.buffer instanceof SharedArrayBuffer || !Array.isArray(expectedIds) || words.length !== expectedIds.length * RESULT_WORDS)
    throw new TypeError('Complete detached terminal result range required');
  return expectedIds.map((id, index) => {
    const [actual, status, pass, reason] = words.subarray(index * RESULT_WORDS, (index + 1) * RESULT_WORDS);
    if (actual !== id || !Object.hasOwn(names, status) || !Object.values(REASON).includes(reason)) throw new Error('Invalid candidate result identity/status/reason');
    const evaluated = status === STATUS.PASS || status === STATUS.MISS;
    if (evaluated ? pass !== (status === STATUS.PASS ? 1 : 0) : pass !== UNSET) throw new Error('Unevaluated status must never masquerade as a miss');
    if (!allowPending && status < STATUS.PASS) throw new Error('Incomplete candidate wave');
    return Object.freeze({id, status: names[status], pass: evaluated ? pass === 1 : null, reasonCode: reason});
  });
}

export function abiWGSL() {
  return Object.entries(STATUS).map(([name, code]) => `const RC_${name}:u32=${code}u;`).join('\n') + '\n' +
    `const RC_UNSET:u32=0xffffffffu;\nconst RC_INPUT_WORDS:u32=${INPUT_WORDS}u;\nconst RC_RESULT_WORDS:u32=${RESULT_WORDS}u;\n`;
}
