import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceLossWaiters} from '../src/wasm-gpu/device-loss-waiters.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('thousands of settled native operations leave no retained loss waiters',async()=>{
 const waits=createDeviceLossWaiters();
 for(let i=0;i<10000;i++){assert.equal(await waits.wait(Promise.resolve(i)),i);assert.equal(waits.pendingCount,0);}
 const error=Error('native rejection');await assert.rejects(waits.wait(Promise.reject(error)),e=>e===error);assert.equal(waits.pendingCount,0);
});
test('actual device loss rejects every pending waiter once; late native outcomes consumed',async()=>{
 const waits=createDeviceLossWaiters(),a=deferred(),b=deferred(),reason=Error('actual device loss');
 const p=waits.wait(a.promise),q=waits.wait(b.promise);assert.equal(waits.pendingCount,2);
 const assertions=[assert.rejects(p,e=>e===reason),assert.rejects(q,e=>e===reason)];waits.deviceLost(reason);waits.deviceLost(Error('later'));
 assert.equal(waits.pendingCount,0);a.resolve('late success');b.reject(Error('late native failure'));await Promise.all(assertions);
 await assert.rejects(waits.wait(Promise.reject(Error('already lost native failure'))),e=>e===reason);assert.equal(waits.pendingCount,0);
});
test('cancellation has no completion capability: native fence remains pending until real completion',async()=>{
 const waits=createDeviceLossWaiters(),native=deferred();let settled=false;
 const p=waits.wait(native.promise).then(()=>{settled=true;});
 const controller=new AbortController();controller.abort('user cancelled');await Promise.resolve();await Promise.resolve();
 assert.equal(settled,false);assert.equal(waits.pendingCount,1);assert.equal('cancel' in waits,false);
 native.resolve();await p;assert.equal(settled,true);assert.equal(waits.pendingCount,0);
});
test('completed result stays completed when actual loss arrives later',async()=>{
 const waits=createDeviceLossWaiters(),native=deferred(),p=waits.wait(native.promise);native.resolve(7);assert.equal(await p,7);
 waits.deviceLost(Error('later actual loss'));assert.equal(await p,7);assert.equal(waits.pendingCount,0);
});

// Passive diagnostics never execute/replace a GPU operation.
const {createGPUExecutionDiagnostics,snapshotGPUEnvironment,snapshotGPULossDiagnostics}=await import('../src/wasm-gpu/gpu-execution-diagnostics.mjs');
test('diagnostic completion counters advance only on native fulfillment and remain scoped to their run',async()=>{
 let time=100,resolve,reject;const d=createGPUExecutionDiagnostics({now:()=>time});d.begin(1);d.stage('command-submit');
 const first=d.submitted(256),native=new Promise(r=>resolve=r),observed=d.observe(native,first);time=150;
 assert.equal(d.snapshot().submittedCommands,256);assert.equal(d.snapshot().confirmedCommands,0);assert.equal(d.snapshot().runElapsedMs,50);
 resolve();await observed;assert.equal(d.snapshot().confirmedCommands,256);assert.equal(d.snapshot().fulfilledFences,1);
 const second=d.submitted(512),bad=d.observe(new Promise((_,r)=>reject=r),second),rejected=assert.rejects(bad,/native failed/);reject(Error('native failed'));await rejected;
 assert.equal(d.snapshot().confirmedCommands,256);assert.equal(d.snapshot().fulfilledFences,1);
 const final=d.submitted(512,{resultCopy:true});assert.equal(d.snapshot().resultCopySubmitted,true);const late=d.observe(Promise.resolve(),final);d.begin(2);await late;
 assert.equal(d.snapshot().submittedFences,0);assert.equal(d.snapshot().fulfilledFences,0);assert.equal(d.snapshot().confirmedCommands,0);
});
test('GPU context snapshots only exposed scalars without requesting adapters or retaining native objects',()=>{
 let requests=0;const native={secret:'no'},adapter={info:{vendor:'test',architecture:'arch',device:'id',description:'desc'},isFallbackAdapter:false,requestDevice(){requests++;},secret:native};
 const context=snapshotGPUEnvironment({navigator:{userAgent:'test-browser',userAgentData:{platform:'test-platform'},gpu:{requestAdapter(){requests++;}}},adapter,device:{limits:{maxStorageBuffersPerShaderStage:10,maxBufferSize:1024,maxStorageBufferBindingSize:512}},sourceRevision:'reviewed',manifestSha256:'abc'});
 assert.equal(requests,0);assert.equal(context.userAgent,'test-browser');assert.equal(context.maxStorageBuffersPerShaderStage,10);assert.equal(Object.isFrozen(context),true);assert.equal(JSON.stringify(context).includes('secret'),false);
 const copied=snapshotGPULossDiagnostics({...context,nativeStage:'finish-map-pending',runElapsedMs:150,arbitrary:native,submittedCommands:NaN});assert.equal(copied.nativeStage,'finish-map-pending');assert.equal('arbitrary'in copied,false);assert.equal('submittedCommands'in copied,false);
 const unsafe={get info(){throw Error('unavailable');},get isFallbackAdapter(){throw Error('unavailable');}};assert.doesNotThrow(()=>snapshotGPUEnvironment({adapter:unsafe}));
});
