// HOST construction and noncomputing lifecycle double, never numerical evidence.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRetainedInitialMicrocodeRuntime as runtime,assertRetainedInitialMicrocodeRuntime,createRetainedInitialMicrocodeBatchPlan as batch,assertRetainedInitialMicrocodeBatchPlan} from '../src/resident-candidate/retained-microcode-plan.mjs';
import {createRetainedInitialMicrocodeBatchExecutor as owner,RetainedMicrocodeInterrupted} from '../src/resident-candidate/retained-microcode-executor.mjs';
import {initial,rows,planOptions,fakeBatchDevice,released,optionsFor} from './resident-candidate-initial-microcode-batch-fixture.mjs';
import {STATUS as S,REASON as R,UNSET} from '../src/resident-candidate/abi.mjs';
const ctor={experimental:true,maxDispatchesPerSubmission:4096};let pending;
const fixture=()=>pending??=(async()=>{const f=await initial(),r=[runtime(f.initialization,rows(10,2),{experimental:true,maxHSteps:2,chunkCycles:2,maxTotalCycles:5}),runtime(f.initialization,rows(20,2),{experimental:true,maxHSteps:2,chunkCycles:3,maxTotalCycles:7})];return{...f,r,plan:batch(r,planOptions(r.map(x=>x.runtime)))};})();
const interrupted=reason=>error=>error instanceof RetainedMicrocodeInterrupted&&error.reason===reason;
const noStatus=r=>{assert.equal(r.physicsStatusAvailable,false);for(const k of['results','status','pass','words','vmWords','physicalRest','sourceH'])assert.equal(Object.hasOwn(r,k),false);};
test('fresh retained caps are branded, explicit, counter-safe and cannot wrap or relabel old runtime',async()=>{
 const{initialization,r,plan:p}=await fixture();assert.equal(assertRetainedInitialMicrocodeBatchPlan(p),p);assert.equal(p.requestedH,2);assert.equal(p.totalBytes,p.base.totalBytes);assert.notEqual(p.identity.generationIdentity,p.base.identity.generationIdentity);assert.deepEqual(p.bankCaps.map(x=>[x.chunkCycles,x.maxTotalCycles]),[[2,5],[3,7]]);assert.equal(p.allocations.length,25);
 for(const value of[r[0].runtime,{...r[0]}])assert.throws(()=>assertRetainedInitialMicrocodeRuntime(value),/locally constructed/);assert.throws(()=>assertRetainedInitialMicrocodeBatchPlan({...p}),/owned/);
 const good={experimental:true,maxHSteps:2,chunkCycles:2,maxTotalCycles:5};for(const extra of[{maxTotalCycles:1},{maxTotalCycles:0x100000000},{chunkCycles:65537},{maxTotalCycles:2.5},{qualifiedMask:1},{maxHSteps:0}])assert.throws(()=>runtime(initialization,rows(1,1),{...good,...extra}));
 assert.throws(()=>runtime(r[0].runtime,rows(1,1),good),/authentic/);assert.throws(()=>batch([r[0],r[0]],planOptions([r[0].runtime,r[0].runtime])),/distinct/);
 assert.equal(r[0].runtime.vm.dispatchChunks,2);assert.equal(r[0].counterBounds.sourceOverflowChecksUnchanged,true);assert.equal(r[0].counterBounds.representabilityOnly,true);
});
test('two banks initialize once, retain words through multiple bounded chunks, then publish exactly once',async()=>{
 const{plan:p}=await fixture(),f=fakeBatchDevice(p),e=owner(f.device,ctor);let receipt=await e.begin(p,optionsFor(p));noStatus(receipt);assert.deepEqual(receipt.submittedCycles,[0,0]);assert.equal(f.log.dispatches,p.initializationDispatches);assert.equal(f.log.maps.length,0);assert.ok(f.log.buffers.every(b=>!b.destroyed));const uploads=f.log.writes.length,bufferIds=f.log.buffers.slice();
 // Test-only sentinels prove lifecycle ownership, not simulated physics. No
 // subsequent upload/begin is allowed to reset any source/VM/scratch byte.
 const sentinels=f.log.buffers.filter(b=>/:(worldState|vmState|scratch)$/.test(b.label));for(const b of sentinels)new Uint32Array(b.data.buffer)[0]=0x5a17cafe;
 const first=receipt;receipt=await e.advance(receipt,{cyclesByBank:[2,3]});await assert.rejects(e.advance(first,{cyclesByBank:[1,1]}),/current unconsumed/);await assert.rejects(e.advance({...receipt},{cyclesByBank:[1,1]}),/current unconsumed/);await assert.rejects(e.advance(receipt,{cyclesByBank:[3,0]}),/bounded/);await assert.rejects(e.advance(receipt,{cyclesByBank:[0,0]}),/bounded/);await assert.rejects(e.advance(receipt,{cyclesByBank:[,1]}),/dense/);const accessor=[1,1];Object.defineProperty(accessor,0,{get(){throw Error('must not execute work getter');}});await assert.rejects(e.advance(receipt,{cyclesByBank:accessor}),/data-only/);
 receipt=await e.advance(receipt,{cyclesByBank:[2,3]});receipt=await e.advance(receipt,{cyclesByBank:[1,1]});noStatus(receipt);assert.deepEqual(receipt.submittedCycles,[5,7]);assert.deepEqual(receipt.remainingCycles,[0,0]);assert.equal(receipt.allDeclaredWorkExhausted,true);await assert.rejects(e.advance(receipt,{cyclesByBank:[1,0]}),/bounded/);
 assert.equal(f.log.maps.length,0);assert.equal(f.log.writes.length,uploads);assert.deepEqual(f.log.buffers,bufferIds);for(const b of sentinels)assert.equal(new Uint32Array(b.data.buffer)[0],0x5a17cafe);for(const b of p.banks){assert.equal(f.log.counts.get(b.index+':initial-microcode core begin'),1);assert.equal(f.log.counts.get(b.index+':initial-microcode core pump'),[5,7][b.index]);}
 const out=await e.finalize(receipt);assert.ok(out.results.every(x=>x.pass===null&&x.status==='incomplete'));assert.deepEqual(out.results.map(x=>x.id),p.orderedIds);assert.deepEqual(out.evidence.submittedVmCycles,[5,7]);assert.equal(out.evidence.dispatches,p.initializationDispatches+60+2);assert.equal(out.evidence.buffersCreated,25);assert.equal(out.evidence.buffersDestroyed,25);assert.equal(out.evidence.advanceCalls,3);assert.equal(out.evidence.numericallyQualified,false);assert.equal(f.log.maps.length,1);assert.equal(f.log.maps[0].size,64);released(f.log);await assert.rejects(e.finalize(receipt),/current unconsumed/);await e.dispose();
});
test('early finalize preserves incomplete and unsupported control outcomes, never an evaluated miss',async()=>{
 const{plan:p}=await fixture(),f=fakeBatchDevice(p,{rowFor:(bank,row)=>[row.id,bank?S.UNSUPPORTED:S.INCOMPLETE,UNSET,bank?R.PHYSICS_SCOPE:R.HORIZON]}),e=owner(f.device,ctor),r=await e.begin(p,optionsFor(p)),out=await e.finalize(r);assert.deepEqual(out.evidence.submittedVmCycles,[0,0]);assert.deepEqual(out.results.map(x=>x.status),['incomplete','incomplete','unsupported','unsupported']);assert.ok(out.results.every(x=>x.pass===null));assert.equal(f.log.maps.length,1);released(f.log);await e.dispose();
});
test('all-or-nothing admission, preflight and second-bank allocation before uploads',async()=>{
 const{plan:p}=await fixture();for(const failure of['brand','lease','syntax','allocation']){const f=fakeBatchDevice(p,{hooks:failure==='syntax'?{shaderErrors:()=>[{type:'error',lineNum:1,linePos:1,message:'TEST syntax'}]}:failure==='allocation'?{beforeAllocate(d){if(d.label==='resident batch 1:worldState')throw Error('TEST allocation');}}:{}}),e=owner(f.device,ctor);await assert.rejects(e.begin(failure==='brand'?{...p}:p,optionsFor(p,failure==='lease'?{identity:{...p.identity,generationIdentity:'wrong'}}:{})));assert.equal(f.log.writes.length+f.log.maps.length+f.log.submissions,0);if(failure==='syntax')assert.equal(f.log.pipelines.length,0);released(f.log);await e.dispose();}
});
test('cancel or stale after a drained chunk destroys all retained banks without map or physics receipt',async()=>{
 const{plan:p}=await fixture();for(const mode of['cancel','stale']){let current=p.identity;const f=fakeBatchDevice(p),e=owner(f.device,ctor);let r=await e.begin(p,optionsFor(p,{getIdentity:()=>current}));r=await e.advance(r,{cyclesByBank:[1,1]});if(mode==='cancel'){const closed=await e.cancel();assert.equal(closed.reason,R.CANCELLED);await assert.rejects(e.advance(r,{cyclesByBank:[1,1]}),interrupted(R.CANCELLED));}else{current={...p.identity,sourceIdentity:'changed'};await assert.rejects(e.advance(r,{cyclesByBank:[1,1]}),interrupted(R.STALE_SOURCE));}assert.equal(f.log.maps.length,0);released(f.log);await e.dispose();}
});
test('one bank unqualified PASS invalidates atomic finalize and releases every bank',async()=>{
 const{plan:p}=await fixture(),f=fakeBatchDevice(p,{rowFor:(bank,row)=>bank?[row.id,S.PASS,1,R.NONE]:[row.id,S.INCOMPLETE,UNSET,R.HORIZON]}),e=owner(f.device,ctor),r=await e.begin(p,optionsFor(p));await assert.rejects(e.finalize(r),/PASS\/MISS producer is unavailable/);assert.equal(f.log.maps.length,1);released(f.log);await e.dispose();
});
test('admission interruptions never touch device; submitted loss drains/invalidates without a map',async()=>{
 const{plan:p}=await fixture();for(const mode of['cancel','stale']){const c=new AbortController();if(mode==='cancel')c.abort();const f=fakeBatchDevice(p),e=owner(f.device,ctor);await assert.rejects(e.begin(p,optionsFor(p,{signal:c.signal,getIdentity:()=>mode==='stale'?{...p.identity,generationIdentity:'changed'}:p.identity})),interrupted(mode==='cancel'?R.CANCELLED:R.STALE_SOURCE));assert.equal(f.log.buffers.length+f.log.preflights.length+f.log.maps.length,0);await e.dispose();}
 let f;f=fakeBatchDevice(p,{hooks:{submit(){f.lose();}}});const e=owner(f.device,ctor);await assert.rejects(e.begin(p,optionsFor(p)),interrupted(R.DEVICE_LOST));assert.equal(f.log.maps.length,0);released(f.log);await e.dispose();assert.throws(()=>owner(f.device,ctor),/lost/);
});
test('idle abort/loss cleans retained buffers; final-map stale cannot publish any bank',async()=>{
 const{plan:p}=await fixture();for(const mode of['idle-abort','idle-loss','map-stale']){const c=new AbortController();let current=p.identity;const f=fakeBatchDevice(p,{hooks:{map(){if(mode==='map-stale')current={...p.identity,preStrikeIdentity:'changed'};}}}),e=owner(f.device,ctor),r=await e.begin(p,optionsFor(p,{signal:c.signal,getIdentity:()=>current}));if(mode==='idle-abort'){c.abort();await e.cancel();assert.equal(f.log.maps.length,0);await assert.rejects(e.finalize(r),interrupted(R.CANCELLED));}else if(mode==='idle-loss'){f.lose();await Promise.resolve();await assert.rejects(e.advance(r,{cyclesByBank:[1,1]}),interrupted(R.DEVICE_LOST));await e.cancel();assert.equal(f.log.maps.length,0);}else{await assert.rejects(e.finalize(r),interrupted(R.STALE_SOURCE));assert.equal(f.log.maps.length,1);}released(f.log);await e.dispose();}
});

