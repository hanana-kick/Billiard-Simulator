import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import v8 from 'node:v8';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const World=require('../src/experimental-four-ball-world.js');require('../src/inverse-events.js');const O=globalThis.LabInverseEvents.observation;
let seed,record,decoder,fasterSource;
const artifactRoot=path.join(root,'artifacts/inverse-world-observation');
function loadOriginal(file){const original=v8.deserialize(fs.readFileSync(file));assert.equal(original.schema,'original-native-inverse-world-observation-v1');assert.ok(original.sourceHashes);for(const [p,hash]of Object.entries(original.sourceHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),hash,'original source provenance '+p);return original;}
async function faster(){if(fasterSource)return fasterSource;const file=process.env.INVERSE_WORLD_FAST_EVIDENCE??path.join(artifactRoot,'speed45.native.v8');if(!process.env.INVERSE_WORLD_FAST_EVIDENCE){fs.mkdirSync(artifactRoot,{recursive:true});execFileSync(process.execPath,[path.join(root,'tests/inverse-world-observation-native.cjs'),file],{timeout:30000,env:{...process.env,INVERSE_OBSERVATION_SPEED:'4.5'}});}const original=loadOriginal(file);assert.equal(original.settings.speed,4.5);const I=await import('../src/browser-initial-import/live-registered-four-ball.mjs'),imported=await I.importLiveRegisteredFourBall(decoder,original.raw);assert.equal(typeof globalThis.RAPIER,'undefined');assert.equal(typeof globalThis.PhysicsLab,'undefined');return fasterSource={sourceSeed:imported,sourceRecord:original,rollbackSteps:[311,312,374],horizon:original.frames.length-1};}
async function withGpu(t,options){const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice(),release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'inverse-world-observation');try{await run(device,t,options);}finally{release();}}

