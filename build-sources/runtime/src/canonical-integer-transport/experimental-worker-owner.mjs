/** Explicit experimental N1 adapter. NOT selected/N3 admission or a default
 * Worker backend. Inputs always come from the current RPC, never pack.uploads.
 * Runtime-only imports: no parser/compiler and no host physics execution. */
import {assertCanonicalRuntimePack} from './program-artifact.mjs';
import {createParallelIntegerTransport} from './runtime-runner.mjs';
import {assertLoadedWasmGpuEngineArtifact} from '../wasm-gpu/engine-artifact.mjs';
import {assertLoadedWasmGpuRawArtifact} from '../wasm-gpu/raw-artifact.mjs';
import {snapshotWorkerOwnerInputs} from '../wasm-gpu/worker-owner-protocol.mjs';
import {prepareWasmGpuOwner} from '../wasm-gpu/owner-core.mjs';
import {subscribeDeviceLoss} from '../wasm-gpu/device-loss-subscriptions.mjs';
import {createDeviceLossWaiters} from '../wasm-gpu/device-loss-waiters.mjs';
const abortError=reason=>Object.assign(Error(String(reason??'Integer run cancelled')),{name:'AbortError'});
export async function prepareExperimentalIntegerSearchOwner({device,pack,engine,rawEngine,moduleBytes,maximumOwnedBytes=8*1024*1024,signal,onPrepareProgress}={}){
 assertCanonicalRuntimePack(pack);assertLoadedWasmGpuEngineArtifact(engine);assertLoadedWasmGpuRawArtifact(rawEngine);
 if(pack.count!==1||engine.count!==1||rawEngine.count!==1||maximumOwnedBytes!==8*1024*1024)throw Error('Experimental integer owner supports exact N1 search only');
 if(pack.sourceRevision!==engine.sourceRevision||pack.sourceRevision!==rawEngine.sourceRevision||pack.worldArtifactSHA256!==engine.artifactSha256||pack.rawArtifactSHA256!==rawEngine.artifactSha256)throw Error('Authenticated raw/world transport identities must match');
 if(signal?.aborted)throw abortError(signal.reason);
 if(onPrepareProgress!==undefined&&typeof onPrepareProgress!=='function')throw TypeError('Synchronous preparation observer required');
 const offsets=[],sizes={arena:0,atomic:0};for(const a of pack.arenas){const key=a.atomic?'atomic':'arena';offsets[a.id]=sizes[key];sizes[key]+=a.bytes/4;}
 const report=detail=>{if(signal?.aborted)throw abortError(signal.reason);const result=onPrepareProgress?.(Object.freeze(detail));if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw TypeError('Synchronous preparation observer required');}};
 report({stage:'integer-transport-prepare'});
 const transport=await createParallelIntegerTransport(device,{arenaWords:sizes.arena,atomicWords:sizes.atomic,maximumOwnedBytes});
 let active=null,closed=false,terminal=null,busy=false,lastGeneration=0,diagnostic=null;
 const waits=createDeviceLossWaiters();const unsubscribe=subscribeDeviceLoss(device,info=>{terminal=Error('GPU device lost: '+(info?.message??String(info)));active?.abort.abort(terminal.message);waits.deviceLost(terminal);});
 const check=()=>{if(closed)throw Error('Integer bridge disposed');if(terminal)throw terminal;};
 const guard=g=>{check();if(!active||active.generation!==g||active.abort.signal.aborted)throw abortError(active?.abort.signal.reason);};
 const exclusive=async fn=>{if(busy)throw Error('Concurrent integer bridge operation');busy=true;try{return await fn();}finally{busy=false;}};
 const fence=async()=>{await waits.wait(transport.drain());};
 const views=c=>c.views.map(v=>({binding:v.binding,offset:offsets[v.arena]+v.offsetBytes/4,length:v.sizeBytes/4}));
 async function execute(c,g){guard(g);diagnostic.nativeStage='integer-source-dispatch';const result=await waits.wait(transport.execute(pack.definitions[c.definition].compilation,views(c),{globalSize:c.invocations,signal:active.abort.signal,onSlice:detail=>{guard(g);diagnostic.integerSlices=detail.slices;}}));guard(g);if(result.complete!==true)throw Error('Incomplete integer source invocation');}
 const bridge={commandCount:pack.commands.length,
  beginRun({generation,arena,atomic}){return exclusive(async()=>{check();if(active||!Number.isSafeInteger(generation)||generation<=lastGeneration)throw Error('Fresh drained integer generation required');await fence();check();lastGeneration=generation;active={generation,cursor:0,abort:new AbortController()};diagnostic={generation,nativeStage:'integer-upload',submittedCommands:0,confirmedCommands:0};transport.upload(arena);transport.upload(atomic,true);});},
  encodeChunk(handles,g){return exclusive(async()=>{guard(g);if(!(handles instanceof Uint32Array)||!handles.length||handles.length>4096||handles.some((h,i)=>h!==active.cursor+i+1||h>pack.commands.length))throw Error('Exact ordered source command handles required');for(const h of handles){guard(g);const c=pack.commands[h-1];if(c.kind==='dispatch')await execute(c,g);else if(c.kind==='clear')for(const r of c.ranges)transport.clear(offsets[r.arena]+r.offsetBytes/4,r.sizeBytes/4);else throw Error('Unsupported integer source command');guard(g);active.cursor++;diagnostic.submittedCommands=active.cursor;}await fence();guard(g);diagnostic.confirmedCommands=active.cursor;});},
  finish(g){return exclusive(async()=>{guard(g);if(active.cursor!==pack.commands.length)throw Error('Incomplete source schedule');await execute(pack.finish,g);for(const c of pack.finish.copies)transport.copy(offsets[c.sourceArena]+c.sourceOffsetBytes/4,offsets[c.destinationArena]+c.destinationOffsetBytes/4,c.sizeBytes/4);diagnostic.nativeStage='integer-finish-fence';await fence();guard(g);diagnostic.nativeStage='integer-finish-readback';const words=await waits.wait(transport.readback());guard(g);if(!(words instanceof Uint32Array)||words.length!==sizes.arena)throw Error('Exact integer arena readback required');const output=words.slice(offsets[pack.readback],offsets[pack.readback]+4);active=null;return output;});},
  cancel(g){if(active?.generation===g)active.abort.abort('Integer run cancelled');},
  lose(error){terminal??=error instanceof Error?error:Error(String(error));active?.abort.abort(terminal.message);},
  drain(){return exclusive(async()=>{await fence();if(active?.abort.signal.aborted)active=null;});},
  dispose(){return exclusive(async()=>{if(closed)return;await fence();await transport.dispose();closed=true;active=null;unsubscribe();});},
  diagnostics:()=>diagnostic?Object.freeze({...diagnostic}):null,
 };
 try{report({stage:'integer-transport-ready',allocatedBytes:transport.ownedBytes});return await prepareWasmGpuOwner({moduleBytes,device,bridge,chunkSize:pack.chunkSize,signal,metadata:{ownsRaw:true,integerTransport:true,sourceRevision:pack.sourceRevision,transportArtifactSHA256:pack.artifactSHA256},snapshotRun(input){
   assertCanonicalRuntimePack(pack);
   const owned=snapshotWorkerOwnerInputs({program:'search',width:1,engine,rawEngine},input),arena=new Uint32Array(sizes.arena),atomic=new Uint32Array(sizes.atomic),seen=new Set();
   for(const [bank,list]of[['world',owned.initialUploads],['raw',owned.rawUploads]])for(const u of list){const id=pack.banks[bank][u.index],a=pack.arenas[id];if(!a||a.atomic||a.bytes!==u.initial.byteLength||seen.has(id))throw Error('Exact unique current upload arena required');seen.add(id);new Uint8Array(arena.buffer).set(u.initial,offsets[id]*4);}
   if(seen.size!==pack.arenas.filter(a=>a.bank==='world'||a.bank==='raw').length)throw Error('Complete current source arena reset required');
   arena.set(owned.candidateIds,offsets[pack.ids]);return{begin:{arena,atomic}};
  }});}catch(error){unsubscribe();try{await transport.drain();await transport.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Integer preparation cleanup failed');}throw error;}
}
