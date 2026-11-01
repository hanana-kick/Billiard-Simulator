import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';
const tick=()=>new Promise(r=>setImmediate(r));
async function fixture({requestTimeoutMs,selected=false,clock}={}){const bytes=new Uint8Array([1,2,3]),sha=createHash('sha256').update(bytes).digest('hex'),revision='a'.repeat(64),manifest='b'.repeat(64),events=[],hook={wrongOp:false,wrongHash:false,badType:false,holdDispose:false};const saved={Worker:globalThis.Worker,fetch:globalThis.fetch,location:globalThis.location};let instance;
 class Worker{constructor(url,options){instance=this;events.push(['construct',url,options]);}terminate(){events.push(['terminate']);}postMessage(message,transfers=[]){const m=structuredClone(message,{transfer:transfers});events.push([m.op,m]);queueMicrotask(()=>{if(m.op==='init'){this.onmessage({data:{v:1,generation:m.generation,event:'ready',sourceRevision:revision,manifestSha256:manifest}});return;}const r={v:1,generation:m.generation,id:m.id,op:hook.wrongOp?'wrong':m.op,ok:true};if(m.op==='prepare'&&hook.progress)for(let i=0;i<5;i++)this.onmessage({data:{v:1,generation:m.generation,id:m.id,event:'progress',detail:{phase:'preparing'}}});if(m.op==='prepare')Object.assign(r,{handle:selected?'selected-N1':'search-N1',artifactSha256:hook.wrongHash?'bad':selected?selectedEngine.artifactSha256:'world',...(selected?{}:{rawArtifactSha256:'raw'})});if(m.op==='run'){r.result=selected?{world:new Uint32Array(2916),trace:new Uint32Array(1048592)}:hook.badType?[1,2,3,4]:new Uint32Array([1,2,3,4]);if(hook.holdRun){hook.runAck=()=>this.onmessage({data:r});return;}}if(m.op==='release')r.released=true;if(m.op==='dispose'){Object.assign(r,{drained:true,disposed:true,destroyed:true,ownedBytes:0});if(hook.holdDispose){hook.ack=()=>this.onmessage({data:r});return;}}this.onmessage?.({data:r});});}}
 let selectedEngine;if(selected){const {loadWasmGpuInputContract}=await import('../src/wasm-gpu/input-contract.mjs');const b=new Uint8Array(await readFile(new URL('../dist/canonical-controller-assets/wasm-gpu-programs/input-selected-n1.json',import.meta.url))),j=JSON.parse(new TextDecoder().decode(b));selectedEngine=await loadWasmGpuInputContract(b,{kind:'selected',expectedSha256:createHash('sha256').update(b).digest('hex'),expectedSourceRevision:j.sourceRevision,expectedArtifactSha256:j.artifactSha256,expectedCount:1});}
 globalThis.Worker=Worker;globalThis.location={origin:'https://local.test'};globalThis.fetch=async()=>({ok:true,body:new ReadableStream({start(c){c.enqueue(bytes.slice());c.close();}})});
 let source=await readFile(new URL('../build-sources/runtime/src/canonical-integer-transport/compiled-worker-owner-client.mjs',import.meta.url),'utf8');source=source.replace("from'./native-batch-watchdog.mjs'","from'"+new URL('../build-sources/runtime/src/canonical-integer-transport/native-batch-watchdog.mjs',import.meta.url).href+"'");source=source.replace("from'./native-completion-batch.mjs'","from'"+new URL('../build-sources/runtime/src/canonical-integer-transport/native-completion-batch.mjs',import.meta.url).href+"'");source=source.replace("from'./native-reset-receipt.mjs'","from'"+new URL('../build-sources/runtime/src/canonical-integer-transport/native-reset-receipt.mjs',import.meta.url).href+"'");source=source.replace("from '../wasm-gpu/gpu-execution-diagnostics.mjs'","from '"+new URL('../src/wasm-gpu/gpu-execution-diagnostics.mjs',import.meta.url).href+"'");source=source.replace("from '../wasm-gpu/worker-owner-protocol.mjs'","from '"+new URL('../src/wasm-gpu/worker-owner-protocol.mjs',import.meta.url).href+"'");source=source.replace(/import\{WASM_GPU_BUILD_CONFIGURATION as programs\}from[^;]+;/,`const programs=${JSON.stringify({sourceRevision:revision,manifestSha256:manifest,relativeBase:'wasm-gpu-programs/'})};`).replace(/import\{WASM_GPU_WORKER_BUILD_CONFIGURATION as descriptor\}from[^;]+;/,`const descriptor=${JSON.stringify({sourceRevision:revision,programManifestSha256:manifest,file:'wasm-gpu-compute-worker.mjs',sha256:sha,byteLength:3})};`).replace(/import\{createCanonicalPreparationScope\}from[^;]+;/,`const createCanonicalPreparationScope=({signal}={})=>({signal:signal??new AbortController().signal,check(){if(signal?.aborted)throw Object.assign(Error('cancelled'),{name:'AbortError'});},dispose(){}});`).replaceAll('import.meta.url',"'https://local.test/assets/controller.js'");
 source=source.replace("from'../wasm-gpu/input-contract.mjs'","from'"+new URL('../src/wasm-gpu/input-contract.mjs',import.meta.url).href+"'").replace("from'./selected-run-watchdog.mjs'","from'"+new URL('../build-sources/runtime/src/canonical-integer-transport/selected-run-watchdog.mjs',import.meta.url).href+"'");
 if(requestTimeoutMs!==undefined){const timeoutExpression="op==='dispose'||op==='release'||op==='reset-selected-owner'?30000:600000";assert.ok(source.includes(timeoutExpression),"Test-only timeout replacement must match current client");source=source.replace(timeoutExpression,String(requestTimeoutMs));}
 if(clock){globalThis.__selectedClientFakeClock=clock;source='const performance=globalThis.__selectedClientFakeClock;const setTimeout=(f,ms)=>performance.setTimeout(f,ms),clearTimeout=id=>performance.clearTimeout(id);\n'+source;}
 const mod=await import('data:text/javascript;base64,'+Buffer.from(source+'\n//'+Math.random()).toString('base64'));
 return{...mod,events,hook,instance:()=>instance,restore(){Object.assign(globalThis,saved);delete globalThis.__selectedClientFakeClock;},args:selected?{engine:selectedEngine}:{engine:{artifactSha256:'world',count:1,lowered:{sourcePlan:{allocations:[{size:4,external:null}]},shared:[false]},structuralConfig:{uploadManifest:{allocations:[{role:'zero'}]}}},rawEngine:{artifactSha256:'raw',allocations:[{bytes:4,role:'strikeScratch'}]}},input:()=>selected?{initialUploads:selectedEngine.allocations.map((a,index)=>{const initial=new Uint8Array(a.size),m=selectedEngine.initialization[index];if(m.kind==='fixed')initial.set(m.bytes);return{index,initial};})}:({initialUploads:[{index:0,initial:new Uint8Array(4)}],rawUploads:[{index:0,initial:new Uint8Array(4)}],candidateIds:new Uint32Array([1])})};}
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


