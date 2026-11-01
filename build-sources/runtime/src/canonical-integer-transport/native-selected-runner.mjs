import{assertNativeSelectedProgram}from'./native-selected-program.mjs';
import{nextNativeOperation}from'./native-selected-coverage.mjs';
import{snapshotOwnedBytes}from'./owned-bytes.mjs';
const abort=()=>Object.assign(Error('Native selected run cancelled'),{name:'AbortError'});
const bounded=async(p,ms)=>{let t;try{return await Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Native GPU operation deadline')),ms);})]);}finally{clearTimeout(t);}};
/** Exclusive, original native GPU command executor. No fixture inputs or CPU physics. */
export async function createNativeSelectedTransport(device,{program,signal,onPrepareProgress}={}){
 assertNativeSelectedProgram(program);if(!device?.queue||device.limits.maxStorageBuffersPerShaderStage<10)throw Error('Native ten-storage-binding device required');
 for(const n of program.resources.bufferBytes)if(n>device.limits.maxBufferSize)throw Error('Native buffer device limit');
 let closing=false,disposePromise=null,cancelled=false,disposed=false,loss=null,pending=Promise.resolve(),cursor=0,published=0,rawTerminal=false,initialized=false,runBusy=false;
 let healthError=null,mapsOpen=0,cancelVersion=0,resetSequence=0;const latch=e=>{healthError??=e instanceof Error?e:Error(String(e));return healthError;};
 let actualOperations=0,identityCommands=0,fusedReduction=0,fencedSourceBoundary=0,sourceQueueSubmissions=0,sourceQueueFences=0;const buffers=[],pipelines=new Map(),groups=new Map();let staging,parameters;
 device.lost.then(info=>{loss={reason:String(info.reason),message:String(info.message)};});
 const check=()=>{if(closing||disposed||loss)throw Error('Native device unavailable');if(healthError)throw healthError;if(cancelled||signal?.aborted)throw abort();};
 const fence=async()=>{try{await bounded(device.queue.onSubmittedWorkDone(),15000);}catch(e){throw latch(e);}};
 async function scoped(fn,{allowCancelled=false}={}){for(const t of['validation','internal','out-of-memory'])device.pushErrorScope(t);let result,error;try{result=await fn();}catch(e){error=e;if(e?.name!=='AbortError')latch(e);}const errors=[];for(let i=0;i<3;i++){try{const e=await bounded(device.popErrorScope(),15000);if(e)errors.push(String(e.message));}catch(e){errors.push(String(e?.message??e));}}if(errors.length)latch(Error('Native GPU scope: '+errors.join('; ')));if(healthError)throw healthError;if(error)throw error;if(allowCancelled){if(closing||disposed||loss||signal?.aborted)throw Error('Native reset unavailable');}else check();return result;}

 const prepareStarted=performance.now();
 try{await scoped(async()=>{
  for(const[dIndex,d]of program.definitions.entries()){
   check();const remaining=180000-(performance.now()-prepareStarted);if(remaining<=0)throw Error('Native preparation exceeds bounded 180 seconds');
   onPrepareProgress?.({program:'selected',nativeTransport:true,nativeArtifactSHA256:program.artifactSHA256,transformRevision:program.transformRevision,stage:'compile-start',pipelineIndex:dIndex,completedPipelines:dIndex,totalPipelines:program.definitions.length});
   const module=device.createShaderModule({code:d.code,label:'native-selected-'+d.id});const info=await bounded(module.getCompilationInfo(),remaining);if(info.messages.some(m=>m.type==='error'))throw Error('Native shader validation: '+info.messages.filter(m=>m.type==='error').map(m=>m.message).join(';'));
   const layout=d.layout==='auto'?'auto':device.createPipelineLayout({bindGroupLayouts:d.layout.bindGroupLayouts.map(x=>device.createBindGroupLayout(x))});
   pipelines.set(d.id,await bounded(device.createComputePipelineAsync({layout,compute:{module,entryPoint:d.entryPoint,constants:d.constants}}),Math.max(1,180000-(performance.now()-prepareStarted))));check();
   onPrepareProgress?.({program:'selected',nativeTransport:true,nativeArtifactSHA256:program.artifactSHA256,transformRevision:program.transformRevision,stage:'compile',pipelineIndex:dIndex,completedPipelines:dIndex+1,totalPipelines:program.definitions.length});
  }
  for(const[aIndex,a]of program.allocations.entries()){check();buffers.push(device.createBuffer({size:a.size,usage:aIndex===3?program.rawIdentity.diagnosticUsage:a.usage,label:a.label}));onPrepareProgress?.({program:'selected',nativeTransport:true,nativeArtifactSHA256:program.artifactSHA256,transformRevision:program.transformRevision,stage:'allocate',allocatedBuffers:aIndex+1,totalBuffers:234});}
  staging=device.createBuffer({size:262208,usage:9});parameters=device.createBuffer({size:512,usage:72});device.queue.writeBuffer(parameters,0,new Uint32Array([1,0,0,0]));device.queue.writeBuffer(parameters,256,new Uint32Array([16,0,0,0]));
  function group(id,entries,iterations=0){const key=id+':'+entries+':'+iterations;if(groups.has(key))return;const list=program.bindings[entries].map(v=>({binding:v.binding,resource:{buffer:buffers[v.buffer],offset:v.offset,size:v.size}}));if(id===1000)list.push({binding:5,resource:{buffer:parameters,offset:iterations===1?0:256,size:16}});groups.set(key,device.createBindGroup({layout:pipelines.get(id).getBindGroupLayout(0),entries:list}));}
  for(const c of program.dictionary)if(c.kind==='dispatch')group(c.definition,c.entries);for(const g of program.fusionGroups){group(1000,g.entries,1);group(1000,g.entries,16);}await fence();
 });}catch(error){try{await fence();}catch(cleanup){if(!loss)throw new AggregateError([error,cleanup],'Native preparation cleanup quarantined until device retirement');}for(const b of buffers)b.destroy();staging?.destroy();parameters?.destroy();throw error;}
 const preparationMilliseconds=performance.now()-prepareStarted;
 async function mapped(buffer,offset,size){try{await bounded(buffer.mapAsync(1,offset,size),15000);mapsOpen++;try{return new Uint32Array(buffer.getMappedRange(offset,size).slice(0));}finally{buffer.unmap();mapsOpen--;}}catch(e){throw latch(e);}}

 async function copyRead(index,offset,size){return scoped(async()=>{const e=device.createCommandEncoder();e.copyBufferToBuffer(buffers[index],offset,staging,0,size);device.queue.submit([e.finish()]);await fence();return mapped(staging,0,size);});}
 async function publish(onPrefix,control){if(!onPrefix||cursor<8195)return;if(!(control instanceof Uint32Array)||control.length!==16)throw Error('Fenced same-encoder trace header required');check();const count=control[1];if(count>256||count<published||control[3]||control[4])throw Error('Invalid native committed trace header');while(published<count){check();const n=Math.min(16,count-published),firstRecordIndex=published,records=await copyRead(69,firstRecordIndex*16384,n*16384);check();await onPrefix({sourceBoundary:cursor,control:control.slice(),firstRecordIndex,records});check();published+=n;}}
 async function executeTo(goal,options){check();if(!initialized||!Number.isSafeInteger(goal)||goal<cursor||goal>program.commandCount||goal>cursor+(cursor<9216?256:1024)||(goal!==program.commandCount&&goal%256!==0))throw Error('Exact bounded native chunk required');let control=null;const startingCursor=cursor;
  await scoped(async()=>{while(cursor<goal){check();const ops=[];let next=cursor;
   // Raw proof reads every eight iterations, after a real queue fence. All source goals remain exact.
   const limit=cursor<8193?Math.min(goal,cursor+32):goal;
   while(next<limit){const logicalLimit=Math.min(limit,(Math.floor(next/256)+1)*256);const op=nextNativeOperation(program,next,logicalLimit,{rawTerminal});ops.push(op);next=op.end;}
   const encoder=device.createCommandEncoder();let pass=null,submitted=false;const close=()=>{if(pass){pass.end();pass=null;}};
   for(const op of ops){if(op.start!==cursor&&op.start%256===0)close();if(op.kind==='identity')continue;submitted=true;const c=op.kind==='fused'?{kind:'dispatch',definition:1000,entries:op.entries,x:1}:op.command;if(c.kind==='dispatch'){pass??=encoder.beginComputePass();pass.setPipeline(pipelines.get(c.definition));pass.setBindGroup(0,groups.get(c.definition+':'+c.entries+':'+(op.iterations??0)));if(c.indirect)pass.dispatchWorkgroupsIndirect(buffers[c.indirect.buffer],c.indirect.offset);else pass.dispatchWorkgroups(c.x,1,1);}else{close();if(c.kind==='clear')encoder.clearBuffer(buffers[c.buffer],c.offset,c.size);else encoder.copyBufferToBuffer(buffers[c.source],c.sourceOffset,buffers[c.target],c.targetOffset,c.size);}}
   close();const captureHeader=typeof options.onPrefix==='function'&&next===goal&&next>=8195;if(captureHeader){encoder.copyBufferToBuffer(buffers[68],0,staging,0,64);submitted=true;}if(submitted){const commandBuffer=encoder.finish();check();device.queue.submit([commandBuffer]);sourceQueueSubmissions++;await fence();sourceQueueFences++;}fencedSourceBoundary=next;check();
   for(const op of ops){if(op.kind==='identity')identityCommands+=op.end-op.start;else{actualOperations++;if(op.kind==='fused')fusedReduction+=op.end-op.start-1;}}cursor=next;
   if(!rawTerminal&&cursor>0&&cursor<8193){const flag=(await copyRead(3,8,4))[0];if(flag>1)throw Error('Unexpected pre-finalize raw flag');rawTerminal=flag===1;}
   if(captureHeader){control=await mapped(staging,0,64);check();}
  }if(actualOperations+identityCommands+fusedReduction!==cursor)throw Error('Native source coverage mismatch');
  });if(startingCursor===goal&&options.onPrefix&&cursor>=8195)control=await copyRead(68,0,64);await publish(options.onPrefix,control);return{completedOrdinal:cursor,fencedSourceBoundary,sourceQueueSubmissions,sourceQueueFences,actuallyExecutedOperations:actualOperations,provedIdentityCommands:identityCommands,fusedSourceReduction:fusedReduction};
 }
 async function exclusive(fn){if(closing||disposed)throw Error('Native transport closing');if(runBusy)throw Error('Exclusive native operation required');runBusy=true;const task=fn();pending=task.catch(()=>{});try{return await task;}catch(e){if(e?.name!=='AbortError')latch(e);throw e;}finally{runBusy=false;}}
 return Object.freeze({
  reset({initialUploads}){return exclusive(async()=>{if(closing||disposed||loss||healthError)throw healthError??Error('Native device unavailable');await fence();if(closing||disposed||loss)throw Error('Native transport closing');if(signal?.aborted)throw abort();if(!Array.isArray(initialUploads)||initialUploads.length!==232)throw Error('Complete native uploads required');const seen=new Set(),owned=initialUploads.map(u=>{if(!Number.isSafeInteger(u.index)||u.index<0||u.index>=232||seen.has(u.index))throw Error('Unique native upload index');seen.add(u.index);const initial=snapshotOwnedBytes(u.initial,program.allocations[u.index].size);if(initial.byteLength!==program.allocations[u.index].size)throw Error('Full native reset bytes required');return{index:u.index,initial};});cancelled=false;await scoped(async()=>{for(const u of owned)device.queue.writeBuffer(buffers[u.index],0,u.initial);await fence();});cursor=published=actualOperations=identityCommands=fusedReduction=fencedSourceBoundary=sourceQueueSubmissions=sourceQueueFences=0;rawTerminal=false;initialized=true;});},
  resetAfterCancellation({resetSequence:nextSequence}={}){return exclusive(async()=>{
   if(!cancelled||healthError||loss||mapsOpen||signal?.aborted)throw healthError??Error('Healthy cancelled native transport required');
   if(!Number.isSafeInteger(nextSequence)||nextSequence>0xffffffff||nextSequence!==resetSequence+1)throw Error('Fresh ordered native reset sequence required');
   const version=cancelVersion;await fence();if(closing||disposed||loss||healthError||mapsOpen||version!==cancelVersion)throw healthError??Error('Native reset lifecycle changed');
   await scoped(async()=>{const encoder=device.createCommandEncoder();for(const b of buffers)encoder.clearBuffer(b,0,b.size);encoder.clearBuffer(staging,0,262208);device.queue.submit([encoder.finish()]);await fence();},{allowCancelled:true});
   if(closing||disposed||loss||healthError||mapsOpen||version!==cancelVersion)throw healthError??Error('Native reset lifecycle changed');
   cursor=published=actualOperations=identityCommands=fusedReduction=fencedSourceBoundary=sourceQueueSubmissions=sourceQueueFences=0;rawTerminal=false;initialized=false;cancelled=false;resetSequence=nextSequence;
   return Object.freeze({resetSequence, gpuFenced:true,mapsOpen:0,mutableStateReset:true,needsFullInputUpload:true,retainedPipelines:pipelines.size,retainedBuffers:buffers.length+2,ownedBytes:program.resources.totalOwnedBytes,disposed:false,destroyed:false});
  });},
  runTo(goal,options={}){return exclusive(()=>executeTo(goal,options));},
  finish(){return exclusive(async()=>{check();if(cursor!==program.commandCount)throw Error('Incomplete native graph');return scoped(async()=>{await fence();const world=await mapped(buffers[102],0,11664);check();const trace=await mapped(buffers[70],0,4194368);check();return{world,trace,status:{completedOrdinal:cursor,final:true}};});});},
  cancel(){cancelVersion++;cancelled=true;},async drain(){await pending;await fence();},dispose(){if(disposePromise)return disposePromise;closing=true;cancelled=true;disposePromise=(async()=>{await pending;try{await fence();}catch(error){if(!loss)throw error;}for(const b of buffers)b.destroy();staging.destroy();parameters.destroy();disposed=true;})();return disposePromise;},
  status(){return Object.freeze({cursor,cancelled,disposed,loss,healthy:!healthError&&!loss,mapsOpen,resetSequence,needsFullInputUpload:!initialized,preparationMilliseconds,diagnostics:{nativeTransport:true,nativeArtifactSHA256:program.artifactSHA256,transformRevision:program.transformRevision,sourceBoundary:cursor,fencedSourceBoundary,sourceQueueSubmissions,sourceQueueFences,actuallyExecutedOperations:actualOperations,provedIdentityCommands:identityCommands,fusedSourceReduction:fusedReduction,totalOwnedBytes:disposed?0:program.resources.totalOwnedBytes}});}
 });
}
