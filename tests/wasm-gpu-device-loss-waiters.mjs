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