test('cancellation inside final transaction identity callback cannot publish after cleanup',async()=>{
 const{plan:p}=await fixture(),c=new AbortController(),f=fakeBatchDevice(p),e=owner(f.device,ctor);let afterDestroyCalls=0;
 const getIdentity=()=>{if(f.log.buffers.length===p.allocations.length&&f.log.buffers.every(b=>b.destroyed)){if(++afterDestroyCalls===3)c.abort();}return p.identity;};
 const r=await e.begin(p,optionsFor(p,{signal:c.signal,getIdentity}));await assert.rejects(e.finalize(r),interrupted(R.CANCELLED));assert.equal(afterDestroyCalls,3,'third post-cleanup lease read is inside atomic commit');assert.equal(f.log.maps.length,1);released(f.log);await e.dispose();
});

test('initial view mutation inside final lease callback remains stale, not publication authority',async()=>{
 const{plan:p}=await fixture(),f=fakeBatchDevice(p),e=owner(f.device,ctor),input=p.banks[0].runtime.original.input,prior=input[1];let afterDestroyCalls=0;
 const getIdentity=()=>{if(f.log.buffers.length===p.allocations.length&&f.log.buffers.every(b=>b.destroyed)&&++afterDestroyCalls===3)input[1]^=1;return p.identity;};
 try{const r=await e.begin(p,optionsFor(p,{getIdentity}));await assert.rejects(e.finalize(r),interrupted(R.STALE_SOURCE));assert.equal(afterDestroyCalls,3);assert.equal(f.log.maps.length,1);released(f.log);}finally{input[1]=prior;await e.dispose();}
});
