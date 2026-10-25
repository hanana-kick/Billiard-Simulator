'use strict';
// Source-expression and tamper tests only. No native/GPU simulation or decoder.
const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../../src/experimental-cue-created-variant'),family=require('../../docs/parity/cue-input-family-v1.json');
require('../../src/math');require('../../src/physics');
const copy=x=>structuredClone(x),f=Math.fround;
function initial(settings){
 const center=[f(-.66),f(.03072),f(.1)],pose=V.sourcePose(settings,center),translation=pose.tip.map(f),rotation=pose.rotation.map(f),linear=pose.linear.map(f);
 const a={fixtureVariant:V.SOURCE_INPUT,environmentContract:'original-three-ball-constructor-layout',selectedIndex:0,strikeSettings:copy(settings),axis:pose.axis,radius:.03075,tipRadius:.006};
 const bodies={ball:{pos:{position:{translation:center}}}},roles={ball:{index:0,generation:0}},events=[],cue={},initializationInputs=[];
 for(const [i,role]of['shaft','head','guide'].entries()){
  roles[role]={index:i+10,generation:0};bodies[role]={pos:{position:{translation:copy(translation),rotation:copy(rotation)}},vels:{linvel:copy(linear)}};
  cue[role]={translation:copy(translation),rotation:copy(rotation),linear:copy(linear)};
  initializationInputs.push({role,translation:copy(translation),rotation:copy(rotation)});
  if(role!=='guide')events.push({method:'setLinvel',handle:copy(roles[role]),linear:copy(pose.linear),wakeUp:true});
 }
 return{application:a,cue,initializationInputs,sourceCreation:{created:{bodies},roles,events}};
}
test('preregistered representative inputs and untouched elevated holdout are distinct',()=>{
 assert.equal(family.cases.length,3);assert.equal(family.cases.filter(x=>x.role==='holdout').length,1);
 for(const c of family.cases){assert.notEqual(c.settings.angle%90,0);assert.notEqual(c.settings.tipX,0);assert.notEqual(c.settings.tipY,0);assert.notEqual(c.settings.speed,2);assert.equal(V.validateCreatedInput(initial(c.settings)),V.SOURCE_INPUT);}
});
test('control ranges are exact PhysicsLab.strike constraints, not component support claims',()=>{
 for(const angle of[-720,-180,-37,0,23,180,765])for(const elevation of[0,8,20,85])for(const speed of[.25,1.5,5,10]){
  const s={angle,elevation,speed,tipX:.2,tipY:-.1},center=[-.66,.03072,.1];
  const actual=PhysicsLab.prototype.pose({body:{translation:()=>({x:center[0],y:center[1],z:center[2]})},radius:.03075},s),expected=V.sourcePose(s,center),array=o=>[o.x,o.y,o.z];
  assert.deepEqual(expected.axis,array(actual.direction));assert.deepEqual(expected.tip,array(actual.tip));assert.deepEqual(expected.rotation,[actual.rotation.x,actual.rotation.y,actual.rotation.z,actual.rotation.w]);
  assert.equal(V.validateSettings(s),s);
 }
 for(const change of[s=>s.angle=Infinity,s=>s.elevation=-.001,s=>s.elevation=85.001,s=>s.speed=0,s=>s.speed=10.001,s=>s.tipX=1,s=>{s.tipX=.8;s.tipY=.6;},s=>s.tipY=NaN]){const s=copy(family.cases[0].settings);change(s);assert.throws(()=>V.validateSettings(s));}
 assert.equal(V.CONTROL_RANGES.physicalSupport.includes('not a support claim'),true);
});
test('source contract rejects changed settings, axis, native pose, body input, and actual mutation journal',()=>{
 const seed=initial(family.cases[0].settings);assert.equal(V.validateCreatedInput(seed),V.SOURCE_INPUT);
 for(const change of[
  s=>s.application.strikeSettings.tipX+=.01,s=>s.application.strikeSettings.tipY+=.01,s=>s.application.strikeSettings.speed+=.01,
  s=>s.application.strikeSettings.angle+=.01,s=>s.application.axis[0]+=.01,s=>s.application.selectedIndex=1,
  s=>s.application.environmentContract='controlled-altered-single-ball-layout',s=>s.application.radius=.031,
  s=>s.sourceCreation.created.bodies.head.pos.position.translation[2]+=.00001,
  s=>s.sourceCreation.created.bodies.shaft.pos.position.rotation[0]+=.00001,
  s=>s.cue.guide.rotation[0]+=.00001,s=>s.initializationInputs[0].translation[0]+=.00001,
  s=>s.sourceCreation.events[0].linear[0]+=.00001,s=>s.sourceCreation.events[0].wakeUp=false,
  s=>s.sourceCreation.events.push(copy(s.sourceCreation.events[0])),s=>delete s.sourceCreation.roles.ball
 ]){const bad=copy(seed);change(bad);assert.throws(()=>V.validateCreatedInput(bad));}
 assert.deepEqual(seed,initial(family.cases[0].settings),'Validation never substitutes source settings or poses');
});
test('generic input does not alias or widen the historical named fixture contracts',()=>{
 const a=initial(family.cases[0].settings).application;for(const tag of[undefined,V.YAW15,'anything']){const bad=copy(a);bad.fixtureVariant=tag;assert.throws(()=>V.validateApplication(bad));}
 assert.ok(Object.isFrozen(V.CONTROL_RANGES));
});
