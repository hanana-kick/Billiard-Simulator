import test from 'node:test';import assert from 'node:assert/strict';
import {rollingCushionFixture} from './fixtures/world-mixed-v2.mjs';
import {runPreparedWorldCPU} from '../src/direct-candidate/deterministic-recurring-world.mjs';
import {runExperimentalExactCollinearWorldCPU,advanceExactCollinearWorldCPU} from '../src/direct-candidate/experimental-exact-collinear-world.mjs';
const events=r=>r.history.filter(x=>x.kind==='finite-cushion-v2').map(x=>({body:x.cushion.entry[2],rail:x.cushion.entry[3],tick:x.impact.state[5]}));
test('exact-axis CPU policy preserves full roster and rejects noncollinear subset without changing defaults',t=>{
 for(const[speed,x,steps,status]of[[.2,1.38,12,9],[.1,1.38,11,7],[2,0,67,9],[3.5,1.3,128,5],[4,1.3,128,5],[4,0,80,9]]){
  const f=rollingCushionFixture(speed,{x}),before=runPreparedWorldCPU(f.world,f.scene,f.hulls,f.options),after=runExperimentalExactCollinearWorldCPU(f.world,f.scene,f.hulls,f.options);assert.equal(after.history.length,steps);assert.equal(after.state[1],status);assert.equal(after.state[3],3);assert.equal(after.gpuQualified,false);assert.deepEqual(events(before).map(({body,rail})=>({body,rail})),events(after).map(({body,rail})=>({body,rail})));
  const accepted=after.history.filter(x=>x.experimentalExactCollinear);for(const item of accepted){assert.equal(item.state[5],item.priorState[5]+item.exactCollinearProof.durationTicks);assert.ok(item.exactCollinearProof.accepted);for(let i=0;i<3;i++)assert.equal(item.state[64+i*48],item.priorState[64+i*48]);}
  if(speed<1||x===1.3)for(const k of['state','dense','journalWords','journalAuxWords'])assert.deepEqual(after[k],before[k]);
  t.diagnostic(JSON.stringify({speed,x,defaultSteps:before.history.length,steps:after.history.length,status:after.state[1],tick:after.state[5],events:events(after),exactAdvances:accepted.length}));
 }
});
test('exact-axis common interval refuses intervening sphere and table boundary; original cap remains',()=>{
 const f=rollingCushionFixture(2,{x:0}),r=runExperimentalExactCollinearWorldCPU(f.world,f.scene,f.hulls,f.options),first=r.history.find(x=>x.experimentalExactCollinear),current={state:first.priorState,dense:first.priorDense};
 assert.equal(advanceExactCollinearWorldCPU(current,first.context,null,{rollingV2:true}).experimentalExactCollinear,true);
 const blocked={state:current.state.slice(),dense:current.dense.slice()},s=new Int32Array(blocked.state.buffer),d=new Int32Array(blocked.dense.buffer);s.set(s.slice(88,91),136);d.set(s.slice(88,91),68); // second ball colocated: may never accept a clear interval
 assert.notEqual(advanceExactCollinearWorldCPU(blocked,first.context,null,{rollingV2:true}).experimentalExactCollinear,true);
 const ctx=first.context.slice(),c=new Int32Array(ctx.buffer);c[10]=new Int32Array(current.state.buffer)[88];assert.notEqual(advanceExactCollinearWorldCPU(current,ctx,null,{rollingV2:true}).experimentalExactCollinear,true);
 const cap=runExperimentalExactCollinearWorldCPU(f.world,f.scene,f.hulls,{...f.options,maxWorldSteps:1});assert.equal(cap.state[1],5);assert.equal(cap.state[2],77);assert.equal(cap.nominalRest,false);assert.throws(()=>runExperimentalExactCollinearWorldCPU(f.world,f.scene,f.hulls,{...f.options,maxWorldSteps:129}),RangeError);
});
