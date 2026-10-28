import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const goalCPU=JSON.parse(readFileSync(new URL('../artifacts/raw-world-batch/host128-goal-cpu-reference.json',import.meta.url),'utf8')); 
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {CANONICAL_DEFAULT_PARAMETERS,encodeCanonicalScene,createCanonicalRequest,createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch,snapshotRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
const require=createRequire(import.meta.url),RAPIER=require('../vendor/rapier.cjs');await RAPIER.init();require('../src/math.js');require('../src/physics.js');
const lab=new PhysicsLab(RAPIER),snapshot=lab.snapshot();lab.dispose();
const R=.03075,v=(x=0,y=0,z=0)=>({x,y,z});
snapshot.params={...CANONICAL_DEFAULT_PARAMETERS};
snapshot.objects=goalCPU.positions.map((p,i)=>({id:[50,8,300,19][i],p})).map(x=>({id:x.id,shape:'sphere',kind:'ball',radius:R,mass:.21,pos:v(...x.p),v:v(),w:v(),rot:{x:0,y:0,z:0,w:1}}));
const admission=encodeCanonicalScene(snapshot,{objectIds:snapshot.objects.map(x=>x.id),staticCount:snapshot.statics.length});assert.equal(admission.admitted,true);
const request=createCanonicalRequest({scene:admission.scene,epoch:7,requestId:17,selectedId:50,purpose:'search',executionProfile:'canonical-local-v1',budget:{maximumTicks:2**24,maximumEvents:1024,maximumWorkItems:1000000},rules:{game:4,firstId:8,secondId:300,opponentId:19,threeCushion:false,search:true,method:'carom',minCushions:0,allowKiss:true,kissFacts:false,conditionOnly:false}});
const rawBinding=prepareRawWorldBinding(request,{absoluteTick:1234,sceneKey:11,requestKey:23});

import {prepareExperimentalRawWorldBatchContinuation} from '../src/direct-candidate/experimental-raw-world-batch-binding.mjs';
import {createExperimentalRawWorldBatchGPU} from '../src/direct-candidate/experimental-raw-world-batch-gpu.mjs';
const batchBinding=prepareExperimentalRawWorldBatchContinuation(request,rawBinding.shotClock,{sceneKey:11,requestKey:23,durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:128,pipelineRevision:'0850a4d+host128-v1'});


const shot=createCanonicalCandidate(request,100,goalCPU.shot),rawBatch=prepareRawWorldBatch(rawBinding,[shot],{maximumSteps:2048});
test('host128 goal reference preserves exact frozen physics and explicit work domain',()=>{
 const r=snapshotRawWorldBatch(rawBatch),sha=w=>createHash('sha256').update(new Uint8Array(w.buffer,w.byteOffset,w.byteLength)).digest('hex');
 assert.equal(sha(r.rawScene),goalCPU.rawSceneSHA256);assert.equal(sha(r.template),goalCPU.worldTemplateSHA256);assert.equal(batchBinding.pipelineRevision,'0850a4d+host128-v1');assert.deepEqual(goalCPU.compact,[100,1,0,1]);assert.equal(goalCPU.words.length,2916);
});
test('native actual raw goal N1 matches frozen host128 CPU through journal rules',{skip:!process.env.GPU_NATIVE_MODULE},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();
 try{const engine=await createExperimentalRawWorldBatchGPU(device,batchBinding,{strikeBackend:'chunked-16',diagnostic:true});assert.equal(engine.pipelineRevision,'0850a4d+host128-v1');const result=await engine.run(rawBatch);assert.deepEqual(result.words,Uint32Array.from(goalCPU.words));assert.deepEqual(result.compact,Uint32Array.of(100,1,0,1));const compact=await engine.run(rawBatch,{diagnostic:false});assert.equal(compact.words,undefined);assert.equal(compact.metrics.readbackBytes,16);assert.deepEqual(compact.compact,result.compact);t.diagnostic(JSON.stringify({pipelineRevision:engine.pipelineRevision,actualRawGoal:true,comparedWords:2916,compactOnly:true,compileMs:engine.compileMs,metrics:result.metrics,softwareVulkanOnly:true}));}finally{device.destroy();}
});
