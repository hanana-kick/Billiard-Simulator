// Genuine numerical-world producer, with original expected outcomes assertion-only.
import assert from 'node:assert/strict';
import fs from 'node:fs';import v8 from 'node:v8';import path from 'node:path';import crypto from 'node:crypto';
import {createRequire} from 'node:module';import {fileURLToPath,pathToFileURL} from 'node:url';
import {createFourBallPhysicalScoring} from '../src/experimental-four-ball-physical-scoring.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
const file=process.env.PHYSICAL_SCORING_ORIGINAL;assert.ok(file,'PHYSICAL_SCORING_ORIGINAL points to isolated original producer artifact');
const record=v8.deserialize(fs.readFileSync(file));assert.equal(record.schema,'original-four-ball-physical-scoring-v1');
for(const [p,hash]of Object.entries(record.sourceHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),hash,'original source '+p);
const D=await import('../tools/rapier-snapshot-decoder/browser.mjs'),p=JSON.parse(fs.readFileSync(path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
const decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(p.wasmPath)),provenance:p,expectedWasmSha256:p.wasmSha256});
const I=await import('../src/browser-initial-import/live-registered-four-ball.mjs'),seed=await I.importLiveRegisteredFourBall(decoder,record.raw);
globalThis.LabDimensions=Object.freeze(structuredClone(record.dimensions));
for(const n of ['math','game-rules','route-rules','optimizer-core'])require('../src/'+n);
assert.equal(typeof globalThis.PhysicsLab,'undefined');assert.equal(Object.keys(require.cache).some(p=>/vendor\/rapier|@dimforge\/rapier/.test(p)),false,'no native engine in numerical replay');
const World=require('../src/experimental-four-ball-world');let device,release;
if(process.env.REQUIRE_WEBGPU==='1'){
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE??'/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js'));Object.assign(globalThis,globals);
 process.env.VK_ICD_FILENAMES??='/usr/lib/chromium/vk_swiftshader_icd.json';const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);device=await adapter.requestDevice();release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'physical-scoring');
}
let world;
let maxAbsolute=0,comparisons=0,lastFrame=0,lastOuter=0;
function compare(actual,expected,at){
 if(typeof expected==='number'&&Number.isFinite(expected)){
  assert.equal(typeof actual,'number',at);const d=Math.abs(actual-expected);maxAbsolute=Math.max(maxAbsolute,d);assert.ok(d<=3e-6,`${at}: ${actual} != ${expected} (${d})`);comparisons++;return;
 }
 if(expected&&typeof expected==='object'){
  if(expected instanceof Map){assert.ok(actual instanceof Map);assert.deepEqual([...actual.keys()],[...expected.keys()]);for(const [k,v]of expected)compare(actual.get(k),v,at+'.map'+k);return;}
  assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),at+' keys');for(const k of Object.keys(expected))compare(actual[k],expected[k],at+'.'+k);return;
 }
 assert.equal(actual,expected,at);
}
try{
 world=await(device?World.createGpuStepper(device,seed):World.createReferenceStepper(seed));
 const initial=world.snapshot(),consumer=createFourBallPhysicalScoring({seed,initial,request:record.request,admission:record.admission});
 assert.throws(()=>createFourBallPhysicalScoring({seed,initial,request:record.request}),/admission/);
 assert.throws(()=>consumer.finish(),/partial/);
 const maxH=Number(process.env.PHYSICAL_SCORING_MAX_H??20000);let outcome;
 for(let h=0;h<maxH;h++){
  const state=await world.step();lastFrame=state.frame;
  outcome=consumer.consume(state);
  if(outcome.outerStep!==lastOuter){
   lastOuter=outcome.outerStep;const expected=record.expected.frames[lastOuter-1];assert.ok(expected,'original outer trace available');
   assert.equal(state.time,expected.time,'exact absolute clock');assert.equal(outcome.done,expected.done,'original stopping boundary');
   compare(consumer.diagnostics().accumulator,expected.accumulator,'outer'+lastOuter);
  }
  if(state.frame%256===0||outcome.done)console.log(JSON.stringify({backend:device?'webgpu':'cpu-reference',h:state.frame,outer:lastOuter,done:outcome.done,maxAbsolute,comparisons,memory:process.memoryUsage(),maxRssKiB:process.resourceUsage().maxRSS}));
  if(outcome.done)break;
 }
 const report={schema:'numerical-world-physical-scoring-v1',backend:device?'webgpu':'cpu-reference',initialSnapshotSha256:seed.initialSnapshotSha256,frame:lastFrame,outerStep:lastOuter,done:outcome.done,maxAbsolute,comparisons,memory:process.memoryUsage(),maxRssKiB:process.resourceUsage().maxRSS};
 if(outcome.done){const result=consumer.finish();compare(result,record.expected.result,'final');report.result=result;report.maxAbsolute=maxAbsolute;report.comparisons=comparisons;}
 else assert.throws(()=>consumer.finish(),/partial/);
 if(process.env.PHYSICAL_SCORING_REPORT)fs.writeFileSync(process.env.PHYSICAL_SCORING_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{world?.dispose();release?.();}
