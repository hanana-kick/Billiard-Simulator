/** Candidate real-app compute Worker. PINS is a build-only, separately sealed module. */
import{PINS}from'compiled-app-build-pins';
import{createWasmGpuInputLibrary}from'compiled-app-runtime/wasm-gpu/input-library.mjs';
import{snapshotGPUEnvironment}from'compiled-app-runtime/wasm-gpu/gpu-execution-diagnostics.mjs';
import{loadCompiledFrontendResourcePolicy}from'compiled-app-runtime/canonical-integer-transport/frontend-resource-policy.mjs';
import{createExperimentalCompiledInputLibrary}from'compiled-app-runtime/canonical-integer-transport/compiled-program-library.mjs';
import{createNativeSelectedInputLibrary}from'compiled-app-runtime/canonical-integer-transport/native-selected-library.mjs';
import{createCompiledAppWorkerProtocol}from'compiled-app-runtime/canonical-integer-transport/compiled-app-worker-protocol.mjs';
let protocol=null,initialized=false,initializing=false,diagnostics=null;
const send=message=>{const transfers=[];const visit=x=>{if(!x||typeof x!=='object')return;if(ArrayBuffer.isView(x)){if(x.buffer instanceof ArrayBuffer&&!transfers.includes(x.buffer))transfers.push(x.buffer);return;}for(const v of Object.values(x))visit(v);};visit(message);self.postMessage(message,transfers);};
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
async function asset(base,name,digest,maximum,signal){
 if(!/^[A-Za-z0-9._-]+$/.test(name)||name.includes('..')||!/^[a-f0-9]{64}$/.test(digest)||!Number.isSafeInteger(maximum)||maximum<1)throw Error('Pinned bounded asset required');
 const url=new URL(name,base).href,r=await fetch(url,{signal,redirect:'error',cache:'no-store'});if(!r.ok||r.redirected||r.url!==url)throw Error('Exact same-origin compiled asset response required');
 const reader=r.body?.getReader();if(!reader)throw Error('Bounded response stream required');let length=0;const parts=[];
 try{for(;;){const{done,value}=await reader.read();if(signal?.aborted)throw new DOMException('Cancelled','AbortError');if(done)break;length+=value.length;if(length>maximum)throw Error('Compiled asset size exceeded');parts.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}parts.length=0;if(await sha(bytes)!==digest)throw Error('Compiled asset digest mismatch');if(signal?.aborted)throw new DOMException('Cancelled','AbortError');return bytes;
}
self.onmessage=async event=>{if(initialized){void protocol.handle(event.data);return;}try{
 if(initializing)throw Error('Worker initialization already pending');initializing=true;const m=event.data;
 if(!m||Object.keys(m).sort().join(',')!=='generation,op,programBaseURL,v'||m.v!==1||m.op!=='init'||!Number.isSafeInteger(m.generation)||m.generation<1||m.generation>0xffffffff)throw Error('Exact Worker initialization required');
 const base=new URL(m.programBaseURL);if(base.origin!==self.location.origin||!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||!base.pathname.endsWith('/wasm-gpu-programs/'))throw Error('Owned same-origin program delivery required');
 // Preserve original activation refusal before the controller replaces the live game.
 if(!navigator.gpu)throw Error('Worker WebGPU unavailable');let probe=await navigator.gpu.requestAdapter();if(!probe||probe.limits.maxStorageBuffersPerShaderStage<10)throw Error('Worker requires ten storage bindings');probe=null;
 const inputLibrary=await createWasmGpuInputLibrary({baseURL:base.href,expectedManifestSha256:PINS.inputManifestSHA256,expectedSourceRevision:PINS.physicsSourceRevision});
 const receiptBytes=await asset(base,PINS.resourceReceiptFile,PINS.resourceReceiptSHA256,65536),resourcePolicy=await loadCompiledFrontendResourcePolicy(receiptBytes,{expectedSHA256:PINS.resourceReceiptSHA256,expectedSourceRevision:PINS.physicsSourceRevision,expectedRuntimeRevision:PINS.runtimeRevision,expectedInputManifestSHA256:PINS.inputManifestSHA256});
 const moduleBytes=await asset(base,PINS.schedulerFile,PINS.schedulerSHA256,2*1024*1024);
 const loadCompiledLibrary=async(key,{signal}={})=>{const p=PINS.programs[key];if(!p||!['search-N1','search-N3','selected-N1'].includes(key))throw Error('Unregistered compiled profile');
  const manifestBytes=await asset(base,p.manifestFile,p.manifestSHA256,1024*1024,signal),compiledBytes=await asset(base,p.artifactFile,p.artifactSHA256,p.artifactByteLength,signal);
  const options={inputLibrary,manifestBytes,compiledBytes,expectedManifestSHA256:p.manifestSHA256,expectedPhysicsSourceRevision:PINS.physicsSourceRevision,expectedCompilerRevision:p.compilerRevision,expectedRuntimeRevision:PINS.runtimeRevision,signal};
  return key==='selected-N1'?createNativeSelectedInputLibrary({...options,expectedTransformRevision:p.transformRevision}):createExperimentalCompiledInputLibrary(options);
 };
 protocol=await createCompiledAppWorkerProtocol({inputLibrary,resourcePolicy,moduleBytes,loadCompiledLibrary,initialGeneration:m.generation,send,getDeviceDiagnostics:()=>diagnostics,requestDevice:async signal=>{
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');if(!navigator.gpu)throw Error('Worker WebGPU unavailable');const adapter=await navigator.gpu.requestAdapter();if(signal.aborted)throw new DOMException('Cancelled','AbortError');if(!adapter||adapter.limits.maxStorageBuffersPerShaderStage<10)throw Error('Worker requires ten storage bindings');
  const requiredLimits={maxStorageBuffersPerShaderStage:10},device=await adapter.requestDevice({requiredLimits});diagnostics=snapshotGPUEnvironment({navigator,adapter,device,requiredLimits,sourceRevision:PINS.physicsSourceRevision,manifestSha256:PINS.inputManifestSHA256});return device;
 }});initialized=true;send({v:1,generation:m.generation,event:'ready',sourceRevision:PINS.physicsSourceRevision,manifestSha256:PINS.inputManifestSHA256});
 }catch(error){send({v:1,event:'boot-error',error:{name:error.name,message:error.message}});}};
