import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {packResidentCandidates} from '../src/direct-candidate/deterministic-resident-transition.mjs';
import {runQRecurrenceCPU,createQRecurrenceGPU} from '../src/direct-candidate/deterministic-q-recurrence.mjs';
import {ballisticBoundary} from '../src/direct-candidate/deterministic-q-continuation.mjs';
const Q=2**24,R=1/32,material={gravity:10,clothFriction:.2,rollingLength:.001,spinLength:.00035};
const body=(x,v=0,c=0)=>({id:1,position:[x,R,0],velocity:[v,0,0],angular:[0,0,-c/R],radius:R,mass:.21,provenance:'prepared-flat-constant-load'});
const scene={motionMaterial:material,provenance:'prepared-finite-cloth-and-static-bounds',ballCount:3,radius:R,mass:.21,y:R,z:0,clothTop:0,clothFootprint:[-8,8,-.5,.5],restitution:.8,pairFriction:.2,clothFriction:.2,staticBounds:[]};
const candidate=(id,x=.09)=>({id,bodies:[body(0,1,.2),body(x),body(.6,1,.2)],material,duration:.04,geometryHorizon:.04,geometryProvenance:'prepared-no-static-contact-interval'});
const pack=all=>packResidentCandidates(all,scene);
const options=e=>({landing:{clothRestitution:e,maxCorrectionQuanta:64}});
test('actual pair, repeated landing/regime events and rolling reach supported rest',()=>{
 const {rows,scene}=pack([candidate(1)]);
 for(const e of [0,.2]){const result=runQRecurrenceCPU(rows,scene,{clothRestitution:e,maxEvents:80}),u=result.qState,s=new Int32Array(u.buffer);assert.equal(u[2],3);assert.ok(result.stats[1]>5);assert.ok(result.stats[4]>=(e===0?1:2));assert.ok(result.stats[5]>=3);assert.ok(result.stats[6]>=1);for(let i=0;i<3;i++){const a=32+i*32;assert.equal(s[a+15],0);for(let j=3;j<9;j++)assert.equal(s[a+j],0);assert.equal(s[a+1],R*Q);}}
 const short=runQRecurrenceCPU(rows,scene,{clothRestitution:.2,maxEvents:2});assert.equal(short.qState[2],5);assert.equal(short.qState[3],9);assert.equal(short.stats[1],2);
 const correction=runQRecurrenceCPU(rows,scene,{clothRestitution:.2,maxEvents:80,maxStateCorrectionQuanta:1});assert.equal(correction.qState[2],4);assert.equal(correction.qState[3],6);
 const elastic=runQRecurrenceCPU(rows,scene,{clothRestitution:1,maxEvents:8});assert.notEqual(elastic.qState[2],3);
 assert.throws(()=>runQRecurrenceCPU(rows,scene,{clothRestitution:.2,maxEvents:129}),/bounded recurrence/);
});
test('scalar event velocities and rolling distance satisfy independent rational equations',()=>{
 const {rows,scene}=pack([candidate(1)]),roundRatio=(a,b,d)=>{const n=BigInt(Math.abs(a))*BigInt(b),den=BigInt(d);return Math.sign(a)*Number((n+den/2n)/den);};let before=runQRecurrenceCPU(rows,scene,{clothRestitution:0,maxEvents:1}).qState,checkedSlip=false,checkedQ=false,checkedRoll=false;
 for(let k=2;k<=64&&!checkedRoll;k++){
  const after=runQRecurrenceCPU(rows,scene,{clothRestitution:0,maxEvents:k}).qState,a=new Int32Array(after.buffer),b=new Int32Array(before.buffer),kind=after[28],mode=after[29],body=after[21],at=32+body*32;
  if(after[18]===0x51520302&&after[20]!==before[20]&&body<3&&kind!==0){
   const rate=kind===3?b[at+9]+b[at+14]:b[at+14],value=kind===3?b[at+3]+b[at+8]:b[at+8];
   if(mode===1){const expected=b[at+3]+roundRatio(b[at+9],Math.abs(value),Math.abs(rate));assert.equal(a[at+3],expected);assert.equal(a[at+8],kind===3?-expected:0);if(kind===3)checkedSlip=true;else checkedQ=true;}
   if(mode===3&&kind===3){const distance=roundRatio(b[at+3],Math.abs(b[at+3]),2*Math.abs(b[at+9]));assert.equal(a[at],b[at]+distance);assert.equal(a[at+3],0);assert.equal(a[at+8],0);checkedRoll=true;}
   // Energy at exact root from independently evaluated pre-event ODE.
   const value0=mode===3?b[at+3]:value,rate0=mode===3?b[at+9]:rate,time=Math.abs(value0/rate0),v=(b[at+3]+b[at+9]*time)/Q,q=(b[at+8]+b[at+14]*time)/Q;
   const predicted=.5*v*v+.2*q*q,actual=.5*(a[at+3]/Q)**2+.2*(a[at+8]/Q)**2;assert.ok(Math.abs(actual-predicted)<2e-7);
  }
  before=after;
 }
 assert.ok(checkedSlip&&checkedQ&&checkedRoll);
});
test('general airborne roots bracket the independent exact integer quadratic',()=>{
 for(const gap of [0,Math.round(Q/1000),Math.round(Q/500)])for(const vy of [-Q/10,0,Q/10]){const v=Math.round(vy),g=10*Q,root=ballisticBoundary(gap,v,g,65535);if(gap===0&&v<=0){assert.equal(root,false);continue;}assert.ok(root);const f=t=>BigInt(gap)*(1n<<41n)+2n*BigInt(v)*BigInt(t)*(1n<<20n)-BigInt(g)*BigInt(t)**2n;assert.ok(f(root[0])>=0n);assert.ok(f(root[1])<=0n);assert.ok(root[1]-root[0]<=1);}
 assert.equal(ballisticBoundary(Q,-Q/10,10*Q,65535),false);assert.equal(ballisticBoundary(0,1,10*Q,65535)[1],1);
});
test('resident ping-pong recurrence agrees word-for-word through rest and budgets',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:60000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{const engine=await createQRecurrenceGPU(device),{rows,scene}=pack(Array.from({length:35},(_,i)=>candidate(100+i,.08+i*.0006)));let comparedWords=0;const runs=[];
  for(const options of [{clothRestitution:0,maxEvents:80},{clothRestitution:.2,maxEvents:80},{clothRestitution:.2,maxEvents:2},{clothRestitution:1,maxEvents:8}]){const start=performance.now(),cpu=runQRecurrenceCPU(rows,scene,options),cpuMs=performance.now()-start,actual=await engine.run(rows,scene,options);assert.deepEqual(actual.qState,cpu.qState);assert.deepEqual(actual.stats,cpu.stats);comparedWords+=cpu.qState.length+cpu.stats.length;runs.push({options,cpuMs,rest:Array.from({length:35},(_,i)=>cpu.qState[i*160+2]).filter(x=>x===3).length,metrics:actual.metrics});}
  const receipt={profile:'bounded-q-event-recurrence-v1',cases:140,comparedWords,exactWords:true,compileMs:engine.compileMs,shaderBytes:engine.shaderBytes,runs,fullShot:false};t.diagnostic(JSON.stringify(receipt));if(process.env.DETERMINISTIC_RECURRENCE_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DETERMINISTIC_RECURRENCE_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
