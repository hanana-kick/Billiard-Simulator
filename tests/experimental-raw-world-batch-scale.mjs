import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const frozenCPU=JSON.parse(readFileSync(new URL('../artifacts/raw-world-batch/scale-cpu-reference.json',import.meta.url),'utf8')); 
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {CANONICAL_DEFAULT_PARAMETERS,encodeCanonicalScene,createCanonicalRequest,createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch,snapshotRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
const require=createRequire(import.meta.url),RAPIER=require('../vendor/rapier.cjs');await RAPIER.init();require('../src/math.js');require('../src/physics.js');
const lab=new PhysicsLab(RAPIER),snapshot=lab.snapshot();lab.dispose();
const R=.03075,v=(x=0,y=0,z=0)=>({x,y,z});
snapshot.params={...CANONICAL_DEFAULT_PARAMETERS};
snapshot.objects=[{id:50,p:[0,R,0]},{id:8,p:[.085,R,0]},{id:300,p:[-.6,R,.45]},{id:19,p:[.9,R,-.4]}].map(x=>({id:x.id,shape:'sphere',kind:'ball',radius:R,mass:.21,pos:v(...x.p),v:v(),w:v(),rot:{x:0,y:0,z:0,w:1}}));
const admission=encodeCanonicalScene(snapshot,{objectIds:snapshot.objects.map(x=>x.id),staticCount:snapshot.statics.length});assert.equal(admission.admitted,true);
const request=createCanonicalRequest({scene:admission.scene,epoch:7,requestId:17,selectedId:50,purpose:'search',executionProfile:'canonical-local-v1',budget:{maximumTicks:2**23,maximumEvents:1024,maximumWorkItems:1000000},rules:{game:4,firstId:8,secondId:300,opponentId:19,threeCushion:false,search:true,method:'carom',minCushions:0,allowKiss:false,kissFacts:false,conditionOnly:false}});
const rawBinding=prepareRawWorldBinding(request,{absoluteTick:1234,sceneKey:11,requestKey:23});

import {prepareExperimentalRawWorldBatchContinuation} from '../src/direct-candidate/experimental-raw-world-batch-binding.mjs';
import {createExperimentalRawWorldBatchGPU} from '../src/direct-candidate/experimental-raw-world-batch-gpu.mjs';
const batchBinding=prepareExperimentalRawWorldBatchContinuation(request,rawBinding.shotClock,{sceneKey:11,requestKey:23,durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:64});

function candidate(id,speed=.5,angle=35){return createCanonicalCandidate(request,id,{angle,elevation:25,speed,tipX:.2,tipY:0});}
function batch(candidates,maximumSteps=2048){return prepareRawWorldBatch(rawBinding,candidates,{maximumSteps});}

test('scale reference owns 1024 unique identities from the explicit frozen CPU',()=>{
 const bytes=gunzipSync(Buffer.from(frozenCPU.stress.words,'base64')),words=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),rows=frozenCPU.stress.candidates;
 assert.equal(frozenCPU.sourceCommit,'0850a4d');assert.equal(rows.length,1024);assert.equal(new Set(rows.map(c=>c.id)).size,1024);assert.equal(words.length,1024*2916);
 for(let i=0;i<rows.length;i++){assert.equal(words[i*2916],rows[i].id);assert.equal(words[i*2916+2896],rows[i].id);assert.deepEqual(rows[i].settings,{angle:[0,90,330][i%3],elevation:25,speed:.5,tipX:.2,tipY:0});}
});

