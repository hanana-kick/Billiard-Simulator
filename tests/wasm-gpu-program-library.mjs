import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';import {gzipSync,gunzipSync,brotliCompressSync} from 'node:zlib';
import {buildWasmGpuProgramAssets} from '../tools/build-wasm-gpu-program-assets.mjs';
import {createWasmGpuProgramLibrary,assertIntegrityVerifiedWasmGpuProgramLibrary} from '../src/wasm-gpu/program-library.mjs';
import {canonicalEngineArtifactJSON} from '../src/wasm-gpu/engine-artifact.mjs';
import {WASM_GPU_SELECTED_CONFIG,assertLoadedWasmGpuSelectedArtifact,selectedArtifactJSON} from '../src/wasm-gpu/selected-artifact.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),baseURL='https://bundled.example.test/assets/wasm/';
const directory=await mkdtemp(join(tmpdir(),'wasm-program-library-'));await buildWasmGpuProgramAssets({outputDirectory:directory,sourceRevision:'unverified-library-host-test'});
const original=new Map(await Promise.all((await readdir(directory)).map(async name=>[name,await readFile(join(directory,name))])));await rm(directory,{recursive:true,force:true});
function fixture(){const files=new Map(original),requests=[];const fetch=async(url,options)=>{requests.push(url);assert.equal(options.redirect,'error');assert.equal(options.credentials,'same-origin');assert.ok(url.startsWith(baseURL));const name=url.slice(baseURL.length),bytes=files.get(name);return bytes?new Response(bytes,{status:200,headers:{'content-length':String(bytes.length)}}):new Response(null,{status:404});};return {files,requests,fetch};}
const options=f=>({baseURL,fetch:f.fetch,expectedManifestSha256:sha(f.files.get('manifest.json'))});
const selector=(library,count=1)=>({sourceRevision:library.sourceRevision,count,profile:'mmq2-cushion',strikeBackend:'staged',bodyCount:4,maximumSteps:2048,maxWorldSteps:library.manifest.structuralBounds.maxWorldSteps});
function alterManifest(f,mutate){const m=JSON.parse(f.files.get('manifest.json'));mutate(m);f.files.set('manifest.json',Buffer.from(JSON.stringify(m)));return m;}
function alterArtifact(f,kind,mutate){alterManifest(f,m=>{const d=m.programs[0][kind],a=JSON.parse(gunzipSync(f.files.get(d.file)));mutate(a);a.sha256=sha(kind==='world'?canonicalEngineArtifactJSON(a.payload):JSON.stringify(a.payload));const decoded=Buffer.from(JSON.stringify(a)),encoded=gzipSync(decoded);Object.assign(d,{artifactSha256:a.sha256,byteLength:encoded.length,sha256:sha(encoded),decodedByteLength:decoded.length,decodedSha256:sha(decoded)});f.files.set(d.file,encoded);});}
test('actual built bundled N1/N3 assets load with integrity-only brands and bounded reusable caches',async()=>{
 const f=fixture(),library=await createWasmGpuProgramLibrary(options(f));assert.equal(assertIntegrityVerifiedWasmGpuProgramLibrary(library),library);assert.equal(library.sourceQualified,false);assert.equal(library.gpuExecutionQualified,false);assert.equal(library.productionEnabled,false);assert.ok(Object.isFrozen(library.manifest));
 const first=await library.lookupProgram(selector(library)),again=await library.lookupProgram(selector(library)),three=await library.lookupProgram(selector(library,3));assert.equal(first,again);assert.equal(first.engine.count,1);assert.equal(three.engine.count,3);assert.equal(f.requests.length,7);assert.equal(first.engine.lowered.commands.length+first.rawEngine.commands.length,library.manifest.programs[0].commandCount);
 const scheduler=library.getScheduler(),expected=scheduler.moduleBytes.slice();scheduler.moduleBytes.fill(255);assert.deepEqual(library.getScheduler().moduleBytes,expected);assert.ok(scheduler.module instanceof WebAssembly.Module);assert.throws(()=>assertIntegrityVerifiedWasmGpuProgramLibrary({...library}),/Owned/);
});
test('trust root, source, selectors, safe filenames and browser same-origin checks fail closed',async()=>{
 const f=fixture();await assert.rejects(()=>createWasmGpuProgramLibrary({...options(f),expectedManifestSha256:'0'.repeat(64)}),/Manifest hash/);await assert.rejects(()=>createWasmGpuProgramLibrary({...options(f),expectedSourceRevision:'foreign'}),/source revision/);
 for(const file of ['../world.json.gz','https://foreign.test/x','%2e%2e','a/b','a?query']){const x=fixture();alterManifest(x,m=>{m.programs[0].world.file=file;});await assert.rejects(()=>createWasmGpuProgramLibrary(options(x)),/filename/);assert.equal(x.requests.length,1);}
 const x=fixture();alterManifest(x,m=>{m.programs[0].count=3;});await assert.rejects(()=>createWasmGpuProgramLibrary(options(x)),/selector/);
 const library=await createWasmGpuProgramLibrary(options(f));for(const delta of [{count:2},{sourceRevision:'stale'},{bodyCount:3},{maximumSteps:1},{maxWorldSteps:1},{profile:'foreign'}])await assert.rejects(()=>library.lookupProgram({...selector(library),...delta}),/selector/);
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'location');Object.defineProperty(globalThis,'location',{value:{origin:'https://different.test'},configurable:true});try{await assert.rejects(()=>createWasmGpuProgramLibrary(options(f)),/same-origin/);}finally{if(descriptor)Object.defineProperty(globalThis,'location',descriptor);else delete globalThis.location;}
});
test('encoded/decoded/internal hashes, source, layout and scheduler provenance are independently checked',async()=>{
 {const f=fixture(),m=JSON.parse(f.files.get('manifest.json')),file=m.programs[0].world.file;f.files.set(file,Buffer.from(f.files.get(file)));f.files.get(file)[20]^=1;const l=await createWasmGpuProgramLibrary(options(f));await assert.rejects(()=>l.lookupProgram(selector(l)),/Encoded program hash/);}
 {const f=fixture();alterManifest(f,m=>m.programs[0].world.decodedSha256='0'.repeat(64));const l=await createWasmGpuProgramLibrary(options(f));await assert.rejects(()=>l.lookupProgram(selector(l)),/Decoded program hash/);}
 {const f=fixture();alterManifest(f,m=>m.programs[0].world.artifactSha256='0'.repeat(64));const l=await createWasmGpuProgramLibrary(options(f));await assert.rejects(()=>l.lookupProgram(selector(l)),/hash mismatch/);}
 for(const mutate of [a=>a.payload.sourceRevision='foreign',a=>a.payload.lowered.definitions[0].layout={bindGroupLayouts:[]}]){const f=fixture();alterArtifact(f,'world',mutate);const l=await createWasmGpuProgramLibrary(options(f));await assert.rejects(()=>l.lookupProgram(selector(l)),/revision|layout|group/i);}
 {const f=fixture();alterManifest(f,m=>{const p=JSON.parse(f.files.get(m.scheduler.provenanceFile));p.abiVersion=2;const bytes=Buffer.from(JSON.stringify(p));f.files.set(m.scheduler.provenanceFile,bytes);m.scheduler.provenanceSha256=sha(bytes);});await assert.rejects(()=>createWasmGpuProgramLibrary(options(f)),/ABI/);}
 {const f=fixture(),m=JSON.parse(f.files.get('manifest.json')),file=m.scheduler.file;const bytes=Buffer.from(f.files.get(file));bytes[bytes.length-1]^=1;f.files.set(file,bytes);await assert.rejects(()=>createWasmGpuProgramLibrary(options(f)),/binary hash/);}
});
test('missing-file failure clears pending cache and valid retry succeeds',async()=>{
 const f=fixture(),l=await createWasmGpuProgramLibrary(options(f)),file=l.manifest.programs[0].world.file,bytes=f.files.get(file);f.files.delete(file);await assert.rejects(()=>l.lookupProgram(selector(l)),/fetch failed/);f.files.set(file,bytes);assert.equal((await l.lookupProgram(selector(l))).engine.count,1);
});
test('abort detaches shared waiters, last waiter abort clears pending cache, retry succeeds',async()=>{
 const f=fixture();let block=false,entered,release;const originalFetch=f.fetch;
 f.fetch=async(url,options)=>{if(block&&url.endsWith('world-n1.json.gz')){entered?.();await new Promise((resolve,reject)=>{release=resolve;options.signal.addEventListener('abort',()=>reject(new Error('mock native fetch aborted')),{once:true});});}return originalFetch(url,options);};
 const l=await createWasmGpuProgramLibrary(options(f));block=true;const enteredPromise=new Promise(resolve=>{entered=resolve;}),a=new AbortController(),first=l.lookupProgram(selector(l),{signal:a.signal});await enteredPromise;const second=l.lookupProgram(selector(l));a.abort('one caller');await assert.rejects(()=>first,{name:'AbortError'});block=false;release();assert.equal((await second).engine.count,1);
 const f2=fixture();let entered2;const enteredAgain=new Promise(resolve=>{entered2=resolve;}),fetch2=f2.fetch;let blocked=true;f2.fetch=(url,options)=>{if(blocked&&url.endsWith('world-n1.json.gz')){entered2();return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('mock native aborted')),{once:true}));}return fetch2(url,options);};
 const l2=await createWasmGpuProgramLibrary(options(f2)),b=new AbortController(),pending=l2.lookupProgram(selector(l2),{signal:b.signal});await enteredAgain;b.abort();await assert.rejects(()=>pending,{name:'AbortError'});blocked=false;assert.equal((await l2.lookupProgram(selector(l2))).engine.count,1);
 const already=new AbortController();already.abort();await assert.rejects(()=>l2.lookupProgram(selector(l2),{signal:already.signal}),{name:'AbortError'});
});
test('bounded streams reject wrong decoded lengths and redirects without GPU/capture calls',async()=>{
 const f=fixture();alterManifest(f,m=>m.programs[0].world.decodedByteLength=1);const l=await createWasmGpuProgramLibrary(options(f));await assert.rejects(()=>l.lookupProgram(selector(l)),/byte bound/);
 const x=fixture(),fetch=x.fetch;x.fetch=async(...args)=>{const response=await fetch(...args);Object.defineProperty(response,'redirected',{value:true});return response;};await assert.rejects(()=>createWasmGpuProgramLibrary(options(x)),/redirect/);
 const source=await readFile(new URL('../src/wasm-gpu/program-library.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/requestAdapter\(|requestDevice\(|createShaderModule\(|captureLiveWorldPlan|createRawWorldGPU/);
});

test('HTTP already-decompressed bodies require exact trusted decoded length and SHA',async()=>{
 const f=fixture(),fetch=f.fetch;f.fetch=async(url,options)=>{const response=await fetch(url,options);if(!url.endsWith('.json.gz'))return response;const encoded=f.files.get(url.slice(baseURL.length)),decoded=gunzipSync(encoded);return new Response(decoded,{headers:{'content-encoding':'gzip','content-length':String(encoded.length)}});};
 const l=await createWasmGpuProgramLibrary(options(f));assert.equal((await l.lookupProgram(selector(l))).engine.count,1);
 const bad=fixture(),fetchBad=bad.fetch;bad.fetch=async(url,options)=>{const response=await fetchBad(url,options);if(!url.endsWith('.json.gz'))return response;const encoded=bad.files.get(url.slice(baseURL.length)),decoded=gunzipSync(encoded);decoded[50]^=1;return new Response(decoded,{headers:{'content-encoding':'gzip','content-length':String(encoded.length)}});};
 const failed=await createWasmGpuProgramLibrary(options(bad));await assert.rejects(()=>failed.lookupProgram(selector(failed)),/hash mismatch/);
});

test('bundled selected program exact public config, outputs and identity are authenticated and cached',async()=>{
 const f=fixture(),l=await createWasmGpuProgramLibrary(options(f));assert.ok(l.manifest.selectedProgram,'actual builder includes selected asset');const wanted={sourceRevision:l.sourceRevision,...WASM_GPU_SELECTED_CONFIG};
 const engine=await l.lookupSelectedProgram(wanted);assert.equal(assertLoadedWasmGpuSelectedArtifact(engine),engine);assert.equal(engine.count,1);assert.equal(engine.commands.length,l.manifest.selectedProgram.commandCount);assert.deepEqual(engine.outputs,l.manifest.selectedProgram.outputs);assert.equal(engine.productionEnabled,false);assert.equal(await l.lookupSelectedProgram(wanted),engine);
 for(const patch of [{count:3},{bodyCount:3},{maximumRecords:255},{maxWorldSteps:127},{maximumSteps:2047},{sourceRevision:'foreign'}])await assert.rejects(()=>l.lookupSelectedProgram({...wanted,...patch}),/selector/);
 const plain=fixture(),fetch=plain.fetch;plain.fetch=async(url,options)=>{const response=await fetch(url,options);if(!url.endsWith('selected-n1.json.gz'))return response;const encoded=plain.files.get('selected-n1.json.gz');return new Response(gunzipSync(encoded),{headers:{'content-encoding':'gzip','content-length':String(encoded.length)}});};const lp=await createWasmGpuProgramLibrary(options(plain));assert.equal((await lp.lookupSelectedProgram(wanted)).commands.length,engine.commands.length);
});

test('selected missing/tampered/config/output mismatch and failed cache retry are fail closed',async()=>{
 const f=fixture(),l=await createWasmGpuProgramLibrary(options(f)),p=l.manifest.selectedProgram,wanted={sourceRevision:l.sourceRevision,...WASM_GPU_SELECTED_CONFIG},bytes=f.files.get(p.artifact.file);f.files.delete(p.artifact.file);await assert.rejects(()=>l.lookupSelectedProgram(wanted),/fetch failed/);f.files.set(p.artifact.file,bytes);assert.equal((await l.lookupSelectedProgram(wanted)).count,1);
 {const x=fixture();alterManifest(x,m=>m.selectedProgram.maximumRecords=255);await assert.rejects(()=>createWasmGpuProgramLibrary(options(x)),/Selected manifest/);}
 {const x=fixture();alterManifest(x,m=>m.selectedProgram.totalOwnedBytes+=4);const lib=await createWasmGpuProgramLibrary(options(x));await assert.rejects(()=>lib.lookupSelectedProgram(wanted),/resource\/output/);}
 {const x=fixture();alterManifest(x,m=>{const d=m.selectedProgram.artifact,a=JSON.parse(gunzipSync(x.files.get(d.file)));a.payload.sourceRevision='foreign';a.sha256=sha(selectedArtifactJSON(a.payload));const decoded=Buffer.from(JSON.stringify(a)),encoded=gzipSync(decoded);Object.assign(d,{artifactSha256:a.sha256,byteLength:encoded.length,sha256:sha(encoded),decodedByteLength:decoded.length,decodedSha256:sha(decoded)});x.files.set(d.file,encoded);});const lib=await createWasmGpuProgramLibrary(options(x));await assert.rejects(()=>lib.lookupSelectedProgram(wanted),/source\/configuration/);}
 {const x=fixture();alterManifest(x,m=>delete m.selectedProgram);const lib=await createWasmGpuProgramLibrary(options(x));await assert.rejects(()=>lib.lookupSelectedProgram(wanted),/unavailable/);}
});

test('reviewed-source tag remains integrity-only; production authority is not granted by loader',async()=>{
 const f=fixture();alterManifest(f,m=>m.sourceVerification='reviewed-source-snapshot');const library=await createWasmGpuProgramLibrary(options(f));assert.equal(library.manifest.sourceVerification,'reviewed-source-snapshot');assert.equal(library.integrityVerified,true);assert.equal(library.sourceQualified,false);assert.equal(library.productionEnabled,false);
});


test('HTTP-compressed scheduler accepts decoded bytes, not compressed Content-Length',async()=>{
 for(const [encoding,compress] of [['gzip',gzipSync],['br',brotliCompressSync]]){
  const f=fixture(),fetch=f.fetch,m=JSON.parse(f.files.get('manifest.json')),bytes=f.files.get(m.scheduler.file);
  assert.notEqual(compress(bytes).length,bytes.length);
  f.fetch=async(url,options)=>{const response=await fetch(url,options);if(!url.endsWith(m.scheduler.file))return response;return new Response(bytes,{headers:{'content-encoding':encoding,'content-length':String(compress(bytes).length)}});};
  const library=await createWasmGpuProgramLibrary(options(f));assert.deepEqual(library.getScheduler().moduleBytes,new Uint8Array(bytes));
 }
});

test('HTTP-compressed scheduler still rejects truncated, oversized and tampered decoded bodies',async()=>{
 for(const variant of ['truncated','oversized','tampered']){
  const f=fixture(),fetch=f.fetch,m=JSON.parse(f.files.get('manifest.json')),original=f.files.get(m.scheduler.file);let bytes=Buffer.from(original);
  if(variant==='truncated')bytes=bytes.subarray(0,bytes.length-1);else if(variant==='oversized')bytes=Buffer.concat([bytes,Buffer.from([0])]);else bytes[50]^=1;
  f.fetch=async(url,options)=>{const response=await fetch(url,options);if(!url.endsWith(m.scheduler.file))return response;return new Response(bytes,{headers:{'content-encoding':'gzip','content-length':String(gzipSync(bytes).length)}});};
  await assert.rejects(()=>createWasmGpuProgramLibrary(options(f)),variant==='tampered'?/binary hash/:/byte (length mismatch|bound)/);
 }
});

test('identity scheduler still checks declared length and HTTP encoding cannot bypass stream limits',async()=>{
 for(const encoding of [undefined,'identity']){
  const f=fixture(),fetch=f.fetch,m=JSON.parse(f.files.get('manifest.json'));
  f.fetch=async(url,options)=>{const response=await fetch(url,options);if(!url.endsWith(m.scheduler.file))return response;const headers={'content-length':'6858'};if(encoding)headers['content-encoding']=encoding;return new Response(f.files.get(m.scheduler.file),{headers});};
  await assert.rejects(()=>createWasmGpuProgramLibrary(options(f)),/declared byte length mismatch: wasm-gpu-runtime.wasm/);
 }
 for(const length of ['invalid','9007199254740992','2097153']){
  const f=fixture();f.fetch=async()=>new Response(new Uint8Array(1),{headers:{'content-encoding':'br','content-length':length}});
  await assert.rejects(()=>createWasmGpuProgramLibrary(options(f)),/declared byte length mismatch: manifest.json/);
 }
 {const f=fixture();f.fetch=async()=>new Response(new Uint8Array(2097153),{headers:{'content-encoding':'gzip','content-length':'1'}});await assert.rejects(()=>createWasmGpuProgramLibrary(options(f)),/exceeds byte bound/);}
});

test('CDN recompression of artifact bytes is authenticated after transparent HTTP decoding',async()=>{
 for(const decodedArtifact of [false,true]){
  const f=fixture(),fetch=f.fetch;f.fetch=async(url,options)=>{const response=await fetch(url,options);if(!url.endsWith('.json.gz'))return response;const encoded=f.files.get(url.slice(baseURL.length)),bytes=decodedArtifact?gunzipSync(encoded):encoded;return new Response(bytes,{headers:{'content-encoding':'br','content-length':String(brotliCompressSync(bytes).length)}});};
  const library=await createWasmGpuProgramLibrary(options(f));assert.equal((await library.lookupProgram(selector(library))).engine.count,1);assert.equal((await library.lookupSelectedProgram({sourceRevision:library.sourceRevision,...WASM_GPU_SELECTED_CONFIG})).count,1);
 }
});
