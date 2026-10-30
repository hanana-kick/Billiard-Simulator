/** Production assembly tests use a statically substituted TEST bundle and mock
 * dependencies, never runtime seal/owner injection or physical GPU execution.
 * Worker endpoints/empty result payloads below prove host lifecycle only; actual
 * transport, physical packing/readbacks and GPU qualification are separate tests. */
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {build} from 'esbuild';
import {createWasmGpuProductionRuntime,assertWasmGpuProductionRuntime} from '../src/wasm-gpu/production-runtime.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};},tick=()=>new Promise(r=>setImmediate(r));
async function bundle(t,{selectedBytes=9*1024*1024,sealRevision='test-sealed',configRevision='test-sealed',verification='reviewed-source-snapshot'}={}){
 const dir=await mkdtemp(join(tmpdir(),'wasm-runtime-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const hook={events:[],owners:[],endpoints:[],active:0,runGate:null,afterPrepare:null,destroyGate:null};globalThis.__wasmProductionTest=hook;t.after(()=>delete globalThis.__wasmProductionTest);
 const modules={
  'build-configuration.mjs':`export const WASM_GPU_BUILD_CONFIGURATION={sourceRevision:${JSON.stringify(configRevision)},manifestSha256:'${'a'.repeat(64)}',relativeBase:'wasm-gpu-programs/'};`,
  'experimental-live-world-build-seal.mjs':`export const LIVE_WORLD_UPLOAD_SOURCE_SEALED=true,LIVE_WORLD_UPLOAD_SOURCE_REVISION=${JSON.stringify(sealRevision)};`,
  'input-library.mjs':`const h=globalThis.__wasmProductionTest;const selected={artifactSha256:'selected',resourcePlan:{totalOwnedBytes:${selectedBytes}}};const programs=new Map([1,3].map(count=>[count,{engine:{artifactSha256:'world'+count,count,resources:{totalOwnedBytes:(count===3?4:2)*1024*1024}},rawEngine:{artifactSha256:'raw'+count}}]));const library={sourceRevision:'test-sealed',manifestSha256:'${'a'.repeat(64)}',manifest:{sourceVerification:${JSON.stringify(verification)},structuralBounds:{maxWorldSteps:128},selectedProgram:{}},lookupProgram:async s=>{h.events.push('lookup:search-N'+s.count);return programs.get(s.count);},lookupSelectedProgram:async()=>{h.events.push('lookup:selected');return selected;}};export const assertIntegrityVerifiedWasmGpuInputLibrary=x=>{if(x!==library)throw Error('brand');return x;};export async function createWasmGpuInputLibrary(){h.events.push('library');return library;}`,
  'worker-owner-client.mjs':`
   import {prepare} from 'test-owner';
   import {createCanonicalPreparationScope} from '../direct-candidate/canonical-page-preparation.mjs';
   const h=globalThis.__wasmProductionTest,owned=new WeakSet();
   export function assertWorkerOwnerEndpoint(endpoint){if(!owned.has(endpoint))throw TypeError('Owned sealed Worker endpoint required');return endpoint;}
   export async function createSealedWorkerOwnerEndpoint({signal}={}){
    const scope=createCanonicalPreparationScope({signal});try{scope.check();}finally{scope.dispose();}
    const ordinal=h.endpoints.length+1,record={ordinal,endpoint:null,destroyed:false};let resolveLost,disposal;
    const lost=new Promise(resolve=>{resolveLost=resolve;});record.lose=resolveLost;
    const endpoint=Object.freeze({kind:'sealed-worker-owner-endpoint-v1',lost,
     prepare(args){assertWorkerOwnerEndpoint(endpoint);if(args.device!==endpoint)throw Error('Wrong private Worker endpoint');return prepare(args);},
     destroy(){if(disposal)return disposal;disposal=(async()=>{if(h.active)throw Error('Worker destroy before drain');if(h.owners.some(owner=>owner.endpoint===endpoint&&!owner.dead))throw Error('Worker destroy before owner release');h.events.push('worker-destroy-start:'+ordinal);await h.destroyGate?.promise;record.destroyed=true;h.events.push('worker-destroy-ack:'+ordinal);resolveLost({reason:'destroyed',message:'Acknowledged host-only Worker retirement'});})();return disposal;},
    });record.endpoint=endpoint;owned.add(endpoint);h.endpoints.push(record);h.events.push('worker-create:'+ordinal);return h.returnUnbrandedEndpoint?Object.freeze({...endpoint}):endpoint;
   }`,
  'compact-search-backend.mjs':`import {assertWorkerOwnerEndpoint} from './worker-owner-client.mjs';export function createWasmGpuCompactSearchBackendHarness(o){assertWorkerOwnerEndpoint(o.workerEndpoint);if(Object.hasOwn(o,'moduleBytes'))throw Error('Main-thread scheduler bytes forbidden');let owner;const owners=new Set();return{async createEngine(device,args){if(device!==o.workerEndpoint)throw Error('Exact Worker scheduler required');const p=await o.lookupProgram({count:args.count});owner=await o.prepareEngine({...p,device,signal:args.signal,onPrepareProgress:args.onPrepareProgress});owners.add(owner);const own=owner;return{run:a=>own.run(a),dispose(){}};},cancel:r=>owner?.cancel(r),releaseOwners:async()=>{for(const o of owners)await o.dispose();owners.clear();owner=null;},dispose:async()=>{for(const o of owners)await o.dispose();}};}`,
  'selected-session-backend.mjs':`import {assertWorkerOwnerEndpoint} from './worker-owner-client.mjs';export function createWasmGpuSelectedSessionBackendHarness(o){assertWorkerOwnerEndpoint(o.workerEndpoint);if(o.device!==o.workerEndpoint||Object.hasOwn(o,'moduleBytes'))throw Error('Worker-owned scheduler without main-thread WASM bytes required');let owner,active;return{async evaluate(a){const abort=new AbortController(),relay=()=>abort.abort(a.signal.reason);active=abort;try{a.signal?.addEventListener('abort',relay,{once:true});if(a.signal?.aborted)relay();const engine=await o.lookupProgram({});owner=await o.prepareEngine({engine,device:o.device,signal:abort.signal,onPrepareProgress:a.onPrepareProgress});return await owner.run({...a,signal:abort.signal});}finally{a.signal?.removeEventListener('abort',relay);active=null;}},cancel:r=>{active?.abort(r);owner?.cancel(r);},releaseOwners:async()=>{await owner?.dispose();owner=null;},dispose:async()=>{active?.abort();await owner?.dispose();}};}`,
 };
 const ownerCode=`const h=globalThis.__wasmProductionTest;export async function prepare(args){if(Object.hasOwn(args,'moduleBytes'))throw Error('Worker preparation must not retain main-thread WASM');const name=args.rawEngine?'search-N'+args.engine.count:'selected';h.events.push('prepare:'+name);h.priming??=[];h.priming.push({name,artifact:args.primingSelectedEngine?.artifactSha256??null});args.onPrepareProgress?.({stage:'compile-start',pipelineIndex:1,totalPipelines:2,shaderBytes:1234,entryPoint:'main',label:name+'-1'});h.beforePrepare?.(name);if(h.prepareGate)await new Promise((resolve,reject)=>{const stop=()=>{const e=Error('prepare cancelled');e.name='AbortError';reject(e);};args.signal.addEventListener('abort',stop,{once:true});if(args.signal.aborted)stop();h.prepareGate.promise.then(()=>{args.signal.removeEventListener('abort',stop);resolve();});});args.onPrepareProgress?.({stage:'compile',completedPipelines:1,totalPipelines:2});const owner={endpoint:args.device,requiresExclusiveDevice:true,ownsRaw:true,selected:name==='selected',async run(a){if(h.active++)throw Error('overlapping device scopes');h.events.push('run:'+name);try{await h.runGate?.promise;if(a.signal?.aborted){const e=Error('drained abort');e.name='AbortError';throw e;}return{result:{}};}finally{h.active--;h.events.push('drained:'+name);}},cancel(){h.events.push('cancel:'+name);},async dispose(){if(h.active)throw Error('destroy before drain');if(owner.dead)return;owner.dead=true;h.events.push('dispose:'+name);},status(){return{};}};h.owners.push(owner);h.afterPrepare?.(name);return owner;}`;
 const outfile=join(dir,'runtime.mjs');await build({entryPoints:[resolve('src/wasm-gpu/production-runtime.mjs')],outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'static-test-substitution',setup(b){b.onResolve({filter:/^test-owner$/},()=>({path:'test-owner',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:ownerCode,loader:'js'}));b.onLoad({filter:/\.mjs$/},args=>{const name=args.path.split('/').at(-1);if(modules[name])return{contents:modules[name],loader:'js'};});}}]});
 const runtimeModule=await import(pathToFileURL(outfile).href);return{...runtimeModule,hook};
}
test('development build remains inert and cannot be forged with caller seal/configuration',async()=>{await assert.rejects(createWasmGpuProductionRuntime({device:{lost:new Promise(()=>{})},configuration:{sourceRevision:'forged'},seal:true}),/static build configuration/);assert.throws(()=>assertWasmGpuProductionRuntime({buildSealed:true}),/Owned/);});
test('sealed startup loads manifest only; exact programs prepare on first demand and reuse',async t=>{const x=await bundle(t),r=await x.createWasmGpuProductionRuntime();assert.deepEqual(x.hook.events,['worker-create:1','library']);assert.equal(r.status().coordinator.allocatedBytes,0);assert.equal(x.assertWasmGpuProductionRuntime(r,r.identity),r);assert.ok(Object.isFrozen(r.identity));assert.notEqual(r.identity,x.hook.endpoints[0].endpoint);assert.equal('destroy' in r.identity,false);assert.throws(()=>x.assertWasmGpuProductionRuntime(r,x.hook.endpoints[0].endpoint),/Owned/);assert.throws(()=>x.assertWasmGpuProductionRuntime(r,{...r.identity}),/Owned/);assert.throws(()=>x.assertWasmGpuProductionRuntime({...r}),/Owned/);await assert.rejects(r.createSearchEngine({},{}),/compute identity/);
 await r.createSearchEngine(r.identity,{count:3});await r.createSearchEngine(r.identity,{count:3});assert.deepEqual(x.hook.events.filter(e=>e.startsWith('prepare:')),['prepare:search-N3']);assert.equal(r.status().coordinator.allocatedBytes,4*1024*1024);
 await r.createSearchEngine(r.identity,{count:1});const selected=await r.createSelectedEngine(r.identity,{}, {request:{},candidate:{}});assert.equal(x.hook.owners.length,2);await selected.runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256});assert.equal(x.hook.owners.length,3);assert.equal(r.status().coordinator.allocatedBytes,9*1024*1024);assert.ok(x.hook.owners.slice(0,2).every(o=>o.dead));await r.dispose();assert.equal(r.status().coordinator.allocatedBytes,0);assert.ok(x.hook.owners.every(o=>o.dead));});