test('native N256 full words and single-pass N1024 compact tile match frozen CPU', {skip:!process.env.GPU_NATIVE_MODULE},async t=>{
 const widths=(process.env.RAW_WORLD_BATCH_SCALE_WIDTHS??'256,1024').split(',').map(Number);
 assert.ok(widths.length&&widths.every(n=>[256,1024].includes(n)));
 const bytes=gunzipSync(Buffer.from(frozenCPU.stress.words,'base64')),reference=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
 assert.equal(frozenCPU.sourceCommit,'0850a4d');assert.equal(frozenCPU.stress.candidates.length,1024);assert.equal(reference.length,1024*2916);
 const raw=snapshotRawWorldBatch(batch([candidate(100,.5,0)])),sha=w=>createHash('sha256').update(new Uint8Array(w.buffer,w.byteOffset,w.byteLength)).digest('hex');
 assert.equal(sha(raw.rawScene),frozenCPU.rawSceneSHA256);assert.equal(sha(raw.template),frozenCPU.worldTemplateSHA256);
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();
 try{
  const engine=await createExperimentalRawWorldBatchGPU(device,batchBinding,{strikeBackend:'chunked-16',diagnostic:widths.includes(256)});
  console.log(JSON.stringify({phase:'compiled',compileMs:engine.compileMs,candidateWidths:widths}));
  let comparedWords=0;
  for(const n of widths){
   const rows=frozenCPU.stress.candidates.slice(0,n).map(c=>createCanonicalCandidate(request,c.id,c.settings));
   if(n===1024){
    const expected=new Uint32Array(n*4);for(let i=0;i<n;i++)expected.set(reference.subarray(i*2916+2896,i*2916+2900),i*4);
    console.log(JSON.stringify({phase:'compact-only-start',candidateCount:n}));
    const result=await engine.run(batch(rows),{diagnostic:false});assert.equal(result.words,undefined);assert.deepEqual(result.compact,expected);assert.equal(result.metrics.readbackBytes,16*n);
    assert.equal(result.metrics.submissions,1);assert.equal(result.metrics.intermediateReadbacks,0);assert.equal(result.metrics.hostPhysicsBetweenPhases,0);assert.ok(result.metrics.allocatedBytes<256*1024*1024);
    for(const key of ['hostPrepareMs','encodeMs','submitToQueueDoneMs','readbackMs'])assert.ok(Number.isFinite(result.metrics[key])&&result.metrics[key]>=0);
    comparedWords+=expected.length;t.diagnostic(JSON.stringify({checkpoint:'0850a4d',candidateCount:n,comparedCompactWords:expected.length,compileMs:engine.compileMs,metrics:result.metrics,softwareVulkanOnly:true,diagnostic:false,physicsRuns:1,scope:'all1024 compact results only; full trajectories qualified separately atN256;3 parameter classes with unique IDs; not goal-at-scale or hardware throughput'}));continue;
   }
   console.log(JSON.stringify({phase:'diagnostic-start',candidateCount:n}));
   const result=await engine.run(batch(rows));console.log(JSON.stringify({phase:'diagnostic-finished',candidateCount:n,metrics:result.metrics}));assert.deepEqual(result.words,reference.slice(0,n*2916));comparedWords+=n*2916;
   assert.equal(result.metrics.intermediateReadbacks,0);assert.equal(result.metrics.hostPhysicsBetweenPhases,0);assert.equal(result.metrics.submissions,1);for(const key of ['hostPrepareMs','encodeMs','submitToQueueDoneMs','readbackMs'])assert.ok(Number.isFinite(result.metrics[key])&&result.metrics[key]>=0);
   // A reversed compact-only tile tests ownership while mapping precisely 16B/row.
   console.log(JSON.stringify({phase:'compact-reverse-start',candidateCount:n}));
   const compact=await engine.run(batch(rows.slice().reverse()),{diagnostic:false});assert.equal(compact.words,undefined);assert.equal(compact.metrics.readbackBytes,n*16);
   for(let i=0;i<n;i++)assert.deepEqual(compact.compact.slice(i*4,i*4+4),result.compact.slice((n-1-i)*4,(n-i)*4));
   t.diagnostic(JSON.stringify({checkpoint:'0850a4d',candidateCount:n,comparedWords:n*2916,compileMs:engine.compileMs,diagnosticMetrics:result.metrics,compactReversedMetrics:compact.metrics,softwareVulkanOnly:true,scope:'actual raw hit/REST and honest pending, 3 repeated parameter classes with unique candidate IDs; not goal or physical GPU throughput'}));
  }
  t.diagnostic(JSON.stringify({candidateWidths:widths,comparedWords}));
 }finally{device.destroy();}
});
