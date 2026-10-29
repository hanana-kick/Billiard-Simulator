/** Current selected host input differential; no GPU/CPU dynamics. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {encodeCanonicalScene,createCanonicalRequest,createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {prepareCanonicalWorldContinuation} from '../src/direct-candidate/canonical-world-continuation.mjs';
import {createWasmGpuSelectedArtifact,captureWasmGpuSelectedProgram} from '../src/wasm-gpu/selected-artifact-builder.mjs';
import {loadWasmGpuSelectedArtifact} from '../src/wasm-gpu/selected-artifact.mjs';
import {prepareWasmGpuSelectedInputs} from '../src/wasm-gpu/selected-inputs.mjs';
const base=mmq2RawFixture();
function current(changed=false,candidateId=100){
 const p=structuredClone(base.request.scene.physical),shift=changed?1/1024:0,id=x=>x+(changed?1000:0);
 const objects=p.bodies.map(x=>({...x,id:id(x.id),pos:{...x.pos,x:x.pos.x+shift},rot:{x:0,y:0,z:0,w:1}}));
 const statics=p.statics.map(({rotation,...x})=>({...x,pos:{...x.pos,x:x.pos.x+shift},rot:rotation}));
 const encoded=encodeCanonicalScene({params:p.parameters,...p.sourceSettings,objects,statics},{objectIds:objects.map(x=>x.id),staticCount:statics.length});assert.equal(encoded.admitted,true,JSON.stringify(encoded.reasons));
 const r=base.request,request=createCanonicalRequest({scene:encoded.scene,epoch:changed?9:7,requestId:changed?31:17,selectedId:id(r.selectedId),purpose:r.purpose,executionProfile:r.profileId,budget:{...r.budget,maximumTicks:changed?2**23:2**24},rules:{...r.rules,firstId:id(r.rules.firstId),secondId:id(r.rules.secondId),opponentId:id(r.rules.opponentId),allowKiss:!changed}});
 const rawBinding=prepareRawWorldBinding(request,{absoluteTick:changed?4321:1234,sceneKey:changed?77:11,requestKey:changed?81:23}),candidate=createCanonicalCandidate(request,candidateId,{...base.candidate.settings,angle:changed?45:0}),batch=prepareRawWorldBatch(rawBinding,[candidate],{maximumSteps:2048});
 const binding=prepareCanonicalWorldContinuation(request,rawBinding.shotClock,{sceneKey:changed?77:11,requestKey:changed?81:23,durationTicks:changed?4096:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:128,tailMaxNodes:changed?64:256,enableCushionContinuation:true,mixedMotionRevision:'mmq2'});
 return {request,binding,batch,rawBinding,candidate};
}
const f=current(),sourceRevision='selected-current-input-test',{artifact}=await createWasmGpuSelectedArtifact({...f,sourceRevision}),engine=await loadWasmGpuSelectedArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:sourceRevision});
const sha=x=>createHash('sha256').update(x).digest('hex');
test('all selected uploads match genuine source capture across current geometry/rules/IDs/clock',async()=>{
 const golden=JSON.parse(await readFile(new URL('./fixtures/selected-current-input-baseline-digests.json',import.meta.url),'utf8'));assert.equal(golden.sourceCommit,'715b503f57f6962d99c7a85a787995284960ee8b');
 for(const changed of [false,true]){const x=changed?current(true,777):f,input=prepareWasmGpuSelectedInputs({engine,...x,maximumRecords:256}),{recorder:r}=await captureWasmGpuSelectedProgram(x);assert.equal(input.initialUploads.length,r.buffers.length);for(const u of input.initialUploads)assert.deepEqual(u.initial,r.buffers[u.index].bytes,'allocation '+u.index);assert.equal(input.candidateIds[0],x.candidate.candidateId);
  const expected=golden.cases[changed?'changed':'default'];assert.equal(sha(JSON.stringify(r.buffers.map(b=>[b.size,b.usage,sha(b.bytes)]))),expected.buffers);assert.equal(sha(JSON.stringify(r.commands)),expected.commands);assert.equal(sha(JSON.stringify(r.modules.map(m=>({code:m.code,label:m.label})))),expected.modules);
 }
});
test('owned current inputs are copied; cached original geometry and identity inputs cannot be poisoned',()=>{
 const first=prepareWasmGpuSelectedInputs({engine,...f}),baseline=first.initialUploads.map(u=>u.initial.slice());first.initialUploads.forEach(u=>u.initial.fill(255));first.candidateIds[0]=999;const second=prepareWasmGpuSelectedInputs({engine,...f});second.initialUploads.forEach((u,i)=>assert.deepEqual(u.initial,baseline[i]));assert.equal(second.candidateIds[0],100);
});
test('selected adapter rejects forged owners, mismatched requests, record cap and raw/world work shapes',()=>{
 assert.throws(()=>prepareWasmGpuSelectedInputs({engine:{...engine},...f}),/Owned/);assert.throws(()=>prepareWasmGpuSelectedInputs({engine,...f,binding:{...f.binding}}),/Owned/);assert.throws(()=>prepareWasmGpuSelectedInputs({engine,...f,batch:{...f.batch}}),/Owned/);assert.throws(()=>prepareWasmGpuSelectedInputs({engine,...f,maximumRecords:128}),/capsule/);assert.throws(()=>prepareWasmGpuSelectedInputs({engine,binding:f.binding,batch:current(true).batch}),/mismatch/);
 const shorter=prepareRawWorldBatch(f.rawBinding,[f.candidate],{maximumSteps:3});assert.throws(()=>prepareWasmGpuSelectedInputs({engine,...f,batch:shorter}),/capsule/);
});
test('source decorator consumes complete decoded packets; synthetic ABI test is not physics evidence',async()=>{
 const {decodePreparedWorldReadback}=await import('../src/direct-candidate/deterministic-prepared-world-readback.mjs');const {decorateCanonicalRawWorldGPUResult}=await import('../src/direct-candidate/canonical-world-continuation.mjs');
 const packet=new Uint32Array(2916);packet[0]=100;packet[1]=9;packet[5]=f.rawBinding.absoluteTick+10;packet[2848]=100;packet[2849]=1;packet[2856]=f.rawBinding.sceneKey;packet[2857]=f.rawBinding.requestKey;packet[2864+38]=10;packet[2864+39]=1;packet[2912]=100;
 const decoded=decodePreparedWorldReadback(packet,{journalBytes:4224,journalAuxBytes:4096,rawStatusBytes:64,ruleBytes:208}),decorated=decorateCanonicalRawWorldGPUResult(f.binding,f.batch,decoded);assert.equal(decorated.continuation.state,decoded.state);assert.equal(decorated.continuation.elapsedTicks,10);assert.equal(decorated.continuation.timeBudgetEnforced,true);assert.equal(decorated.continuation.kissCoverage,true);assert.equal(Object.hasOwn(decorated.continuation,'gpuQualified'),false);
 assert.throws(()=>decorateCanonicalRawWorldGPUResult(f.binding,f.batch,{rawHandoffStatus:decoded.rawHandoffStatus,compactResult:decoded.compactResult}),/Complete/);assert.throws(()=>decorateCanonicalRawWorldGPUResult(f.binding,current(true).batch,decoded),/binding/);const incomplete={rawHandoffStatus:decoded.rawHandoffStatus.slice()};incomplete.rawHandoffStatus[1]=4;assert.equal(decorateCanonicalRawWorldGPUResult(f.binding,f.batch,incomplete).continuation,null);
});
