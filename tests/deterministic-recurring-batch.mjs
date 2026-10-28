import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {packCushionHull} from '../src/direct-candidate/deterministic-cushion-geometry.mjs';
import {packDirectionalCandidates} from '../src/direct-candidate/deterministic-directional-event.mjs';
import {runRecurringLoopCPU} from '../src/direct-candidate/deterministic-recurring-loop.mjs';
import {recurringWords} from '../src/direct-candidate/deterministic-recurring-gpu.mjs';
import {runRecurringBatchCPU,snapshotRecurringBatch,RECURRING_DIAGNOSTIC_WORDS} from '../src/direct-candidate/deterministic-recurring-batch.mjs';
import {createRecurringBatchGPU} from '../src/direct-candidate/deterministic-recurring-batch-gpu.mjs';
import {verifyRecurringBatchSources} from '../src/direct-candidate/deterministic-recurring-batch-audit.mjs';
import {recurringBatchPhaseSpecs,liftCandidatePhase} from '../src/direct-candidate/deterministic-recurring-batch-phases.mjs';
const require=createRequire(import.meta.url),RAPIER=require('../vendor/rapier.cjs');await RAPIER.init();require('../src/math.js');require('../src/physics.js');
const lab=new PhysicsLab(RAPIER),hulls=lab.statics.filter(x=>x.kind==='cushion').map((h,i)=>packCushionHull({id:i,vertices:h.vertices,indices:h.indices})),staticBounds=lab.statics.filter(x=>!['cushion','cloth'].includes(x.kind)).map(x=>x.shape==='box'?[[x.pos.x-x.half.x,x.pos.x+x.half.x],[x.pos.y-x.half.y,x.pos.y+x.half.y],[x.pos.z-x.half.z,x.pos.z+x.half.z]]:[0,1,2].map(d=>{const v=x.vertices.filter((_,i)=>i%3===d);return [Math.min(...v),Math.max(...v)];}));lab.dispose();
const Q=2**24,T=2**20,R=.03075,sceneDefinition={motionMaterial:{gravity:9.81,clothFriction:.2,rollingLength:.00045,spinLength:.00035},provenance:'prepared-finite-cloth-and-static-bounds',ballCount:4,radius:R,mass:.21,y:R,z:0,clothTop:0,clothFootprint:[-1.42,1.42,-.71,.71],restitution:.8,pairFriction:.2,clothFriction:.2,staticBounds};
const opts={durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],clothRestitution:0,cycles:1,continuationTicks:2000,maxPrefixes:40,executionProfile:'canonical-local-v1',diagnostic:'all-words'};
function fixture(){const e=[Math.cos(.47),Math.sin(.47)],point=(t,s=0)=>[e[0]*t-e[1]*s,e[1]*t+e[0]*s],body=(p,speed=0,surfaceSpeed=0,d=e)=>({position:[p[0],R,p[1]],direction:d,speed,surfaceSpeed,radius:R,mass:.21});return packDirectionalCandidates([{id:1,provenance:'prepared-supported-collinear-direction',horizonTicks:Math.floor(.04*T),clothRestitution:0,bodies:[body([0,0],.8,-1.5),body(point(.08,.01),.1,-.5),body(point(-.2),.12,-.3,[-e[1],e[0]]),body(point(.8))]}],sceneDefinition);}
const base=fixture();
function batch(n){const rows=new Uint32Array(n*96);for(let i=0;i<n;i++){rows.set(base.rows,i*96);rows[i*96]=0xf0000000+i;const r=new Int32Array(rows.buffer),b=i*96;if(i%3===1)r[b+16]=Math.round(1.419*Q); // valid input, physical geometry rejection
 if(i%3===2)rows[b+4]=1; // valid input, directional query budget failure
 }return rows;}
