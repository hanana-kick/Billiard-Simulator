'use strict';
// SPDX-License-Identifier: Apache-2.0
// Numerical component proof only. Not whole-world admission or contact geometry.
const {test,before}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const F=require('./cue-cloth-joint-fixture.cjs'),J=require('../src/experimental-cue-cloth-joint-stepper'),Base=require('../src/experimental-cue-joint-stepper');
let fixtures;const diagnostics={cpu:[],gpu:[]};
before(()=>{assert.equal(process.env.CUE_CLOTH_SERIAL_SLOT,'1','Coordinator serial numerical-test slot required');const file=process.env.CUE_CLOTH_ORIGINAL_FULL||F.ROOT+'speed2-full.v8',native=F.load(file);fixtures=F.fixtures(native.data);if(process.env.CUE_CLOTH_ACTIVATION_FILE){const first=F.load(process.env.CUE_CLOTH_ACTIVATION_FILE);fixtures.unshift(...F.fixtures(first.data,[389,390]));if(process.env.CUE_CLOTH_PREPARED_FILE)fixtures.push(...F.preparedFixtures(process.env.CUE_CLOTH_PREPARED_FILE,first.data).filter(f=>f.name.endsWith('h388')));}});
function compare(actual,expected,label){let maxMotion=0,maxJoint=0,maxContact=0,maxInertiaRelative=0,signedZero=0;const finite=(v,name)=>assert.ok(Number.isFinite(v),name);
 for(const k of['shaft','head'])for(const field of['linear','angular','translation','rotation','invInertia']){assert.equal(actual[k][field].length,expected[k][field].length);for(let i=0;i<expected[k][field].length;i++){const a=actual[k][field][i],e=expected[k][field][i];finite(a,label+'.'+k+'.'+field);const error=Math.abs(a-e),scale=field==='invInertia'?Math.max(1,...expected[k].invInertia.map(Math.abs)):1;if(a===0&&e===0&&!Object.is(a,e))signedZero++;if(field==='invInertia')maxInertiaRelative=Math.max(maxInertiaRelative,error/scale);else maxMotion=Math.max(maxMotion,error);assert.ok(error<=3e-6*scale,`${label}.${k}.${field}[${i}] actual=${a} native=${e} error=${error}`);}}
 for(let i=0;i<10;i++){finite(actual.impulses[i],label+'.joint');const e=Math.abs(actual.impulses[i]-expected.impulses[i]);maxJoint=Math.max(maxJoint,e);assert.ok(e<=2e-6,`${label}.joint[${i}] error=${e}`);}
 for(const field of['impulse','warmImpulse','warmTangent','warmWorld']){const a=[actual.contact[field]].flat(),b=[expected.contact[field]].flat();for(let i=0;i<b.length;i++){finite(a[i],label+'.contact.'+field);const e=Math.abs(a[i]-b[i]);maxContact=Math.max(maxContact,e);assert.ok(e<=2e-7,`${label}.contact.${field}[${i}] actual=${a[i]} native=${b[i]} error=${e}`);}}
 return{label,maxMotion,maxJoint,maxContact,maxInertiaRelative,signedZero};}

test('one shared CPU graph matches genuine original preWorld → postWorld cue/cloth component transitions',()=>{
 for(const fixture of fixtures){const saved=structuredClone(fixture.input),actual=J.stepReference(fixture.input);assert.equal(actual.traces.length,12);assert.ok(fixture.input.shaft.localCom.some(v=>v!==0));assert.deepEqual(fixture.input.head.localCom,[0,0,0]);assert.ok(fixture.expected.contact.impulse>=0);if(fixture.name.endsWith('h388'))assert.equal(fixture.expected.contact.impulse,0);else assert.ok(fixture.expected.contact.impulse>0);diagnostics.cpu.push(compare(actual,fixture.expected,fixture.name));assert.deepEqual(fixture.input,saved,'No mutation or postWorld feedback into prepared input');}
 console.log(JSON.stringify({backend:'cpu-reference-vs-original-wasm',componentOnly:true,diagnostics:diagnostics.cpu}));
});

test('joint+cloth work is not equivalent to separate joint then contact solves',()=>{
 const fixture=fixtures[0],input=fixture.input,isolated=Base.stepReference({...input,kind:'isolated-actual-cue',bodyCount:3,contactCount:0}),actual=J.stepReference(input);
 assert.ok(actual.shaft.linear.some((v,i)=>Math.abs(v-isolated.shaft.linear[i])>1e-8),'Cloth impulses must feed back through flex joint into shaft during the same recurrence');
 assert.ok(actual.head.linear.some((v,i)=>Math.abs(v-isolated.head.linear[i])>1e-5));
});

