import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {packSourceSpinRecurrence,runSpinRecurrenceCPU,createSpinRecurrenceGPU} from '../src/direct-candidate/deterministic-spin-recurrence.mjs';
import {runAxialIntegerCPU} from '../src/direct-candidate/deterministic-axial.mjs';
const r=1/32,T=2**20,Q=2**24,material={gravity:10,clothFriction:.2,rollingLength:.00045,spinLength:4*2*r*r/(5*10)};
const body=(x,v=0,c=0,spin=0)=>({id:1,position:[x,r,0],velocity:[v,0,0],angular:[0,spin,-c/r],radius:r,mass:.21,provenance:'prepared-flat-constant-load'});
const candidate=(id,bodies,extra={})=>({id,bodies,material,duration:.05,geometryHorizon:.05,geometryProvenance:'prepared-no-static-contact-interval',...extra});
const cases=[
 candidate(1,[body(0,1,.2,.125),body(.5),body(1)]),
 candidate(2,[body(0,1,.2,-.125),body(.5),body(1)]),
 candidate(3,[body(0,1,.2,.125+1/T),body(.5),body(1)]),
 candidate(4,[body(0,1,.2,1/T),body(.5),body(1)]),
 candidate(5,[body(0,1,.2,0),body(.5),body(1)]),
 candidate(6,[body(0,1,.2,.125),body(.5),body(1)],{material:{...material,spinLength:0}}),
 candidate(7,[body(0,1,.2,.125),body(.0625+.0390625-.0390625**2),body(1)]),
 candidate(8,[body(0,1,.2,.125),body(.0625+.015625-.015625**2),body(1)]),
 candidate(9,[body(0,1,.2,.125),body(.0625+.03125-.03125**2),body(1)]),
 candidate(10,[body(0,1,.2,.125),body(.5,0,0,-.125),body(1,0,0,.125+1/T)]),
 candidate(11,[body(0,1,.2,.0625),body(.5,0,0,.125),body(1)],{maxSpinEvents:1}),
 candidate(12,[body(0,1,.2,.0625),body(.0625+.0234375-.0234375**2,0,0,.125),body(1)],{maxSpinEvents:1}),
 candidate(13,[body(0,1,.2,-1/T),body(.5),body(1)]),
];
const packed=()=>packSourceSpinRecurrence(cases);
test('normal spin stop has honest brackets and global recurrence retains original anchors',()=>{
 const {rows}=packed(),result=runSpinRecurrenceCPU(rows),s=new Int32Array(result.buffer);
 for(let k=0;k<6;k++)assert.equal(result[k*64+1],2);
 assert.deepEqual(Array.from(result.slice(48,52)),[32768,32768,1,1]);
 assert.deepEqual(Array.from(result.slice(2*64+48,2*64+52)),[32768,32769,1,0]);
 assert.deepEqual(Array.from(result.slice(3*64+48,3*64+52)),[0,1,1,0]);
 assert.equal(s[12*64+12],0);assert.deepEqual(Array.from(result.slice(12*64+48,12*64+52)),[0,1,1,0]);
 assert.equal(s[12],0);assert.equal(s[64+12],0);assert.equal(s[5*64+12],Math.round(.125*T));
 for(let k=0;k<6;k++){
  const origin=rows.slice(k*64,k*64+48);origin.fill(0,4,8);origin[12]=0;origin[15]=0;
  const direct=runAxialIntegerCPU(origin);
  // Split vs one-shot must be bit identical for all unaffected state components.
  for(let i=0;i<3;i++)for(const j of [0,1,2,3,5,6,8,9])assert.equal(result[k*64+8+i*10+j],direct[8+i*10+j]);
 }
 assert.equal(result[6*64+1],1);assert.ok(result[6*64+3]>32768);assert.equal(result[6*64+49],32768);
 assert.equal(result[7*64+1],1);assert.ok(result[7*64+4]<32768);assert.equal(result[7*64+49],0);
 assert.equal(result[8*64+1],4);assert.ok([3,7].includes(result[8*64+2]));assert.equal(result[8*64+3],0);
 assert.deepEqual(Array.from(result.slice(9*64+48,9*64+52)),[32768,32768,3,3]);
 assert.deepEqual(Array.from(result.slice(9*64+52,9*64+56)),[32768,32769,4,0]);
 assert.equal(result[10*64+1],5);assert.equal(result[10*64+2],5);assert.equal(result[10*64+3],16384);
 assert.equal(result[11*64+1],1);assert.ok(result[11*64+3]>16384&&result[11*64+4]<32768,'event budget must not hide earlier pair');
});
test('stop brackets satisfy exact rational inequalities, malformed modes and bounded work fail closed',()=>{
 const {rows}=packed(),result=runSpinRecurrenceCPU(rows),s=new Int32Array(rows.buffer);
 for(let b=0;b<rows.length;b+=64)for(let e=0;e<4;e++){
  const at=b+48+e*4,lower=result[at],upper=result[at+1],mask=result[at+2],exact=result[at+3];
  for(let i=0;i<3;i++)if(mask&(1<<i)){
   const w=BigInt(Math.abs(s[b+12+i*10])),a=BigInt(Math.abs(s[b+15+i*10])),target=w*BigInt(T);
   assert.ok(a*BigInt(lower)<=target&&a*BigInt(upper)>=target);
   assert.equal(a*BigInt(upper)===target,!!(exact&(1<<i)));
  }
 }
 const malformed=rows.slice(0,64);malformed[15]=4*T;assert.equal(runSpinRecurrenceCPU(malformed)[1],4);
 const exhausted=rows.slice(0,64);exhausted[3]=1;const out=runSpinRecurrenceCPU(exhausted);assert.equal(out[1],5);assert.equal(out[7],0xffffffff);assert.equal(out[3],32768);
 assert.throws(()=>runSpinRecurrenceCPU(rows.slice(1)),/64-word/);
});
test('native recurrence matches CPU event traces and states bit for bit',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:30000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{
  const varied=Array.from({length:128},(_,i)=>candidate(100+i,[body(-.2,1,.2,(i+1)/4096+(i%3)/T),body(.5,0,0,-(i+3)/4096),body(1)],{duration:.04,geometryHorizon:.04}));
  const {rows}=packSourceSpinRecurrence([...cases,...varied]);const started=performance.now(),cpu=runSpinRecurrenceCPU(rows),cpuMs=performance.now()-started,engine=await createSpinRecurrenceGPU(device);
  const padded=new Uint32Array(rows.length+8);padded.set(rows,4);const gpuResult=await engine.run(padded.subarray(4,4+rows.length));assert.deepEqual(gpuResult.result,cpu);
  const receipt={profile:'prepared-original-law-normal-spin-recurrence-v1',cases:rows.length/64,comparedWords:rows.length,exactWords:true,cpuMs,pairIntervalNodes:Array.from({length:rows.length/64},(_,i)=>cpu[i*64+6]).reduce((a,b)=>a+b,0),compileMs:engine.compileMs,shaderBytes:engine.shaderBytes,metrics:gpuResult.metrics,attitudeComplete:false,physicalAcceptance:false,stopTraceCount:Array.from({length:rows.length/64},(_,k)=>[0,1,2,3].filter(e=>cpu[k*64+49+e*4]!==0).length).reduce((a,b)=>a+b,0)};t.diagnostic(JSON.stringify(receipt));
  if(process.env.DETERMINISTIC_SPIN_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DETERMINISTIC_SPIN_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
