import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {packResidentCandidates} from '../src/direct-candidate/deterministic-resident-transition.mjs';
import {runQContinuationCPU,createQContinuationGPU,Q_STATE_VERSION,deriveSupportedQMode,boundedOmegaToQ} from '../src/direct-candidate/deterministic-q-continuation.mjs';
const Q=2**24,T=2**20,R=1/32,material={gravity:10,clothFriction:.2,rollingLength:.00045,spinLength:.00035};
const body=(x,v=0,c=0)=>({id:1,position:[x,R,0],velocity:[v,0,0],angular:[0,0,-c/R],radius:R,mass:.21,provenance:'prepared-flat-constant-load'});
const scene={motionMaterial:material,provenance:'prepared-finite-cloth-and-static-bounds',ballCount:3,radius:R,mass:.21,y:R,z:0,clothTop:0,clothFootprint:[-1,1,-.5,.5],restitution:.8,pairFriction:.2,clothFriction:.2,staticBounds:[]};
const globalThisScene=scene;
const candidate=(id,x=.09,other=body(.6,1,.2))=>({id,bodies:[body(0,1,.2),body(x),other],material,duration:.04,geometryHorizon:.04,geometryProvenance:'prepared-no-static-contact-interval'});
const cases=[candidate(1),candidate(2,.0916),candidate(3,.095),candidate(4,.1),candidate(5,.09,body(.6)),candidate(6,.09,body(.16)),{...candidate(7,.08,body(.6,1,.85)),duration:.019,geometryHorizon:.019}];
function pack(all=cases,context=scene){return packResidentCandidates(all,context);}
test('actual postcontact q-state advances flight and supported motion to a next landing',()=>{
 const {rows,scene}=pack(),result=runQContinuationCPU(rows,scene),state=new Int32Array(result.qState.buffer);
 assert.equal(result.qState[0],Q_STATE_VERSION);assert.equal(result.qState[2],7);assert.equal(result.qState[7],2);assert.ok(result.qState[6]>1000);assert.ok(result.qState[17]>0);
 const at=32,elapsed=result.qState[6]/T;assert.equal(state[at+15],2);assert.equal(state[at+24],state[at+8]);assert.ok(state[at+20]<0);assert.equal(state[at+19],state[at+3]);
 const expectedY=state[at+1]/Q+state[at+4]/Q*elapsed+.5*state[at+10]/Q*elapsed*elapsed;assert.ok(Math.abs(state[at+17]/Q-expectedY)<=2/Q);
 const landing=2*state[at+4]/(-state[at+10])*T;assert.ok(result.qState[8]-result.qState[5]<=landing&&result.qState[9]-result.qState[5]>=landing);
 // Selected q comes DIRECTLY from contact c, not its rounded omega display.
 assert.equal(result.qState[5*160+7],1);assert.equal(result.qState[5*160+10],6,'next moving pair is B/C');
 assert.equal(result.qState[6*160+7],3);assert.equal(result.qState[6*160+10],2,'uninvolved sphere reaches slip boundary first');
 assert.equal(state[at+8],-new Int32Array(result.responses.buffer)[18]);
 for(let i=1;i<3;i++){const b=32+i*32;assert.equal(state[b+15],1);assert.equal(state[b+17],state[b+1]);assert.ok(state[b+16]!==state[b]);}
 const noFriction=pack([candidate(8)],{...globalThisScene,pairFriction:0});const onset=runQContinuationCPU(noFriction.rows,noFriction.scene).qState;const signed=new Int32Array(onset.buffer),second=64;assert.equal(signed[second+8],0);assert.ok(signed[second+14]<0,'postimpact q=0 starts rotating');
});
test('q onset and rolling laws retain resistance and static-friction sufficiency',()=>{
 const edgeRadius=524289,edgeOmega=Math.floor(2**48/edgeRadius)+1;assert.throws(()=>boundedOmegaToQ(edgeOmega,edgeRadius),/conversion range/);assert.equal(boundedOmegaToQ(2**29,2**19),16*Q);
 for(const w of [2**30-1,2**30,2**30+1])assert.equal(boundedOmegaToQ(w,4096),Number(BigInt(w)*4096n/(1n<<20n)));
 const F=2*Q,K=Math.round(.36*Q),onset=deriveSupportedQMode(Q,0,F,K);assert.equal(onset.mode,1);assert.ok(onset.dq<0);
 const pinned=deriveSupportedQMode(Q,0,Math.round(.1*Q),Q);assert.equal(pinned.dq,0);
 const rolling=deriveSupportedQMode(Q,-Q,F,K);assert.equal(rolling.mode,3);assert.equal(rolling.dq,-rolling.a);assert.ok(Math.abs(rolling.a)<=F);
 const slipping=deriveSupportedQMode(Q,-Q,Math.round(.01*Q),K);assert.equal(slipping.mode,1);assert.ok(slipping.a+slipping.dq>0);
 for(const [v,q] of [[Q,-Q/4],[-Q,Q/4],[0,Q]]){const m=deriveSupportedQMode(v,q,F,K),power=v/Q*m.a/Q+.4*q/Q*m.dq/Q,loss=-F/Q*Math.abs((v+q)/Q)-.4*K/Q*Math.abs(q/Q);assert.ok(Math.abs(power-loss)<2/Q);}
});
test('unresolved mode/zero restitution and bounded queries remain explicit non-results',()=>{
 const below={...scene,y:R-1/Q},input=candidate(20);input.bodies=input.bodies.map(b=>({...b,position:[b.position[0],below.y,0]}));const packed=pack([input],below);const out=runQContinuationCPU(packed.rows,packed.scene).qState;assert.equal(out[2],4);assert.equal(out[3],2);
 const zero=pack([candidate(21)],{...scene,restitution:0});const unsupported=runQContinuationCPU(zero.rows,zero.scene).qState;assert.equal(unsupported[2],4);assert.equal(unsupported[3],3);
 const excess=pack([candidate(24,.09,body(.6,1,-32))]);const rejected=runQContinuationCPU(excess.rows,excess.scene).qState;assert.equal(rejected[2],4);assert.equal(rejected[3],2);
 const normal=pack([candidate(22)]);assert.throws(()=>runQContinuationCPU(normal.rows,normal.scene,{horizonTicks:0}),/Bounded/);
 const close=pack([candidate(23,.09,body(.16))]);const exhausted=runQContinuationCPU(close.rows,close.scene,{maxNodes:1}).qState;assert.equal(exhausted[2],5);assert.equal(exhausted[6],0);
});
test('five resident GPU phases match every explicit v2 state word',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:30000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{
  const inputs=[...cases,...Array.from({length:32},(_,i)=>candidate(100+i,.08+i*.0007))],{rows,scene}=pack(inputs),cpu=runQContinuationCPU(rows,scene),engine=await createQContinuationGPU(device),actual=await engine.run(rows,scene);assert.deepEqual(actual.qState,cpu.qState);
  const badScene=scene.slice();badScene[16]=0xffffffff;await assert.rejects(engine.run(rows,badScene));
  const backing=new Uint32Array(rows.length+8);backing.set(rows,4);assert.deepEqual((await engine.run(backing.subarray(4,4+rows.length),scene)).qState,cpu.qState);
  // Raw arithmetic holdouts: untouched endpoint omega crosses the INITIAL bound.
  const smallR=1/128,smallScene={...globalThisScene,radius:smallR,y:smallR};
  const edgeCandidates=[-256,0,256].map((rate,i)=>({...candidate(900+i,.03),bodies:[body(0,1,.2),body(.03),body(.6)].map(b=>({...b,radius:smallR,position:[b.position[0],smallR,0],angular:[0,0,b.angular[2]*R/smallR]}))}));
  const edge=pack(edgeCandidates,smallScene),es=new Int32Array(edge.rows.buffer);for(let i=0;i<3;i++){es[i*48+33]=2**30;es[i*48+36]=[-256,0,256][i];}
  const ec=runQContinuationCPU(edge.rows,edge.scene);assert.deepEqual((await engine.run(edge.rows,edge.scene)).qState,ec.qState);
  const endpoint=new Int32Array(ec.state.buffer);assert.ok(endpoint[48]<2**30);assert.ok(endpoint[2*128+48]>2**30);assert.equal(endpoint[128+48],2**30);
  const frictionless=pack(inputs,{...globalThisScene,pairFriction:0});assert.deepEqual((await engine.run(frictionless.rows,frictionless.scene)).qState,runQContinuationCPU(frictionless.rows,frictionless.scene).qState);
  const receipt={profile:'gpu-canonical-q-v2-mixed-continuation',cases:inputs.length,comparedWords:cpu.qState.length,exactWords:true,compileMs:engine.compileMs,shaderBytes:engine.shaderBytes,metrics:actual.metrics,advanced:Array.from({length:inputs.length},(_,i)=>cpu.qState[i*160+6]).filter(x=>x>0).length,fullShot:false};t.diagnostic(JSON.stringify(receipt));
  if(process.env.DETERMINISTIC_Q_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DETERMINISTIC_Q_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
