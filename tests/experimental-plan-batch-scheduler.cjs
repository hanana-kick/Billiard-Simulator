'use strict';
// Native checks below execute actual WGSL; none replaces runtime arithmetic.
const {test}=require('node:test'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const Runtime=require('../src/experimental-stage-runtime');
const PLAN={inputFloats:2,nodes:[{kind:'add',args:[0,1]},{kind:'sub',args:[0,1]}],outputs:[2,3]};
const gated=!process.env.GPU_NATIVE_MODULE&&process.env.REQUIRE_WEBGPU!=='1';
function watchDevice(device){
 const calls={submits:0,dispatches:0},queue=new Proxy(device.queue,{get(target,key){if(key==='submit')return commands=>{calls.submits++;return target.submit(commands);};const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});
 const observed=new Proxy(device,{get(target,key){if(key==='queue')return queue;if(key==='createCommandEncoder')return (...args)=>{const encoder=target.createCommandEncoder(...args);return new Proxy(encoder,{get(e,k){if(k==='beginComputePass')return (...args)=>{const pass=e.beginComputePass(...args);return new Proxy(pass,{get(p,k){if(k==='dispatchWorkgroups')return (...args)=>{calls.dispatches++;return p.dispatchWorkgroups(...args);};const v=Reflect.get(p,k,p);return typeof v==='function'?v.bind(p):v;}});};const v=Reflect.get(e,k,e);return typeof v==='function'?v.bind(e):v;}});};const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});return{device:observed,calls};
}
async function native(t,work){assert.ok(process.env.GPU_NATIVE_MODULE);const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice(),release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'shared plan scheduler');try{await work(device);}finally{release();}}
test('scope is opt-in and rejects unsupported bounds without calling a GPU',()=>{
 const device={createShaderModule(){throw Error('no GPU used');},createBuffer(){throw Error('no GPU used');}};
 for(const options of[{maxRows:513},{maxOwners:0},{maxPlans:Infinity},{maxBytes:0},{maxQueuedRows:0},{label:'x'.repeat(129)}])assert.throws(()=>Runtime.createPlanBatchScope(device,options),/Bounded|character/);
 const scope=Runtime.createPlanBatchScope(device,{maxOwners:1}),a=scope.createDevice('world-a');assert.notEqual(a,device);assert.equal(scope.device,undefined);assert.throws(()=>scope.createDevice('world-a'),/Duplicate/);assert.throws(()=>scope.createDevice('world-b'),/owner limit/);assert.throws(()=>Runtime.createPlanBatchScope(a),/Nested/);scope.dispose();assert.equal(scope.snapshot().residentBytes,0);
});
test('actual two-owner requests use one GPU dispatch/readback and shared resident program',{skip:gated,timeout:120000},async t=>native(t,async actual=>{
 const observed=watchDevice(actual),scope=Runtime.createPlanBatchScope(observed.device,{maxRows:8}),da=scope.createDevice('world-a'),db=scope.createDevice('world-b');let a,b;
 try{
  [a,b]=await Promise.all([Runtime.createResidentGraph(da,PLAN,{maxRows:8}),Runtime.createResidentGraph(db,structuredClone(PLAN),{maxRows:8})]);
  assert.equal(scope.snapshot().programCompilations,1);assert.equal(a.snapshot().planId,b.snapshot().planId);
  const backing=Float32Array.of(999,1,2,999),pa=a.run(backing.subarray(1,3)),pb=b.run(Float32Array.of(8,3));backing[1]=100;
  assert.equal(scope.snapshot().queuedRequests,2);await assert.rejects(a.run(Float32Array.of(1,2)),/busy/);assert.throws(()=>a.dispose(),/busy/);assert.throws(()=>scope.dispose(),/busy/);
  const [ra,rb]=await Promise.all([pa,pb]);await scope.flush();assert.deepEqual(ra,Float32Array.of(3,-1,1));assert.deepEqual(rb,Float32Array.of(11,5,1));assert.notEqual(ra.buffer,rb.buffer);
  assert.deepEqual(observed.calls,{submits:1,dispatches:1});let stats=scope.snapshot();assert.equal(stats.dispatches,1);assert.equal(stats.readbacks,1);assert.equal(stats.multiOwnerDispatches,1);assert.deepEqual(stats.lastDispatch.ownerIds,['world-a','world-b']);assert.equal(stats.lastDispatch.rows,2);
  const buffers=stats.plans[0].native.buffersCreated;for(let i=0;i<3;i++)await Promise.all([a.run(Float32Array.of(1,2)),b.run(Float32Array.of(8,3))]);stats=scope.snapshot();assert.equal(stats.plans[0].native.buffersCreated,buffers);assert.equal(stats.programCompilations,1);assert.deepEqual(ra,Float32Array.of(3,-1,1));
  a.dispose();assert.deepEqual(await b.run(Float32Array.of(9,3)),Float32Array.of(12,6,1));b.dispose();await scope.flush();scope.dispose();assert.equal(scope.snapshot().residentBytes,0);assert.equal(scope.snapshot().plans[0].native.liveBuffers,0);
  t.diagnostic(JSON.stringify({backend:'actual-webgpu',twoOwnersOneDispatch:true,observed:observed.calls,stats:scope.snapshot()}));
 }finally{await scope.flush();a?.dispose();b?.dispose();scope.dispose();}
}));
test('actual mixed exact plans, row splitting, queued/active cancellation and loss preserve ownership',{skip:gated,timeout:120000},async t=>native(t,async actual=>{
 const observed=watchDevice(actual),scope=Runtime.createPlanBatchScope(observed.device,{maxRows:2}),da=scope.createDevice('world-a'),db=scope.createDevice('world-b'),dc=scope.createDevice('world-c');let a,b,c;
 try{
  [a,b,c]=await Promise.all([Runtime.createResidentGraph(da,PLAN,{maxRows:2}),Runtime.createResidentGraph(db,PLAN,{maxRows:2}),Runtime.createResidentGraph(dc,{...PLAN,outputs:[3,2]},{maxRows:2})]);
  const results=await Promise.all([a.run(Float32Array.of(1,2,3,4)),b.run(Float32Array.of(8,3)),c.run(Float32Array.of(9,1))]);assert.deepEqual(results[0],Float32Array.of(3,-1,1,7,-1,1));assert.deepEqual(results[2],Float32Array.of(8,10,1));assert.equal(scope.snapshot().dispatches,3);assert.equal(scope.snapshot().planCount,2);assert.ok(scope.snapshot().rowLimitSplits>0);
  const early=new AbortController(),qa=a.run(Float32Array.of(2,4),{signal:early.signal});early.abort();await assert.rejects(qa,{name:'AbortError'});await scope.flush();assert.equal(scope.snapshot().dispatches,3);
  const late=new AbortController(),pa=a.run(Float32Array.of(2,4),{signal:late.signal}),pb=b.run(Float32Array.of(10,4));await Promise.resolve();assert.equal(scope.snapshot().inFlightRequests,2);late.abort();assert.equal(a.snapshot().busy,true);await assert.rejects(pa,{name:'AbortError'});assert.deepEqual(await pb,Float32Array.of(14,6,1));await scope.flush();assert.equal(scope.snapshot().dispatches,4);
  const ownerPending=a.run(Float32Array.of(1,3)),ownerCancel=scope.cancelOwner('world-a','cancel test');await assert.rejects(ownerPending,{name:'AbortError'});await ownerCancel;await assert.rejects(a.run(Float32Array.of(1,3)),{name:'AbortError'});assert.deepEqual(await b.run(Float32Array.of(1,3)),Float32Array.of(4,-2,1));
  actual.destroy();await actual.lost;await assert.rejects(b.run(Float32Array.of(1,3)),/device lost/);await scope.flush();assert.equal(scope.snapshot().deviceLost,true);
 }finally{await scope.flush();a?.dispose();b?.dispose();c?.dispose();scope.dispose();}
}));

test('actual failed arithmetic row is isolated by counted GPU-only request retries',{skip:gated,timeout:120000},async t=>native(t,async actual=>{
 const observed=watchDevice(actual),scope=Runtime.createPlanBatchScope(observed.device),da=scope.createDevice('valid-world'),db=scope.createDevice('invalid-world'),plan={inputFloats:2,nodes:[{kind:'div',args:[0,1]}],outputs:[2]};let a,b;
 try{
  [a,b]=await Promise.all([Runtime.createResidentGraph(da,plan),Runtime.createResidentGraph(db,plan)]);
  const results=await Promise.allSettled([a.run(Float32Array.of(8,2)),b.run(Float32Array.of(7,0))]);await scope.flush();
  assert.equal(results[0].status,'fulfilled');assert.deepEqual(results[0].value,Float32Array.of(4,1));assert.equal(results[1].status,'rejected');assert.match(results[1].reason.message,/Incomplete arithmetic GPU dispatch/);
  const stats=scope.snapshot();assert.equal(stats.rowFailureIsolationGroups,1);assert.equal(stats.rowFailureRetryDispatches,2);assert.equal(stats.dispatches,3);assert.equal(stats.readbacks,3);assert.deepEqual(observed.calls,{submits:3,dispatches:3});assert.equal(stats.requestsCompleted,1);assert.equal(stats.requestsFailed,1);assert.deepEqual(stats.recentDispatches.map(d=>[d.rows,d.failed,d.isolationRetry]),[[2,true,false],[1,false,true],[1,true,true]]);
  assert.deepEqual(await a.run(Float32Array.of(12,3)),Float32Array.of(4,1));await scope.flush();
 }finally{await scope.flush();a?.dispose();b?.dispose();scope.dispose();}
}));

test('actual round frontiers combine requests across distinct task callbacks without a timer',{skip:gated,timeout:120000},async t=>native(t,async actual=>{
 const observed=watchDevice(actual),scope=Runtime.createPlanBatchScope(observed.device),da=scope.createDevice('fast-world'),db=scope.createDevice('slow-world'),dc=scope.createDevice('other-plan-world');let a,b,c;
 const nextTask=()=>new Promise(resolve=>setImmediate(resolve));
 try{
  [a,b,c]=await Promise.all([Runtime.createResidentGraph(da,PLAN),Runtime.createResidentGraph(db,PLAN),Runtime.createResidentGraph(dc,{...PLAN,outputs:[3,2]})]);
  scope.beginRound(['fast-world','slow-world','other-plan-world']);
  const run=async(handle,id,delay)=>{try{for(let i=0;i<3;i++){if(delay)await nextTask();const result=await handle.run(Float32Array.of(i+2,1));assert.deepEqual(result,id==='other-plan-world'?Float32Array.of(i+1,i+3,1):Float32Array.of(i+3,i+1,1));}}finally{scope.endRoundOwner(id);}};
  const pa=run(a,'fast-world',false);await Promise.resolve();assert.equal(observed.calls.dispatches,0);assert.deepEqual(scope.snapshot().round.waitingOwnerIds,['fast-world']);
  await Promise.all([pa,run(b,'slow-world',true),run(c,'other-plan-world',true)]);await scope.finishRound();
  const stats=scope.snapshot();assert.equal(stats.round,null);assert.equal(stats.frontiers,3);assert.equal(stats.multiOwnerDispatches,3);assert.equal(stats.dispatches,6);assert.equal(stats.readbacks,6);assert.equal(stats.requestsCompleted,9);assert.equal(stats.maxFrontierOwners,3);assert.equal(stats.roundsCompleted,1);assert.deepEqual(observed.calls,{submits:6,dispatches:6});assert.deepEqual(stats.recentDispatches.map(d=>d.frontierId),[1,1,2,2,3,3]);
  // A participant with no shared graph work still has an explicit finish edge.
  scope.beginRound(['fast-world','slow-world']);const lonely=a.run(Float32Array.of(5,2));await nextTask();assert.equal(observed.calls.dispatches,6);scope.endRoundOwner('slow-world');assert.deepEqual(await lonely,Float32Array.of(7,3,1));scope.endRoundOwner('fast-world');await scope.finishRound();
  // Terminal cancellation marks its owner ended before awaiting shared drain.
  scope.beginRound(['fast-world','slow-world']);const pending=a.run(Float32Array.of(6,2)),cancel=scope.cancelOwner('slow-world');assert.deepEqual(await pending,Float32Array.of(8,4,1));scope.endRoundOwner('fast-world');await cancel;await scope.finishRound();
  assert.equal(scope.snapshot().roundsCompleted,3);
 }finally{await scope.cancel();await scope.flush();a?.dispose();b?.dispose();c?.dispose();scope.dispose();}
}));

test('device loss releases a round waiting for an owner with no queued request',{skip:gated,timeout:120000},async t=>native(t,async actual=>{
 const scope=Runtime.createPlanBatchScope(actual),da=scope.createDevice('queued-world');scope.createDevice('not-yet-queued');let a;
 try{a=await Runtime.createResidentGraph(da,PLAN);scope.beginRound(['queued-world','not-yet-queued']);const pending=a.run(Float32Array.of(2,3)),check=assert.rejects(pending,/device lost/);actual.destroy();await actual.lost;await check;await scope.finishRound();assert.equal(scope.snapshot().pendingRequests,0);assert.equal(scope.snapshot().dispatches,0);}
 finally{await scope.flush();a?.dispose();scope.dispose();}
}));

test('failed round participant ends while a valid sibling continues to its next frontier',{skip:gated,timeout:120000},async t=>native(t,async actual=>{
 const scope=Runtime.createPlanBatchScope(actual),da=scope.createDevice('valid-world'),db=scope.createDevice('invalid-world'),plan={inputFloats:2,nodes:[{kind:'div',args:[0,1]}],outputs:[2]};let a,b;
 try{
  [a,b]=await Promise.all([Runtime.createResidentGraph(da,plan),Runtime.createResidentGraph(db,plan)]);scope.beginRound(['valid-world','invalid-world']);
  const valid=(async()=>{try{assert.deepEqual(await a.run(Float32Array.of(8,2)),Float32Array.of(4,1));return await a.run(Float32Array.of(15,3));}finally{scope.endRoundOwner('valid-world');}})();
  const invalid=(async()=>{try{return await b.run(Float32Array.of(7,0));}finally{scope.endRoundOwner('invalid-world');}})();
  const results=await Promise.allSettled([valid,invalid]);await scope.finishRound();assert.equal(results[0].status,'fulfilled');assert.deepEqual(results[0].value,Float32Array.of(5,1));assert.equal(results[1].status,'rejected');assert.equal(results[1].reason.code,'ARITHMETIC_GPU_ROW_STATUS');assert.equal(scope.snapshot().frontiers,2);assert.equal(scope.snapshot().dispatches,4);assert.equal(scope.snapshot().rowFailureRetryDispatches,2);assert.equal(scope.snapshot().pendingRequests,0);
 }finally{await scope.cancel();await scope.flush();a?.dispose();b?.dispose();scope.dispose();}
}));
