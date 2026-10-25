'use strict';
// Original WASM oracle assertions for a SINGLE source-prepared numerical h.
// No captured future state is admitted to the candidate world runtime.
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const H=require('./coupled-contact-native-helper.cjs'),M=require('../src/experimental-coupled-contact-math');
const enabled=Boolean(process.env.COUPLED_FOUR_NATIVE_V8&&process.env.COUPLED_CONTACT_NATIVE_PROBE&&process.env.COUPLED_CONTACT_NATIVE_PROVENANCE);
let record,fixture,want;
before(()=>{if(!enabled)return;record=H.loadOriginal(process.env.COUPLED_FOUR_NATIVE_V8);fixture=H.prepare(record,H.capturePrepared(record,process.env.COUPLED_CONTACT_NATIVE_PROBE,process.env.COUPLED_CONTACT_NATIVE_PROVENANCE));want=H.expected(record,fixture);});
function compare(actual,expected,label,max){assert.equal(actual.length,expected.length);for(let i=0;i<expected.length;i++){const error=Math.abs(actual[i]-expected[i]);if(error>max.value){max.value=error;max.field=label+'['+i+']';}assert.ok(Number.isFinite(actual[i])&&error<=2e-6*Math.max(1,Math.abs(expected[i])),`${label}[${i}]: ${actual[i]} vs original ${expected[i]}, error ${error}`);}}
function check(out,t,backend){
 const max={value:0,field:null};
 for(let i=0;i<want.bodies.length;i++)compare(out['body'+i],want.bodies[i],'body'+fixture.handles[i].index,max);
 for(let i=0;i<want.contacts.length;i++)compare(out['contact'+i],want.contacts[i],'edge'+fixture.ordered[i].edge,max);
 t.diagnostic(JSON.stringify({backend,scope:fixture.scope,originalH:555,originalWorldBallCount:4,activeBodyCount:3,sourceBodyHandles:fixture.handles.map(h=>h.index),nativeBucketEdges:fixture.ordered.map(x=>x.edge),nativeColors:fixture.ordered.map(x=>x.color),preWorldSha256:record.pre.snapshotSha256,originalPostWorldSha256:record.post.snapshotSha256,sourceProbePostSha256:fixture.source.nativePostSha256,sourceProbeMatchesOriginalFullBytes:fixture.nativePostMatchesOriginalBytes,sourceProvenanceSha256:fixture.provenanceSha256,maxAbsoluteError:max.value,maxField:max.field,tolerance:2e-6}));
}
test('source-prepared coupled component matches independent original WASM h555',{skip:!enabled,timeout:60000},t=>{
 const stage=M.createReferenceMathStage(fixture.config);try{check(stage.step(fixture.input),t,'cpu-reference');}finally{stage.dispose();}
});
test('actual WGSL source-prepared coupled component matches independent original WASM h555',{skip:!enabled||(!process.env.GPU_NATIVE_MODULE&&process.env.REQUIRE_WEBGPU!=='1'),timeout:120000},async t=>{
 assert.ok(process.env.GPU_NATIVE_MODULE);assert.equal(process.env.COUPLED_CONTACT_SERIAL_SLOT,'1');
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice(),release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'coupled-contact-native-h555');
 try{const stage=await M.createGpuMathStage(device,fixture.config);try{check(await stage.step(fixture.input),t,'webgpu');}finally{stage.dispose();}}finally{release();}
});
