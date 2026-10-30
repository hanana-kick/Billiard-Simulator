import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';
const tick=()=>new Promise(r=>setImmediate(r));
async function fixture({requestTimeoutMs}={}){const bytes=new Uint8Array([1,2,3]),sha=createHash('sha256').update(bytes).digest('hex'),revision='a'.repeat(64),manifest='b'.repeat(64),events=[],hook={wrongOp:false,wrongHash:false,badType:false,holdDispose:false};const saved={Worker:globalThis.Worker,fetch:globalThis.fetch,location:globalThis.location};let instance;
 class Worker{constructor(url,options){instance=this;events.push(['construct',url,options]);}terminate(){events.push(['terminate']);}postMessage(message,transfers=[]){const m=structuredClone(message,{transfer:transfers});events.push([m.op,m]);queueMicrotask(()=>{if(m.op==='init'){this.onmessage({data:{v:1,generation:m.generation,event:'ready',sourceRevision:revision,manifestSha256:manifest}});return;}const r={v:1,generation:m.generation,id:m.id,op:hook.wrongOp?'wrong':m.op,ok:true};if(m.op==='prepare'&&hook.progress)for(let i=0;i<5;i++)this.onmessage({data:{v:1,generation:m.generation,id:m.id,event:'progress',detail:{phase:'preparing'}}});if(m.op==='prepare')Object.assign(r,{handle:'search-N1',artifactSha256:hook.wrongHash?'bad':'world',rawArtifactSha256:'raw'});if(m.op==='run'){r.result=hook.badType?[1,2,3,4]:new Uint32Array([1,2,3,4]);if(hook.holdRun){hook.runAck=()=>this.onmessage({data:r});return;}}if(m.op==='release')r.released=true;if(m.op==='dispose'){Object.assign(r,{drained:true,disposed:true,destroyed:true,ownedBytes:0});if(hook.holdDispose){hook.ack=()=>this.onmessage({data:r});return;}}this.onmessage({data:r});});}}
 globalThis.Worker=Worker;globalThis.location={origin:'https://local.test'};globalThis.fetch=async()=>({ok:true,body:new ReadableStream({start(c){c.enqueue(bytes.slice());c.close();}})});
 let source=await readFile(new URL('../src/wasm-gpu/worker-owner-client.mjs',import.meta.url),'utf8');source=source.replace("from './worker-owner-protocol.mjs'","from '"+new URL('../src/wasm-gpu/worker-owner-protocol.mjs',import.meta.url).href+"'");source=source.replace(/import\{WASM_GPU_BUILD_CONFIGURATION as programs\}from[^;]+;/,`const programs=${JSON.stringify({sourceRevision:revision,manifestSha256:manifest,relativeBase:'wasm-gpu-programs/'})};`).replace(/import\{WASM_GPU_WORKER_BUILD_CONFIGURATION as descriptor\}from[^;]+;/,`const descriptor=${JSON.stringify({sourceRevision:revision,programManifestSha256:manifest,file:'wasm-gpu-compute-worker.mjs',sha256:sha,byteLength:3})};`).replace(/import\{createCanonicalPreparationScope\}from[^;]+;/,`const createCanonicalPreparationScope=({signal}={})=>({signal:signal??new AbortController().signal,check(){if(signal?.aborted)throw Object.assign(Error('cancelled'),{name:'AbortError'});},dispose(){}});`).replaceAll('import.meta.url',"'https://local.test/assets/controller.js'");
 if(requestTimeoutMs!==undefined)source=source.replace("op==='dispose'||op==='release'?30000:600000",String(requestTimeoutMs));
 const mod=await import('data:text/javascript;base64,'+Buffer.from(source+'\n//'+Math.random()).toString('base64'));
 return{...mod,events,hook,instance:()=>instance,restore(){Object.assign(globalThis,saved);},args:{engine:{artifactSha256:'world',count:1,lowered:{sourcePlan:{allocations:[{size:4,external:null}]},shared:[false]},structuralConfig:{uploadManifest:{allocations:[{role:'zero'}]}}},rawEngine:{artifactSha256:'raw',allocations:[{bytes:4,role:'strikeScratch'}]}},input:()=>({initialUploads:[{index:0,initial:new Uint8Array(4)}],rawUploads:[{index:0,initial:new Uint8Array(4)}],candidateIds:new Uint32Array([1])})};}
