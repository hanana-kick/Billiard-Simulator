import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createCanonicalRequest,createCanonicalCandidate,canonicalResultIdentity} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {createCanonicalApplicationAdapter,createCanonicalApplicationAdapterHarness,canonicalApplicationRules} from '../src/direct-candidate/canonical-application-adapter.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');await R.init();require('../src/math.js');require('../src/physics.js');require('../src/game-rules.js');
const options=()=>({purpose:'manual',requestId:1,candidateId:100,executionProfile:'canonical-local-v1',
  budget:{maximumTicks:2**24,maximumEvents:1024,maximumWorkItems:1000000},
  raw:{absoluteTick:1234,sceneKey:11,requestKey:23,maximumSteps:2048},
  continuation:{durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:128}});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:x=>resolve(x)};};
function fixture({four=false,override=()=>{}}={}){
  const lab=new PhysicsLab(R);let game;
  if(four){const red=lab.addSphere({x:.64,y:.0308,z:.3},'red2','#ff0000');game=new FourBallGame([lab.objects[0].id,lab.objects[1].id],[lab.objects[2].id,red.id]);}
  else game=new ThreeBallGame([lab.objects[0].id,lab.objects[1].id],lab.objects.map(o=>o.id));
  const context={selectedId:lab.objects[0].id,settings:{angle:0,elevation:25,speed:.5,tipX:0,tipY:.2},game:game.snapshot()},calls=[];
  let sequence=0;
  const session={capabilities:{motionRevision:'mmq1',cushionTraceImplemented:false},cancel(){sequence++;},dispose(){sequence++;},
    async runSelected(input){calls.push(input);const epoch=++sequence,request=createCanonicalRequest({...input.request,epoch}),candidate=createCanonicalCandidate(request,input.candidateId,input.settings),identity=canonicalResultIdentity(candidate);
      const state=new Uint32Array(256);state[0]=candidate.candidateId;state[1]=9;state[3]=request.slotToId.length;state[5]=2000;state[41]=input.raw.sceneKey;state[42]=input.raw.requestKey;request.slotToId.forEach((id,i)=>state[64+48*i]=id);
      const receipt={kind:'canonical-session-selected-result-v1',identity,physicsResultComplete:true,captureComplete:true,samplingComplete:false,
        assertCurrent(){if(sequence!==epoch)throw Error('fake session stale');},readFinalState:()=>state.slice(),readCompact:()=>Uint32Array.of(candidate.candidateId,2,1,0),
        sample(tick){const point=new Uint32Array(40);request.slotToId.forEach((id,i)=>point[10*i]=id);return {status:'exact-boundary',tick,interpolation:false,slotToId:request.slotToId,state:point};}};
      await override(receipt,input,state);return receipt;
    }};
  const adapter=createCanonicalApplicationAdapterHarness({lab,readContext:()=>context,session});return {lab,game,context,calls,session,adapter};
}
test('actual complete PhysicsLab snapshots and game semantics reach read-only selected session',async()=>{
  for(const four of[false,true]){const f=fixture({four});try{const before=f.lab.snapshot(),gameBefore=f.game.snapshot();
    for(const name of['step','strike','restore'])f.lab[name]=()=>{throw Error('forbidden lab dynamics '+name);};
    for(const name of['begin','finish','contact'])f.game[name]=()=>{throw Error('forbidden game mutation '+name);};
    const r=await f.adapter.runSelected(options());assert.equal(r.implementation,'injected-test-adapter-v1');
    assert.equal(f.calls[0].request.scene.physical.bodies.length,four?4:3);assert.equal(f.calls[0].request.scene.physical.statics.length,f.lab.statics.length);
    const rules=f.calls[0].request.rules;assert.equal(rules.minCushions,four?0:3);assert.equal(rules.game,four?4:3);assert.equal(rules.conditionOnly,false);assert.equal(rules.allowKiss,true);
    assert.equal(r.scoreAndTurnCommitted,false);assert.equal(r.readOutcome().scoreAndTurnCommitted,false);
    let seen;assert.equal(r.presentAt(2000,x=>seen=x).presented,true);assert.deepEqual(seen.slotToId,f.calls[0].request.scene.slotToId);
    assert.deepEqual(f.lab.snapshot().world,before.world);assert.deepEqual(f.game.snapshot(),gameBefore);
  }finally{f.adapter.dispose();f.lab.dispose();}}
});
test('all live scene, settings, game and clock changes reject stale delivery',async()=>{
  const changes=[f=>f.context.settings.angle++,f=>f.context.game.scores[f.context.selectedId]++,
    f=>f.lab.move(f.context.selectedId,{x:-.7,y:.0308,z:0},{allowOverlap:true}),
    f=>f.lab.objects[0].body.setLinvel({x:.1,y:0,z:0},true),f=>f.lab.steps++];
  for(const change of changes){const gate=deferred(),entered=deferred(),f=fixture({override:async()=>{entered.resolve();await gate.promise;}});try{
    const p=f.adapter.runSelected(options()),rejected=assert.rejects(p,{code:'STALE_APPLICATION_RESULT'});await entered.promise;change(f);gate.resolve();await rejected;
  }finally{f.adapter.dispose();f.lab.dispose();}}
});
test('unsupported scene replacement invalidates old handle without backend fallback',async()=>{
  const f=fixture();try{const result=await f.adapter.runSelected(options());f.lab.setParams({gravity:9});const rejected=await f.adapter.runSelected(options());
    assert.equal(rejected.kind,'canonical-application-rejected-v1');assert.equal(f.calls.length,1);assert.ok(rejected.reasons.some(x=>x.code==='PARAMETER_UNSUPPORTED'));
    assert.throws(()=>result.readOutcome(),{code:'STALE_APPLICATION_RESULT'});assert.equal(rejected.readOutcome,undefined);
  }finally{f.adapter.dispose();f.lab.dispose();}
});
test('exact output remains owned; bounded and unavailable samples are not invented presentation points',async()=>{
  for(const status of['bounded-source-reference','bounded-source-interval','unavailable','unsupported']){
    const f=fixture({override:r=>{r.sample=()=>({status,referenceState:Uint32Array.of(1,2),reason:'explicit'});}});try{const r=await f.adapter.runSelected(options());let called=false;
      assert.equal(r.presentAt(1500,()=>called=true).presented,false);assert.equal(called,false);assert.equal(r.sampleAt(1500).status,status);
      const words=r.readOutcome().packet;words[0]=0;assert.equal(r.readOutcome().packet[0],100);
    }finally{f.adapter.dispose();f.lab.dispose();}}
});
test('foreign identity, incomplete roster, fake exact point and fake REST are rejected',async()=>{
  for(const override of[r=>{r.identity={...r.identity,sceneId:'foreign'};},(r,i,state)=>state[64]++,r=>{r.physicsResultComplete=false;}]){
    const f=fixture({override});try{await assert.rejects(f.adapter.runSelected(options()),e=>['APPLICATION_IDENTITY_MISMATCH','APPLICATION_BACKEND_CONTRACT'].includes(e.code));}finally{f.adapter.dispose();f.lab.dispose();}}
  const f=fixture({override:r=>{r.sample=tick=>({status:'exact-boundary',tick,interpolation:true,slotToId:[1],state:new Uint32Array(40)});}});try{const r=await f.adapter.runSelected(options());assert.throws(()=>r.sampleAt(2000),{code:'APPLICATION_BACKEND_CONTRACT'});}finally{f.adapter.dispose();f.lab.dispose();}
});
test('no search loop, pending game shot, or altered whole-game roster is silently admitted',async()=>{
  const f=fixture();try{assert.throws(()=>f.adapter.runSearch(),{code:'APPLICATION_SEARCH_UNIMPLEMENTED'});assert.equal(f.calls.length,0);
    f.context.game.pending={cueId:1};await assert.rejects(f.adapter.runSelected(options()),{code:'GAME_NOT_READY'});
    f.context.game.pending=null;f.context.game.objectIds=[1,2,999];await assert.rejects(f.adapter.runSelected(options()),{code:'GAME_ROSTER_MISMATCH'});
    assert.equal(f.calls.length,0);assert.throws(()=>createCanonicalApplicationAdapter({lab:f.lab,readContext:()=>f.context}),/WebGPU device/);
  }finally{f.adapter.dispose();f.lab.dispose();}
});
test('cancel/dispose and changes inside presentation invalidate handles without game commit',async()=>{
  const f=fixture();try{let r=await f.adapter.runSelected(options());assert.throws(()=>r.presentAt(2000,()=>f.context.settings.angle++),{code:'STALE_APPLICATION_RESULT'});
    r=await f.adapter.runSelected(options());f.adapter.cancel();assert.throws(r.assertCurrent,{code:'STALE_APPLICATION_RESULT'});
    r=await f.adapter.runSelected(options());f.adapter.dispose();assert.throws(r.assertCurrent,{code:'APPLICATION_DISPOSED'});
  }finally{f.lab.dispose();}
});
test('three/four target and optional three-cushion rules reflect actual game snapshot',()=>{
  assert.equal(canonicalApplicationRules(new ThreeBallGame().snapshot(),2,[1,2,3]).opponentId,null);
  const g=new FourBallGame([1,2],[3,4],{threeCushion:true});const r=canonicalApplicationRules(g.snapshot(),2,[1,2,3,4]);assert.equal(r.opponentId,1);assert.equal(r.minCushions,3);
});

