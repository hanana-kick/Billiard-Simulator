/** Host mocks only. Never requests an adapter or evaluates GPU/CPU physics. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWasmGpuWebGPUBridge} from '../src/wasm-gpu/webgpu-bridge.mjs';
import {planLiveWorldResources} from '../src/direct-candidate/experimental-live-world-resources.mjs';
import {createWasmGpuEngineArtifact,loadWasmGpuEngineArtifact} from '../src/wasm-gpu/engine-artifact.mjs';
async function fixture({repeat=1,definitionPadding=null}={}){
 const count=1,sizes=[768,64,32],shared=[false,false,false],entries=sizes.map((size,binding)=>({binding,buffer:binding,offset:0,size}));
 const source=entries.map((e,i)=>`@group(0) @binding(${i}) var<storage,${i===2?'read_write':'read'}> b${i}:array<u32>;`).join('')+'@compute @workgroup_size(1) fn main(){}';
 const sourcePlan={kind:'experimental-live-mmq1-graph-v1',strikeBackend:'staged',sourceQualified:false,nativeQualified:false,allocations:sizes.map((size,i)=>({size,usage:140,initial:new Uint8Array(size),external:i===0?'prepared':i===1?'status':null})),readback:2,definitions:[{source,ownership:entries.map(e=>({stride:sizes[e.buffer]/4,base:0,length:e.size/4}))}],commands:[{kind:'dispatch',definition:0,x:1,entries},{kind:'clear',buffer:2,offset:0,size:32}]};
 const definitions=[{code:source+'@group(0) @binding(3) var<storage,read_write> fault:array<atomic<u32>>;',faultBinding:3,layout:'auto'}],commands=structuredClone(sourcePlan.commands);if(repeat>1){sourcePlan.commands=Array(repeat).fill(sourcePlan.commands[0]);commands.splice(0,commands.length,...Array(repeat).fill(commands[0]));}
 if(definitionPadding){const base=definitions[0];definitions.splice(0,1,...definitionPadding.map(n=>({...base,code:base.code+'\n//'+'.'.repeat(n)})));sourcePlan.definitions=definitionPadding.map(n=>({...sourcePlan.definitions[0],source:source+'\n//'+'.'.repeat(n)}));commands.splice(0,commands.length,...definitions.map((_,definition)=>({kind:'dispatch',definition,x:1,entries})));sourcePlan.commands=structuredClone(commands);}
 const shape={strikeResult:[512,132],handoffInput:[64,136],rosterTemplate:[768,136],admitted:[4,136],budget:[16,136],prepared:[768,132],status:[64,132]};
 const rawAllocations={strikeBackend:'staged',effectiveMaximumSteps:0,sceneBytes:64,allocations:Object.entries(shape).map(([role,[bytes,usage]])=>({role,bytes,usage}))};
 const resources=planLiveWorldResources({plan:sourcePlan,shared,count,definitions,commands,rawAllocations});
 const structuralConfig={profile:'mmq1-no-cushion',strikeBackend:'staged'},sourceRevision='host-mock-structural-only';
 const {artifact}=await createWasmGpuEngineArtifact({count,lowered:{identity:'mock-host-only',sourcePlan,shared,definitions,commands,ownershipReport:{requiredStorageBuffersPerShaderStage:7}},rawAllocations,structuralConfig,sourceRevision});
 return loadWasmGpuEngineArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:sourceRevision,expectedStructuralConfig:structuralConfig,expectedCount:count});
}
function mock(engine){
 let lossResolve;const lost=new Promise(resolve=>lossResolve=resolve),buffers=[],groups=[],writes=[],events=[],waiters=[];let compiled=0,held=false;
 const device={lost,pushErrorScope(){},async popErrorScope(){return null;},limits:{...engine.resources.requiredLimits,minStorageBufferOffsetAlignment:256},
 createShaderModule:({code})=>({code,getCompilationInfo:async()=>({messages:[]})}),
 createBindGroupLayout:x=>x,createPipelineLayout:x=>x,
 async createComputePipelineAsync(){compiled++;return{getBindGroupLayout:()=>({})};},
 createBuffer({size,usage}){const bytes=new Uint8Array(size);const b={size,usage,bytes,dead:false,destroy(){events.push('destroy');b.dead=true;},mapAsync:async()=>{},getMappedRange:()=>bytes.buffer,unmap(){}};buffers.push(b);return b;},
 createBindGroup(x){groups.push(x);return x;},
 createCommandEncoder(){const out=[];return{beginComputePass(){return{setPipeline(){},setBindGroup(i,g){for(const e of g.entries)assert.equal(e.resource.buffer.dead,false);},dispatchWorkgroups(x,y){out.push(['dispatch',x,y]);},end(){}};},clearBuffer(b){out.push(['clear',b]);},copyBufferToBuffer(...args){out.push(['copy',...args]);},finish(){return out;}};},
 queue:{writeBuffer(b,offset,data){writes.push([b,new Uint8Array(data.buffer,data.byteOffset,data.byteLength).slice()]);b.bytes.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),offset);},submit(batch){events.push(['submit',batch]);},onSubmittedWorkDone(){if(!held)return Promise.resolve();return new Promise(resolve=>waiters.push(resolve));}}
 };
 return {device,buffers,groups,writes,events,get compiled(){return compiled;},hold(){held=true;},release(){held=false;for(const resolve of waiters.splice(0))resolve();},lose(){lossResolve({message:'test loss'});}};
}
async function setup(options={}){const engine=await fixture(options),m=mock(engine);const bridge=await createWasmGpuWebGPUBridge(m.device,{engine,maximumOwnedBytes:engine.resources.totalOwnedBytes,...options});const externalBuffers={prepared:m.device.createBuffer({size:768,usage:132}),status:m.device.createBuffer({size:64,usage:132})};return {engine,m,bridge,externalBuffers,run:generation=>({generation,initialUploads:[{index:2,initial:new Uint8Array(32).fill(generation)}],externalBuffers,candidateIds:new Uint32Array([generation])})};}

test('prepares exact pipelines once; sequential arenas reset and reuse buffers; never owns raw outputs',async()=>{
 const {m,bridge,run,externalBuffers}=await setup();const allocations=m.buffers.length,compiled=m.compiled;
 for(const generation of [1,2]){await bridge.beginRun(run(generation));assert.equal(m.buffers[0].bytes[0],generation);await bridge.encodeChunk(new Uint32Array([1,2]),generation);assert.equal((await bridge.finish(generation)).length,4);}
 assert.equal(m.buffers.length,allocations);assert.equal(m.compiled,compiled);assert.equal(compiled,2);assert.equal(m.writes.length,6);
 assert.deepEqual(m.writes[1][1],new Uint8Array(4));assert.deepEqual(m.writes[4][1],new Uint8Array(4));
 assert.equal(m.groups.length,3,'external groups renewed; internal gate retained');
 await bridge.dispose();assert.ok(m.buffers.slice(0,4).every(b=>b.dead));assert.equal(externalBuffers.prepared.dead,false);assert.equal(externalBuffers.status.dead,false);
});
test('generation, upload completeness, budget and exact command order fail closed',async()=>{
 const {bridge,run}=await setup();await assert.rejects(()=>bridge.beginRun({...run(1),initialUploads:[]}),/Every/);await bridge.beginRun(run(1));
 await assert.rejects(()=>bridge.encodeChunk(new Uint32Array([2]),1),/ordered/);await assert.rejects(()=>bridge.encodeChunk(new Uint32Array([1]),2),/Stale/);await assert.rejects(()=>bridge.finish(1),/Incomplete/);
 bridge.cancel(1);await bridge.drain();await assert.rejects(()=>bridge.beginRun(run(1)),/Fresh/);await bridge.beginRun(run(2));bridge.cancel(2);await bridge.drain();await bridge.dispose();
 const engine=await fixture(),m=mock(engine);await assert.rejects(()=>createWasmGpuWebGPUBridge(m.device,{engine,maximumOwnedBytes:engine.resources.totalOwnedBytes-1}),/budget/);assert.equal(m.compiled,0);
});
test('bounded chunks do not submit until prior completion; cancellation prevents waiting chunk submission',async()=>{
 const {bridge,m,run}=await setup();await bridge.beginRun(run(1));m.hold();await bridge.encodeChunk(new Uint32Array([1]),1);
 const next=bridge.encodeChunk(new Uint32Array([2]),1);await Promise.resolve();assert.equal(m.events.filter(x=>Array.isArray(x)).length,1);bridge.cancel(1);m.release();await assert.rejects(()=>next,/cancelled/);await bridge.drain();
 assert.equal(m.events.filter(x=>Array.isArray(x)).length,1);await bridge.beginRun(run(2));bridge.cancel(2);await bridge.drain();await bridge.dispose();
});
test('dispose drains submitted work before buffer destruction',async()=>{
 const {bridge,m,run}=await setup();await bridge.beginRun(run(1));m.hold();await bridge.encodeChunk(new Uint32Array([1]),1);bridge.cancel(1);const disposal=bridge.dispose();await Promise.resolve();assert.ok(m.buffers.every(b=>!b.dead));m.release();await disposal;assert.ok(m.buffers.slice(0,4).every(b=>b.dead));
});
test('device loss terminates waiting drain, rejects reuse, and permits destruction',async()=>{
 const {bridge,m,run}=await setup();await bridge.beginRun(run(1));m.hold();await bridge.encodeChunk(new Uint32Array([1]),1);const drain=bridge.drain();m.lose();await assert.rejects(()=>drain,/device lost/);await assert.rejects(()=>bridge.beginRun(run(2)),/device lost/);await bridge.dispose();assert.ok(m.buffers.slice(0,4).every(b=>b.dead));
});
test('logical loss does not pretend submitted GPU work has drained',async()=>{
 const {bridge,m,run}=await setup();await bridge.beginRun(run(1));m.hold();await bridge.encodeChunk(new Uint32Array([1]),1);bridge.lose('runtime failure');const disposal=bridge.dispose();await Promise.resolve();assert.ok(m.buffers.every(b=>!b.dead));m.release();await disposal;
});
test('two-slot queue remains bounded and retains order',async()=>{
 const {bridge,m,run}=await setup({maxInFlight:2});await bridge.beginRun(run(1));m.hold();await bridge.encodeChunk(new Uint32Array([1]),1);await bridge.encodeChunk(new Uint32Array([2]),1);const finished=bridge.finish(1);await Promise.resolve();assert.equal(m.events.filter(x=>Array.isArray(x)).length,2);m.release();await finished;assert.equal(m.events.filter(x=>Array.isArray(x)).length,3);await bridge.dispose();
});
test('actual bundled WASM schedules exact GPU bridge command chunks without physics execution',async()=>{
 const {readFile}=await import('node:fs/promises');const {instantiateWasmGpuRuntime}=await import('../src/wasm-gpu/runtime.mjs');
 const {bridge,m,run}=await setup();const runtime=await instantiateWasmGpuRuntime({moduleBytes:await readFile(new URL('../artifacts/wasm-gpu-runtime.wasm',import.meta.url)),bridge});
 runtime.load(new Uint32Array([1,2]));const {generation}=runtime.start();await bridge.beginRun(run(generation));assert.equal((await runtime.step(1)).cursor,1);assert.equal((await runtime.step(1)).state,'complete');await bridge.finish(generation);
 assert.equal(m.events.filter(x=>Array.isArray(x)).length,3);runtime.dispose();await bridge.dispose();
});
test('repeated identical command bindings deduplicate rather than allocate per command',async()=>{
 const {bridge,m,run}=await setup({repeat:1000});await bridge.beginRun(run(1));await bridge.encodeChunk(Uint32Array.from({length:1000},(_,i)=>i+1),1);assert.equal(m.groups.length,1);await bridge.finish(1);assert.equal(m.groups.length,2);await bridge.dispose();
});
test('pure gate generator stays byte-identical; partial clears preserve every candidate subrange',async()=>{
 const {liveBoundsResultGateSource,encodeWasmGpuClear}=await import('../src/wasm-gpu/webgpu-bridge.mjs');const canonical=await import('../src/direct-candidate/experimental-live-world-batch.mjs');
 for(const stride of [4,8,1024])assert.equal(liveBoundsResultGateSource(stride),canonical.liveBoundsResultGateSource(stride));
 const calls=[],buffer={size:96},encoder={clearBuffer:(...args)=>calls.push(args)};encodeWasmGpuClear(encoder,buffer,{offset:4,size:8},32,3);assert.deepEqual(calls,[[buffer,4,8],[buffer,36,8],[buffer,68,8]]);assert.throws(()=>encodeWasmGpuClear(encoder,buffer,{offset:28,size:8},32,3),/range/);
});
test('missing loss promise rejects before GPU allocation',async()=>{
 const engine=await fixture(),m=mock(engine);delete m.device.lost;await assert.rejects(()=>createWasmGpuWebGPUBridge(m.device,{engine,maximumOwnedBytes:1e6}),/loss promise/);assert.equal(m.buffers.length,0);
});
test('asynchronous GPU scope error rejects result despite fulfilled queue completion and poisons reuse',async()=>{
 const {bridge,m,run}=await setup();let depth=0,reported=false;m.device.pushErrorScope=()=>{depth++;};m.device.popErrorScope=async()=>{depth--;if(!reported){reported=true;return{message:'injected validation failure'};}return null;};
 await assert.rejects(()=>bridge.beginRun(run(1)),/injected validation/);assert.equal(depth,0);await assert.rejects(()=>bridge.beginRun(run(2)),/injected validation/);await bridge.dispose();assert.equal(depth,0);
});
test('finish never publishes compact words when popErrorScope reports asynchronous GPU failure',async()=>{
 const {bridge,m,run}=await setup();await bridge.beginRun(run(1));await bridge.encodeChunk(new Uint32Array([1,2]),1);let depth=0,once=true;m.device.pushErrorScope=()=>{depth++;};m.device.popErrorScope=async()=>{depth--;if(once){once=false;return{message:'finish validation failure'};}return null;};
 await assert.rejects(()=>bridge.finish(1),/finish validation/);assert.equal(depth,0);await assert.rejects(()=>bridge.beginRun(run(2)),/finish validation/);await bridge.dispose();
});
test('actual WASM cancellation reaches blocked bridge before its next GPU submission',async()=>{
 const {readFile}=await import('node:fs/promises');const {instantiateWasmGpuRuntime}=await import('../src/wasm-gpu/runtime.mjs');const {bridge,m,run}=await setup();
 const runtime=await instantiateWasmGpuRuntime({moduleBytes:await readFile(new URL('../artifacts/wasm-gpu-runtime.wasm',import.meta.url)),bridge});runtime.load([1,2]);const {generation}=runtime.start();await bridge.beginRun(run(generation));m.hold();await runtime.step(1);const waiting=runtime.step(1);await Promise.resolve();runtime.cancel();m.release();await assert.rejects(()=>waiting,/cancelled|rejected/);assert.equal(m.events.filter(x=>Array.isArray(x)).length,1);await bridge.drain();await bridge.dispose();
});
test('rejected completion fence permanently poisons arena even when removed by backpressure wait',async()=>{
 const {bridge,m,run}=await setup();await bridge.beginRun(run(1));let reject;m.device.queue.onSubmittedWorkDone=()=>new Promise((_,r)=>reject=r);await bridge.encodeChunk(new Uint32Array([1]),1);const blocked=bridge.encodeChunk(new Uint32Array([2]),1);reject(Error('queue completion failed'));await assert.rejects(()=>blocked,/completion failed/);bridge.cancel(1);await bridge.drain();await assert.rejects(()=>bridge.beginRun(run(2)),/completion failed/);await bridge.dispose();
});
test('scope failure after submission does not replace the real completion fence for disposal',async()=>{
 const {bridge,m,run}=await setup();await bridge.beginRun(run(1));m.hold();let once=true;m.device.popErrorScope=async()=>{if(once){once=false;return{message:'post-submit scope failure'};}return null;};await assert.rejects(()=>bridge.encodeChunk(new Uint32Array([1]),1),/post-submit/);
 const disposing=bridge.dispose();await Promise.resolve();assert.ok(m.buffers.every(b=>!b.dead));m.release();await disposing;assert.ok(m.buffers.slice(0,4).every(b=>b.dead));
});
for(const action of ['cancel','lose'])test('finish withholds mapped result when '+action+' occurs during asynchronous scope pops',async()=>{
 const {bridge,m,run}=await setup();await bridge.beginRun(run(1));await bridge.encodeChunk(new Uint32Array([1,2]),1);
 let release,entered;const waiting=new Promise(resolve=>entered=resolve);let first=true;m.device.popErrorScope=()=>{if(first){first=false;entered();return new Promise(resolve=>release=resolve);}return Promise.resolve(null);};
 const result=bridge.finish(1);await waiting;if(action==='cancel')bridge.cancel(1);else bridge.lose('lost after mapping');release(null);
 await assert.rejects(()=>result,action==='cancel'?/cancelled/:/lost after mapping/);await bridge.drain();await bridge.dispose();
});
test('combined owned raw/world arena preserves N3 dispatch axes, resets all buffers and reuses groups',async()=>{
 const h=await import('./helpers/wasm-gpu-fixture.mjs'),engine=await h.fixture({count:3,raw:true}),{engine:rawEngine}=await h.rawFixture(engine),m=h.mock(engine);
 const bridge=await createWasmGpuWebGPUBridge(m.device,{engine,rawEngine,maximumOwnedBytes:engine.resources.totalOwnedBytes});assert.equal(bridge.ownsRaw,true);assert.equal(bridge.commandCount,9);assert.equal(m.buffers.length,14);assert.equal(m.buffers.reduce((n,b)=>n+b.size,0),engine.resources.totalOwnedBytes);
 const run=generation=>({generation,initialUploads:[{index:2,initial:new Uint8Array(96).fill(generation)}],rawUploads:rawEngine.allocations.map((a,index)=>({index,initial:new Uint8Array(a.bytes).fill(generation)})),candidateIds:new Uint32Array([1,2,3])});
 for(const generation of [1,2]){await bridge.beginRun(run(generation));for(const b of m.buffers.slice(0,11))assert.equal(b.bytes[0],generation);await bridge.encodeChunk(Uint32Array.from({length:9},(_,i)=>i+1),generation);await bridge.finish(generation);}
 const submissions=m.events.filter(x=>Array.isArray(x));const dispatches=submissions[0][1][0].filter(x=>x[0]==='dispatch');assert.equal(dispatches.length,8);assert.ok(dispatches.slice(0,7).every(x=>x[2]===1));assert.equal(dispatches[7][2],3);assert.equal(m.groups.length,9,'raw+world+gate groups retained across runs');assert.equal(m.compiled,9);assert.equal(m.buffers.length,14);
 const handoff=m.groups[6].entries,world=m.groups[7].entries;assert.equal(handoff[4].resource.buffer,world[0].resource.buffer);assert.equal(handoff[5].resource.buffer,world[1].resource.buffer);await bridge.dispose();assert.ok(m.buffers.every(b=>b.dead));
});
test('combined mode requires complete raw resets and rejects mixing external buffers or artifact identities',async()=>{
 const h=await import('./helpers/wasm-gpu-fixture.mjs'),engine=await h.fixture({raw:true}),r=await h.rawFixture(engine),m=h.mock(engine),bridge=await createWasmGpuWebGPUBridge(m.device,{engine,rawEngine:r.engine,maximumOwnedBytes:engine.resources.totalOwnedBytes});
 const input={generation:1,initialUploads:[{index:2,initial:new Uint8Array(32)}],candidateIds:new Uint32Array([1]),rawUploads:r.engine.allocations.map((a,index)=>({index,initial:new Uint8Array(a.bytes)}))};
 await assert.rejects(()=>bridge.beginRun({...input,rawUploads:input.rawUploads.slice(1)}),/Every raw/);await assert.rejects(()=>bridge.beginRun({...input,externalBuffers:{}}),/not external/);await bridge.dispose();
 const {rawArtifactHash,loadWasmGpuRawArtifact}=await import('../src/wasm-gpu/raw-artifact.mjs');const altered=structuredClone(r.artifact);altered.payload.sourceRevision='different';altered.sha256=await rawArtifactHash(altered.payload);const other=await loadWasmGpuRawArtifact(altered,{...r.expectations,expectedSourceRevision:'different',expectedArtifactSha256:altered.sha256});const another=h.mock(engine);await assert.rejects(()=>createWasmGpuWebGPUBridge(another.device,{engine,rawEngine:other,maximumOwnedBytes:engine.resources.totalOwnedBytes}),/mismatch/);assert.equal(another.compiled,0);
});
test('single WASM command cap accounts for raw plus world and checks exact boundary',async()=>{
 const {validateWasmGpuCommandCount}=await import('../src/wasm-gpu/webgpu-bridge.mjs');assert.equal(validateWasmGpuCommandCount(65529,7),65536);assert.throws(()=>validateWasmGpuCommandCount(65530,7),/combined command/);for(const [world,raw]of [[0,7],[1,-1],[1,NaN],[Infinity,0],[1,1.5]])assert.throws(()=>validateWasmGpuCommandCount(world,raw),/combined command/);
});
test('preparation cancellation stops after held native compile settles without caching aborted kernel',async()=>{const engine=await fixture(),m=mock(engine),a=new AbortController();let resolve,started;const wait=new Promise(r=>resolve=r),begun=new Promise(r=>started=r),create=m.device.createComputePipelineAsync;m.device.createComputePipelineAsync=async d=>{const p=await create(d);started();await wait;return p;};const preparing=createWasmGpuWebGPUBridge(m.device,{engine,maximumOwnedBytes:1e6,signal:a.signal}),rejected=assert.rejects(preparing,{name:'AbortError'});await begun;a.abort();assert.equal(m.compiled,1);assert.equal(m.buffers.length,0);resolve();await rejected;assert.equal(m.compiled,1);m.device.createComputePipelineAsync=create;const progress=[],bridge=await createWasmGpuWebGPUBridge(m.device,{engine,maximumOwnedBytes:1e6,onPrepareProgress:p=>progress.push(p)});assert.equal(m.compiled,3);assert.equal(progress.filter(x=>x.stage==='compile').length,2);await bridge.dispose();});
test('world preparation callback failure or post-allocation cancellation destroys partial/all owned buffers',async()=>{for(const mode of ['throw','abort','scope-abort','async']){const engine=await fixture(),m=mock(engine),a=new AbortController();if(mode==='scope-abort')m.device.popErrorScope=async()=>{a.abort();return null;};await assert.rejects(()=>createWasmGpuWebGPUBridge(m.device,{engine,maximumOwnedBytes:1e6,signal:a.signal,onPrepareProgress:p=>{if(p.stage!=='allocate')return;if(mode==='throw')throw Error('prepare callback failed');if(mode==='abort')a.abort();if(mode==='async')return Promise.resolve();}}));assert.ok(m.buffers.length>0);assert.ok(m.buffers.every(b=>b.dead));}});


test('compile-start progress identifies pending first pipeline before native completion',async()=>{
 const engine=await fixture(),m=mock(engine),progress=[];let entered,release;const begun=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
 m.device.createComputePipelineAsync=async()=>{entered();await hold;return{getBindGroupLayout:()=>({})};};
 const pending=createWasmGpuWebGPUBridge(m.device,{engine,maximumOwnedBytes:engine.resources.totalOwnedBytes,onPrepareProgress:p=>progress.push(p)}),rejected=assert.rejects(pending,/device lost/);
 await begun;assert.equal(progress[0].stage,'compile-start');assert.equal(progress[0].pipelineIndex,1);assert.equal(progress[0].totalPipelines,2);assert.equal(progress[0].label,'result-gate-N1');assert.equal(progress[0].entryPoint,'main');assert.ok(progress[0].shaderBytes>0);assert.equal(progress.filter(p=>p.stage==='compile').length,0);
 m.lose();await rejected;release();assert.equal(m.buffers.length,0);
});

test('hidden preparation abandons unresolved allocation scopes but retains no live buffers',async()=>{
 const engine=await fixture(),m=mock(engine),a=new AbortController();let release,entered,pops=0;const hold=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 m.device.popErrorScope=()=>{pops++;entered();return hold;};
 const preparing=createWasmGpuWebGPUBridge(m.device,{engine,maximumOwnedBytes:8*1024*1024,signal:a.signal});await started;a.abort('screen hidden');
 await Promise.race([assert.rejects(preparing,{name:'AbortError'}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Preparation cleanup blocked')),1000))]);
 assert.equal(pops,3);assert.ok(m.buffers.length>0);assert.ok(m.buffers.every(b=>b.dead));assert.equal(m.events.filter(e=>Array.isArray(e)&&e[0]==='submit').length,0);release(null);
});

test('quarantined cached bridge rejects before native scopes and cleanup still drains real fences',async()=>{
 const {awaitLiveWorldPreparation}=await import('../src/direct-candidate/experimental-live-world-pipeline-cache.mjs');
 for(const submitted of [false,true]){
  const {bridge,m,run}=await setup();
  if(submitted){await bridge.beginRun(run(1));m.hold();await bridge.encodeChunk(new Uint32Array([1]),1);}
  await assert.rejects(awaitLiveWorldPreparation(m.device,new Promise(()=>{}),{stage:'pipeline-create',timeoutMs:15}),{code:'GPU_PREPARATION_TIMEOUT'});
  if(!submitted){m.lose();await new Promise(r=>setImmediate(r));}
  let scopes=0;m.device.pushErrorScope=()=>{scopes++;};m.device.popErrorScope=()=>{scopes++;return new Promise(()=>{});};
  await assert.rejects(bridge.beginRun(run(2)),{code:'GPU_PREPARATION_TIMEOUT'});assert.equal(scopes,0);
  let disposed=false;const cleanup=bridge.dispose().then(()=>{disposed=true;});await new Promise(r=>setImmediate(r));
  if(submitted){assert.equal(disposed,false);assert.ok(m.buffers.every(b=>!b.dead));m.release();}
  await cleanup;assert.equal(scopes,0);assert.ok(m.buffers.slice(0,4).every(b=>b.dead));
 }
});


test('heavy-first preparation preserves exact world definition source/layout and command slots',async()=>{
 const engine=await fixture({definitionPadding:[0,1200,600]}),m=mock(engine),compiled=[],used=[];
 m.device.createComputePipelineAsync=async d=>{compiled.push(d);return{code:d.compute.module.code,getBindGroupLayout:()=>({})};};
 const originalEncoder=m.device.createCommandEncoder;m.device.createCommandEncoder=()=>{const e=originalEncoder();const begin=e.beginComputePass;e.beginComputePass=()=>{const p=begin();p.setPipeline=v=>used.push(v.code);return p;};return e;};
 const progress=[],bridge=await createWasmGpuWebGPUBridge(m.device,{engine,maximumOwnedBytes:engine.resources.totalOwnedBytes,onPrepareProgress:p=>progress.push(p)});
 const starts=progress.filter(p=>p.stage==='compile-start');assert.deepEqual(starts.map(p=>p.label),['world-N1-2','world-N1-3','result-gate-N1','world-N1-1']);assert.deepEqual(starts.map(p=>p.pipelineIndex),[1,2,3,4]);
 for(const d of engine.lowered.definitions){const c=compiled.find(x=>x.compute.module.code===d.code);assert.ok(c);assert.equal(c.layout,d.layout);assert.equal(c.compute.entryPoint,'main');}
 const externalBuffers={prepared:m.device.createBuffer({size:768,usage:132}),status:m.device.createBuffer({size:64,usage:132})};
 await bridge.beginRun({generation:1,initialUploads:[{index:2,initial:new Uint8Array(32)}],externalBuffers,candidateIds:new Uint32Array([1])});await bridge.encodeChunk(new Uint32Array([1,2,3]),1);assert.deepEqual(used,engine.lowered.definitions.map(d=>d.code));await bridge.finish(1);await bridge.dispose();
});
test('heavy-first ordering is stable, byte-based and does not mutate definitions',async()=>{
 const {heavyFirstPipelineIndices}=await import('../src/wasm-gpu/pipeline-preparation-order.mjs');const definitions=Object.freeze([{code:'aa',layout:'a'},{code:'한',layout:'b'},{code:'bbb',layout:'c'},{code:'cc',layout:'d'}].map(Object.freeze));
 assert.deepEqual(heavyFirstPipelineIndices(definitions),[1,2,0,3]);assert.deepEqual(definitions.map(d=>d.layout),['a','b','c','d']);assert.throws(()=>heavyFirstPipelineIndices([{}]),/source/);
});
