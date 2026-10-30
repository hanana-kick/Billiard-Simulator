import {restoreEndpointCacheDelta} from './helpers/reviewed-endpoint-cache-delta.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {encodeCanonicalScene,createCanonicalRequest,createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {prepareCanonicalWorldContinuation} from '../src/direct-candidate/canonical-world-continuation.mjs';
import {captureWasmGpuWorldInputPlan,buildWasmGpuWorldUploadManifest} from '../src/wasm-gpu/world-input-manifest-builder.mjs';
import {validateWasmGpuWorldUploadManifest,WORLD_QUERY_VIEW_ROLES,packWasmGpuWorldInputRoles,prepareWasmGpuWorldUploads,prepareWasmGpuRawUploads,prepareWasmGpuCurrentInputs,prepareWasmGpuInputs} from '../src/wasm-gpu/world-inputs.mjs';
import {createWasmGpuEngineArtifact,loadWasmGpuEngineArtifact} from '../src/wasm-gpu/engine-artifact.mjs';
import {createWasmGpuRawArtifact} from '../src/wasm-gpu/raw-artifact-builder.mjs';
import {loadWasmGpuRawArtifact} from '../src/wasm-gpu/raw-artifact.mjs';
import {lowerLiveWorldPlans} from '../src/direct-candidate/experimental-live-world-batch.mjs';
import {captureRawWorldResourceFacts} from '../src/direct-candidate/experimental-live-world-raw-resources.mjs';
import {createLiveWorldCaptureDevice} from '../src/direct-candidate/experimental-live-world-capture.mjs';
const base=mmq2RawFixture();
function current(changed=false,candidateId=100){
 const p=structuredClone(base.request.scene.physical),shift=changed?1/1024:0,id=x=>x+(changed?1000:0);
 const objects=p.bodies.map(x=>({...x,id:id(x.id),pos:{...x.pos,x:x.pos.x+shift},rot:{x:0,y:0,z:0,w:1}}));
 const statics=p.statics.map(({rotation,...x})=>({...x,pos:{...x.pos,x:x.pos.x+shift},rot:rotation}));
 const encoded=encodeCanonicalScene({params:p.parameters,...p.sourceSettings,objects,statics},{objectIds:objects.map(x=>x.id),staticCount:statics.length});assert.equal(encoded.admitted,true,JSON.stringify(encoded.reasons));
 const r=base.request,request=createCanonicalRequest({scene:encoded.scene,epoch:changed?9:7,requestId:changed?31:17,selectedId:id(r.selectedId),purpose:r.purpose,executionProfile:r.profileId,budget:{...r.budget,maximumTicks:changed?2**23:2**24},rules:{...r.rules,firstId:id(r.rules.firstId),secondId:id(r.rules.secondId),opponentId:id(r.rules.opponentId),allowKiss:!changed}});
 const rawBinding=prepareRawWorldBinding(request,{absoluteTick:changed?4321:1234,sceneKey:changed?77:11,requestKey:changed?81:23}),candidate=createCanonicalCandidate(request,candidateId,{...base.candidate.settings,angle:changed?45:0}),batch=prepareRawWorldBatch(rawBinding,[candidate],{maximumSteps:3});
 const binding=prepareCanonicalWorldContinuation(request,rawBinding.shotClock,{sceneKey:changed?77:11,requestKey:changed?81:23,durationTicks:changed?4096:8192,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:2,tailMaxNodes:changed?64:256,enableCushionContinuation:true,mixedMotionRevision:'mmq2'});
 return {request,binding,batch,rawBinding,candidate};
}
async function engineFor(f,capture,count=1,plans=Array(count).fill(capture.plan)){
 const lowered=await lowerLiveWorldPlans(plans,{candidateLocalAllocations:capture.candidateLocalAllocations}),batch=count===1?f.batch:prepareRawWorldBatch(f.rawBinding,Array.from({length:count},(_,i)=>createCanonicalCandidate(f.request,100+i,base.candidate.settings)),{maximumSteps:3});
 const structuralConfig={profile:'mmq2-cushion',strikeBackend:'staged',uploadManifest:capture.uploadManifest};
 const {artifact}=await createWasmGpuEngineArtifact({lowered,count,sourceRevision:'test-current-owned-inputs',structuralConfig,rawAllocations:await captureRawWorldResourceFacts(batch)});
 return loadWasmGpuEngineArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:'test-current-owned-inputs',expectedStructuralConfig:structuralConfig,expectedCount:count});
}
const f=current(),capture=await captureWasmGpuWorldInputPlan(f),engine=await engineFor(f,capture);
test('all current N1 uploads equal every original captured initial byte across changed geometry/clock/rules/IDs',async()=>{
 for(const changed of [false,true]){const x=changed?current(true,777):f,c=changed?await captureWasmGpuWorldInputPlan(x):capture;const result=prepareWasmGpuWorldUploads({engine,bindings:[x.binding],batches:[x.batch]});assert.equal(result.initialUploads.length,c.plan.allocations.filter(a=>!a.external).length);for(const u of result.initialUploads)assert.deepEqual(u.initial,c.plan.allocations[u.index].initial,'allocation '+u.index);assert.equal(result.candidateIds[0],x.candidate.candidateId);}
 assert.ok(capture.metadata.filter(m=>m.hostInitialized).every(m=>m.label.startsWith('wasm-input:')));
 assert.deepEqual(Object.keys(capture.plan.allocations[0]).sort(),['external','initial','size','usage']);
});
test('manifest rejects every unclassified hostwrite, even all-zero bytes; roles and dimensions are bound',()=>{
 const index=capture.metadata.findIndex(m=>m.hostInitialized),bad=capture.metadata.map(m=>({...m}));bad[index].label='';assert.throws(()=>buildWasmGpuWorldUploadManifest({...f,plan:capture.plan,metadata:bad}),/Unclassified/);
 const zero=capture.metadata.findIndex(m=>!m.external&&!m.hostInitialized),hidden=capture.metadata.map(m=>({...m}));hidden[zero].hostInitialized=true;assert.ok(capture.plan.allocations[zero].initial.every(x=>x===0));assert.throws(()=>buildWasmGpuWorldUploadManifest({...f,plan:capture.plan,metadata:hidden}),/Unclassified/);
 assert.throws(()=>prepareWasmGpuWorldUploads({engine:{...engine},bindings:[f.binding],batches:[f.batch]}),/Owned/);assert.throws(()=>packWasmGpuWorldInputRoles({binding:{...f.binding},batch:f.batch}),/Owned/);assert.throws(()=>packWasmGpuWorldInputRoles({binding:f.binding,batch:current(true).batch}),/mismatch/);
 const r=createLiveWorldCaptureDevice(),b=r.device.createBuffer({size:4,usage:136});r.device.queue.writeBuffer(b,0,new Uint32Array(1));assert.equal(b.hostInitialized,true);
});
test('N3 candidate-local arrays concatenate and different structurally shared inputs fail closed',async()=>{
 const xs=[f,current(false,101),current(false,102)],cs=[capture,await captureWasmGpuWorldInputPlan(xs[1]),await captureWasmGpuWorldInputPlan(xs[2])],e=await engineFor(f,capture,3);
 const result=prepareWasmGpuWorldUploads({engine:e,bindings:xs.map(x=>x.binding),batches:xs.map(x=>x.batch)});assert.deepEqual([...result.candidateIds],[100,101,102]);
 for(const u of result.initialUploads){const size=capture.plan.allocations[u.index].size;for(let i=0;i<(e.lowered.shared[u.index]?1:3);i++)assert.deepEqual(u.initial.slice(i*size,(i+1)*size),cs[i].plan.allocations[u.index].initial);}
 assert.throws(()=>prepareWasmGpuWorldUploads({engine:e,bindings:[f.binding,f.binding,current(true).binding],batches:[f.batch,f.batch,current(true).batch]}),/shared allocation/);
});
test('raw current-input role adapter equals genuine original raw bank uploads and zeros outputs',async()=>{
 for(const changed of [false,true]){const x=current(changed),{artifact,initialUploads}=await createWasmGpuRawArtifact({batch:x.batch,sourceRevision:'test-current-raw'});const rawEngine=await loadWasmGpuRawArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:'test-current-raw',expectedCount:1,expectedMaximumSteps:3});assert.deepEqual(prepareWasmGpuRawUploads({rawEngine,batch:x.batch}),initialUploads);}
});

