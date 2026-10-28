import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCollinearSegment,evaluateCollinearMotion,predictPreparedCollinearEvent} from '../src/direct-candidate/source-law-collinear-segment.mjs';
const m={gravity:9.81,clothFriction:.2,rollingLength:.00045,spinLength:.00035};
const r=.03075,mass=.210;
const body=(v,c,spin=0,x=0,z=0,id=1)=>({id,position:[x,r,z],velocity:[v,0,0],angular:[0,spin,-c/r],radius:r,mass,provenance:'prepared-flat-constant-load'});
const near=(a,b,bound=1e-11)=>assert.ok(Math.abs(a-b)<=bound,`${a} != ${b}`);
test('sliding includes original rolling torque, and stops at earliest slip/spin boundary',()=>{
 const s=prepareCollinearSegment(body(1,.2),m);assert.equal(s.eligible,true);
 near(s.scalarAcceleration,-m.clothFriction*m.gravity);
 near(s.surfaceAcceleration,2.5*m.clothFriction*m.gravity-5*m.gravity*m.rollingLength/(2*r));
 near(s.slipRate,s.scalarAcceleration-s.surfaceAcceleration);assert.deepEqual(s.boundaries,['slip-zero']);
 const end=evaluateCollinearMotion(s,s.horizon);near(end.velocity[0]+r*end.angular[2],0);
 assert.throws(()=>evaluateCollinearMotion(s,s.horizon*1.001),/inside/);
 const spin=prepareCollinearSegment(body(1,.2,.01),m);assert.deepEqual(spin.boundaries,['normal-spin-stop']);
});
test('draw, topspin and reversed motion satisfy independent force/torque power balance',()=>{
 for(const [v,c,spin] of [[1,.2,1],[1,2,-1],[1,-1,0],[-1,-.2,1],[-1,-2,0],[0,1,0]]){
  const b=body(v,c,spin),s=prepareCollinearSegment(b,m);assert.equal(s.eligible,true);
  const I=.4*mass*r*r;
  // Independently form friction force at bottom point and patch torque in XYZ.
  const slip=v-c,forceX=-m.clothFriction*mass*m.gravity*Math.sign(slip);
  const frictionTorqueZ=r*forceX,patchTorqueZ=-mass*m.gravity*m.rollingLength*Math.sign(b.angular[2]);
  near(s.acceleration[0],forceX/mass);near(s.angularAcceleration[2],(frictionTorqueZ+patchTorqueZ)/I);
  const derivative=mass*v*s.acceleration[0]+I*b.angular.reduce((sum,w,i)=>sum+w*s.angularAcceleration[i],0);
  const loss=-m.clothFriction*mass*m.gravity*Math.abs(slip)-mass*m.gravity*m.rollingLength*Math.abs(b.angular[2])-mass*m.gravity*m.spinLength*Math.abs(spin);
  near(derivative,loss);assert.ok(derivative<=0);
 }
});
test('zero translational velocity can start moving; velocity sign change alone is not a boundary',()=>{
 const s=prepareCollinearSegment(body(.01,-1),m);assert.equal(s.eligible,true);
 const zero=-.01/s.acceleration[0];assert.ok(zero<s.horizon);
 const after=evaluateCollinearMotion(s,zero*1.1);assert.ok(after.velocity[0]<0);assert.notEqual(after.velocity[0]+r*after.angular[2],0);
 const spinOnly=prepareCollinearSegment(body(0,1),m);assert.ok(evaluateCollinearMotion(spinOnly,.001).velocity[0]>0);
});
test('rolling, zero tangential spin, noncollinear and non-grounded states remain unqualified',()=>{
 for(const b of [body(1,1),body(1,0),{...body(1,.2),velocity:[1,0,.1]},{...body(1,.2),velocity:[1,.001,0]},{...body(1,.2),provenance:'live-unverified'}])assert.equal(prepareCollinearSegment(b,m).eligible,false);
});
test('prepared all-ball next-event solves relative acceleration and globally advances uninvolved balls',()=>{
 const bodies=[body(1,.2,0,-.2,0,1),body(0,0,0,-.06,0,2),body(0,0,1,.5,.5,3)];
 const result=predictPreparedCollinearEvent(bodies,m,{duration:.2,geometryHorizon:.2,geometryProvenance:'prepared-collision-free-interval'});
 assert.equal(result.eligible,true,JSON.stringify(result));assert.equal(result.event.kind,'pair');assert.equal(result.pairRootCalls,3);assert.equal(result.trajectoryTimeSteps,0);
 const targetTravel=.14-2*r,expected=(1-Math.sqrt(1-2*m.clothFriction*m.gravity*targetTravel))/(m.clothFriction*m.gravity);
 near(result.event.time,expected);near(result.states[0].position[0],-.06-2*r);
 near(result.states[2].angular[1],1-5*m.gravity*m.spinLength/(2*r*r)*expected);
 assert.equal(result.collisionResolved,false);assert.equal(result.pass,null);
});
test('actual geometry horizon is mandatory and wins before an unsafe advance',()=>{
 const bodies=[body(1,.2,0,-.2),body(0,0,0,.5),body(0,0,0,0,.5)];
 assert.equal(predictPreparedCollinearEvent(bodies,m,{duration:.1}).eligible,false);
 const result=predictPreparedCollinearEvent(bodies,m,{duration:.1,geometryHorizon:.01,geometryProvenance:'prepared-collision-free-interval'});assert.equal(result.eligible,true);assert.equal(result.event.kind,'geometry-horizon');near(result.event.time,.01);
});

test('axial z motion is admitted without a fitted direction; underflow cannot fake collinearity',()=>{
 const z={...body(1,.2),velocity:[0,0,1],angular:[.2/r,0,0]};const s=prepareCollinearSegment(z,m);assert.equal(s.eligible,true);near(s.acceleration[2],-m.clothFriction*m.gravity);near(s.angularAcceleration[0],s.surfaceAcceleration/r);
 const adversarial={...body(1,.2),velocity:[1e-200,0,0],angular:[1e-200/r,0,-.2e-200/r]};assert.equal(prepareCollinearSegment(adversarial,m).eligible,false);
 const boundary={...body(1,.2),angular:[0,0,Number.MIN_VALUE/r]};assert.equal(prepareCollinearSegment(boundary,m).reason,'unrepresentable-regime-horizon');
 const underflow={...body(0,0),angular:[Number.MIN_VALUE,0,0]};assert.equal(prepareCollinearSegment(underflow,m).reason,'unrepresentable-tangential-spin');
 const spin=body(0,0,Number.MIN_VALUE);assert.equal(prepareCollinearSegment(spin,m).reason,'unrepresentable-regime-horizon');
});

test('pair geometry radius remains separate from torque-law radius, including f32 downward rounding',()=>{
 const physical=.03,native=Math.fround(physical);assert.ok(native<physical);
 const bodies=[body(1,.2,0,-.2,0,1),body(0,0,0,0,0,2),body(0,0,0,.5,.5,3)].map(b=>({...b,position:[b.position[0],physical,b.position[2]],radius:physical,collisionRadius:native}));
 const result=predictPreparedCollinearEvent(bodies,{...m,clothFriction:0,rollingLength:0,spinLength:0},{duration:.3,geometryHorizon:.3,geometryProvenance:'prepared-collision-free-interval'});
 assert.equal(result.eligible,true);assert.equal(result.event.kind,'pair');near(result.event.time,.2-2*native);assert.equal(result.states[0].radius,physical);
});
