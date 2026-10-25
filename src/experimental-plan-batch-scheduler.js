/* SPDX-License-Identifier: Apache-2.0
 * Opt-in, bounded vector dispatch scheduling for independent GPU world owners.
 * Arithmetic is always executed by the actual resident WGSL runtime. This file
 * contains transport/ownership only, and accepts no replacement math backend.
 */
(function(G){'use strict';
const Graph=typeof module!=='undefined'&&module.exports?require('./experimental-arithmetic-graph.js'):G.LabArithmeticGraphExperimental;
const runtime=()=>typeof module!=='undefined'&&module.exports?require('./experimental-stage-runtime.js'):G.LabStageRuntimeExperimental;
function cancelled(reason){const e=Error('Arithmetic batch owner cancelled'+(reason?': '+String(reason.message??reason):''));e.name='AbortError';return e;}
function bound(value,fallback,max,name){const n=value??fallback;if(!Number.isSafeInteger(n)||n<1||n>max)throw RangeError('Bounded '+name+' required (1..'+max+')');return n;}
function same(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
/** Internal scope state; only Runtime registers its facades in a private WeakMap. */
function createScopeState(device,options={}){
 if(!device||typeof device.createShaderModule!=='function'||typeof device.createBuffer!=='function')throw TypeError('An actual GPUDevice is required');
 const bounds=Object.freeze({maxRows:bound(options.maxRows,512,512,'dispatch rows'),maxBytes:bound(options.maxBytes,256*1024*1024,1024*1024*1024,'resident bytes'),maxOwners:bound(options.maxOwners,64,128,'owners'),maxPlans:bound(options.maxPlans,64,256,'plans'),maxHandles:bound(options.maxHandles,4096,16384,'handles'),maxQueuedRequests:bound(options.maxQueuedRequests,1024,4096,'pending requests'),maxQueuedRows:bound(options.maxQueuedRows,8192,65536,'pending rows'),maxQueuedBytes:bound(options.maxQueuedBytes,64*1024*1024,512*1024*1024,'pending input bytes')});
 const label=options.label??'shared arithmetic';if(typeof label!=='string'||!label.length||label.length>128)throw RangeError('A 1..128 character batch label is required');
 const owners=new Map(),facades=new WeakMap(),plans=[],handles=new Set(),queue=[],active=new Set(),initializations=new Set(),recent=[];
 const counts={programCompilations:0,requestsQueued:0,requestsCompleted:0,requestsCancelled:0,requestsFailed:0,dispatches:0,readbacks:0,multiRequestDispatches:0,multiOwnerDispatches:0,batchedRequests:0,batchedOwners:0,maxDispatchRequests:0,maxDispatchOwners:0,maxDispatchRows:0,mixedPlanFlushes:0,rowLimitSplits:0,rowFailureIsolationGroups:0,rowFailureRetryDispatches:0,roundsStarted:0,roundsCompleted:0,frontiers:0,maxFrontierOwners:0,maxFrontierRequests:0};
 let disposed=false,loss=null,allCancelled=null,nextPlanId=1,handleCount=0,pendingRequests=0,pendingRows=0,pendingBytes=0,drainPromise=null,resolveDrain=null,scheduled=false,draining=false,round=null,nextRoundId=1;
 const available=owner=>{if(loss)throw loss;if(disposed)throw Error('Arithmetic batch scope disposed');if(allCancelled)throw allCancelled;if(owner?.cancelled)throw owner.cancelled;};
 const bytes=()=>plans.reduce((n,p)=>n+(p.native?p.native.snapshot().liveBytes:p.staticBytes),0);
 function settle(request,error,output){
  if(request.settled)return;request.settled=true;active.delete(request);const i=queue.indexOf(request);if(i>=0)queue.splice(i,1);
  try{request.signal?.removeEventListener('abort',request.onAbort);}catch(cleanupError){if(error)error.cleanupError??=cleanupError;else error=cleanupError;}pendingRequests--;pendingRows-=request.rows;pendingBytes-=request.input.byteLength;request.finish();
  if(error){if(error.name==='AbortError')counts.requestsCancelled++;else counts.requestsFailed++;request.reject(error);}else{counts.requestsCompleted++;request.resolve(output);}
 }
 function cancelRequest(request,error){if(request.settled)return;request.cancelled??=error;if(request.phase!=='submitted')settle(request,request.cancelled);schedule();}
 function lost(info){if(loss)return;loss=Error('Arithmetic GPU device lost: '+String(info?.message??info?.reason??info??'unknown'));if(round)for(const id of round.owners)round.ended.add(id);for(const request of [...queue,...active])if(request.phase!=='submitted')settle(request,loss);schedule();}
 if(device.lost&&typeof device.lost.then==='function')Promise.resolve(device.lost).then(lost,lost);
 function frontierReady(){return !round||[...round.owners].every(id=>round.ended.has(id)||queue.some(r=>r.owner.id===id));}
 function completeDrain(){if(draining||scheduled||queue.length||active.size)return;const resolve=resolveDrain;drainPromise=null;resolveDrain=null;resolve?.();}
 function schedule(){
  if(!queue.length){completeDrain();return;}
  if(!drainPromise)drainPromise=new Promise(resolve=>{resolveDrain=resolve;});
  if(scheduled||draining||!frontierReady())return;
  scheduled=true;queueMicrotask(()=>{
   scheduled=false;if(!queue.length||!frontierReady()){completeDrain();return;}
   draining=true;drain().catch(error=>{for(const request of [...queue,...active])settle(request,error);}).finally(()=>{draining=false;if(queue.length)schedule();else completeDrain();});
  });
 }
 function predictedCapacity(entry,rows){let capacity=1;while(capacity<rows)capacity=Math.min(entry.maxRows,capacity*2);return Math.min(capacity,entry.maxRows);}
 async function dispatch(entry,requests,rows,isolating=false,frontierId=null){
  const input=new Float32Array(rows*entry.inputFloats);let offset=0;for(const request of requests){request.phase='submitted';active.add(request);request.rowOffset=offset;input.set(request.input,offset*entry.inputFloats);offset+=request.rows;}
  const before=entry.native.snapshot(),ownerIds=[...new Set(requests.map(r=>r.owner.id))];let result=null,failure=null;
  try{
   const capacity=before.capacity>=rows?before.capacity:predictedCapacity(entry,rows);
   // Native growth allocates a new generation before retiring the old one.
   // Charge that transient peak, not just the eventual retained capacity.
   const extra=capacity>before.capacity?capacity*entry.rowBytes:0;
   if(bytes()+extra>bounds.maxBytes)throw RangeError('Arithmetic batch resident byte budget exceeded');
   result=await entry.native.run(input);
  }catch(error){failure=error;}
  const after=entry.native.snapshot(),dispatches=after.dispatches-before.dispatches,readbacks=(after.readbacks??0)-(before.readbacks??0);
  if(dispatches){
   counts.dispatches+=dispatches;counts.readbacks+=readbacks;if(isolating)counts.rowFailureRetryDispatches+=dispatches;counts.maxDispatchRequests=Math.max(counts.maxDispatchRequests,requests.length);counts.maxDispatchOwners=Math.max(counts.maxDispatchOwners,ownerIds.length);counts.maxDispatchRows=Math.max(counts.maxDispatchRows,rows);
   if(requests.length>1){counts.multiRequestDispatches+=dispatches;counts.batchedRequests+=requests.length;}if(ownerIds.length>1){counts.multiOwnerDispatches+=dispatches;counts.batchedOwners+=ownerIds.length;}
   const record=Object.freeze({planId:entry.id,roundId:round?.id??null,frontierId,rows,requestCount:requests.length,ownerIds:Object.freeze(ownerIds),dispatches,readbacks,failed:!!failure,isolationRetry:isolating});recent.push(record);if(recent.length>32)recent.shift();
  }
  // A malformed arithmetic row must not turn a different world's valid row
  // into a failure. The ordinary resident API stays strict: retry each owned
  // request through real WGSL only for row-status errors, never device errors.
  if(!isolating&&!loss&&requests.length>1&&failure?.code==='ARITHMETIC_GPU_ROW_STATUS'){
   counts.rowFailureIsolationGroups++;
   for(const request of requests){const error=request.cancelled??request.owner.cancelled;if(error)settle(request,error);else await dispatch(entry,[request],request.rows,true,frontierId);}
   return;
  }
  for(const request of requests){const error=loss??request.cancelled??request.owner.cancelled??failure;settle(request,error,error?null:result.slice(request.rowOffset*entry.stride,(request.rowOffset+request.rows)*entry.stride));}
 }
 async function drain(){
  // Freeze a round frontier. Newly queued work from faster owners cannot join
  // it, or get dispatched until every remaining owner reaches the next frontier.
  const frontier=queue.splice(0),frontierId=round?++counts.frontiers:null;
  if(round){counts.maxFrontierRequests=Math.max(counts.maxFrontierRequests,frontier.length);counts.maxFrontierOwners=Math.max(counts.maxFrontierOwners,new Set(frontier.map(r=>r.owner.id)).size);}
  if(new Set(frontier.map(r=>r.entry)).size>1)counts.mixedPlanFlushes++;
  for(const request of frontier){request.phase='reserved';active.add(request);}
  while(frontier.length){
   while(frontier[0]?.settled)frontier.shift();if(!frontier.length)break;
   const entry=frontier[0].entry,requests=[];let rows=0;
   for(let i=0;i<frontier.length;){const request=frontier[i];if(request.settled){frontier.splice(i,1);continue;}if(request.entry!==entry){i++;continue;}if(rows+request.rows>entry.maxRows){counts.rowLimitSplits++;i++;continue;}frontier.splice(i,1);requests.push(request);rows+=request.rows;}
   await dispatch(entry,requests,rows,false,frontierId);
  }
 }
 function beginRound(ownerIds){
  available();if(round)throw Error('An arithmetic batch round is already open');
  if(pendingRequests||drainPromise||initializations.size)throw Error('Cannot begin a busy arithmetic batch round');
  if(!Array.isArray(ownerIds)||!ownerIds.length||ownerIds.length>bounds.maxOwners||new Set(ownerIds).size!==ownerIds.length)throw RangeError('Bounded unique arithmetic round owners required');
  for(const id of ownerIds){const owner=owners.get(id);if(!owner)throw RangeError('Unknown arithmetic batch round owner');available(owner);}
  round={id:nextRoundId++,owners:new Set(ownerIds),ended:new Set()};counts.roundsStarted++;return round.id;
 }
 function endRoundOwner(ownerId){
  if(!round||!round.owners.has(ownerId))throw RangeError('Owner is not in an open arithmetic batch round');
  round.ended.add(ownerId);schedule();
 }
 async function finishRound(){
  if(!round)throw Error('No arithmetic batch round is open');
  if(round.ended.size!==round.owners.size)throw Error('Cannot finish an arithmetic batch round with active owners');
  const current=round;await flush();if(round===current){round=null;counts.roundsCompleted++;}
 }
 function createDevice(ownerId){
  available();if(typeof ownerId!=='string'||!ownerId.length||ownerId.length>128)throw RangeError('A unique 1..128 character owner ID is required');
  if(owners.has(ownerId))throw Error('Duplicate arithmetic batch owner ID');if(owners.size>=bounds.maxOwners)throw RangeError('Arithmetic batch owner limit exceeded');
  const owner={id:ownerId,cancelled:null},methods=new Map(),facade=new Proxy(device,{get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;if(!methods.has(key))methods.set(key,value.bind(target));return methods.get(key);},set(){throw TypeError('Arithmetic batch device facade is read-only');}});
  owners.set(ownerId,owner);facades.set(facade,owner);return facade;
 }
 async function createResidentGraph(facade,plan,{maxRows=256,label:stageLabel='resident arithmetic'}={}){
  const owner=facades.get(facade);if(!owner)throw TypeError('A device facade from this arithmetic scope is required');available(owner);
  if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>512)throw RangeError('Bounded 1..512 row capacity required');
  if(typeof stageLabel!=='string'||stageLabel.length>128)throw RangeError('Bounded arithmetic stage label required');
  Graph.validatePlan(plan);if(!plan.nodes.length)throw RangeError('Resident arithmetic requires a nonempty program');
  if(handleCount>=bounds.maxHandles)throw RangeError('Arithmetic batch stage handle limit exceeded');
  const program=Graph.encode(plan),indices=Uint32Array.from(plan.outputs),inputFloats=plan.inputFloats;
  let entry=plans.find(p=>p.inputFloats===inputFloats&&same(p.program,program)&&same(p.indices,indices));
  if(!entry){
   if(plans.length>=bounds.maxPlans)throw RangeError('Arithmetic batch exact-plan limit exceeded');
   const staticBytes=program.byteLength+indices.byteLength,stride=indices.length+1,rowBytes=(inputFloats+inputFloats+plan.nodes.length+stride*2)*4;
   const widths=[inputFloats*4,(inputFloats+plan.nodes.length)*4,stride*4],storage=device.limits?.maxStorageBufferBindingSize??Infinity,buffer=device.limits?.maxBufferSize??Infinity;
   const allowed=Math.min(bounds.maxRows,...widths.map(w=>Math.floor(storage/w)),...widths.map(w=>Math.floor(buffer/w)),Math.floor((bounds.maxBytes-staticBytes)/rowBytes));
   if(allowed<1||bytes()+staticBytes>bounds.maxBytes)throw RangeError('Arithmetic batch plan exceeds storage/byte budget');
   const captured={inputFloats,nodes:plan.nodes.map(n=>({kind:n.kind,args:[...n.args]})),outputs:[...plan.outputs]};
   entry={id:nextPlanId++,program,indices,inputFloats,stride,staticBytes,rowBytes,maxRows:allowed,native:null,ready:null};plans.push(entry);counts.programCompilations++;
   const current=entry;
   current.ready=runtime().createResidentGraph(device,captured,{maxRows:allowed,label:label+' plan '+current.id}).then(native=>{current.native=native;return native;},error=>{const i=plans.indexOf(current);if(i>=0)plans.splice(i,1);throw error;});
   initializations.add(current.ready);current.ready.then(()=>initializations.delete(current.ready),()=>initializations.delete(current.ready));
  }
  handleCount++;
  try{await entry.ready;available(owner);}catch(error){handleCount--;throw error;}
  let busy=false,handleDisposed=false;const local={requests:0,completed:0,cancelled:0,failed:0};
  const handle=Object.freeze({
   async run(packed,{signal}={}){
    available(owner);if(round&&(!round.owners.has(owner.id)||round.ended.has(owner.id)))throw Error('Arithmetic batch owner is not active in the current round');if(handleDisposed)throw Error('Arithmetic GPU stage disposed');if(busy)throw Error('Arithmetic GPU stage busy');
    if(!(packed instanceof Float32Array)||Object.prototype.toString.call(packed.buffer)==='[object SharedArrayBuffer]'||packed.length%inputFloats!==0||packed.length/inputFloats>maxRows||packed.length/inputFloats>entry.maxRows)throw RangeError('Owned bounded Float32Array arithmetic rows required');
    if(signal&&(!('aborted'in signal)||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw TypeError('AbortSignal required');if(signal?.aborted)throw cancelled();
    const input=new Float32Array(packed),rows=input.length/inputFloats;if(input.some(x=>!Number.isFinite(x)))throw RangeError('Finite arithmetic input required');if(!rows)return new Float32Array(0);
    if(pendingRequests+1>bounds.maxQueuedRequests||pendingRows+rows>bounds.maxQueuedRows||pendingBytes+input.byteLength>bounds.maxQueuedBytes)throw RangeError('Arithmetic batch pending queue budget exceeded');
    busy=true;local.requests++;pendingRequests++;pendingRows+=rows;pendingBytes+=input.byteLength;counts.requestsQueued++;
    return new Promise((resolve,reject)=>{
     const request={entry,owner,input,rows,signal,phase:'queued',settled:false,cancelled:null,resolve:output=>{local.completed++;resolve(output);},reject:error=>{if(error.name==='AbortError')local.cancelled++;else local.failed++;reject(error);},finish:()=>{busy=false;},onAbort:null};
     request.onAbort=()=>cancelRequest(request,cancelled());queue.push(request);try{signal?.addEventListener('abort',request.onAbort,{once:true});if(signal?.aborted)request.onAbort();schedule();}catch(error){settle(request,error);}
    });
   },
   snapshot(){return Object.freeze({...local,scopeShared:true,ownerId:owner.id,planId:entry.id,busy,disposed:handleDisposed,deviceLost:!!loss,ownerCancelled:!!owner.cancelled,maxRows:Math.min(maxRows,entry.maxRows)});},
   dispose(){if(busy)throw Error('Cannot dispose a busy arithmetic GPU stage');if(handleDisposed)return;handleDisposed=true;handleCount--;handles.delete(handle);}
  });handles.add(handle);return handle;
 }
 async function flush(){
  // Include construction already admitted to this scope, but no future work.
  if(initializations.size)await Promise.allSettled([...initializations]);
  while(drainPromise)await drainPromise;
 }
 function cancelOwner(ownerId,reason){const owner=owners.get(ownerId);if(!owner)throw RangeError('Unknown arithmetic batch owner');owner.cancelled??=cancelled(reason);if(round?.owners.has(ownerId))round.ended.add(ownerId);for(const request of [...queue,...active])if(request.owner===owner)cancelRequest(request,owner.cancelled);schedule();return flush();}
 function cancel(reason){allCancelled??=cancelled(reason);if(round)for(const id of round.owners)round.ended.add(id);for(const owner of owners.values())owner.cancelled??=allCancelled;for(const request of [...queue,...active])cancelRequest(request,allCancelled);schedule();return flush();}
 function snapshot(){return Object.freeze({...counts,bounds,ownerCount:owners.size,planCount:plans.length,handleCount,queuedRequests:queue.length,queuedRows:queue.reduce((n,r)=>n+r.rows,0),queuedBytes:queue.reduce((n,r)=>n+r.input.byteLength,0),pendingRequests,pendingRows,pendingBytes,inFlightRequests:active.size,residentBytes:bytes(),busy:!!drainPromise||initializations.size>0,round:round?Object.freeze({id:round.id,ownerIds:Object.freeze([...round.owners]),endedOwnerIds:Object.freeze([...round.ended]),waitingOwnerIds:Object.freeze([...new Set(queue.map(r=>r.owner.id))])}):null,disposed,deviceLost:!!loss,cancelled:!!allCancelled,lastDispatch:recent.at(-1)??null,recentDispatches:Object.freeze([...recent]),plans:Object.freeze(plans.map(p=>Object.freeze({planId:p.id,inputFloats:p.inputFloats,nodeCount:p.program.length/4,outputFloats:p.indices.length,programBytes:p.staticBytes,maxRows:p.maxRows,capacity:p.native?.snapshot().capacity??0,native:p.native?.snapshot()??null})))});}
 function dispose(){if(pendingRequests||drainPromise||initializations.size||round&&round.ended.size!==round.owners.size)throw Error('Cannot dispose a busy arithmetic batch scope');disposed=true;for(const handle of [...handles])handle.dispose();let error=null;for(const entry of plans)try{entry.native?.dispose();}catch(e){error??=e;}if(error)throw error;}
 return Object.freeze({createDevice,createResidentGraph,beginRound,endRoundOwner,finishRound,flush,cancelOwner,cancel,snapshot,dispose});
}
const api=Object.freeze({createScopeState});G.LabPlanBatchSchedulerExperimental=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