test('current captures match compact independent pre-extraction source and upload digests',async()=>{
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const fixture=JSON.parse(await readFile(new URL('./fixtures/wasm-gpu-world-input-baseline.json',import.meta.url),'utf8'));
 assert.equal(fixture.sourceRevision,'715b503f57f6962d99c7a85a787995284960ee8b');
 const delta=JSON.parse(await readFile(new URL('./fixtures/prepared-world-input-reviewed-mmq2-module-delta.json',import.meta.url),'utf8'));
 assert.equal(delta.baselineCommit,fixture.sourceRevision);
 const sha=value=>createHash('sha256').update(value).digest('hex');
 assert.equal(sha(delta.baselineModuleCode),delta.baselineModuleSHA256);
 for(const changed of [false,true]){const x=current(changed,changed?777:100),now=await captureWasmGpuWorldInputPlan(x);
 // Preserve the independent pre-extraction plan golden. Only the explicitly
 // reviewed MMQ2 clear module and endpoint-cache structural delta may differ.
 const inverse=restoreEndpointCacheDelta({definitions:now.originalPlan.definitions,commands:now.originalPlan.commands,buffers:now.originalPlan.allocations,sourceKey:'source'});
 const restored={...structuredClone(now.originalPlan),definitions:inverse.definitions,commands:inverse.commands,allocations:inverse.buffers},replacements=restored.definitions.filter(d=>sha(d.source)===delta.reviewedModuleSHA256);
 assert.equal(replacements.length,1,'Exactly one reviewed MMQ2 source delta');
 replacements[0].source=delta.baselineModuleCode;
 assert.equal(sha(JSON.stringify(restored)),fixture.cases[changed?'changed-geometry-clock-rules-ids':'default'],'Original full plan after exact reviewed inverses');
 const uploads=prepareWasmGpuWorldUploads({engine,bindings:[x.binding],batches:[x.batch]}).initialUploads;for(const u of uploads)assert.deepEqual(u.initial,now.plan.allocations[u.index].initial);
 }
});