test('separated zero-cache cloth leaves existing no-contact joint numerical path unchanged',()=>{
 const input=structuredClone(fixtures[0].input);input.contact.anchor1[1]=-1;input.contact.dp1[1]=-1;input.contact.impulse=0;input.contact.warmImpulse=0;input.contact.warmWorld=[0,0,0];input.contact.restitution=0;
 const actual=J.stepReference(input),expected=Base.stepReference({...input,kind:'isolated-actual-cue',bodyCount:3,contactCount:0});
 for(const k of['shaft','head'])for(const field of['linear','angular','translation','rotation','invInertia'])assert.deepEqual(actual[k][field],expected[k][field]);assert.deepEqual(actual.impulses,expected.impulses);assert.equal(actual.contact.impulse,0);
});

test('prepared component rejects unsupported schedules, additional bodies/contacts, non-head contact and nonzero head COM',()=>{
 for(const edit of[x=>x.kind='world',x=>x.bodyCount=5,x=>x.dynamicBodyCount=3,x=>x.fixedBodyCount=1,x=>x.contactCount=2,x=>x.solverSubsteps=4,x=>x.biasedPasses=1,x=>x.relaxPasses=0,x=>x.warmstartJoints=true,x=>x.ccdSplit=true,x=>x.frictionInBiasPass=true,x=>x.contact.body2=0,x=>x.contact.body1=0,x=>x.contact.relativeDominance=0,x=>x.contact.normal=[0,-1,0],x=>x.contact.tangentVelocity=[1,0,0],x=>x.head.localCom=[0,.01,0],x=>x.warmstartCoefficient=2,x=>x.staticFrequency=0,x=>x.contact.warmImpulse=-1]){const bad=structuredClone(fixtures[0].input);edit(bad);assert.throws(()=>J.validate(bad));}
 assert.equal(J.CAPABILITY.wholeWorld,false);assert.equal(J.CAPABILITY.allJointsBeforeContacts,true);assert.equal(J.CAPABILITY.geometry,false);assert.equal(J.CAPABILITY.activation,false);
});


test('numerical receipt rejects fabricated, mutated and mismatched prepared input',()=>{
 const input=fixtures[0].input,result=J.stepReference(input);assert.equal(J.assertResult(result,'cpu-reference',input),result);assert.equal(J.readContactResult(result,'cpu-reference'),result.contact);assert.equal(J.assertContactResult(result,'cpu-reference',input.contact),result.contact);assert.equal(J.assertContactResult(result,'cpu-reference',input.contact,input.head),result.contact);for(const key of['translation','rotation','linear','angular','localCom']){const wrongBody=structuredClone(input.head);wrongBody[key][0]=Math.fround(wrongBody[key][0]+.01);assert.throws(()=>J.assertContactResult(result,'cpu-reference',input.contact,wrongBody),/different prepared head/);}for(const malformed of[null,{}, {...input.head,rotation:[0,0,0]}, {...input.head,linear:[NaN,0,0]}])assert.throws(()=>J.assertContactResult(result,'cpu-reference',input.contact,malformed),/Finite original prepared head/);const wrongContact=structuredClone(input.contact);wrongContact.warmImpulse=Math.fround(wrongContact.warmImpulse+.001);assert.throws(()=>J.assertContactResult(result,'cpu-reference',wrongContact));assert.throws(()=>J.assertResult(structuredClone(result),'cpu-reference',input));assert.throws(()=>J.readContactResult(result,'webgpu'));assert.throws(()=>{result.contact.impulse=1;});assert.throws(()=>{result.head.linear[1]=2;});const different=structuredClone(input);different.head.linear[0]=Math.fround(different.head.linear[0]+.01);assert.throws(()=>J.assertResult(result,'cpu-reference',different));
});

test('actual WGSL independently matches native bodies, all joint impulses and cloth cache', {timeout:180000},async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('REQUIRE_WEBGPU=1');assert.ok(process.env.GPU_NATIVE_MODULE);
 const {pathToFileURL}=require('node:url'),{create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice(),release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'cue-cloth-joint-native-proof');
 try{const stage=await J.createGpuStepper(device);try{const results=await stage.stepBatch(fixtures.map(f=>f.input));for(let i=0;i<fixtures.length;i++){assert.equal(results[i].backend,'webgpu');diagnostics.gpu.push(compare(results[i],fixtures[i].expected,'GPU.'+fixtures[i].name));}console.log(JSON.stringify({backend:'actual-webgpu-vs-original-wasm',componentOnly:true,nodes:stage.plan.nodes.length,diagnostics:diagnostics.gpu}));}finally{stage.dispose();}}finally{release();}
});
