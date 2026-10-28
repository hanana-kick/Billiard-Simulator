import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {packCueShared,packCueComponents,decodeCueComponent,NO_PASS} from '../src/direct-candidate/layout.mjs';
import {generateDirectCueWGSL,evaluateCueSliceF32ForTest,CUE_SLICE_PRECISION} from '../src/direct-candidate/cue-slice.mjs';
import {createDirectCueComponent} from '../src/direct-candidate/cue-runner.mjs';
import {createOriginalCueFixtures} from './direct-cue-original-fixtures.mjs';
const tolerance=CUE_SLICE_PRECISION.observableTolerance;
export function compareCueObservation(actual,expected,label){
 const max={linear:0,angular:0,tangent:0};
 for(const key of ['contacted','birthMask','obstructionMask','removeCue'])assert.equal(actual[key],expected[key],label+' '+key);
 for(const [i,body] of [...actual.balls,actual.head,actual.shaft].entries()){
  const ref=[...expected.balls,expected.head,expected.shaft][i];
  for(const key of ['linear','angular'])for(let j=0;j<3;j++){
   const error=Math.abs(body[key][j]-ref[key][j]),allowed=tolerance[key+'Absolute']+tolerance.relative*Math.abs(ref[key][j]);
   max[key]=Math.max(max[key],error);assert.ok(error<=allowed,`${label} body ${i} ${key}[${j}] error ${error} > ${allowed} (${body[key][j]} vs ${ref[key][j]})`);
  }
 }
 actual.contacts.forEach((c,i)=>{const ref=expected.contacts[i];assert.equal(c.active,ref.active,label+' contact '+i);if(ref.sliding!==undefined)assert.equal(c.sliding,ref.sliding,label+' sliding '+i);for(let j=0;j<3;j++){const error=Math.abs(c.tangent[j]-ref.tangent[j]);max.tangent=Math.max(max.tangent,error);assert.ok(error<=tolerance.tangentAbsolute+tolerance.relative*Math.abs(ref.tangent[j]),`${label} tangent ${i}/${j}: ${error}`);}});
 assert.equal(actual.status,5);assert.equal(actual.reason,6);assert.equal(actual.pass,null);
 return max;
}
let fixtures;
test('fresh original PhysicsLab/Rapier call boundaries match direct f32 component',async t=>{
 fixtures=await createOriginalCueFixtures();assert.ok(fixtures.length>=5);
 for(const f of fixtures){const actual=decodeCueComponent(evaluateCueSliceF32ForTest(packCueShared(f.material),packCueComponents([f.input]),{testOnly:true}));t.diagnostic(JSON.stringify({name:f.name,maxError:compareCueObservation(actual,f.expected,f.name)}));}
});
test('bounded ABI, no interpreter, explicit unsupported transactional rejection',()=>{
 assert.ok(fixtures);const f=fixtures[0],shared=packCueShared(f.material),input=packCueComponents([f.input]);
 assert.equal(shared.byteLength,64);assert.equal(input.byteLength,1024);
 assert.throws(()=>evaluateCueSliceF32ForTest(shared,input),/TEST-ONLY/);
 assert.doesNotMatch(generateDirectCueWGSL(),/\bactive\b|bytecode|microcode/);
 for(const change of [row=>row[6]=3,row=>new Float32Array(row.buffer)[16]=NaN]){const row=input.slice();change(row);const out=evaluateCueSliceF32ForTest(shared,row,{testOnly:true});assert.equal(out[1],4);assert.equal(out[2],14);assert.equal(out[3],NO_PASS);assert.deepEqual(out.slice(32),row.slice(32));}
 const near=input.slice(),v=new Float32Array(near.buffer),m=new Float32Array(shared.buffer);v.set(v.slice(160,163),32);v[32]+=v[58]+m[0];
 const result=evaluateCueSliceF32ForTest(shared,near,{testOnly:true});assert.equal(result[1],4);assert.equal(result[2],13);assert.deepEqual(result.slice(32),near.slice(32));
});
test('tiny native WGSL batch: compact output, independent candidates, original observables',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:60000},async t=>{
 assert.ok(fixtures);assert.ok(process.env.GPU_NATIVE_MODULE,'Explicit trusted native module path required');
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter,'Native Vulkan adapter required');const device=await adapter.requestDevice();
 try{
  const component=await createDirectCueComponent(device),shared=packCueShared(fixtures[0].material);
  fixtures.forEach(f=>assert.deepEqual(packCueShared(f.material),shared,'Shared immutable material required'));
  const rows=packCueComponents(fixtures.map((f,i)=>({...f.input,id:i}))),first=await component.run(shared,rows,{diagnosticReadback:true});
  const errors=fixtures.map((f,i)=>({name:f.name,maxError:compareCueObservation(decodeCueComponent(first.diagnostic,i),f.expected,f.name)}));
  for(let i=0;i<fixtures.length;i++)assert.deepEqual(Array.from(first.compact.slice(i*4,i*4+4)),[i,5,NO_PASS,6]);
  // Mutating one candidate must not alter any other candidate's physical result.
  const changed=rows.slice();changed[6]=3;const isolated=await component.run(shared,changed,{diagnosticReadback:true});
  assert.deepEqual(isolated.diagnostic.slice(256),first.diagnostic.slice(256));assert.deepEqual(Array.from(isolated.compact.slice(0,4)),[0,4,NO_PASS,14]);
  const compactOnly=await component.run(shared,rows);assert.equal(compactOnly.diagnostic,null);assert.deepEqual(compactOnly.compact,first.compact);
  const receipt={profile:CUE_SLICE_PRECISION.profile,adapter:Object.fromEntries(['vendor','architecture','device','description','isFallbackAdapter'].map(k=>[k,adapter.info[k]])),backend:'Vulkan (adapter identity reported above)',referenceProvenance:fixtures[0].provenance,shaderBytes:component.shaderBytes,compactShaderBytes:component.compactShaderBytes,compileMs:component.compileMs,diagnostic:first.metrics,compactOnly:compactOnly.metrics,errors,originalObservations:true,fullShot:false,productionEnabled:false};
  t.diagnostic(JSON.stringify(receipt));if(process.env.DIRECT_CUE_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DIRECT_CUE_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