test('combined adapter binds original raw/world candidate content, not copied IDs',async()=>{
 const {artifact}=await createWasmGpuRawArtifact({batch:f.batch,sourceRevision:engine.sourceRevision});const rawEngine=await loadWasmGpuRawArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:engine.sourceRevision,expectedCount:1,expectedMaximumSteps:3});
 const args={engine,rawEngine,bindings:[f.binding],batches:[f.batch],rawBatch:f.batch};const input=prepareWasmGpuCurrentInputs(args);assert.deepEqual(input.rawUploads,prepareWasmGpuRawUploads({rawEngine,batch:f.batch}));
 const other=prepareRawWorldBatch(f.rawBinding,[createCanonicalCandidate(f.request,100,{...f.candidate.settings,angle:30})],{maximumSteps:3});assert.throws(()=>prepareWasmGpuCurrentInputs({...args,rawBatch:other}),/candidate input mismatch/);
});

test('single-binding combined N3 adapter pins actual candidate row order and shared request',async()=>{
 const candidates=[100,101,102].map(id=>createCanonicalCandidate(f.request,id,{...f.candidate.settings,angle:id-100})),singleBatches=candidates.map(c=>prepareRawWorldBatch(f.rawBinding,[c],{maximumSteps:3})),batch=prepareRawWorldBatch(f.rawBinding,candidates,{maximumSteps:3}),e=await engineFor(f,capture,3);
 const {artifact}=await createWasmGpuRawArtifact({batch,sourceRevision:e.sourceRevision}),rawEngine=await loadWasmGpuRawArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:e.sourceRevision,expectedCount:3,expectedMaximumSteps:3});
 const args={engine:e,rawEngine,binding:f.binding,singleBatches,batch},inputs=prepareWasmGpuInputs(args);assert.deepEqual([...inputs.candidateIds],[100,101,102]);
 assert.throws(()=>prepareWasmGpuInputs({...args,singleBatches:[singleBatches[1],singleBatches[0],singleBatches[2]]}),/candidate input mismatch/);
 assert.throws(()=>prepareWasmGpuInputs({...args,binding:current(true).binding}),/binding mismatch/);
});

