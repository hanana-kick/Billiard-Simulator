/* SPDX-License-Identifier: Apache-2.0
 * Admission metadata only, not a physics or trajectory implementation.
 * Source application: src/physics.js; Rapier b716d375efc0201003f0cd9ef7168eee0b62c177.
 * See vendor/RAPIER-LICENSE.txt. All existing phase guards remain mandatory.
 */
(function(G){'use strict';
const Live=typeof module!=='undefined'&&module.exports?require('./experimental-live-registered-origin'):G.LabLiveRegisteredOriginExperimental;
const LiveThree=typeof module!=='undefined'&&module.exports?require('./experimental-live-three-ball-origin'):G.LabLiveThreeBallOriginExperimental;
const LIVE_THREE_BALL_SOURCE_INPUT='source-validated-original-live-registered-three-ball-cue-input-v1';
const LIVE_FOUR_BALL_SOURCE_INPUT='source-validated-original-live-registered-four-ball-cue-input-v1';
const DEFAULT='original-three-ball-product-default-elevation8-speed2';
const YAW15='original-three-ball-yaw15-centered-elevation8-speed2-v1';
const SOURCE_INPUT='source-validated-original-three-ball-cue-input-v1';
const FOUR_BALL_SOURCE_INPUT='source-validated-original-four-ball-cue-input-v1';
const PLACED_FOUR_BALL_SOURCE_INPUT='source-validated-original-placed-four-ball-cue-input-v1';
const CONTROL_RANGES=Object.freeze({angle:'any finite degrees (no wrap/substitution)',elevation:Object.freeze([0,85]),speed:Object.freeze({exclusiveMin:0,inclusiveMax:10}),tip:'finite tipX/tipY, Math.hypot(tipX,tipY) < 1',source:'PhysicsLab.strike in src/physics.js',physicalSupport:'separate transactional CCD/contact/component guards; ranges are not a support claim'});
const SETTINGS=Object.freeze({angle:15,elevation:8,tipX:0,tipY:0,speed:2});
function validateApplication(a){
 const v=a?.strikeSettings,variant=a?.fixtureVariant;
 if(variant===SOURCE_INPUT||variant===FOUR_BALL_SOURCE_INPUT||variant===PLACED_FOUR_BALL_SOURCE_INPUT||variant===LIVE_FOUR_BALL_SOURCE_INPUT||variant===LIVE_THREE_BALL_SOURCE_INPUT){
  validateSettings(v);
  if(variant===LIVE_THREE_BALL_SOURCE_INPUT){
   if(a.environmentContract!==LiveThree.ENVIRONMENT||!Number.isInteger(a.selectedId)||!Number.isInteger(a.selectedIndex)||a.selectedIndex<0||a.selectedIndex>2)throw RangeError('Explicit live three-ball cue identity required');
  }else if(variant===LIVE_FOUR_BALL_SOURCE_INPUT){
   if(a.environmentContract!=='original-controller-live-registered-four-ball-layout'||!Number.isInteger(a.selectedId)||!Number.isInteger(a.selectedIndex)||a.selectedIndex<0||a.selectedIndex>3)throw RangeError('Explicit live registered cue identity required');
  }else if(variant===SOURCE_INPUT){
   if(a.environmentContract!=='original-three-ball-constructor-layout'||a.selectedIndex!==0)throw RangeError('Source input requires the original three-ball constructor and selected body0');
  }else if(a.environmentContract!==(variant===PLACED_FOUR_BALL_SOURCE_INPUT?'original-controller-placed-goal-four-ball-layout':'original-controller-four-ball-created-layout')||a.selectedIndex!==0||a.selectedId!==1)throw RangeError('Four-ball source input requires its actual created/placed origin and selected cue ID1/index0');
  checkVector(a.axis,sourcePose(v,[0,0,0]).axis,'unchanged JS-double cue direction');
  return variant;
 }
 const angle=variant===YAW15?15:0;
 if((variant!==undefined&&variant!==YAW15)||!v||v.angle!==angle||v.elevation!==8||v.tipX!==0||v.tipY!==0||v.speed!==2)
  throw RangeError('Only original product-default or explicitly named yaw15 centered8-degree speed2 strike admitted');
 if(variant===YAW15){
  if(a.selectedIndex!==0||a.environmentContract!=='original-three-ball-constructor-layout')
   throw RangeError('Explicit yaw15 variant requires original constructor layout and selected body0');
  // Same JS-double expression as PhysicsLab.pose, checked rather than substituted.
  const yaw=15*Math.PI/180,elevation=8*Math.PI/180;
  const expected=[Math.cos(yaw)*Math.cos(elevation),-Math.sin(elevation),Math.sin(yaw)*Math.cos(elevation)];
  if(!Array.isArray(a.axis)||a.axis.length!==3||a.axis.some((x,i)=>x!==expected[i]))
   throw RangeError('Explicit yaw15 variant requires its unchanged source cue axis');
 }
 return variant??DEFAULT;
}

// These are source controls, not geometric/dynamic capabilities. A valid control
// may still be obstructed, activate CCD, or produce an unsupported coupled solve.
function validateSettings(v){
 if(!v||![v.angle,v.elevation,v.tipX,v.tipY,v.speed].every(Number.isFinite)||Math.hypot(v.tipX,v.tipY)>=1||v.speed<=0||v.speed>10||v.elevation<0||v.elevation>85)
  throw RangeError('PhysicsLab.strike finite control ranges required');
 return v;
}
function checkVector(actual,expected,label){
 if(!Array.isArray(actual)||actual.length!==expected.length||actual.some((x,i)=>x!==expected[i]))throw RangeError('Source cue input mismatch: '+label);
}
// Exact operation order from PhysicsLab.pose and LabMath.qfromY. Used solely to
// validate initial provenance, never to replace engine construction or stepping.
function sourcePose(v,center,radius=.03075,tipRadius=.006){
 validateSettings(v);if(!Array.isArray(center)||center.length!==3||center.some(x=>!Number.isFinite(x)))throw TypeError('Source selected-ball translation required');
 const a=v.angle*Math.PI/180,e=v.elevation*Math.PI/180;
 const axis=[Math.cos(a)*Math.cos(e),-Math.sin(e),Math.sin(a)*Math.cos(e)],side=[-Math.sin(a),0,Math.cos(a)];
 const up=[side[1]*axis[2]-side[2]*axis[1],side[2]*axis[0]-side[0]*axis[2],side[0]*axis[1]-side[1]*axis[0]];
 const rear=-Math.sqrt(Math.max(.0001,1-v.tipX*v.tipX-v.tipY*v.tipY));
 const surface=axis.map((d,i)=>(side[i]*v.tipX+up[i]*v.tipY)+d*rear);
 const tip=axis.map((d,i)=>(center[i]+surface[i]*(radius+tipRadius))+d*-.012);
 const inverseLength=1/(Math.hypot(...axis)||1),n=axis.map(x=>x*inverseLength),qScale=Math.sqrt((1+n[1])*2);
 const rotation=n[1]<-.999999?[1,0,0,0]:[n[2]/qScale,0,-n[0]/qScale,qScale/2];
 return{axis,tip,rotation,linear:axis.map(x=>x*v.speed)};
}
function validateCreatedInput(initial){
 const a=initial?.application;if(a?.fixtureVariant!==SOURCE_INPUT&&a?.fixtureVariant!==FOUR_BALL_SOURCE_INPUT&&a?.fixtureVariant!==PLACED_FOUR_BALL_SOURCE_INPUT&&a?.fixtureVariant!==LIVE_FOUR_BALL_SOURCE_INPUT&&a?.fixtureVariant!==LIVE_THREE_BALL_SOURCE_INPUT)return;
 validateApplication(a);
 const creation=initial.sourceCreation,raw=creation?.created,roles=creation?.roles,selected=raw?.bodies?.ball;
 if(!selected||!roles?.ball||!Array.isArray(creation.events))throw RangeError('Source cue pose requires actual created ball and mutation journal');
 if(a.fixtureVariant===FOUR_BALL_SOURCE_INPUT){
  const same=(x,y)=>x?.index===y?.index&&x?.generation===y?.generation;
  if(raw.originalFourBallCreation!==true||raw.boundary!=='strikeCreated'||!roles.freshBall||!Array.isArray(creation.modeEvents)||raw.sourceSelectedId!==a.selectedId||raw.sourceSelectedIndex!==a.selectedIndex||!same(raw.sourceSelectedBody,roles.ball)||!same(selected.handle,roles.ball))throw RangeError('Actual initial-only four-ball source selection and mode journal required');
 }

 if(a.fixtureVariant===PLACED_FOUR_BALL_SOURCE_INPUT){
  const same=(x,y)=>x?.index===y?.index&&x?.generation===y?.generation;
  if(raw.originalPlacedGoalFourBallCreation!==true||raw.originalFourBallCreation||raw.originalSettledFourBallCreation||raw.boundary!=='goalStrikeCreated'||roles.freshBall||raw.sourceSelectedId!==a.selectedId||raw.sourceSelectedIndex!==a.selectedIndex||!same(selected.handle,roles.ball)||raw.sourceShots!==1||raw.sourceApplicationTime!==a.initialTime)throw RangeError('Actual initial-only placed four-ball creation and selection required');
 }

 if(a.fixtureVariant===LIVE_FOUR_BALL_SOURCE_INPUT){Live.validateCreated(raw,roles);Live.validateApplication(a,raw);}

 if(a.fixtureVariant===LIVE_THREE_BALL_SOURCE_INPUT){LiveThree.validateCreated(raw,roles);LiveThree.validateCueApplication(a,raw);if(!LiveThree.sameData(initial.sourceOrigin,raw.sourceOrigin))throw RangeError('Cue projection must preserve the identical live three-ball origin');}

 const expected=sourcePose(a.strikeSettings,selected.pos.position.translation,a.radius,a.tipRadius),f=Math.fround;
 if(a.radius!==.03075||a.tipRadius!==.006)throw RangeError('Unchanged original sphere and tip dimensions required');
 const numeric=initial.initializationInputs;
 if(!Array.isArray(numeric))throw RangeError('Source cue numerical initialization inputs required');
 for(const role of['shaft','head','guide']){
  const b=raw.bodies[role],state=initial.cue?.[role],input=numeric.find(x=>x.role===role);
  if(!b||!state||!input)throw RangeError('Complete created cue role required: '+role);
  const nativePose=b.pos.position;
  checkVector(nativePose.translation,expected.tip.map(f),role+' native source tip');
  checkVector(nativePose.rotation,expected.rotation.map(f),role+' native source rotation');
  for(const k of['translation','rotation']){checkVector(state[k],nativePose[k],role+' projected '+k);checkVector(input[k],nativePose[k],role+' initialization '+k);}
  if(role!=='guide'){
   checkVector(b.vels.linvel,expected.linear.map(f),role+' native source velocity');
   checkVector(state.linear,b.vels.linvel,role+' projected velocity');
   const writes=creation.events.filter(x=>x.method==='setLinvel'&&x.handle?.index===roles[role]?.index&&x.handle?.generation===roles[role]?.generation);
   if(writes.length!==1||writes[0].wakeUp!==true)throw RangeError('Exactly one original awake setLinvel per cue body required');
   checkVector(writes[0].linear,expected.linear,role+' JS-double velocity journal');
  }
 }
 return a.fixtureVariant;
}
const api=Object.freeze({LIVE_THREE_BALL_SOURCE_INPUT,LIVE_FOUR_BALL_SOURCE_INPUT,DEFAULT,YAW15,SOURCE_INPUT,FOUR_BALL_SOURCE_INPUT,PLACED_FOUR_BALL_SOURCE_INPUT,CONTROL_RANGES,SETTINGS,validateSettings,sourcePose,validateApplication,validateCreatedInput});
G.LabCueCreatedVariantExperimental=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