test('backend mutation cannot rewrite the private submitted identity',async()=>{
  const f=fixture({override:(r,input)=>{input.settings.speed=4;const request=createCanonicalRequest({...input.request,epoch:r.identity.epoch});r.identity=canonicalResultIdentity(createCanonicalCandidate(request,input.candidateId,input.settings));}});
  try{await assert.rejects(f.adapter.runSelected(options()),{code:'APPLICATION_IDENTITY_MISMATCH'});assert.equal(f.context.settings.speed,.5);}finally{f.adapter.dispose();f.lab.dispose();}
});

test('external abort and supersession reject late results without presentation',async()=>{
  for(const supersede of[false,true]){const gate=deferred(),entered=deferred();let first=true;const f=fixture({override:async()=>{if(first){first=false;entered.resolve();await gate.promise;}}});
    try{const signal=new AbortController(),p=f.adapter.runSelected({...options(),signal:signal.signal}),rejected=assert.rejects(p,{code:supersede?'STALE_APPLICATION_RESULT':'CANCELLED'});await entered.promise;
      if(supersede){const fresh=await f.adapter.runSelected({...options(),purpose:'forecast'});assert.equal(fresh.purpose,'forecast');}else signal.abort();gate.resolve();await rejected;
    }finally{f.adapter.dispose();f.lab.dispose();}
  }
});
test('pending result cannot score or render an incomplete capture; unsupported raw cannot be evaluated',async()=>{
  let backendResult;
  const f=fixture({override:(r,input,state)=>{backendResult=r;state[1]=7;r.physicsResultComplete=false;r.captureComplete=false;r.readCompact=()=>Uint32Array.of(input.candidateId,2,1,0);}});
  try{const r=await f.adapter.runSelected(options());backendResult.physicsResultComplete=true;backendResult.captureComplete=true;
    assert.equal(r.readOutcome().scoringEligible,false);assert.equal(r.presentAt(2000,()=>assert.fail('must not present incomplete capture')).presented,false);}finally{f.adapter.dispose();f.lab.dispose();}
  const g=fixture();try{g.context.settings.speed=5;await assert.rejects(g.adapter.runSelected(options()),{code:'APPLICATION_BACKEND_CONTRACT'});}finally{g.adapter.dispose();g.lab.dispose();}
});

test('guarded source context is an owned copy of the exact original request game and aim',async()=>{
  const f=fixture();try{const r=await f.adapter.runSelected(options()),context=r.readSourceContext();
    assert.deepEqual(context,f.context);context.game.scores[context.selectedId]=999;context.settings.angle=90;
    assert.deepEqual(r.readSourceContext(),f.context);f.context.game.scores[f.context.selectedId]++;
    assert.throws(()=>r.readSourceContext(),{code:'STALE_APPLICATION_RESULT'});
  }finally{f.adapter.dispose();f.lab.dispose();}
});
