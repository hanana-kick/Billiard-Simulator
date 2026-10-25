'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs');for(const n of ['math','physics','route-rules','optimizer-core','inverse-events'])require('../src/'+n);
test('static inspector preserves original clearance/rejection outcomes and accepted constraints without forward steps',async()=>{
 await R.init();const {inspectOriginalInverseInput:inspect}=await import('../src/inspect-inverse-native-input.mjs'),lab=new PhysicsLab(R),snapshot=lab.snapshot({trails:false}),settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0},req={snapshot,selectedId:1,settings,options:{mode:'target',targetId:2,secondId:3,budget:48,horizon:8,spin:false,objective:'shortest',elevationMode:'search',allowKiss:true}},topology={id:'native-static',events:[{kind:'object',id:2}]};
 try{
  const blocked=[0,45,90,135,180,-45,-90,-135].map(angle=>({...settings,angle,elevation:0})).find(s=>!lab.cueClearance(lab.get(1),s).clear);assert.ok(blocked);
  for(const [purpose,controls,kind]of [['clearance',settings,'clearance'],['evaluate',blocked,'rejected'],['evaluate',{...settings,speed:0},'rejected'],['verify',settings,'physical'],['residual',settings,'physical'],['jacobian',settings,'physical'],['trial',settings,'physical']]){
   const e=LabInverseEvents.begin(R,req,topology,controls,{purpose});let expected;try{expected=e.done?LabInverseEvents.finish(e):{clearance:e.clearance,inequalities:e.inequalities.slice()};}finally{LabInverseEvents.dispose(e);}
   const step=R.World.prototype.step;let calls=0;R.World.prototype.step=function(){calls++;throw Error('Native forward forbidden');};let actual;try{actual=inspect(R,req,topology,controls,purpose);}finally{R.World.prototype.step=step;}
   assert.equal(calls,0);assert.equal(actual.nativeForwardSteps,0);assert.equal(actual.kind,kind);if(kind==='physical'){assert.equal(actual.clearance,expected.clearance);assert.deepEqual(actual.inequalities,expected.inequalities);}else assert.deepEqual(actual.outcome,expected);
  }
  assert.deepEqual(lab.snapshot({trails:false}),snapshot);
  const from=PhysicsLab.fromSnapshot;PhysicsLab.fromSnapshot=function(...args){const child=from.apply(this,args);child.cueClearance=()=>child.world.step();return child;};try{assert.throws(()=>inspect(R,req,topology,settings,'clearance'),/Native forward stepping prohibited/);}finally{PhysicsLab.fromSnapshot=from;}
  assert.deepEqual(lab.snapshot({trails:false}),snapshot);
 }finally{lab.dispose();}
});
