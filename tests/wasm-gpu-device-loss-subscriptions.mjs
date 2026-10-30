import test from 'node:test';import assert from 'node:assert/strict';
import {subscribeDeviceLoss} from '../src/wasm-gpu/device-loss-subscriptions.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
test('one native loss observer serves removable listeners across retired owners',async()=>{
 let resolve,count=0;const promise=new Promise(r=>resolve=r),device={lost:{then(a,b){count++;return promise.then(a,b);}}},seen=[];
 for(let i=0;i<1000;i++){const remove=subscribeDeviceLoss(device,()=>seen.push('retired'));remove();remove();}
 subscribeDeviceLoss(device,x=>seen.push(x.message));await tick();assert.equal(count,1);resolve({message:'lost'});await tick();assert.deepEqual(seen,['lost']);
});
test('throwing loss listener cannot prevent remaining owners receiving loss',async()=>{
 let resolve;const device={lost:new Promise(r=>resolve=r)},seen=[];subscribeDeviceLoss(device,()=>{throw Error('bad observer');});subscribeDeviceLoss(device,()=>seen.push('notified'));resolve({message:'lost'});await tick();assert.deepEqual(seen,['notified']);
});
test('late listener receives settled loss unless removed before microtask',async()=>{
 const device={lost:Promise.resolve({message:'already lost'})},seen=[];const first=subscribeDeviceLoss(device,()=>{});await tick();first();subscribeDeviceLoss(device,x=>seen.push(x.message));const remove=subscribeDeviceLoss(device,()=>seen.push('removed'));remove();await tick();assert.deepEqual(seen,['already lost']);
});

test('late throwing listener is isolated from later settled delivery',async()=>{
 const device={lost:Promise.resolve({message:'lost'})};subscribeDeviceLoss(device,()=>{});await tick();let notified=false;subscribeDeviceLoss(device,()=>{throw Error('late observer');});subscribeDeviceLoss(device,()=>{notified=true;});await tick();assert.equal(notified,true);
});
