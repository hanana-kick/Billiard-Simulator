import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {encodeCanonicalScene,createCanonicalRequest,createCanonicalCandidate,canonicalResultIdentity} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {createCanonicalStateStore} from '../src/direct-candidate/canonical-state-store.mjs';
import {PREPARED_WORLD_VERSION} from '../src/direct-candidate/deterministic-prepared-world.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');await R.init();require('../src/math.js');require('../src/physics.js');
const Q=2**24, radius=Math.round(.03075*Q),mass=Math.round(.210*Q);
const lab=new PhysicsLab(R),base=lab.snapshot();lab.dispose();
// Actual PhysicsLab full geometry/material snapshot; explicitly injected resting
// canonical positions, NOT an application activation/snap or a physics outcome.
function sceneForTest(four=false){const s=structuredClone(base);s.objects.forEach(o=>{o.pos.y=radius/Q;o.v={x:0,y:0,z:0};o.w={x:0,y:0,z:0};});
  if(four)s.objects.push({...structuredClone(s.objects[2]),id:4,pos:{x:.5,y:radius/Q,z:.4}});
  const admission=encodeCanonicalScene(s,{objectIds:s.objects.map(o=>o.id),staticCount:s.statics.length});assert.equal(admission.admitted,true);return admission.scene;}
