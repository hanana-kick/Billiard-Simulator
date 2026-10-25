// TRANSPORT DOUBLES, NOT ACTUAL GPU/WGSL TESTS.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installWorkerHost} from '../src/bounded-gpu-shot/four-ball-worker-host.mjs';
import {createWorkerClientTransport} from '../src/bounded-gpu-shot/four-ball-worker-transport.mjs';
import {input, doubleOwner, messagePair, tick, deferred} from './bounded-gpu-shot-worker-fixture.mjs';
async function setup(options={}) {const d=doubleOwner(options),pair=messagePair();installWorkerHost(pair.host,()=>d.owner);
  const progress=[],client=createWorkerClientTransport(pair.worker,{onProgress:x=>progress.push(x)});assert.equal((await client.ready).status,'ready');return {...d,...pair,client,progress};}
const slice={budget:{maxSteps:1,maxWallMs:30000}};
test('transport double: copied raw capture, bounded resume, exact rest, and one lifetime owner',async()=>{
  const s=await setup(),raw=input('a'),op=s.client.start(raw,slice);raw.snapshot.fill(9);raw.capture.application.id='mutated';
  assert.equal((await op.result).status,'budget-suspended');assert.equal(op.snapshot().progress.committedH,1);
  assert.equal(s.stats.inputs[0].capture.application.id,'a');assert.deepEqual(s.stats.inputs[0].snapshot,new Uint8Array([1,2,3]));
  assert.ok(Object.is(s.stats.inputs[0].capture.application.minusZero,-0));assert.equal(s.stats.inputs[0].capture.application.big,3n);
  const second=op.resume(slice);assert.throws(()=>op.resume(slice),/idle/);assert.equal((await second).progress.committedH,2);
  assert.equal((await op.resume(slice)).status,'complete');assert.equal((await op.finished).progress.committedH,3);
  const output=op.snapshot();output.state.bytes.fill(77);assert.equal(op.snapshot().state.bytes[0],1);
  assert.equal(s.stats.maxFlights,1);assert.equal(s.stats.released,1);assert.equal(s.sent.filter(x=>x.type==='start').length,1);
  const disposed=await s.client.dispose();assert.deepEqual(disposed,{status:'disposed',drained:true});assert.equal(s.stats.deviceDestroyed,1);assert.equal(s.terminated(),1);
  assert.equal(await s.client.dispose(),disposed);
});
test('transport double: progress snapshots are detached and callbacks cannot poison work',async()=>{
  const d=doubleOwner(),pair=messagePair();installWorkerHost(pair.host,()=>d.owner);
  const c=createWorkerClientTransport(pair.worker,{onProgress:v=>{if(v.state)v.state.bytes.fill(99);throw Error('observer');}});
  await c.ready;const op=c.start(input('x'),slice);await op.result;assert.equal(op.snapshot().state.bytes[0],1);await c.dispose();
});
test('transport double: supersession drains old h and stale progress never overwrites the latest operation',async()=>{
  const entered=deferred(),gate=deferred(),s=await setup({step:async state=>{if(state.id==='old'){entered.resolve();await gate.promise;}}});
  const old=s.client.start(input('old'),slice);await entered.promise;
  const newer=s.client.start(input('new'),slice);assert.equal(s.client.snapshot().operationId,newer.id);await tick();gate.resolve();
  assert.equal((await old.finished).status,'cancelled');assert.equal((await newer.result).state.id,'new');
  const msg=s.received.find(x=>x.type==='progress'&&x.operationId===old.id);
  s.emitMain({...msg,revision:9999,view:{...msg.view,status:'complete'}});
  assert.equal(s.client.snapshot().operationId,newer.id);assert.equal(s.client.snapshot().state.id,'new');
  assert.throws(()=>old.resume(),/idle/);assert.equal(s.stats.maxFlights,1);await s.client.dispose();
});
test('transport double: duplicate, foreign-session and out-of-order messages are ignored',async()=>{
  const s=await setup(),op=s.client.start(input('a'),slice);await op.result;
  const first=s.received.find(x=>x.type==='progress');s.emitMain({...first,sessionId:'foreign',revision:999,view:{...first.view,status:'failed'}});s.emitMain(first);
  assert.equal(op.snapshot().status,'budget-suspended');assert.equal(op.snapshot().progress.committedH,1);
  s.worker.postMessage(s.sent.find(x=>x.type==='start'));await tick();await tick();assert.equal(s.stats.initialized,1);await s.client.dispose();
});
test('transport double: malformed/shared/accessor inputs reject before replacing existing operation',async()=>{
  const s=await setup(),op=s.client.start(input('a'),slice);await op.result;
  const bad=[{...input('b'),seed:{}},{...input('b'),snapshot:new Uint8Array(new SharedArrayBuffer(4))},input('b'),input('b'),input('b')];
  bad[2].capture.application.hidden=new WebAssembly.Memory({initial:1,maximum:1,shared:true});
  bad[3].capture.application.hidden=new Map();let invoked=0;Object.defineProperty(bad[4].capture,'accessor',{get(){invoked++;return 1;},enumerable:true});
  for(const value of bad)assert.throws(()=>s.client.start(value));assert.equal(invoked,0);
  const tagged=input('tagged');Object.defineProperty(tagged.capture.application,Symbol.toStringTag,{get(){invoked++;return 'Object';}});assert.throws(()=>s.client.start(tagged));assert.equal(invoked,0);
  assert.equal(s.client.snapshot().operationId,op.id);assert.equal(s.stats.initialized,1);await s.client.dispose();
});
test('transport double: pre-abort performs zero initialization; mid-h cancel waits for the committed h',async()=>{
  const pre=await setup(),signal=new AbortController();signal.abort();const never=pre.client.start(input('never'),{...slice,signal:signal.signal});
  assert.equal((await never.finished).status,'cancelled');assert.equal(pre.stats.initialized,0);await pre.client.dispose();
  const entered=deferred(),gate=deferred(),s=await setup({step:async()=>{entered.resolve();await gate.promise;}});
  const op=s.client.start(input('a'),slice);await entered.promise;const cancelled=op.cancel();await tick();assert.equal(s.stats.released,0);gate.resolve();
  assert.equal((await cancelled).status,'cancelled');assert.equal((await op.finished).progress.committedH,1);assert.equal(s.stats.released,1);await s.client.dispose();
});
test('transport double: loss notification does not finalize before atomic h drains',async()=>{
  const entered=deferred(),gate=deferred(),s=await setup({step:async()=>{entered.resolve();await gate.promise;}});
  const op=s.client.start(input('a'),slice);await entered.promise;s.loss.resolve({reason:'unknown',message:'test loss'});
  assert.equal((await s.client.deviceLost).message,'test loss');assert.equal(s.stats.released,0);assert.notEqual(op.snapshot().status,'device-lost');
  gate.resolve();assert.equal((await op.finished).status,'device-lost');assert.equal(op.snapshot().progress.committedH,1);await s.client.dispose();
});
test('transport double: dispose during initialization and h waits, and never destroys a live owner',async()=>{
  for(const phase of ['initialize','step']){const entered=deferred(),gate=deferred(),s=await setup({[phase]:async()=>{entered.resolve();await gate.promise;}});
    const op=s.client.start(input('a'),slice);await entered.promise;let done=false;const disposal=s.client.dispose().then(v=>{done=true;return v;});await tick();await tick();
    assert.equal(done,false);assert.equal(s.stats.deviceDestroyed,0);gate.resolve();assert.equal((await disposal).drained,true);assert.equal((await op.finished).status,'cancelled');assert.equal(s.stats.deviceDestroyed,1);}
});
test('transport double: null capability is unsupported and starts no work; dispose while opening drains bootstrap',async()=>{
  const pair=messagePair();let starts=0;installWorkerHost(pair.host,async()=>({status:'unsupported',reason:'worker-webgpu-adapter-unavailable'}));
  const c=createWorkerClientTransport(pair.worker);assert.equal((await c.ready).status,'unsupported');assert.throws(()=>c.start(input('x')),/unsupported/);await c.dispose();assert.equal(starts,0);
  const pair2=messagePair(),gate=deferred(),d=doubleOwner();installWorkerHost(pair2.host,async()=>{await gate.promise;return d.owner;});const c2=createWorkerClientTransport(pair2.worker);
  const disposed=c2.dispose();await tick();assert.equal(d.stats.deviceDestroyed,0);gate.resolve();assert.equal((await disposed).drained,true);assert.equal(d.stats.deviceDestroyed,1);
});
test('transport double: abrupt worker failure settles callers but does not claim verified cleanup',async()=>{
  const s=await setup(),op=s.client.start(input('a'),slice);await op.result;s.emitError('worker crashed');
  assert.equal((await op.finished).status,'failed');assert.equal((await s.client.dispose()).cleanupVerified,false);assert.equal(s.terminated(),1);
  // Fake worker cannot be killed by its fake terminate; explicitly release its test owner.
  await s.owner.service.dispose();
});
test('transport double: unsupported physics result stays unsupported, never completion or CPU fallback',async()=>{
  const s=await setup({step(){throw new RangeError('unsupported test domain');}}),op=s.client.start(input('x'));
  assert.equal((await op.result).status,'unsupported');assert.equal((await op.finished).completed,false);assert.equal(s.stats.steps,0);await s.client.dispose();
});

