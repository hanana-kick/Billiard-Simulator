import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixtures/canonical-selected-source.mjs';
import {threeBallFixture} from './fixtures/canonical-three-ball-source.mjs';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {captureLiveWorldPlan,assertLiveWorldPlansEqual} from '../src/direct-candidate/experimental-live-world-capture.mjs';
import {lowerLiveWorldPlans,assertLiveWorldRecipesEqual,createExperimentalLiveWorldBatchGPU} from '../src/direct-candidate/experimental-live-world-batch.mjs';
import {createLiveWorldUploadPreparer} from '../src/direct-candidate/experimental-live-world-uploads.mjs';
for(const [name,make,profile]of[['four-ball MMQ1',fixture,'mmq1-no-cushion'],['three-ball MMQ1',threeBallFixture,'mmq1-no-cushion'],['four-ball MMQ2',mmq2RawFixture,'mmq2-cushion']])test(name+' original tiny packer uploads equal every full-capture initial byte',async()=>{
 const f=make(),plan=await captureLiveWorldPlan(f.binding,f.batch,{profile}),prepare=await createLiveWorldUploadPreparer({request:f.request,binding:f.binding,batch:f.batch,profile,expectedPlan:plan});assert.deepEqual(prepare.roles.map(x=>x.size),[24,32]);assert.equal(prepare.graphReuseQualified,false);assert.equal(prepare.sourceQualified,false);const fullPlans=[];
 for(const [i,settings]of [{angle:0,speed:.5,tipX:0,tipY:0,elevation:0},{angle:90,speed:1,tipX:.2,tipY:-.2,elevation:25},{angle:330,speed:2,tipX:-.4,tipY:.4,elevation:45},{angle:180,speed:.5,tipX:.95,tipY:.95,elevation:80}].entries()){
  const candidate=createCanonicalCandidate(f.request,[0,0xfffffffe,300,0xffffffff][i],{...f.candidate.settings,...settings}),batch=prepareRawWorldBatch(f.batch.binding,[candidate],{maximumSteps:2048}),full=await captureLiveWorldPlan(f.binding,batch,{profile}),token=await prepare.prepare(batch),small=prepare.diagnosticPlan(token);if(i===3)assert.equal(candidate.admitted,false);assert.equal(prepare.snapshotUploads(token).reduce((n,x)=>n+x.initial.byteLength,0),56);assertLiveWorldPlansEqual(full,small);assert.deepEqual(small.allocations,full.allocations);if(i<3)fullPlans.push(full);
 }
 const original=await lowerLiveWorldPlans(fullPlans),uploadOnly=await lowerLiveWorldPlans(Array(3).fill(fullPlans[0]),{candidateLocalAllocations:prepare.roles.map(x=>x.index)});assertLiveWorldRecipesEqual(original,uploadOnly);
});
test('source role drift and forged batch reject',async()=>{const profile='mmq1-no-cushion',f=fixture(),plan=await captureLiveWorldPlan(f.binding,f.batch),p=await createLiveWorldUploadPreparer({request:f.request,binding:f.binding,batch:f.batch,profile,expectedPlan:plan});for(const change of [x=>{x.allocations[0].initial[0]^=1;},x=>{for(const d of x.definitions)d.source+=' ';},x=>{x.commands.push({kind:'clear',buffer:p.roles[1].index,offset:0,size:32});}]){const bad=structuredClone(plan);change(bad);await assert.rejects(()=>createLiveWorldUploadPreparer({request:f.request,binding:f.binding,batch:f.batch,expectedPlan:bad}));}await assert.rejects(()=>p.prepare({...f.batch}));});
test('upload tokens isolate caller mutation and reject another raw owner',async()=>{
 const f=fixture(),p=await createLiveWorldUploadPreparer({request:f.request,binding:f.binding,batch:f.batch}),token=await p.prepare(f.batch),expected=p.snapshotUploads(token),view=p.snapshotUploads(token);view[0].initial[0]^=1;view[0].index=-1;
 const runtime=p.runtimePlan(token),nonidentity=runtime.allocations[0].initial.slice();assert.throws(()=>{runtime.commands.length=0;});assert.throws(()=>{runtime.definitions[0].source='foreign';});runtime.allocations[0].initial[0]^=1;assert.deepEqual(p.runtimePlan(token).allocations[0].initial,nonidentity);assert.deepEqual(p.diagnosticPlan(token).allocations[0].initial,nonidentity);
 const diagnostic=p.diagnosticPlan(token);diagnostic.commands.length=0;diagnostic.definitions[0].source='foreign';diagnostic.allocations[0].initial[0]^=1;
 assert.deepEqual(p.snapshotUploads(token),expected);assert.ok(p.diagnosticPlan(token).commands.length>1000);const next=await p.prepare(f.batch);assert.deepEqual(p.snapshotUploads(next),expected);assert.throws(()=>p.snapshotUploads({...token}),/Owned/);const foreign=await createLiveWorldUploadPreparer({request:f.request,binding:f.binding,batch:f.batch});await assert.rejects(async()=>foreign.snapshotUploads(token),/Owned/);
 const {prepareRawWorldBinding}=await import('../src/direct-candidate/deterministic-raw-world.mjs'),other=prepareRawWorldBinding(f.request,{absoluteTick:1235,sceneKey:12,requestKey:24}),batch=prepareRawWorldBatch(other,[f.candidate],{maximumSteps:2048});await assert.rejects(()=>p.prepare(batch),/original raw binding/);
 const multi=prepareRawWorldBatch(f.batch.binding,[f.candidate,createCanonicalCandidate(f.request,101,f.candidate.settings)],{maximumSteps:2048});await assert.rejects(()=>p.prepare(multi),/one candidate|One owned|one-candidate/i);
 const clonedRequest=structuredClone(f.request),cloned=await createLiveWorldUploadPreparer({request:clonedRequest,binding:f.binding,batch:f.batch});clonedRequest.epoch++;await assert.rejects(()=>cloned.prepare(f.batch));
});

test('unsealed source cannot authorize upload-only runtime using caller flags',async()=>{await assert.rejects(()=>createExperimentalLiveWorldBatchGPU({}, {preparation:'sealed-uploads',sourceQualified:true,buildSeal:{audited:true}}),/sealed build/);});

test('reported build revision cannot grant or silently cross same-build identity',async()=>{await assert.rejects(()=>createExperimentalLiveWorldBatchGPU({}, {expectedBuildRevision:'caller-asserted'}),/Same-build/);});
