import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceLawNonaxialRHS} from '../src/direct-candidate/source-law-nonaxial-rhs.mjs';
import {prepareCollinearSegment} from '../src/direct-candidate/source-law-collinear-segment.mjs';
const material={gravity:9.81,clothFriction:.2,rollingLength:.00045,spinLength:.00035};
const body=(velocity=[.7,0,-.4],angular=[8,3,-5])=>({position:[0,.03075,0],velocity,angular,radius:.03075,mass:.21,provenance:'prepared-flat-constant-load'});
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
// Fixed arithmetic-roundoff checks, not physical acceptance tolerances.
const close=(a,b)=>assert.ok(Math.abs(a-b)<=64*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b)),`${a} vs ${b}`);
const vectorClose=(a,b)=>a.forEach((x,k)=>close(x,b[k]));
test('nonaxial RHS matches independent contact force, torque and dissipated power',()=>{
 for(const b of [body(),body([-.3,0,.9],[-6,-4,11]),body([0,0,0],[5,0,7])]){
  const r=sourceLawNonaxialRHS(b,material);assert.equal(r.eligible,true);
  const arm=[0,-b.radius,0],contactVelocity=cross(b.angular,arm).map((x,k)=>x+b.velocity[k]),speed=Math.hypot(...contactVelocity),N=b.mass*material.gravity;
  const force=contactVelocity.map(x=>-material.clothFriction*N*x/speed),contactTorque=cross(arm,force);
  vectorClose(r.force,force);vectorClose(r.contactTorque,contactTorque);
  const wt=Math.hypot(b.angular[0],b.angular[2]);const rolling=b.angular.map((x,k)=>k===1?0:-N*material.rollingLength*x/wt);
  vectorClose(r.rollingTorque,rolling);
  const tau=contactTorque.map((x,k)=>x+rolling[k]+(k===1?-N*material.spinLength*Math.sign(b.angular[1]):0));
  vectorClose(r.angularDerivative,tau.map(x=>x/(2*b.mass*b.radius*b.radius/5)));
  const expected=-material.clothFriction*N*speed-N*material.rollingLength*wt-N*material.spinLength*Math.abs(b.angular[1]);
  close(r.power,expected);close(dot(r.force,b.velocity)+dot(tau,b.angular),expected);assert.ok(r.power<=0);
 }
});
test('RHS rotates covariantly in horizontal plane and reduces to source axial law',()=>{
 const rotate=(v,t)=>[Math.cos(t)*v[0]+Math.sin(t)*v[2],v[1],-Math.sin(t)*v[0]+Math.cos(t)*v[2]];
 const b=body(),r=sourceLawNonaxialRHS(b,material);
 for(const theta of [.37,1.2,Math.PI/2]){const q=sourceLawNonaxialRHS({...b,velocity:rotate(b.velocity,theta),angular:rotate(b.angular,theta)},material);assert.equal(q.eligible,true);vectorClose(q.velocityDerivative,rotate(r.velocityDerivative,theta));vectorClose(q.angularDerivative,rotate(r.angularDerivative,theta));close(q.power,r.power);}
 for(const b of [body([1,0,0],[0,2,-6]),body([-.4,0,0],[0,-3,9]),body([0,0,.6],[8,0,0])]){const a=prepareCollinearSegment(b,material),r=sourceLawNonaxialRHS(b,material);assert.equal(a.eligible,true);assert.equal(r.eligible,true);vectorClose(r.velocityDerivative,a.acceleration);vectorClose(r.angularDerivative,a.angularAcceleration);}
});
test('regime boundaries and unsupported/invalid conditions fail closed, without extrapolated tangent events',()=>{
 assert.deepEqual(sourceLawNonaxialRHS(body([1,0,0],[0,0,-1/.03075]),material).boundaries,['slip-zero-unqualified-rolling']);
 assert.ok(sourceLawNonaxialRHS(body([1,0,0],[0,2,0]),material).boundaries.includes('tangential-spin-zero'));
 for(const b of [{...body(),provenance:'live-unverified'},body([1,.01,0]),{...body(),externalForce:true},body([1,0,0],[Number.MIN_VALUE,0,2])])assert.equal(sourceLawNonaxialRHS(b,material).eligible,false);
 assert.equal(sourceLawNonaxialRHS(body(),{...material,gravity:1e308}).eligible,false);
 assert.equal(sourceLawNonaxialRHS({...body([1e200,0,0],[0,0,-1]),mass:1e200},material).eligible,false);
 const r=sourceLawNonaxialRHS(body(),material);close(r.normalSpinStopTime,3/(5*material.gravity*material.spinLength/(2*.03075**2)));assert.equal(r.futureTangentialBoundaryCertified,false);assert.equal(r.trajectoryAdvanced,false);
 const underflow=sourceLawNonaxialRHS(body([.7,0,-.4],[8,Number.MIN_VALUE,-5]),material);assert.equal(underflow.eligible,true);assert.equal(underflow.normalSpinStopTimeUnderflow,true);

});

test('normal load and original patch cap remain separate',()=>{
 const b=body(),m={...material,normalLoadGravity:10,patchCapGravity:9},r=sourceLawNonaxialRHS(b,m);assert.equal(r.eligible,true);close(Math.hypot(...r.force),b.mass*10*material.clothFriction);close(Math.hypot(...r.rollingTorque),b.mass*9*material.rollingLength);close(Math.abs(r.normalTorque[1]),b.mass*9*material.spinLength);
 const lower=sourceLawNonaxialRHS(b,{...m,normalLoadGravity:8});close(Math.hypot(...lower.rollingTorque),b.mass*8*material.rollingLength);
});