test('search and selected runtime owners never overlap device-global scope lifetimes',async t=>{const x=await bundle(t),r=await x.createWasmGpuProductionRuntime();x.hook.runGate=deferred();const search=await r.createSearchEngine(r.identity,{count:3}),selected=await r.createSelectedEngine(r.identity,{}, {request:{},candidate:{}});const a=search.run({}),b=selected.runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256});await tick();assert.deepEqual(x.hook.events.filter(e=>e.startsWith('run:')),['run:search-N3']);x.hook.runGate.resolve();await a;await b;assert.deepEqual(x.hook.events.filter(e=>e.startsWith('run:')),['run:search-N3','run:selected']);await r.dispose();});
test('runtime disposal cancels active work, drains owners, then awaits Worker destroy acknowledgement',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime(),view=await r.createSearchEngine(r.identity,{count:1});x.hook.runGate=deferred();x.hook.destroyGate=deferred();
 const run=view.run({}),rejected=assert.rejects(run);await tick();let disposed=false,lost=false;r.lost.then(()=>{lost=true;});const disposal=r.dispose();disposal.then(()=>{disposed=true;});
 await tick();assert.ok(x.hook.owners.every(o=>!o.dead));assert.equal(x.hook.endpoints.length,1);assert.equal(x.hook.endpoints[0].destroyed,false);assert.equal(disposed,false);
 x.hook.runGate.resolve();await rejected;await tick();assert.ok(x.hook.owners.every(o=>o.dead));assert.ok(x.hook.events.includes('worker-destroy-start:1'));assert.equal(x.hook.endpoints[0].destroyed,false);assert.equal(disposed,false);
 assert.equal(r.dispose(),disposal,'repeat disposal shares the pending acknowledgement');x.hook.destroyGate.resolve();await disposal;assert.equal(disposed,true);assert.equal(x.hook.endpoints[0].destroyed,true);assert.equal(lost,false,'acknowledged intentional Worker retirement is not a genuine loss');
});
test('mode switch releases previous group before next allocation, preserving per-owner budgets',async t=>{const x=await bundle(t,{selectedBytes:12*1024*1024}),r=await x.createWasmGpuProductionRuntime();await r.createSearchEngine(r.identity,{count:3});const selected=await r.createSelectedEngine(r.identity,{}, {request:{},candidate:{}});await selected.runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256});assert.equal(r.status().coordinator.allocatedBytes,12*1024*1024);await r.createSearchEngine(r.identity,{count:1});assert.equal(r.status().coordinator.allocatedBytes,2*1024*1024);assert.equal(x.hook.owners.length,3);assert.ok(x.hook.owners.slice(0,2).every(o=>o.dead));await r.dispose();});

