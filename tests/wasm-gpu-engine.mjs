/** Actual WASM + structural mock WebGPU. No adapter request or physics evaluation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareWasmGpuEngine} from '../src/wasm-gpu/engine.mjs';
import {fixture,mock} from './helpers/wasm-gpu-fixture.mjs';
const moduleBytes = await readFile(new URL('../artifacts/wasm-gpu-runtime.wasm',import.meta.url));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const submitted=m=>m.events.filter(e=>Array.isArray(e)&&e[0]==='submit').length;
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await tick();}assert.fail('Expected host event did not occur');}
async function setup(options={}){
 const engine=await fixture(),m=mock(engine);
 const owner=await prepareWasmGpuEngine({moduleBytes,device:m.device,engine,maximumOwnedBytes:engine.resources.totalOwnedBytes,chunkSize:1,...options});
 const prepared=m.device.createBuffer({size:768,usage:132}),status=m.device.createBuffer({size:64,usage:132});let releases=0;
 const input=(id=1)=>({initialUploads:[{index:2,initial:new Uint8Array(32).fill(id)}],candidateIds:new Uint32Array([id]),rawLease:{prepared,status,release(){releases++;m.events.push('release');}}});
 return{owner,m,engine,input,prepared,status,get releases(){return releases;}};
}
test('unified owner performs exact actual-WASM schedules, resets uploads, reuses arena and releases raw leases',async()=>{
 const s=await setup(),{owner,m}=s,compiled=m.compiled,allocated=m.buffers.length,progress=[];
 for(const id of [10,20]){const result=await owner.run({...s.input(id),onProgress:p=>progress.push(p)});assert.equal(result.generation,id===10?1:2);assert.equal(result.result.length,4);}
 assert.equal(s.releases,2);assert.equal(m.compiled,compiled);assert.equal(m.buffers.length,allocated);assert.equal(submitted(m),6);
 assert.deepEqual(progress.map(p=>[p.generation,p.submittedCommands]),[[1,1],[1,2],[2,1],[2,2]]);
 assert.equal(owner.status().state,'ready');await owner.dispose();assert.equal(owner.status().state,'disposed');assert.equal(s.prepared.dead,false);assert.equal(s.status.dead,false);
});
test('owner snapshots host inputs and enforces one run at a time without adopting rejected leases',async()=>{
 const s=await setup(),first=deferred();s.m.hold();const input=s.input(17);
 const run=s.owner.run({...input,onProgress:()=>first.resolve()});input.initialUploads[0].initial.fill(99);input.candidateIds[0]=99;
 await first.promise;assert.equal(s.m.buffers[0].bytes[0],17);await assert.rejects(s.owner.run(s.input(2)),/already active/);assert.equal(s.releases,0);
 s.m.release();await run;assert.equal(s.releases,1);await s.owner.dispose();
});
test('cancel reaches blocked bridge, releases only after GPU completion, and permits a fully reset restart',async()=>{
 const s=await setup(),first=deferred();s.m.hold();const run=s.owner.run({...s.input(),onProgress:()=>first.resolve()});const rejected=assert.rejects(run,{name:'AbortError'});
 await first.promise;await tick();assert.equal(submitted(s.m),1);assert.equal(s.owner.cancel('test cancellation'),true);await tick();assert.equal(s.releases,0);
 s.m.release();await rejected;assert.equal(submitted(s.m),1);assert.equal(s.releases,1);assert.equal(s.owner.status().state,'ready');
 const second=await s.owner.run(s.input(2));assert.equal(second.generation,2);await s.owner.dispose();
});
test('AbortSignal is wired once; pre-abort does not acquire a raw lease',async()=>{
 const s=await setup(),before=new AbortController();before.abort('before');await assert.rejects(s.owner.run({...s.input(),signal:before.signal}),{name:'AbortError'});assert.equal(s.releases,0);assert.equal(submitted(s.m),0);
 const first=deferred(),abort=new AbortController();s.m.hold();const run=s.owner.run({...s.input(),signal:abort.signal,onProgress:()=>first.resolve()});const rejected=assert.rejects(run,{name:'AbortError'});await first.promise;abort.abort('during');s.m.release();await rejected;assert.equal(s.releases,1);await s.owner.dispose();
});
test('callback failure drains submitted GPU work before releasing and leaves owner reusable',async()=>{
 const s=await setup(),first=deferred();s.m.hold();const run=s.owner.run({...s.input(),onProgress(){first.resolve();throw Error('callback failed');}});const rejected=assert.rejects(run,/callback failed/);
 await first.promise;await tick();assert.equal(s.releases,0);await assert.rejects(s.owner.run(s.input(2)),/already active/);s.m.release();await rejected;assert.equal(s.releases,1);
 await s.owner.run(s.input(2));await s.owner.dispose();
});
test('disposal cancels active run and waits real GPU completion before destroying owned buffers',async()=>{
 const s=await setup(),first=deferred();s.m.hold();const run=s.owner.run({...s.input(),onProgress:()=>first.resolve()});const rejected=assert.rejects(run,{name:'AbortError'});await first.promise;
 const disposal=s.owner.dispose();assert.equal(s.owner.dispose(),disposal);await tick();assert.equal(s.releases,0);assert.ok(s.m.buffers.every(b=>!b.dead));await assert.rejects(s.owner.run(s.input(2)),/disposed/);
 s.m.release();await rejected;await disposal;assert.equal(s.releases,1);assert.ok(s.m.buffers.slice(0,4).every(b=>b.dead));assert.equal(s.prepared.dead,false);assert.equal(s.status.dead,false);
});
test('device loss rejects blocked run terminally and releases borrowed raw buffers without destroying them',async()=>{
 const s=await setup(),first=deferred();s.m.hold();const run=s.owner.run({...s.input(),onProgress:()=>first.resolve()});const rejected=assert.rejects(run,/device lost/i);await first.promise;s.m.lose();await rejected;
 assert.equal(s.owner.status().state,'lost');assert.equal(s.releases,1);await assert.rejects(s.owner.run(s.input(2)),/device lost/i);await s.owner.dispose();assert.equal(s.prepared.dead,false);
});
test('cancel after WASM completion but during final GPU readback still suppresses result publication',async()=>{
 const s=await setup();const run=s.owner.run({...s.input(),onProgress:p=>{if(p.submittedCommands===p.totalCommands)s.m.hold();}});const rejected=assert.rejects(run,{name:'AbortError'});
 await until(()=>submitted(s.m)===3);assert.equal(s.owner.status().scheduler.state,'complete');s.owner.cancel('readback cancellation');await tick();assert.equal(s.releases,0);s.m.release();await rejected;
 await s.owner.run(s.input(2));await s.owner.dispose();
});
test('invalid lease or chunk configuration fails closed',async()=>{
 const s=await setup();await assert.rejects(s.owner.run({...s.input(),rawLease:{prepared:s.prepared,status:s.status}}),/lease/);assert.equal(submitted(s.m),0);assert.equal(s.releases,0);await s.owner.dispose();
 await assert.rejects(prepareWasmGpuEngine({chunkSize:0}),/chunkSize/);
});

test('cancel, abort, dispose, and device loss during async lease release suppress stale success',async()=>{
 for(const action of ['cancel','abort','dispose','loss']){
  const s=await setup(),releaseStarted=deferred(),finishRelease=deferred(),signal=new AbortController(),input=s.input();
  input.rawLease.release=async()=>{releaseStarted.resolve();await finishRelease.promise;};
  const run=s.owner.run({...input,signal:signal.signal});const rejected=assert.rejects(run,action==='loss'?/device lost/i:{name:'AbortError'});
  await releaseStarted.promise;let disposal;
  if(action==='cancel')s.owner.cancel();if(action==='abort')signal.abort();if(action==='dispose')disposal=s.owner.dispose();if(action==='loss'){s.m.lose();await tick();}
  finishRelease.resolve();await rejected;await(disposal||s.owner.dispose());
 }
});
test('throwing signal setup still drains and releases adopted lease',async()=>{
 const s=await setup();const signal={addEventListener(){throw Error('listener failure');},removeEventListener(){}};
 await assert.rejects(s.owner.run({...s.input(),signal}),/listener failure/);assert.equal(s.releases,1);assert.equal(s.owner.status().state,'lost');await s.owner.dispose();
});

test('bridge validation failure after submission waits genuine GPU fence before raw lease release',async()=>{
 const s=await setup();s.m.hold();let scopes=0;s.m.device.popErrorScope=async()=>++scopes===4?{message:'step GPU validation failure'}:null;
 const run=s.owner.run(s.input());const rejected=assert.rejects(run,/step GPU validation failure/);
 await until(()=>submitted(s.m)===1);await tick();assert.equal(s.releases,0);assert.equal(s.owner.status().state,'lost');
 s.m.release();await rejected;assert.equal(s.releases,1);await assert.rejects(s.owner.run(s.input(2)),/validation/);await s.owner.dispose();
});
test('lease release failure is terminal rather than silently accepting new ownership',async()=>{
 const s=await setup(),input=s.input();input.rawLease.release=()=>{throw Error('lease release failed');};
 await assert.rejects(s.owner.run(input),/lease release failed/);assert.equal(s.owner.status().state,'lost');await s.owner.dispose();
});

async function combinedSetup({count=3,serialized=false}={}){
 const {rawFixture}=await import('./helpers/wasm-gpu-fixture.mjs');
 const engine=await fixture({count,raw:true}),raw=await rawFixture(engine),m=mock(engine);
 const owner=await prepareWasmGpuEngine({moduleBytes,device:m.device,engine,...(serialized?{rawArtifact:raw.artifact,rawArtifactExpectations:raw.expectations}:{rawEngine:raw.engine}),maximumOwnedBytes:engine.resources.totalOwnedBytes,chunkSize:3});
 const input=(seed=1)=>({initialUploads:[{index:2,initial:new Uint8Array(32*count).fill(seed)}],rawUploads:raw.engine.allocations.map((a,index)=>({index,initial:new Uint8Array(a.bytes).fill(seed+index)})),candidateIds:Uint32Array.from({length:count},(_,i)=>seed+i)});
 return{engine,raw,m,owner,input};
}
test('combined raw/world owner uses one actual-WASM ordered stream and preserves raw Y=1 versus world Y=count',async()=>{
 const s=await combinedSetup(),compiled=s.m.compiled,allocated=s.m.buffers.length;
 assert.equal(s.owner.ownsRaw,true);assert.equal(s.owner.requiresExclusiveDevice,true);assert.equal(s.owner.status().requiresExclusiveDevice,true);
 const progress=[];const result=await s.owner.run({...s.input(),onProgress:p=>progress.push(p.submittedCommands)});
 assert.equal(result.result.length,12);assert.deepEqual(progress,[3,6,9]);
 const dispatches=s.m.events.filter(e=>Array.isArray(e)&&e[0]==='submit').flatMap(e=>e[1].flat()).filter(c=>c[0]==='dispatch');
 assert.deepEqual(dispatches.slice(0,7),Array.from({length:7},()=>['dispatch',1,1]));assert.deepEqual(dispatches[7],['dispatch',1,3]);assert.deepEqual(dispatches[8],['dispatch',3,undefined]);
 assert.equal(s.m.compiled,compiled);assert.equal(s.m.buffers.length,allocated);await s.owner.dispose();assert.ok(s.m.buffers.every(b=>b.dead));
});
test('combined persistent arena reuploads current raw and world inputs rather than artifact-frozen data',async()=>{
 const s=await combinedSetup({serialized:true}),allocated=s.m.buffers.length,compiled=s.m.compiled;
 const first=s.input(10),snapshot=first.rawUploads.map(u=>u.initial.slice());const run=s.owner.run(first);for(const u of first.rawUploads)u.initial.fill(250);first.initialUploads[0].initial.fill(250);await run;
 for(const expected of snapshot)assert.ok(s.m.writes.some(([,bytes])=>bytes.length===expected.length&&bytes.every((v,i)=>v===expected[i])));
 const writes=s.m.writes.length;await s.owner.run(s.input(30));assert.ok(s.m.writes.slice(writes).some(([,bytes])=>bytes.length===96&&bytes.every(v=>v===30)));
 for(const a of s.input(30).rawUploads)assert.ok(s.m.writes.slice(writes).some(([,bytes])=>bytes.length===a.initial.length&&bytes.every((v,i)=>v===a.initial[i])));
 assert.equal(s.m.compiled,compiled);assert.equal(s.m.buffers.length,allocated);await s.owner.dispose();
});
test('combined cancellation drains persistent raw work before reuse, with no external lease needed',async()=>{
 const s=await combinedSetup(),first=deferred();s.m.hold();const run=s.owner.run({...s.input(),onProgress:()=>first.resolve()});const rejected=assert.rejects(run,{name:'AbortError'});await first.promise;s.owner.cancel();
 await tick();assert.ok(s.m.buffers.every(b=>!b.dead));await assert.rejects(s.owner.run(s.input(20)),/already active/);s.m.release();await rejected;
 const result=await s.owner.run(s.input(20));assert.equal(result.generation,2);await s.owner.dispose();
});
test('combined mode rejects external raw leases and missing raw inputs before submission',async()=>{
 const s=await combinedSetup();await assert.rejects(s.owner.run({...s.input(),rawLease:{}}),/external raw leases/);await assert.rejects(s.owner.run({...s.input(),rawUploads:undefined}),/rawUploads/);assert.equal(submitted(s.m),0);await s.owner.dispose();
 const external=await setup();await assert.rejects(external.owner.run({...external.input(),rawUploads:[]}),/rawEngine/);await external.owner.dispose();
});
