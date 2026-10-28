// HOST ONLY. Fake buffers keep metadata and small ABI payloads, not world
// arrays; no WGSL, GPU, Dawn, Rapier, trajectory or simulated physics executes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import {EXECUTOR_CAPABILITY} from '../src/resident-candidate/executor.mjs';
import {packCandidates,STATUS,REASON,UNSET} from '../src/resident-candidate/abi.mjs';
import {allocateResidentMicrocodeBatch,createResidentCompactTransaction,RESIDENT_BATCH_PROTOCOL_CAPABILITY as CAP} from '../src/resident-candidate/batch-protocol.mjs';
import {deriveMicrocodeResourceShape,planResidentMicrocodeAllocation,calculateMicrocodeResources,assertResidentMicrocodeBankSource,assertResidentMicrocodeReadonlySharing} from '../src/resident-candidate/microcode-resources.mjs';
const base=JSON.parse(readFileSync(new URL('./fixtures/resident-microcode-resource-shape.json',import.meta.url))),impact=JSON.parse(readFileSync(new URL('./fixtures/resident-microcode-impact-resource-shape.json',import.meta.url))),{shape,limits}=base;
const identity=()=>({sourceIdentity:'source-a',preStrikeIdentity:'prestrike-a',generationIdentity:'generation-a'});
const input=n=>packCandidates(Array.from({length:n},(_,i)=>({id:5000-i,settings:{angle:i*.013,elevation:8,speed:2,tipX:-0,tipY:0}})),{selectedIndex:0});
const ids=words=>Array.from({length:words.length/16},(_,i)=>words[i*16]);
const terminals=(words,status=STATUS.UNSUPPORTED,reason=REASON.PHYSICS_SCOPE)=>Uint32Array.from(ids(words).flatMap(id=>[id,status,status===STATUS.PASS?1:status===STATUS.MISS?0:UNSET,reason]));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fakeDevice(hooks={},actualLimits=limits){
 const lost=deferred(),log={buffers:[],writes:[],scopes:[],pops:0,waits:0,submissions:0,copies:[],maps:0,events:[]};
 const device={limits:{...actualLimits},lost:lost.promise,
  createBuffer(desc){hooks.allocate?.(desc,log.buffers.length);const buffer={...desc,data:null,destroyed:0,mapped:false,unmap(){this.mapped=false;},destroy(){this.destroyed++;log.events.push('destroy:'+this.label);hooks.destroy?.(this);},async mapAsync(){log.maps++;await hooks.map?.(buffer);this.mapped=true;},getMappedRange(){assert.equal(this.mapped,true);return this.data.buffer;}};log.buffers.push(buffer);return buffer;},
  pushErrorScope(filter){log.scopes.push(filter);},async popErrorScope(){const filter=log.scopes.pop();assert.ok(filter);log.pops++;return await hooks.scope?.(filter,log)??null;},
  createCommandEncoder(){const commands=[];return{copyBufferToBuffer(from,fo,to,toff,size){assert.equal(fo,0);assert.equal(toff,0);assert.ok(from.usage&4);assert.equal(size,to.size);commands.push({from,to,size});},finish(){return commands;}};}
 };
 device.queue={writeBuffer(buffer,offset,words){assert.equal(offset,0);assert.equal(buffer.destroyed,0);assert.equal(words.byteLength,buffer.size);buffer.data=words.slice();log.writes.push({label:buffer.label,words:words.slice(),allocated:log.buffers.length});hooks.write?.(buffer,log);},submit(commandBuffers){log.submissions++;for(const command of commandBuffers.flat())if(command?.from){command.to.data=command.from.data.slice();log.copies.push({from:command.from.label,to:command.to.label,bytes:command.size});}hooks.submit?.(log);},async onSubmittedWorkDone(){log.waits++;log.events.push('wait:'+log.waits);await hooks.wait?.(log.waits);}};
 return{device,log,lose:()=>lost.resolve({reason:'test loss'})};
}
const options=(words,extra={})=>{const source=identity();return{experimental:true,shape,input:words,identity:source,getIdentity:()=>source,...extra};};
const clean=f=>{assert.equal(f.log.scopes.length,0);assert.ok(f.log.buffers.every(b=>b.destroyed===1),'every owned buffer destroyed exactly once');};
const journal=(words,extra={})=>{const source=identity();return createResidentCompactTransaction({input:words,banks:[{first:0,count:2},{first:2,count:words.length/16-2}],identity:source,getIdentity:()=>source,...extra});};

