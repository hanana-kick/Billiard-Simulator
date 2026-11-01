/** HOST-ONLY integration contract, not an admitted production backend. The future
 * authenticated loader must own plan construction; callers cannot authorize code.
 * No compiler or CPU physics is imported. Transport stubs test lifecycle only. */
export function createMicrocodeOwnerBridgeHarness({transport,plan}){
 let active=null,closed=false,lost=null,busy=false,diagnostic=null;
 const check=()=>{if(closed)throw Error('Disposed microcode bridge');if(lost)throw lost;};
 const guard=g=>{check();if(!active||active.generation!==g||active.cancelled)throw Object.assign(Error('Cancelled microcode run'),{name:'AbortError'});};
 async function exclusive(work){if(busy)throw Error('Concurrent microcode operation');busy=true;try{return await work();}finally{busy=false;}}
 async function dispatch(command,g){guard(g);diagnostic.nativeStage='integer-source-dispatch';const result=await transport.execute(command.program,command.views,{globalSize:command.globalSize,onSlice:()=>guard(g)});guard(g);if(result.complete!==true)throw Error('Incomplete integer source command');}
 async function command(c,g){if(c.kind==='dispatch')await dispatch(c,g);else if(c.kind==='clear')transport.clear(c.offset,c.words);else if(c.kind==='copy')transport.copy(c.source,c.destination,c.words);else throw Error('Unsupported transport command (including indirect)');}
 return Object.freeze({commandCount:plan.commands.length,
  beginRun({generation,arena,atomicArena}){return exclusive(async()=>{check();if(active)throw Error('Previous run must drain');if(!(arena instanceof Uint32Array)||arena.length!==plan.arenaWords||!(atomicArena instanceof Uint32Array)||atomicArena.length!==plan.atomicWords)throw Error('Complete fresh request arenas required');await transport.drain();check();transport.upload(arena.slice());transport.upload(atomicArena.slice(),true);active={generation,cursor:0,cancelled:false};diagnostic={generation,nativeStage:'integer-upload',submittedCommands:0,confirmedCommands:0};});},
  encodeChunk(handles,generation){return exclusive(async()=>{guard(generation);if(!(handles instanceof Uint32Array)||!handles.length||handles.some((h,i)=>h!==active.cursor+i+1||h>plan.commands.length))throw Error('Exact ordered source handles required');for(const handle of handles){guard(generation);await command(plan.commands[handle-1],generation);guard(generation);active.cursor++;diagnostic.submittedCommands=active.cursor;}await transport.drain();guard(generation);diagnostic.confirmedCommands=active.cursor;});},
  finish(generation){return exclusive(async()=>{guard(generation);if(active.cursor!==plan.commands.length)throw Error('Incomplete source graph');for(const c of plan.finish)await command(c,generation);await transport.drain();guard(generation);diagnostic.nativeStage='integer-readback';const arena=await transport.readback();guard(generation);if(!(arena instanceof Uint32Array)||arena.length!==plan.arenaWords)throw Error('Exact GPU arena readback required');const read=o=>{if(!Number.isSafeInteger(o.offset)||!Number.isSafeInteger(o.words)||o.offset<0||o.words<1||o.offset+o.words>arena.length)throw Error('Exact output view required');return arena.slice(o.offset,o.offset+o.words);};const result=plan.selected?{world:read(plan.outputs.world),trace:read(plan.outputs.trace)}:read(plan.outputs.compact);active=null;return result;});},
  cancel(g){if(active?.generation===g)active.cancelled=true;},lose(error){lost=error instanceof Error?error:Error(String(error));},
  drain(){return exclusive(async()=>{await transport.drain();if(active?.cancelled)active=null;});},
  dispose(){return exclusive(async()=>{if(closed)return;await transport.drain();await transport.dispose();closed=true;active=null;});},
  diagnostics:()=>diagnostic?Object.freeze({...diagnostic}):null,
 });
}
