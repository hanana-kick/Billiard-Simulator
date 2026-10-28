import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {packResidentCandidates} from '../src/direct-candidate/deterministic-resident-transition.mjs';
import {runQLandingCPU,runQContinuationCPU,Q_LANDING_VERSION,createQContinuationGPU} from '../src/direct-candidate/deterministic-q-continuation.mjs';
const Q=2**24,R=1/32,material={gravity:10,clothFriction:.2,rollingLength:.00045,spinLength:.00035};
const body=(x,v=0,c=0)=>({id:1,position:[x,R,0],velocity:[v,0,0],angular:[0,0,-c/R],radius:R,mass:.21,provenance:'prepared-flat-constant-load'});
const scene={motionMaterial:material,provenance:'prepared-finite-cloth-and-static-bounds',ballCount:3,radius:R,mass:.21,y:R,z:0,clothTop:0,clothFootprint:[-1,1,-.5,.5],restitution:.8,pairFriction:.2,clothFriction:.2,staticBounds:[]};
const candidate=(id,x=.09)=>({id,bodies:[body(0,1,.2),body(x),body(.6,1,.2)],material,duration:.04,geometryHorizon:.04,geometryProvenance:'prepared-no-static-contact-interval'});
const pack=all=>packResidentCandidates(all,scene);
const options=e=>({landing:{clothRestitution:e,maxCorrectionQuanta:64}});
test('actual landing responds with explicit cloth restitution and re-queries all bodies',()=>{
 const {rows,scene}=pack([candidate(1)]),prior=runQContinuationCPU(rows,scene).qState,ps=new Int32Array(prior.buffer),tick=BigInt(prior[9]-prior[5]);
 const floor=(n,d)=>n>=0n?n/d:-((-n+d-1n)/d);
 const evalPosition=(a,j)=>Number(BigInt(ps[a+j])+floor(BigInt(ps[a+3+j])*tick,1n<<20n)+floor(BigInt(ps[a+9+j])*tick*tick,1n<<41n));
 for(const e of [0,.2,1]){
  const result=runQLandingCPU(rows,scene,options(e)),u=result.qState,s=new Int32Array(u.buffer);
  assert.equal(u[18],Q_LANDING_VERSION);assert.equal(u[31],1);assert.ok(u[22]<=u[23]);assert.ok(u[6]>0);assert.equal(u[5],u[20]);assert.equal(s[33],R*Q);
  assert.equal(s[47],e===0?1:2);assert.ok(Math.abs(s[27]+e*s[26])<=1);
  assert.ok(Math.abs(s[25])<=Math.floor(Math.round(.2*Q)/Q*u[24]));
  // Independent impulse/energy oracle, using the saved impulse ledger and post-impact anchor.
  const vx=s[35]/Q,q=s[40]/Q,jt=s[25]/Q,jn=u[24]/Q,preVx=Number(BigInt(ps[35])+floor(BigInt(ps[41])*tick,1n<<20n))/Q,preQ=Number(BigInt(ps[40])+floor(BigInt(ps[46])*tick,1n<<20n))/Q;
  assert.ok(Math.abs(vx-preVx-jt)<1/Q);assert.ok(Math.abs(q-preQ-2.5*jt)<=1/Q);
  const before=.5*(preVx**2+(s[26]/Q)**2)+.2*preQ**2,after=.5*(vx**2+(s[27]/Q)**2)+.2*q**2;
  assert.ok(after<=before+2e-7);assert.ok(Math.abs(s[27]/Q-s[26]/Q-jn)<1/Q);
  const expectedJ=Math.max(-Math.round(.2*Q)/Q*jn,Math.min(Math.round(.2*Q)/Q*jn,-s[28]/Q/3.5));assert.ok(Math.abs(jt-expectedJ)<2/Q);
  assert.equal(u[7],e===0?3:e===.2?2:4);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(!(i===0&&j===1))assert.equal(s[32+i*32+j],evalPosition(32+i*32,j),'all bodies rebased at common upper tick');
  assert.equal(u[22],R*Q-evalPosition(32,1));
 }
 const tiny=runQLandingCPU(rows,scene,options(16/Q)).qState,ts=new Int32Array(tiny.buffer);assert.equal(tiny[31],1);assert.ok(ts[27]>0&&ts[27]<scene[15]);assert.equal(ts[47],2);assert.ok(tiny[24]>0,'positive rebound retains its positive impact impulse');
 assert.throws(()=>runQLandingCPU(rows,scene),/Explicit cloth restitution/);
});

test('seven resident phases match landing, bounce/support and next-event words',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:30000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{
  const engine=await createQContinuationGPU(device,{landing:true}),{rows,scene}=pack(Array.from({length:39},(_,i)=>candidate(100+i,.08+i*.0006)));let compared=0,landed=0;const runs=[];
  for(const e of [0,.2,1,16/Q]){const opts=options(e),cpu=runQLandingCPU(rows,scene,opts),actual=await engine.run(rows,scene,opts);assert.deepEqual(actual.qState,cpu.qState);compared+=cpu.qState.length;landed+=Array.from({length:39},(_,i)=>cpu.qState[i*160+31]).filter(x=>x===1).length;runs.push({e,metrics:actual.metrics});}
  const strict={landing:{clothRestitution:.2,maxCorrectionQuanta:1}},cpu=runQLandingCPU(rows,scene,strict);assert.deepEqual((await engine.run(rows,scene,strict)).qState,cpu.qState);assert.ok(Array.from({length:39},(_,i)=>cpu.qState[i*160+3]).includes(6));
  await assert.rejects(engine.run(rows,scene),/Explicit cloth restitution/);
  const receipt={profile:'gpu-canonical-isolated-landing-requery-v1',candidates:156,comparedWords:compared,exactWords:true,landed,compileMs:engine.compileMs,shaderBytes:engine.shaderBytes,runs,fullShot:false};t.diagnostic(JSON.stringify(receipt));
  if(process.env.DETERMINISTIC_LANDING_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DETERMINISTIC_LANDING_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
