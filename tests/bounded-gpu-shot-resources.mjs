// RESOURCE-LIFECYCLE TEST DOUBLES ONLY: no WebGPU compute/physics claim.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGpuResourceScope} from '../src/bounded-gpu-shot/resources.mjs';
function fakeDevice({nonextensible=false}={}) {
  let deviceDestroyed=0,bufferDestroyed=0;
  const device={createBuffer(){const b={destroy(){bufferDestroyed++;}};return nonextensible?Object.freeze(b):b;},destroy(){deviceDestroyed++;}};
  return {device,stats:()=>({deviceDestroyed,bufferDestroyed})};
}
test('resource double: repeated h-like transient allocations remove tracking immediately',()=>{
  const s=fakeDevice(),originalCreate=s.device.createBuffer,originalDeviceDestroy=s.device.destroy;
  const rendererBuffer=s.device.createBuffer(),rendererDestroy=rendererBuffer.destroy;
  const scope=createGpuResourceScope(s.device),persistent=Array.from({length:10},()=>scope.device.createBuffer({size:4}));
  for(let i=0;i<10000;i++){
    const transient=scope.device.createBuffer({size:4});assert.equal(scope.snapshot().trackedBuffers,11);
    transient.destroy();assert.equal(scope.snapshot().trackedBuffers,10);
  }
  assert.deepEqual(scope.snapshot(),{buffersCreated:10010,buffersDestroyed:10000,buffersCollected:0,trackedBuffers:10,peakTrackedBuffers:11});
  assert.equal(s.device.createBuffer,originalCreate);assert.equal(s.device.destroy,originalDeviceDestroy);
  assert.equal(rendererBuffer.destroy,rendererDestroy);assert.equal(s.stats().bufferDestroyed,10000);
  assert.throws(()=>scope.device.destroy(),/Borrowed/);scope.dispose();
  assert.equal(scope.snapshot().trackedBuffers,0);assert.equal(scope.snapshot().buffersDestroyed,10010);
  scope.dispose();assert.equal(s.stats().deviceDestroyed,0);assert.equal(s.stats().bufferDestroyed,10010);
  rendererBuffer.destroy();assert.equal(s.stats().bufferDestroyed,10011);assert.equal(persistent.length,10);
});
test('resource double: partial asynchronous stage construction buffers are still owned and released',async()=>{
  const s=fakeDevice(),scope=createGpuResourceScope(s.device);
  await assert.rejects(async()=>{scope.device.createBuffer({size:4});await Promise.resolve();scope.device.createBuffer({size:4});throw Error('constructor failed');});
  assert.equal(scope.snapshot().trackedBuffers,2);scope.dispose();assert.equal(scope.snapshot().trackedBuffers,0);
  assert.equal(scope.snapshot().buffersDestroyed,2);assert.equal(s.stats().deviceDestroyed,0);
});
test('resource double: nonextensible native wrappers retain safe weak cleanup fallback',()=>{
  const s=fakeDevice({nonextensible:true}),scope=createGpuResourceScope(s.device);
  const buffer=scope.device.createBuffer({size:4});buffer.destroy();
  assert.equal(scope.snapshot().trackedBuffers,1);scope.dispose();assert.equal(scope.snapshot().trackedBuffers,0);
  assert.equal(s.stats().deviceDestroyed,0);
});


test('resource double: falsy destruction errors are reported, all other buffers still release',()=>{
  for(const thrown of [null,undefined,0]){
    let index=0,allow=false;
    const scope=createGpuResourceScope({createBuffer(){const id=index++;return {destroy(){if(id===0&&!allow)throw thrown;}};}});
    const buffers=[scope.device.createBuffer({}),scope.device.createBuffer({})];
    assert.throws(()=>scope.dispose(),Error);assert.equal(scope.snapshot().trackedBuffers,1);
    assert.equal(scope.snapshot().buffersDestroyed,1);assert.equal(buffers.length,2);
    allow=true;scope.dispose();assert.equal(scope.snapshot().trackedBuffers,0);
  }
});
