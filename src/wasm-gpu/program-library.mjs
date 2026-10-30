import {WASM_GPU_COMMAND_CAPACITY,assertWasmGpuSchedulerLimits} from './scheduler-limits.mjs';
/** Bundled program integrity loader, NOT a reviewed physics/build seal.
 * expectedManifestSha256 must come from an independent trusted caller. A future
 * production owner must compare it to its own reviewed static build constant.
 * No GPU, factory capture, physics evaluation or external asset acquisition. */
import {loadWasmGpuEngineArtifact,canonicalEngineArtifactJSON} from './engine-artifact.mjs';
import {loadWasmGpuRawArtifact} from './raw-artifact.mjs';
import {loadWasmGpuSelectedArtifact,WASM_GPU_SELECTED_CONFIG,SELECTED_WORLD_RANGES} from './selected-artifact.mjs';
const owned=new WeakSet(),MAX_MANIFEST=2*1024*1024,MAX_ENCODED=8*1024*1024,MAX_DECODED=64*1024*1024;
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const freeze=(x,seen=new WeakSet())=>{if(x&&typeof x==='object'&&!seen.has(x)){seen.add(x);Object.values(x).forEach(v=>freeze(v,seen));Object.freeze(x);}return x;};
const same=(a,b)=>canonicalEngineArtifactJSON(a)===canonicalEngineArtifactJSON(b);
const abortError=signal=>{const e=new Error(String(signal?.reason??'Bundled program load aborted'));e.name='AbortError';return e;};
const check=signal=>{if(signal?.aborted)throw abortError(signal);};
function signalCheck(signal){if(signal!=null&&(typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'||typeof signal.aborted!=='boolean'))throw TypeError('AbortSignal required');check(signal);}
function abortable(promise,signal){if(!signal)return promise;check(signal);return new Promise((resolve,reject)=>{const stop=()=>reject(abortError(signal));signal.addEventListener('abort',stop,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',stop));});}
function assetURL(base,file){if(typeof file!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file)||file.includes('..'))throw Error('Bundled asset must be a flat safe filename');const url=new URL(file,base);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw Error('Bundled asset escaped base URL');return url.href;}
async function streamBytes(stream,{maximum,exact,signal}){
 if(!stream||typeof stream.getReader!=='function')throw TypeError('Bounded readable asset stream required');const reader=stream.getReader(),chunks=[];let length=0;
 try{while(true){check(signal);const {done,value}=await abortable(reader.read(),signal);if(done)break;if(!(value instanceof Uint8Array))throw Error('Byte stream required');length+=value.byteLength;if(length>maximum||exact!==undefined&&length>exact)throw RangeError('Bundled asset exceeds byte bound');chunks.push(value);}if(exact!==undefined&&length!==exact)throw Error('Bundled asset byte length mismatch');const output=new Uint8Array(length);let at=0;for(const chunk of chunks){output.set(chunk,at);at+=chunk.length;}return output;}catch(error){Promise.resolve(reader.cancel(error)).catch(()=>{});throw error;}finally{try{reader.releaseLock();}catch{}}
}
async function fetchBytes(fetcher,url,{maximum,exact,declaredLengths,signal}){
 check(signal);const response=await abortable(fetcher(url,{signal,redirect:'error',credentials:'same-origin',cache:'no-cache'}),signal);check(signal);
 if(!response?.ok)throw Error('Bundled asset fetch failed: '+(response?.status??'no response'));
 if(response.redirected||response.url&&response.url!==url)throw Error('Bundled asset redirect refused');
 // Content-Length describes the wire representation. Fetch transparently
 // decodes HTTP gzip/br/etc., so only identity responses may compare that
 // header with pinned file lengths. The decoded stream remains bounded below;
 // callers authenticate its exact length and SHA independently of headers.
 const encoding=response.headers?.get('content-encoding')?.trim().toLowerCase();
 const wireEncoded=!!encoding&&encoding.split(',').some(value=>value.trim()!=='identity');
 const length=response.headers?.get('content-length');if(length!==null&&length!==undefined&&(!/^\d+$/.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maximum||!wireEncoded&&(exact!==undefined&&Number(length)!==exact||declaredLengths&&!declaredLengths.includes(Number(length)))))throw Error('Bundled asset declared byte length mismatch: '+new URL(url).pathname.split('/').pop());
 return streamBytes(response.body,{maximum,exact,signal});
}
function fileDescriptor(d){if(!d||d.encoding!=='gzip'||!integer(d.byteLength,1,MAX_ENCODED)||!integer(d.decodedByteLength,1,MAX_DECODED)||![d.sha256,d.decodedSha256,d.artifactSha256].every(digest))throw Error('Exact compressed program descriptor required');}
async function fetchArtifact(fetcher,base,d,signal){
 fileDescriptor(d);
 // Fetch can transparently decode HTTP Content-Encoding while retaining the
 // compressed Content-Length header. Authorize bytes, never that header alone.
 const received=await fetchBytes(fetcher,assetURL(base,d.file),{maximum:Math.max(d.byteLength,d.decodedByteLength),declaredLengths:[d.byteLength,d.decodedByteLength],signal}),receivedHash=await hash(received);check(signal);
 let decoded;
 if(received.length===d.byteLength&&receivedHash===d.sha256){
  if(typeof DecompressionStream!=='function')throw Error('Gzip DecompressionStream unavailable');
  decoded=await streamBytes(new Blob([received]).stream().pipeThrough(new DecompressionStream('gzip')),{maximum:MAX_DECODED,exact:d.decodedByteLength,signal});
  if(await hash(decoded)!==d.decodedSha256)throw Error('Decoded program hash mismatch');
 }else if(received.length===d.decodedByteLength&&receivedHash===d.decodedSha256)decoded=received;
 else throw Error('Encoded program hash mismatch (nor authenticated decoded bytes)');
 check(signal);return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decoded));
}
function validateManifest(m,base){
 if(m?.format!=='wasm-gpu-program-assets-v1'||typeof m.sourceRevision!=='string'||!m.sourceRevision.trim()||!['caller-supplied-unverified','reviewed-source-snapshot'].includes(m.sourceVerification)||m.gpuExecutionQualified!==false||m.publicActivation!==false||m.profile!=='mmq2-cushion'||m.bodyCount!==4||!same(m.widths,[1,3])||!Array.isArray(m.programs)||m.programs.length!==2)throw Error('Unsupported unqualified bundled program manifest');
 const bounds=m.structuralBounds;if(!bounds||bounds.profile!==m.profile||bounds.strikeBackend!=='staged'||bounds.bodyCount!==4||bounds.maximumSteps!==2048||!integer(bounds.maxWorldSteps,1,128)||bounds.maximumCommands!==WASM_GPU_COMMAND_CAPACITY||!same(bounds.widths,[1,3]))throw Error('Manifest structural bounds mismatch');
 const widths=new Set(),files=new Set(['manifest.json']);const inputDescriptor=d=>{if(!d||Object.keys(d).sort().join(',')!=='byteLength,file,sha256'||!integer(d.byteLength,1,512*1024)||!digest(d.sha256))throw Error('Exact bounded input contract descriptor required');assetURL(base,d.file);if(files.has(d.file))throw Error('Duplicate bundled input filename');files.add(d.file);};for(const p of m.programs){if(![1,3].includes(p.count)||widths.has(p.count)||p.profile!==m.profile||p.bodyCount!==4||p.maximumSteps!==2048||!integer(p.commandCount,1,WASM_GPU_COMMAND_CAPACITY))throw Error('Manifest program selector mismatch');widths.add(p.count);for(const d of [p.world,p.raw]){fileDescriptor(d);assetURL(base,d.file);if(files.has(d.file))throw Error('Duplicate bundled program filename');files.add(d.file);}if(p.inputs!==undefined){if(!p.inputs||Object.keys(p.inputs).sort().join(',')!=='raw,world')throw Error('Exact world/raw input descriptors required');inputDescriptor(p.inputs.world);inputDescriptor(p.inputs.raw);}}
 if(m.selectedProgram!==undefined){const p=m.selectedProgram;if(!p||Object.entries(WASM_GPU_SELECTED_CONFIG).some(([key,value])=>p[key]!==value)||!integer(p.commandCount,1,WASM_GPU_COMMAND_CAPACITY)||!integer(p.totalOwnedBytes,1,12*1024*1024)||p.outputs?.world?.bytes!==11664||p.outputs?.trace?.bytes!==4194368||!same(p.outputs.world.ranges,SELECTED_WORLD_RANGES))throw Error('Selected manifest configuration/output mismatch');fileDescriptor(p.artifact);assetURL(base,p.artifact.file);if(files.has(p.artifact.file))throw Error('Duplicate selected filename');files.add(p.artifact.file);if(p.inputs!==undefined)inputDescriptor(p.inputs);}
 const s=m.scheduler;if(!s||!integer(s.byteLength,8,2*1024*1024)||!digest(s.sha256)||!digest(s.provenanceSha256)||s.sourceHashesVerified!==true)throw Error('Scheduler manifest descriptor required');for(const f of [s.file,s.provenanceFile]){assetURL(base,f);if(files.has(f))throw Error('Duplicate scheduler filename');files.add(f);}
}
const EXPECTED_IMPORTS=[{module:'bridge',name:'submit',kind:'function'}];
const EXPORT_NAMES=['memory','abi_version','cancel','capacity','commit','configure','cursor','dispose','generation','input_ptr','load','lose','max_chunk','repeats_left','start','state','step','stream_len'];
async function loadScheduler(fetcher,base,descriptor,signal){
 const bytes=await fetchBytes(fetcher,assetURL(base,descriptor.file),{maximum:2*1024*1024,exact:descriptor.byteLength,signal});if(await hash(bytes)!==descriptor.sha256)throw Error('Scheduler binary hash mismatch');
 const provenanceBytes=await fetchBytes(fetcher,assetURL(base,descriptor.provenanceFile),{maximum:64*1024,signal});if(await hash(provenanceBytes)!==descriptor.provenanceSha256)throw Error('Scheduler provenance hash mismatch');
 const p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(provenanceBytes));
 if(p.schema!=='billiard-wasm-gpu-build-v1'||p.abiVersion!==1||p.target!=='wasm32-unknown-unknown'||p.profile!=='release'||p.offline!==true||p.locked!==true||p.byteLength!==bytes.length||p.sha256!==descriptor.sha256||!same(p.imports,EXPECTED_IMPORTS))throw Error('Scheduler provenance/ABI mismatch');
 if(!p.sourceSha256||Object.keys(p.sourceSha256).sort().join(',')!==['Cargo.toml','Cargo.lock','src/lib.rs','build.mjs'].sort().join(',')||!Object.values(p.sourceSha256).every(digest))throw Error('Scheduler source provenance hashes required');
 check(signal);const module=await abortable(WebAssembly.compile(bytes),signal),imports=WebAssembly.Module.imports(module),exports=WebAssembly.Module.exports(module);
 if(!same(imports,EXPECTED_IMPORTS)||!same(imports,p.imports)||!same(exports,p.exports)||exports.length!==EXPORT_NAMES.length||EXPORT_NAMES.some(name=>!exports.some(e=>e.name===name&&e.kind===(name==='memory'?'memory':'function'))))throw Error('Actual scheduler ABI does not match provenance');
 // Constant ABI exports only: never call scheduler step/submit or GPU work.
 const instance=await abortable(WebAssembly.instantiate(module,{bridge:{submit(){throw Error('Scheduler ABI inspection cannot submit');}}}),signal);
 assertWasmGpuSchedulerLimits(instance.exports);check(signal);
 return {bytes,module,provenance:freeze(p)};
}
/** Concurrent callers share a pending download. A caller abort detaches only
 * that waiter; when no waiters remain the pending fetch is cancelled/evicted. */
function cached(cache,key,work,signal){
 signalCheck(signal);let entry=cache.get(key);if(!entry){entry={controller:new AbortController(),waiters:0,pending:true};cache.set(key,entry);entry.promise=Promise.resolve().then(()=>work(entry.controller.signal)).then(value=>{entry.pending=false;return value;},error=>{entry.pending=false;if(cache.get(key)===entry)cache.delete(key);throw error;});}
 entry.waiters++;return abortable(entry.promise,signal).finally(()=>{entry.waiters--;if(entry.pending&&entry.waiters===0){if(cache.get(key)===entry)cache.delete(key);entry.controller.abort('No remaining program load waiters');}});
}
export function assertIntegrityVerifiedWasmGpuProgramLibrary(library){if(!owned.has(library))throw TypeError('Owned integrity-verified program library required');return library;}
export async function createWasmGpuProgramLibrary({baseURL,expectedManifestSha256,expectedSourceRevision,fetch:fetcher=globalThis.fetch,signal}={}){
 signalCheck(signal);if(!digest(expectedManifestSha256)||typeof fetcher!=='function')throw TypeError('Independent manifest SHA256 and fetch implementation required');
 const base=new URL(baseURL);if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||!base.pathname.endsWith('/')||globalThis.location?.origin&&base.origin!==globalThis.location.origin)throw Error('Explicit same-origin bundled asset base URL required');
 const manifestBytes=await fetchBytes(fetcher,assetURL(base,'manifest.json'),{maximum:MAX_MANIFEST,signal});if(await hash(manifestBytes)!==expectedManifestSha256)throw Error('Manifest hash mismatch');check(signal);
 const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));validateManifest(manifest,base);if(expectedSourceRevision!==undefined&&expectedSourceRevision!==manifest.sourceRevision)throw Error('Manifest source revision mismatch');freeze(manifest);
 const scheduler=await loadScheduler(fetcher,base,manifest.scheduler,signal),programs=new Map();
 const library={manifest,manifestSha256:expectedManifestSha256,sourceRevision:manifest.sourceRevision,integrityVerified:true,sourceQualified:false,gpuExecutionQualified:false,productionEnabled:false,
  getScheduler(){return {moduleBytes:scheduler.bytes.slice(),module:scheduler.module,provenance:scheduler.provenance};},
  async lookupSelectedProgram(selector,{signal}={}){
   signalCheck(signal);const p=manifest.selectedProgram;
   if(!p)throw Error('Bundled selected program is unavailable');
   if(!selector||selector.sourceRevision!==manifest.sourceRevision||Object.entries(WASM_GPU_SELECTED_CONFIG).some(([key,value])=>selector[key]!==value))throw Error('Bundled selected selector/source mismatch');
   return cached(programs,'selected',async signal=>{
    const artifact=await fetchArtifact(fetcher,base,p.artifact,signal),engine=await loadWasmGpuSelectedArtifact(artifact,{expectedArtifactSha256:p.artifact.artifactSha256,expectedSourceRevision:manifest.sourceRevision,expectedStructuralConfig:WASM_GPU_SELECTED_CONFIG});check(signal);
    if(engine.commands.length!==p.commandCount||engine.resourcePlan.totalOwnedBytes!==p.totalOwnedBytes||!same(engine.outputs,p.outputs))throw Error('Selected manifest resource/output mismatch');
    return engine;
   },signal);
  },
  async lookupProgram(selector,{signal}={}){
   signalCheck(signal);const b=manifest.structuralBounds;
   if(!selector||selector.sourceRevision!==manifest.sourceRevision||![1,3].includes(selector.count)||selector.profile!==b.profile||selector.strikeBackend!==b.strikeBackend||selector.bodyCount!==4||selector.maximumSteps!==b.maximumSteps||selector.maxWorldSteps!==b.maxWorldSteps)throw Error('Bundled program selector/source mismatch');
   const count=selector.count;return cached(programs,count,async signal=>{const p=manifest.programs.find(p=>p.count===count);
    const world=await fetchArtifact(fetcher,base,p.world,signal),raw=await fetchArtifact(fetcher,base,p.raw,signal),config=world?.payload?.structuralConfig;
    const shape={profile:b.profile,strikeBackend:b.strikeBackend,bodyCount:4,maximumSteps:b.maximumSteps,maxWorldSteps:b.maxWorldSteps};
    if(!config||config.profile!==b.profile||config.strikeBackend!==b.strikeBackend||config.bodyCount!==4||config.maximumSteps!==b.maximumSteps||config.faultPolicy!=='atomic-per-access'||!same(config.uploadManifest?.shape,shape))throw Error('Bundled world configuration/layout mismatch');
    const engine=await loadWasmGpuEngineArtifact(world,{expectedArtifactSha256:p.world.artifactSha256,expectedSourceRevision:manifest.sourceRevision,expectedStructuralConfig:config,expectedCount:p.count});check(signal);
    const rawEngine=await loadWasmGpuRawArtifact(raw,{expectedArtifactSha256:p.raw.artifactSha256,expectedSourceRevision:manifest.sourceRevision,expectedCount:p.count,expectedMaximumSteps:p.maximumSteps});check(signal);
    if(engine.lowered.commands.length+rawEngine.commands.length!==p.commandCount)throw Error('Bundled combined command count mismatch');
    return Object.freeze({engine,rawEngine,integrityVerified:true,sourceQualified:false,gpuExecutionQualified:false,productionEnabled:false});
   },signal);
  }
 };
 Object.freeze(library);owned.add(library);return library;
}
