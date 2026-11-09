'use strict';

// No network, browser, subprocess, or persistent fixtures. Emits one JSON line.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { encodeBounded, createWriter, writeSummary } = require('./bounded-records.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bounded-records-test-'));
const results = [];
let sequence = 0;
const file = () => path.join(directory, `record-${++sequence}.ndjson`);
const errorIs = (code) => (error) => error && error.code === code;

function test(name, callback) {
  try { callback(); results.push({ name, pass: true }); }
  catch (error) {
    results.push({ name, pass: false, error: String(error.message).slice(0, 240) });
  }
}

function rejectedBeforeStringify(value, code, limits) {
  const original = JSON.stringify;
  let calls = 0;
  JSON.stringify = (...args) => { calls += 1; return original(...args); };
  try { assert.throws(() => encodeBounded(value, limits), errorIs(code)); }
  finally { JSON.stringify = original; }
  assert.equal(calls, 0, 'rejection must happen before JSON.stringify');
}

function withPatchedFs(method, replacement, callback) {
  const original = fs[method];
  fs[method] = replacement(original);
  try { callback(); } finally { fs[method] = original; }
}

try {
  test('round-trip and exact Unicode/escape byte boundaries', () => {
    const value = { ascii: 'a"\\\n\u0000', text: '한글é😀', lone: '\ud800', n: -0, yes: true, nil: null };
    const json = JSON.stringify(value);
    const bytes = Buffer.byteLength(json) + 1;
    assert.equal(encodeBounded(value, { maxLineBytes: bytes }), json);
    rejectedBeforeStringify(value, 'MAX_LINE_BYTES', { maxLineBytes: bytes - 1 });
    for (const scalar of [null, false, 1e21, -1e-7, Number.MAX_VALUE, Number.MIN_VALUE, '\udfff']) {
      assert.equal(encodeBounded(scalar), JSON.stringify(scalar));
    }
  });

  test('huge strings and bounded string-length alias', () => {
    rejectedBeforeStringify({ value: 'x'.repeat(1000000) }, 'MAX_STRING_CHARS');
    rejectedBeforeStringify('xxxx', 'MAX_STRING_CHARS', { maxStringLength: 3 });
    assert.equal(encodeBounded('xxx', { maxStringLength: 3 }), '"xxx"');
  });

  test('huge keys and multibyte string budget', () => {
    rejectedBeforeStringify({ ['x'.repeat(100000)]: true }, 'MAX_STRING_CHARS');
    rejectedBeforeStringify('😀😀', 'MAX_STRING_BYTES', { maxStringBytes: 7 });
    assert.equal(encodeBounded('😀😀', { maxStringBytes: 8 }), '"😀😀"');
  });

  test('deep trees stop at configured depth', () => {
    let value = null;
    for (let index = 0; index < 10000; index += 1) value = { child: value };
    rejectedBeforeStringify(value, 'MAX_DEPTH');
    assert.equal(encodeBounded(null, { maxDepth: 0 }), 'null');
    rejectedBeforeStringify({ a: null }, 'MAX_DEPTH', { maxDepth: 0 });
  });

  test('huge arrays are rejected from length before element access', () => {
    let calls = 0;
    const value = new Array(100000000);
    Object.defineProperty(value, '0', { get() { calls += 1; throw new Error('not reached'); } });
    rejectedBeforeStringify(value, 'MAX_ARRAY_LENGTH');
    assert.equal(calls, 0);
  });

  test('object key and total-node limits', () => {
    const value = Object.create(null);
    for (let index = 0; index < 10000; index += 1) value[`k${index}`] = index;
    rejectedBeforeStringify(value, 'MAX_OBJECT_KEYS', { maxObjectKeys: 4 });
    rejectedBeforeStringify([1, 2, 3], 'MAX_NODES', { maxNodes: 3 });
    assert.equal(encodeBounded([1, 2, 3], { maxNodes: 4 }), '[1,2,3]');
  });

  test('cycles fail but bounded repeated references are allowed', () => {
    const cycle = {}; cycle.self = cycle;
    rejectedBeforeStringify(cycle, 'CYCLE');
    const shared = { n: 1 };
    assert.equal(encodeBounded({ a: shared, b: shared }), '{"a":{"n":1},"b":{"n":1}}');
  });

  test('getters and toJSON are rejected without invocation', () => {
    let calls = 0;
    const getter = {};
    Object.defineProperty(getter, 'x', { enumerable: true, get() { calls += 1; return 1; } });
    rejectedBeforeStringify(getter, 'UNSUPPORTED_ACCESSOR');
    rejectedBeforeStringify({ toJSON() { calls += 1; return {}; } }, 'UNSUPPORTED_TO_JSON');
    const hook = {};
    Object.defineProperty(hook, 'toJSON', { get() { calls += 1; return () => 1; } });
    rejectedBeforeStringify(hook, 'UNSUPPORTED_TO_JSON');
    assert.equal(calls, 0);
  });

  test('inherited toJSON cannot execute', () => {
    let calls = 0;
    const previous = Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON');
    Object.defineProperty(Array.prototype, 'toJSON', {
      configurable: true, get() { calls += 1; throw new Error('not reached'); },
    });
    try { rejectedBeforeStringify([1], 'UNSUPPORTED_TO_JSON'); }
    finally {
      if (previous) Object.defineProperty(Array.prototype, 'toJSON', previous);
      else delete Array.prototype.toJSON;
    }
    assert.equal(calls, 0);
  });

  test('proxies fail before any trap, including revoked proxies', () => {
    let calls = 0;
    const value = new Proxy({}, {
      ownKeys() { calls += 1; throw new Error('not reached'); },
      getPrototypeOf() { calls += 1; throw new Error('not reached'); },
      get() { calls += 1; throw new Error('not reached'); },
    });
    rejectedBeforeStringify(value, 'UNSUPPORTED_PROXY');
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    rejectedBeforeStringify(revoked.proxy, 'UNSUPPORTED_PROXY');
    assert.equal(calls, 0);
  });

  test('unsupported and nonfinite values are never omitted', () => {
    for (const value of [undefined, 1n, Symbol('x'), () => 1]) {
      rejectedBeforeStringify({ value }, 'UNSUPPORTED_VALUE');
      rejectedBeforeStringify([value], 'UNSUPPORTED_VALUE');
    }
    for (const value of [NaN, Infinity, -Infinity]) {
      rejectedBeforeStringify({ value }, 'NONFINITE_NUMBER');
    }
    for (const value of [new Date(), new Map(), new Set(), new Uint8Array(1), new Number(1)]) {
      rejectedBeforeStringify(value, 'UNSUPPORTED_OBJECT');
    }
  });

  test('hidden, symbol, sparse, and augmented properties fail', () => {
    const hidden = {}; Object.defineProperty(hidden, 'hidden', { value: 1 });
    rejectedBeforeStringify(hidden, 'UNSUPPORTED_NONENUMERABLE');
    rejectedBeforeStringify({ [Symbol('hidden')]: 1 }, 'UNSUPPORTED_SYMBOL_KEY');
    rejectedBeforeStringify(new Array(2), 'UNSUPPORTED_ARRAY_SHAPE');
    const array = [1]; array.extra = 2;
    rejectedBeforeStringify(array, 'MAX_OBJECT_KEYS');
    const accessorArray = [1];
    Object.defineProperty(accessorArray, '0', { get() { throw new Error('not reached'); } });
    rejectedBeforeStringify(accessorArray, 'UNSUPPORTED_ACCESSOR');
  });

  test('invalid limits and option accessors cannot disable bounds', () => {
    for (const limits of [{ maxDepth: 65 }, { maxBytes: Infinity }, { maxNodes: NaN },
      { maxArrayLength: -1 }, { maxStringChars: 0 }, { maxRecords: 1.5 },
      { maxStringLength: 2, maxStringChars: 3 }]) {
      assert.throws(() => encodeBounded({}, limits), errorIs('INVALID_LIMITS'));
    }
    let calls = 0;
    const limits = { get maxDepth() { calls += 1; return 12; } };
    assert.throws(() => encodeBounded({}, limits), errorIs('INVALID_LIMITS'));
    assert.equal(calls, 0);
  });

  test('successful writer matches exact bytes and requires close', () => {
    const target = file();
    const writer = createWriter(target);
    assert.equal(writer.stats().complete, false);
    assert.equal(writer.append({ n: 1 }), true);
    assert.equal(writer.append({ text: '한😀' }), true);
    assert.equal(writer.stats().complete, false);
    assert.equal(writer.close(), true);
    assert.equal(writer.close(), true);
    const stats = writer.stats();
    assert.deepEqual(stats, { complete: true, bytes: fs.statSync(target).size,
      records: 2, failures: 0, reason: null, closed: true });
    assert.equal(fs.statSync(target).mode & 0o777, 0o600);
    assert.equal(fs.readFileSync(target, 'utf8'), '{"n":1}\n{"text":"한😀"}\n');
  });

  test('per-line overflow is sticky and cannot be reset by passing record', () => {
    const target = file();
    const writer = createWriter(target, { maxLineBytes: 8 });
    assert.equal(writer.append({ a: 12 }), false);
    assert.equal(writer.stats().reason, 'MAX_LINE_BYTES');
    assert.equal(writer.append({ pass: true }), false);
    assert.equal(writer.close(), false);
    assert.equal(writer.stats().complete, false);
    assert.equal(writer.stats().failures, 2);
    assert.equal(fs.statSync(target).size, 0);
    assert.throws(() => { writer.stats().complete = true; }, TypeError);
    assert.throws(() => { writer.stats = () => ({ complete: true }); }, TypeError);
  });

  test('record-count limit does not serialize or write another record', () => {
    const target = file();
    const writer = createWriter(target, { maxRecords: 1 });
    assert.equal(writer.append({ ok: 1 }), true);
    const before = writer.stats().bytes;
    assert.equal(writer.append({ huge: 'x'.repeat(1000000) }), false);
    assert.equal(writer.close(), false);
    assert.equal(writer.stats().reason, 'MAX_RECORDS');
    assert.equal(writer.stats().records, 1);
    assert.equal(fs.statSync(target).size, before);
  });

  test('total cap is checked before stringify and leaves accepted bytes intact', () => {
    const target = file();
    const writer = createWriter(target, { maxBytes: 16 });
    assert.equal(writer.append({ a: 1 }), true); // 8 bytes.
    assert.equal(writer.append({ a: 2 }), true);
    const original = JSON.stringify;
    let calls = 0;
    JSON.stringify = (...args) => { calls += 1; return original(...args); };
    try { assert.equal(writer.append(null), false); }
    finally { JSON.stringify = original; }
    assert.equal(calls, 0);
    assert.equal(writer.close(), false);
    assert.equal(writer.stats().reason, 'MAX_BYTES');
    assert.equal(writer.stats().records, 2);
    assert.equal(writer.stats().bytes, 16);
    assert.equal(fs.statSync(target).size, 16);
    rejectedBeforeStringify('x', 'MAX_BYTES', { maxBytes: 3 });
  });

  test('open uses wx and failures remain available in memory', () => {
    const target = file();
    fs.writeFileSync(target, 'original', { flag: 'wx' });
    const writer = createWriter(target);
    assert.equal(writer.stats().reason, 'OPEN_FAILED');
    assert.equal(writer.append({ pass: true }), false);
    assert.equal(writer.close(), false);
    assert.equal(fs.readFileSync(target, 'utf8'), 'original');
    const missing = createWriter(path.join(directory, 'missing', 'raw.ndjson'));
    assert.equal(missing.stats().reason, 'OPEN_FAILED');
    assert.equal(missing.close(), false);
  });

  test('partial write failure records real bytes but not an incomplete record', () => {
    const target = file();
    const writer = createWriter(target);
    let calls = 0;
    withPatchedFs('writeSync', (original) => (fd, buffer, offset, length, position) => {
      if (++calls === 1) return original(fd, buffer, offset, Math.min(3, length), position);
      throw new Error('synthetic EIO');
    }, () => assert.equal(writer.append({ value: 123 }), false));
    assert.equal(writer.close(), false);
    assert.equal(writer.stats().reason, 'WRITE_FAILED');
    assert.equal(writer.stats().bytes, 3);
    assert.equal(writer.stats().records, 0);
    assert.equal(fs.statSync(target).size, 3);
  });

  test('short writes finish, zero writes fail without a loop', () => {
    const target = file();
    const writer = createWriter(target);
    withPatchedFs('writeSync', (original) => (fd, buffer, offset, length, position) =>
      original(fd, buffer, offset, Math.min(1, length), position),
    () => assert.equal(writer.append({ n: 1 }), true));
    assert.equal(writer.close(), true);
    assert.equal(fs.readFileSync(target, 'utf8'), '{"n":1}\n');
    const zero = createWriter(file());
    withPatchedFs('writeSync', () => () => 0,
      () => assert.equal(zero.append({ n: 1 }), false));
    assert.equal(zero.close(), false);
    assert.equal(zero.stats().reason, 'INVALID_WRITE_RESULT');
  });

  test('close failure is sticky and cannot produce complete status', () => {
    const writer = createWriter(file());
    writer.append({ n: 1 });
    let leakedDescriptor;
    withPatchedFs('closeSync', () => (fd) => {
      leakedDescriptor = fd; throw new Error('synthetic close failure');
    }, () => assert.equal(writer.close(), false));
    if (leakedDescriptor !== undefined) fs.closeSync(leakedDescriptor);
    assert.equal(writer.stats().reason, 'CLOSE_FAILED');
    assert.equal(writer.stats().complete, false);
    assert.equal(writer.close(), false);
  });

  test('append after close makes previously complete writer fail', () => {
    const target = file();
    const writer = createWriter(target);
    writer.append({ n: 1 }); writer.close();
    assert.equal(writer.stats().complete, true);
    assert.equal(writer.append({ n: 2 }), false);
    assert.equal(writer.stats().complete, false);
    assert.equal(writer.stats().reason, 'WRITER_CLOSED');
    assert.equal(writer.stats().records, 1);
    assert.equal(fs.readFileSync(target, 'utf8'), '{"n":1}\n');
  });

  test('standalone summary survives raw overflow and forbids forged pass', () => {
    const raw = createWriter(file(), { maxBytes: 1 });
    assert.equal(raw.append({ n: 1 }), false); raw.close();
    const target = file();
    const result = writeSummary(target, { pass: true, records: 123 }, raw);
    assert.equal(result.complete, true);
    assert.equal(result.pass, false);
    const summary = JSON.parse(fs.readFileSync(target, 'utf8'));
    assert.equal(summary.pass, false);
    assert.equal(summary.recording.complete, false);
    assert.equal(summary.recording.reason, 'MAX_BYTES');
    assert.throws(() => writeSummary(file(), { pass: true }, { stats() {
      return { complete: true };
    } }), errorIs('INVALID_WRITER'));
  });

  test('summary survives raw I/O error and malformed summary fallback', () => {
    const raw = createWriter(path.join(directory, 'absent', 'raw.ndjson')); raw.close();
    const target = file();
    const result = writeSummary(target, { pass: true, invalid: Infinity }, raw);
    assert.equal(result.complete, true);
    assert.equal(result.pass, false);
    const summary = JSON.parse(fs.readFileSync(target, 'utf8'));
    assert.equal(summary.summaryFailure, 'NONFINITE_NUMBER');
    assert.equal(summary.recording.reason, 'OPEN_FAILED');
    assert.equal(summary.pass, false);
  });

  test('summary requires closed raw writer and explicit pass, never overwrites', () => {
    const raw = createWriter(file()); raw.append({ ok: true });
    assert.equal(writeSummary(file(), { pass: true }, raw).pass, false);
    raw.close();
    assert.equal(writeSummary(file(), {}, raw).pass, false);
    const target = file();
    assert.equal(writeSummary(target, { pass: true }, raw).pass, true);
    const original = fs.readFileSync(target, 'utf8');
    const repeated = writeSummary(target, { pass: true }, raw);
    assert.equal(repeated.complete, false);
    assert.equal(repeated.reason, 'OPEN_FAILED');
    assert.equal(repeated.pass, false);
    assert.equal(fs.readFileSync(target, 'utf8'), original);
  });
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

const failures = results.filter((result) => !result.pass);
process.stdout.write(JSON.stringify({ suite: 'bounded-records', passed: results.length - failures.length,
  failed: failures.length, ...(failures.length ? { failures } : {}) }) + '\n');
if (failures.length) process.exitCode = 1;
