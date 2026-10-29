import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/canonical-selected-source.mjs';
import {createCanonicalSessionService, createCanonicalSessionLifecycleHarness} from '../src/direct-candidate/canonical-session-service.mjs';
const base = fixture();
function input(extra = {}) {
  const {scene, requestId, selectedId, purpose, rules, budget, profileId} = base.request;
  return {request: {scene, requestId, selectedId, purpose, rules, budget, executionProfile: profileId},
    candidateId: 100, settings: {...base.candidate.settings},
    raw: {absoluteTick: 1234, sceneKey: 11, requestKey: 23, maximumSteps: 2048},
    continuation: {durationTicks: 65535, budgets: [2000,2000,20000,20000,20000,20000,20000], maxWorldSteps: 128}, ...extra};
}
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
function runtime(overrides = {}) {
  const calls = [];
  const api = {
    async createEngine(device, binding, options) {
      calls.push(['compile', binding, options]);
      return {async runRaw(batch, options) {
        calls.push(['run', batch, options]);
        const state = new Uint32Array(256); state[0]=100;state[1]=9;state[3]=4;state[5]=2000;state[41]=11;state[42]=23;
        base.request.slotToId.forEach((id,i)=>state[64+48*i]=id);
        const status = new Uint32Array(16);status[0]=100;status[1]=1;status[8]=11;status[9]=23;
        return {rawHandoffStatus:status,continuation:{state,nominalRest:true,timeBudgetEnforced:true,
          compactResult:Uint32Array.of(100,1,0,1),selectedTraceGPU:{test:true}}};
      }};
    },
    async hydrate(args) { calls.push(['hydrate',args]);return {physicsResultComplete:true,captureComplete:true,samplingComplete:false,sourceRecordCount:2,trace:{test:true}}; },
    sample(trace,tick) { return {status:'unavailable',reason:'EVENT_BRACKET',tick}; },
    ...overrides,
  };
  return {api,calls};
}
test('selected lifecycle uses owned inputs, original clock, trace-only hydration, separate completion flags',async()=>{
  const {api,calls}=runtime(),s=createCanonicalSessionLifecycleHarness(api),x=input();
  const pending=s.runSelected(x);x.settings.speed=4;x.continuation.budgets[0]=1;
  const r=await pending;
  assert.equal(r.implementation,'injected-test');assert.equal(r.physicsResultComplete,true);assert.equal(r.captureComplete,true);assert.equal(r.samplingComplete,false);
  assert.equal(r.cumulativeWorkBudgetEnforced,false);assert.equal(r.cumulativeEventBudgetEnforced,false);
  assert.equal(calls[0][1].localOptions.budgets[0],2000);assert.equal(calls[0][1].shotClock.startingTick,1234);
  assert.equal(calls[0][2].request.requestKey,calls[2][1].request.requestKey);assert.equal(calls[0][2].candidate.candidateKey,calls[2][1].candidate.candidateKey);assert.equal(calls[0][2].candidate.settings.speed,.5);assert.equal(calls[2][1].candidate.settings.speed,.5);assert.equal(calls[1][2].selectedTrace,true);
  const words=r.readCompact();words[3]=0;assert.equal(r.readCompact()[3],1);
  assert.deepEqual(r.sample(1500),{status:'unavailable',reason:'EVENT_BRACKET',tick:1500});
  s.cancel();assert.throws(()=>r.readCompact(),{code:'CANCELLED'});assert.throws(()=>r.sample(1500),{code:'CANCELLED'});
});
for(const phase of ['compile','run','hydrate'])test('superseded '+phase+' output cannot be returned or presented',async()=>{
  const d=deferred(),standard=runtime(),api={...standard.api};let entered=false;
  if(phase==='compile')api.createEngine=async(...a)=>{const e=await standard.api.createEngine(...a);if(!entered){entered=true;await d.promise;}return e;};
  if(phase==='run')api.createEngine=async(...a)=>{const e=await standard.api.createEngine(...a);return {async runRaw(...b){const r=await e.runRaw(...b);if(!entered){entered=true;await d.promise;}return r;}};};
  if(phase==='hydrate')api.hydrate=async(...a)=>{const r=await standard.api.hydrate(...a);if(!entered){entered=true;await d.promise;}return r;};
  const s=createCanonicalSessionLifecycleHarness(api),old=s.runSelected(input());
  while(!entered)await new Promise(resolve=>setImmediate(resolve));
  const rejected=assert.rejects(old,{code:'STALE_EPOCH'}),freshPending=s.runSelected(input());d.resolve();await rejected;const fresh=await freshPending;
  assert.equal(fresh.readCompact()[3],1);
});
test('external cancellation during compile aborts before submission and after completion guards receipts',async()=>{
  const d=deferred(),{api,calls}=runtime(),original=api.createEngine;api.createEngine=async(...args)=>{const e=await original(...args);await d.promise;return e;};
  const s=createCanonicalSessionLifecycleHarness(api),controller=new AbortController(),p=s.runSelected(input({signal:controller.signal}));controller.abort();d.resolve();await assert.rejects(p,{code:'CANCELLED'});assert.equal(calls.some(x=>x[0]==='run'),false);
  const standard=runtime(),s2=createCanonicalSessionLifecycleHarness(standard.api),c2=new AbortController(),r=await s2.runSelected(input({signal:c2.signal}));c2.abort();assert.throws(()=>r.readFinalState(),{code:'CANCELLED'});
});
test('unsupported raw settings return no score and do not compile, unsupported profile is explicit',async()=>{
  const {api,calls}=runtime(),s=createCanonicalSessionLifecycleHarness(api),r=await s.runSelected(input({settings:{...base.candidate.settings,speed:5}}));
  assert.equal(r.kind,'canonical-session-unsupported-v1');assert.equal(r.physicsResultComplete,false);assert.equal(calls.length,0);assert.equal(r.readCompact,undefined);
  const x=input();x.continuation.enableCushionContinuation=true;await assert.rejects(s.runSelected(x),{code:'UNSUPPORTED_SESSION_PROFILE'});
  const y=input();y.request.rules={...y.request.rules,allowKiss:false};await assert.rejects(s.runSelected(y),{code:'UNSUPPORTED_SESSION_RULES'});
});
test('wrong producer identity, fake rest and trace completion disagreement are rejected',async()=>{
  for(const change of [r=>r.continuation.state[42]++,r=>r.continuation.nominalRest=false,r=>r.rawHandoffStatus[0]++]){
    const {api}=runtime(),original=api.createEngine;api.createEngine=async(...a)=>{const e=await original(...a);return {async runRaw(...b){const r=await e.runRaw(...b);change(r);return r;}};};
    await assert.rejects(createCanonicalSessionLifecycleHarness(api).runSelected(input()),{code:'BACKEND_IDENTITY_MISMATCH'});
  }
  const {api}=runtime({hydrate:async()=>({physicsResultComplete:false})});await assert.rejects(createCanonicalSessionLifecycleHarness(api).runSelected(input()),{code:'TRACE_RESULT_MISMATCH'});
});
test('raw failure has no gameplay score or hydration; dispose invalidates handles',async()=>{
  const {api,calls}=runtime(),original=api.createEngine;api.createEngine=async(...a)=>{const e=await original(...a);return {async runRaw(...b){const r=await e.runRaw(...b);r.rawHandoffStatus[1]=5;r.continuation=null;return r;}};};
  const s=createCanonicalSessionLifecycleHarness(api),r=await s.runSelected(input());assert.equal(r.kind,'canonical-session-raw-incomplete-v1');assert.equal(r.readRawStatus()[1],5);assert.equal(calls.some(x=>x[0]==='hydrate'),false);assert.equal(r.readCompact,undefined);s.dispose();assert.throws(r.assertCurrent,{code:'SESSION_DISPOSED'});await assert.rejects(s.runSelected(input()),{code:'SESSION_DISPOSED'});
});
test('real adapter requires a GPU device and makes no hardware or batch claim',()=>{
  assert.throws(()=>createCanonicalSessionService(),/WebGPU device/);
  const s=createCanonicalSessionService({device:{queue:{},createComputePipelineAsync(){}}});assert.equal(s.capabilities.implementation,'webgpu-selected-v1');assert.equal(s.capabilities.productionEnabled,false);assert.equal(s.capabilities.searchBatchImplemented,false);assert.equal(s.capabilities.physicalHardwareVerified,false);
});
test('rapid replacement serializes heavy lifetimes and skips cancelled queued work',async()=>{
  const blocked=deferred(),firstEntered=deferred(),{api,calls}=runtime(),original=api.createEngine;let compiling=0,maximum=0,first=true;
  api.createEngine=async(...args)=>{compiling++;maximum=Math.max(maximum,compiling);try{if(first){first=false;firstEntered.resolve();await blocked.promise;}return await original(...args);}finally{compiling--;}};
  const s=createCanonicalSessionLifecycleHarness(api),a=s.runSelected(input()),aReject=assert.rejects(a,{code:'STALE_EPOCH'});await firstEntered.promise;
  const b=s.runSelected(input()),bReject=assert.rejects(b,{code:'STALE_EPOCH'}),c=s.runSelected(input());blocked.resolve();await aReject;await bReject;const result=await c;
  assert.equal(maximum,1);assert.equal(calls.filter(x=>x[0]==='compile').length,2);assert.equal(calls.filter(x=>x[0]==='run').length,1);assert.equal(result.readCompact()[3],1);
});