test('compact journal preserves every ID/order/generation and copies staged words; no partial publication',()=>{
 const words=input(4),source=identity(),j=journal(words,{identity:source,getIdentity:()=>source}),a=terminals(words.subarray(0,32)),b=terminals(words.subarray(32),STATUS.INCOMPLETE,REASON.HORIZON);
 j.stage(j.bankReceipts[1],b);b.fill(0);j.stage(j.bankReceipts[0],a);a.fill(0);words.fill(0);const out=j.commit();assert.deepEqual(out.results.map(r=>r.id),[5000,4999,4998,4997]);assert.deepEqual(out.results.map(r=>r.status),['unsupported','unsupported','incomplete','incomplete']);assert.ok(out.results.every(r=>r.pass===null));assert.equal(out.evidence.generationIdentity,'generation-a');assert.equal(out.evidence.physicalProducerAvailable,false);assert.ok(Object.isFrozen(out.results));assert.throws(()=>j.commit());
 const partial=journal(input(4));partial.stage(partial.bankReceipts[0],terminals(input(4).subarray(0,32)));assert.throws(()=>partial.commit(),e=>e.reason===REASON.INCOMPLETE_COMMIT&&e.outcome.results.length===4&&e.outcome.results.every(r=>r.pass===null));assert.equal(partial.phase,'invalid');
});
test('malformed, duplicate, cross-owner, pending and physically evaluated compact rows poison the whole journal',()=>{
 for(const mutate of[w=>w[0]++,w=>w[1]=STATUS.RUNNING,w=>w[2]=0,w=>w[3]=12345,w=>w[1]=100]){const words=input(4),j=journal(words),row=terminals(words.subarray(0,32));mutate(row);assert.throws(()=>j.stage(j.bankReceipts[0],row));assert.equal(j.phase,'invalid');assert.throws(()=>j.commit());}
 for(const status of[STATUS.PASS,STATUS.MISS]){const words=input(4),j=journal(words);assert.throws(()=>j.stage(j.bankReceipts[0],terminals(words.subarray(0,32),status,REASON.NONE)),e=>e.reason===REASON.NUMERIC&&e.outcome.results.every(r=>r.pass===null));}
 const words=input(4),a=journal(words),b=journal(words);assert.throws(()=>a.stage(b.bankReceipts[0],terminals(words.subarray(0,32))),/receipt/);
 b.stage(b.bankReceipts[0],terminals(words.subarray(0,32)));assert.throws(()=>b.stage(b.bankReceipts[0],terminals(words.subarray(0,32))),/once/);
});
test('stale source OR generation at stage/commit aborts every original ID without false misses',()=>{
 for(const field of['sourceIdentity','preStrikeIdentity','generationIdentity']){const words=input(4),source=identity();let current=source;const j=journal(words,{identity:source,getIdentity:()=>current});j.stage(j.bankReceipts[0],terminals(words.subarray(0,32)));j.stage(j.bankReceipts[1],terminals(words.subarray(32)));current={...source,[field]:'new'};assert.throws(()=>j.commit(),e=>e.reason===REASON.STALE_SOURCE&&e.outcome.results.every(r=>r.status==='failed'&&r.pass===null));}
 const j=journal(input(4));assert.ok(j.abort().results.every(r=>r.status==='cancelled'&&r.pass===null));assert.throws(()=>j.commit());
});
test('reject malformed input, duplicate IDs, borrowed/shared words, noncontiguous ranges and identity getters',()=>{
 const words=input(4);words[16]=words[0];assert.throws(()=>journal(words),/distinct/);
 for(const bad of[new Uint32Array(),new Uint32Array(17),new Uint32Array(new SharedArrayBuffer(64)),[]])assert.throws(()=>journal(bad));
 assert.throws(()=>journal(input(4),{banks:[{first:0,count:1},{first:2,count:3}]}));const source=identity();Object.defineProperty(source,'sourceIdentity',{get(){throw Error('never call identity getter');}});assert.throws(()=>journal(input(4),{identity:source}),/exact nonempty/);
});
test('1024 metadata-only fake allocation reserves all2x512 banks before writes, with actual device limits',async()=>{
 const f=fakeDevice(),words=input(1024),owner=await allocateResidentMicrocodeBatch(f.device,options(words)),token=owner.continuation,r=owner.resources(token);
 assert.equal(f.log.buffers.length,20);assert.equal(f.log.buffers.reduce((s,b)=>s+b.size,0),370602772);assert.ok(f.log.writes.every(w=>w.allocated===20));assert.equal(f.log.submissions,0);assert.deepEqual(owner.ids,ids(words));assert.equal(r.banks.length,2);assert.equal(r.banks[0].rawScratch,r.banks[0].numericScratch);assert.notEqual(r.banks[0].scratch,r.banks[1].scratch);assert.notEqual(r.banks[0].vmState,r.banks[1].vmState);assert.notEqual(r.banks[0].microcode,r.banks[1].microcode);
 assert.deepEqual(f.log.writes[0].words,words.slice(0,512*16));assert.deepEqual(f.log.writes[1].words,words.slice(512*16));assert.ok(f.log.buffers.filter(b=>b.usage&128).every(b=>b.size<=134217728));assert.ok(f.log.buffers.filter(b=>/worldState|vmState/.test(b.label)).every(b=>(b.usage&4)===0));assert.equal(CAP.physicalProducerAvailable,false);assert.equal(CAP.native1024TrajectoriesQualified,false);
 words.fill(0);assert.equal(owner.ids[0],5000);assert.equal(f.log.maps,0);await owner.dispose();clean(f);await owner.dispose();clean(f);
});
test('plan/limits fail before allocation; larger single-bank requires actual granted device limits',async()=>{
 const f=fakeDevice();await assert.rejects(allocateResidentMicrocodeBatch(f.device,options(input(1024),{bankRows:1024,bindingPolicy:'queried-device'})),e=>e.reason===REASON.CAPACITY);assert.equal(f.log.buffers.length,0);
 const big=fakeDevice({}, {...limits,maxStorageBufferBindingSize:268435456}),owner=await allocateResidentMicrocodeBatch(big.device,options(input(1024),{bankRows:1024,bindingPolicy:'queried-device'}));assert.equal(owner.plan.banks.length,1);assert.equal(owner.plan.banks[0].resources.worldState.bytes,258379744);await owner.dispose();clean(big);
 for(const extra of[{experimental:false},{maxLiveBytes:370602771},{shape:impact.shape}]){const g=fakeDevice();await assert.rejects(allocateResidentMicrocodeBatch(g.device,options(input(1024),extra)));assert.equal(g.log.buffers.length,0);}
});
test('every partial allocation failure and asynchronous OOM rolls back atomically, with no row reduction',async()=>{
 for(let index=0;index<20;index++){const f=fakeDevice({allocate(_desc,n){if(n===index)throw Error('fake OOM');}});await assert.rejects(allocateResidentMicrocodeBatch(f.device,options(input(1024))),e=>e.reason===REASON.CAPACITY&&e.outcome.results.length===1024);assert.equal(f.log.buffers.length,index);assert.equal(f.log.writes.length,0);clean(f);}
 const f=fakeDevice({scope(filter){return filter==='out-of-memory'?{message:'asynchronous allocation OOM'}:null;}});await assert.rejects(allocateResidentMicrocodeBatch(f.device,options(input(2))),e=>e.reason===REASON.CAPACITY);clean(f);
});
test('pre-abort, stale lease and allocation-time abort leave no buffers or initial writes',async()=>{
 const c=new AbortController();c.abort();const f=fakeDevice();await assert.rejects(allocateResidentMicrocodeBatch(f.device,options(input(2),{signal:c.signal})),e=>e.reason===REASON.CANCELLED);assert.equal(f.log.buffers.length,0);
 const stale=fakeDevice();await assert.rejects(allocateResidentMicrocodeBatch(stale.device,options(input(2),{getIdentity:()=>({...identity(),generationIdentity:'new'})})),e=>e.reason===REASON.STALE_SOURCE);assert.equal(stale.log.buffers.length,0);
 const d=new AbortController(),mid=fakeDevice({allocate(_desc,n){if(n===5)d.abort();}});await assert.rejects(allocateResidentMicrocodeBatch(mid.device,options(input(2),{signal:d.signal})),e=>e.reason===REASON.CANCELLED);assert.equal(mid.log.writes.length,0);clean(mid);
});
test('one live device owner and opaque continuation receipts reject overlap, reuse and cross-owner use',async()=>{
 const f=fakeDevice(),owner=await allocateResidentMicrocodeBatch(f.device,options(input(2))),token=owner.continuation;await assert.rejects(allocateResidentMicrocodeBatch(f.device,options(input(2))),/already owned/);const g=fakeDevice(),other=await allocateResidentMicrocodeBatch(g.device,options(input(2)));await assert.rejects(owner.submit(other.continuation,[{}]),/owner-local/);
 const next=await owner.submit(token,[{}]);assert.notEqual(next,token);await assert.rejects(owner.submit(token,[{}]),/owner-local/);assert.equal(f.log.submissions,1);assert.ok(owner.resources(next));await owner.dispose();await other.dispose();clean(f);clean(g);
});
test('cancel while submitted waits for drain ownership before destroying all banks',async()=>{
 const hold=deferred(),entered=deferred(),f=fakeDevice({wait(n){if(n===2){entered.resolve();return hold.promise;}}}),owner=await allocateResidentMicrocodeBatch(f.device,options(input(4))),token=owner.continuation;
 const work=owner.submit(token,[{}]).catch(e=>e);await entered.promise;const cancelled=owner.cancel();await Promise.resolve();assert.ok(f.log.buffers.every(b=>b.destroyed===0));assert.throws(()=>owner.resources(token));hold.resolve();const error=await work;assert.equal(error.reason,REASON.CANCELLED);const out=await cancelled;assert.deepEqual(out.results.map(r=>r.id),ids(input(4)));assert.ok(out.results.every(r=>r.status==='cancelled'&&r.pass===null));clean(f);
});
test('device loss releases pending submission without manufacturing a completed drain',async()=>{
 const entered=deferred(),never=new Promise(()=>{}),f=fakeDevice({wait(n){if(n===2){entered.resolve();return never;}}}),owner=await allocateResidentMicrocodeBatch(f.device,options(input(2)));const work=owner.submit(owner.continuation,[{}]).catch(e=>e);await entered.promise;f.lose();const error=await work;assert.equal(error.reason,REASON.DEVICE_LOST);assert.ok(error.outcome.results.every(r=>r.reasonCode===REASON.DEVICE_LOST&&r.pass===null));await owner.dispose();clean(f);
});
test('unknown queue rejection is not a cancellation or proven drain; unrecovered device lease stays poisoned',async()=>{
 const f=fakeDevice({wait(n){if(n>=2)throw Error('unknown queue rejection');}}),owner=await allocateResidentMicrocodeBatch(f.device,options(input(2)));await assert.rejects(owner.submit(owner.continuation,[{}]),e=>e.reason===REASON.INCOMPLETE_COMMIT&&e.outcome.results.every(r=>r.status==='failed'));clean(f);await assert.rejects(allocateResidentMicrocodeBatch(f.device,options(input(2))),/poisoned/);
});
test('compact collection maps only16 bytes/row once, aggregates all banks, validates then destroys before commit',async()=>{
 const words=input(4),f=fakeDevice(),source=identity(),owner=await allocateResidentMicrocodeBatch(f.device,options(words,{bankRows:2,identity:source,getIdentity:()=>source})),r=owner.resources(owner.continuation);
 // Explicit non-physics terminal ABI fixture; fake device runs no producer.
 r.compactResults.data=terminals(words);r.compactResults.data.set([ids(words)[3],STATUS.INCOMPLETE,UNSET,REASON.HORIZON],12);
 const next=await owner.submit(owner.continuation,[{}]),out=await owner.collectCompact(next);assert.deepEqual(out.results.map(r=>r.id),ids(words));assert.ok(out.results.every(r=>r.pass===null));assert.equal(out.results[3].status,'incomplete');assert.equal(out.evidence.readbackBytes,64);assert.equal(out.evidence.generationIdentity,'generation-a');assert.equal(out.evidence.liveBufferBytes,0);assert.equal(out.evidence.intermediateStateReadbacks,0);assert.equal(out.evidence.numericallyQualified,false);assert.equal(out.evidence.limitsSource,'queried-GPUDevice');assert.equal(f.log.maps,1);await assert.rejects(owner.cancel(),/committed/);assert.deepEqual(f.log.copies,[{from:'compactResults',to:'compactReadback',bytes:64}]);clean(f);
});
test('pending/no-producer, malformed late bank and PASS/MISS compact data never publish partial success',async()=>{
 for(const mode of['pending','late-id','pass','miss']){const words=input(4),f=fakeDevice(),owner=await allocateResidentMicrocodeBatch(f.device,options(words,{bankRows:2}));if(mode!=='pending'){const data=terminals(words);if(mode==='late-id')data[12]++;else{data[13]=mode==='pass'?STATUS.PASS:STATUS.MISS;data[14]=mode==='pass'?1:0;}owner.resources(owner.continuation).compactResults.data=data;}await assert.rejects(owner.collectCompact(owner.continuation),e=>e.outcome.results.length===4&&e.outcome.results.every(r=>r.status==='failed'&&r.pass===null));clean(f);}
});
test('generation change during final error validation OR buffer destruction prevents publication',async()=>{
 for(const boundary of['scope','destroy']){let current=identity();const original=current,f=fakeDevice({scope(_filter,log){if(boundary==='scope'&&log.pops===6)current={...original,generationIdentity:'new'};},destroy(){if(boundary==='destroy')current={...original,generationIdentity:'new'};}}),words=input(2),owner=await allocateResidentMicrocodeBatch(f.device,options(words,{identity:original,getIdentity:()=>current}));owner.resources(owner.continuation).compactResults.data=terminals(words);await assert.rejects(owner.collectCompact(owner.continuation),e=>e.reason===REASON.STALE_SOURCE);clean(f);}
});
test('map rejection, validation rejection and abort during mapping clean every resource',async()=>{
 for(const mode of['map','validation','abort']){const c=new AbortController(),f=fakeDevice({map(){if(mode==='map')throw Error('map rejected');if(mode==='abort')c.abort();},scope(_filter,log){return mode==='validation'&&log.pops===4?{message:'fake validation error'}:null;}}),words=input(2),owner=await allocateResidentMicrocodeBatch(f.device,options(words,{signal:c.signal}));owner.resources(owner.continuation).compactResults.data=terminals(words);await assert.rejects(owner.collectCompact(owner.continuation),e=>e.outcome.results.every(r=>r.pass===null));clean(f);}
});
test('current h192 four-macro descriptor is explicit:7817-word VM and mandatory audit, not old unaudited shape',()=>{
 const s=impact.shape;assert.equal(s.sourceFrames,192);assert.equal(s.perCandidate.vmLocalWords,7786);assert.equal(s.perCandidate.vmStrideWords,7817);assert.equal(s.sharedWords.microcode,1055264);assert.equal(s.auditWordsPerCandidate,127012);assert.equal(s.storageBindings,8);
 const current=calculateMicrocodeResources(s,2,{limits});assert.equal(current.bytes.vm,62536);assert.equal(current.buffers.eventAudit.bytes,1016096);assert.equal(current.bytes.mandatorySourceAudit,1016096);
 const at=calculateMicrocodeResources(s,264,{limits,diagnosticCaptures:1}),over=calculateMicrocodeResources(s,265,{limits,diagnosticCaptures:1});assert.equal(at.buffers.eventAudit.bytes,134124672);assert.equal(at.proposedCompact.fits,true,'binding arithmetic only, not source admission');assert.equal(over.buffers.eventAudit.bytes,134632720);assert.equal(over.proposedCompact.fits,false);
 const p=planResidentMicrocodeAllocation(s,1024,{limits});assert.equal(p.fits,false);assert.equal(p.bytes.mandatorySourceAudit,520241152);assert.equal(p.bytes.peakLive,890672724);assert.ok(p.violations.some(v=>v.resource==='eventAudit'&&v.required===260120576));assert.ok(p.violations.some(v=>v.policy?.includes('cannot omit')));
});
const runtimePath=process.env.RESIDENT_BATCH_SOURCE_RUNTIME;
test('optional exact current initial-only runtime derives pinned descriptor and rejects2-row source reused at512',{skip:!runtimePath},()=>{
 const bytes=readFileSync(runtimePath);assert.equal(createHash('sha256').update(bytes).digest('hex'),impact.runtimeSha256);const runtime=deserialize(bytes);assert.deepEqual(deriveMicrocodeResourceShape(runtime),impact.shape);const other=structuredClone(runtime);assert.equal(assertResidentMicrocodeReadonlySharing([runtime,other]).commonBytes,419348);other.original.sharedGeometry[0]^=1;assert.throws(()=>assertResidentMicrocodeReadonlySharing([runtime,other]),/readonly bytes differ/);assert.throws(()=>assertResidentMicrocodeBankSource(runtime,{count:512}),/count-specialized/);assert.throws(()=>assertResidentMicrocodeBankSource(runtime,{count:2}),/audited/);for(const mutate of[p=>p.vm.stride++,p=>p.audit.totalWords++,p=>p.vm.eventAudit=false]){const p=structuredClone(runtime);mutate(p);assert.throws(()=>deriveMicrocodeResourceShape(p));}
});

