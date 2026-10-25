'use strict';
// SPDX-License-Identifier: Apache-2.0
// Native source outputs are assertions only, never runtime state/fallback input.
const {test}=require('node:test'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const M=require('../src/experimental-ccd-sweep-math'),prediction=require('./fixtures/active-ccd/original-e35-prediction.json');
const REVISION='b716d375efc0201003f0cd9ef7168eee0b62c177';
const symmetric=m=>[m.m11,m.m12,m.m13,m.m12,m.m22,m.m23,m.m13,m.m23,m.m33];
const bits=a=>Array.from(new Uint32Array(Float32Array.from(a).buffer));
const input=row=>({rotation:row.rotation.slice(),principalFrame:row.principalFrame.slice(),invPrincipalInertia:row.invPrincipalInertia.slice()});
// The two post-advance rows are copied from the pinned native source capture,
// not calculated with JS. Capture SHA256 and extraction paths are in the doc.
const nativeRows=[
 {id:'original-e35-before-split-body-16',rotation:prediction.position.rotation,principalFrame:prediction.massProperties.local_mprops.principal_inertia_local_frame,invPrincipalInertia:prediction.massProperties.local_mprops.inv_principal_inertia,expected:symmetric(prediction.massProperties.effective_world_inv_inertia)},
 {id:'original-e35-pass-1-body-16',rotation:[-0.2971572279930115,-0.6462573409080505,0.22679837048053741,-0.6652906537055969],principalFrame:[0,0,0,1],invPrincipalInertia:[12590.1357421875,12590.1357421875,12590.1357421875],expected:[12590.1376953125,-0.00244140625,-0.00002288818359375,-0.00244140625,12590.13671875,0.0010986328125,-0.00002288818359375,0.0010986328125,12590.1376953125]},
 {id:'original-e35-pass-2-body-16',rotation:[-0.3105587661266327,-0.6825160980224609,0.22633349895477295,-0.6216898560523987],principalFrame:[0,0,0,1],invPrincipalInertia:[12590.1357421875,12590.1357421875,12590.1357421875],expected:[12590.138671875,-0.00048828125,0,-0.00048828125,12590.1357421875,-0.000244140625,0,-0.000244140625,12590.1376953125]},
 {id:'original-e35-pass-1-body-17',rotation:[0,0,0,1],principalFrame:[0,0,0,1],invPrincipalInertia:[12590.1357421875,12590.1357421875,12590.1357421875],expected:[12590.1357421875,0,0,0,12590.1357421875,0,0,0,12590.1357421875]}
];
function check(result,expected,label){assert.deepEqual(Object.keys(result),['invInertia'],label+' changes only inverse inertia');assert.deepEqual(bits(result.invInertia),bits(expected),label+' native f32 bits, including signed zero');}
test('world inverse inertia matches pinned native pre-split and both post-advance tensors bit-for-bit',()=>{
 assert.equal(prediction.sourceRevision,REVISION);
 for(const row of nativeRows)check(M.reference('worldInvInertia',input(row)),row.expected,row.id);
 assert.notEqual(nativeRows[0].expected[1],0,'native isotropic sphere rounding must not be reduced to a diagonal');
 assert.notDeepEqual(bits(nativeRows[1].expected),bits(nativeRows[2].expected),'new orientation requires refreshing tensor');
});
test('nonidentity principal frame participates without quaternion normalization or isotropic simplification',()=>{
 // Identity * q has the same source quaternion as q * identity for these
 // nonzero-component native samples. This checks input wiring, not a new oracle.
 for(const row of nativeRows.slice(0,3)){const s=input(row);[s.rotation,s.principalFrame]=[s.principalFrame,s.rotation];check(M.reference('worldInvInertia',s),row.expected,row.id+' principal frame');}
});
test('native all-zero inverse inertia branch returns positive zeros',()=>{
 for(const row of nativeRows){const s=input(row);s.invPrincipalInertia=[0,-0,0];check(M.reference('worldInvInertia',s),Array(9).fill(0),row.id+' zero');}
});
test('isolated mass operation neither mutates body values nor returns velocity or cache updates',()=>{
 const s={...input(nativeRows[1]),linear:[1,2,3],angular:[4,5,6],warmImpulse:7,cache:{impulses:[8,9],recycleRotation:nativeRows[0].rotation.slice()}},before=structuredClone(s);
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};freeze(s);
 check(M.reference('worldInvInertia',s),nativeRows[1].expected,'isolated operation');assert.deepEqual(s,before);
});
test('invalid, non-f32, degenerate, and mixed locked inertia fail closed before dispatch',()=>{
 const edits=[s=>delete s.rotation,s=>s.rotation=[0,0,1],s=>s.rotation=[0,0,0,0],s=>s.rotation=[0,0,0,2],s=>s.rotation=[,,,1],s=>s.rotation[0]=NaN,s=>s.principalFrame=[0,0,1],s=>s.principalFrame=[0,0,0,0],s=>s.principalFrame[0]=.1,s=>s.invPrincipalInertia=[1,0,1],s=>s.invPrincipalInertia=[1,-1,1],s=>s.invPrincipalInertia=[1,Infinity,1],s=>s.invPrincipalInertia=[1,1],s=>s.invPrincipalInertia=[1,'1',1]];
 for(const edit of edits){const s=input(nativeRows[0]);edit(s);assert.throws(()=>M.reference('worldInvInertia',s));}
});
test('actual WGSL world inverse inertia compares directly with pinned native outputs',{skip:!process.env.GPU_NATIVE_MODULE&&process.env.REQUIRE_WEBGPU!=='1',timeout:180000},async t=>{
 assert.ok(process.env.GPU_NATIVE_MODULE,'Explicit actual WebGPU adapter module required');
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter,'Actual Vulkan adapter required');const device=await adapter.requestDevice();
 let stage,created=0,destroyed=0;const original=device.createBuffer.bind(device);device.createBuffer=d=>{const b=original(d);created++;const destroy=b.destroy.bind(b);let done=false;b.destroy=()=>{if(!done){done=true;destroyed++;}return destroy();};return b;};
 try{stage=await M.createGpuStage(device);for(const row of nativeRows){const s=input(row),before=structuredClone(s);check(await stage.step('worldInvInertia',s),row.expected,row.id);assert.deepEqual(s,before);if(row!==nativeRows.at(-1)){[s.rotation,s.principalFrame]=[s.principalFrame,s.rotation];check(await stage.step('worldInvInertia',s),row.expected,row.id+' principal frame');}s.invPrincipalInertia=[0,-0,0];check(await stage.step('worldInvInertia',s),Array(9).fill(0),row.id+' zero');}}finally{stage?.dispose();device.destroy();}
 assert.equal(created,destroyed,'all dispatch-owned buffers released');t.diagnostic(JSON.stringify({sourceRevision:REVISION,nativeTensorCases:nativeRows.length,nativeF32BitEquality:true,backend:'actual WebGPU Vulkan',hardwarePerformanceClaim:false,positiveClampIntegrationEstablished:false,createdBuffers:created,destroyedBuffers:destroyed}));
});
module.exports={nativeRows,input,bits,check};
