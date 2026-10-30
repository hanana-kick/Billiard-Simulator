/** Auxiliary TEST ONLY. No shader, command, upload, or production edits.
 * Hook before/after the ORIGINAL command at zero-based commandIndex. The hook
 * closes an open pass, copies immutable views, then lets original replay resume.
 * This necessarily adds pass boundaries: instrumented parity is a prerequisite.
 */
export function createSelectedDiagnosticCopies(device,plan,{artifactSHA256,baselineOwnedBytes,maximumOwnedBytes=12*1024*1024}={}){
 if(plan.artifactSHA256!==artifactSHA256||plan.baselineOwnedBytes!==baselineOwnedBytes||maximumOwnedBytes!==plan.maximumOwnedBytes||baselineOwnedBytes+plan.diagnosticBytes>maximumOwnedBytes||plan.totalEncodedCommands>131072)throw Error('Exact artifact/budget/capacity binding required');
 const byCommand=new Map();let expectedOffset=0;
 for(const row of plan.rows){if(row.destinationOffset!==expectedOffset||row.offset%4||row.size%4||row.size<4)throw Error('Contiguous aligned diagnostic views required');expectedOffset+=row.size;const key=row.commandIndex+':'+row.when;const list=byCommand.get(key)??[];list.push(row);byCommand.set(key,list);}
 if(expectedOffset!==plan.diagnosticBytes)throw Error('Diagnostic allocation mismatch');
 const destination=device.createBuffer({label:'test-only-bounded-selected-snapshots',size:plan.diagnosticBytes,usage:9}); // MAP_READ | COPY_DST
 let destroyed=false,finished=false,copies=0;const seen=new Set();
 return Object.freeze({
  bytes:plan.diagnosticBytes,
  snapshot(encoder,commandIndex,when,buffers,closePass){
   if(destroyed||finished)throw Error('Diagnostic owner unavailable');const key=commandIndex+':'+when,rows=byCommand.get(key);if(!rows)return;
   if(seen.has(key))throw Error('Duplicate snapshot position');seen.add(key);closePass();
   for(const r of rows){const b=buffers[r.buffer];if(!b||!(b.usage&4)||r.offset+r.size>b.size)throw Error('Exact COPY_SRC view required; usage changes forbidden');encoder.copyBufferToBuffer(b,r.offset,destination,r.destinationOffset,r.size);copies++;}
  },
  async finish(){
   if(destroyed||finished||copies!==plan.diagnosticCopyCount)throw Error('Incomplete or repeated diagnostic readback');finished=true;
   // Call only AFTER original final submit, readback, and result collection.
   await device.queue.onSubmittedWorkDone();let mapped=false;
   try{await destination.mapAsync(1);mapped=true;return new Uint32Array(destination.getMappedRange()).slice();}finally{if(mapped)destination.unmap();}
  },
  destroy(){if(!destroyed){destroyed=true;destination.destroy();}}
 });
}
