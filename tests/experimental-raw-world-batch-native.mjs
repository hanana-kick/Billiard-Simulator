import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const frozenCPU=JSON.parse(readFileSync(new URL('../artifacts/raw-world-batch/frozen-cpu-reference.json',import.meta.url),'utf8')); 
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {CANONICAL_DEFAULT_PARAMETERS,encodeCanonicalScene,createCanonicalRequest,createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch,snapshotRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {preparedWorldWords} from '../src/direct-candidate/deterministic-prepared-world-gpu.mjs';
import {prepareCanonicalWorldContinuation,runCanonicalRawWorldContinuationCPU,createCanonicalWorldContinuationGPU} from '../src/direct-candidate/canonical-world-continuation.mjs';
const require=createRequire(import.meta.url),RAPIER=require('../vendor/rapier.cjs');await RAPIER.init();require('../src/math.js');require('../src/physics.js');
const lab=new PhysicsLab(RAPIER),snapshot=lab.snapshot();lab.dispose();
const R=.03075,v=(x=0,y=0,z=0)=>({x,y,z});
snapshot.params={...CANONICAL_DEFAULT_PARAMETERS};
snapshot.objects=[{id:50,p:[0,R,0]},{id:8,p:[.085,R,0]},{id:300,p:[-.6,R,.45]},{id:19,p:[.9,R,-.4]}].map(x=>({id:x.id,shape:'sphere',kind:'ball',radius:R,mass:.21,pos:v(...x.p),v:v(),w:v(),rot:{x:0,y:0,z:0,w:1}}));
const admission=encodeCanonicalScene(snapshot,{objectIds:snapshot.objects.map(x=>x.id),staticCount:snapshot.statics.length});assert.equal(admission.admitted,true);
const request=createCanonicalRequest({scene:admission.scene,epoch:7,requestId:17,selectedId:50,purpose:'search',executionProfile:'canonical-local-v1',budget:{maximumTicks:2**23,maximumEvents:1024,maximumWorkItems:1000000},rules:{game:4,firstId:8,secondId:300,opponentId:19,threeCushion:false,search:true,method:'carom',minCushions:0,allowKiss:false,kissFacts:false,conditionOnly:false}});
const rawBinding=prepareRawWorldBinding(request,{absoluteTick:1234,sceneKey:11,requestKey:23});
const binding=prepareCanonicalWorldContinuation(request,rawBinding.shotClock,{sceneKey:11,requestKey:23,durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:64});

import {prepareExperimentalRawWorldBatchContinuation} from '../src/direct-candidate/experimental-raw-world-batch-binding.mjs';
import {createExperimentalRawWorldBatchGPU} from '../src/direct-candidate/experimental-raw-world-batch-gpu.mjs';
const batchBinding=prepareExperimentalRawWorldBatchContinuation(request,rawBinding.shotClock,{sceneKey:11,requestKey:23,durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:64});

function candidate(id,speed=.5,angle=35){return createCanonicalCandidate(request,id,{angle,elevation:25,speed,tipX:.2,tipY:0});}
function batch(candidates,maximumSteps=2048){return prepareRawWorldBatch(rawBinding,candidates,{maximumSteps});}
function cpu(candidate){const out=runCanonicalRawWorldContinuationCPU(binding,batch([candidate])),c=out.continuation;return {out,words:c?Uint32Array.from([...preparedWorldWords(c),...c.journalWords,...c.journalAuxWords,...c.ruleState,...c.compactResult,...out.rawHandoffStatus]):null};}
test('full raw N batch binding remains separately owned and bounded',async()=>{
 const c=candidate(100,.5,0),expected=cpu(c);const raw=snapshotRawWorldBatch(batch([c])),sha=w=>createHash('sha256').update(new Uint8Array(w.buffer,w.byteOffset,w.byteLength)).digest('hex');assert.equal(sha(raw.rawScene),frozenCPU.rawSceneSHA256);assert.equal(sha(raw.template),frozenCPU.worldTemplateSHA256);assert.equal(request.sceneId,frozenCPU.sceneIdentity);assert.equal(request.requestKey,frozenCPU.requestIdentity);assert.equal(expected.out.continuation.nominalRest,true);assert.equal(expected.words.length,2916);
 await assert.rejects(createExperimentalRawWorldBatchGPU({},batchBinding,{strikeBackend:'unexpected'}),/backend/);
 assert.throws(()=>prepareExperimentalRawWorldBatchContinuation(request,rawBinding.shotClock,{sceneKey:11,requestKey:23,durationTicks:65535,budgets:[1,1,1,1,1,1,1],maxWorldSteps:128}),/bounded/);
});
test('native frozen N1 then N3 raw world journal rules are candidate-local', {skip:!process.env.GPU_NATIVE_MODULE},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();
 try{
  const engine=await createExperimentalRawWorldBatchGPU(device,batchBinding,{strikeBackend:'chunked-16',diagnostic:true});
  const cs=[candidate(100,.5,0),candidate(4294967294,.5,90),candidate(300,.5,330)],expected=frozenCPU.cases;let compared=0;
  assert.equal(frozenCPU.sourceCommit,'0850a4d');for(let i=0;i<cs.length;i++)assert.deepEqual(cs[i].settings,expected[i].settings);
  const singles=[];
  for(let i=0;i<cs.length;i++){const r=await engine.run(batch([cs[i]]));assert.deepEqual(r.words,Uint32Array.from(expected[i].words),`N1 lane${i} CPU`);singles.push(r.words);compared+=r.words.length;}
  const multi=await engine.run(batch(cs));for(let i=0;i<cs.length;i++){assert.deepEqual(multi.words.slice(i*2916,(i+1)*2916),singles[i],`N3 lane${i} sentinel isolation`);assert.deepEqual(multi.compact.slice(i*4,i*4+4),Uint32Array.from(expected[i].compact));compared+=2916;}
  const mixed=await engine.run(batch([cs[0],candidate(19,10),cs[2]]));assert.deepEqual(mixed.words.slice(0,2916),singles[0]);assert.deepEqual(mixed.words.slice(2*2916,3*2916),singles[2]);assert.equal(mixed.compact[7],0x80000000,'failed raw candidate never scores');assert.notEqual(mixed.words[2916+2901],1,'failed raw handoff is not READY');compared+=5832;
  const aborted=new AbortController();aborted.abort();await assert.rejects(engine.run(batch(cs),{signal:aborted.signal}),{name:'AbortError'});
  const cancel=new AbortController(),submit=device.queue.submit;device.queue.submit=function(commands){submit.call(this,commands);cancel.abort();};try{await assert.rejects(engine.run(batch(cs),{signal:cancel.signal}),{name:'AbortError'});}finally{device.queue.submit=submit;}
  const again=await engine.run(batch(cs));assert.deepEqual(again.words,multi.words);compared+=again.words.length;
  const compactOnly=await engine.run(batch(cs),{diagnostic:false});assert.equal(compactOnly.words,undefined);assert.equal(compactOnly.metrics.readbackBytes,48);assert.deepEqual(compactOnly.compact,multi.compact);
  const stressWidths=process.env.RAW_WORLD_BATCH_WIDTHS?.split(',').map(Number)??[];
  if(stressWidths.length){const bytes=gunzipSync(Buffer.from(frozenCPU.stress.words,'base64')),reference=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);assert.equal(frozenCPU.stress.wordStride,2916);
   for(const n of stressWidths){assert.ok([31,32,33].includes(n));const rows=frozenCPU.stress.candidates.slice(0,n).map(c=>createCanonicalCandidate(request,c.id,c.settings)),r=await engine.run(batch(rows));assert.deepEqual(r.words,reference.slice(0,n*2916),`N${n} frozen CPU words`);compared+=r.words.length;const permuted=rows.slice().reverse(),p=await engine.run(batch(permuted));for(let i=0;i<n;i++)assert.deepEqual(p.words.slice(i*2916,(i+1)*2916),reference.slice((n-1-i)*2916,(n-i)*2916),`N${n} permutation lane${i}`);compared+=p.words.length;}
  }
  assert.equal(multi.metrics.intermediateReadbacks,0);assert.equal(multi.metrics.hostPhysicsBetweenPhases,0);assert.equal(multi.metrics.submissions,1);
  t.diagnostic(JSON.stringify({checkpoint:'0850a4d',compileMs:engine.compileMs,comparedWords:compared,candidateWidths:[1,3,...stressWidths],compactOnlyReadbackChecked:true,scope:'actual owned raw hit and other trajectories on the same immutable scene, plus raw failure; not a goal claim',metrics:multi.metrics,softwareVulkanOnly:true}));
 }finally{device.destroy();}
});