test('post-prepare abort destroys just-created owner and releases budget; retry prepares fresh',async t=>{const x=await bundle(t),r=await x.createWasmGpuProductionRuntime(),abort=new AbortController();x.hook.afterPrepare=()=>abort.abort('after owner creation');await assert.rejects(r.createSearchEngine(r.identity,{count:1,signal:abort.signal}),{name:'AbortError'});assert.equal(x.hook.owners.length,1);assert.ok(x.hook.owners[0].dead);assert.equal(r.status().coordinator.allocatedBytes,0);x.hook.afterPrepare=null;await r.createSearchEngine(r.identity,{count:1});assert.equal(x.hook.owners.length,2);await r.dispose();});
test('cancelSearch aborts first demand preparation even without caller signal and permits retry',async t=>{const x=await bundle(t),r=await x.createWasmGpuProductionRuntime();x.hook.prepareGate=deferred();const creation=r.createSearchEngine(r.identity,{count:3}),rejected=assert.rejects(creation,{name:'AbortError'});await tick();r.cancelSearch('stop first use');await rejected;assert.equal(r.status().coordinator.allocatedBytes,0);x.hook.prepareGate.resolve();x.hook.prepareGate=null;await r.createSearchEngine(r.identity,{count:3});await r.dispose();});
test('static source mismatch and public dependency overrides fail before library loading',async t=>{const x=await bundle(t,{configRevision:'different'});await assert.rejects(x.createWasmGpuProductionRuntime(),/static build/);assert.equal(x.hook.events.length,0);});