test('verified Blob Worker owns transferred snapshots and termination waits destruction acknowledgement',async()=>{const f=await fixture();try{const endpoint=await f.createSealedWorkerOwnerEndpoint();assert.equal(endpoint.kind,'sealed-worker-owner-endpoint-v1');assert.throws(()=>f.assertWorkerOwnerEndpoint({...endpoint}),/Owned/);const owner=await endpoint.prepare(f.args),input=f.input();assert.deepEqual((await owner.run(input)).result,new Uint32Array([1,2,3,4]));assert.equal(input.initialUploads[0].initial.byteLength,4);assert.equal(input.candidateIds.byteLength,4);await owner.dispose();assert.equal(owner.status().descriptorRetained,false);f.hook.holdDispose=true;const disposal=endpoint.destroy();await tick();assert.equal(f.events.some(x=>x[0]==='terminate'),false);f.hook.ack();await disposal;assert.equal(f.events.filter(x=>x[0]==='terminate').length,1);assert.equal((await endpoint.lost).reason,'destroyed');assert.equal(endpoint.status().workerRetained,false);}finally{f.restore();}});
for(const failure of['wrongOp','wrongHash','badType'])test('malformed '+failure+' is terminal, never a reusable owner',async()=>{const f=await fixture();try{const endpoint=await f.createSealedWorkerOwnerEndpoint();if(failure!=='badType')f.hook[failure]=true;let owner;if(failure==='badType'){owner=await endpoint.prepare(f.args);f.hook.badType=true;await assert.rejects(owner.run(f.input()),/readback/);}else await assert.rejects(endpoint.prepare(f.args),/mismatch/);assert.equal((await endpoint.lost).cleanupVerified,false);await assert.rejects(endpoint.prepare(f.args),/unavailable/);assert.ok(f.events.some(x=>x[0]==='terminate'));}finally{f.restore();}});
test('wrong bundle digest refuses Worker construction',async()=>{const f=await fixture();try{globalThis.fetch=async()=>({ok:true,body:new ReadableStream({start(c){c.enqueue(new Uint8Array([9,9,9]));c.close();}})});await assert.rejects(f.createSealedWorkerOwnerEndpoint(),/digest/);assert.equal(f.events.length,0);}finally{f.restore();}});

test('throwing preparation callback releases successful late owner and sends only one cancellation',async()=>{const f=await fixture();try{const endpoint=await f.createSealedWorkerOwnerEndpoint();f.hook.progress=true;await assert.rejects(endpoint.prepare({...f.args,onPrepareProgress(){throw Error('callback failed')}}),/callback failed/);assert.equal(f.events.filter(x=>x[0]==='cancel').length,1);assert.equal(f.events.filter(x=>x[0]==='release').length,1);assert.equal(f.events.some(x=>x[0]==='terminate'),false);await endpoint.destroy();}finally{f.restore();}});
test('malformed uploads and shared candidate IDs reject before transfer',async()=>{const f=await fixture();try{const endpoint=await f.createSealedWorkerOwnerEndpoint(),owner=await endpoint.prepare(f.args),input=f.input();input.initialUploads[0].initial=new Uint8Array(8);await assert.rejects(owner.run(input),/upload bytes/);const shared=f.input();shared.candidateIds=new Uint32Array(new SharedArrayBuffer(4));await assert.rejects(owner.run(shared),/candidate IDs/);assert.equal(f.events.some(x=>x[0]==='run'),false);await owner.dispose();await endpoint.destroy();}finally{f.restore();}});