const makeStore=(four=false,profile='mmq1-ball-ball')=>createCanonicalStateStore({scene:sceneForTest(four),selectedWorldProfile:profile});
function submission(store,{profile='mmq1-ball-ball',epoch=1,offset=1}={}){
  const scene=store.readScene(),ids=scene.slotToId,request=createCanonicalRequest({scene,epoch,requestId:epoch,selectedId:ids[0],purpose:'manual',
    executionProfile:'canonical-local-v1',budget:{maximumTicks:2**24,maximumEvents:1024,maximumWorkItems:1000000},
    rules:{game:ids.length,firstId:ids[1],secondId:ids[2],opponentId:ids.length===4?ids[3]:null,threeCushion:false,search:false,method:'carom',minCushions:0,allowKiss:true,kissFacts:false,conditionOnly:false}}),
    candidate=createCanonicalCandidate(request,100+epoch,{angle:0,elevation:25,speed:.5,tipX:0,tipY:.2}),raw={absoluteTick:store.readClock()??1234,sceneKey:11,requestKey:23};
  const words=new Uint32Array(256),signed=new Int32Array(words.buffer);words.set([candidate.candidateId,9,0,ids.length,0,2000,0xffffffff,0,1234,PREPARED_WORLD_VERSION]);
  words[41]=11;words[42]=23;words[43]=1;words[44]=request.cueSlot;
  scene.physical.bodies.forEach((o,i)=>{const a=64+48*i;words[a]=o.id;words[a+22]=radius;words[a+23]=mass;signed.set([Math.round(o.pos.x*Q),radius,Math.round(o.pos.z*Q)],a+24);});signed[88]=Q+offset;
  let fresh=true;const receipt={kind:'canonical-session-selected-result-v1',selectedWorldProfile:profile,
    identity:profile==='mmq2-cushion'?{...canonicalResultIdentity(candidate),selectedWorldProfile:profile}:canonicalResultIdentity(candidate),
    physicsResultComplete:true,captureComplete:false,samplingComplete:false,
    assertCurrent(){if(!fresh)throw Error('injected session stale');},readFinalState(){return words.slice();}};
  return {request,candidate,raw,words,receipt,stale(){fresh=false;},begin(){return store.begin({request,candidate,raw});}};
}
test('pinned Rapier presentation and native snapshot demonstrably lose one Q24 bit',()=>{
  const l=new PhysicsLab(R);try{const o=l.objects[0],x=(Q+1)/Q;o.body.setTranslation({...o.body.translation(),x},true);
    assert.equal(R.version(),'0.21.0');assert.equal(o.body.translation().x,1);assert.equal(Math.round(l.snapshot().objects[0].pos.x*Q),Q);assert.notEqual(Q,Q+1);
  }finally{l.dispose();}
});
test('actual settled/legacy placement heights are not silently admitted as exact raw support',()=>{
  const l=new PhysicsLab(R);try{for(const placement of[false,true]){if(placement)l.move(l.objects[0].id,{x:-.66,y:.02,z:.1},{allowOverlap:true});
    const snap=l.snapshot(),scene=encodeCanonicalScene(snap,{objectIds:l.objects.map(o=>o.id),staticCount:l.statics.length}).scene;
    assert.notEqual(Math.round(snap.objects[0].pos.y*Q),radius);
    const store=createCanonicalStateStore({scene,selectedWorldProfile:'mmq1-ball-ball'}),s=submission(store);
    assert.throws(()=>s.begin());assert.equal(store.readScene().sceneId,scene.sceneId);assert.equal(store.readFinalState(),null);
  }}finally{l.dispose();}
});
test('exact odd positive/negative Q24 final positions survive next-shot scenes and two-shot undo/redo',()=>{
  for(const four of[false,true])for(const profile of['mmq1-ball-ball','mmq2-cushion']){
    const store=makeStore(four,profile),initial=store.snapshot(),one=submission(store,{profile}),first=one.begin().commit(one.receipt);
    assert.equal(store.readFinalState()[88],Q+1);assert.equal(store.readScene().physical.bodies[0].pos.x,(Q+1)/Q);
    assert.equal(store.readScene().physical.bodies[0].radius,.03075);assert.equal(store.readScene().physical.bodies[0].mass,.210);
    assert.deepEqual(store.readScene().physical.statics,sceneForTest(four).physical.statics);
    const two=submission(store,{profile,epoch:2});two.words[88]=(-Q-3)>>>0;const second=two.begin().commit(two.receipt);
    assert.equal(store.readScene().physical.bodies[0].pos.x,(-Q-3)/Q);
    one.stale();two.stale();store.restore(first);assert.equal(store.readFinalState()[88],Q+1);
    const pending=submission(store,{profile,epoch:3}).begin();store.restore(second);assert.throws(pending.assertCurrent,{code:'STALE_STATE_COMMIT'});
    assert.equal(store.readFinalState()[88],(-Q-3)>>>0);store.restore(initial);assert.equal(store.readFinalState(),null);
  }
});
test('committed words and snapshots own copies; altered render world is not consulted',()=>{
  const store=makeStore(),s=submission(store),transaction=s.begin();const saved=transaction.commit(s.receipt);s.words.fill(0);
  const read=store.readFinalState();read.fill(0);const provenance=store.readProvenance();provenance.identity.sceneId='foreign';
  assert.equal(store.readFinalState()[88],Q+1);assert.notEqual(store.readProvenance().identity.sceneId,'foreign');
  assert.throws(()=>transaction.commit(s.receipt),{code:'STALE_STATE_COMMIT'});
  assert.throws(()=>makeStore().restore(saved),{code:'STATE_SNAPSHOT_OWNER'});assert.throws(()=>store.restore(structuredClone(saved)),{code:'STATE_SNAPSHOT_OWNER'});
});
test('foreign profiles/identities, incomplete REST, corrupt materials and rosters reject atomically',()=>{
  const mutations=[s=>s.receipt.identity={...s.receipt.identity,sceneId:'foreign'},s=>s.receipt.selectedWorldProfile='mmq2-cushion',
    s=>s.receipt.physicsResultComplete=false,s=>s.words[1]=7,s=>s.words[2]=46,s=>s.words[3]--,s=>s.words[6]=0,s=>s.words[7]=1,
    s=>s.words[9]=0,s=>s.words[41]++,s=>s.words[42]++,s=>s.words[43]=2,s=>s.words[44]++,s=>s.words[5]=1233,s=>s.words[5]=0x7fffffff,
    s=>s.words[64]++,s=>s.words[86]++,s=>s.words[87]++,s=>s.words[89]++,s=>s.words[88]=4*Q+1,
    s=>s.words[91]=1,s=>s.words[96]=1,s=>s.words[104]=3,s=>s.words[208]=99,
    s=>s.receipt.readFinalState=()=>new Uint32Array(257),s=>s.receipt.readFinalState=()=>new Uint32Array(new SharedArrayBuffer(1024))];
  for(const mutate of mutations){const store=makeStore(),s=submission(store),tx=s.begin(),old=store.readScene();mutate(s);assert.throws(()=>tx.commit(s.receipt));assert.equal(store.readScene(),old);assert.equal(store.readFinalState(),null);}
});
test('guards run after receipt reads and before atomic replacement; begin/restore/cancel/dispose defeat ABA',()=>{
  for(const duringRead of[false,true]){const store=makeStore(),s=submission(store),tx=s.begin();if(duringRead)s.receipt.readFinalState=()=>{s.stale();return s.words;};else s.stale();
    assert.throws(()=>tx.commit(s.receipt),/injected session stale/);assert.equal(store.readFinalState(),null);}
  for(const change of[(store,s)=>store.cancel(),(store,s)=>store.restore(store.snapshot()),(store,s)=>s.begin(),store=>store.dispose()]){
    const store=makeStore(),s=submission(store),tx=s.begin();change(store,s);assert.throws(()=>tx.commit(s.receipt),e=>['STALE_STATE_COMMIT','STATE_STORE_DISPOSED'].includes(e.code));}
  const store=makeStore(),s=submission(store),tx=s.begin();s.receipt.readFinalState=()=>{store.restore(store.snapshot());return s.words;};assert.throws(()=>tx.commit(s.receipt),{code:'STALE_STATE_COMMIT'});
});
test('complete scene and manual purpose are required; no subset, forecast commit or implicit profile',()=>{
  assert.throws(()=>createCanonicalStateStore({scene:sceneForTest()}));
  const store=makeStore(),s=submission(store);const request=createCanonicalRequest({...s.request,executionProfile:s.request.profileId,purpose:'forecast'});
  assert.throws(()=>store.begin({request,candidate:createCanonicalCandidate(request,101,s.candidate.settings),raw:s.raw}),{code:'STATE_REQUEST_MISMATCH'});
  const foreign=submission(makeStore(true));assert.throws(()=>store.begin(foreign),{code:'STATE_REQUEST_MISMATCH'});
});