test('an authenticated but unreviewed manifest cannot become a production runtime',async t=>{const x=await bundle(t,{verification:'caller-supplied-unverified'});await assert.rejects(x.createWasmGpuProductionRuntime(),/library mismatch/);assert.equal(x.hook.owners.length,0);});
test('sealed runtime rejects caller native device, Worker, library, fetch and owner overrides before creation',async t=>{const x=await bundle(t);for(const key of ['device','requestDevice','Worker','workerFactory','lookupProgram','fetchImpl','owner','library','configuration','seal'])await assert.rejects(x.createWasmGpuProductionRuntime({[key]:()=>{}}),/no caller/);assert.equal(x.hook.events.length,0);assert.equal(x.hook.endpoints.length,0);});
test('abort from final ready progress never exposes a runtime and waits Worker cleanup acknowledgement',async t=>{
 const x=await bundle(t),abort=new AbortController();x.hook.destroyGate=deferred();let settled=false;
 const creating=x.createWasmGpuProductionRuntime({signal:abort.signal,onProgress:e=>{if(e.phase==='ready')abort.abort('not ready');}}),rejected=assert.rejects(creating,{name:'AbortError'});creating.then(()=>{settled=true;},()=>{settled=true;});
 await tick();assert.equal(settled,false);assert.equal(x.hook.owners.length,0);assert.equal(x.hook.endpoints.length,1);assert.equal(x.hook.endpoints[0].destroyed,false);assert.ok(x.hook.events.includes('worker-destroy-start:1'));
 x.hook.destroyGate.resolve();await rejected;assert.equal(settled,true);assert.equal(x.hook.endpoints[0].destroyed,true);assert.ok(x.hook.owners.every(o=>o.dead));
});