before(async()=>{
 const file=process.env.INVERSE_WORLD_EVIDENCE??path.join(artifactRoot,'speed2.native.v8');
 if(!process.env.INVERSE_WORLD_EVIDENCE)fs.mkdirSync(artifactRoot,{recursive:true});
 if(!process.env.INVERSE_WORLD_EVIDENCE)execFileSync(process.execPath,[path.join(root,'tests/inverse-world-observation-native.cjs'),file],{timeout:30000});
 record=loadOriginal(file);
 const D=await import('../tools/rapier-snapshot-decoder/browser.mjs'),p=JSON.parse(fs.readFileSync(path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(p.wasmPath)),provenance:p,expectedWasmSha256:p.wasmSha256});
 const I=await import('../src/browser-initial-import/live-registered-four-ball.mjs');seed=await I.importLiveRegisteredFourBall(decoder,record.raw);
 assert.equal(typeof globalThis.RAPIER,'undefined');assert.equal(typeof globalThis.PhysicsLab,'undefined','candidate process cannot run native continuation');
});
let maxima={};
function close(a,b,label){if(typeof b==='number'){const field=label.startsWith('residuals')?'residual':label.includes('.projection.')?'projection':label.includes('.position.')?'position':'other';maxima[field]=Math.max(maxima[field]??0,Math.abs(a-b));assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-6,`${label}: ${a} != ${b}`);}else if(b===null||typeof b!=='object')assert.equal(a,b,label);else{assert.deepEqual(Object.keys(a),Object.keys(b),label);for(const k of Object.keys(b))close(a[k],b[k],label+'.'+k);}}
async function run(device,t,{sourceSeed=seed,sourceRecord=record,rollbackSteps=[],horizon}={}){
 const seed=sourceSeed,record=sourceRecord,checkedRollbacks=[];
 maxima={};
 const Point=require('../src/experimental-convex-point.js'),module=require.cache[require.resolve('../src/experimental-convex-point.js')];let fail=false,rollbackChecked=false;
 module.exports={...Point,queryReference(input){if(fail)throw Error('injected inverse observation failure');return Point.queryReference(input);},async createGpuQueries(d){const q=await Point.createGpuQueries(d);return{...q,async queryBatch(input){const result=await q.queryBatch(input);if(fail)throw Error('injected inverse observation failure');return result;}};}};
 const world=await (device?World.createGpuStepper(device,seed,{observeInverse:true}):World.createReferenceStepper(seed,{observeInverse:true})),expected=O.create({events:[{kind:'object',id:3},{kind:'object',id:4}]},record.sourceStart),actual=O.create({events:[{kind:'object',id:3},{kind:'object',id:4}]},record.sourceStart);
 module.exports=Point;
 const max=horizon??Number(process.env.INVERSE_WORLD_MAX_H??record.frames.length-1);let saved=world.snapshot().inverseObservation;
 try{
  close(saved,record.frames[0],'initial');O.initial(actual,saved);O.initial(expected,record.frames[0]);
  const initial=world.snapshot();fail=true;await assert.rejects(world.step(),/inverse observation failure/);assert.deepEqual(world.snapshot(),initial,'cue-present failed transaction publishes neither state nor receipt');fail=false;
  for(let h=1;h<=Math.min(max,record.frames.length-1);h++){
   if(!rollbackChecked&&!world.snapshot().cue.present){const before=world.snapshot();fail=true;await assert.rejects(world.step(),/inverse observation failure/);assert.deepEqual(world.snapshot(),before,'post-cue failed transaction publishes neither state nor receipt');fail=false;rollbackChecked=true;}
   if(rollbackSteps.includes(h)){const before=world.snapshot(),priorReceipt=before.inverseObservation,priorActual=structuredClone(actual);fail=true;for(let attempt=0;attempt<2;attempt++){await assert.rejects(world.step(),/inverse observation failure/);assert.deepEqual(world.snapshot(),before,'failed retained-flight observation leaves complete commit unchanged h'+h);assert.deepEqual(world.snapshot().inverseObservation,priorReceipt,'no speculative inverse receipt h'+h);assert.deepEqual(actual,priorActual,'consumer receives only successful commits');}fail=false;checkedRollbacks.push(h);}
   let out;try{out=await world.step();}catch(error){error.message='h'+h+': '+error.message;throw error;}const receipt=out.inverseObservation;assert.equal(receipt.sequence,h);assert.equal(receipt.time,record.frames[h].time,'source double clock + native f32 dt');assert.equal(receipt.stepDt,record.frames[h].stepDt);
   close(receipt,record.frames[h],'h'+h);assert.ok(Object.isFrozen(receipt));O.step(actual,receipt);O.step(expected,record.frames[h]);
   assert.deepEqual(actual.events,expected.events,'original impulse episode sequence');assert.equal(actual.eventPrefix,expected.eventPrefix);close(actual.stageResiduals,expected.stageResiduals,'residuals'+h);assert.deepEqual(actual.mismatch,expected.mismatch);
   if(rollbackSteps.length&&h===311){assert.equal(out.balls[0].state.topology.active,false);assert.equal(!!out.pairs.find(p=>p.key==='02').pair.pairPresent,true);assert.equal(!!out.pairs.find(p=>p.key==='02').pair.pointPresent,false);assert.equal(receipt.objects.find(o=>o.id===3).impact,false);}
   if(rollbackSteps.length&&h===312)assert.equal(!!out.pairs.find(p=>p.key==='02').pair.pairPresent,false);
   if(h===1)saved=receipt;
   if(h%100===0)t.diagnostic(JSON.stringify({backend:device?'webgpu':'cpu-reference',h}));
  }
  assert.equal(saved.sequence,1,'prior detached committed receipt is stable');
  if(max>=record.frames.length-1){assert.equal(rollbackChecked,true);assert.ok(actual.events.filter(e=>e.id===3).length>=2);assert.equal(actual.mismatch.actual.id,3);}
  assert.deepEqual(checkedRollbacks,rollbackSteps.filter(h=>h<=max));const result={backend:device?'webgpu':'cpu-reference',settings:record.settings,receipts:Math.min(max,record.frames.length-1),events:actual.events,maxAbsoluteErrors:maxima,postCueOriginalOuter:record.postCue,twiceRetriedFailureBoundaries:checkedRollbacks,sourceHashes:record.sourceHashes};if(process.env.INVERSE_WORLD_RESULT_DIR){fs.mkdirSync(process.env.INVERSE_WORLD_RESULT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.INVERSE_WORLD_RESULT_DIR,'speed'+record.settings.speed+'-'+result.backend+'.json'),JSON.stringify(result,null,2)+'\n');}t.diagnostic(JSON.stringify(result));
 }finally{world.dispose();}
}
test('committed four-ball reference receipts preserve original native episodes and residuals',{timeout:240000},async t=>run(null,t));
test('actual GPU committed receipts preserve original native episodes and residuals',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:600000},async t=>withGpu(t));
test('opt-out has no observation queries; failed observation transaction publishes no receipt',async()=>{
 await assert.rejects(World.createReferenceStepper(seed,{observeInverse:'true'}),/boolean observeInverse/);
 await assert.rejects(World.createReferenceStepper(seed,{onObservation(){}}),/boolean observeInverse/);
 const Point=require('../src/experimental-convex-point.js'),module=require.cache[require.resolve('../src/experimental-convex-point.js')];let queries=0,fail=false;
 module.exports={...Point,queryReference(input){queries++;if(fail)throw Error('injected observer query failure');return Point.queryReference(input);}};
 let off,on;
 try{
  off=await World.createReferenceStepper(seed);const off0=off.snapshot();assert.equal(Object.hasOwn(off0,'inverseObservation'),false);await off.step();assert.equal(queries,0,'no opt-in projection module calls');off.dispose();off=null;
  on=await World.createReferenceStepper(seed,{observeInverse:true});assert.equal(queries,4);const before=on.snapshot();fail=true;await assert.rejects(on.step(),/observer query failure/);assert.deepEqual(on.snapshot(),before,'failed transaction leaves prior receipt/state unchanged');fail=false;const after=await on.step();assert.equal(after.inverseObservation.sequence,1);close(after.inverseObservation,record.frames[1],'retry');
 }finally{off?.dispose();on?.dispose();module.exports=Point;}
});

test('legitimate faster return reference receipts remain commit-only across retained-cloth departure',{timeout:240000},async t=>run(null,t,await faster()));
test('legitimate faster return GPU receipts remain commit-only across retained-cloth departure',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:600000},async t=>withGpu(t,await faster()));
