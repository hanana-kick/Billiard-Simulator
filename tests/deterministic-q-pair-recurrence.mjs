import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {packResidentCandidates} from '../src/direct-candidate/deterministic-resident-transition.mjs';
import {runQRecurrenceCPU,createQRecurrenceGPU} from '../src/direct-candidate/deterministic-q-recurrence.mjs';
import {respondQPairCPU} from '../src/direct-candidate/deterministic-q-pair.mjs';
import {ballisticBoundary} from '../src/direct-candidate/deterministic-q-continuation.mjs';
const Q=2**24,R=1/32,material={gravity:10,clothFriction:.2,rollingLength:.001,spinLength:.00035};
const body=(x,v=0,c=0)=>({id:1,position:[x,R,0],velocity:[v,0,0],angular:[0,0,-c/R],radius:R,mass:.21,provenance:'prepared-flat-constant-load'});
const scene={motionMaterial:material,provenance:'prepared-finite-cloth-and-static-bounds',ballCount:3,radius:R,mass:.21,y:R,z:0,clothTop:0,clothFootprint:[-8,8,-.5,.5],restitution:.8,pairFriction:.2,clothFriction:.2,staticBounds:[]};
const candidate=(id,x=.09)=>({id,bodies:[body(0,1,.2),body(x),body(.6,1,.2)],material,duration:.04,geometryHorizon:.04,geometryProvenance:'prepared-no-static-contact-interval'});
const pack=all=>packResidentCandidates(all,scene);
const options=e=>({landing:{clothRestitution:e,maxCorrectionQuanta:64}});
const chain=(id,x=.18)=>{const c=candidate(id);c.bodies[2]=body(x);c.bodies.push(body(x+.1));return c;};
test('actual second and third pairs preserve physical invariants and continue to rest',()=>{
 const p=packResidentCandidates([chain(1)],{...scene,ballCount:4}),options={clothRestitution:0,maxEvents:80},result=runQRecurrenceCPU(p.rows,p.scene,options);assert.equal(result.qState[2],3);assert.equal(result.stats[17],2);assert.equal(result.stats[21],11);assert.ok(result.stats[18]>0);for(let i=0;i<4;i++){assert.equal(result.qState[32+i*32+15],0);for(let j=3;j<9;j++)assert.equal(result.qState[32+i*32+j],0);}
 let pending;for(let maxEvents=1;maxEvents<12;maxEvents++){const r=runQRecurrenceCPU(p.rows,p.scene,{...options,maxEvents});if(r.qState[7]===1){pending=r.qState;break;}}assert.ok(pending);assert.equal(pending[2],5);pending[2]=7;pending[3]=0; // Remove only operational budget mask to inspect its already-computed event.
 const failed=pending.slice(),shortScene=p.scene.slice();shortScene[14]=1;respondQPairCPU(failed,shortScene);assert.equal(failed[2],5);assert.equal(failed[5]+failed[6],failed[20],'failed solver state retains correct upper-tick timestamp');
 const airborne=pending.slice();airborne[32+32+15]=2;respondQPairCPU(airborne,p.scene);assert.equal(airborne[2],4);assert.equal(airborne[3],10);
 const {packets,responses}=respondQPairCPU(pending,p.scene),a=new Int32Array(packets.buffer),r=new Int32Array(responses.buffer),scale=x=>x/Q;assert.equal(responses[1],1);assert.equal(pending[16],6);
 const energy=v=>.5*(v[0]**2+v[1]**2+v[3]**2+v[4]**2)+.2*(v[2]**2+v[5]**2),before=Array.from(a.slice(16,22),scale),after=Array.from(r.slice(16,22),scale);assert.ok(energy(after)<=energy(before)+2e-6);
 assert.ok(Math.abs(after[0]+after[3]-before[0]-before[3]-scale(r[28]+r[30]))<2e-6);
 const radius=scale(a[4]),xa=scale(a[5]),xb=scale(a[6]),y=scale(a[7]);const angular=v=>xa*v[1]+xb*v[4]-y*(v[0]+v[3])-.4*radius*(v[2]+v[5]);const external=xa*scale(r[27])+xb*scale(r[29])-scale(a[9])*scale(r[28]+r[30]);assert.ok(Math.abs(angular(after)-angular(before)-external)<2e-6);
 const cancelled=new AbortController();cancelled.abort();assert.throws(()=>runQRecurrenceCPU(p.rows,p.scene,{...options,signal:cancelled.signal}),{name:'AbortError'});
});
test('subsequent pair GPU stages and CPU mirror match every state/work word',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:60000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{const engine=await createQRecurrenceGPU(device),p=packResidentCandidates(Array.from({length:35},(_,i)=>chain(100+i,.18+i*.0007)),{...scene,ballCount:4});let words=0;const runs=[];
  // Regression: idle fourth sphere must not inherit another body's scalar scratch roots.
  const single=packResidentCandidates([chain(1)],{...scene,ballCount:4});for(let maxEvents=1;maxEvents<=5;maxEvents++){const options={clothRestitution:0,maxEvents},cpu=runQRecurrenceCPU(single.rows,single.scene,options),gpu=await engine.run(single.rows,single.scene,options);assert.equal(gpu.qState.findIndex((x,i)=>x!==cpu.qState[i]),-1);}

  for(const options of [{clothRestitution:0,maxEvents:80},{clothRestitution:.2,maxEvents:80},{clothRestitution:0,maxEvents:2}]){const cpu=runQRecurrenceCPU(p.rows,p.scene,options),actual=await engine.run(p.rows,p.scene,options);assert.equal(actual.qState.findIndex((x,i)=>x!==cpu.qState[i]),-1,'first state word mismatch');assert.deepEqual(actual.stats,cpu.stats);words+=cpu.qState.length+cpu.stats.length;runs.push({options,rest:Array.from({length:35},(_,i)=>cpu.qState[i*160+2]).filter(x=>x===3).length,subsequentPairs:Array.from({length:35},(_,i)=>cpu.stats[i*24+17]).reduce((a,b)=>a+b,0),metrics:actual.metrics});}
  const runningController=new AbortController(),running=engine.run(p.rows,p.scene,{clothRestitution:.2,maxEvents:80,signal:runningController.signal});runningController.abort();await assert.rejects(running,{name:'AbortError'});
  const controller=new AbortController();controller.abort();await assert.rejects(engine.run(p.rows,p.scene,{clothRestitution:0,signal:controller.signal}),{name:'AbortError'});
  const receipt={profile:'resident-subsequent-supported-pairs-v1',cases:105,comparedWords:words,exactWords:true,compileMs:engine.compileMs,shaderBytes:engine.shaderBytes,runs,fullShot:false};t.diagnostic(JSON.stringify(receipt));if(process.env.DETERMINISTIC_PAIR_RECURRENCE_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DETERMINISTIC_PAIR_RECURRENCE_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
