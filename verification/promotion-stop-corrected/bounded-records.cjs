'use strict';

// Local-only, synchronous bounded NDJSON. This accepts trusted plain data records,
// not arbitrary JavaScript objects. No original object is passed to stringify.
// JavaScript has no bounded ownKeys primitive: the early enumerable-key scan
// prevents an unbounded application-level traversal, but V8 can still allocate
// an enumeration snapshot. Hidden/symbol-heavy source objects must not be used
// as an adversarial input boundary. Proxies are rejected before any reflection.
const fs = require('node:fs');
const { types } = require('node:util');

const DEFAULT_LIMITS = Object.freeze({
  maxDepth: 12,
  maxNodes: 4096,
  maxObjectKeys: 128,
  maxArrayLength: 256,
  maxStringChars: 8192,
  maxStringBytes: 16384,
  maxLineBytes: 32768, // Includes the trailing NDJSON newline.
  maxBytes: 1048576,
  maxRecords: 128,
});
const CEILINGS = Object.freeze({
  maxDepth: 64,
  maxNodes: 65536,
  maxObjectKeys: 2048,
  maxArrayLength: 4096,
  maxStringChars: 262144,
  maxStringBytes: 1048576,
  maxLineBytes: 1048576,
  maxBytes: 67108864,
  maxRecords: 65536,
});
const writerStates = new WeakMap();

class BoundedRecordError extends Error {
  constructor(code) {
    super(code);
    this.name = 'BoundedRecordError';
    this.code = code;
  }
}
const fail = (code) => { throw new BoundedRecordError(code); };
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function normalizeLimits(options = {}) {
  if (!options || typeof options !== 'object' || types.isProxy(options)
      || ![null, Object.prototype].includes(Object.getPrototypeOf(options))) {
    fail('INVALID_LIMITS');
  }
  const result = Object.create(null);
  const stringAlias = Object.getOwnPropertyDescriptor(options, 'maxStringLength');
  if (stringAlias && !own(stringAlias, 'value')) fail('INVALID_LIMITS');
  // Only known options are read; getters and coercions are never invoked.
  for (const key of Object.keys(DEFAULT_LIMITS)) {
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (descriptor && !own(descriptor, 'value')) fail('INVALID_LIMITS');
    if (key === 'maxStringChars' && descriptor && stringAlias
        && descriptor.value !== stringAlias.value) fail('INVALID_LIMITS');
    const value = descriptor ? descriptor.value
      : key === 'maxStringChars' && stringAlias ? stringAlias.value : DEFAULT_LIMITS[key];
    const minimum = ['maxDepth', 'maxBytes', 'maxRecords'].includes(key) ? 0 : 1;
    if (!Number.isSafeInteger(value) || value < minimum || value > CEILINGS[key]) {
      fail('INVALID_LIMITS');
    }
    result[key] = value;
  }
  return Object.freeze(result);
}

