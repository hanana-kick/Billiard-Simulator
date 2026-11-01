import {snapshotOwnedBytes} from './owned-bytes.mjs';
/** Explicit experimental width-profile owner over owned input-only metadata + compiledpack.
 * Not wired into Worker defaults. No original WGSL graph or compiler is loaded. */
import {assertCompiledSelectedEntry} from './selected-program-library.mjs';
import {createSelectedSchedulerTransport} from './selected-scheduler-runner.mjs';
import {prepareWasmGpuOwner} from '../wasm-gpu/owner-core.mjs';
import{assembleSelectedInputArena}from'./selected-input-arena.mjs';
import {snapshotSelectedInputs} from './selected-input-snapshot.mjs';
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function prepareCompiledSelectedInputOwner(options={}){
 if(Object.keys(options).some(k=>!['entry','device','moduleBytes','signal'].includes(k)))throw Error('No caller resource budget, graph or transport override');
 const {entry,device,moduleBytes,signal}=options;assertCompiledSelectedEntry(entry);
 const {pack,plan,engine}=entry;
 if(!(moduleBytes instanceof Uint8Array)||!(moduleBytes.buffer instanceof ArrayBuffer))throw Error('Owned scheduler module bytes required');
 const scheduler=snapshotOwnedBytes(moduleBytes,2*1024*1024);if(await sha(scheduler)!==entry.schedulerSHA256)throw Error('Scheduler module/runtime closure mismatch');
 if(signal?.aborted)throw Object.assign(Error(String(signal.reason)),{name:'AbortError'});
 const transport=await createSelectedSchedulerTransport(device,{plan,signal,initialArena:plan.arena,initialAtomicArena:new Uint32Array(plan.atomicArena.length)});
 let active=null,terminal=null,lastGeneration=0;
 const guard=g=>{if(terminal)throw terminal;if(!active||active.g!==g||active.cancelled)throw Object.assign(Error('Cancelled compiled owner'),{name:'AbortError'});};
 const bridge={commandCount:plan.commandCount,
  async beginRun({generation,arena,atomicArena}){if(active||!Number.isSafeInteger(generation)||generation<=lastGeneration)throw Error('Fresh drained compiled generation required');if(terminal)throw terminal;await transport.reset({arena,atomicArena});active={g:generation,cursor:0,cancelled:false};lastGeneration=generation;},
  async encodeChunk(handles,g){guard(g);if(!(handles instanceof Uint32Array)||!handles.length||handles.length>256||handles.some((h,i)=>h!==active.cursor+i+1||h>plan.commandCount))throw Error('Exact contiguous compiled source handles required');const result=await transport.runTo(handles[handles.length-1]);guard(g);if(result.completedOrdinal!==handles[handles.length-1])throw Error('GPU source cursor did not reach chunk goal');active.cursor=result.completedOrdinal;},
  async finish(g){guard(g);if(active.cursor!==plan.commandCount)throw Error('Incomplete compiled source graph');const result=await transport.finish();guard(g);if(!(result.world instanceof Uint32Array)||result.world.byteLength!==engine.outputs.world.bytes||!(result.trace instanceof Uint32Array)||result.trace.byteLength!==engine.outputs.trace.bytes||result.status.completedOrdinal!==plan.commandCount||result.status.final!==true)throw Error('Exact GPU full selected outputs required');active=null;return{world:result.world,trace:result.trace};},
  cancel(g){if(active?.g===g){active.cancelled=true;transport.cancel();}},lose(error){terminal??=error instanceof Error?error:Error(String(error));transport.cancel();},
  async drain(){await transport.drain();if(active?.cancelled)active=null;},dispose:()=>transport.dispose(),
  diagnostics(){const s=transport.status();return s.diagnostics?Object.freeze({...s.diagnostics,generation:active?.g??lastGeneration}):null;},
 };
 return prepareWasmGpuOwner({moduleBytes:scheduler,device,bridge,chunkSize:256,signal,metadata:{selected:true,integerTransport:true,sourceRevision:pack.sourceRevision,runtimeRevision:entry.runtimeRevision,totalOwnedBytes:entry.resources.totalOwnedBytes},snapshotRun(input){
  assertCompiledSelectedEntry(entry);const current=snapshotSelectedInputs(engine,input),arena=assembleSelectedInputArena(plan,current.initialUploads),atomicArena=new Uint32Array(plan.atomicArena.length);return{begin:{arena,atomicArena}};
 }});
}
