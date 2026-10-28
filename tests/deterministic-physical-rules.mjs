import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {packResidentCandidates} from '../src/direct-candidate/deterministic-resident-transition.mjs';
import {runQRecurrenceCPU,createQRecurrenceGPU} from '../src/direct-candidate/deterministic-q-recurrence.mjs';
import {packRuleConfig,gameplayDelta} from '../src/direct-candidate/deterministic-rules.mjs';
const R=.03075,material={gravity:9.81,clothFriction:.2,rollingLength:.00045,spinLength:.00035};
const body=(x,v=0,q=0)=>({id:1,position:[x,R,0],velocity:[v,0,0],angular:[0,0,q/R],radius:R,mass:.21,provenance:'prepared-flat-constant-load'});
const scene={motionMaterial:material,provenance:'prepared-finite-cloth-and-static-bounds',ballCount:4,radius:R,mass:.21,y:R,z:0,clothTop:0,clothFootprint:[-1.42,1.42,-.71,.71],restitution:.8,pairFriction:.2,clothFriction:.2,staticBounds:[]};
const candidate=(id,q=1.5,x=.08001)=>({id,bodies:[body(0,.8,q),body(x),body(-.09),body(.8)],material,duration:.04,geometryHorizon:.04,geometryProvenance:'prepared-no-static-contact-interval'});
const config=(extra={})=>packRuleConfig({first:1,second:2,opponent:3,search:true,...extra});
const pack=rows=>packResidentCandidates(rows,scene),opts=(ruleConfig=config(),maxEvents=128)=>({clothRestitution:.2,maxEvents,ruleConfig,cueSlot:0});
test('actual draw contacts and true rest drive independent gameplay/search outcomes',()=>{
 const p=pack([candidate(1)]),o=opts(),result=runQRecurrenceCPU(p.rows,p.scene,o),r=result.rules;
 assert.equal(result.qState[2],3);assert.equal(r[13],1);assert.equal(r[0],3);assert.equal(r[18],1);assert.equal(r[19],1);assert.equal(gameplayDelta(o.ruleConfig,r),1);
 assert.equal(r[31],2,'only two cue-object episodes');assert.equal(r[20],3,'third pair is target/opponent, not cue foul');assert.equal(r[3],0);assert.equal(r[1],0,'cloth landings are not cushions');assert.ok(result.stats[4]>0,'actual landings occurred');
 const noKiss=runQRecurrenceCPU(p.rows,p.scene,opts(config({allowKiss:false,kissFacts:true}))).rules;assert.equal(noKiss[18],1);assert.equal(noKiss[19],4,'producer cannot certify caller-asserted kiss facts');
 const three=runQRecurrenceCPU(p.rows,p.scene,opts(config({threeCushion:true}))).rules;assert.equal(three[18],2);assert.equal(three[19],1,'gameplay and unrestricted route stay separate');
 const foul=runQRecurrenceCPU(p.rows,p.scene,opts(config({first:2,second:3,opponent:1}))).rules;assert.equal(foul[29],1);assert.equal(foul[13],1);assert.equal(foul[3],1);assert.equal(foul[18],2);assert.equal(gameplayDelta(config({first:2,second:3,opponent:1}),foul),-1);
 const budget=runQRecurrenceCPU(p.rows,p.scene,opts(config(),result.stats[1]-1));assert.equal(budget.rules[0],3);assert.equal(budget.rules[13],0);assert.equal(budget.rules[18],3);assert.equal(budget.rules[19],3);assert.equal(gameplayDelta(config(),budget.rules),null);
 const weak=pack([candidate(2,.96)]),miss=runQRecurrenceCPU(weak.rows,weak.scene,opts()).rules;assert.equal(miss[13],1);assert.equal(miss[0],1);assert.equal(miss[18],2);
 const uncertain=pack([candidate(3,1.5,.08)]),u=runQRecurrenceCPU(uncertain.rows,uncertain.scene,opts()).rules;assert.equal(u[13],0);assert.equal(u[18],4);assert.equal(u[19],4);
 assert.throws(()=>runQRecurrenceCPU(p.rows,p.scene,opts(config({game:3}))),/roster/);
 const cancelled=new AbortController();cancelled.abort();assert.throws(()=>runQRecurrenceCPU(p.rows,p.scene,{...opts(),signal:cancelled.signal}),{name:'AbortError'});
});
test('condition-only committed foul terminates physics without REST or final score',()=>{
 const p=pack([candidate(9)]),foul={first:2,second:3,opponent:1},full=runQRecurrenceCPU(p.rows,p.scene,opts(config(foul)));
 for(const extra of [{search:false},{allowKiss:false,kissFacts:true}]){
  const early=runQRecurrenceCPU(p.rows,p.scene,opts(config({...foul,...extra,conditionOnly:true})));
  assert.equal(early.qState[2],8);assert.equal(early.rules[13],0);assert.equal(early.rules[29],1);assert.equal(early.rules[28],8);assert.equal(early.rules[17],0);assert.equal(early.rules[14]&1,0);
  assert.deepEqual(Array.from(early.verdicts),[9,5,7,0x80000000]);assert.equal(full.verdicts[1],2);assert.equal(full.verdicts[3],0xffffffff);
  assert.equal(early.stats[1],0);assert.equal(early.stats[7],0);assert.ok(full.stats[1]>early.stats[1]);assert.equal(early.rules[20],1);
  const minimum=runQRecurrenceCPU(p.rows,p.scene,opts(config({...foul,...extra,conditionOnly:true}),1));assert.deepEqual(minimum.qState,early.qState);assert.deepEqual(minimum.rules,early.rules);
 }
 const later=config({first:1,second:3,opponent:2,conditionOnly:true}),ended=runQRecurrenceCPU(p.rows,p.scene,opts(later));assert.equal(ended.qState[2],8);const boundary=ended.stats[1];assert.ok(boundary>1);
 const exact=runQRecurrenceCPU(p.rows,p.scene,opts(later,boundary)),before=runQRecurrenceCPU(p.rows,p.scene,opts(later,boundary-1));assert.deepEqual(exact.verdicts,ended.verdicts);assert.equal(exact.stats[1],boundary);assert.equal(before.verdicts[1],3);assert.equal(before.rules[29],0);assert.equal(before.verdicts[3],0x80000000);
 const positive=runQRecurrenceCPU(p.rows,p.scene,opts(config({conditionOnly:true})));assert.equal(positive.verdicts[1],1);assert.equal(positive.rules[13],1);const goal=runQRecurrenceCPU(p.rows,p.scene,opts(config({conditionOnly:true}),positive.stats[1]-1));assert.equal(goal.rules[0],3);assert.equal(goal.verdicts[1],3);assert.equal(goal.verdicts[3],0x80000000);
});
test('physical committed events and RULE stay GPU-resident and word-identical',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:60000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{const engine=await createQRecurrenceGPU(device,{rules:true}),p=pack(Array.from({length:35},(_,i)=>candidate(100+i,1.5+i*.01)));let words=0;const runs=[];const laterConfig=config({first:1,second:3,opponent:2,conditionOnly:true}),proofBudget=runQRecurrenceCPU(p.rows,p.scene,opts(laterConfig)).stats[1];
  for(const options of [opts(),opts(config({allowKiss:false,kissFacts:true})),opts(config(),2),opts(config({first:2,second:3,opponent:1,allowKiss:false})),opts(config({first:2,second:3,opponent:1,conditionOnly:true,search:false})),opts(config({first:2,second:3,opponent:1,conditionOnly:true,allowKiss:false})),opts(laterConfig),opts(laterConfig,proofBudget),opts(laterConfig,proofBudget-1)]){const cpu=runQRecurrenceCPU(p.rows,p.scene,options),actual=await engine.run(p.rows,p.scene,{...options,diagnostics:true});for(const field of ['qState','stats','rules','verdicts']){assert.equal(actual[field].findIndex((x,i)=>x!==cpu[field][i]),-1,field);words+=cpu[field].length;}runs.push({noKiss:!options.ruleConfig[8],budget:options.maxEvents,conditionOnly:!!options.ruleConfig[10],responseAttempts:cpu.stats[1],queryNodes:cpu.stats[7],gameplayPass:Array.from({length:35},(_,i)=>cpu.rules[i*32+18]).filter(x=>x===1).length,searchPass:Array.from({length:35},(_,i)=>cpu.rules[i*32+19]).filter(x=>x===1).length,metrics:actual.metrics});}
  const compact=await engine.run(p.rows,p.scene,opts());assert.equal(compact.qState,undefined);assert.equal(compact.metrics.finalReadbackBytes,35*16);assert.deepEqual(compact.verdicts,runQRecurrenceCPU(p.rows,p.scene,opts()).verdicts);
  for(const cancelledOptions of [opts(),opts(config({first:2,second:3,opponent:1,conditionOnly:true}))]){const controller=new AbortController(),running=engine.run(p.rows,p.scene,{...cancelledOptions,signal:controller.signal});controller.abort();await assert.rejects(running,{name:'AbortError'});}
  const receipt={profile:'prepared-physical-to-rule-v1',cases:runs.length*35,comparedWords:words,compactMetrics:compact.metrics,exactWords:true,compileMs:engine.compileMs,shaderBytes:engine.shaderBytes,runs,rawShot:false};t.diagnostic(JSON.stringify(receipt));if(process.env.PHYSICAL_RULE_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.PHYSICAL_RULE_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