function encodeWithLimits(value, limits, availableBytes = limits.maxBytes) {
  let nodes = 0;
  let lineBytes = 1; // Account for newline before traversing anything.
  const lineLimit = Math.min(limits.maxLineBytes, availableBytes);
  const byteFailure = availableBytes < limits.maxLineBytes ? 'MAX_BYTES' : 'MAX_LINE_BYTES';
  if (lineBytes > lineLimit) fail(byteFailure);
  const ancestors = new WeakSet();
  const add = (count) => {
    if (count > lineLimit - lineBytes) fail(byteFailure);
    lineBytes += count;
  };

  function stringBytes(value) {
    // Check code-unit length before scanning a potentially huge string.
    if (value.length > limits.maxStringChars) fail('MAX_STRING_CHARS');
    let utf8Bytes = 0;
    let encodedBytes = 2;
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code <= 0x7f) {
        utf8Bytes += 1;
        encodedBytes += code === 0x22 || code === 0x5c ? 2
          : [8, 9, 10, 12, 13].includes(code) ? 2 : code < 0x20 ? 6 : 1;
      } else if (code <= 0x7ff) {
        utf8Bytes += 2;
        encodedBytes += 2;
      } else if (code >= 0xd800 && code <= 0xdbff
          && i + 1 < value.length && value.charCodeAt(i + 1) >= 0xdc00
          && value.charCodeAt(i + 1) <= 0xdfff) {
        utf8Bytes += 4;
        encodedBytes += 4;
        i += 1;
      } else {
        utf8Bytes += 3;
        encodedBytes += code >= 0xd800 && code <= 0xdfff ? 6 : 3;
      }
      if (utf8Bytes > limits.maxStringBytes) fail('MAX_STRING_BYTES');
      if (encodedBytes > lineLimit - lineBytes) fail(byteFailure);
    }
    add(encodedBytes);
  }

  function inspectKeys(object, maximum) {
    let count = 0;
    // Never read object[key] here. Stop at the first excess enumerable key.
    for (const key in object) {
      if (!own(object, key)) fail('UNSUPPORTED_INHERITED_PROPERTY');
      if (++count > maximum) fail('MAX_OBJECT_KEYS');
    }
    const keys = Reflect.ownKeys(object);
    if (keys.length > maximum) fail('MAX_OBJECT_KEYS');
    for (const key of keys) {
      if (typeof key !== 'string') fail('UNSUPPORTED_SYMBOL_KEY');
      if (key === 'toJSON') fail('UNSUPPORTED_TO_JSON');
    }
    return keys;
  }

  function visit(source, depth) {
    if (depth > limits.maxDepth) fail('MAX_DEPTH');
    if (++nodes > limits.maxNodes) fail('MAX_NODES');
    if (source === null) { add(4); return null; }
    switch (typeof source) {
      case 'string': stringBytes(source); return source;
      case 'boolean': add(source ? 4 : 5); return source;
      case 'number':
        if (!Number.isFinite(source)) fail('NONFINITE_NUMBER');
        add(String(source).length);
        return source;
      case 'object': break;
      default: fail('UNSUPPORTED_VALUE');
    }
    if (types.isProxy(source)) fail('UNSUPPORTED_PROXY');
    if (ancestors.has(source)) fail('CYCLE');
    const isArray = Array.isArray(source);
    const prototype = Object.getPrototypeOf(source);
    if (prototype !== null && prototype !== (isArray ? Array.prototype : Object.prototype)) {
      fail('UNSUPPORTED_OBJECT');
    }
    if ((prototype && Object.getOwnPropertyDescriptor(prototype, 'toJSON'))
        || (isArray && Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON'))) {
      fail('UNSUPPORTED_TO_JSON');
    }
    ancestors.add(source);
    add(2);
    if (isArray) {
      const length = Object.getOwnPropertyDescriptor(source, 'length').value;
      if (length > limits.maxArrayLength) fail('MAX_ARRAY_LENGTH');
      const keys = inspectKeys(source, length + 1);
      if (keys.length !== length + 1) fail('UNSUPPORTED_ARRAY_SHAPE');
      const target = [];
      Object.setPrototypeOf(target, null);
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(source, String(index));
        if (!descriptor) fail('UNSUPPORTED_ARRAY_SHAPE');
        if (!own(descriptor, 'value')) fail('UNSUPPORTED_ACCESSOR');
        if (!descriptor.enumerable) fail('UNSUPPORTED_NONENUMERABLE');
        if (index) add(1);
        target[index] = visit(descriptor.value, depth + 1);
      }
      ancestors.delete(source);
      return target;
    }
    const keys = inspectKeys(source, limits.maxObjectKeys);
    const target = Object.create(null);
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (!own(descriptor, 'value')) fail('UNSUPPORTED_ACCESSOR');
      if (!descriptor.enumerable) fail('UNSUPPORTED_NONENUMERABLE');
      if (index) add(1);
      stringBytes(key);
      add(1);
      target[key] = visit(descriptor.value, depth + 1);
    }
    ancestors.delete(source);
    return target;
  }

  const boundedClone = visit(value, 0);
  const encoded = JSON.stringify(boundedClone);
  // Defense in depth. This only examines the already bounded clone/string.
  if (Buffer.byteLength(encoded, 'utf8') + 1 !== lineBytes) fail('ENCODING_MISMATCH');
  return encoded;
}

// Returns JSON text without a newline. maxLineBytes and maxBytes both include
// the eventual newline. maxStringLength is an alias for maxStringChars (UTF-16
// code units); maxStringBytes separately bounds each key/value's UTF-8 bytes.
function encodeBounded(value, options = {}) {
  return encodeWithLimits(value, normalizeLimits(options));
}