test('close REST remains exact even when next raw-start clearance refuses it',()=>{
  const store=makeStore(),s=submission(store),tx=s.begin();
  // Inject a touching, nonoverlapping REST pair; no claim this shot produced it.
  s.words[88]=s.words[136]+2*radius;s.words[90]=s.words[138];
  tx.commit(s.receipt);const exact=store.readFinalState(),sceneId=store.readScene().sceneId;
  const next=submission(store,{epoch:2});assert.throws(()=>next.begin(),/contact or unresolved guard/);
  assert.deepEqual(store.readFinalState(),exact);assert.equal(store.readScene().sceneId,sceneId);
});

// Application-source integration below uses actual store and complete scenes,
// but deliberately injected session receipts: not GPU physics/parity evidence.
import {createCanonicalStateApplicationAdapterHarness} from '../src/direct-candidate/canonical-application-adapter.mjs';
require('../src/game-rules.js');
function applicationFixture(four=false,profile='mmq2-cushion',override=()=>{}) {
  const store=makeStore(four,profile),ids=store.readScene().slotToId;
  const game=four?new FourBallGame(ids.slice(0,2),ids.slice(2)):new ThreeBallGame(ids.slice(0,2),ids);
  const context={game:game.snapshot(),selectedId:ids[0],settings:{angle:0,elevation:25,speed:.5,tipX:0,tipY:.2}};
  let epoch=0;const calls=[];
  const session={selectedWorldProfile:profile,capabilities:{selectedWorldProfile:profile,implementation:'injected-test'},cancel(){epoch++;},
    async runSelected(input){calls.push(input);const sequence=++epoch,request=createCanonicalRequest({...input.request,epoch:sequence}),candidate=createCanonicalCandidate(request,input.candidateId,input.settings);
      const words=new Uint32Array(256);words[0]=candidate.candidateId;words[1]=9;words[3]=ids.length;words[5]=2000;words[41]=11;words[42]=23;ids.forEach((id,i)=>words[64+48*i]=id);
      const receipt={kind:'canonical-session-selected-result-v1',selectedWorldProfile:profile,
        identity:profile==='mmq2-cushion'?{...canonicalResultIdentity(candidate),selectedWorldProfile:profile}:canonicalResultIdentity(candidate),
        physicsResultComplete:true,captureComplete:false,samplingComplete:false,
        assertCurrent(){assert.equal(epoch,sequence,'injected session epoch');},readFinalState:()=>words.slice(),readCompact:()=>Uint32Array.of(candidate.candidateId,2,1,0),sample:()=>({status:'unavailable'})};
      await override(receipt);return receipt;
    }};
  const adapter=createCanonicalStateApplicationAdapterHarness({stateStore:store,selectedWorldProfile:profile,readContext:()=>context,session});
  return {store,adapter,context,calls,session,profile};
}
const applicationOptions=()=>({purpose:'manual',requestId:1,candidateId:100,executionProfile:'canonical-local-v1',
  budget:{maximumTicks:Q,maximumEvents:1024,maximumWorkItems:1000000},raw:{absoluteTick:1234,sceneKey:11,requestKey:23}});