test('unavailable physical evaluation closes the reservation and cannot enable qualification',async()=>{
 const f=fakeDevice(),owner=await allocateResidentMicrocodeBatch(f.device,options(input(2),{qualified:true,qualifiedMask:0xffffffff}));assert.throws(()=>owner.evaluate(),e=>e.reason===REASON.PHYSICS_SCOPE);await owner.dispose();clean(f);assert.equal(owner.capability.originalFullRestQualified,false);
});
test('a popErrorScope rejection destroys every buffer but explicitly poisons device reuse',async()=>{
 const f=fakeDevice({scope(_filter,log){if(log.pops===1)throw Error('scope rejected');}});await assert.rejects(allocateResidentMicrocodeBatch(f.device,options(input(2))),/cleanup/);clean(f);await assert.rejects(allocateResidentMicrocodeBatch(f.device,options(input(2))),/poisoned/);
});
test('optional actual h192 retained-session allocations match the descriptor using fake cache/device only',{skip:!runtimePath},async()=>{
 const bytes=readFileSync(runtimePath);assert.equal(createHash('sha256').update(bytes).digest('hex'),impact.runtimeSha256);const plan=deserialize(bytes),{createMicrocodeWorldSession}=await import('./resident-candidate-microcode-world-runtime.mjs');
 const allocated=new Map(),device={limits,pushErrorScope(){},async popErrorScope(){return null;},createBuffer({size,label,usage}){assert.equal(allocated.has(label),false);const b={bytes:size,storage:!!(usage&128),destroyed:false,unmap(){},destroy(){this.destroyed=true;}};allocated.set(label,b);return b;},createBindGroup(){return{};},queue:{writeBuffer(){},async onSubmittedWorkDone(){},submit(){throw Error('HOST allocation test must never submit work');}}};
 const cache={device,stats:()=>({requests:0,coldCompiles:0}),async validateAll(){},async compile(){return{groupLayout:{},pipeline:{}};}};
 const session=await createMicrocodeWorldSession({owner:{device},cache,plan,maxCaptures:1});try{const estimate=calculateMicrocodeResources(impact.shape,2,{limits,diagnosticCaptures:1});assert.equal(allocated.size,Object.keys(estimate.buffers).length);for(const[name,b]of Object.entries(estimate.buffers)){const actual=allocated.get(name==='diagnostics'?'final-only-diagnostics':name);assert.deepEqual({bytes:actual.bytes,storage:actual.storage},{bytes:b.bytes,storage:b.storage},name);}assert.equal([...allocated.values()].reduce((sum,b)=>sum+b.bytes,0),estimate.bytes.currentTestTotal);}finally{await session.dispose();}assert.ok([...allocated.values()].every(b=>b.destroyed));
});