test('weak owned-pair cache preserves current candidate bytes and cannot be poisoned by returned arrays',async()=>{
 const original=packWasmGpuWorldInputRoles({binding:f.binding,batch:f.batch});
 for(const value of original.roles.values())value.fill(255);original.roles.clear();original.shape.bodyCount=99;
 for(const [candidateId,angle,steps]of [[0xfffffffe,70,3],[777,180,1],[100,0,3]]){
  const candidate=createCanonicalCandidate(f.request,candidateId,{...f.candidate.settings,angle}),batch=prepareRawWorldBatch(f.rawBinding,[candidate],{maximumSteps:steps}),now=packWasmGpuWorldInputRoles({binding:f.binding,batch}),fresh=await captureWasmGpuWorldInputPlan({binding:f.binding,batch});
  assert.equal(now.candidateId,candidateId);assert.equal(now.shape.maximumSteps,batch.effectiveMaximumSteps);
  assert.equal(new Uint32Array(now.roles.get('world:rows').buffer)[1],candidateId);
  for(const m of fresh.uploadManifest.allocations)if(m.hostInitialized)assert.deepEqual(now.roles.get(m.role),fresh.plan.allocations[m.index].initial,m.role);
  now.roles.get('world:scene').fill(42);now.roles.get('rules:identity').fill(42);now.roles.get('raw-prefix:identity').fill(42);
 }
 assert.throws(()=>packWasmGpuWorldInputRoles({binding:f.binding,batch:{...f.batch}}),/Owned|owned/);
 assert.throws(()=>packWasmGpuWorldInputRoles({binding:{...f.binding},batch:f.batch}),/Owned|owned/);
 assert.throws(()=>packWasmGpuWorldInputRoles({binding:f.binding,batch:current(true).batch}),/mismatch/);
 const otherPair=current(),ownedOther=packWasmGpuWorldInputRoles({binding:otherPair.binding,batch:otherPair.batch});assert.deepEqual(ownedOther.roles.get('world:scene'),packWasmGpuWorldInputRoles({binding:f.binding,batch:f.batch}).roles.get('world:scene'));
});
test('explicit staged graph retains audited reference and widens only one zeroed temporary arena',async()=>{
 const {lowerSmoothCellProgram}=await import('../src/wasm-gpu/smooth-program-lowering.mjs');
 const {SMOOTH_CELLS_WGSL}=await import('../src/direct-candidate/deterministic-smooth-segment.mjs');
 const {lowerQueryProgram}=await import('../src/wasm-gpu/query-program-lowering.mjs');const {lowerCushionProgram}=await import('../src/wasm-gpu/cushion-program-lowering.mjs');const original=structuredClone(capture.originalPlan),d=await lowerSmoothCellProgram(capture.originalPlan,{sourceField:'source'}),cushion=await lowerCushionProgram(d,{sourceField:'source'}),query=await lowerQueryProgram(cushion,{sourceField:'source'});
 assert.deepEqual(capture.originalPlan,original);assert.deepEqual(capture.plan.commands,query.commands);assert.deepEqual(capture.plan.definitions,query.definitions);assert.deepEqual(capture.queryLowering,query.receipt);assert.deepEqual(capture.lowering,d.receipt);
 assert.ok(capture.originalPlan.definitions.some(x=>x.source===SMOOTH_CELLS_WGSL));assert.ok(capture.plan.definitions.every(x=>x.source!==SMOOTH_CELLS_WGSL));
 const t=d.receipt.tempAllocation;assert.equal(t,capture.originalPlan.allocations.length);assert.equal(d.receipt.tempBytes,2048);assert.deepEqual(capture.uploadManifest.allocations[t],{index:t,size:2048,usage:128,external:null,hostInitialized:false,role:'zero'});
 const e=await engineFor(f,capture,3);assert.equal(e.lowered.shared[t],false);const uploads=prepareWasmGpuWorldUploads({engine:e,bindings:[f.binding,f.binding,f.binding],batches:[f.batch,f.batch,f.batch]});const temp=uploads.initialUploads.find(x=>x.index===t);assert.equal(temp.initial.length,6144);assert.ok(temp.initial.every(x=>x===0));
 const cr=e.lowered.sourcePlan.cushionLowering;assert.equal(cr.originalSHA256,e.lowered.sourcePlan.lowering.derivedSHA256);assert.equal(cr.cacheAllocations.length,2);for(const {index}of cr.cacheAllocations){const u=uploads.initialUploads.find(x=>x.index===index);assert.equal(u.initial.length,18432);assert.ok(u.initial.every(x=>x===0));assert.equal(e.lowered.shared[index],false);}const releaseTemp=uploads.initialUploads.find(x=>x.index===cr.tempAllocation);assert.equal(releaseTemp.initial.length,768);assert.ok(releaseTemp.initial.every(x=>x===0));
 const staged=e.lowered.commands.filter(c=>c.kind==='dispatch'&&c.entries.some(x=>x.buffer===t));assert.equal(staged.length,d.receipt.expandedCommands*3);
 for(const c of staged){assert.equal(c.entries[4].buffer,t);assert.equal(c.entries[4].size,6144);const def=e.lowered.definitions[c.definition];assert.match(def.code,/@binding\(4\)/);assert.match(def.code,/@binding\(5\)/);if(c.indirect)assert.match(def.code,/@binding\(6\)/);}
});