test('retired proxy cannot run, cancel or release a successor Worker with the same handle',async()=>{const f=await fixture();try{const first=await f.createSealedWorkerOwnerEndpoint(),old=await first.prepare(f.args);await old.dispose();await first.destroy();const second=await f.createSealedWorkerOwnerEndpoint(),fresh=await second.prepare(f.args);f.hook.holdRun=true;const work=fresh.run(f.input());await tick();const before=f.events.length;old.cancel();await old.dispose();await assert.rejects(old.run(f.input()),/disposed/);assert.equal(f.events.length,before);f.hook.runAck();assert.deepEqual((await work).result,new Uint32Array([1,2,3,4]));await fresh.dispose();await second.destroy();assert.equal(f.events.filter(x=>x[0]==='terminate').length,2);}finally{f.restore();}});

for(const thrown of['primitive callback',Object.freeze(Error('frozen callback'))])test('nonmutable callback failure still acknowledges owner release',async()=>{const f=await fixture();try{const endpoint=await f.createSealedWorkerOwnerEndpoint();f.hook.progress=true;await assert.rejects(endpoint.prepare({...f.args,onPrepareProgress(){throw thrown}}),/callback/);assert.equal(f.events.filter(x=>x[0]==='release').length,1);assert.equal(f.events.some(x=>x[0]==='terminate'),false);await endpoint.destroy();}finally{f.restore();}});

for (const failure of ['malformed', 'onerror', 'messageerror', 'timeout', 'device-loss']) {
 test('terminal ' + failure + ' clears local descriptors without claiming native cleanup', async () => {
  const f = await fixture(failure === 'timeout' ? {requestTimeoutMs: 50} : {});
  try {
   const endpoint = await f.createSealedWorkerOwnerEndpoint();
   const owner = await endpoint.prepare(f.args);
   assert.equal(owner.status().descriptorRetained, true);
   f.hook.holdRun = true;
   const work = owner.run(f.input());
   const expected = {
    malformed: /Worker protocol identity mismatch/,
    onerror: /synthetic Worker failure/,
    messageerror: /Worker message decoding failed/,
    timeout: /Worker run acknowledgement timeout/,
    'device-loss': /synthetic device loss/,
   }[failure];
   const rejected = assert.rejects(work, error => {
    assert.match(error.message, expected);
    if (failure === 'device-loss') {
     assert.equal(error.name, 'DeviceLostError');
     assert.deepEqual(error.deviceLoss, {reason:'unknown', message:'native loss'});
    }
    return true;
   });
   await tick();
   assert.equal(owner.status().descriptorRetained, true, 'live pending operation retains required metadata');
   const instance = f.instance();
   if (failure === 'malformed') instance.onmessage({data:{v:0}});
   if (failure === 'onerror') instance.onerror({message:'synthetic Worker failure', preventDefault(){}});
   if (failure === 'messageerror') instance.onmessageerror();
   if (failure === 'device-loss') {
    const generation = f.events.find(([op]) => op === 'init')[1].generation;
    instance.onmessage({data:{v:1,generation,event:'lost',error:{name:'DeviceLostError',message:'synthetic device loss',deviceLoss:{reason:'unknown',message:'native loss'}}}});
   }
   await rejected;
   const loss = await endpoint.lost;
   assert.equal(loss.cleanupVerified, false);
   assert.match(loss.message, expected);
   assert.deepEqual(owner.status(), {disposed:true,remote:true,descriptorRetained:false});
   assert.equal(endpoint.status().workerRetained, false);
   assert.equal(endpoint.status().pending, 0);
   assert.equal(instance.onmessage, null);
   assert.equal(instance.onerror, null);
   assert.equal(instance.onmessageerror, null);
   await assert.rejects(owner.run(f.input()), /disposed/);
   await assert.rejects(owner.dispose(), /unavailable/);
   await assert.rejects(endpoint.destroy(), /unavailable/);
   await assert.rejects(endpoint.prepare(f.args), /unavailable/);
   assert.equal(owner.status().descriptorRetained, false);
   assert.equal(f.events.filter(([op]) => op === 'terminate').length, 1);
  } finally { f.restore(); }
 });
}