test('continuation receipt is withheld until every submission error scope finishes',async()=>{
 let owner;const observed=[],f=fakeDevice({scope(_filter,log){if(log.pops>3)observed.push(owner.continuation);}});owner=await allocateResidentMicrocodeBatch(f.device,options(input(2)));const receipt=await owner.submit(owner.continuation,[{}]);assert.equal(observed.length,3);assert.ok(observed.every(v=>v===null));assert.equal(owner.continuation,receipt);await owner.dispose();clean(f);
});
test('many closed waves subscribe to device loss only once and do not retain prior owners',async()=>{
 const f=fakeDevice(),original=f.device.lost;let subscriptions=0;f.device.lost={then(...args){subscriptions++;return original.then(...args);}};
 for(let i=0;i<8;i++){const owner=await allocateResidentMicrocodeBatch(f.device,options(input(2)));await owner.submit(owner.continuation,[{}]);await owner.dispose();}
 assert.equal(subscriptions,1);f.lose();await Promise.resolve();await Promise.resolve();clean(f);await assert.rejects(allocateResidentMicrocodeBatch(f.device,options(input(2))),e=>e.reason===REASON.DEVICE_LOST);
});

test('1024-row compact protocol retains all IDs across the bank boundary and maps exactly16384 bytes',async()=>{
 const words=input(1024),f=fakeDevice(),owner=await allocateResidentMicrocodeBatch(f.device,options(words));owner.resources(owner.continuation).compactResults.data=terminals(words,STATUS.INCOMPLETE,REASON.INCOMPLETE_COMMIT);
 const out=await owner.collectCompact(owner.continuation);assert.deepEqual(out.results.map(r=>r.id),ids(words));assert.equal(out.results[511].id,4489);assert.equal(out.results[512].id,4488);assert.ok(out.results.every(r=>r.pass===null&&r.status==='incomplete'));assert.equal(out.evidence.readbackBytes,16384);assert.equal(f.log.maps,1);assert.equal(f.log.copies[0].bytes,16384);clean(f);
 assert.equal(EXECUTOR_CAPABILITY.originalFullRestQualified,false);assert.equal(EXECUTOR_CAPABILITY.native1024TrajectoriesQualified,false);assert.equal(EXECUTOR_CAPABILITY.hardwarePerformanceMeasured,false);assert.equal(EXECUTOR_CAPABILITY.defaultBackend,false);
});