test('first and later preparation failures retain program, active pipeline and native cause after cleanup',async t=>{
 for(const target of ['search-N3','search-N1','selected'])await t.test(target,async t=>{
  const x=await bundle(t),failure=Error('Live pipeline cache device lost: native lost');failure.deviceLoss=Object.freeze({reason:'unknown',message:'native lost'});failure.gpuPreparation=Object.freeze({stage:'shader-info',label:target+'-1',shaderBytes:1234,entryPoint:'main',elapsedMs:2});
  x.hook.beforePrepare=name=>{if(name===target)throw failure;};
  const r=await x.createWasmGpuProductionRuntime();const operation=target==='selected'?(await r.createSelectedEngine(r.identity,{}, {request:{},candidate:{}})).runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256}):r.createSearchEngine(r.identity,{count:target==='search-N3'?3:1});
  await assert.rejects(operation,error=>{
   assert.equal(error.cause,failure);assert.match(error.message,new RegExp(target));assert.match(error.message,/1\/2/);assert.match(error.message,/native lost/);
   assert.equal(error.gpuPreparation.program,target);assert.equal(error.gpuPreparation.stage,'shader-info');assert.equal(error.gpuPreparation.pipelineIndex,1);assert.equal(error.gpuPreparation.totalPipelines,2);assert.equal(error.gpuPreparation.shaderBytes,1234);assert.equal(error.gpuPreparation.entryPoint,'main');assert.equal(error.deviceLoss.reason,'unknown');assert.ok(error.gpuPreparation.elapsedMs>=0);return true;
  });assert.equal(r.status().coordinator.allocatedBytes,0);await r.dispose();assert.ok(x.hook.owners.every(o=>o.dead));
 });
});

test('hidden first demand is refused without GPU preparation; visible retry uses fresh scope',async t=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'document'),doc=new EventTarget();doc.hidden=false;doc.visibilityState='visible';Object.defineProperty(globalThis,'document',{value:doc,configurable:true});t.after(()=>{if(old)Object.defineProperty(globalThis,'document',old);else delete globalThis.document;});
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime();doc.hidden=true;doc.visibilityState='hidden';await assert.rejects(r.createSearchEngine(r.identity,{count:3}),{name:'AbortError'});assert.equal(x.hook.owners.length,0);assert.equal(r.status().coordinator.allocatedBytes,0);doc.hidden=false;doc.visibilityState='visible';await r.createSearchEngine(r.identity,{count:3});assert.equal(x.hook.owners.length,1);await r.dispose();
});
test('hiding during demand preparation aborts it, releases memory, and never auto-restarts',async t=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'document'),doc=new EventTarget();doc.hidden=false;doc.visibilityState='visible';Object.defineProperty(globalThis,'document',{value:doc,configurable:true});t.after(()=>{if(old)Object.defineProperty(globalThis,'document',old);else delete globalThis.document;});
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime();x.hook.prepareGate=deferred();const preparing=r.createSearchEngine(r.identity,{count:1}),rejected=assert.rejects(preparing,{name:'AbortError'});await tick();doc.hidden=true;doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));await rejected;assert.equal(r.status().coordinator.allocatedBytes,0);doc.hidden=false;doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(x.hook.events.filter(e=>e==='prepare:search-N1').length,1);x.hook.prepareGate.resolve();x.hook.prepareGate=null;await r.createSearchEngine(r.identity,{count:1});assert.equal(x.hook.events.filter(e=>e==='prepare:search-N1').length,2);await r.dispose();
});
test('dispose during demand compilation cancels waiter and drains reservation before completion',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime();x.hook.prepareGate=deferred();const pending=r.createSearchEngine(r.identity,{count:3}),rejected=assert.rejects(pending);await tick();const disposal=r.dispose();await rejected;await disposal;assert.equal(r.status().coordinator.allocatedBytes,0);assert.equal(r.status().coordinator.disposed,true);x.hook.prepareGate.resolve();await assert.rejects(r.createSearchEngine(r.identity,{count:3}),/disposed/);
});
test('device loss during first demand never publishes owner or reuses lost device',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime(),endpoint=x.hook.endpoints[0];x.hook.prepareGate=deferred();const pending=r.createSearchEngine(r.identity,{count:3}),rejected=assert.rejects(pending);await tick();endpoint.lose({reason:'unknown',message:'screen off device lost'});await rejected;assert.equal(r.status().coordinator.allocatedBytes,0);await assert.rejects(r.createSearchEngine(r.identity,{count:3}),/device lost/);x.hook.prepareGate.resolve();await r.dispose();
});
test('completed startup signal is not retained as lifetime authority for later demand',async t=>{
 const x=await bundle(t),startup=new AbortController(),r=await x.createWasmGpuProductionRuntime({signal:startup.signal});startup.abort('entry UI closed after install');await r.createSearchEngine(r.identity,{count:1});assert.equal(x.hook.owners.length,1);await r.dispose();
});
test('cached search cannot start physics while page is hidden',async t=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'document'),doc=new EventTarget();doc.hidden=false;doc.visibilityState='visible';Object.defineProperty(globalThis,'document',{value:doc,configurable:true});t.after(()=>{if(old)Object.defineProperty(globalThis,'document',old);else delete globalThis.document;});
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime(),view=await r.createSearchEngine(r.identity,{count:1});doc.hidden=true;doc.visibilityState='hidden';await assert.rejects(view.run({}),{name:'AbortError'});assert.equal(x.hook.events.filter(e=>e.startsWith('run:')).length,0);doc.hidden=false;doc.visibilityState='visible';await view.run({});assert.equal(x.hook.events.filter(e=>e.startsWith('run:')).length,1);await r.dispose();
});
test('concurrent same-program first demand prepares exactly one owner',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime();x.hook.prepareGate=deferred();const a=r.createSearchEngine(r.identity,{count:3}),b=r.createSearchEngine(r.identity,{count:3});await tick();assert.equal(x.hook.events.filter(e=>e==='prepare:search-N3').length,1);x.hook.prepareGate.resolve();await Promise.all([a,b]);assert.equal(x.hook.owners.length,1);assert.equal(r.status().coordinator.reservations,1);await r.dispose();
});
test('cancelSelected aborts its first preparation without poisoning explicit retry',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime(),view=await r.createSelectedEngine(r.identity,{}, {request:{},candidate:{}});x.hook.prepareGate=deferred();const a=view.runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256}),rejected=assert.rejects(a,{name:'AbortError'});await tick();r.cancelSelected('stop selected first use');await rejected;assert.equal(r.status().coordinator.allocatedBytes,0);x.hook.prepareGate.resolve();x.hook.prepareGate=null;await view.runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256});assert.equal(x.hook.owners.length,1);await r.dispose();
});
test('ordinary preparation failure releases reservation and next demand prepares valid fresh owner',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime();x.hook.beforePrepare=()=>{throw Error('validation failed');};await assert.rejects(r.createSearchEngine(r.identity,{count:3}),/validation failed/);assert.equal(r.status().coordinator.allocatedBytes,0);x.hook.beforePrepare=null;const view=await r.createSearchEngine(r.identity,{count:3});await view.run({});assert.equal(x.hook.owners.length,1);assert.ok(!x.hook.owners[0].dead);await r.dispose();
});
test('first-use progress reaches existing compact service compile observer',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime(),phases=[];await r.createSearchEngine(r.identity,{count:3,onCompilePhase:e=>phases.push(e)});assert.deepEqual(phases.map(e=>[e.stage,e.compileOrdinal,e.total,e.preparation]),[['start',0,2,'wasm-program'],['end',0,2,'wasm-program']]);await r.dispose();
});