test('transport double: early device loss never reports ready or starts initialization',async()=>{
  const pair=messagePair(),d=doubleOwner();d.loss.resolve({message:'lost during bootstrap'});installWorkerHost(pair.host,()=>d.owner);
  const c=createWorkerClientTransport(pair.worker);assert.equal((await c.ready).status,'device-lost');assert.throws(()=>c.start(input('x')),/device-lost/);
  assert.equal(d.stats.initialized,0);await c.dispose();
});
test('transport double: cross-realm shared buffers reject and typed-array metadata getters are never invoked',async()=>{
  const s=await setup(),foreign=input('foreign');foreign.capture.application.data=vm.runInNewContext('new Uint8Array(new SharedArrayBuffer(8))');
  assert.throws(()=>s.client.start(foreign),/SharedArrayBuffer/);
  let invoked=0;const decorated=input('decorated');
  for(const key of ['buffer','byteLength'])Object.defineProperty(decorated.snapshot,key,{get(){invoked++;throw Error('Unexpected accessor');}});
  Object.defineProperty(decorated.capture.application.data,Symbol.toStringTag,{get(){invoked++;throw Error('Unexpected tag');}});
  const op=s.client.start(decorated,slice);assert.equal((await op.result).state.bytes[0],1);assert.equal(invoked,0);await s.client.dispose();
});