test('store adapter feeds exact odd Q24 next-shot scenes without Rapier readback or mutation',async()=>{
  for(const four of[false,true])for(const profile of['mmq1-ball-ball','mmq2-cushion']){
    const f=applicationFixture(four,profile);
    for(const x of[Q+1,-Q-3]){const s=submission(f.store,{profile});s.words[88]=x>>>0;s.begin().commit(s.receipt);
      const before=f.store.readRevision(),result=await f.adapter.runSelected({...applicationOptions(),raw:{...applicationOptions().raw,absoluteTick:f.store.readClock()??1234}}),input=f.calls.at(-1);
      assert.equal(Math.round(input.request.scene.physical.bodies[0].pos.x*Q),x);assert.equal(input.request.scene.slotToId.length,four?4:3);
      assert.deepEqual(input.request.scene.physical.statics,sceneForTest(four).physical.statics);
      assert.equal(result.implementation,'injected-test-state-adapter-v1');assert.equal(result.identity.selectedWorldProfile,profile==='mmq2-cushion'?profile:undefined);
      assert.equal(result.scoreAndTurnCommitted,false);assert.equal(f.store.readRevision(),before);assert.equal(f.adapter.capabilities.physicalHardwareVerified,false);
    }
  }
});
test('store adapter invalidates same-scene restore, cancel, begin and disposal',async()=>{
  for(const change of[f=>f.store.restore(f.store.snapshot()),f=>f.store.cancel(),f=>submission(f.store,{profile:f.profile}).begin(),f=>f.store.dispose()]){
    const f=applicationFixture(),result=await f.adapter.runSelected(applicationOptions());change(f);assert.throws(result.assertCurrent,{code:'STALE_APPLICATION_RESULT'});
  }
});
test('store adapter preserves profile identities, epoch guards and context guards',async()=>{
  for(const mutate of[r=>{delete r.identity.selectedWorldProfile;},r=>r.selectedWorldProfile='mmq1-ball-ball',r=>r.identity.sceneId='foreign']){
    const f=applicationFixture(false,'mmq2-cushion',mutate);await assert.rejects(f.adapter.runSelected(applicationOptions()),{code:'APPLICATION_IDENTITY_MISMATCH'});
  }
  const f=applicationFixture(),r=await f.adapter.runSelected(applicationOptions());f.session.cancel();assert.throws(r.assertCurrent,/injected session epoch/);
  const r2=await f.adapter.runSelected(applicationOptions());f.context.settings.angle++;assert.throws(r2.assertCurrent,{code:'STALE_APPLICATION_RESULT'});
  for(const profile of[undefined,'mmq1-ball-ball'])assert.throws(()=>createCanonicalStateApplicationAdapterHarness({stateStore:f.store,selectedWorldProfile:profile,readContext:()=>f.context,session:f.session}),{code:'APPLICATION_SOURCE_PROFILE_MISMATCH'});
});
test('store adapter rejects pending same-scene ABA delivery',async()=>{
  let entered,release;const ready=new Promise(r=>entered=r),wait=new Promise(r=>release=r);
  const f=applicationFixture(false,'mmq2-cushion',async()=>{entered();await wait;});
  const promise=f.adapter.runSelected(applicationOptions()),rejection=assert.rejects(promise,{code:'STALE_APPLICATION_RESULT'});
  await ready;f.store.restore(f.store.snapshot());release();await rejection;assert.equal(f.store.readFinalState(),null);
});
test('store adapter reports inconsistent provenance without rewriting its profile',async()=>{
  const f=applicationFixture(),s=submission(f.store,{profile:f.profile});s.begin().commit(s.receipt);
  const source={...f.store,readProvenance(){return {...f.store.readProvenance(),selectedWorldProfile:'mmq1-ball-ball'};}};
  const adapter=createCanonicalStateApplicationAdapterHarness({stateStore:source,selectedWorldProfile:f.profile,readContext:()=>f.context,session:f.session});
  await assert.rejects(adapter.runSelected(applicationOptions()),{code:'APPLICATION_SOURCE_PROVENANCE_MISMATCH'});assert.equal(f.calls.length,0);
});
test('store adapter retains explicit MMQ2 identity on incomplete session output',async()=>{
  const f=applicationFixture(false,'mmq2-cushion',r=>{r.kind='canonical-session-raw-incomplete-v1';r.physicsResultComplete=false;r.captureComplete=false;});
  const result=await f.adapter.runSelected(applicationOptions());assert.equal(result.kind,'canonical-application-incomplete-v1');
  assert.equal(result.identity.selectedWorldProfile,'mmq2-cushion');assert.equal(result.physicsResultComplete,false);
  assert.equal(result.readOutcome,undefined);result.assertCurrent();assert.equal(f.store.readFinalState(),null);
});

