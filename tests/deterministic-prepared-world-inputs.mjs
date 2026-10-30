/** Host-only regression against committed independent pre-extraction digests.
 * No sibling checkout, adapter, shader execution, network or CPU dynamics.
 * Goldens were captured from commit715b503f, never updated by this test.
 * Separately reviewed MMQ2 clear and endpoint-cache deltas are inverted only in
 * test copies; every other source, command, binding and upload stays pinned.
 */
import test from 'node:test';
import {restoreEndpointCacheDelta} from './helpers/reviewed-endpoint-cache-delta.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fixture} from './fixtures/canonical-selected-source.mjs';
import {snapshotCanonicalWorldContinuation} from '../src/direct-candidate/canonical-world-continuation.mjs';
import {snapshotRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {createLiveWorldCaptureDevice} from '../src/direct-candidate/experimental-live-world-capture.mjs';
import {createPreparedPairContinuationGPU} from '../src/direct-candidate/deterministic-prepared-world-gpu.mjs';
import {packCushionHull} from '../src/direct-candidate/deterministic-cushion-geometry.mjs';
import {packPreparedWorldInputs} from '../src/direct-candidate/deterministic-prepared-world-inputs.mjs';
const golden=JSON.parse(await readFile(new URL('./fixtures/prepared-world-input-baseline-digests.json',import.meta.url),'utf8'));
assert.equal(golden.sourceCommit,'715b503f57f6962d99c7a85a787995284960ee8b');
const delta=JSON.parse(await readFile(new URL('./fixtures/prepared-world-input-reviewed-mmq2-module-delta.json',import.meta.url),'utf8'));
assert.equal(delta.kind,'reviewed-prepared-world-module-delta-v1');
assert.equal(delta.baselineCommit,golden.sourceCommit);
assert.equal(delta.case,'mmq2-cushion');
assert.equal(delta.moduleIndex,67);
assert.equal(delta.moduleCount,105);
const sha=x=>createHash('sha256').update(x).digest('hex');
function digestCapture({r}){return {modules:{count:r.modules.length,sha256:sha(JSON.stringify(r.modules.map(m=>({code:m.code,label:m.label}))))},pipelines:{count:r.pipelines.length,sha256:sha(JSON.stringify(r.pipelines.map(p=>({entryPoint:p.entryPoint,layout:p.layout,constants:p.constants,module:p.module.id}))))},commands:{count:r.commands.length,sha256:sha(JSON.stringify(r.commands))},buffers:r.buffers.map(b=>[b.size,b.usage,sha(b.bytes)])};}
const f=fixture(),d=snapshotCanonicalWorldContinuation(f.binding),template=snapshotRawWorldBatch(f.batch).template;
template[1]=f.candidate.candidateId;
const base=()=>({original:template.slice(),scene:d.scene.slice(),hulls:d.hulls.map(x=>x.slice()),options:{...d.options,maxWorldSteps:2,budgets:[...d.options.budgets]}});
async function capture(factory,input){
 const r=createLiveWorldCaptureDevice({allowCushionIndirect:true}),labels=new Map(),create=r.device.createBuffer;
 r.device.createBuffer=desc=>{const b=create(desc);if(desc.label)labels.set(b.id,desc.label);return b;};
 const engine=await factory(r.device,input.hulls,{mixedMotionRevision:input.options.mixedMotionRevision});await engine.run(input.original,input.scene,input.options);
 return {r,labels};
}
const bytes=x=>new Uint8Array(x.buffer,x.byteOffset,x.byteLength);
for(const [name,mutate]of [
 ['default',()=>{}],
 ['mmq2-cushion',x=>{x.options.mixedMotionRevision='mmq2';x.options.enableCushionContinuation=true;}],
 ['shifted-hull-geometry',x=>{const shift=1/1024,Q=2**24;x.scene[7]+=shift*Q;x.scene[8]+=shift*Q;for(let i=0;i<x.scene[16];i++){x.scene[32+6*i]+=shift*Q;x.scene[33+6*i]+=shift*Q;}for(let i=0;i<x.original[2];i++)x.original[36+40*i]+=shift*Q;x.hulls=x.hulls.map(h=>{const v=new Int32Array(h.buffer),vertices=[],indices=[];for(let i=0;i<h[4];i++)vertices.push(v[18+64*i]/Q+shift,v[19+64*i]/Q,v[20+64*i]/Q);for(let i=h[4]+h[5];i<h[3];i++)for(let j=0;j<3;j++)indices.push(h[16+64*i+16+12*j+9]);return packCushionHull({id:h[1],materialId:h[2],vertices,indices});});}],
 ['material',x=>{x.scene[11]=Math.round(.72*2**24);x.scene[12]=Math.round(.08*2**24);x.options.clothRestitution=.12;}],
 ['clock-budget',x=>{x.original[3]+=4096;x.options.deadlineTick+=8192;x.options.durationTicks=8192;x.options.budgets=[4000,4000,25000,25000,25000,25000,25000];x.options.tailMaxNodes=64;x.options.maxWorldSteps=3;}],
 ['finite-static-geometry',x=>{x.scene[16]=1;x.scene.fill(0,32);new Int32Array(x.scene.buffer).set([3,4,3,4,3,4].map(v=>v*2**24),32);}],
 ])test('current '+name+' inputs preserve independent baseline upload bytes and complete source/schedule',async()=>{
 const x=base();mutate(x);const packed=packPreparedWorldInputs(x.original,x.scene,x.hulls,x.options),before=structuredClone(x),current=await capture(createPreparedPairContinuationGPU,x);
 assert.deepEqual(x,before,'packer/factory do not mutate current caller inputs');
 const expectedCapture=golden.cases[name];assert.ok(expectedCapture,'Committed case exists');
 let normalized=current;
 if(name==='mmq2-cushion'){
  const restored=restoreEndpointCacheDelta({definitions:current.r.modules.map(m=>({code:m.code,label:m.label})),commands:current.r.commands,buffers:current.r.buffers.map(b=>({size:b.size,usage:b.usage,bytes:b.bytes})),pipelineModules:current.r.pipelines.map(p=>p.module.id)});
  normalized={r:{...current.r,modules:restored.definitions,commands:restored.commands,buffers:restored.buffers}};
 }
 const actual=digestCapture(normalized);
 if(name===delta.case){
  assert.equal(actual.modules.count,delta.moduleCount);
  assert.equal(actual.modules.sha256,delta.reviewedModulesSHA256,'Reviewed complete current module set');
  assert.equal(sha(normalized.r.modules[delta.moduleIndex].code),delta.reviewedModuleSHA256,'Exactly reviewed replacement module');
  assert.equal(sha(delta.baselineModuleCode),delta.baselineModuleSHA256);
  assert.equal(delta.baselineModulesSHA256,expectedCapture.modules.sha256);
  const restored=normalized.r.modules.map(m=>({code:m.code,label:m.label}));
  restored[delta.moduleIndex].code=delta.baselineModuleCode;
  assert.equal(sha(JSON.stringify(restored)),expectedCapture.modules.sha256,'All other 104 modules and labels retain immutable baseline bytes');
  actual.modules={count:actual.modules.count,sha256:sha(JSON.stringify(restored))};
 }
 assert.deepEqual(actual,{...expectedCapture,buffers:expectedCapture.buffers.map(index=>golden.bufferRecords[index])},'Independent source/layout/command/upload digest parity');
 const expected=['rows','scene','context','recurContext','landingConfig','cloth','tailScene','pairMaterial','iterations','qtSearchConfig','qtFixedConfig'];
 assert.deepEqual([...current.labels.values()].filter(x=>x.startsWith('wasm-input:world:')).sort(),expected.map(n=>'wasm-input:world:'+n).sort());
 for(const [id,label]of current.labels){if(!label.startsWith('wasm-input:world:'))continue;const name=label.slice('wasm-input:world:'.length);assert.deepEqual(current.r.buffers[id].bytes,bytes(packed[name]),label);}
});
test('pure packer snapshots inputs and rejects mismatched revision or invalid settings',()=>{
 const x=base(),p=packPreparedWorldInputs(x.original,x.scene,x.hulls,x.options),originalScene=x.scene.slice();p.scene[11]^=1;assert.deepEqual(x.scene,originalScene);assert.throws(()=>packPreparedWorldInputs(x.original,x.scene,x.hulls,x.options,{revision:'mmq2'}),/revision/);assert.throws(()=>packPreparedWorldInputs(x.original,x.scene,x.hulls,{...x.options,maxWorldSteps:0}),/Bounded/);assert.throws(()=>packPreparedWorldInputs(x.original,x.scene,x.hulls,{...x.options,deadlineTick:x.original[3]-1}),/deadline/);
});