test('Worker device loss preserves allowlisted native diagnostic snapshot for the page',async()=>{
 const f=await fixture();try{const endpoint=await f.createSealedWorkerOwnerEndpoint(),owner=await endpoint.prepare(f.args);f.hook.holdRun=true;const work=owner.run(f.input()),rejected=assert.rejects(work,/native loss/);await tick();
 const generation=f.events.find(([op])=>op==='init')[1].generation;
 f.instance().onmessage({data:{v:1,generation,event:'lost',error:{message:'native loss',deviceLoss:{reason:'unknown',message:'native loss',diagnostics:{nativeStage:'finish-map-pending',fulfilledFences:210,runElapsedMs:15000,userAgent:'test',untrusted:{bad:true}}}}}});
 await rejected;const d=(await endpoint.lost).diagnostics;assert.equal(d.nativeStage,'finish-map-pending');assert.equal(d.fulfilledFences,210);assert.equal(d.runElapsedMs,15000);assert.equal('untrusted'in d,false);assert.equal(f.events.filter(([op])=>op==='terminate').length,1);
 }finally{f.restore();}
});

function fakeClock(){let time=0,next=0;const timers=new Map();return{now:()=>time,setTimeout(fn,ms){timers.set(++next,{fn,at:time+ms});return next;},clearTimeout:id=>timers.delete(id),jump(t,{fire=true}={}){time=t;if(fire)for(const[id,item]of [...timers])if(item.at<=time){timers.delete(id);item.fn();}},timers};}
function progressDriver(f){const m=f.events.findLast(([op])=>op==='run')[1],count=f.args.engine.commandCount,chunks=Math.ceil(count/256);return(stage,index,commands,{event=stage==='chunk-submitted'?'progress':'execution',...changes}={})=>f.instance().onmessage({data:{v:1,generation:m.generation,id:m.id,event,detail:{executionStage:stage,generation:1,chunkIndex:index,chunkCount:chunks,submittedCommands:commands,totalCommands:count,runElapsedMs:0},...changes}});}
for(const failure of['inactivity','absolute','late-message','stale-id','wrong-generation','duplicate','cancel-freeze','cancel-expired'])test('compiled selected client timer integration '+failure,async()=>{
 const clock=fakeClock(),f=await fixture({selected:true,clock});try{const endpoint=await f.createSealedWorkerOwnerEndpoint(),owner=await endpoint.prepare(f.args);f.hook.holdRun=true;const work=owner.run(f.input()),rejected=assert.rejects(work);await tick();const send=progressDriver(f);send('upload',0,0);
 if(failure==='inactivity')clock.jump(600000);
 if(failure==='cancel-expired'){clock.jump(600000,{fire:false});assert.doesNotThrow(()=>owner.cancel());}
 if(failure==='late-message'){clock.jump(600000,{fire:false});send('chunk-encode-or-wait',1,0);}
 if(failure==='stale-id')send('chunk-encode-or-wait',1,0,{id:999});
 if(failure==='wrong-generation')send('chunk-encode-or-wait',1,0,{generation:999});
 if(failure==='duplicate'){send('chunk-encode-or-wait',1,0);send('chunk-submitted',1,256);send('chunk-submitted',1,256);}
 if(failure==='cancel-freeze'){owner.cancel();clock.jump(599999);send('chunk-encode-or-wait',1,0);send('chunk-submitted',1,256);clock.jump(600000);}
 if(failure==='absolute'){for(let i=1;i<=3;i++){clock.jump(i*590000);send('chunk-encode-or-wait',i,(i-1)*256);send('chunk-submitted',i,i*256);}clock.jump(1800000);}
 await rejected;assert.equal(endpoint.status().dead,true);assert.equal(clock.timers.size,0);assert.equal((await endpoint.lost).cleanupVerified,false);
 }finally{f.restore();}
});
test('compiled selected client progressing beyond600s completes under1800s and clears all timers',async()=>{const clock=fakeClock(),f=await fixture({selected:true,clock});try{const endpoint=await f.createSealedWorkerOwnerEndpoint(),owner=await endpoint.prepare(f.args);f.hook.holdRun=true;const work=owner.run(f.input());await tick();const send=progressDriver(f),n=f.args.engine.commandCount,chunks=Math.ceil(n/256);send('upload',0,0);for(let i=1;i<=chunks;i++){clock.jump(i*4500);send('chunk-encode-or-wait',i,(i-1)*256);send('chunk-submitted',i,Math.min(i*256,n));}send('finish-fence-and-readback',chunks,n);f.hook.runAck();assert.equal((await work).result.world.length,2916);assert.equal(endpoint.status().dead,false);assert.equal(clock.timers.size,0);await owner.dispose();await endpoint.destroy();assert.equal(clock.timers.size,0);}finally{f.restore();}});
