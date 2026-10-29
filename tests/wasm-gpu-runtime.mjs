import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instantiateWasmGpuRuntime } from '../src/wasm-gpu/runtime.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = mkdtempSync(resolve(tmpdir(), 'wasm-gpu-runtime-test-'));
let bytes;
try {
  execFileSync(process.execPath, [resolve(root, 'tools/wasm-gpu-runtime/build.mjs'), resolve(temp, 'runtime.wasm')], { cwd: root, stdio: 'pipe', env: { ...process.env, CARGO_TARGET_DIR: resolve(temp, 'ignored-target') } });
  bytes = readFileSync(resolve(temp, 'runtime.wasm'));
  const provenance = JSON.parse(readFileSync(resolve(temp, 'runtime.wasm.build.json'), 'utf8'));
  assert.equal(provenance.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(provenance.abiVersion, 1);
  assert.equal(provenance.byteLength, bytes.length);
  assert.equal(existsSync(resolve(temp, 'ignored-target')), false);
  assert.deepEqual(provenance.imports, [{ module: 'bridge', name: 'submit', kind: 'function' }]);
} finally { rmSync(temp, { recursive: true, force: true }); }
async function make(encodeChunk) {
  const calls = [];
  const runtime = await instantiateWasmGpuRuntime({ moduleBytes: bytes, bridge: { commandCount: 5, cancel() {}, lose() {}, encodeChunk: encodeChunk || ((handles, generation) => { calls.push({ handles: [...handles], generation }); }) } });
  return { runtime, calls };
}
test('actual compiled WASM admits a copied stream and owns exact bounded repeated ordering', async () => {
  const { runtime: r, calls } = await make();
  const input = new Uint32Array([5, 2, 4]); r.load(input); input.fill(1);
  assert.equal(r.start({ repeat: 3 }).generation, 1);
  assert.equal((await r.step(4)).submittedCommands, 4);
  assert.deepEqual(r.status(), { state: 'running', generation: 1, cursor: 1, repeatsLeft: 2, commandCount: 3, inFlight: false });
  await r.step(4); await r.step(4);
  assert.deepEqual(calls, [{handles:[5,2,4,5],generation:1},{handles:[2,4,5,2],generation:1},{handles:[4],generation:1}]);
  assert.equal(r.status().state, 'complete');
  await assert.rejects(r.step());
  r.start(); await r.step(); assert.equal(calls.at(-1).generation, 2);
});
test('cancellation stops the stream and restart gets a new generation', async () => {
  const { runtime: r, calls } = await make(); r.load([1,2,3]); r.start({repeat:2}); await r.step(2);
  r.cancel(); await assert.rejects(r.step()); assert.equal(calls.length, 1);
  r.start(); await r.step(3); assert.deepEqual(calls.at(-1), {handles:[1,2,3],generation:2});
});
test('pending submission enforces backpressure; in-flight cancellation cannot retract submitted work', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const { runtime:r } = await make(() => gate); r.load([1,2,3]); r.start();
  const step = r.step(2); assert.equal(r.status().inFlight, true); assert.equal(r.status().cursor, 0);
  await assert.rejects(r.step(), /in flight/); assert.throws(() => r.start(), /in flight/); assert.throws(() => r.load([1]), /in flight/);
  r.cancel(); release(); await step;
  assert.equal(r.status().state, 'cancelled'); assert.equal(r.status().cursor, 2); await assert.rejects(r.step());
});
test('bridge failure, device loss and disposal are terminal', async () => {
  const {runtime:r} = await make(() => { throw new Error('device failure'); }); r.load([1]); r.start();
  await assert.rejects(r.step(), /device failure/); assert.equal(r.status().state, 'lost');
  assert.throws(() => r.start()); assert.throws(() => r.load([1])); r.dispose(); assert.equal(r.status().state, 'disposed'); r.dispose();
  const {runtime:s} = await make(); s.load([1]); s.lose(); assert.throws(() => s.start()); s.dispose(); await assert.rejects(s.step());
});
test('loss/disposal during a pending submission never resurrects a completed schedule', async () => {
  for (const terminal of ['lose','dispose']) {
    let release; const {runtime:r} = await make(() => new Promise(resolve => {release=resolve;}));
    r.load([1]); r.start(); const step = r.step(); r[terminal](); release(); await assert.rejects(step, /commit rejected/);
    assert.equal(r.status().state, terminal === 'lose' ? 'lost' : 'disposed'); assert.throws(() => r.start());
  }
});
test('malformed JS inputs reject before integer coercion and never reach bridge', async () => {
  const {runtime:r,calls} = await make();
  for (const bad of [[0],[-1],[1.5],[NaN],[Infinity],[6],[2**32+1],[],new Float32Array([1])]) assert.throws(() => r.load(bad));
  for (const count of [0,-1,1.1,NaN,Infinity,2**32]) { r.load([1]); assert.throws(() => r.start({repeat:count})); }
  r.load([1]); r.start();
  for (const count of [0,-1,1.1,NaN,Infinity,4097]) await assert.rejects(r.step(count));
  assert.equal(calls.length,0);
  await assert.rejects(instantiateWasmGpuRuntime({moduleBytes:bytes,bridge:{commandCount:1.2,encodeChunk(){}}}));
  await assert.rejects(instantiateWasmGpuRuntime({moduleBytes:'network URL'}));
});
test('raw WASM ABI independently validates handles, bounds, lifecycle and commit ordering', async () => {
  let calls=0; const {instance} = await WebAssembly.instantiate(bytes,{bridge:{submit(){calls++;return 0;}}}); const e=instance.exports;
  assert.equal(e.abi_version(),1); assert.equal(e.configure(5),0); assert.ok(e.configure(5)<0);
  const view=new Uint32Array(e.memory.buffer,e.input_ptr(),3); view.set([1,0,3]); assert.ok(e.load(3)<0); assert.ok(e.start(1)<0);
  view.set([1,6,3]); assert.ok(e.load(3)<0); assert.ok(e.load(65537)<0); assert.equal(calls,0);
  view.set([1,2,3]); assert.equal(e.load(3),0); assert.equal(e.start(2),0);
  assert.ok(e.commit(1)<0); assert.ok(e.step(0)<0); assert.ok(e.step(4097)<0);
  assert.equal(e.step(2),2); assert.equal(e.cursor(),0); assert.ok(e.step(2)<0); assert.ok(e.start(1)<0);
  assert.equal(e.commit(1),0); assert.equal(e.cursor(),2); assert.equal(e.step(2),2); assert.ok(e.commit(0)<0); assert.equal(e.state(),5);
});

