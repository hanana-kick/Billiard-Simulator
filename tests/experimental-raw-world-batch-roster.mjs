import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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

import {prepareExperimentalRawWorldBatchContinuation} from '../src/direct-candidate/experimental-raw-world-batch-binding.mjs';
const options={sceneKey:11,requestKey:23,durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:64};
function fixture(originalId,newId){
 const remap=id=>id===originalId?newId:id,objects=snapshot.objects.map(x=>({...x,id:remap(x.id)}));
 const admitted=encodeCanonicalScene({...snapshot,objects},{objectIds:objects.map(x=>x.id),staticCount:snapshot.statics.length});assert.equal(admitted.admitted,true,'canonical scene keeps full-u32 IDs');
 const request=createCanonicalRequest({scene:admitted.scene,epoch:7,requestId:17,selectedId:remap(50),purpose:'search',executionProfile:'canonical-local-v1',budget:{maximumTicks:2**23,maximumEvents:1024,maximumWorkItems:1000000},rules:{game:4,firstId:remap(8),secondId:remap(300),opponentId:remap(19),threeCushion:false,search:true,method:'carom',minCushions:0,allowKiss:false,kissFacts:false,conditionOnly:false}});
 return {request,raw:prepareRawWorldBinding(request,{absoluteTick:1234,sceneKey:11,requestKey:23})};
}
test('both frozen execution revisions reject high-bit stable roster IDs without rewriting them',()=>{
 for(const pipelineRevision of ['0850a4d','0850a4d+host128-v1'])for(const originalId of [50,8,300,19])for(const high of [0x80000000,0xffffffff]){
  const {request,raw}=fixture(originalId,high);assert.ok(request.slotToId.includes(high));
  assert.throws(()=>prepareExperimentalRawWorldBatchContinuation(request,raw.shotClock,{...options,pipelineRevision}),/stable roster IDs <= 0x7fffffff/);assert.ok(request.slotToId.includes(high));
 }
});
test('signed-range boundary roster and independent full-u32 candidate IDs remain admitted',()=>{
 for(const pipelineRevision of ['0850a4d','0850a4d+host128-v1']){
  const {request,raw}=fixture(8,0x7fffffff),binding=prepareExperimentalRawWorldBatchContinuation(request,raw.shotClock,{...options,pipelineRevision});assert.equal(binding.pipelineRevision,pipelineRevision);
  const candidates=[0x80000000,0xfffffffe,0xffffffff].map(id=>createCanonicalCandidate(request,id,{angle:0,elevation:25,speed:.5,tipX:0,tipY:.2}));
  const rows=snapshotRawWorldBatch(prepareRawWorldBatch(raw,candidates,{maximumSteps:2048})).rawRows;
  assert.deepEqual([rows[0],rows[16],rows[32]],[0x80000000,0xfffffffe,0xffffffff]);
 }
});
test('archived actual mixed-shot reproduction distinguishes stable roster and candidate IDs',()=>{
 const proof=JSON.parse(readFileSync(new URL('../artifacts/raw-world-batch/frozen-roster-id-domain.json',import.meta.url),'utf8'));
 assert.equal(proof.sourceCommit,'0850a4d');assert.equal(proof.sourceSHA256,'fd1af44ac621cc61620d2468480f2d3b76fd464a0ea8aa556c2c53bb8b19fb66');
 assert.deepEqual(proof.cases.map(x=>x.outcome),['returned','returned','threw','threw']);
 for(const x of proof.cases){assert.equal(x.candidateId,0xfffffffe);if(x.outcome==='threw'){assert.equal(x.message,'Smooth input range');assert.ok(x.stack.some(l=>l.includes('advanceMixedWorldCPU')));}else assert.equal(x.state[1],9);}
});
