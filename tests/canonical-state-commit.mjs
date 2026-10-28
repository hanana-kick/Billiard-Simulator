import test from 'node:test';
import assert from 'node:assert/strict';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {createCanonicalSessionLifecycleHarness} from '../src/direct-candidate/canonical-session-service.mjs';
import {createCanonicalStateApplicationAdapterHarness} from '../src/direct-candidate/canonical-application-adapter.mjs';
import {createCanonicalStateStore} from '../src/direct-candidate/canonical-state-store.mjs';
import {PREPARED_WORLD_VERSION} from '../src/direct-candidate/deterministic-prepared-world.mjs';
import {createCanonicalRequest,createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch,snapshotRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
const Q=2**24;
function setup({mutate=()=>{},hydrateChange=x=>x,receiptChange=x=>x,profile='mmq2-cushion'}={}) {
  const f=mmq2RawFixture(),store=createCanonicalStateStore({scene:f.request.scene,selectedWorldProfile:profile});
  const context={selectedId:f.request.selectedId,settings:{...f.candidate.settings},game:{kind:'four',cueIds:[50,19],redIds:[8,300],threeCushion:false,pending:null}};
  let receipt,submitted;
  const session=createCanonicalSessionLifecycleHarness({
    async createEngine(){return {async runRaw(){
      const state=new Uint32Array(256),signed=new Int32Array(state.buffer),scene=store.readScene();
      state.set([100,9,0,4,0,2000,0xffffffff,0,1234,PREPARED_WORLD_VERSION]);state[41]=11;state[42]=23;state[43]=1;state[44]=f.request.cueSlot;
      scene.physical.bodies.forEach((body,i)=>{const a=64+48*i;state[a]=body.id;state[a+22]=Math.round(.03075*Q);state[a+23]=Math.round(.21*Q);signed.set([body.pos.x,body.pos.y,body.pos.z].map(x=>Math.round(x*Q)),a+24);});
      signed[88]=Q+1;mutate(state);
      const status=new Uint32Array(16);status[0]=100;status[1]=1;status[8]=11;status[9]=23;
      return {rawHandoffStatus:status,continuation:{state,nominalRest:state[1]===9,compactResult:Uint32Array.of(100,2,1,0)}};
    }};},
    async hydrate({request,candidate,result}){submitted={request,candidate};return hydrateChange({physicsResultComplete:result.nominalRest,captureComplete:false,samplingComplete:false,sourceRecordCount:0,trace:{},entryKind:'canonical-raw-shot',preparedBinding:null,callerLabelIdentityVerified:true,backend:'webgpu',gpuProduced:true});},
    sample(){return {status:'unavailable'};},
  },{selectedWorldProfile:profile});
  const original=session.runSelected;
  const wrapped={...session,async runSelected(x){receipt=receiptChange(await original(x));return receipt;}};
  const adapter=createCanonicalStateApplicationAdapterHarness({stateStore:store,selectedWorldProfile:profile,readContext:()=>context,session:wrapped});
  const options={purpose:'manual',requestId:17,candidateId:100,executionProfile:'canonical-local-v1',budget:f.request.budget,raw:{absoluteTick:1234,sceneKey:11,requestKey:23,maximumSteps:2048},continuation:{durationTicks:8192,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:128}};
  return {store,context,session,adapter,options,get receipt(){return receipt;},get submitted(){return submitted;}};
}
test('real session lifecycle exposes exact immutable submission; manual commit preserves next-source packed words',async()=>{
  const f=setup(),before=f.store.readRevision(),result=await f.adapter.runSelected(f.options),submission=f.receipt.readSubmission();
  assert.equal(f.store.readRevision(),before);assert.equal(submission.request,f.submitted.request);assert.equal(submission.candidate,f.submitted.candidate);
  assert.ok(Object.isFrozen(submission.raw));assert.ok(Object.isFrozen(submission.candidate.settings));
  assert.throws(()=>submission.raw.sceneKey=99,TypeError);f.options.raw.sceneKey=99;assert.equal(submission.raw.sceneKey,11);
  const words=result.readFinalState(),committed=result.commitState();assert.equal(committed.scoreAndTurnCommitted,false);assert.equal(committed.sourceRevision,before);assert.equal(committed.revision,before+2);
  assert.deepEqual(f.store.readFinalState(),words);assert.equal(f.store.readScene().physical.bodies[0].pos.x,(Q+1)/Q);
  committed.identity.sceneId='altered';committed.provenance.identity.sceneId='altered';assert.notEqual(f.store.readProvenance().identity.sceneId,'altered');
  assert.throws(result.commitState,{code:'STALE_APPLICATION_RESULT'});
  const request=createCanonicalRequest({...submission.request,scene:f.store.readScene(),epoch:100,requestId:18,executionProfile:'canonical-local-v1'});
  const binding=prepareRawWorldBinding(request,submission.raw),packed=snapshotRawWorldBatch(prepareRawWorldBatch(binding,[createCanonicalCandidate(request,101,submission.candidate.settings)]));
  for(let i=0;i<4;i++)assert.deepEqual(packed.template.slice(36+40*i,39+40*i),words.slice(88+48*i,91+48*i));
});
for(const change of [f=>f.store.restore(f.store.snapshot()),f=>f.store.cancel(),f=>f.adapter.cancel(),f=>f.session.cancel(),f=>f.context.settings.angle++,f=>f.context.game.threeCushion=true])test('stale result cannot begin or commit: '+change,async()=>{
  const f=setup(),r=await f.adapter.runSelected(f.options);change(f);const revision=f.store.readRevision();assert.throws(r.commitState);assert.equal(f.store.readRevision(),revision);assert.equal(f.store.readFinalState(),null);
});
test('forecast and search remain read-only; abort and unsupported replacement prohibit manual commit',async()=>{
  const f=setup(),forecast=await f.adapter.runSelected({...f.options,purpose:'forecast'});assert.equal(forecast.commitState,undefined);assert.throws(f.adapter.runSearch,{code:'APPLICATION_SEARCH_UNIMPLEMENTED'});
  const controller=new AbortController(),r=await f.adapter.runSelected({...f.options,signal:controller.signal});controller.abort();assert.throws(r.commitState,{code:'CANCELLED'});
  const old=await f.adapter.runSelected(f.options);f.context.settings.speed=5;const unsupported=await f.adapter.runSelected(f.options);assert.equal(unsupported.commitState,undefined);assert.throws(old.commitState);assert.equal(f.store.readRevision(),0);
});
test('atomic store validation rejects corrupt REST; session rejects prepared provenance',async()=>{
  const f=setup({mutate:s=>s[91]=1}),r=await f.adapter.runSelected(f.options);assert.throws(r.commitState,{code:'STATE_FINAL_REJECTED'});assert.equal(f.store.readFinalState(),null);
  const prepared=setup({hydrateChange:x=>({...x,entryKind:'host-prepared-world'})});await assert.rejects(prepared.adapter.runSelected(prepared.options),{code:'TRACE_PROVENANCE_MISMATCH'});assert.equal(prepared.store.readRevision(),0);
});

test('foreign submission/raw settings and reentrant receipt cancellation cannot commit',async()=>{
  for(const change of [s=>({...s,raw:{...s.raw,sceneKey:99}}),s=>({...s,request:{...s.request,epoch:s.request.epoch+1}}),s=>({...s,candidate:{...s.candidate,candidateId:99}})]){
    const f=setup({receiptChange:r=>({...r,readSubmission:()=>change(r.readSubmission())})}),result=await f.adapter.runSelected(f.options);
    assert.throws(result.commitState,{code:'APPLICATION_IDENTITY_MISMATCH'});assert.equal(f.store.readRevision(),0);
  }
  let cancelDuringRead=false,f;
  f=setup({receiptChange:r=>({...r,readFinalState(){if(cancelDuringRead)f.store.restore(f.store.snapshot());return r.readFinalState();}})});
  const result=await f.adapter.runSelected(f.options);cancelDuringRead=true;
  assert.throws(result.commitState,{code:'STALE_APPLICATION_RESULT'});assert.equal(f.store.readFinalState(),null);
});
test('committed metadata and snapshot survive session cancellation without retaining result authority',async()=>{
  const f=setup(),result=await f.adapter.runSelected(f.options),words=result.readFinalState(),metadata=result.commitState();
  f.adapter.cancel();assert.deepEqual(f.store.readFinalState(),words);assert.equal(metadata.provenance.absoluteTick,words[5]);
  f.store.restore(metadata.snapshot);assert.deepEqual(f.store.readFinalState(),words);assert.throws(result.commitState);
});

test('MMQ1 manual commit remains supported with its unextended identity',async()=>{
  const f=setup({profile:'mmq1-ball-ball'}),result=await f.adapter.runSelected(f.options),metadata=result.commitState();
  assert.equal(metadata.identity.selectedWorldProfile,undefined);assert.equal(metadata.provenance.selectedWorldProfile,'mmq1-ball-ball');
});
test('incomplete physics and legacy read-only receipts cannot explicitly commit',async()=>{
  const bounded=setup({mutate:s=>s[1]=7}),r=await bounded.adapter.runSelected(bounded.options);
  assert.equal(r.physicsResultComplete,false);assert.throws(r.commitState,{code:'APPLICATION_COMMIT_INCOMPLETE'});assert.equal(bounded.store.readRevision(),0);
  const legacy=setup({receiptChange:r=>{const {readSubmission,...rest}=r;return rest;}}),old=await legacy.adapter.runSelected(legacy.options);
  assert.equal(old.readFinalState().length,256);old.assertCurrent();assert.throws(old.commitState,{code:'APPLICATION_BACKEND_CONTRACT'});assert.equal(legacy.store.readRevision(),0);
});
