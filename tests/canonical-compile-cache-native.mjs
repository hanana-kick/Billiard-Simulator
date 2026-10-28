import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createCanonicalCompileCacheDevice} from '../src/direct-candidate/canonical-compile-cache-device.mjs';
import {packSmoothSegments,runSmoothSegmentsCPU,createSmoothSegmentsGPU} from '../src/direct-candidate/deterministic-smooth-segment.mjs';
import {packContacts3D,runContacts3DCPU,createContacts3DGPU} from '../src/direct-candidate/deterministic-contact-3d.mjs';
const Q=2**24,R=.03075;
const smooth=packSmoothSegments(Array.from({length:8},(_,i)=>({id:i,state:[0,0,...[.8+i*.01,.2,.3,-.5,.1].map(x=>Math.round(x*Q))],budgets:[2000,2000,20000,20000,20000,20000,20000],friction:Math.round(.2*9.81*Q),rolling:Math.round(2.5*9.81*.00045/R*Q),normalSpinDrag:Math.round(2.5*9.81*.00035/R*Q),durationTicks:8192+i*100,maxAttempts:16})));
const body=(position,velocity,q)=>({position,velocity,q,radius:R,mass:.21});
const contacts=packContacts3D(Array.from({length:4},(_,i)=>({id:i,provenance:'prepared-isolated-3d-pair-cloth',bodies:[body([0,.3,0],[.8,-.1,.2],[.2,.3,-.1]),body([2*R-2e-6,.3,0],[-.2,0,-.1],[-.1,.2,.1])],floorTop:0,overlapBudget:5e-6,pairRestitution:.4,pairFriction:i*.1,clothRestitution:.2,clothFriction:.2,floorMask:0,maxIterations:256,residualBudgetQuanta:256})));
const expectedSmooth=runSmoothSegmentsCPU(smooth),expectedContacts=runContacts3DCPU(contacts);
test('cache benchmark fixture includes accepted smooth and contact results',()=>{assert.equal(expectedSmooth[1],1);assert.equal(expectedContacts[1],1);});
test('opt-in native compile cache keeps unchanged smooth/contact results exact',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:110000},async t=>{
 const mode=process.env.CANONICAL_CACHE_MODE;assert.ok(['cached','uncached'].includes(mode),'explicit separate-process mode required');
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),native=await adapter.requestDevice(),counts={modules:0,pipelines:0,buffers:0,allocatedBytes:0};
 const counted=new Proxy(native,{get(target,key){if(key==='createShaderModule')return d=>{counts.modules++;return target.createShaderModule(d);};if(key==='createComputePipelineAsync')return d=>{counts.pipelines++;return target.createComputePipelineAsync(d);};if(key==='createBuffer')return d=>{counts.buffers++;counts.allocatedBytes+=d.size;return target.createBuffer(d);};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
 const device=mode==='cached'?createCanonicalCompileCacheDevice(counted):counted,measurements=[],hash=createHash('sha256');let words=0;
 try{
  for(let repetition=0;repetition<2;repetition++){
   const a=await createSmoothSegmentsGPU(device),b=await createContacts3DGPU(device),ar=await a.run(smooth),br=await b.run(contacts);
   assert.deepEqual(ar.output,expectedSmooth);assert.deepEqual(br.result,expectedContacts);
   for(const out of [ar.output,br.result]){hash.update(out);words+=out.length;}
   measurements.push({repetition,smoothCompileMs:a.compileMs,contactCompileMs:b.compileMs,smoothSubmitToReadMs:ar.metrics.submitToDoneMs,contactSubmitToReadMs:br.metrics.submitToReadMs});
  }
  assert.equal(counts.modules,mode==='cached'?4:8);assert.equal(counts.pipelines,mode==='cached'?7:8);assert.equal(counts.buffers,16);
  t.diagnostic(JSON.stringify({mode,backend:'SwiftShader software Vulkan; not hardware throughput',counts,measurements,words,digest:hash.digest('hex'),exactCPUAndGPU:true,productionWired:false}));
 }finally{native.destroy();gpu.destroy?.();}
});
