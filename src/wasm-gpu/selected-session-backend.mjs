/** Private selected-session harness. Full source readbacks only: never derive
 * state/trace from compact outcomes, run CPU dynamics, or grant qualification. */
import {validateCanonicalRequest,validateCanonicalCandidate} from '../direct-candidate/canonical-engine-contract.mjs';
import {snapshotCanonicalWorldContinuation,decorateCanonicalRawWorldGPUResult} from '../direct-candidate/canonical-world-continuation.mjs';
import {snapshotRawWorldBatch} from '../direct-candidate/deterministic-raw-world.mjs';
import {decodePreparedWorldReadback} from '../direct-candidate/deterministic-prepared-world-readback.mjs';
import {decodeSelectedWorldTraceV2GPU} from '../direct-candidate/canonical-selected-world-trace-v2-gpu.mjs';
import {assertLoadedWasmGpuSelectedArtifact,WASM_GPU_SELECTED_CONFIG} from './selected-artifact.mjs';
import {prepareWasmGpuSelectedInputs} from './selected-inputs.mjs';
import {prepareWasmGpuSelectedEngine} from './selected-engine.mjs';
const abortError=reason=>{const e=Error(String(reason??'Selected WASM invocation cancelled'));e.name='AbortError';return e;};
const signalCheck=signal=>{if(signal&&(typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw TypeError('AbortSignal required');if(signal?.aborted)throw abortError(signal.reason);};
export function createWasmGpuSelectedSessionBackendHarness({device,lookupProgram,moduleBytes,sourceRevision,maximumOwnedBytes,chunkSize=256,prepareEngine=prepareWasmGpuSelectedEngine}={}){
 if(typeof device?.lost?.then!=='function'||typeof lookupProgram!=='function'||typeof prepareEngine!=='function')throw TypeError('Exclusive device/program lookup/owner factory required');
 if(typeof sourceRevision!=='string'||!sourceRevision.trim())throw TypeError('Explicit descriptive source revision required');
 if(!Number.isSafeInteger(maximumOwnedBytes)||maximumOwnedBytes<1||maximumOwnedBytes>12*1024*1024)throw RangeError('Explicit aggregate selected budget up to12MiB required');
 if(!(moduleBytes instanceof ArrayBuffer)&&!ArrayBuffer.isView(moduleBytes))throw TypeError('Explicit bundled WASM bytes required');
 const bytes=moduleBytes instanceof ArrayBuffer?new Uint8Array(moduleBytes).slice():new Uint8Array(moduleBytes.buffer,moduleBytes.byteOffset,moduleBytes.byteLength).slice();
 let entry=null,tail=Promise.resolve(),active=null,lost=null,disposed=false,disposal=null,cancellation=0;
 const queue=fn=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;};
 const check=(ticket,signal)=>{if(disposed)throw Error('Selected backend disposed');if(lost)throw lost;if(ticket!==cancellation)throw abortError();signalCheck(signal);};
 Promise.resolve(device.lost).then(info=>{lost=Error('GPU device lost: '+(info?.message??'unknown'));active?.abort.abort(lost.message);},error=>{lost=error instanceof Error?error:Error(String(error));active?.abort.abort(lost.message);});
 function cancel(reason='Selected backend cancelled'){cancellation++;active?.abort.abort(reason);active?.owner?.cancel(reason);}
 async function evaluate({request,candidate,binding,batch,maximumRecords=256,signal,onProgress,onPrepareProgress}={}){
  const ticket=cancellation;check(ticket,signal);
  request=validateCanonicalRequest(request);candidate=validateCanonicalCandidate(request,candidate);
  const d=snapshotCanonicalWorldContinuation(binding),raw=snapshotRawWorldBatch(batch);
  if(binding.requestIdentity!==request.requestKey||binding.sceneIdentity!==request.sceneId||binding.epoch!==request.epoch||d.request.requestKey!==request.requestKey||batch.count!==1||batch.candidateKeys[0]!==candidate.candidateKey||raw.rawRows[0]!==candidate.candidateId)throw Error('Exact selected request/candidate/batch identity required');
  if(maximumRecords!==256)throw Error('Exact selected256 source record capsule required');
  return queue(async()=>{
   check(ticket,signal);const abort=new AbortController(),onAbort=()=>abort.abort(signal.reason),token={abort,owner:null};active=token;let phase='prepare';
   try{
    signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort();check(ticket,abort.signal);
    const program=await lookupProgram(Object.freeze({sourceRevision,...WASM_GPU_SELECTED_CONFIG}),{signal:abort.signal});check(ticket,abort.signal);
    const engine=assertLoadedWasmGpuSelectedArtifact(program?.engine??program);
    if(engine.sourceRevision!==sourceRevision||engine.resourcePlan.totalOwnedBytes>maximumOwnedBytes)throw Error('Selected program source/aggregate budget mismatch');
    const inputs=prepareWasmGpuSelectedInputs({engine,binding,batch,maximumRecords});
    if(entry&&entry.signature!==engine.artifactSha256)throw Error('Selected cache permits one exact program signature; dispose before replacement');
    if(!entry){
     const owner=await prepareEngine({device,moduleBytes:bytes,engine,maximumOwnedBytes,chunkSize,signal:abort.signal,onPrepareProgress});
     if(owner?.requiresExclusiveDevice!==true||owner?.selected!==true||typeof owner.run!=='function'||typeof owner.cancel!=='function'||typeof owner.dispose!=='function'){await owner?.dispose?.();throw Error('Exclusive selected WASM owner required');}
     entry={signature:engine.artifactSha256,owner,engine};
    }
    token.owner=entry.owner;if(entry.error)throw entry.error;check(ticket,abort.signal);
    phase='run';
    const output=await entry.owner.run({...inputs,signal:abort.signal,onProgress});check(ticket,abort.signal);
    phase='decode';
    const decoded=decodePreparedWorldReadback(output.result?.world,{journalBytes:4224,journalAuxBytes:4096,rawStatusBytes:64,ruleBytes:208});
    const trace=decodeSelectedWorldTraceV2GPU(output.result?.trace),status=decoded.rawHandoffStatus,b=batch.binding;
    if(status[0]!==candidate.candidateId||status[8]!==b.sceneKey||status[9]!==b.requestKey||trace.maximumRecords!==maximumRecords||trace.identity.candidateId!==candidate.candidateId||trace.identity.sceneKey!==b.sceneKey||trace.identity.requestKey!==b.requestKey||trace.identity.bodyCount!==request.slotToId.length)throw Error('Selected full readback/trace identity mismatch');
    if(status[1]===1&&(decoded.state[0]!==candidate.candidateId||decoded.state[3]!==request.slotToId.length||decoded.state[41]!==b.sceneKey||decoded.state[42]!==b.requestKey||request.slotToId.some((id,i)=>decoded.state[64+48*i]!==id)||decoded.state[5]<b.absoluteTick||decoded.state[5]>b.shotClock.deadlineTick||decoded.compactResult[0]!==candidate.candidateId))throw Error('Selected source roster/state/clock mismatch');
    const result=decorateCanonicalRawWorldGPUResult(binding,batch,{...decoded,selectedTraceGPU:trace});check(ticket,abort.signal);
    return Object.freeze({...result,buildRevision:sourceRevision,preparation:'wasm-program-selected',provenance:'injected-selected-program-harness',gpuExecutionQualified:false,productionEnabled:false,
      requestIdentity:request.requestKey,sceneIdentity:request.sceneId,epoch:request.epoch,candidateKey:candidate.candidateKey,
      metrics:Object.freeze({readbackBytes:engine.outputs.world.bytes+engine.outputs.trace.bytes,allocatedBytes:engine.resourcePlan.totalOwnedBytes,maximumOwnedBytes,hardwareVerified:false})});
   }catch(error){if(phase==='decode'&&entry){entry.error=error;await entry.owner.dispose();}throw error;}finally{try{signal?.removeEventListener('abort',onAbort);}finally{if(active===token)active=null;}}
  });
 }
 function dispose(){if(disposal)return disposal;disposed=true;cancel('Selected backend disposed');disposal=queue(async()=>{await entry?.owner.dispose();entry=null;});return disposal;}
 return Object.freeze({evaluate,cancel,dispose,sourceRevision,requiresExclusiveDevice:true,experimental:true,productionEnabled:false,gpuExecutionQualified:false,preparation:'wasm-program-selected',provenance:'injected-selected-program-harness'});
}