function snapshot(state) {
  return Object.freeze({
    complete: state.closed && state.failures === 0,
    bytes: state.bytes,
    records: state.records,
    failures: state.failures,
    reason: state.reason,
    closed: state.closed,
  });
}

function recordFailure(state, reason) {
  state.failures = Math.min(Number.MAX_SAFE_INTEGER, state.failures + 1);
  if (state.reason === null) state.reason = reason;
  return false;
}

function errorCode(error, fallback) {
  return error instanceof BoundedRecordError ? error.code : fallback;
}

function createWriter(path, options = {}) {
  const limits = normalizeLimits(options);
  const state = { bytes: 0, records: 0, failures: 0, reason: null, closed: false };
  let descriptor = null;
  try {
    if (typeof path !== 'string' || path.length === 0 || path.length > 4096) fail('INVALID_PATH');
    descriptor = fs.openSync(path, 'wx', 0o600);
  } catch (error) {
    recordFailure(state, errorCode(error, 'OPEN_FAILED'));
  }
  const writer = Object.freeze({
    append(record) {
      if (state.closed) return recordFailure(state, 'WRITER_CLOSED');
      if (state.failures) return recordFailure(state, 'WRITER_FAILED');
      if (state.records >= limits.maxRecords) return recordFailure(state, 'MAX_RECORDS');
      let encoded;
      try { encoded = encodeWithLimits(record, limits, limits.maxBytes - state.bytes); }
      catch (error) { return recordFailure(state, errorCode(error, 'ENCODE_FAILED')); }
      const size = Buffer.byteLength(encoded, 'utf8') + 1;
      if (size > limits.maxBytes - state.bytes) return recordFailure(state, 'MAX_BYTES');
      const buffer = Buffer.from(encoded + '\n', 'utf8');
      let offset = 0;
      try {
        while (offset < buffer.length) {
          const written = fs.writeSync(descriptor, buffer, offset, buffer.length - offset, null);
          if (!Number.isSafeInteger(written) || written <= 0 || written > buffer.length - offset) {
            fail('INVALID_WRITE_RESULT');
          }
          offset += written;
          state.bytes += written;
        }
      } catch (error) {
        return recordFailure(state, errorCode(error, 'WRITE_FAILED'));
      }
      state.records += 1;
      return true;
    },
    stats() { return snapshot(state); },
    close() {
      if (!state.closed) {
        state.closed = true;
        if (descriptor !== null) {
          try { fs.closeSync(descriptor); }
          catch { recordFailure(state, 'CLOSE_FAILED'); }
          descriptor = null;
        }
      }
      return state.failures === 0;
    },
  });
  writerStates.set(writer, state);
  return writer;
}

// Standalone summary has its own file/byte budget, so a failed raw log does not
// prevent saving it. Its authoritative top-level pass can never override a raw
// recording failure or an unclosed raw writer. Call rawWriter.close() first.
// A forged stats() method is not accepted in place of a writer from this module.
function writeSummary(path, summary, rawWriter, options = {}) {
  if (!writerStates.has(rawWriter)) fail('INVALID_WRITER');
  const rawStats = snapshot(writerStates.get(rawWriter));
  const limits = normalizeLimits(options);
  let record;
  let preparationFailure = null;
  try {
    record = JSON.parse(encodeWithLimits(summary, limits));
    if (record === null || typeof record !== 'object' || Array.isArray(record)) fail('INVALID_SUMMARY');
    record.pass = record.pass === true && rawStats.complete;
    record.recording = rawStats;
    encodeWithLimits(record, limits);
  } catch (error) {
    preparationFailure = errorCode(error, 'SUMMARY_ENCODE_FAILED');
    record = { pass: false, recording: rawStats, summaryFailure: preparationFailure };
  }
  const output = createWriter(path, { ...limits, maxRecords: 1 });
  output.append(record);
  output.close();
  const result = output.stats();
  return Object.freeze({
    ...result,
    pass: result.complete && preparationFailure === null && record.pass === true,
    summaryFailure: preparationFailure,
  });
}

module.exports = Object.freeze({
  BoundedRecordError,
  DEFAULT_LIMITS,
  encodeBounded,
  createWriter,
  writeSummary,
});