test('query descriptors are exact immutable-role uploads shared by N3 without losing candidate-local output guards',async()=>{
 const {queryViewWords}=await import('../src/wasm-gpu/query-view.mjs');
 const e=await engineFor(f,capture,3),q=e.lowered.sourcePlan.queryLowering;
 assert.equal(q.originalSHA256,e.lowered.sourcePlan.cushionLowering.derivedSHA256);assert.equal(q.originalCommands,e.lowered.sourcePlan.cushionLowering.derivedCommands);
 const uploads=prepareWasmGpuWorldUploads({engine:e,bindings:[f.binding,f.binding,f.binding],batches:[f.batch,f.batch,f.batch]});
 const definitions=new Set();
 for(let rail=0;rail<4;rail++){
  const {index,role}=q.descriptors[rail];assert.equal(role,WORLD_QUERY_VIEW_ROLES[rail]);assert.equal(index,e.lowered.sourcePlan.allocations.length-4+rail);
  assert.equal(e.lowered.shared[index],true);assert.deepEqual(new Uint32Array(uploads.initialUploads.find(x=>x.index===index).initial.buffer),queryViewWords(rail));
  const dispatches=e.lowered.commands.filter(c=>c.kind==='dispatch'&&c.entries.some(x=>x.buffer===index));assert.ok(dispatches.length>0);
  for(const c of dispatches){assert.deepEqual(c.entries.find(x=>x.buffer===index),{binding:4,buffer:index,offset:0,size:16});const out=c.entries.find(x=>x.binding===3);assert.equal(e.lowered.shared[out.buffer],false);assert.equal(out.size,12288);assert.equal(out.offset,0);const layout=e.lowered.definitions[c.definition].layout;assert.notEqual(layout,'auto');assert.deepEqual(layout.bindGroupLayouts[0].entries.map(x=>[x.binding,x.buffer.type]),[[0,'read-only-storage'],[1,'read-only-storage'],[2,'read-only-storage'],[3,'storage'],[4,'read-only-storage'],[5,'storage'],[6,'read-only-storage']]);definitions.add(c.definition);}
 }
 assert.equal(definitions.size,2,'all four views share two guarded staged kernels');
});

test('fixed query roles reject missing receipts, relocation, arbitrary bytes and zero-role disguise',()=>{
 const q=capture.plan.queryLowering,{index}=q.descriptors[0];
 const noReceipt={...capture.plan};delete noReceipt.queryLowering;assert.throws(()=>validateWasmGpuWorldUploadManifest(capture.uploadManifest,noReceipt),/Query descriptor/);
 for(const mutate of [p=>p.queryLowering.descriptors[0].index++,p=>p.queryLowering.originalSHA256='0'.repeat(64),p=>p.queryLowering.derivedCommands++,p=>p.queryLowering.descriptors[0].role='query-view-v1:9']){const p=structuredClone(capture.plan);mutate(p);assert.throws(()=>validateWasmGpuWorldUploadManifest(capture.uploadManifest,p),/query descriptor/i);}
 const disguised=structuredClone(capture.uploadManifest);disguised.allocations[index].role='zero';disguised.allocations[index].hostInitialized=false;assert.throws(()=>validateWasmGpuWorldUploadManifest(disguised,capture.plan),/query descriptor/i);
 const changed=structuredClone(capture.plan);changed.allocations[index].initial[0]^=1;assert.throws(()=>buildWasmGpuWorldUploadManifest({...f,plan:changed,metadata:capture.metadata}),/Source-owned upload bytes disagree/);
 const moved=structuredClone(capture.uploadManifest);[moved.allocations[index].role,moved.allocations[index+1].role]=[moved.allocations[index+1].role,moved.allocations[index].role];assert.throws(()=>validateWasmGpuWorldUploadManifest(moved,capture.plan),/query descriptor/i);
});
