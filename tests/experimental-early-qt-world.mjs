import test from 'node:test';
import assert from 'node:assert/strict';
import {rollingCushionFixture} from './fixtures/world-mixed-v2.mjs';
import {runPreparedWorldCPU} from '../src/direct-candidate/deterministic-recurring-world.mjs';
import {runExperimentalEarlyQtWorldCPU,advanceExperimentalEarlyQtCPU} from '../src/direct-candidate/experimental-early-qt-world.mjs';
const eventSequence=r=>r.history.filter(x=>x.kind==='finite-cushion-v2').map(x=>({body:x.cushion.entry[2],rail:x.cushion.entry[3],tick:x.impact.state[5]}));
const physicalState=r=>Array.from({length:r.state[3]},(_,i)=>Array.from(new Int32Array(r.state.buffer).slice(64+i*48+24,64+i*48+33)));
const differences=(a,b)=>Array.from(a).reduce((n,v,i)=>n+(v!==b[i]),0);
test('experimental early qt preserves source proofs, exposes revised full-request state and event results',t=>{
  for(const [speed,x,steps,status] of [[.2,1.38,12,9],[.1,1.38,11,7],[2,0,85,9],[3.5,1.3,128,5],[4,1.3,120,9],[4,0,112,9]]){
    const f=rollingCushionFixture(speed,{x}),before=runPreparedWorldCPU(f.world,f.scene,f.hulls,f.options),after=runExperimentalEarlyQtWorldCPU(f.world,f.scene,f.hulls,f.options);
    assert.equal(after.history.length,steps);assert.equal(after.state[1],status);assert.equal(after.state[45],before.state[45]);assert.equal(after.state[61],before.state[61]);assert.ok(after.history.length<=128);assert.equal(after.gpuQualified,false);
    assert.deepEqual(eventSequence(after).map(({body,rail})=>({body,rail})),eventSequence(before).map(({body,rail})=>({body,rail})));
    for(const item of after.history.filter(x=>x.experimentalEarlyQt)){
      assert.equal(item.state[1],1);assert.ok(item.state[4]>0);assert.equal(item.state[5],item.priorState[5]+item.state[4]);
      for(let i=0;i<item.state[3];i++)if(item.mask&(1<<i)){assert.equal(item.bridges[i*128+1],1);assert.equal(item.bridges[i*128+4],item.state[4]);}
    }
    if(speed<1)for(const key of ['state','dense','journalWords','journalAuxWords'])assert.deepEqual(after[key],before[key]);
    if(speed===2){assert.notEqual(after.state[5],before.state[5]);assert.notDeepEqual(physicalState(after),physicalState(before));}
    t.diagnostic(JSON.stringify({speed,x,before:{steps:before.history.length,status:before.state[1],tick:before.state[5],events:eventSequence(before),physicalState:physicalState(before)},after:{steps:after.history.length,status:after.state[1],tick:after.state[5],events:eventSequence(after),physicalState:physicalState(after),earlyBridges:after.history.filter(x=>x.experimentalEarlyQt).length},wordDifferences:Object.fromEntries(['state','dense','journalWords','journalAuxWords'].map(k=>[k,differences(before[k],after[k])]))}));
  }
});
test('early qt still fails closed on obstructed all-object tube and cannot increase work cap',()=>{
  const f=rollingCushionFixture(2,{x:0}),r=runPreparedWorldCPU(f.world,f.scene,f.hulls,f.options),item=r.history.find(x=>x.proposals?.[1]===1&&x.proposals[5]===1023);
  assert.ok(item);const current={state:item.priorState,dense:item.priorDense};const positive=advanceExperimentalEarlyQtCPU(current,item.context,null,{rollingV2:true});assert.equal(positive.experimentalEarlyQt,true);
  const context=item.context.slice(),signed=new Int32Array(context.buffer);signed[10]=new Int32Array(current.state.buffer)[64+24];
  const blocked=advanceExperimentalEarlyQtCPU(current,context,null,{rollingV2:true});assert.notEqual(blocked.experimentalEarlyQt,true);assert.notEqual(blocked.state[1],1);
  const capped=runExperimentalEarlyQtWorldCPU(f.world,f.scene,f.hulls,{...f.options,maxWorldSteps:1});assert.equal(capped.state[1],5);assert.equal(capped.state[2],77);assert.equal(capped.nominalRest,false);
  assert.throws(()=>runExperimentalEarlyQtWorldCPU(f.world,f.scene,f.hulls,{...f.options,maxWorldSteps:129}),RangeError);
});