function offsetView(words){const storage=new Uint32Array(words.length+16);storage.fill(0xa5a5a5a5);storage.set(words,7);return storage.subarray(7,7+words.length);}
function reference(rows,options){const output=new Uint32Array(rows.length/96*RECURRING_DIAGNOSTIC_WORDS);for(let i=0;i<rows.length/96;i++)output.set(recurringWords(runRecurringLoopCPU(rows.subarray(i*96,(i+1)*96),base.scene,hulls,options)),i*RECURRING_DIAGNOSTIC_WORDS);return output;}
test('all phase bindings have explicit ownership and no shared mutable state',async()=>{
 for(const count of [3,4]){const specs=recurringBatchPhaseSpecs(count);assert.equal(await verifyRecurringBatchSources(specs),true);assert.equal(specs.length,34);for(const s of specs){assert.match(s.code,/var<private> batchCandidate:u32/);assert.match(s.code,/batchCandidate=\w+\.y/);assert.doesNotMatch(s.code,/var<workgroup>/);}}
 const drift=recurringBatchPhaseSpecs(4);drift[0]={...drift[0],source:drift[0].source+'// unaudited drift'};await assert.rejects(verifyRecurringBatchSources(drift),/renewed local-address audit/);
 const shader='@group(0) @binding(0) var<storage,read_write> x:array<u32>;@compute @workgroup_size(1) fn main(){x[0]=x[1];}';
 assert.throws(()=>liftCandidatePhase(shader,[null]),/writable/);assert.throws(()=>liftCandidatePhase('var<workgroup> a:u32;'+shader,[2]),/shared-state audit/);assert.throws(()=>liftCandidatePhase(shader,[]),/shape/);
 assert.throws(()=>liftCandidatePhase('fn surprise(x:u32)->u32{return x;}'+shader,[2]),/shadow/);
 assert.throws(()=>liftCandidatePhase(shader.replace('@workgroup_size(1)','@workgroup_size(1,2)'),[2]),/one-dimensional/);
 assert.throws(()=>liftCandidatePhase(shader.replace('fn main(){','fn main(@builtin(global_invocation_id) id:vec3<u32>){let y=id.y;'),[2]),/x only/);
 assert.throws(()=>liftCandidatePhase(shader.replace('fn main(){','fn main(@builtin(global_invocation_id) id:vec3<u32>, @builtin(local_invocation_index) lane:u32){'),[2]),/audit|arguments/);
 assert.throws(()=>liftCandidatePhase('@group(1) @binding(0) var<storage,read> other:array<u32>;'+shader,[2]),/Unclassified/);
 for(const name of ['batchCandidate','batchInvocation','batchLocal_input'])assert.throws(()=>liftCandidatePhase(shader.replace('fn main(){',`fn main(){let ${name}=0u;`),[2]),/Reserved/);
 assert.match(liftCandidatePhase(shader,[2]),/x\[batchCandidate\*2u\+0u\+u32\(0\)\]/);
});
test('CPU batch exactly uses single candidate model, IDs, offsets and independent failures',()=>{
 const rows=offsetView(batch(3)),scene=offsetView(base.scene),r=runRecurringBatchCPU(rows,scene,hulls,opts);assert.deepEqual(r.words,reference(rows,opts));
 assert.deepEqual([...r.compact.filter((_,i)=>i%4===0)],[0xf0000000,0xf0000001,0xf0000002]);assert.equal(r.compact[1],9);assert.equal(r.compact[3],1);assert.notEqual(r.compact[5],9);assert.notEqual(r.compact[9],9);
 assert.equal(r.envelope.gameplayVerdict,'not-evaluated');assert.equal(r.envelope.physicalRestCertified,false);assert.equal(r.envelope.globalReceiptCertified,false);
 const compact=runRecurringBatchCPU(batch(1),base.scene,hulls,{...opts,diagnostic:undefined});assert.equal(compact.words,undefined);assert.equal(compact.compact.length,4);
 const permutation=new Uint32Array([...rows.slice(192),...rows.slice(0,96),...rows.slice(96,192)]),pr=runRecurringBatchCPU(permutation,base.scene,hulls,opts);for(const [i,old]of [2,0,1].entries())assert.deepEqual(pr.words.slice(i*2096,(i+1)*2096),r.words.slice(old*2096,(old+1)*2096));
});
test('validation, snapshot, large candidate counts and cancellation are fail closed',()=>{
 const rows=batch(129);assert.equal(snapshotRecurringBatch(rows,base.scene,opts).count,129);
 const duplicate=batch(2);duplicate[96]=duplicate[0];assert.throws(()=>snapshotRecurringBatch(duplicate,base.scene,opts),/Unique/);
 assert.throws(()=>snapshotRecurringBatch(batch(1).subarray(1),base.scene,opts),/complete/);
 assert.throws(()=>snapshotRecurringBatch(batch(1),base.scene,{...opts,diagnostic:'partial'}),/Diagnostic/);
 const controller=new AbortController();controller.abort();assert.throws(()=>runRecurringBatchCPU(batch(1),base.scene,hulls,{...opts,signal:controller.signal}),{name:'AbortError'});
 const snap=snapshotRecurringBatch(batch(1),base.scene,opts);snap.options.budgets[0]=1;assert.equal(opts.budgets[0],2000);
});
test('host schedule is N-independent and allocation/readback manifests are exact',async()=>{
 const calls=[];let submissions=0;const device={limits:{maxComputeWorkgroupsPerDimension:65535,maxBufferSize:2**30,maxStorageBufferBindingSize:2**30},pushErrorScope(){},async popErrorScope(){return null;},createBindGroupLayout(){return {};},createPipelineLayout(){return {};},createShaderModule(){return {async getCompilationInfo(){return {messages:[]};}};},async createComputePipelineAsync(){return {getBindGroupLayout(){return {};}};},createBindGroup(){return {};},createBuffer({size}){let memory;return {size,async mapAsync(){memory=new ArrayBuffer(size);},getMappedRange(){return memory;},unmap(){},destroy(){}};},createCommandEncoder(){return {beginComputePass(){return {setPipeline(){},setBindGroup(){},dispatchWorkgroups(x,y){calls.push([x,y]);},end(){}};},clearBuffer(){},copyBufferToBuffer(){},finish(){return {};}};},queue:{writeBuffer(){},submit(){submissions++;},async onSubmittedWorkDone(){}}};
 const engine=await createRecurringBatchGPU(device,hulls);
 for(const n of [1,33,129]){calls.length=0;const r=await engine.run(batch(n),base.scene,{...opts,maxPrefixes:1});assert.equal(r.metrics.dispatches,88);assert.equal(calls.length,88);assert.equal(calls.filter(x=>x[1]===n).length,n===1?88:87);assert.equal(r.metrics.readbackBytes,n*8400);assert.equal(r.metrics.allocatedBytes,67432*n+r.metrics.sharedImmutableBytes);}
 const compact=await engine.run(batch(1),base.scene,{...opts,maxPrefixes:1,diagnostic:undefined});assert.equal(compact.metrics.dispatches,87);assert.equal(compact.metrics.allocatedBytes,50664+compact.metrics.sharedImmutableBytes);assert.equal(submissions,4);
 await assert.rejects(engine.run(batch(6000),base.scene,{...opts,maxPrefixes:1,diagnostic:undefined}),/256 MiB/);assert.equal(submissions,4);
});
test('native candidate-parallel recurrence is exact across widths, failures and permutations',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:240000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();
 try{const engine=await createRecurringBatchGPU(device,hulls),timings=[];let compared=0;
  const cases=[...([1,3,31,32,33].map(n=>({n,options:{...opts,maxPrefixes:1}}))),{n:3,options:opts},{n:3,options:{...opts,executionProfile:'strict-carried-v1'}},{n:3,options:{...opts,tailMaxNodes:1}}];
  let full;
  for(const c of cases){const rows=offsetView(batch(c.n)),cpu=runRecurringBatchCPU(rows,offsetView(base.scene),hulls,c.options),result=await engine.run(rows,offsetView(base.scene),c.options);assert.deepEqual(result.words,cpu.words,`${c.n}/${c.options.executionProfile}/${c.options.maxPrefixes}/${c.options.tailMaxNodes}`);assert.deepEqual(result.compact,cpu.compact);assert.equal(result.metrics.dispatches,22+66*c.options.maxPrefixes);assert.equal(result.metrics.bufferClears,9*c.options.maxPrefixes);assert.equal(result.metrics.intermediateReadbacks,0);assert.equal(result.metrics.submissions,1);compared+=cpu.words.length;timings.push(result.metrics);if(c.options===opts)full=result;}
  const rows=batch(3),permutation=new Uint32Array([...rows.slice(192),...rows.slice(0,96),...rows.slice(96,192)]),permuted=await engine.run(permutation,base.scene,opts);for(const [i,old]of [2,0,1].entries())assert.deepEqual(permuted.words.slice(i*2096,(i+1)*2096),full.words.slice(old*2096,(old+1)*2096));compared+=permuted.words.length;
  const compact=await engine.run(batch(33),base.scene,{...opts,maxPrefixes:1,diagnostic:undefined});assert.equal(compact.words,undefined);assert.equal(compact.metrics.readbackBytes,33*16);assert.equal(compact.metrics.dispatches,87);
  const controller=new AbortController(),pending=engine.run(batch(3),base.scene,{...opts,maxPrefixes:1,signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
  const recovered=await engine.run(batch(1),base.scene,{...opts,maxPrefixes:1});assert.deepEqual(recovered.words,reference(batch(1),{...opts,maxPrefixes:1}));
  const scaleMetrics=[];
  if(process.env.BATCH_SCALE==='1')for(const [n,diagnostic]of [[1024,'all-words'],[2048,undefined]]){const options={...opts,maxPrefixes:1,diagnostic},rows=batch(n),began=performance.now(),cpu=runRecurringBatchCPU(rows,base.scene,hulls,options),cpuMs=performance.now()-began,result=await engine.run(rows,base.scene,options);assert.deepEqual(result.compact,cpu.compact);if(diagnostic){assert.deepEqual(result.words,cpu.words);compared+=cpu.words.length;}assert.equal(result.metrics.dispatches,diagnostic?88:87);scaleMetrics.push({...result.metrics,cpuMs,diagnostic:diagnostic??'compact-only',allCandidatesCompared:true,fullRestThroughput:false});}
  const receipt={cases:cases.length+4+scaleMetrics.length,comparedWords:compared,scaleMetrics,compileMs:engine.compileMs,timings,compactMetrics:compact.metrics};t.diagnostic(JSON.stringify(receipt));if(process.env.BATCH_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.BATCH_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