test('unsupported replacement invalidates a previously accepted result',async()=>{
  const {api}=runtime(),s=createCanonicalSessionLifecycleHarness(api),r=await s.runSelected(input());
  const replacement=input();replacement.continuation.enableCushionContinuation=true;
  await assert.rejects(s.runSelected(replacement),{code:'UNSUPPORTED_SESSION_PROFILE'});
  assert.throws(()=>r.readCompact(),{code:'STALE_EPOCH'});
});

const v2Options = {selectedWorldProfile:'mmq2-cushion'};
function v2Runtime(change = x => x) {
  const r = runtime(), hydrate = r.api.hydrate;
  r.api.hydrate = async args => change({...await hydrate(args), entryKind:'canonical-raw-shot',
    preparedBinding:null,callerLabelIdentityVerified:true,rawStrikeSourceCaptured:true,backend:'webgpu',gpuProduced:true});
  return r;
}
test('MMQ2 is factory-only opt-in, freezes receipt identity and preserves exact-only sampling',async()=>{
  const {api,calls}=v2Runtime(),options={...v2Options},s=createCanonicalSessionLifecycleHarness(api,options);options.selectedWorldProfile='mmq1-ball-ball';
  const r=await s.runSelected(input());
  assert.equal(s.selectedWorldProfile,'mmq2-cushion');assert.equal(s.capabilities.motionRevision,'mmq2');assert.equal(s.capabilities.cushionTraceImplemented,true);
  assert.equal(calls[0][1].localOptions.mixedMotionRevision,'mmq2');assert.equal(calls[0][1].localOptions.enableCushionContinuation,true);
  assert.equal(r.identity.selectedWorldProfile,'mmq2-cushion');assert.equal(r.selectedWorldProfile,'mmq2-cushion');assert.equal(Object.isFrozen(r.identity),true);
  assert.equal(r.samplingComplete,false);assert.equal(r.sample(1500).status,'unavailable');
  const next=input();next.continuation.mixedMotionRevision='mmq1';await assert.rejects(s.runSelected(next),{code:'UNSUPPORTED_SESSION_PROFILE'});assert.throws(r.assertCurrent,{code:'STALE_EPOCH'});
  const fresh=await s.runSelected(input());s.cancel();assert.throws(fresh.assertCurrent,{code:'CANCELLED'});
});
test('MMQ2 rejects host-prepared or missing raw GPU provenance',async()=>{
  for(const change of [x=>({...x,entryKind:'host-prepared-world'}),x=>({...x,preparedBinding:{}}),x=>({...x,callerLabelIdentityVerified:false}),x=>({...x,backend:'cpu'}),x=>({...x,gpuProduced:false})]){
    const {api}=v2Runtime(change);await assert.rejects(createCanonicalSessionLifecycleHarness(api,v2Options).runSelected(input()),{code:'TRACE_PROVENANCE_MISMATCH'});
  }
});
test('MMQ2 profile negatives fail before compilation and unsupported candidates remain unscored',async()=>{
  const {api,calls}=v2Runtime(),s=createCanonicalSessionLifecycleHarness(api,v2Options);
  assert.throws(()=>createCanonicalSessionLifecycleHarness(api,{selectedWorldProfile:'mmq3'}),{code:'UNSUPPORTED_SESSION_PROFILE'});
  for(const continuation of [{mixedMotionRevision:'mmq1'},{enableCushionContinuation:false}])await assert.rejects(s.runSelected(input({continuation})),{code:'UNSUPPORTED_SESSION_PROFILE'});
  const x=input();x.request.selectedWorldProfile='mmq2-cushion';await assert.rejects(s.runSelected(x),{code:'UNSUPPORTED_SESSION_PROFILE'});
  const r=await s.runSelected(input({settings:{...base.candidate.settings,speed:5}}));assert.equal(r.kind,'canonical-session-unsupported-v1');assert.equal(r.identity.selectedWorldProfile,'mmq2-cushion');assert.equal(r.readCompact,undefined);assert.equal(calls.length,0);
});

test('MMQ2 missing source capture stays incomplete without changing the physics result',async()=>{
  const {api}=v2Runtime(x=>({...x,rawStrikeSourceCaptured:false,captureComplete:false,sourceRecordCount:0}));
  const r=await createCanonicalSessionLifecycleHarness(api,v2Options).runSelected(input());
  assert.equal(r.physicsResultComplete,true);assert.equal(r.captureComplete,false);assert.equal(r.samplingComplete,false);
});

test('session disposal waits for active engine view cleanup and suppresses late selected receipts',async()=>{
 const d=deferred(),entered=deferred(),standard=runtime();
 const api={...standard.api,async createEngine(...args){const e=await standard.api.createEngine(...args);return {...e,async dispose(){entered.resolve();await d.promise;}};}};
 const service=createCanonicalSessionLifecycleHarness(api),run=service.runSelected(input());await entered.promise;
 const rejected=assert.rejects(run,{code:'SESSION_DISPOSED'});let drained=false;const disposal=service.dispose().then(()=>{drained=true;});await Promise.resolve();assert.equal(drained,false);d.resolve();await rejected;await disposal;assert.equal(drained,true);
});