test('activation stays shader-inert; search never loads or primes selected program',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime();assert.deepEqual(x.hook.events,['worker-create:1','library']);
 await r.createSearchEngine(r.identity,{count:3});assert.deepEqual(x.hook.priming,[{name:'search-N3',artifact:null}]);assert.equal(x.hook.owners.length,1);assert.ok(!x.hook.events.includes('lookup:selected'));
 await r.createSearchEngine(r.identity,{count:3});assert.equal(x.hook.priming.length,1);
 const selected=await r.createSelectedEngine(r.identity,{}, {request:{},candidate:{}});await selected.runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256});
 assert.deepEqual(x.hook.priming.at(-1),{name:'selected',artifact:null});await r.dispose();
});

test('retired search views reject without switching mode or using disposed owner',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime(),old=await r.createSearchEngine(r.identity,{count:3});
 const selected=await r.createSelectedEngine(r.identity,{}, {request:{},candidate:{}});await selected.runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256});
 const before=x.hook.owners.length;await assert.rejects(old.run({}),{name:'AbortError'});assert.equal(x.hook.owners.length,before);assert.equal(r.status().residentMode,'selected');
 const fresh=await r.createSearchEngine(r.identity,{count:3});await fresh.run({});assert.equal(x.hook.owners.length,before+1);await r.dispose();
});
test('queued mode switch waits cancelled submitted work drain before disposal or compilation',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime(),view=await r.createSearchEngine(r.identity,{count:3});x.hook.runGate=deferred();
 const running=view.run({}),rejected=assert.rejects(running,{name:'AbortError'});await tick();r.cancelSearch('switch');const selected=await r.createSelectedEngine(r.identity,{}, {request:{},candidate:{}}),next=selected.runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256});
 await tick();assert.equal(x.hook.owners.length,1);assert.ok(!x.hook.owners[0].dead);x.hook.runGate.resolve();await rejected;await next;
 const events=x.hook.events;assert.ok(events.indexOf('drained:search-N3')<events.indexOf('dispose:search-N3'));assert.ok(events.indexOf('dispose:search-N3')<events.indexOf('prepare:selected'));await r.dispose();
});
test('cancel queued selected mode prevents retirement and selected compilation',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime(),view=await r.createSearchEngine(r.identity,{count:3});x.hook.runGate=deferred();const running=view.run({});await tick();
 const selected=await r.createSelectedEngine(r.identity,{}, {request:{},candidate:{}}),next=selected.runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256}),rejected=assert.rejects(next,{name:'AbortError'});r.cancelSelected('cancel queued');x.hook.runGate.resolve();await running;await rejected;assert.equal(x.hook.owners.length,1);assert.equal(r.status().residentMode,'search');await r.dispose();
});