test('authored x/z preserves owner clock and exact source through snapshots without inventing REST',()=>{
 const store=makeStore(),initial=store.snapshot();assert.equal(store.readClock(),null);
 const shot=submission(store);shot.begin().commit(shot.receipt);const rest=store.snapshot(),words=store.readFinalState(),scene=store.readScene();
 assert.equal(store.placeBall({id:scene.slotToId[0],position:{x:.8+1/Q,z:.3},expectedRevision:store.readRevision()}),true);
 const edited=store.snapshot(),after=store.readScene();assert.equal(store.readClock(),2000);assert.equal(store.readFinalState(),null);assert.equal(store.readProvenance(),null);
 assert.equal(after.physical.bodies[0].pos.x,Math.round((.8+1/Q)*Q)/Q);assert.equal(after.physical.bodies[0].pos.y,scene.physical.bodies[0].pos.y);
 assert.deepEqual(after.physical.bodies.slice(1),scene.physical.bodies.slice(1));assert.deepEqual(after.physical.statics,scene.physical.statics);
 const next=submission(store);assert.throws(()=>store.begin({...next,raw:{...next.raw,absoluteTick:0}}),{code:'STATE_CLOCK_MISMATCH'});
 store.restore(rest);assert.deepEqual(store.readFinalState(),words);assert.equal(store.readClock(),2000);
 store.restore(edited);assert.equal(store.readScene(),after);assert.equal(store.readClock(),2000);submission(store).begin();
 store.restore(initial);assert.equal(store.readClock(),null);
});
test('placement rejects overlap, bounds, extra axes, unknown IDs and stale getters atomically; no-op preserves receipt',()=>{
 const store=makeStore(),shot=submission(store);shot.begin().commit(shot.receipt);
 const scene=store.readScene(),id=scene.slotToId[0],other=scene.physical.bodies[1].pos;
 for(const input of [{id,position:{x:other.x,z:other.z}},{id,position:{x:4,z:0}},{id,position:{x:4+1e-10,z:0}},{id,position:{x:0,z:0,y:0}},{id:999,position:{x:0,z:0}},{id,position:{x:NaN,z:0}}]){
  const revision=store.readRevision(),words=store.readFinalState(),provenance=store.readProvenance();assert.throws(()=>store.placeBall({...input,expectedRevision:revision}));
  assert.equal(store.readRevision(),revision);assert.equal(store.readScene(),scene);assert.deepEqual(store.readFinalState(),words);assert.deepEqual(store.readProvenance(),provenance);
 }
 const revision=store.readRevision(),p=scene.physical.bodies[0].pos;assert.equal(store.placeBall({id,position:{x:p.x,z:p.z},expectedRevision:revision}),false);assert.equal(store.readRevision(),revision);assert.ok(store.readFinalState());
 assert.throws(()=>store.placeBall({id,expectedRevision:revision,position:{get x(){store.cancel();return .8},z:.3}}),{code:'STALE_STATE_EDIT'});assert.equal(store.readScene(),scene);
});
