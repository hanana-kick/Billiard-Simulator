import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createOriginalPoseFixtures} from './direct-pose-original-fixtures.mjs';
import {createRawPoseBank,decodePose,packRawPoseRows,DIRECT_POSE_PROFILE} from '../src/direct-candidate/raw-pose.mjs';
let source;
test('raw pose native-f32 profile retains source parameters and rejects invalid/unsupported domains',async()=>{
 source=await createOriginalPoseFixtures();const packed=packRawPoseRows(source.fixtures.map(f=>f.input));assert.equal(packed.byteLength,source.fixtures.length*32);
 const rejects=packRawPoseRows(source.rejections.map(f=>f.input));assert.deepEqual([0,1,2,3].map(i=>rejects[i*8+1]),[4,4,8,8]);
 assert.throws(()=>packRawPoseRows([{...source.fixtures[0].input},{...source.fixtures[0].input}]),/Distinct/);
});
test('native raw five-parameter pose/actual cue geometry; shared resident allocation; clearance stays unsupported',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:60000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();let bank;
 try{
  const inputs=[...source.fixtures,...source.rejections].map(f=>f.input);bank=await createRawPoseBank(device,source.scene,inputs);const run=await bank.initialize(),words=await bank.readDiagnostic();assert.deepEqual(await bank.readDiagnostic(),words,'resident state unchanged; no re-upload or recompute');await assert.rejects(bank.initialize(),/already initialized/);
  const errors=[];for(let i=0;i<source.fixtures.length;i++){
   const f=source.fixtures[i],actual=decodePose(words,i),expected=f.expected;assert.equal(actual.id,f.input.id);assert.equal(actual.status,4);assert.equal(actual.reason,6);assert.equal(actual.pass,null);
   let maxError=0;const near=(a,b,label)=>{for(let j=0;j<b.length;j++){const error=Math.abs(a[j]-b[j]);maxError=Math.max(maxError,error);assert.ok(error<=DIRECT_POSE_PROFILE.absoluteTolerance+DIRECT_POSE_PROFILE.relativeTolerance*Math.abs(b[j]),`${f.name} ${label}[${j}] ${a[j]} vs ${b[j]} error ${error}`);}};
   for(const [key,value]of Object.entries(expected.pose))near(actual[key],value,key);
   for(const [field,role]of [['bodyPosition','shaft'],['headPosition','head'],['guidePosition','guide']]){near(actual[field],expected.strike[role].translation,field);near(actual.rotation,expected.strike[role].rotation,role+' rotation');}
   for(const role of ['head','shaft'])near(actual.initialVelocity,expected.strike[role].linear,role+' velocity');
   for(const [field,role]of [['shaftColliderCenter','shaft'],['neckColliderCenter','neck'],['tipColliderCenter','tip']])near(actual[field],expected.strike.colliders[role].translation,field);
   errors.push({name:f.name,maxAbsoluteError:maxError,originalClearance:expected.clearance.clear,directClearance:'unsupported'});
  }
  source.rejections.forEach((f,i)=>{const actual=decodePose(words,i+source.fixtures.length);assert.equal(actual.status,f.directExpected==='invalid-input'?8:4);assert.equal(actual.pass,null);});
  const receipt={profile:DIRECT_POSE_PROFILE,...bank.metrics,...run,adapter:Object.fromEntries(['vendor','architecture','description','isFallbackAdapter'].map(k=>[k,adapter.info[k]])),referenceProvenance:source.provenance,errors,hardwareSpeedClaim:false,productionEnabled:false};t.diagnostic(JSON.stringify(receipt));
  if(process.env.DIRECT_POSE_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DIRECT_POSE_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{bank?.dispose();device.destroy();}
});
test('frozen-budget native pose holdout grid at quadrants and high elevation',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:60000},async t=>{
 const {createOriginalPoseGrid}=await import('./direct-pose-original-fixtures.mjs');const grid=await createOriginalPoseGrid();
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();let bank;
 try{bank=await createRawPoseBank(device,grid.scene,grid.fixtures.map(f=>f.input));const run=await bank.initialize(),words=await bank.readDiagnostic();let maximum={error:0},checked=0;
  for(const [i,f]of grid.fixtures.entries()){const actual=decodePose(words,i);assert.equal(actual.status,4);assert.equal(actual.reason,6);for(const [key,value]of Object.entries(f.expected.pose))for(let j=0;j<value.length;j++){
   const error=Math.abs(actual[key][j]-value[j]);if(error>maximum.error)maximum={error,name:f.name,field:key,component:j,input:f.input};checked++;assert.ok(error<=DIRECT_POSE_PROFILE.absoluteTolerance+DIRECT_POSE_PROFILE.relativeTolerance*Math.abs(value[j]),`${f.name} ${key}[${j}] error ${error}`);
  }}
  const receipt={profile:DIRECT_POSE_PROFILE,count:grid.fixtures.length,checkedScalars:checked,maximum,metrics:bank.metrics,...run,referenceProvenance:grid.provenance,hardwareSpeedClaim:false};t.diagnostic(JSON.stringify(receipt));if(process.env.DIRECT_POSE_GRID_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DIRECT_POSE_GRID_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{bank?.dispose();device.destroy();}
});