test('mode retirement requires Worker destroy acknowledgement before replacement creation or preparation',async t=>{
 const x=await bundle(t),r=await x.createWasmGpuProductionRuntime();await r.createSearchEngine(r.identity,{count:3});x.hook.destroyGate=deferred();
 const selected=await r.createSelectedEngine(r.identity,{}, {request:{},candidate:{}});let settled=false;const switching=selected.runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256});switching.then(()=>{settled=true;},()=>{settled=true;});
 await tick();assert.equal(x.hook.endpoints.length,1);assert.equal(x.hook.owners.length,1);assert.equal(x.hook.owners[0].dead,true);assert.equal(x.hook.endpoints[0].destroyed,false);assert.equal(settled,false);assert.equal(x.hook.events.includes('prepare:selected'),false);
 x.hook.destroyGate.resolve();await switching;assert.equal(x.hook.endpoints.length,2);assert.equal(x.hook.endpoints[0].destroyed,true);assert.equal(x.hook.endpoints[1].destroyed,false);assert.notEqual(x.hook.endpoints[0].endpoint,x.hook.endpoints[1].endpoint);
 assert.ok(x.hook.events.indexOf('dispose:search-N3')<x.hook.events.indexOf('worker-destroy-start:1'));assert.ok(x.hook.events.indexOf('worker-destroy-ack:1')<x.hook.events.indexOf('worker-create:2'));assert.ok(x.hook.events.indexOf('worker-create:2')<x.hook.events.indexOf('prepare:selected'));
 assert.equal(x.hook.events.filter(e=>e==='library').length,1,'verified program metadata remains shared without retaining old Worker ownership');await r.dispose();assert.ok(x.hook.endpoints.every(record=>record.destroyed));
});

test('an unbranded private endpoint fails before program admission and its failed construction is cleaned',async t=>{
 const x=await bundle(t);x.hook.returnUnbrandedEndpoint=true;await assert.rejects(x.createWasmGpuProductionRuntime(),/Owned sealed Worker endpoint/);
 assert.equal(x.hook.events.includes('library'),false);assert.equal(x.hook.owners.length,0);assert.equal(x.hook.endpoints.length,1);assert.equal(x.hook.endpoints[0].destroyed,true);
});

test('sealed host assembly never acquires main-thread native GPU objects during activation or mode changes',async t=>{
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),x=await bundle(t);let nativeCalls=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter(){nativeCalls++;throw Error('Main-thread native acquisition forbidden');}}}});
 try{
  const r=await x.createWasmGpuProductionRuntime();assert.equal(nativeCalls,0);assert.equal(x.hook.owners.length,0);
  await (await r.createSearchEngine(r.identity,{count:3})).run({});await (await r.createSelectedEngine(r.identity,{}, {request:{},candidate:{}})).runRaw({}, {selectedTrace:true,selectedTraceMaxRecords:256});await (await r.createSearchEngine(r.identity,{count:1})).run({});
  assert.equal(nativeCalls,0);assert.equal(x.hook.endpoints.length,3);assert.equal(r.status().deviceGenerations,3);await r.dispose();assert.ok(x.hook.endpoints.every(record=>record.destroyed));
 }finally{if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;}
});