test('unsigned ABI repeat count is preserved rather than exposed as signed i32', async () => {
  const {runtime:r} = await make(); r.load([1,2]);
  assert.equal(r.start({repeat:0xffffffff}).repeatsLeft,0xffffffff);
  await r.step(2); assert.equal(r.status().repeatsLeft,0xfffffffe); r.cancel();
});

test('unexpected WASM step trap terminally loses the wrapper runtime', async t => {
  const instantiate = WebAssembly.instantiate.bind(WebAssembly);
  t.mock.method(WebAssembly, 'instantiate', async (...args) => {
    const result = await instantiate(...args);
    return { instance: { exports: { ...result.instance.exports, step() { throw new WebAssembly.RuntimeError('injected trap'); } } } };
  });
  const {runtime:r} = await make(); r.load([1]); r.start();
  await assert.rejects(r.step(), /injected trap/); assert.equal(r.status().state, 'lost');
  assert.throws(() => r.start());
});

test('runtime lifecycle propagates synchronously to the GPU bridge without owning async destruction', async () => {
  const events=[];
  const bridge={commandCount:1,encodeChunk(){},cancel(g){events.push(['cancel',g]);},lose(reason){events.push(['lose',reason]);},dispose(){assert.fail('runtime must not destroy GPU resources');}};
  const r=await instantiateWasmGpuRuntime({moduleBytes:bytes,bridge}); r.load([1]); r.start(); r.cancel();
  assert.deepEqual(events.shift(),['cancel',1]); r.start(); r.lose('manual loss'); assert.deepEqual(events.shift(),['lose','manual loss']);
  r.dispose(); assert.deepEqual(events,[['cancel',2],['lose','WASM scheduler disposed']]);
});
test('bridge rejection following cancellation preserves cancelled state and does not mark bridge lost', async () => {
  let reject, losses=0;
  const bridge={commandCount:1,encodeChunk(){return new Promise((_,r)=>{reject=r;});},cancel(){reject(Error('cancelled pending submit'));},lose(){losses++;}};
  const r=await instantiateWasmGpuRuntime({moduleBytes:bytes,bridge}); r.load([1]); r.start(); const step=r.step();r.cancel();
  await assert.rejects(step,/cancelled pending submit/); assert.equal(r.status().state,'cancelled');assert.equal(losses,0);
});

test('unsigned generation bits are normalized on WASM getter and import boundaries', async t => {
  const instantiate=WebAssembly.instantiate.bind(WebAssembly);
  t.mock.method(WebAssembly,'instantiate',async (moduleBytes,imports)=>{
    const submit=imports.bridge.submit;
    const result=await instantiate(moduleBytes,{bridge:{submit:(p,n)=>submit(p,n,-2147483648)}});
    return {instance:{exports:{...result.instance.exports,generation:()=>-2147483648}}};
  });
  let observed;
  const r=await instantiateWasmGpuRuntime({moduleBytes:bytes,bridge:{commandCount:1,encodeChunk(h,g){observed=g;},cancel(){},lose(){}}});
  r.load([1]);assert.equal(r.start().generation,2147483648);await r.step();assert.equal(observed,2147483648);
});
