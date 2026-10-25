'use strict';
// Lightweight admission tests only. No native decoder, PhysicsLab, or GPU runs.
const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../../src/experimental-cue-created-variant');
const app=(angle=15)=>({environmentContract:'original-three-ball-constructor-layout',selectedIndex:0,fixtureVariant:V.YAW15,strikeSettings:{...V.SETTINGS,angle},axis:[Math.cos(angle*Math.PI/180)*Math.cos(8*Math.PI/180),-Math.sin(8*Math.PI/180),Math.sin(angle*Math.PI/180)*Math.cos(8*Math.PI/180)]});
test('legacy angle0 admission remains unchanged and yaw15 needs an explicit contract',()=>{
 const legacy={strikeSettings:{...V.SETTINGS,angle:0}};
 assert.equal(V.validateApplication(legacy),V.DEFAULT);
 assert.equal(V.validateApplication(app()),V.YAW15);
 const unmarked=app();delete unmarked.fixtureVariant;
 assert.throws(()=>V.validateApplication(unmarked),/explicitly named yaw15/);
 assert.deepEqual(legacy,{strikeSettings:{...V.SETTINGS,angle:0}},'admission never changes source settings');
});
test('named yaw15 does not admit alternative angles, tip, elevation, speed, or selected body',()=>{
 for(const change of[
  a=>a.strikeSettings.angle=0,a=>a.strikeSettings.angle=-15,a=>a.strikeSettings.angle=15.00001,
  a=>a.strikeSettings.elevation=0,a=>a.strikeSettings.speed=2.01,a=>a.strikeSettings.tipX=.01,
  a=>a.strikeSettings.tipY=.01,a=>a.selectedIndex=1,a=>delete a.selectedIndex,
  a=>a.environmentContract='controlled-altered-single-ball-layout',a=>a.fixtureVariant='arbitrary-yaw',
  a=>a.axis=[1,0,0],a=>a.axis[0]=NaN
 ]){const bad=app();change(bad);assert.throws(()=>V.validateApplication(bad));}
});
test('default path remains limited to the original exact settings',()=>{
 for(const k of['angle','elevation','speed','tipX','tipY']){const bad={strikeSettings:{...V.SETTINGS,angle:0}};bad.strikeSettings[k]+=.01;assert.throws(()=>V.validateApplication(bad));}
 assert.ok(Object.isFrozen(V.SETTINGS));
});
